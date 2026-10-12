/**
 * ML Detection Processing Routes
 * Main endpoint for camera feed processing and ML model coordination
 * Supports: live camera feeds, file uploads (image/video), and auto challan generation
 */

import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import MLDetectionLog from '../models/MLDetectionLog.js';
import TrafficViolation from '../models/TrafficViolation.js';
import HelmetViolation from '../models/HelmetViolation.js';
import StreetEncroachment from '../models/StreetEncroachment.js';
import Camera from '../models/Camera.js';
import IllegalParking from '../models/IllegalParking.js';
import { realMLInference } from '../services/realMLInference.js';
import { resolveCameraLocation } from '../services/cameraLocationService.js';
import { createChallanFromViolation } from '../services/challanGenerationService.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { processEnforcementDetections, processEncroachmentDetections } from '../services/enforcementWorkflowService.js';
import { processAgentDetections } from '../services/agentWorkflowService.js';
import { getSocketServer } from '../services/socketServer.js';
import {
  evaluateWorkload,
  recordWorkloadDecision
} from '../services/agents/contextAwareWorkload.js';

const router = express.Router();
const io = { emit: (...args) => getSocketServer().emit(...args) };
const liveWorkflowCooldownMs = 5 * 60 * 1000;
const liveWorkflowRuns = new Map();

function getLiveWorkflowKey(cameraId, workflowType, eventType, detection) {
  const identity = (
    detection.workflowIdentity
    ||
    detection.licensePlate
    || detection.plateNumber
    || detection.vehicle_number
    || detection.vehicleId
    || detection.id
    || detection.label
    || detection.class_name
    || detection.type
    || workflowType
  );
  return `${cameraId}:${workflowType}:${eventType}:${String(identity).toLowerCase()}`;
}

function claimLiveWorkflow(key) {
  const now = Date.now();
  for (const [existingKey, expiresAt] of liveWorkflowRuns) {
    if (expiresAt <= now) liveWorkflowRuns.delete(existingKey);
  }
  if (liveWorkflowRuns.has(key)) return false;
  liveWorkflowRuns.set(key, Number.POSITIVE_INFINITY);
  return true;
}

function finishLiveWorkflow(key, succeeded) {
  if (succeeded) {
    liveWorkflowRuns.set(key, Date.now() + liveWorkflowCooldownMs);
  } else {
    liveWorkflowRuns.delete(key);
  }
}

async function getModelHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${realMLInference.mlBackendUrl}/health`, { signal: controller.signal });
    if (!response.ok) throw new Error(`ML backend returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

const uploadDirectory = path.resolve(process.cwd(), 'uploads', 'evidence');
fs.mkdirSync(uploadDirectory, { recursive: true });
const uploadMiddleware = multer({
  dest: uploadDirectory,
  limits: { fileSize: 500 * 1024 * 1024 }
});

router.get('/status', async (req, res) => {
  try {
    const health = await getModelHealth();
    return res.json({ available: true, ...health });
  } catch (error) {
    console.error('ML model health check failed:', error.message);
    return res.status(503).json({
      available: false,
      status: 'offline',
      error: 'ML model service is unavailable'
    });
  }
});

