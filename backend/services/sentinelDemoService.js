import Camera from '../models/Camera.js';
import VehicleDetection from '../models/VehicleDetection.js';
import WatchlistRecord from '../models/WatchlistRecord.js';
import SentinelEvent from '../models/SentinelEvent.js';
import SentinelAlert from '../models/SentinelAlert.js';
import { eventBus } from './agents/index.js';
import { getSocketServer } from './socketServer.js';

const vendors = ['Vendor-A', 'Vendor-B', 'Vendor-C', 'Vendor-D', 'Vendor-E'];
const vmsSystems = ['VMS-UP-01', 'VMS-UP-02', 'VMS-UP-03', 'VMS-UP-04', 'VMS-UP-05'];
const routeCameras = [1, 2, 3, 6, 14];
const baseLocation = { latitude: 28.5449, longitude: 77.3331 };
const noidaLocations = [
  ['Amity University Gate 1 (Sector 125)', 28.5449, 77.3331],
  ['Amity University Gate 2 (Expressway Entry)', 28.5458, 77.3325],
  ['Mahamaya Flyover (Expressway Interchange)', 28.5532, 77.3245],
  ['Kalindi Kunj Border (Delhi-UP Checkpost)', 28.5471, 77.3129],
  ['Okhla Bird Sanctuary Metro Station', 28.5412, 77.3238],
  ['Botanical Garden Interchange (Sector 38A)', 28.5642, 77.3344],
  ['Sector 18 Atta Market (DLF Mall of India)', 28.5708, 77.3219],
  ['Sector 16 Metro Station (Film City Road)', 28.5786, 77.3178],
  ['DND Flyway Toll Plaza (Delhi-Noida Entry)', 28.5833, 77.3090],
  ['Sector 126 Tech Zone (HCL Campus)', 28.5398, 77.3401],
  ['Sector 128 Jaypee Wish Town / Hospital', 28.5215, 77.3688],
  ['Sector 132 Step By Step School Junction', 28.5140, 77.3820],
  ['Sector 137 Metro Station (Expressway Node)', 28.5085, 77.3980],
  ['Sector 142 Advant Navis Business Park', 28.5029, 77.4116],
  ['Sector 144 Metro Station (IT Hub)', 28.4950, 77.4250],
  ['Sector 148 Aqua Line Metro Depot', 28.4812, 77.4520],
  ['Pari Chowk Central Roundabout', 28.4646, 77.5108],
  ['Alpha 1 Commercial Belt (Greater Noida)', 28.4720, 77.5140],
  ['Knowledge Park II (Education Hub)', 28.4610, 77.4980],
  ['Knowledge Park III (Sharda University)', 28.4735, 77.4870],
  ['Sector 62 Model Town Chowk', 28.6271, 77.3725],
  ['Sector 63 Electronic City Metro Station', 28.6280, 77.3810],
  ['Sector 59 Industrial Area Cross Road', 28.6080, 77.3750],
  ['Sector 52 / 51 Aqua Line Metro Interchange', 28.5890, 77.3690],
  ['Noida City Centre (Sector 32/39 Chowk)', 28.5746, 77.3562],
  ['Sector 76 High-Rise Residential Corridor', 28.5680, 77.3890],
  ['Sector 104 Hazipur Food Street Junction', 28.5390, 77.3590],
  ['Sector 110 Gejha Market Crossing', 28.5310, 77.3740],
  ['Mayur Vihar Phase 1 (Delhi Border Ramp)', 28.6040, 77.2990],
  ['Akshardham NH-24 / Expressway Merge', 28.6180, 77.2820]
];

const cameraDocument = (number) => {
  const vendorIndex = Math.floor((number - 1) / 10);
  const angle = (number / 50) * Math.PI * 2;
  return {
    cameraId: `CAM-UP-${String(number).padStart(3, '0')}`,
    cameraName: `Sentinel Noida Corridor ${String(number).padStart(2, '0')}`,
    vmsId: vmsSystems[vendorIndex],
    vendor: vendors[vendorIndex],
    location: noidaLocations[number - 1]?.[0] || `Noida Highway Corridor ${number}`,
    latitude: noidaLocations[number - 1]?.[1] || baseLocation.latitude + Math.sin(angle) * 0.08,
    longitude: noidaLocations[number - 1]?.[2] || baseLocation.longitude + Math.cos(angle) * 0.08,
    roadId: `ROAD-UP-${String(((number - 1) % 40) + 1).padStart(3, '0')}`,
    intersectionId: `INT-UP-${String(((number - 1) % 12) + 1).padStart(3, '0')}`,
    cameraType: number % 10 === 0 ? 'ptz' : 'fixed',
    protocol: ['RTSP', 'ONVIF', 'HLS', 'HTTP', 'WebRTC'][vendorIndex],
    streamUrl: `demo://sentinel/${String(number).padStart(3, '0')}`,
    resolution: { width: 1920, height: 1080 },
    fps: 25,
    status: 'active',
    isActive: true,
    lastHeartbeat: new Date(),
    lastSeen: new Date(),
    capabilities: ['vehicle_detection', 'plate_detection', 'tracking', 'incident_detection']
  };
};

export async function seed50Cameras() {
  const operations = Array.from({ length: 50 }, (_, index) => {
    const document = cameraDocument(index + 1);
    return {
      updateOne: {
        filter: { cameraId: document.cameraId },
        update: { $set: document },
        upsert: true
      }
    };
  });
  await Camera.bulkWrite(operations);
  return Camera.find({ cameraId: /^CAM-UP-/ }).sort({ cameraId: 1 }).lean();
}

