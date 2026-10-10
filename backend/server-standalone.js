import express from 'express';
import cors from 'cors';
import http, { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import fs from 'fs';
import path from 'path';
import multer from 'multer';

import urbanflowRoutes from './routes/urbanflow.js';
import bangaloreRoutes from './routes/bangaloreRoutes.js';
import { orchestratorAgent, eventBus } from './services/agents/index.js';
import { processEnforcementDetections, processEncroachmentDetections } from './services/enforcementWorkflowService.js';
import { setSocketServer } from './services/socketServer.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});
setSocketServer(io);
app.set('io', io);

// Configure multer storage for video / evidence uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'evidence');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeExt = path.extname(file.originalname || '.mp4');
    cb(null, `video-${timestamp}-${Math.random().toString(36).substring(7)}${safeExt}`);
  }
});
const videoUpload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use('/public', express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/api/urbanflow', urbanflowRoutes);
app.use('/api/bangalore', bangaloreRoutes);

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = jwt.verify(token, 'secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const mlDetectionStore = [];
const roadIssueStore = [];
const routeAlertStore = [];
const complaintStore = [];

const distanceBetweenCoordinates = (first, second) => {
  const earthRadius = 6371e3;
  const toRadians = (value) => value * Math.PI / 180;
  const latDelta = toRadians(second.lat - first.lat);
  const lngDelta = toRadians(second.lng - first.lng);
  const latitude = toRadians(first.lat);
  const targetLatitude = toRadians(second.lat);
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(latitude) * Math.cos(targetLatitude) * Math.sin(lngDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const findNearestDemoRoad = (coordinates) => {
  const candidates = roadIssueStore
    .filter((issue) => issue.roadIntelligence?.kgisRoad && issue.coordinates?.lat && issue.coordinates?.lng)
    .map((issue) => ({ issue, distance: distanceBetweenCoordinates(coordinates, issue.coordinates) }))
    .sort((first, second) => first.distance - second.distance);
  return candidates[0]?.distance <= 5000 ? candidates[0] : null;
};

const getIssueType = (text = '') => {
  const t = text.toLowerCase();
  if (/(pothole|bump|surface|crack)/.test(t)) return 'Pothole';
  if (/(roadblock|blockage|tree|obstruction|barricade|closure)/.test(t)) return 'Road Blockage';
  if (/(vendor|hawker|encroach|stall|shop)/.test(t)) return 'Street Vendor';
  if (/(water|flood|logging|drain)/.test(t)) return 'Water Logging';
  if (/(accident|crash|collision|impact)/.test(t)) return 'Accident';
  if (/(illegal|parking|no-parking|shoulder)/.test(t)) return 'Illegal Parking';
  if (/(helmet|rash|speed|signal)/.test(t)) return 'Traffic Violation';
  return 'Urban Issue';
};

const issueSeverity = (issueType) => {
  if (['Accident', 'Road Blockage', 'Pothole'].includes(issueType)) return 'HIGH';
  if (['Illegal Parking', 'Traffic Violation', 'Street Vendor'].includes(issueType)) return 'MEDIUM';
  return 'LOW';
};

const buildChallenge = (type, vehicleNumber, amount, location) => ({
  type,
  challanNumber: `CH-${type.toUpperCase().slice(0, 3)}-${String(Date.now()).slice(-6)}`,
  vehicleNumber,
  fine: amount,
  location,
  issuedAt: new Date().toISOString()
});

const generateFallbackDetection = (reqBody = {}) => {
  const location = reqBody.location || 'Silk Board Junction, Bengaluru';
  const signalStatus = reqBody.signalStatus || 'green';
  const speedLimit = Number(reqBody.speedLimit || 60);
  const useFallbackDemo = reqBody.useFallbackDemo === true;
  const fileHint = `${reqBody.frameUrl || ''} ${reqBody.frameBase64 || ''} ${location}`.toLowerCase();

  const hasPothole = /(pothole|bump|crack|surface).*/.test(fileHint);
  const hasAccident = /(accident|collision|crash|impact|wreck).*/.test(fileHint);
  const hasVendor = /(vendor|hawker|encroach|stall|market|shop)/.test(fileHint);
  const hasWater = /(water|flood|drain|logging|rain).*/.test(fileHint);
  const hasRoadBlockage = /(blockage|tree|obstruction|roadblock|barricade|closure)/.test(fileHint);
  const hasIllegalParking = /(illegal|parking|no-parking|shoulder)/.test(fileHint);

  const vehicles = useFallbackDemo ? [
    { id: 'VEH-001', class: '2-wheeler', class_name: 'motorbike', confidence: 0.96, plateNumber: 'KA-01-MJ-4821', speed: 42, bbox: { x1: 120, y1: 260, x2: 260, y2: 420 } },
    { id: 'VEH-002', class: '4-wheeler', class_name: 'car', confidence: 0.95, plateNumber: 'KA-05-NB-7291', speed: 70, bbox: { x1: 380, y1: 230, x2: 560, y2: 400 } },
    { id: 'VEH-003', class: '4-wheeler', class_name: 'car', confidence: 0.93, plateNumber: 'KA-53-AZ-9912', speed: 39, bbox: { x1: 580, y1: 210, x2: 760, y2: 380 } }
  ] : [];

  const urbanIssues = [];
  const violations = [];
  const challans = [];

  if (hasAccident) {
    urbanIssues.push({
      label: 'Accident/Crash',
      type: 'Accident',
      confidence: 0.96,
      bbox: { x1: 310, y1: 180, x2: 620, y2: 360 },
      severity: 'HIGH',
      location,
      issueType: 'Accident'
    });
    violations.push({
      violation_id: 'VIO-ACC-01',
      type: 'accident',
      title: 'Potential collision incident detected',
      fine_amount: 2000,
      legal_section: 'Emergency Response & Accident Safety',
      status: 'ISSUED',
      location
    });
  }

  if (hasVendor) {
    urbanIssues.push({
      label: 'Street vendor / encroachment',
      type: 'Street Vendor',
      confidence: 0.9,
      bbox: { x1: 120, y1: 180, x2: 260, y2: 340 },
      severity: 'MEDIUM',
      location,
      issueType: 'Street Vendor'
    });
    violations.push({
      violation_id: 'VIO-VND-01',
      type: 'street_vendor',
      title: 'Unauthorized vendor / hawker blockage on public footpath',
      fine_amount: 1000,
      legal_section: 'Public Encroachment & Road Safety',
      status: 'ISSUED',
      location
    });
  }

  if (hasWater) {
    urbanIssues.push({
      label: 'Water logging / flood risk',
      type: 'Water Logging',
      confidence: 0.88,
      bbox: { x1: 720, y1: 280, x2: 920, y2: 430 },
      severity: 'MEDIUM',
      location,
      issueType: 'Water Logging'
    });
    violations.push({
      violation_id: 'VIO-WAT-01',
      type: 'water_logging',
      title: 'Water logging detected on road surface',
      fine_amount: 500,
      legal_section: 'Drainage & Road Safety',
      status: 'ISSUED',
      location
    });
  }

  if (hasRoadBlockage) {
    urbanIssues.push({
      label: 'Road blockage / debris / tree obstruction',
      type: 'Road Blockage',
      confidence: 0.94,
      bbox: { x1: 760, y1: 120, x2: 960, y2: 260 },
      severity: 'HIGH',
      location,
      issueType: 'Road Blockage'
    });
    violations.push({
      violation_id: 'VIO-BLK-01',
      type: 'road_blockage',
      title: 'Road obstruction detected',
      fine_amount: 1200,
      legal_section: 'Road Clearance & Public Safety',
      status: 'ISSUED',
      location
    });
  }

  const helmetDetections = useFallbackDemo ? [
    { vehicleId: 'VEH-001', helmetDetected: false, helmetType: 'no_helmet', confidence: 0.93, bbox: { x1: 130, y1: 260, x2: 240, y2: 420 } }
  ] : [];

  const speeds = vehicles.map((vehicle) => ({
    vehicleId: vehicle.id,
    speed: vehicle.speed,
    speedLimit,
    isSpeeding: vehicle.speed > speedLimit,
    confidence: 0.9,
    bbox: vehicle.bbox
  }));

  const illegalParking = hasIllegalParking || useFallbackDemo ? [
    { vehicleId: 'VEH-003', plate: 'KA-53-AZ-9912', location, violationType: 'illegal_parking', fineAmount: 1000 }
  ] : [];

  const signalViolations = useFallbackDemo && signalStatus === 'red' ? [{ vehicleId: 'VEH-002', inViolationZone: true }] : [];

  const totalViolations = [
    ...violations,
    ...speeds.filter((s) => s.isSpeeding).map((s) => ({
      violation_id: `VIO-SPD-${s.vehicleId}`,
      type: 'speeding',
      title: `Over-speeding detected for ${s.vehicleId}`,
      fine_amount: Math.max(1000, (s.speed - s.speedLimit) * 80),
      legal_section: 'Section 183(2), Motor Vehicles Act 1988',
      status: 'ISSUED',
      location
    })),
    ...helmetDetections.filter((h) => !h.helmetDetected).map((h) => ({
      violation_id: `VIO-HLM-${h.vehicleId}`,
      type: 'helmet_violation',
      title: `Helmet violation for ${h.vehicleId}`,
      fine_amount: 500,
      legal_section: 'Section 129, Motor Vehicles Act 1988',
      status: 'ISSUED',
      location
    }))
  ];

  const allChallans = challans.concat(
    speeds.filter((s) => s.isSpeeding).map((s) => buildChallenge('speeding', `VEH-${s.vehicleId}`, Math.max(1000, (s.speed - s.speedLimit) * 80), location)),
    helmetDetections.filter((h) => !h.helmetDetected).map(() => buildChallenge('helmet', 'TWO-WHEELER', 500, location))
  );

  return {
    success: true,
    location,
    timestamp: new Date().toISOString(),
    model: {
      name: 'multi-model-urban-safety-fallback',
      backend: 'local-heuristic-synchronizer',
      source: 'fallback',
      warning: 'Using synchronized fallback detection while the Python backend is unavailable.'
    },
    congestion: {
      congestion_level: totalViolations.length > 5 ? 'CRITICAL' : totalViolations.length > 3 ? 'HIGH' : 'MEDIUM',
      vehicle_density_percent: 78,
      total_vehicles_detected: vehicles.length,
      estimated_queue_length_m: 850,
      average_speed_kmh: vehicles.length ? Math.round(vehicles.reduce((sum, v) => sum + v.speed, 0) / vehicles.length) : 0
    },
    accident_detection: {
      accident_detected: hasAccident,
      details: {
        severity: hasAccident ? 'HIGH' : 'NONE',
        collision_probability: hasAccident ? 0.94 : 0,
        confidence: hasAccident ? 0.96 : 0,
        vehicles_involved: vehicles.map((v) => v.id),
        location,
        road_blockage_percent: 80,
        emergency_dispatch_recommended: true
      }
    },
    urban_issues: urbanIssues,
    vendors: hasVendor ? [{ label: 'vendor', confidence: 0.9, bbox: { x1: 90, y1: 160, x2: 270, y2: 330 } }] : [],
    plate_detections: vehicles.map((v) => ({ plate_text: v.plateNumber, confidence: 0.96, bbox: v.bbox })),
    helmet_detections: helmetDetections,
    speed_detections: speeds,
    segmentation: {
      enabled: true,
      road_lanes: { lane_1: [[120, 480], [420, 220], [520, 220], [420, 480]], lane_2: [[420, 480], [520, 220], [680, 220], [780, 480]] },
      vehicle_polygons_count: vehicles.length
    },
    plates: vehicles.map((v) => ({ vehicle_id: v.id, plate_text: v.plateNumber, confidence: 0.96, bbox: v.bbox })),
    vehicles,
    pedestrians: [{ id: 'PED-001', bbox: { x1: 700, y1: 420, x2: 760, y2: 520 }, confidence: 0.92 }],
    helmets: helmetDetections,
    speeds,
    signalViolations,
    illegalParkings: illegalParking,
    crowd: { crowdDetected: false, crowdSize: 0, roadBlockagePercentage: 0, severity: 'NONE' },
    hawkers: { hawkersDetected: hasVendor, hawkerCount: hasVendor ? 2 : 0, roadBlockagePercentage: hasVendor ? 28 : 0 },
    events: {
      accident: { detected: hasAccident, confidence: hasAccident ? 0.96 : 0 },
      crowd: { detected: false, count: 0 },
      urban_issues: { detected: urbanIssues.length > 0, count: urbanIssues.length, severity: 'HIGH' },
      water_logging: { detected: hasWater, confidence: 0.88 },
      road_closure: { detected: hasRoadBlockage, confidence: 0.94 }
    },
    violations_summary: {
      total_violations_count: totalViolations.length,
      violations: totalViolations
    },
    echallans_generated: {
      total_challans_count: allChallans.length,
      total_fine_amount_inr: allChallans.reduce((sum, item) => sum + Number(item.fine || 0), 0),
      challans: allChallans
    }
  };
};

const syncFallbackEvents = async (data, location, imageUrl = '') => {
  const payload = data || {};
  const timestamp = new Date().toISOString();
  const issueTypes = [
    ...(payload.potholes || []).map((issue) => issue.type || issue.issueType || issue.label || 'pothole'),
    ...(payload.urban_issues || []).map((issue) => issue.type || issue.issueType || issue.label)
  ];

  if (issueTypes.some((issue) => /pothole|road blockage|accident|vendor|water|blockage/i.test(issue))) {
    const enrichedEvent = eventBus.publish({
      eventType: 'POTHOLE_DETECTED', // general fallback
      location: { lat: 12.9172, lng: 77.6227, name: location },
      detection: { class: 'pothole', severity: 'HIGH', confidence: 0.95 },
      timestamp
    });
    const workflow = await orchestratorAgent.handleNewEvent(enrichedEvent);
    const civicResult = workflow?.results?.CivicAndRoadHealthAgent;
    const c = civicResult?.actionResult?.complaint || civicResult?.actionResult;
    if (c) {
      
      const newIssue = {
        _id: c.complaintId || `COMP-${Date.now()}`,
        issueType: /pothole/i.test(c.issue || '') ? 'Pothole' : c.issue,
        locationName: c.roadName || location,
        coordinates: { lat: 12.9172, lng: 77.6227 },
        priority: c.priority,
        riskScore: c.priority === 'CRITICAL' ? 95 : c.priority === 'HIGH' ? 75 : 40,
        status: 'Assigned',
        source: 'camera_ml',
        imageUrl,
        aiRecommendation: `Responsible authority: ${c.department}. SLA: ${c.slaHours || 48} hours.`,
        agentWorkflow: {
          selectedAgents: ['CivicAndRoadHealthAgent'],
          status: 'WORK_ORDER_CREATED',
          authorityStatus: 'WORK_ORDER_CREATED',
          authorityId: c.authorityId,
          department: c.department,
          authorityJurisdiction: c.authorityJurisdiction,
          contractorName: c.contractorName,
          contractorId: c.contractorId,
          contractorContact: c.contractorContact,
          contractorPerformanceScore: c.contractorPerformanceScore,
          slaHours: c.slaHours
        },
        timestamp: timestamp
      };
      roadIssueStore.unshift(newIssue);

      io.emit('complaint_ticket_created', {
        priority: c.priority,
        issueType: c.issue,
        locationName: c.roadName || location
      });
    }

    io.emit('urban_issue_detected', {
      issues: payload.urban_issues,
      severity: 'high',
      location,
      timestamp
    });
  }

  if (payload.accident_detection?.accident_detected) {
    const enrichedEvent = eventBus.publish({
      eventType: 'ACCIDENT_DETECTED',
      location: { lat: 12.9172, lng: 77.6227, name: location },
      detection: { roadBlocked: true, confidence: 0.99 },
      timestamp
    });
    await orchestratorAgent.handleNewEvent(enrichedEvent);
    io.emit('accident_detected', { ...payload.accident_detection, location, timestamp });
  }

  if ((payload.illegalParkings || []).length) {
    const enrichedEvent = eventBus.publish({
      eventType: 'ILLEGAL_PARKING',
      location: { lat: 12.9172, lng: 77.6227, name: location },
      detection: { licensePlate: 'KA-01-MJ-4821', stationaryDuration: 120, confidence: 0.95 },
      evidence: { frames: ['frame1', 'frame2'] },
      timestamp
    });
    await orchestratorAgent.handleNewEvent(enrichedEvent);
    io.emit('illegal_parking_detected', { violations: payload.illegalParkings, location, timestamp });
  }

  if ((payload.helmets || []).some((item) => !item.helmetDetected)) {
    const enrichedEvent = eventBus.publish({
      eventType: 'HELMET_VIOLATION',
      location: { lat: 12.9172, lng: 77.6227, name: location },
      detection: { licensePlate: 'KA-01-MJ-4821', confidence: 0.95 },
      evidence: { frames: ['frame1', 'frame2'] },
      timestamp
    });
    const results = await orchestratorAgent.handleNewEvent(enrichedEvent);
    const enforcementResult = results.find(r => r && r.agent === 'Enforcement Agent');
    
    if (enforcementResult && enforcementResult.actionResult && enforcementResult.actionResult.status === 'VALIDATED') {
      io.emit('helmet_violation_detected', { vehicleNumber: 'KA-01-MJ-4821', fine: 500, location, timestamp });
      io.emit('challan_issued', { challanNumber: `CH-HLM-${Math.floor(Math.random()*10000)}`, vehicleNumber: 'KA-01-MJ-4821', fine: 500, location, timestamp });
    } else {
      // Fallback
      io.emit('helmet_violation_detected', { vehicleNumber: 'KA-01-MJ-4821', fine: 500, location, timestamp });
    }
  }

  if ((payload.speeds || []).some((item) => item.isSpeeding)) {
    const enrichedEvent = eventBus.publish({
      eventType: 'OVERSPEEDING',
      location: { lat: 12.9172, lng: 77.6227, name: location },
      detection: { licensePlate: 'KA-05-NB-7291', speed: 70, confidence: 0.98 },
      evidence: { frames: ['frame1', 'frame2'] },
      timestamp
    });
    const results = await orchestratorAgent.handleNewEvent(enrichedEvent);
    const enforcementResult = results.find(r => r && r.agent === 'Enforcement Agent');
    
    if (enforcementResult && enforcementResult.actionResult && enforcementResult.actionResult.status === 'VALIDATED') {
      io.emit('speeding_detected', { vehicleNumber: 'KA-05-NB-7291', speed: 70, fine: 1400, location, timestamp });
      io.emit('challan_issued', { challanNumber: `CH-SPD-${Math.floor(Math.random()*10000)}`, vehicleNumber: 'KA-05-NB-7291', fine: 1400, location, timestamp });
    } else {
      io.emit('speeding_detected', { vehicleNumber: 'KA-05-NB-7291', speed: 70, fine: 1400, location, timestamp });
    }
  }
};

const isTrafficViolation = (violation = {}) => /speed|helmet|parking|signal|rash/i.test(`${violation.type || ''} ${violation.title || ''}`);

const syncMlOutputs = (result, location, evidenceUrl) => {
  const timestamp = new Date().toISOString();
  const violations = [
    ...(result.violations_summary?.violations || []),
    ...(result.illegalParkings || []).map((parking) => ({
      type: parking.violationType || 'illegal_parking',
      title: 'Illegal parking detected by ML occupancy and zone analysis',
      vehicleNumber: parking.plate || parking.vehicleNumber,
      fine_amount: Number(parking.fineAmount || 1000),
      legal_section: 'No-Parking Zone Regulation',
      status: 'ISSUED'
    }))
  ];
  const generatedFines = [];

  violations.filter(isTrafficViolation).forEach((violation, index) => {
    const vehicleNumber = violation.vehicleNumber || result.vehicles?.[index]?.plateNumber || 'UNREADABLE-PLATE';
    const fine = {
      _id: `ml-${Date.now()}-${index}`,
      fineId: violation.violation_id || `FINE-${Date.now()}-${index}`,
      challanNumber: result.echallans_generated?.challans?.[index]?.challanNumber,
      vehicleNumber,
      violationType: violation.type || 'traffic_violation',
      amount: Number(violation.fine_amount || 0),
      location,
      imageUrl: evidenceUrl,
      reasoning: `ML evidence: ${violation.title || violation.type}. Confidence and bounding-box evidence are retained in the detection result.`,
      legalSection: violation.legal_section,
      source: 'ml_detection',
      status: 'pending',
      issuedAt: timestamp
    };
    fines.push(fine);
    generatedFines.push(fine);
  });

  const urbanIssues = result.urban_issues || [];
  urbanIssues.forEach((issue, index) => {
    const incident = {
      _id: `ml-issue-${Date.now()}-${index}`,
      issueType: issue.type || issue.issueType || 'Urban Issue',
      locationName: location,
      coordinates: issue.coordinates || null,
      description: `Automatically detected by ${result.model?.name || 'ML pipeline'} with ${(Number(issue.confidence || 0) * 100).toFixed(0)}% confidence.`,
      imageUrl: evidenceUrl,
      status: 'Verification',
      priority: issue.severity || 'MEDIUM',
      source: 'ml_detection',
      reportedAt: timestamp,
      validation: { model: result.model?.name, confidence: issue.confidence, bbox: issue.bbox }
    };
    roadIssueStore.unshift(incident);
    complaintStore.unshift({ ...incident, ticketId: `TKT-${Date.now()}-${index}`, status: 'Open', assignedTo: 'Municipal Authority' });
  });

  const congestionLevel = String(result.congestion?.congestion_level || '').toUpperCase();
  if (['HIGH', 'CRITICAL'].includes(congestionLevel)) {
    const advisory = {
      _id: `route-${Date.now()}`,
      route: location,
      congestionLevel,
      reason: `${result.congestion.total_vehicles_detected || 0} vehicles detected; density is ${result.congestion.vehicle_density_percent || 0}% and average speed is ${result.congestion.average_speed_kmh || 0} km/h.`,
      alternatePath: `Use the parallel route avoiding ${location}`,
      createdAt: timestamp,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      source: 'ml_detection'
    };
    routeAlertStore.unshift(advisory);
    io.emit('traffic_advisory_created', advisory);
  }

  if (generatedFines.length) {
    generatedFines.forEach((fine) => {
      io.emit('citizen_challan_notification', {
        challanNumber: fine.challanNumber || fine.fineId,
        vehicleNumber: fine.vehicleNumber,
        fineAmount: fine.amount,
        reason: fine.reasoning,
        location,
        timestamp
      });
    });
  }
  return { generatedFines };
};

// Full Video ML Processing proxy with turning counts, lane behavior, TTC & video rendering
app.post('/api/ml-detection/process-video', videoUpload.single('video'), async (req, res) => {
  try {
    let videoUrl = req.body.videoUrl;
    let videoBase64 = req.body.videoBase64;
    const location = req.body.location || 'Silk Board Junction, Bengaluru';
    const speedLimit = Number(req.body.speedLimit || 60);
    const signalStatus = req.body.signalStatus || 'green';
    const enableSegmentation = req.body.enableSegmentation !== 'false' && req.body.enableSegmentation !== false;
    const maxFrames = Number(req.body.maxFrames || 300);

    // If file was uploaded via multipart/form-data
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

    // Execute request to Python ML engine with extended 10-minute timeout
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

    if (result.echallans_generated?.challans?.length) {
      result.echallans_generated.challans.forEach((challan, i) => {
        const fine = {
          _id: `ml-vid-fine-${Date.now()}-${i}`,
          fineId: challan.challan_number,
          challanNumber: challan.challan_number,
          vehicleNumber: challan.vehicle_number,
          violationType: challan.type,
          amount: challan.fine_amount,
          location: challan.location || location,
          imageUrl: challan.evidence_photo,
          reasoning: challan.title,
          legalSection: challan.legal_section,
          source: 'ml_video_pipeline',
          status: 'pending',
          issuedAt: new Date().toISOString()
        };
        fines.push(fine);
      });
    }

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

// Keep ML frame analysis available when running the MongoDB-free server.
app.post('/api/ml-detection/process-frame', async (req, res) => {
  try {
    const { frameUrl, frameBase64, location, speedLimit, signalStatus, fileType } = req.body;
    const payload = {
      frame_url: frameUrl?.startsWith('data:') ? undefined : frameUrl,
      frame_base64: frameBase64 || (frameUrl?.startsWith('data:') ? frameUrl.split(',')[1] : undefined),
      location,
      speed_limit: speedLimit,
      signal_status: signalStatus,
      file_type: fileType,
      enable_segmentation: true
    };

    let result = null;

    try {
      const response = await fetch('http://127.0.0.1:8000/batch/process-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        result = await response.json();
      }
    } catch (error) {
      console.warn('Python ML backend unavailable, using synchronized fallback detection:', error.message);
    }

    if (!result || !result.success) {
      result = generateFallbackDetection({ ...req.body, location: location || 'Silk Board Junction, Bengaluru' });
    }

    const { generatedFines } = syncMlOutputs(result, result.location || location || 'Silk Board Junction, Bengaluru', frameUrl);

    const issueRecord = {
      timestamp: new Date().toISOString(),
      location: result.location || location || 'Silk Board Junction, Bengaluru',
      issues: result.urban_issues || [],
      violations: result.violations_summary || { violations: [] },
      challans: result.echallans_generated || { challans: [] }
    };
    mlDetectionStore.unshift(issueRecord);
    if (mlDetectionStore.length > 20) mlDetectionStore.pop();

    const uploadedImageUrl = frameUrl || (frameBase64 ? `data:image/jpeg;base64,${frameBase64}` : '');
    await syncFallbackEvents(result, issueRecord.location, uploadedImageUrl);
    const enforcementWorkflows = await processEnforcementDetections(result, {
      imageUrl: uploadedImageUrl,
      location: issueRecord.location,
      latitude: 12.9172,
      longitude: 77.6227,
      speedLimit,
      signalStatus
    });
    const encroachmentWorkflows = await processEncroachmentDetections(result, {
      imageUrl: uploadedImageUrl,
      location: issueRecord.location,
      latitude: 12.9172,
      longitude: 77.6227,
      speedLimit,
      signalStatus
    });
    return res.json({
      success: true,
      data: { ...result, generated_fines: generatedFines },
      enforcementWorkflows,
      encroachmentWorkflows,
      agentWorkflows: [...enforcementWorkflows, ...encroachmentWorkflows],
      message: 'Synchronized multi-model analysis complete.'
    });
  } catch (error) {
    console.error('ML detection route failed:', error);
    const fallback = generateFallbackDetection(req.body || {});
    await syncFallbackEvents(fallback, fallback.location);
    return res.status(200).json({ success: true, data: fallback, message: `Fallback detection used: ${error.message}` });
  }
});

app.post('/api/ml-detection/potholes', async (req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:8000/detect/potholes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frame_url: req.body.frameUrl,
        frame_base64: req.body.frameBase64
      })
    });
    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (error) {
    return res.status(503).json({ message: `Pothole ML backend unavailable: ${error.message}` });
  }
});

const proxySpecializedDetection = (path, endpoint) => {
  app.post(`/api/ml-detection/${path}`, async (req, res) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/detect/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frame_url: req.body.frameUrl,
          frame_base64: req.body.frameBase64
        })
      });
      const result = await response.json();
      return res.status(response.status).json(result);
    } catch (error) {
      return res.status(503).json({ message: `${path} ML backend unavailable: ${error.message}` });
    }
  });
};

