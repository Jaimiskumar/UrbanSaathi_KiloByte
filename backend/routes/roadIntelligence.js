import express from 'express';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { lookupRoad } from '../services/roadIntelligenceService.js';
import RoadMaster from '../models/RoadMaster.js';
import RoadMatch from '../models/RoadMatch.js';
import RoadWorkHistory from '../models/RoadWorkHistory.js';

const router = express.Router();

router.get('/lookup', authMiddleware, async (req, res) => {
  try {
    const result = await lookupRoad({
      coordinates: { lat: req.query.lat, lng: req.query.lng },
      issueType: req.query.issueType
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/health', authMiddleware, requirePermission('road-issues:read'), async (req, res) => {
  const [kgis, roadMatch, bbmpRoadHistory] = await Promise.all([
    RoadMaster.exists({}),
    RoadMatch.exists({}),
    RoadWorkHistory.exists({})
  ]);
  res.json({ status: 'ready', datasets: { kgis: Boolean(kgis), bbmpRoadHistory: Boolean(bbmpRoadHistory), roadMatch: Boolean(roadMatch) } });
});

export default router;