router.post('/detect', authMiddleware, async (req, res) => {
  try {
    const image = req.body.image || req.body.frameBase64 || req.body.frameUrl;
    if (typeof image !== 'string' || !image) {
      return res.status(400).json({ success: false, error: 'image is required' });
    }

    const speedLimit = Number(req.body.speedLimit ?? 60);
    const confidenceThreshold = Number(req.body.confidenceThreshold ?? 0.75);
    if (
      !Number.isFinite(speedLimit) || speedLimit <= 0
      || !Number.isFinite(confidenceThreshold) || confidenceThreshold < 0 || confidenceThreshold > 1
    ) {
      return res.status(400).json({ success: false, error: 'Invalid speed limit or confidence threshold' });
    }
    const cameraId = req.body.cameraId || 'CONNECTED-VEHICLE-LIVE';
    const cameraLocation = await resolveCameraLocation({
      cameraId,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      locationName: req.body.location,
      accuracyMeters: req.body.locationAccuracyMeters
    });
    if (cameraLocation.status === 'invalid') {
      return res.status(400).json({ success: false, error: cameraLocation.error });
    }

    const isDataUrl = image.startsWith('data:');
    const isHttpUrl = /^https?:\/\//i.test(image);
    const dataUrlSeparator = image.indexOf(',');
    if (isDataUrl && dataUrlSeparator < 0) {
      return res.status(400).json({ success: false, error: 'Image data URL is malformed' });
    }
    const result = await realMLInference.processFrame({
      frameBase64: isHttpUrl ? undefined : isDataUrl ? image.slice(dataUrlSeparator + 1) : image,
      frameUrl: isHttpUrl ? image : undefined,
      location: cameraLocation.name,
      latitude: cameraLocation.coordinates?.latitude,
      longitude: cameraLocation.coordinates?.longitude,
      locationAccuracyMeters: cameraLocation.accuracyMeters,
      speedLimit,
      signalStatus: req.body.signalStatus || 'green',
      source: req.body.source || 'DASHCAM'
    });

    if (!result.success || !result.model || result.model.source === 'unavailable') {
      return res.status(503).json({
        success: false,
        error: result.model?.warning || 'ML model inference is unavailable',
        model: result.model || null,
        degraded: true
      });
    }

    const detections = [];
    const confidenceOf = (detection) => {
      const value = detection.confidence ?? detection.detection_confidence ?? detection.collision_probability;
      return Number.isFinite(Number(value)) ? Number(value) : null;
    };

    // 1. Potholes (from trained pothole_detector best.pt)
    if (Array.isArray(result.potholes)) {
      result.potholes.forEach((pot, idx) => {
        detections.push({
          id: `pot-${idx}-${Date.now()}`,
          label: 'POTHOLE',
          type: 'pothole',
          confidence: confidenceOf(pot),
          severity: pot.severity || 'HIGH',
          bbox: pot.bbox
        });
      });
    }

    // 2. Accident / Collision
    if (result.accident_detection?.accident_detected || result.events?.accident?.detected) {
      const details = result.accident_detection?.details || {};
      detections.push({
        id: details.accident_id || `acc-${Date.now()}`,
        label: 'ACCIDENT',
        type: 'accident',
        confidence: confidenceOf(details) ?? confidenceOf(result.accident_detection),
        severity: details.severity || 'CRITICAL',
        bbox: details.bbox || result.vehicles?.[0]?.bbox
      });
    }

    // 3. Vehicles
    if (Array.isArray(result.vehicles)) {
      result.vehicles.forEach(vehicle => {
        detections.push({
          id: vehicle.id || `veh-${Math.random()}`,
          label: (vehicle.class_name || vehicle.class || 'vehicle').toUpperCase(),
          type: 'vehicle',
          confidence: confidenceOf(vehicle),
          speed: vehicle.speed,
          bbox: vehicle.bbox
        });
      });
    }

    // 4. Pedestrians
    if (Array.isArray(result.pedestrians)) {
      result.pedestrians.forEach(ped => {
        detections.push({
          id: ped.id || `ped-${Math.random()}`,
          label: 'PEDESTRIAN',
          type: 'pedestrian',
          confidence: confidenceOf(ped),
          bbox: ped.bbox
        });
      });
    }

    // 5. Urban Issues / Road Hazards
    if (Array.isArray(result.urban_issues)) {
      result.urban_issues.forEach((issue, idx) => {
        detections.push({
          id: `issue-${idx}`,
          label: (issue.label || 'ROAD_HAZARD').toUpperCase(),
          type: 'hazard',
          confidence: confidenceOf(issue),
          bbox: issue.bbox
        });
      });
    }

    const waterLogging = result.events?.water_logging || result.water_logging;
    if (waterLogging?.detected) {
      detections.push({
        id: 'water-logging',
        label: 'WATER LOGGING',
        type: 'water_logging',
        confidence: confidenceOf(waterLogging),
        bbox: waterLogging.bbox
      });
    }
    if (result.fallen_tree?.label) {
      detections.push({
        id: 'fallen-tree',
        label: result.fallen_tree.label,
        type: 'fallen_tree',
        confidence: confidenceOf(result.fallen_tree),
        bbox: result.fallen_tree.bbox
      });
    }

    // 6. Street Encroachment / Vendors
    if (Array.isArray(result.vendors)) {
      result.vendors.forEach((vendor, idx) => {
        detections.push({
          id: `vendor-${idx}`,
          label: 'ENCROACHMENT',
          type: 'encroachment',
          confidence: confidenceOf(vendor),
          bbox: vendor.bbox
        });
      });
    }

    for (const [idx, helmet] of (result.helmets || []).entries()) {
      detections.push({
        id: `helmet-${idx}`,
        label: helmet.helmetDetected === false ? 'NO HELMET' : 'HELMET',
        type: 'helmet',
        confidence: confidenceOf(helmet),
        vehicleId: helmet.vehicleId
      });
    }

    for (const [idx, speed] of (result.speeds || []).entries()) {
      if (!Number.isFinite(Number(speed.speed))) continue;
      detections.push({
        id: `speed-${idx}`,
        label: speed.isSpeeding ? 'SPEEDING' : 'SPEED',
        type: 'speed',
        confidence: confidenceOf(speed),
        speed: Number(speed.speed),
        bbox: speed.bbox
      });
    }
    for (const [idx, speed] of (result.speed_tracking_detections || []).entries()) {
      if (!Number.isFinite(Number(speed.speed_kmh ?? speed.speed))) continue;
      detections.push({
        id: `tracked-speed-${idx}`,
        label: speed.isSpeeding || speed.rashDriving ? 'SPEEDING' : 'SPEED',
        type: 'speed',
        confidence: confidenceOf(speed),
        speed: Number(speed.speed_kmh ?? speed.speed),
        bbox: speed.bbox
      });
    }

    for (const [idx, violation] of (result.signalViolations || []).entries()) {
      detections.push({
        id: `signal-${idx}`,
        label: 'SIGNAL VIOLATION',
        type: 'signal_violation',
        confidence: confidenceOf(violation),
        vehicleId: violation.vehicleId,
        bbox: violation.bbox
      });
    }

    for (const [idx, parking] of (result.illegalParkings || []).entries()) {
      detections.push({
        id: `parking-${idx}`,
        label: 'ILLEGAL PARKING',
        type: 'illegal_parking',
        confidence: confidenceOf(parking),
        vehicleId: parking.vehicleId,
        bbox: parking.bbox
      });
    }

    for (const [idx, crowd] of (result.crowd_detections || []).entries()) {
      detections.push({
        id: `crowd-${idx}`,
        label: crowd.label || 'CROWD',
        type: 'crowd',
        confidence: confidenceOf(crowd),
        bbox: crowd.bbox
      });
    }
    if (result.hawkers?.hawkersDetected) {
      detections.push({
        id: 'hawkers',
        label: 'STREET VENDOR',
        type: 'encroachment',
        confidence: confidenceOf(result.hawkers),
        bbox: result.hawkers.bbox
      });
    }

    // 7. License Plate Detections
    const plateDetections = result.plate_detections || result.plates || [];
    if (Array.isArray(plateDetections)) {
      plateDetections.forEach((plate, idx) => {
        const pText = (plate.plate_text || '').trim();
        if (pText && pText !== 'UNREADABLE') {
          detections.push({
            id: `plate-${idx}`,
            label: pText,
            type: 'plate',
            confidence: confidenceOf(plate),
            bbox: plate.bbox
          });
        }
      });
    }

    const location = cameraLocation.name;
    const frame = {
      cameraId,
      location,
      latitude: cameraLocation.coordinates?.latitude,
      longitude: cameraLocation.coordinates?.longitude,
      locationSource: cameraLocation.source,
      context: req.body.context || {},
      speedLimit,
      signalStatus: req.body.signalStatus || 'green',
      imageUrl: image,
      source: 'camera_ml'
    };
    const meetsThreshold = (detection) => {
      const confidence = confidenceOf(detection);
      return confidence !== null && confidence >= confidenceThreshold;
    };
    const actionableResult = {
      ...result,
      potholes: (result.potholes || []).filter(meetsThreshold),
      urban_issues: (result.urban_issues || []).filter(meetsThreshold),
      helmets: (result.helmets || []).filter(meetsThreshold),
      speeds: (result.speeds || []).filter(meetsThreshold),
      speed_tracking_detections: (result.speed_tracking_detections || []).filter(meetsThreshold),
      signalViolations: (result.signalViolations || []).filter(meetsThreshold),
      illegalParkings: (result.illegalParkings || []).filter(meetsThreshold),
      vendors: (result.vendors || []).filter(meetsThreshold),
      events: {
        ...result.events,
        water_logging: meetsThreshold(result.events?.water_logging || result.water_logging || {})
          ? (result.events?.water_logging || result.water_logging)
          : { detected: false }
      },
      accident_detection: result.accident_detection?.accident_detected
        && meetsThreshold(result.accident_detection.details || result.accident_detection)
        ? result.accident_detection
        : { ...result.accident_detection, accident_detected: false },
      water_logging: meetsThreshold(result.events?.water_logging || result.water_logging || {})
        ? result.water_logging
        : { ...result.water_logging, detected: false },
      fallen_tree: meetsThreshold(result.fallen_tree || {}) ? result.fallen_tree : {},
      hawkers: meetsThreshold(result.hawkers || {}) ? result.hawkers : { ...result.hawkers, hawkersDetected: false }
    };
    let workflowResults = {
      agentWorkflows: [],
      enforcementWorkflows: [],
      encroachmentWorkflows: [],
      workflowStatus: 'no_actionable_detections'
    };

    const eventClaims = new Map();
    const claimItems = (items, workflowType, eventType, identify = (item) => item) => {
      const claimed = eventClaims.get(workflowType) || [];
      const freshItems = items.filter((item) => {
        const identity = identify(item);
        if (!identity) return false;
        const key = getLiveWorkflowKey(cameraId, workflowType, eventType, identity);
        if (!claimLiveWorkflow(key)) return false;
        claimed.push(key);
        return true;
      });
      eventClaims.set(workflowType, claimed);
      return freshItems;
    };
    const finishClaims = (keys, succeeded) => keys.forEach((key) => finishLiveWorkflow(key, succeeded));
    const normalizedRoadIssue = (item) => {
      const label = String(item.label || item.class_name || item.type || '').toLowerCase();
      if (label.includes('pothole')) return { workflowIdentity: 'pothole' };
      if (label.includes('water')) return { workflowIdentity: 'waterlogging' };
      if (label.includes('tree')) return { workflowIdentity: 'fallen-tree' };
      if (label.includes('accident') || label.includes('collision')) return { workflowIdentity: 'accident' };
      if (label.includes('encroach') || label.includes('hawker') || label.includes('vendor')) return { workflowIdentity: 'encroachment' };
      return null;
    };

    const agentResult = {
      ...actionableResult,
      potholes: claimItems(actionableResult.potholes, 'agents', 'road-issue', normalizedRoadIssue),
      urban_issues: claimItems(actionableResult.urban_issues, 'agents', 'road-issue', normalizedRoadIssue)
    };
    const waterDetection = actionableResult.events.water_logging;
    if (waterDetection?.detected) {
      const waterClaim = claimItems([waterDetection], 'agents', 'road-issue', () => ({ workflowIdentity: 'waterlogging' }));
      agentResult.events = { ...agentResult.events, water_logging: waterClaim[0] || { detected: false } };
      agentResult.water_logging = waterClaim[0] || { detected: false };
    }
    if (actionableResult.fallen_tree?.label) {
      agentResult.fallen_tree = claimItems(
        [actionableResult.fallen_tree],
        'agents',
        'road-issue',
        () => ({ workflowIdentity: 'fallen-tree' })
      )[0] || {};
    }
    if (actionableResult.accident_detection?.accident_detected) {
      const accident = claimItems(
        [actionableResult.accident_detection],
        'agents',
        'road-issue',
        () => ({ workflowIdentity: 'accident' })
      );
      agentResult.accident_detection = accident[0] || { accident_detected: false };
    }
    if (actionableResult.hawkers?.hawkersDetected) {
      const hawkers = claimItems(
        [actionableResult.hawkers],
        'agents',
        'road-issue',
        () => ({ workflowIdentity: 'encroachment' })
      );
      agentResult.hawkers = hawkers[0] || { hawkersDetected: false };
    }

    const enforcementResult = {
      ...actionableResult,
      helmets: claimItems(
        actionableResult.helmets.filter((item) => item.helmetDetected === false),
        'enforcement',
        'helmet'
      ),
      speeds: claimItems(
        actionableResult.speeds.filter((item) => item.isSpeeding || item.rashDriving),
        'enforcement',
        'speed'
      ),
      speed_tracking_detections: claimItems(
        actionableResult.speed_tracking_detections.filter((item) => item.isSpeeding || item.rashDriving),
        'enforcement',
        'tracked-speed'
      ),
      signalViolations: claimItems(actionableResult.signalViolations, 'enforcement', 'signal'),
      illegalParkings: claimItems(actionableResult.illegalParkings, 'enforcement', 'illegal-parking')
    };
    const encroachmentResult = {
      ...actionableResult,
      illegalParkings: claimItems(actionableResult.illegalParkings, 'encroachment', 'illegal-parking'),
      vendors: claimItems(actionableResult.vendors, 'encroachment', 'vendor'),
      urban_issues: claimItems(
        actionableResult.urban_issues.filter((item) => /vendor|hawker|encroach|stall/i.test(item.label || item.class_name || item.type || '')),
        'encroachment',
        'urban-encroachment'
      ),
      hawkers: actionableResult.hawkers?.hawkersDetected
        ? claimItems([actionableResult.hawkers], 'encroachment', 'hawker')[0] || { hawkersDetected: false }
        : actionableResult.hawkers
    };

    const hasAgentEvents = agentResult.potholes.length
      || agentResult.urban_issues.length
      || agentResult.events.water_logging?.detected
      || agentResult.fallen_tree?.label
      || agentResult.accident_detection?.accident_detected
      || agentResult.hawkers?.hawkersDetected;
    const hasEnforcementEvents = enforcementResult.helmets.length
      || enforcementResult.speeds.length
      || enforcementResult.speed_tracking_detections.length
      || enforcementResult.signalViolations.length
      || enforcementResult.illegalParkings.length;
    const hasEncroachmentEvents = encroachmentResult.illegalParkings.length
      || encroachmentResult.vendors.length
      || encroachmentResult.urban_issues.length
      || encroachmentResult.hawkers?.hawkersDetected;
    const hasActionableEvents = actionableResult.potholes.length
      || actionableResult.urban_issues.length
      || actionableResult.helmets.some((item) => item.helmetDetected === false)
      || actionableResult.speeds.some((item) => item.isSpeeding || item.rashDriving)
      || actionableResult.speed_tracking_detections.some((item) => item.isSpeeding || item.rashDriving)
      || actionableResult.signalViolations.length
      || actionableResult.illegalParkings.length
      || actionableResult.vendors.length
      || actionableResult.events.water_logging?.detected
      || actionableResult.fallen_tree?.label
      || actionableResult.hawkers?.hawkersDetected
      || actionableResult.accident_detection?.accident_detected;

    if (hasActionableEvents && ['real', 'ITD'].includes(result.model.source)) {
      const runClaimedWorkflow = async (workflowType, hasEvents, callback) => {
        if (!hasEvents) return [];
        const keys = eventClaims.get(workflowType) || [];
        try {
          const workflows = await callback();
          finishClaims(keys, true);
          return workflows;
        } catch (workflowError) {
          finishClaims(keys, false);
          throw workflowError;
        }
      };
      const roadIssueWorkflows = await runClaimedWorkflow(
        'agents',
        hasAgentEvents,
        async () => processAgentDetections(agentResult, frame, req.user.userId)
      );
      const enforcementWorkflows = await runClaimedWorkflow(
        'enforcement',
        hasEnforcementEvents,
        async () => processEnforcementDetections(enforcementResult, frame)
      );
      const encroachmentWorkflows = await runClaimedWorkflow(
        'encroachment',
        hasEncroachmentEvents,
        async () => processEncroachmentDetections(encroachmentResult, frame)
      );
      workflowResults = {
        agentWorkflows: [
          ...roadIssueWorkflows.map(({ issue, eventType, persistenceStatus, workflow }) => ({
            issueId: issue?._id || null,
            issueType: issue?.issueType || eventType,
            status: issue?.status || persistenceStatus || 'workflow_completed',
            agentWorkflow: issue?.agentWorkflow || workflow.allocation,
            persistenceStatus: persistenceStatus || 'persisted',
            workflow
          })),
          ...enforcementWorkflows,
          ...encroachmentWorkflows
        ],
        enforcementWorkflows,
        encroachmentWorkflows,
        workflowStatus: roadIssueWorkflows.some((item) => item.persistenceStatus === 'location_required')
          ? 'completed_location_required'
          : roadIssueWorkflows.length || enforcementWorkflows.length || encroachmentWorkflows.length
            ? 'completed'
          : 'duplicate_suppressed'
      };
    } else if (hasActionableEvents) {
      workflowResults.workflowStatus = 'skipped_degraded_model';
    }

    const safetyDetection = detections.find((detection) => (
      ['accident', 'emergency', 'hazard', 'pothole'].includes(String(detection.type).toLowerCase())
    ));
    const workloadEvent = {
      eventId: req.body.eventId,
      eventType: safetyDetection?.type || req.body.eventType || 'CAMERA_FRAME',
      requestedFeature: 'camera_monitoring',
      detection: safetyDetection
        ? {
            type: safetyDetection.type,
            severity: safetyDetection.severity,
            confidence: safetyDetection.confidence
          }
        : {},
      context: req.body.context || {},
      location: req.body.location
    };
    const workload = evaluateWorkload(workloadEvent);
    if (!(workflowResults.agentWorkflows || []).length) {
      recordWorkloadDecision(workloadEvent, workload, 'camera_monitoring', null, {
        status: 'MONITORING',
        modelUsage: result.model?.name
          ? [{
              model: result.model.name,
              precision: typeof result.model.precision === 'string'
                ? result.model.precision
                : result.model.selected_precision || 'not-reported-by-inference-source',
              runtime: result.model.runtime || 'not-reported-by-inference-source'
            }]
          : [],
        measurements: {
          sampling: workload.sampling,
          energy: {
            status: 'unavailable',
            reason: 'Camera monitoring has no per-frame power telemetry or energy attribution.'
          }
        }
      });
    }

    return res.json({
      success: true,
      detections,
      frame_dimensions: result.frame_dimensions || null,
      model: result.model,
      degraded: !['real', 'ITD'].includes(result.model.source),
      location: cameraLocation,
      workload,
      ...workflowResults
    });
  } catch (error) {
    console.error('Live ML detection workflow failed:', error);
    return res.status(500).json({ success: false, error: 'Live ML detection workflow failed', details: error.message });
  }
});

