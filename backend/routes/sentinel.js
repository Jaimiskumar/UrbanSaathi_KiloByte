import express from 'express';
import Camera from '../models/Camera.js';
import VehicleDetection from '../models/VehicleDetection.js';
import WatchlistRecord from '../models/WatchlistRecord.js';
import SentinelEvent from '../models/SentinelEvent.js';
import SentinelAlert from '../models/SentinelAlert.js';
import { authMiddleware } from '../middleware/auth.js';
import { runSentinelTestCase, seed50Cameras } from '../services/sentinelDemoService.js';

const router = express.Router();
const vehicleRouter = express.Router();
const normalizePlate = (plate = '') => plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();

router.post('/demo/seed', authMiddleware, async (req, res) => res.json({ demo: true, cameras: await seed50Cameras() }));
router.post('/demo/run-test-case', authMiddleware, async (req, res) => res.status(201).json(await runSentinelTestCase(req.body?.plateNumber)));
router.post('/demo/reset', authMiddleware, async (req, res) => {
  await Promise.all([
    VehicleDetection.deleteMany({ source: 'DEMO' }),
    SentinelEvent.deleteMany({ source: 'DEMO' }),
    SentinelAlert.deleteMany({}),
    WatchlistRecord.deleteMany({ reason: 'Controlled SENTINEL-X demonstration record' })
  ]);
  res.json({ demo: true, reset: true });
});
router.get('/demo/status', authMiddleware, async (req, res) => res.json({
  cameras: await Camera.countDocuments({ cameraId: /^CAM-GJ-/ }),
  detections: await VehicleDetection.countDocuments({ source: 'DEMO' }),
  events: await SentinelEvent.countDocuments({ source: 'DEMO' }),
  alerts: await SentinelAlert.countDocuments({ plateNumber: { $exists: true } })
}));

vehicleRouter.get('/:plate/history', authMiddleware, async (req, res) => {
  const plateNumber = normalizePlate(req.params.plate);
  const detections = await VehicleDetection.find({ plateNumber }).sort({ timestamp: 1 }).lean();
  res.json({ plateNumber, firstSeen: detections[0]?.timestamp || null, lastSeen: detections.at(-1)?.timestamp || null, totalDetections: detections.length, camerasVisited: [...new Set(detections.map((item) => item.cameraId))], detections });
});
vehicleRouter.get('/:plate/route', authMiddleware, async (req, res) => {
  const plateNumber = normalizePlate(req.params.plate);
  const route = await VehicleDetection.find({ plateNumber }).sort({ timestamp: 1 }).select('cameraId latitude longitude timestamp roadId intersectionId').lean();
  res.json({ plateNumber, route });
});
vehicleRouter.get('/:plate/alerts', authMiddleware, async (req, res) => res.json(await SentinelAlert.find({ plateNumber: normalizePlate(req.params.plate) }).sort({ createdAt: -1 }).lean()));
vehicleRouter.get('/:plate', authMiddleware, async (req, res) => {
  const plateNumber = normalizePlate(req.params.plate);
  const [history, alerts, watchlist] = await Promise.all([
    VehicleDetection.find({ plateNumber }).sort({ timestamp: 1 }).lean(),
    SentinelAlert.find({ plateNumber }).sort({ createdAt: -1 }).lean(),
    WatchlistRecord.findOne({ plateNumber, status: 'ACTIVE' }).lean()
  ]);
  res.json({ plateNumber, status: watchlist ? 'WATCHLIST' : 'NORMAL', firstSeen: history[0]?.timestamp || null, lastSeen: history.at(-1)?.timestamp || null, cameras: [...new Set(history.map((item) => item.cameraId))], alerts, watchlist, route: history });
});

router.get('/events', authMiddleware, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json(await SentinelEvent.find({}).sort({ timestamp: -1 }).limit(limit).lean());
});
router.get('/alerts', authMiddleware, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json(await SentinelAlert.find({}).sort({ createdAt: -1 }).limit(limit).lean());
});
router.get('/watchlist', authMiddleware, async (req, res) => res.json(await WatchlistRecord.find({}).sort({ updatedAt: -1 }).lean()));
router.post('/watchlist', authMiddleware, async (req, res) => res.status(201).json(await WatchlistRecord.create({ ...req.body, plateNumber: req.body.plateNumber ? normalizePlate(req.body.plateNumber) : undefined, createdBy: req.user.userId })));
router.patch('/watchlist/:id', authMiddleware, async (req, res) => res.json(await WatchlistRecord.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })));

export { vehicleRouter };
export default router;