/**
 * ML Detection Processing Routes
 * Main endpoint for camera feed processing and ML model coordination
 * Supports: live camera feeds, file uploads (image/video), and auto challan generation
 */

import express from 'express';
import http from 'http';
import MLDetectionLog from '../models/MLDetectionLog.js';
import TrafficViolation from '../models/TrafficViolation.js';
import HelmetViolation from '../models/HelmetViolation.js';
import StreetEncroachment from '../models/StreetEncroachment.js';
import Camera from '../models/Camera.js';
import IllegalParking from '../models/IllegalParking.js';
import { realMLInference } from '../services/realMLInference.js';
import { createChallanFromViolation } from '../services/challanGenerationService.js';
import { uploadMiddleware, processUploadedFile, processVideoFrames } from '../services/fileUploadService.js';
import { authMiddleware } from '../middleware/auth.js';
import { processAgentDetections } from '../services/agentWorkflowService.js';
import { io } from '../server.js';

const router = express.Router();

router.post('/detect', async (req, res) => {
  try {
    const image = req.body.image || req.body.frameBase64 || req.body.frameUrl;
    if (!image) {
      return res.status(400).json({ success: false, error: 'image is required' });
    }

    const result = await realMLInference.processFrame({
      frameBase64: image,
      frameUrl: image.startsWith('data:') ? undefined : image,
      location: req.body.location || 'Live dashcam',
      source: req.body.source || 'DASHCAM'
    });

    const detections = [
      ...(result.vehicles || []).map(vehicle => ({
        id: vehicle.id,
        label: vehicle.class_name || vehicle.class || 'vehicle',
        type: 'vehicle',
        confidence: vehicle.confidence,
        bbox: vehicle.bbox
      })),
      ...(result.pedestrians || []).map(pedestrian => ({
        id: pedestrian.id,
        label: 'person',
        type: 'pedestrian',
        confidence: pedestrian.confidence,
        bbox: pedestrian.bbox
      }))
    ];

    return res.json({
      success: result.success !== false,
      detections,
      model: result.model,
      degraded: result.model?.source !== 'real'
    });
  } catch (error) {
    console.error('Live ML detection failed:', error);
    return res.status(503).json({ success: false, error: 'ML inference unavailable' });
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
      location = 'Default Location',
      latitude = 37.7749,
      longitude = -122.4194,
      signalStatus = 'green',
      speedLimit = 60
    } = req.body;

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
      signalStatus,
      speedLimit,
      fps: 30,
      timestamp: new Date()
    };

    // Run REAL ML inference
    const detectionResult = await realMLInference.processFrame(frameData);
    const agentWorkflows = await processAgentDetections(detectionResult, {
      ...frameData,
      imageUrl: normalizedFrameUrl || frameUrl || '',
      source: 'camera_ml'
    }, req.user.userId);

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
      agentWorkflows: agentWorkflows.map(({ issue, workflow }) => ({
        issueId: issue._id,
        issueType: issue.issueType,
        status: issue.status,
        agentWorkflow: issue.agentWorkflow,
        workflow
      }))
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
router.post('/process-video', uploadMiddleware.single('video'), async (req, res) => {
  try {
    let videoUrl = req.body.videoUrl;
    let videoBase64 = req.body.videoBase64;
    const location = req.body.location || 'Silk Board Junction, Bengaluru';
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
router.get('/logs', authMiddleware, async (req, res) => {
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
router.get('/violations', authMiddleware, async (req, res) => {
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
router.get('/stats', authMiddleware, async (req, res) => {
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