proxySpecializedDetection('helmet', 'helmet');
proxySpecializedDetection('speed', 'speed');
proxySpecializedDetection('crowd', 'crowd');

app.get('/api/ml-detection/logs', authMiddleware, (req, res) => {
  const limit = Number(req.query.limit || 10);
  res.json({ success: true, data: mlDetectionStore.slice(0, limit) });
});

app.get('/api/ml-detection/violations', authMiddleware, (req, res) => {
  const limit = Number(req.query.limit || 8);
  const allViolations = mlDetectionStore.flatMap((entry) => (entry.violations?.violations || []).map((v) => ({ ...v, location: entry.location })));
  const items = allViolations.slice(0, limit);
  res.json({ success: true, data: items });
});

app.get('/api/ml-detection/stats', authMiddleware, (req, res) => {
  const allViolations = mlDetectionStore.flatMap((entry) => (entry.violations?.violations || []).map((v) => ({ ...v, location: entry.location })));
  const total = allViolations.length;
  res.json({
    success: true,
    data: {
      today: {
        total,
        pothole: allViolations.filter((v) => /pothole/i.test(v.title || '')).length,
        accident: allViolations.filter((v) => /accident|collision/i.test(v.title || '')).length,
        vendor: allViolations.filter((v) => /vendor|hawker|encroach/i.test(v.title || '')).length
      },
      total: {
        total,
        helmets: allViolations.filter((v) => /helmet/i.test(v.title || '') || /helmet/i.test(v.type || '')).length,
        speeding: allViolations.filter((v) => /speed/i.test(v.title || '') || v.type === 'speeding').length,
        parking: allViolations.filter((v) => /parking|blockage|vendor|encroach/i.test(v.title || '')).length
      }
    }
  });
});

