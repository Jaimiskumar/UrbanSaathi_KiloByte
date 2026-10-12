import express from 'express';
import TrafficSignal from '../models/TrafficSignal.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { logAudit } from '../services/auditLogger.js';
import { BANGALORE_ZONES } from '../config/bangaloreGeospatial.js';
import { getActiveAdvisories, addAdvisory } from '../services/advisoryService.js';

const router = express.Router();

/**
 * GET /api/traffic/zones
 * Public endpoint: Returns all Noida / Amity NCR traffic zones for map navigation
 */
router.get('/zones', async (req, res) => {
  try {
    const zones = BANGALORE_ZONES.map((z) => ({
      _id: z.zone_id,
      zoneId: z.zone_id,
      name: z.name,
      lat: z.latitude,
      lng: z.longitude,
      road: z.road,
      congestionLevel: z.congestion_level,
      riskLevel: z.risk_level,
      vehicleDensity: z.current_vehicle_density,
      averageSpeed: z.average_speed,
      roadCondition: z.road_condition,
      recommendation: z.recommendation
    }));
    res.json(zones);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/traffic/advisories
 * Public endpoint: Returns active route congestion and safety advisories
 */
router.get('/advisories', (req, res) => {
  try {
    res.json(getActiveAdvisories());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/traffic/advisories
 * Protected endpoint: Allows dispatching new traffic advisories
 */
router.post('/advisories', authMiddleware, requirePermission('traffic:update'), (req, res) => {
  try {
    const advisory = addAdvisory(req.body);
    res.status(201).json(advisory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/signals', authMiddleware, requirePermission('traffic:read'), async (req, res) => {
  try {
    const signals = await TrafficSignal.find().sort({ signalId: 1 });
    res.json(signals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/signals/:id', authMiddleware, requirePermission('traffic:read'), async (req, res) => {
  try {
    const signal = await TrafficSignal.findOne({ signalId: req.params.id });
    res.json(signal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/signals/:id', authMiddleware, requirePermission('traffic:update'), async (req, res) => {
  try {
    const signal = await TrafficSignal.findOneAndUpdate(
      { signalId: req.params.id },
      req.body,
      { new: true }
    );

    await logAudit({
      req,
      action: 'traffic.signal-update',
      resourceType: 'traffic_signal',
      resourceId: req.params.id,
      metadata: { updates: req.body }
    });

    res.json(signal);
  } catch (error) {
    await logAudit({
      req,
      action: 'traffic.signal-update',
      resourceType: 'traffic_signal',
      resourceId: req.params.id,
      status: 'failure',
      metadata: { error: error.message }
    });
    res.status(500).json({ message: error.message });
  }
});

router.post(
  '/signals/:id/manual-control',
  authMiddleware,
  requirePermission('traffic:manual-control'),
  async (req, res) => {
    try {
      const { status, timer } = req.body;
      const signal = await TrafficSignal.findOneAndUpdate(
        { signalId: req.params.id },
        { status, currentTimer: timer, mode: 'manual' },
        { new: true }
      );

      await logAudit({
        req,
        action: 'traffic.manual-control',
        resourceType: 'traffic_signal',
        resourceId: req.params.id,
        metadata: { status, timer }
      });

      res.json(signal);
    } catch (error) {
      await logAudit({
        req,
        action: 'traffic.manual-control',
        resourceType: 'traffic_signal',
        resourceId: req.params.id,
        status: 'failure',
        metadata: { error: error.message }
      });
      res.status(500).json({ message: error.message });
    }
  }
);

export default router;