/**
 * POST /api/ml-detection/process-frame
 * Main endpoint for processing camera frames with all ML models
 * Supports: base64 data, frame URL, or file upload
 */
router.post('/process-frame', authMiddleware, async (req, res) => {
  try {
    const {
      cameraId = 'SIM-CAM-001',
      frameUrl,
      signalStatus = 'green',
      speedLimit = 60
    } = req.body;
    const cameraLocation = await resolveCameraLocation({
      cameraId,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      locationName: req.body.location,
      accuracyMeters: req.body.locationAccuracyMeters
    });
    if (cameraLocation.status === 'invalid') {
      return res.status(400).json({ success: false, error: cameraLocation.error });
    }
    const location = cameraLocation.name;
    const latitude = cameraLocation.coordinates?.latitude;
    const longitude = cameraLocation.coordinates?.longitude;

    console.log(`\n🎥 Processing frame from ${cameraId}`);

    let frameBase64 = req.body.frameBase64;
    let normalizedFrameUrl = frameUrl;

    if (frameUrl && frameUrl.startsWith('data:')) {
      const commaIndex = frameUrl.indexOf(',');
      if (commaIndex >= 0) {
        frameBase64 = frameUrl.substring(commaIndex + 1);
        normalizedFrameUrl = undefined;
      }
    }

    const frameData = {
      frameUrl: normalizedFrameUrl,
      frameBase64,
      location,
      latitude,
      longitude,
      locationAccuracyMeters: cameraLocation.accuracyMeters,
      locationSource: cameraLocation.source,
      signalStatus,
      speedLimit,
      fps: 30,
      timestamp: new Date()
    };

    const uploadedImageUrl = frameUrl || (frameBase64 ? `data:image/jpeg;base64,${frameBase64}` : '');

    // Run REAL ML inference
    const detectionResult = await realMLInference.processFrame(frameData);
    if (!detectionResult.success || !['real', 'ITD'].includes(detectionResult.model?.source)) {
      return res.status(503).json({
        success: false,
        message: detectionResult.model?.warning || 'A real ML model is unavailable; no workflow actions were created.',
        model: detectionResult.model || null
      });
    }

    const agentWorkflows = await processAgentDetections(detectionResult, {
      ...frameData,
      imageUrl: uploadedImageUrl,
      source: 'camera_ml'
    }, req.user.userId);
    const enforcementWorkflows = await processEnforcementDetections(detectionResult, {
      ...frameData,
      imageUrl: uploadedImageUrl,
      source: 'camera_ml'
    });
    const encroachmentWorkflows = await processEncroachmentDetections(detectionResult, {
      ...frameData,
      imageUrl: uploadedImageUrl,
      source: 'camera_ml'
    });

    const violationsSummary = {
      helmet: [],
      speeding: [],
      signalViolation: [],
      crowd: [],
      hawkers: []
    };

    const challengesCreated = [];

    // ========== HELMET VIOLATION PROCESSING ==========
    for (const helmet of detectionResult.helmets) {
      if (!helmet.helmetDetected) {
        const vehicle = detectionResult.vehicles.find(v => v.id === helmet.vehicleId);
        if (vehicle && vehicle.plateNumber) {
          console.log(`  🪖 Helmet violation: ${vehicle.plateNumber}`);
          try {
            const violation = await HelmetViolation.create({
              vehicleNumber: vehicle.plateNumber,
              helmetStatus: helmet.helmetType,
              signalLocation: location,
              latitude,
              longitude,
              cameraId,
              imageUrl: frameUrl,
              timestamp: new Date(),
              severity: 'violation',
              fineAmount: 500,
              status: 'pending'
            });

            violationsSummary.helmet.push(violation._id);

            // AUTO-CREATE CHALLAN
            const challan = await createChallanFromViolation(violation, 'HelmetViolation');
            if (challan) {
              challengesCreated.push({
                type: 'helmet',
                challanNumber: challan.challanNumber,
                vehicleNumber: vehicle.plateNumber,
                fine: 500
              });
              console.log(`    ✅ Challan: ${challan.challanNumber}`);
            }

            // Broadcast alert
            io.emit('helmet_violation_detected', {
              vehicleNumber: vehicle.plateNumber,
              cameraId,
              fine: 500,
              timestamp: new Date()
            });
          } catch (error) {
            console.error('Helmet violation processing failed:', error);
          }
        }
      }
    }

    // ========== SPEED VIOLATION PROCESSING ==========
    for (const speed of detectionResult.speeds) {
      if (speed.speed > speedLimit) {
        const vehicle = detectionResult.vehicles.find(v => v.id === speed.vehicleId);
        if (vehicle && vehicle.plateNumber) {
          const fineAmount = (speed.speed - speedLimit) * 100;
          console.log(`  🚗 Speeding: ${vehicle.plateNumber} at ${speed.speed} km/h (limit: ${speedLimit})`);
          try {
            const violation = await TrafficViolation.create({
              vehicleNumber: vehicle.plateNumber,
              violationType: 'speeding',
              speedRecorded: speed.speed,
              speedLimit: speedLimit,
              signalLocation: location,
              latitude,
              longitude,
              cameraId,
              imageUrl: frameUrl,
              timestamp: new Date(),
              severity: 'high',
              vehicleClass: vehicle.class,
              fineAmount: fineAmount,
              status: 'pending'
            });

            violationsSummary.speeding.push(violation._id);

            // AUTO-CREATE CHALLAN
            const challan = await createChallanFromViolation(violation, 'TrafficViolation');
            if (challan) {
              challengesCreated.push({
                type: 'speeding',
                challanNumber: challan.challanNumber,
                vehicleNumber: vehicle.plateNumber,
                fine: fineAmount
              });
              console.log(`    ✅ Challan: ${challan.challanNumber}`);
            }

            // Broadcast alert
            io.emit('speeding_detected', {
              vehicleNumber: vehicle.plateNumber,
              speed: speed.speed,
              limit: speedLimit,
              fine: fineAmount,
              cameraId,
              timestamp: new Date()
            });
          } catch (error) {
            console.error('Speeding violation processing failed:', error);
          }
        }
      }
    }

    // ========== SIGNAL VIOLATION PROCESSING ==========
    for (const sigViolation of detectionResult.signalViolations) {
      const vehicle = detectionResult.vehicles.find(v => v.id === sigViolation.vehicleId);
      if (vehicle && vehicle.plateNumber) {
        const fineAmount = signalStatus === 'red' ? 1000 : 500;
        console.log(`  🚦 Signal violation: ${vehicle.plateNumber} (${signalStatus} light)`);
        
        try {
          const violation = await TrafficViolation.create({
            vehicleNumber: vehicle.plateNumber,
            violationType: 'signal_breaking',
            signalStatus: signalStatus,
            signalLocation: location,
            latitude,
            longitude,
            cameraId,
            imageUrl: frameUrl,
            timestamp: new Date(),
            severity: signalStatus === 'red' ? 'high' : 'medium',
            vehicleClass: vehicle.class,
            fineAmount: fineAmount,
            status: 'pending'
          });

          violationsSummary.signalViolation.push(violation._id);

          // AUTO-CREATE CHALLAN
          const challan = await createChallanFromViolation(violation, 'TrafficViolation');
          if (challan) {
            challengesCreated.push({
              type: 'signal_violation',
              challanNumber: challan.challanNumber,
              vehicleNumber: vehicle.plateNumber,
              fine: fineAmount
            });
            console.log(`    ✅ Challan: ${challan.challanNumber}`);
          }

          // Broadcast alert
          io.emit('signal_violation_detected', {
            vehicleNumber: vehicle.plateNumber,
            signal: signalStatus,
            fine: fineAmount,
            cameraId,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('Signal violation processing failed:', error);
        }
      }
    }

    // ========== CROWD DETECTION (Street Encroachment) ==========
    if (detectionResult.crowd?.crowdDetected && (detectionResult.crowd.crowdSize > 5 || detectionResult.crowd.roadBlockagePercentage > 30)) {
      try {
        console.log(`  👥 Crowd detected: ${detectionResult.crowd.crowdSize} people, ${detectionResult.crowd.roadBlockagePercentage}% blockage`);
        
        const encroachment = await StreetEncroachment.create({
          encroachmentType: 'pedestrian_gathering',
          location,
          latitude,
          longitude,
          cameraId,
          crowdSize: detectionResult.crowd.crowdSize || 5,
          roadBlockagePercentage: detectionResult.crowd.roadBlockagePercentage || 35,
          imageUrl: frameUrl,
          timestamp: new Date(),
          severity: (detectionResult.crowd.roadBlockagePercentage || 0) > 60 ? 'critical' : 'high',
          status: (detectionResult.crowd.roadBlockagePercentage || 0) > 60 ? 'reported' : 'detected'
        });

        violationsSummary.crowd.push(encroachment._id);

        io.emit('street_encroachment_detected', {
          type: 'crowd',
          crowdSize: detectionResult.crowd.crowdSize,
          blockagePercentage: detectionResult.crowd.roadBlockagePercentage,
          severity: encroachment.severity,
          cameraId,
          timestamp: new Date()
        });
      } catch (err) {
        console.warn('Crowd encroachment record warning:', err.message);
      }
    }

    // ========== HAWKER/VENDOR DETECTION ==========
    if (detectionResult.hawkers?.hawkersDetected) {
      try {
        console.log(`  🏪 Hawkers detected: ${detectionResult.hawkers.hawkerCount} vendors`);
        
        const encroachment = await StreetEncroachment.create({
          encroachmentType: 'hawker',
          location,
          latitude,
          longitude,
          cameraId,
          crowdSize: detectionResult.hawkers.hawkerCount || 2,
          roadBlockagePercentage: detectionResult.hawkers.roadBlockagePercentage || 25,
          imageUrl: frameUrl,
          timestamp: new Date(),
          severity: 'medium',
          status: 'detected',
          description: `${detectionResult.hawkers.hawkerCount || 2} vendors with items`
        });

        violationsSummary.hawkers.push(encroachment._id);

        io.emit('hawker_vendor_detected', {
          vendorCount: detectionResult.hawkers.hawkerCount,
          items: detectionResult.hawkers.merchandiseItems,
          blockagePercentage: detectionResult.hawkers.roadBlockagePercentage,
          location,
          cameraId,
          actionRequired: 'Authority intervention needed',
          timestamp: new Date()
        });
      } catch (err) {
        console.warn('Hawker encroachment record warning:', err.message);
      }
    }

    // ========== AUTOMATED E-CHALLAN GENERATION FROM ML VISION ENGINE ==========
    if (detectionResult.echallans_generated?.challans && detectionResult.echallans_generated.challans.length > 0) {
      for (const echallan of detectionResult.echallans_generated.challans) {
        try {
          const challan = await createChallanFromViolation({
            ...echallan,
            vehicleNumber: echallan.vehicle_number,
            violationType: echallan.type,
            title: echallan.title,
            fineAmount: echallan.fine_amount,
            legal_section: echallan.legal_section,
            challanNumber: echallan.challan_number,
            location: location,
            evidence_photo: echallan.evidence_photo,
            imageUrl: echallan.evidence_photo || frameUrl,
            timestamp: new Date()
          }, 'MLVisionTrafficEngine');

          if (challan) {
            challengesCreated.push({
              type: echallan.type,
              challanNumber: challan.challanNumber,
              vehicleNumber: challan.vehicleNumber,
              ownerName: challan.ownerName,
              fine: challan.fineAmount,
              legalSection: challan.legalSection,
              evidencePhoto: challan.imageUrl
            });
          }
        } catch (err) {
          console.error('Error creating vision echallan:', err);
        }
      }
    }

    // Create detection log
    let detectionLog = null;
    try {
      detectionLog = await MLDetectionLog.create({
        cameraId,
        detectionType: 'comprehensive_analysis',
        detectionDetails: {
          vehiclesDetected: detectionResult.vehicles?.length || 0,
          helmetViolations: detectionResult.helmets?.filter(h => !h.helmetDetected).length || 0,
          speedingViolations: detectionResult.speeds?.filter(s => s.speed > speedLimit).length || 0,
          signalViolations: detectionResult.signalViolations?.length || 0,
          crowdDetected: detectionResult.crowd?.crowdDetected || false,
          hawkersDetected: detectionResult.hawkers?.hawkersDetected || false,
          challansGenerated: challengesCreated.length
        },
        frameUrl,
        violationsCreated: violationsSummary,
        processingStatus: 'completed',
        processingTime: detectionResult.processingTime || 120
      });
    } catch (error) {
      console.error('Detection log save failed:', error);
    }

    const totalViolations = Object.values(violationsSummary).reduce((sum, arr) => sum + arr.length, 0) + challengesCreated.length;

    res.json({
      success: true,
      message: 'Frame processed successfully with real-time AI E-Challan generation',
      timestamp: new Date(),
      cameraId,
      location: cameraLocation,
      data: detectionResult,
      summary: {
        vehiclesDetected: detectionResult.vehicles?.length || 0,
        helmetViolations: violationsSummary.helmet.length,
        speedingViolations: violationsSummary.speeding.length,
        signalViolations: violationsSummary.signalViolation.length,
        crowdIncidents: violationsSummary.crowd.length,
        hawkerIncidents: violationsSummary.hawkers.length,
        totalViolations: totalViolations,
        challansGenerated: challengesCreated.length
      },
      challansCreated: challengesCreated,
      detectionLogId: detectionLog?._id || null,
      agentWorkflows: [
        ...agentWorkflows.map(({ issue, eventType, persistenceStatus, workflow }) => ({
        issueId: issue?._id || null,
        issueType: issue?.issueType || eventType,
        status: issue?.status || persistenceStatus || 'workflow_completed',
        agentWorkflow: issue?.agentWorkflow || workflow.allocation,
        persistenceStatus: persistenceStatus || 'persisted',
        workflow
        })),
        ...enforcementWorkflows,
        ...encroachmentWorkflows
      ],
      enforcementWorkflows,
      encroachmentWorkflows
    });

  } catch (error) {
    console.error('Error processing frame:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing frame',
      error: error.message
    });
  }
});

/**
 * POST /api/ml-detection/upload-image
 * Upload and process a single image
 */
router.post('/upload-image', authMiddleware, uploadMiddleware.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    console.log(`\n📸 Processing uploaded image: ${req.file.originalname}`);

    const filePath = req.file.path;
    const result = await processUploadedFile(filePath, 'image', 'UPLOAD-IMG-001', req.user.userId);

    res.json({
      success: true,
      message: 'Image processed successfully',
      fileName: req.file.originalname,
      fileSize: req.file.size,
      ...result
    });

  } catch (error) {
    console.error('Error processing image upload:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing image',
      error: error.message
    });
  }
});