export async function runSentinelTestCase(plateNumber = 'UP16AB1234') {
  const cameras = await seed50Cameras();
  const selectedCameras = routeCameras.map((number) => cameras.find((camera) => camera.cameraId.endsWith(String(number).padStart(3, '0'))));
  const normalizedPlate = plateNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const now = Date.now();

  const watchlist = await WatchlistRecord.findOneAndUpdate(
    { plateNumber: normalizedPlate, status: 'ACTIVE' },
    {
      $set: {
        type: 'STOLEN_VEHICLE',
        identifier: normalizedPlate,
        reason: 'Controlled SENTINEL-X demonstration record',
        priority: 'CRITICAL',
        status: 'ACTIVE'
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await VehicleDetection.deleteMany({ source: 'DEMO', plateNumber: normalizedPlate });
  await SentinelEvent.deleteMany({ source: 'DEMO', plateNumber: normalizedPlate });
  await SentinelAlert.deleteMany({ plateNumber: normalizedPlate });

  const detections = selectedCameras.map((camera, index) => ({
    vehicleTrackId: `TRK-DEMO-${normalizedPlate}`,
    cameraId: camera.cameraId,
    plateNumber: normalizedPlate,
    timestamp: new Date(now + index * 3 * 60 * 1000),
    boundingBox: { x1: 180 + index * 12, y1: 210, x2: 420 + index * 12, y2: 430 },
    vehicleType: 'car',
    color: 'white',
    confidence: 0.96,
    latitude: camera.latitude,
    longitude: camera.longitude,
    roadId: camera.roadId,
    intersectionId: camera.intersectionId,
    source: 'DEMO',
    evidence: { streamUrl: camera.streamUrl, label: 'DEMO simulated feed' }
  }));
  const savedDetections = await VehicleDetection.insertMany(detections);

  const eventDocuments = savedDetections.map((detection) => ({
    eventType: 'VEHICLE_DETECTED',
    source: 'DEMO',
    cameraId: detection.cameraId,
    vehicleId: detection.vehicleTrackId,
    plateNumber: normalizedPlate,
    roadId: detection.roadId,
    intersectionId: detection.intersectionId,
    location: { latitude: detection.latitude, longitude: detection.longitude, label: cameras.find((camera) => camera.cameraId === detection.cameraId)?.location || 'Noida corridor' },
    timestamp: detection.timestamp,
    confidence: detection.confidence,
    severity: 'INFO',
    metadata: { vehicleType: detection.vehicleType, color: detection.color },
    evidence: detection.evidence,
    status: 'PROCESSED'
  }));
  const events = await SentinelEvent.insertMany(eventDocuments);

  const matchEvent = await SentinelEvent.create({
    eventType: 'WATCHLIST_MATCH',
    source: 'DEMO',
    cameraId: selectedCameras[0].cameraId,
    vehicleId: detections[0].vehicleTrackId,
    plateNumber: normalizedPlate,
    roadId: selectedCameras[0].roadId,
    intersectionId: selectedCameras[0].intersectionId,
    location: { latitude: selectedCameras[0].latitude, longitude: selectedCameras[0].longitude, label: selectedCameras[0].location },
    timestamp: detections[0].timestamp,
    confidence: 0.96,
    severity: 'CRITICAL',
    metadata: { watchlistRecordId: watchlist._id, matchConfidence: 0.96, detectionConfidence: 0.96 },
    evidence: { detectionId: savedDetections[0]._id, label: 'DEMO evidence' },
    status: 'NEW'
  });

  let workflow = null;
  try {
    workflow = (await eventBus.publishAndWait({
      eventType: 'WATCHLIST_MATCH',
      source: { type: 'DEMO' },
      cameraId: matchEvent.cameraId,
      vehicleId: matchEvent.vehicleId,
      plateNumber: normalizedPlate,
      location: matchEvent.location,
      detection: { confidence: matchEvent.confidence },
      evidence: matchEvent.evidence
    })).workflow;
  } catch (error) {
    workflow = { status: 'FAILED', error: error.message };
  }

  const alert = await SentinelAlert.create({
    eventId: matchEvent._id,
    type: 'WATCHLIST_MATCH',
    severity: 'CRITICAL',
    confidence: matchEvent.confidence,
    title: `Watchlist vehicle detected: ${normalizedPlate}`,
    description: 'Designated vehicle matched an active watchlist record in the controlled demo.',
    location: matchEvent.location,
    cameraId: matchEvent.cameraId,
    vehicleId: matchEvent.vehicleId,
    plateNumber: normalizedPlate,
    authority: 'Police',
    priority: 'CRITICAL',
    recommendedAction: 'Verify the plate evidence and dispatch the nearest patrol unit.',
    status: 'NEW'
  });

  const payload = {
    demo: true,
    plateNumber: normalizedPlate,
    cameras: cameras.length,
    detections: savedDetections,
    events: [...events, matchEvent],
    route: selectedCameras.map((camera, index) => ({ cameraId: camera.cameraId, latitude: camera.latitude, longitude: camera.longitude, timestamp: detections[index].timestamp })),
    watchlist,
    alert,
    workflow,
    authority: { name: alert.authority, status: alert.status, action: alert.recommendedAction }
  };
  getSocketServer().emit('sentinel-demo-update', payload);
  getSocketServer().emit('sentinel-alert', alert);
  return payload;
}