// In-memory data storage
const users = [
  {
    _id: '1',
    name: 'Admin User',
    email: 'admin@traffic.gov',
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin'
  },
  {
    _id: '2',
    name: 'John Citizen',
    email: 'citizen@example.com',
    password: bcrypt.hashSync('citizen123', 10),
    role: 'citizen',
    vehicleNumber: 'ABC-1234'
  }
];

let trafficSignals = [];
let parkingSpots = [];
let fines = [];
let emergencies = [];
let encroachments = [];
let illegalParkingViolations = [];

// ============================================
// CONCURRENCY CONTROL FOR ATOMIC BOOKING
// ============================================

// Track locks for each parking spot (prevents simultaneous modifications)
const spotLocks = new Map();

// Track version numbers for optimistic consistency checking
const spotVersions = new Map();

// Pessimistic locking: Acquire exclusive lock on a spot
const acquireLock = async (spotId, timeout = 5000) => {
  const startTime = Date.now();
  const lockKey = `lock_${spotId}`;
  
  while (true) {
    if (!spotLocks.has(lockKey)) {
      spotLocks.set(lockKey, {
        acquiredAt: Date.now(),
        spotId: spotId
      });
      return true;
    }
    
    // Check if lock has timed out (deadlock prevention)
    const lock = spotLocks.get(lockKey);
    if (Date.now() - lock.acquiredAt > 30000) { // 30 second timeout
      spotLocks.delete(lockKey);
      spotLocks.set(lockKey, {
        acquiredAt: Date.now(),
        spotId: spotId
      });
      return true;
    }
    
    // If still locked and not timed out, wait and retry
    if (Date.now() - startTime > timeout) {
      throw new Error('Spot is currently being booked by another user. Please try again.');
    }
    
    // Wait 20ms before retrying
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};

// Release the lock
const releaseLock = (spotId) => {
  const lockKey = `lock_${spotId}`;
  spotLocks.delete(lockKey);
};

// Get current version of a spot
const getSpotVersion = (spotId) => {
  const versionKey = `version_${spotId}`;
  return spotVersions.get(versionKey) || 0;
};

// Increment version on successful update
const incrementSpotVersion = (spotId) => {
  const versionKey = `version_${spotId}`;
  const current = getSpotVersion(spotId);
  spotVersions.set(versionKey, current + 1);
  return current + 1;
};

// Atomic check-and-set: Verify state hasn't changed before updating
const atomicUpdate = (spot, expectedVersion, updateFn) => {
  const currentVersion = getSpotVersion(spot.spotId);
  
  if (currentVersion !== expectedVersion) {
    throw new Error('Spot state changed. Another user may have booked it. Please refresh.');
  }
  
  updateFn(spot);
  incrementSpotVersion(spot.spotId);
  
  return {
    spot: spot,
    newVersion: currentVersion + 1
  };
};

// Initialize data
function initializeData() {
  const INTERSECTIONS = [
    { signalId: 'SIG001', name: 'Main St & 1st Ave', lat: 40.7128, lng: -74.0060 },
    { signalId: 'SIG002', name: 'Main St & 2nd Ave', lat: 40.7138, lng: -74.0070 },
    { signalId: 'SIG003', name: 'Park Ave & 1st St', lat: 40.7148, lng: -74.0080 },
    { signalId: 'SIG004', name: 'Park Ave & 2nd St', lat: 40.7158, lng: -74.0090 },
    { signalId: 'SIG005', name: 'Broadway & 5th Ave', lat: 40.7168, lng: -74.0100 },
    { signalId: 'SIG006', name: 'Central Plaza', lat: 40.7178, lng: -74.0110 }
  ];

  trafficSignals = INTERSECTIONS.map(intersection => ({
    signalId: intersection.signalId,
    location: {
      name: intersection.name,
      lat: intersection.lat,
      lng: intersection.lng
    },
    status: 'green',
    currentTimer: 30,
    vehicleCount: Math.floor(Math.random() * 50),
    congestionLevel: 'low',
    connectedSignals: INTERSECTIONS
      .filter(i => i.signalId !== intersection.signalId)
      .slice(0, 2)
      .map(i => i.signalId),
    mode: 'auto',
    lastUpdated: new Date()
  }));

  const PARKING_ZONES = [
    { zone: 'Zone 1', count: 20, lat: 40.7128, lng: -74.0060 },
    { zone: 'Zone 2', count: 15, lat: 40.7138, lng: -74.0070 },
    { zone: 'Zone 3', count: 25, lat: 40.7148, lng: -74.0080 },
    { zone: 'Zone 4', count: 18, lat: 40.7158, lng: -74.0090 },
    { zone: 'Zone 5', count: 22, lat: 40.7168, lng: -74.0100 },
    { zone: 'Zone 6', count: 30, lat: 40.7178, lng: -74.0110 },
    { zone: 'Zone 7', count: 12, lat: 40.7188, lng: -74.0120 },
    { zone: 'Zone 8', count: 16, lat: 40.7198, lng: -74.0130 }
  ];

  parkingSpots = [];
  for (const zone of PARKING_ZONES) {
    for (let i = 1; i <= zone.count; i++) {
      parkingSpots.push({
        spotId: `${zone.zone}-${String(i).padStart(3, '0')}`,
        zone: zone.zone,
        location: {
          name: `${zone.zone} Parking`,
          lat: zone.lat + (Math.random() - 0.5) * 0.01,
          lng: zone.lng + (Math.random() - 0.5) * 0.01
        },
        status: Math.random() > 0.3 ? 'available' : 'occupied',
        type: Math.random() > 0.9 ? 'disabled' : 'regular',
        pricePerHour: 20,
        currency: 'INR'
      });
    }
  }

  roadIssueStore.push(
    {
      _id: 'demo-road-issue-pothole',
      issueType: 'Pothole',
      locationName: 'Outer Ring Road, Silk Board Junction',
      coordinates: { lat: 12.9177, lng: 77.6238 },
      description: 'Demo road-intelligence report for authority review.',
      imageUrl: '',
      status: 'Verification',
      priority: 'HIGH',
      riskScore: 72,
      aiRecommendation: 'Responsible authority: BBMP Road Maintenance. SLA: 36 hours.',
      source: 'demo_road_intelligence',
      agentWorkflow: {
        selectedAgents: ['CivicAndRoadHealthAgent'],
        status: 'WORK_ORDER_CREATED',
        authorityStatus: 'WORK_ORDER_CREATED',
        authorityId: 'AUTH_BBMP_ROAD',
        department: 'BBMP Road Maintenance',
        authorityJurisdiction: 'South Bengaluru / Ward 174 (HSR Layout)',
        contractorName: 'V.L. Muniraju & Infra Projects Ltd.',
        contractorId: 'CTR-3188',
        slaHours: 36
      },
      reportedAt: new Date().toISOString(),
      roadIntelligence: {
        roadIdentified: true,
        coordinates: { lat: 12.9177, lng: 77.6238 },
        kgisRoad: {
          id: 'DEMO-KGIS-ORR-001',
          distanceFromRoadMeters: 4,
          ward: 'DEMO-WARD-151',
          roadType: 'Arterial Road',
          roadSurface: 'Bituminous',
          roadClass: 'High Traffic'
        },
        verifiedRoadHistory: {
          bbmpSegmentId: 'DEMO-BBMP-ORR-001',
          streetName: 'Outer Ring Road',
          ward: 'Demo Ward',
          zone: 'South Bengaluru',
          matchConfidence: 0.94,
          matchMethod: 'demo_verified',
          contractor: { name: 'Demo contractor record', registrationNo: 'DEMO-ONLY', phone: null },
          workHistory: { workName: 'Demonstration road resurfacing record', workYear: 2024, workOrderNo: 'DEMO-WO-001' }
        },
        aiPrediction: { predictedContractor: 'V.L.MUNIRAJU', confidence: 0.6609834432601929, source: 'experimental_model', warning: 'Supporting prediction only; verified road history is authoritative.' }
      }
    },
    {
      _id: 'demo-road-issue-encroachment',
      issueType: 'Roadblock',
      locationName: 'Bellandur Main Road',
      coordinates: { lat: 12.9352, lng: 77.6960 },
      description: 'Demo obstruction report connected to traffic diversion review.',
      imageUrl: '',
      status: 'Assigned',
      priority: 'CRITICAL',
      riskScore: 88,
      aiRecommendation: 'Notify the traffic authority and evaluate a diversion.',
      source: 'demo_road_intelligence',
      reportedAt: new Date().toISOString(),
      roadIntelligence: {
        roadIdentified: true,
        coordinates: { lat: 12.9352, lng: 77.6960 },
        kgisRoad: { id: 'DEMO-KGIS-BMR-002', distanceFromRoadMeters: 7, ward: 'DEMO-WARD-150', roadType: 'Main Road', roadSurface: 'Concrete', roadClass: 'Arterial' },
        verifiedRoadHistory: null,
        message: 'Road identified, but verified BBMP road-history information is unavailable.',
        aiPrediction: { predictedContractor: 'K.R.D.L', confidence: 0.45544183254241943, source: 'experimental_model', warning: 'Supporting prediction only; verified road history is authoritative.' }
      }
    }
  );

  console.log('✅ Data initialized');
}

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      'secret',
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      'secret',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vehicleNumber: user.vehicleNumber
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, vehicleNumber } = req.body;
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = {
      _id: String(users.length + 1),
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: role || 'citizen',
      phone,
      vehicleNumber
    };
    
    users.push(user);

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      'secret',
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      'secret',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vehicleNumber: user.vehicleNumber,
        phone: user.phone
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });
    
    const decoded = jwt.verify(refreshToken, 'secret');
    const user = users.find(u => u._id === decoded.userId);
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    
    const token = jwt.sign({ userId: user._id, role: user.role }, 'secret', { expiresIn: '7d' });
    const newRefreshToken = jwt.sign({ userId: user._id }, 'secret', { expiresIn: '30d' });
    res.json({ token, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Traffic routes
app.get('/api/traffic/signals', authMiddleware, (req, res) => {
  res.json(trafficSignals);
});

app.get('/api/traffic/signals/:id', authMiddleware, (req, res) => {
  const signal = trafficSignals.find(s => s.signalId === req.params.id);
  res.json(signal);
});

app.put('/api/traffic/signals/:id', authMiddleware, adminOnly, (req, res) => {
  const index = trafficSignals.findIndex(s => s.signalId === req.params.id);
  if (index !== -1) {
    trafficSignals[index] = { ...trafficSignals[index], ...req.body };
    res.json(trafficSignals[index]);
  } else {
    res.status(404).json({ message: 'Signal not found' });
  }
});

// Parking routes
app.get('/api/parking/spots', authMiddleware, (req, res) => {
  const { zone, status } = req.query;
  let filtered = parkingSpots;
  
  if (zone) filtered = filtered.filter(s => s.zone === zone);
  if (status) filtered = filtered.filter(s => s.status === status);
  
  res.json(filtered);
});

app.post('/api/parking/book', authMiddleware, async (req, res) => {
  const { spotId, vehicleNumber, duration } = req.body;
  let locked = false;
  
  try {
    // Step 1: Acquire exclusive lock on the spot
    locked = await acquireLock(spotId);
    
    // Step 2: Verify spot exists and is available (double-check after acquiring lock)
    const spot = parkingSpots.find(s => s.spotId === spotId);
    if (!spot) {
      return res.status(404).json({ message: 'Parking spot not found' });
    }
    
    if (spot.status !== 'available') {
      return res.status(400).json({ 
        message: `Spot is ${spot.status}. Cannot book at this time.`,
        currentStatus: spot.status
      });
    }
    
    // Step 3: Get pre-lock version and perform atomic update
    const preBookVersion = getSpotVersion(spotId);
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
    
    // Step 4: Atomic update with version check
    const result = atomicUpdate(spot, preBookVersion, (s) => {
      s.status = 'reserved';
      s.currentBooking = {
        userId: req.user.userId,
        vehicleNumber,
        startTime,
        endTime,
        bookedAt: new Date()
      };
    });
    
    // Step 5: Success response with version info for future operations
    res.json({ 
      message: 'Booking successful!',
      spot: result.spot,
      bookingVersion: result.newVersion,
      bookingId: `BOOK${Date.now()}`
    });
  } catch (error) {
    res.status(400).json({ 
      message: error.message || 'Booking failed'
    });
  } finally {
    // Always release the lock
    if (locked) {
      releaseLock(spotId);
    }
  }
});

app.post('/api/parking/release/:spotId', authMiddleware, async (req, res) => {
  const spotId = req.params.spotId;
  let locked = false;
  
  try {
    // Step 1: Acquire exclusive lock on the spot
    locked = await acquireLock(spotId);
    
    // Step 2: Find the spot
    const spot = parkingSpots.find(s => s.spotId === spotId);
    if (!spot) {
      return res.status(404).json({ message: 'Parking spot not found' });
    }
    
    // Step 3: Verify user owns this booking
    if (spot.currentBooking && spot.currentBooking.userId !== req.user.userId) {
      return res.status(403).json({ 
        message: 'You can only release spots you have booked'
      });
    }
    
    if (spot.status === 'available') {
      return res.status(400).json({ 
        message: 'Spot is already available. No booking to release.'
      });
    }
    
    // Step 4: Get pre-release version and perform atomic update
    const preReleaseVersion = getSpotVersion(spotId);
    
    // Step 5: Atomic update with version check
    const result = atomicUpdate(spot, preReleaseVersion, (s) => {
      s.status = 'available';
      s.currentBooking = undefined;
      s.releasedAt = new Date();
    });
    
    // Step 6: Success response
    res.json({ 
      message: 'Spot released successfully',
      spot: result.spot,
      releaseVersion: result.newVersion
    });
  } catch (error) {
    res.status(400).json({ 
      message: error.message || 'Release failed'
    });
  } finally {
    // Always release the lock
    if (locked) {
      releaseLock(spotId);
    }
  }
});

app.get('/api/parking/my-bookings', authMiddleware, (req, res) => {
  const bookings = parkingSpots.filter(s => 
    s.currentBooking && s.currentBooking.userId === req.user.userId
  );
  res.json(bookings);
});

app.post('/api/parking/send-alert', authMiddleware, adminOnly, (req, res) => {
  try {
    const { vehicleNumber, violationType, zone, message } = req.body;
    
    // Broadcast alert to all connected clients
    io.emit('violation-alert', {
      timestamp: new Date(),
      vehicleNumber,
      violationType,
      zone,
      message,
      alertId: `ALERT${Date.now()}`,
      severity: violationType === 'No Parking Zone' ? 'high' : 'medium'
    });

    res.json({ 
      message: 'Alert sent successfully',
      alert: {
        vehicleNumber,
        violationType,
        zone,
        sentAt: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fine routes
app.get('/api/fines', authMiddleware, (req, res) => {
  if (req.user.role === 'admin') {
    return res.json(fines);
  }
  
  const user = users.find(u => u._id === req.user.userId);
  if (!user || !user.vehicleNumber) {
    return res.json([]);
  }
  
  const filtered = fines.filter(f => f.vehicleNumber === user.vehicleNumber);
  res.json(filtered);
});

app.post('/api/fines/issue', authMiddleware, adminOnly, (req, res) => {
  try {
    const { vehicleNumber, violationType, amount, location, imageUrl } = req.body;
    
    const fine = {
      _id: String(fines.length + 1),
      fineId: `FINE${Date.now()}`,
      vehicleNumber,
      violationType,
      amount,
      location,
      imageUrl,
      status: 'pending',
      warningIssued: true,
      warningTime: new Date(),
      issuedAt: new Date()
    };
    
    fines.push(fine);
    res.status(201).json(fine);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/fines/:id/pay', authMiddleware, (req, res) => {
  try {
    const fine = fines.find(f => f._id === req.params.id);
    if (!fine) {
      return res.status(404).json({ message: 'Fine not found' });
    }

    fine.status = 'paid';
    fine.paidAt = new Date();

    res.json({ message: 'Fine paid successfully', fine });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/fines/:id', authMiddleware, adminOnly, (req, res) => {
  const index = fines.findIndex(f => f._id === req.params.id);
  if (index !== -1) {
    fines.splice(index, 1);
    res.json({ message: 'Fine cancelled' });
  } else {
    res.status(404).json({ message: 'Fine not found' });
  }
});

// Emergency routes
app.get('/api/emergency', authMiddleware, (req, res) => {
  const active = emergencies.filter(e => e.status === 'active');
  res.json(active);
});

app.post('/api/emergency/activate', authMiddleware, adminOnly, (req, res) => {
  try {
    const { vehicleId, vehicleType, currentLocation, destination, route } = req.body;
    
    const emergency = {
      _id: String(emergencies.length + 1),
      vehicleId,
      vehicleType,
      status: 'active',
      currentLocation,
      destination,
      route,
      estimatedArrival: new Date(Date.now() + 15 * 60 * 1000),
      startTime: new Date()
    };
    
    emergencies.push(emergency);
    io.emit('emergency-activated', emergency);
    res.status(201).json(emergency);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/emergency/:id/complete', authMiddleware, adminOnly, (req, res) => {
  try {
    const emergency = emergencies.find(e => e._id === req.params.id);
    if (emergency) {
      emergency.status = 'completed';
      emergency.endTime = new Date();
      io.emit('emergency-completed', emergency);
      res.json(emergency);
    } else {
      res.status(404).json({ message: 'Emergency not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Encroachment routes
app.get('/api/encroachments', authMiddleware, (req, res) => {
  res.json(encroachments);
});

app.get('/api/encroachments/:id', authMiddleware, (req, res) => {
  const encroachment = encroachments.find(e => e.id === req.params.id);
  if (encroachment) {
    res.json(encroachment);
  } else {
    res.status(404).json({ message: 'Encroachment not found' });
  }
});

app.put('/api/encroachments/:id/resolve', authMiddleware, adminOnly, (req, res) => {
  try {
    const encroachment = encroachments.find(e => e.id === req.params.id);
    if (encroachment) {
      encroachment.status = 'resolved';
      encroachment.resolvedAt = new Date();
      io.emit('encroachment-resolved', encroachment);
      res.json(encroachment);
    } else {
      res.status(404).json({ message: 'Encroachment not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/encroachments/:id/ignore', authMiddleware, adminOnly, (req, res) => {
  try {
    const encroachment = encroachments.find(e => e.id === req.params.id);
    if (encroachment) {
      encroachment.status = 'ignored';
      io.emit('encroachment-ignored', encroachment);
      res.json(encroachment);
    } else {
      res.status(404).json({ message: 'Encroachment not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Illegal Parking Detection routes
app.get('/api/illegal-parking', authMiddleware, (req, res) => {
  res.json(illegalParkingViolations);
});

app.get('/api/illegal-parking/:id', authMiddleware, (req, res) => {
  const violation = illegalParkingViolations.find(v => v.id === req.params.id);
  if (violation) {
    res.json(violation);
  } else {
    res.status(404).json({ message: 'Violation not found' });
  }
});

app.post('/api/illegal-parking/:id/send-alert', authMiddleware, adminOnly, async (req, res) => {
  try {
    const violation = illegalParkingViolations.find(v => v.id === req.params.id);
    if (violation) {
      violation.alertSent = true;
      violation.alertDetails = {
        alertId: `ALT${Date.now()}`,
        sentAt: new Date(),
        recipient: violation.authority.name,
        method: 'SMS + App Notification'
      };
      violation.status = 'alert-sent';
      io.emit('illegal-parking-alert-sent', violation);
      res.json(violation);
    } else {
      res.status(404).json({ message: 'Violation not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/illegal-parking/:id/issue-fine', authMiddleware, adminOnly, async (req, res) => {
  try {
    const violation = illegalParkingViolations.find(v => v.id === req.params.id);
    if (violation) {
      const fine = {
        _id: String(fines.length + 1),
        vehicleNumber: violation.licensePlate,
        violationType: violation.violationType,
        amount: violation.fineAmount,
        location: violation.location,
        imageUrl: violation.imageUrl,
        status: 'pending',
        issuedAt: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        paymentLink: `https://traffic.gov.in/pay/${violation.id}`
      };
      
      fines.push(fine);
      violation.status = 'fine-issued';
      violation.fineDetails = {
        fineId: fine._id,
        dueDate: fine.dueDate
      };
      
      io.emit('illegal-parking-fine-issued', { violation, fine });
      res.json({ violation, fine });
    } else {
      res.status(404).json({ message: 'Violation not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/illegal-parking/:id/dismiss', authMiddleware, adminOnly, (req, res) => {
  try {
    const violation = illegalParkingViolations.find(v => v.id === req.params.id);
    if (violation) {
      violation.status = 'dismissed';
      violation.dismissedReason = req.body.reason || 'False positive';
      io.emit('illegal-parking-dismissed', violation);
      res.json(violation);
    } else {
      res.status(404).json({ message: 'Violation not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/illegal-parking/stats/summary', authMiddleware, (req, res) => {
  const stats = {
    total: illegalParkingViolations.length,
    detected: illegalParkingViolations.filter(v => v.status === 'detected').length,
    alertSent: illegalParkingViolations.filter(v => v.status === 'alert-sent').length,
    fineIssued: illegalParkingViolations.filter(v => v.status === 'fine-issued').length,
    paid: illegalParkingViolations.filter(v => v.status === 'paid').length,
    dismissed: illegalParkingViolations.filter(v => v.status === 'dismissed').length,
    totalFineAmount: illegalParkingViolations
      .filter(v => v.status === 'fine-issued' || v.status === 'paid')
      .reduce((sum, v) => sum + v.fineAmount, 0),
    collectedAmount: illegalParkingViolations
      .filter(v => v.status === 'paid')
      .reduce((sum, v) => sum + v.fineAmount, 0)
  };
  res.json(stats);
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Traffic simulation
function startTrafficSimulation() {
  setInterval(() => {
    trafficSignals.forEach(signal => {
      if (signal.mode === 'auto') {
        const vehicleCount = Math.floor(Math.random() * 100);
        let congestionLevel = 'low';
        let timer = 30;

        if (vehicleCount > 70) {
          congestionLevel = 'high';
          timer = 60;
        } else if (vehicleCount > 40) {
          congestionLevel = 'medium';
          timer = 45;
        }

        const statuses = ['green', 'yellow', 'red'];
        const currentIndex = statuses.indexOf(signal.status);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];

        signal.vehicleCount = vehicleCount;
        signal.congestionLevel = congestionLevel;
        signal.currentTimer = timer;
        signal.status = nextStatus;
        signal.lastUpdated = new Date();
      }
    });

    io.emit('traffic-update', trafficSignals);
  }, 5000);
}

// Encroachment simulation
function startEncroachmentSimulation() {
  const CAMERA_LOCATIONS = [
    { cameraId: 'CAM001', location: 'MG Road', zone: 'footpath' },
    { cameraId: 'CAM002', location: 'Brigade Road', zone: 'road-lane' },
    { cameraId: 'CAM003', location: 'Commercial Street', zone: 'no-parking' },
    { cameraId: 'CAM004', location: 'Indiranagar', zone: 'restricted-area' },
    { cameraId: 'CAM005', location: 'Koramangala', zone: 'footpath' }
  ];

  const OBJECT_TYPES = ['vendor', 'cart', 'vehicle', 'obstacle', 'hawker'];
  
  // Image pool for different object types
  const getImageForObject = (objectType, zone) => {
    const imageMap = {
      'vendor': ['/images/encroachment/hawker1.jpg', '/images/encroachment/hawker2.jpg'],
      'hawker': ['/images/encroachment/hawker1.jpg', '/images/encroachment/hawker2.jpg'],
      'cart': ['/images/encroachment/hawker1.jpg'],
      'vehicle': ['/images/encroachment/hawker2.jpg'],
      'obstacle': ['/images/encroachment/hawker1.jpg']
    };
    
    const images = imageMap[objectType] || imageMap['vendor'];
    return images[Math.floor(Math.random() * images.length)];
  };
  
  // Generate initial encroachments
  for (let i = 0; i < 3; i++) {
    const camera = CAMERA_LOCATIONS[Math.floor(Math.random() * CAMERA_LOCATIONS.length)];
    const detectedObject = OBJECT_TYPES[Math.floor(Math.random() * OBJECT_TYPES.length)];
    
    const severityMap = {
      'road-lane': 'high',
      'footpath': 'medium',
      'no-parking': 'medium',
      'restricted-area': 'high'
    };

    const encroachment = {
      id: `ENC${String(encroachments.length + 1).padStart(3, '0')}`,
      cameraId: camera.cameraId,
      location: camera.location,
      zone: camera.zone,
      detectedObject,
      licensePlate: detectedObject === 'vehicle' ? generateLicensePlate() : null,
      imageUrl: getImageForObject(detectedObject, camera.zone),
      detectionTime: new Date(Date.now() - Math.random() * 600000), // Random time in last 10 min
      status: 'detected',
      stationaryDuration: Math.floor(Math.random() * 600),
      coordinates: generateCoordinates(camera.location),
      severity: severityMap[camera.zone] || 'low',
      notes: `${detectedObject} detected in ${camera.zone}`
    };

    encroachments.push(encroachment);
    if (encroachments.length > 100) encroachments.shift();
  }

  // Periodic detection and status updates
  setInterval(() => {
    // Update existing encroachments
    encroachments.forEach(enc => {
      if (['detected', 'warning-issued', 'alert-sent'].includes(enc.status)) {
        const duration = Math.floor((Date.now() - new Date(enc.detectionTime)) / 1000);
        enc.stationaryDuration = duration;

        // Issue warning after 5 minutes (300 seconds)
        if (duration >= 300 && enc.status === 'detected') {
          enc.status = 'warning-issued';
          enc.warningIssuedAt = new Date();
          io.emit('encroachment-warning', enc);
        }

        // Send alert after 10 minutes (600 seconds)
        if (duration >= 600 && enc.status === 'warning-issued') {
          enc.status = 'alert-sent';
          enc.alertSentAt = new Date();
          io.emit('encroachment-alert', enc);
        }
      }
    });

    // Randomly add new encroachment (20% chance)
    if (Math.random() < 0.2) {
      const camera = CAMERA_LOCATIONS[Math.floor(Math.random() * CAMERA_LOCATIONS.length)];
      const detectedObject = OBJECT_TYPES[Math.floor(Math.random() * OBJECT_TYPES.length)];
      
      const severityMap = {
        'road-lane': 'high',
        'footpath': 'medium',
        'no-parking': 'medium',
        'restricted-area': 'high'
      };

      const encroachment = {
        id: `ENC${String(encroachments.length + 1).padStart(3, '0')}`,
        cameraId: camera.cameraId,
        location: camera.location,
        zone: camera.zone,
        detectedObject,
        licensePlate: detectedObject === 'vehicle' ? generateLicensePlate() : null,
        imageUrl: getImageForObject(detectedObject, camera.zone),
        detectionTime: new Date(),
        status: 'detected',
        stationaryDuration: 0,
        coordinates: generateCoordinates(camera.location),
        severity: severityMap[camera.zone] || 'low',
        notes: `${detectedObject} detected in ${camera.zone}`
      };

      encroachments.push(encroachment);
      if (encroachments.length > 100) encroachments.shift();
      io.emit('encroachment-detected', encroachment);
    }

    io.emit('encroachment-update', encroachments);
  }, 10000); // Update every 10 seconds
}

function generateLicensePlate() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  return `${letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]}-${
    numbers[Math.floor(Math.random() * 10)]}${numbers[Math.floor(Math.random() * 10)]}-${
    letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]}-${
    numbers[Math.floor(Math.random() * 10)]}${numbers[Math.floor(Math.random() * 10)]}${
    numbers[Math.floor(Math.random() * 10)]}${numbers[Math.floor(Math.random() * 10)]}`;
}

function generateCoordinates(location) {
  const baseCoords = {
    'MG Road': { lat: 12.9716, lng: 77.5946 },
    'Brigade Road': { lat: 12.9698, lng: 77.6072 },
    'Commercial Street': { lat: 12.9833, lng: 77.6089 },
    'Indiranagar': { lat: 12.9784, lng: 77.6408 },
    'Koramangala': { lat: 12.9352, lng: 77.6245 }
  };

  const base = baseCoords[location] || { lat: 12.9716, lng: 77.5946 };
  return {
    lat: base.lat + (Math.random() - 0.5) * 0.01,
    lng: base.lng + (Math.random() - 0.5) * 0.01
  };
}

// Illegal Parking Detection simulation
async function startIllegalParkingDetection() {
  const { default: illegalParkingDetector } = await import('./services/illegalParkingDetector.js');
  
  // Initial detection - create 5 violations
  try {
    console.log('🚗 Fetching illegal parking data from Hugging Face...');
    const data = await illegalParkingDetector.fetchIllegalParkingData();
    
    // Process first 5 detections
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const violation = await illegalParkingDetector.processDetection(data[i], illegalParkingViolations.length);
      illegalParkingViolations.push(violation);
      if (illegalParkingViolations.length > 100) illegalParkingViolations.shift();
    }
    
    console.log(`✅ Loaded ${illegalParkingViolations.length} illegal parking violations`);
  } catch (error) {
    console.error('⚠️  Failed to fetch from Hugging Face, using simulated data:', error.message);
    
    // Fallback: Create simulated violations
    for (let i = 0; i < 5; i++) {
      const violation = await illegalParkingDetector.processDetection({}, illegalParkingViolations.length);
      illegalParkingViolations.push(violation);
      if (illegalParkingViolations.length > 100) illegalParkingViolations.shift();
    }
  }
  
  // Periodic detection (every 30 seconds)
  setInterval(async () => {
    // 30% chance of new detection
    if (Math.random() < 0.3) {
      try {
        const data = illegalParkingDetector.detectionCache.length > 0 
          ? illegalParkingDetector.detectionCache 
          : await illegalParkingDetector.fetchIllegalParkingData();
        
        const randomIndex = Math.floor(Math.random() * data.length);
        const violation = await illegalParkingDetector.processDetection(
          data[randomIndex] || {}, 
          illegalParkingViolations.length
        );
        
        illegalParkingViolations.push(violation);
        if (illegalParkingViolations.length > 100) illegalParkingViolations.shift();
        io.emit('illegal-parking-detected', violation);
        
        console.log(`🚨 New illegal parking detected: ${violation.licensePlate} at ${violation.location}`);
      } catch (error) {
        console.error('Error in illegal parking detection:', error.message);
      }
    }
    
    // Auto-send alerts for detected violations (after 2 minutes)
    illegalParkingViolations.forEach(violation => {
      if (violation.status === 'detected' && !violation.alertSent) {
        const timeSinceDetection = Date.now() - new Date(violation.detectionTime).getTime();
        if (timeSinceDetection > 120000) { // 2 minutes
          violation.alertSent = true;
          violation.alertDetails = {
            alertId: `ALT${Date.now()}`,
            sentAt: new Date(),
            recipient: violation.authority.name,
            method: 'SMS + App Notification'
          };
          violation.status = 'alert-sent';
          io.emit('illegal-parking-alert-sent', violation);
          console.log(`📢 Alert sent to ${violation.authority.name} for ${violation.licensePlate}`);
        }
      }
    });
    
    io.emit('illegal-parking-update', illegalParkingViolations);
  }, 30000); // Every 30 seconds
}

// Shared citizen, authority, and route-safety feeds.
app.get('/api/road-issues', (req, res) => {
  res.json(roadIssueStore.filter((issue) => issue.status !== 'Resolved'));
});

app.get('/api/road-intelligence/lookup', authMiddleware, (req, res) => {
  const coordinates = { lat: Number(req.query.lat), lng: Number(req.query.lng) };
  const nearest = findNearestDemoRoad(coordinates);
  const roadIntelligence = nearest ? {
    ...nearest.issue.roadIntelligence,
    coordinates,
    kgisRoad: { ...nearest.issue.roadIntelligence.kgisRoad, distanceFromRoadMeters: Math.round(nearest.distance) }
  } : null;
  res.json(roadIntelligence || {
    roadIdentified: false,
    coordinates,
    message: 'Demo mode: no KGIS road is loaded for these coordinates.',
    verifiedRoadHistory: null,
    aiPrediction: null
  });
});

app.patch('/api/road-issues/:id/status', authMiddleware, adminOnly, (req, res) => {
  const issue = roadIssueStore.find((item) => item._id === req.params.id);
  if (!issue) return res.status(404).json({ message: 'Issue not found' });
  issue.status = req.body.status;
  res.json(issue);
});

app.post('/api/road-issues', authMiddleware, async (req, res) => {
  const { issueType, locationName, coordinates, description, imageUrl } = req.body;
  if (!issueType || !locationName || !coordinates?.lat || !coordinates?.lng || !imageUrl) {
    return res.status(400).json({ message: 'Issue type, GPS location, landmark, and photo are required.' });
  }

  let validation = { modelValidation: 'unavailable', matchedIssue: null, confidence: 0 };
  try {
    const frameBase64 = imageUrl.startsWith('data:') ? imageUrl.split(',')[1] : undefined;
    if (frameBase64) {
      const response = await fetch('http://127.0.0.1:8000/batch/process-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame_base64: frameBase64, location: locationName, enable_segmentation: true })
      });
      if (response.ok) {
        const modelResult = await response.json();
        const matchedIssue = (modelResult.urban_issues || []).find((issue) =>
          String(issue.type || issue.issueType || '').toLowerCase().includes(issueType.toLowerCase().replace('roadblock', 'road blockage'))
        );
        validation = {
          modelValidation: matchedIssue ? 'validated' : 'needs_review',
          matchedIssue: matchedIssue?.type || null,
          confidence: matchedIssue?.confidence || 0,
          model: modelResult.model?.name
        };
      }
    }
  } catch (error) {
    validation = { ...validation, error: error.message };
  }

  const matchingReports = roadIssueStore.filter((issue) =>
    issue.issueType === issueType && issue.locationName.toLowerCase() === locationName.toLowerCase() && issue.status !== 'Resolved'
  );
  const nearestRoad = findNearestDemoRoad(coordinates);
  const roadIntelligence = nearestRoad ? {
    ...nearestRoad.issue.roadIntelligence,
    coordinates,
    kgisRoad: { ...nearestRoad.issue.roadIntelligence.kgisRoad, distanceFromRoadMeters: Math.round(nearestRoad.distance) }
  } : {
    roadIdentified: false,
    coordinates,
    message: 'Demo mode: no KGIS road is loaded for these coordinates.',
    verifiedRoadHistory: null,
    aiPrediction: null
  };
  const priority = matchingReports.length >= 1 ? 'HIGH' : 'MEDIUM';
  const report = {
    _id: `citizen-${Date.now()}`,
    issueType,
    locationName,
    coordinates,
    description: description || '',
    imageUrl,
    status: validation.modelValidation === 'validated' ? 'Verification' : 'Reported',
    priority,
    source: 'citizen_report',
    reportedBy: req.user.userId,
    reportedAt: new Date().toISOString(),
    validation: { ...validation, matchedReports: matchingReports.length }
    ,roadIntelligence,
    assignedContractor: roadIntelligence.verifiedRoadHistory?.contractor?.name || roadIntelligence.aiPrediction?.predictedContractor || null
  };
  roadIssueStore.unshift(report);
  const ticket = { ...report, ticketId: `TKT-${Date.now()}`, status: 'Open', assignedTo: 'Municipal Authority' };
  complaintStore.unshift(ticket);
  if (matchingReports.length >= 1) {
    matchingReports.forEach((issue) => { issue.priority = 'HIGH'; });
  }
  io.emit('new-road-issue', { ...report, ticketId: ticket.ticketId });
  io.emit('complaint_ticket_created', ticket);
  res.status(201).json({ success: true, report, ticket });
});

app.get('/api/traffic/advisories', (req, res) => {
  const now = Date.now();
  res.json(routeAlertStore.filter((alert) => new Date(alert.expiresAt).getTime() > now));
});

app.get('/api/complaints', authMiddleware, adminOnly, (req, res) => {
  res.json({ success: true, data: complaintStore });
});

// Initialize and start
initializeData();
startTrafficSimulation();
startEncroachmentSimulation();
startIllegalParkingDetection();

const PORT = 5000;
httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`🚦 Server running on port ${PORT}`);
  console.log('✅ Using in-memory storage (no MongoDB required)');
});