/**
 * POST /api/ml-detection/process-video
 * Full Video ML Pipeline Proxy (ITD Detection, ByteTrack, Segmentation, TMC & TTC)
 */
router.post('/process-video', authMiddleware, uploadMiddleware.single('video'), async (req, res) => {
  try {
    let videoUrl = req.body.videoUrl;
    let videoBase64 = req.body.videoBase64;
    const location = req.body.location || 'Sector 18 Atta Market, Noida';
    const speedLimit = Number(req.body.speedLimit || 60);
    const signalStatus = req.body.signalStatus || 'green';
    const enableSegmentation = req.body.enableSegmentation !== 'false' && req.body.enableSegmentation !== false;
    const maxFrames = Number(req.body.maxFrames || 300);

    if (req.file && req.file.path) {
      videoUrl = req.file.path;
    }

    const payload = {
      video_url: videoUrl,
      video_base64: videoBase64,
      location,
      speed_limit: speedLimit,
      signal_status: signalStatus,
      enable_segmentation: enableSegmentation,
      max_frames: maxFrames
    };

    const postData = JSON.stringify(payload);
    const result = await new Promise((resolve, reject) => {
      const mlReq = http.request({
        hostname: '127.0.0.1',
        port: 8000,
        path: '/process/video',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 600000 // 10 minutes
      }, (mlRes) => {
        let rawBody = '';
        mlRes.on('data', chunk => { rawBody += chunk; });
        mlRes.on('end', () => {
          if (mlRes.statusCode >= 400) {
            reject(new Error(`ML Backend error (${mlRes.statusCode}): ${rawBody.slice(0, 300)}`));
          } else {
            try {
              resolve(JSON.parse(rawBody));
            } catch (err) {
              reject(new Error(`Failed to parse ML response JSON: ${err.message}`));
            }
          }
        });
      });

      mlReq.on('timeout', () => {
        mlReq.destroy();
        reject(new Error('ML Video processing timed out after 10 minutes'));
      });
      mlReq.on('error', (err) => {
        reject(err);
      });

      mlReq.write(postData);
      mlReq.end();
    });

    return res.json({
      success: true,
      data: result,
      message: 'Full video ML segmentation, tracking, TTC and turning movement analysis complete.'
    });
  } catch (error) {
    console.error('Process video endpoint failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ml-detection/upload-video
 * Upload and process a video (extracts and processes key frames)
 */
router.post('/upload-video', authMiddleware, uploadMiddleware.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video uploaded' });
    }

    console.log(`\n🎬 Processing uploaded video: ${req.file.originalname}`);

    const filePath = req.file.path;
    const result = await processVideoFrames(filePath, 'UPLOAD-VID-001', 5);

    res.json({
      success: true,
      message: 'Video processed successfully',
      fileName: req.file.originalname,
      fileSize: req.file.size,
      ...result
    });

  } catch (error) {
    console.error('Error processing video upload:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing video',
      error: error.message
    });
  }
});

/**
 * GET /api/ml-detection/logs
 * Get ML detection logs with filtering
 */
router.get('/logs', optionalAuth, async (req, res) => {
  try {
    const {
      cameraId,
      detectionType,
      limit = 50,
      page = 1
    } = req.query;

    const filter = {};
    if (cameraId) filter.cameraId = cameraId;
    if (detectionType) filter.detectionType = detectionType;

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      MLDetectionLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MLDetectionLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: logs.length,
        total
      }
    });

  } catch (error) {
    console.error('Error fetching detection logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching logs',
      error: error.message
    });
  }
});

/**
 * GET /api/ml-detection/violations
 * Get detected violations by type
 */
router.get('/violations', optionalAuth, async (req, res) => {
  try {
    const {
      type = 'all',
      status = 'pending',
      limit = 50,
      page = 1
    } = req.query;

    const skip = (page - 1) * limit;

    if (type === 'helmet' || type === 'all') {
      const violations = await HelmetViolation.find({ status })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await HelmetViolation.countDocuments({ status });

      return res.json({
        success: true,
        violationType: 'helmet',
        data: violations,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: violations.length,
          total
        }
      });
    }

    if (type === 'traffic' || type === 'all') {
      const violations = await TrafficViolation.find({ status })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await TrafficViolation.countDocuments({ status });

      return res.json({
        success: true,
        violationType: 'traffic',
        data: violations,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: violations.length,
          total
        }
      });
    }

    res.json({ success: true, data: [] });

  } catch (error) {
    console.error('Error fetching violations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching violations',
      error: error.message
    });
  }
});

/**
 * GET /api/ml-detection/stats
 * Get ML detection statistics
 */
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = {
      today: {
        helmetViolations: await HelmetViolation.countDocuments({ timestamp: { $gte: today } }),
        speedingViolations: await TrafficViolation.countDocuments({ 
          timestamp: { $gte: today },
          violationType: 'speeding'
        }),
        signalViolations: await TrafficViolation.countDocuments({ 
          timestamp: { $gte: today },
          violationType: 'signal_breaking'
        })
      },
      total: {
        helmetViolations: await HelmetViolation.countDocuments(),
        trafficViolations: await TrafficViolation.countDocuments(),
        streetEncroachments: await StreetEncroachment.countDocuments()
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

export default router;