import Camera from '../models/Camera.js';
import VehicleDetection from '../models/VehicleDetection.js';
import WatchlistRecord from '../models/WatchlistRecord.js';
import SentinelEvent from '../models/SentinelEvent.js';
import SentinelAlert from '../models/SentinelAlert.js';
import { eventBus } from './agents/index.js';
import { getSocketServer } from './socketServer.js';

const vendors = ['Vendor-A', 'Vendor-B', 'Vendor-C', 'Vendor-D', 'Vendor-E'];
const vmsSystems = ['VMS-GJ-01', 'VMS-GJ-02', 'VMS-GJ-03', 'VMS-GJ-04', 'VMS-GJ-05'];
const routeCameras = [1, 7, 14, 23, 31];
const baseLocation = { latitude: 23.0225, longitude: 72.5714 };
const gujaratLocations = [
  ['S.G. Highway - Thaltej', 23.0507, 72.5110],
  ['Ashram Road - Income Tax Circle', 23.0345, 72.5684],
  ['C.G. Road - Navrangpura', 23.0352, 72.5617],
  ['Airport Road - Hansol', 23.0734, 72.6240],
  ['Ring Road - Odhav Circle', 23.0216, 72.6686],
  ['Gandhinagar - Infocity Circle', 23.2156, 72.6369],
  ['Gandhinagar - Akshardham Road', 23.2237, 72.6471],
  ['Gandhinagar - Sargasan Cross Road', 23.1854, 72.6274],
  ['Vadodara - Alkapuri', 22.3100, 73.1700],
  ['Vadodara - Sama Savli Road', 22.3370, 73.1730],
  ['Vadodara - Makarpura Junction', 22.2587, 73.1940],
  ['Surat - Athwa Gate', 21.1858, 72.8095],
  ['Surat - Udhna Darwaja', 21.1702, 72.8400],
  ['Surat - Varachha Road', 21.2134, 72.8755],
  ['Surat - Dumas Road', 21.1458, 72.7656],
  ['Rajkot - Kalawad Road', 22.3039, 70.8022],
  ['Rajkot - Gondal Chowk', 22.2706, 70.8002],
  ['Rajkot - Dhebar Road', 22.2916, 70.7985],
  ['Bhavnagar - Ghogha Circle', 21.7645, 72.1519],
  ['Jamnagar - Bedi Road', 22.4707, 70.0577],
  ['Junagadh - Majevadi Gate', 21.5222, 70.4579],
  ['Junagadh - Talav Gate', 21.5205, 70.4562],
  ['Gujarat National Highway - Chotila', 22.4238, 71.1965],
  ['Anand - Vallabh Vidyanagar Road', 22.5645, 72.9289],
  ['Nadiad - College Road', 22.6916, 72.8634],
  ['Mehsana - Modhera Cross Road', 23.5880, 72.3693],
  ['Patan - Radhanpur Cross Road', 23.8493, 72.1266],
  ['Bharuch - Zadeshwar Chowkdi', 21.7051, 72.9959],
  ['Vapi - GIDC Char Rasta', 20.3718, 72.9146],
  ['Gandhidham - Tagore Road', 23.0753, 70.1337]
];

const cameraDocument = (number) => {
  const vendorIndex = Math.floor((number - 1) / 10);
  const angle = (number / 50) * Math.PI * 2;
  return {
    cameraId: `CAM-GJ-${String(number).padStart(3, '0')}`,
    cameraName: `Sentinel Gujarat Corridor ${String(number).padStart(2, '0')}`,
    vmsId: vmsSystems[vendorIndex],
    vendor: vendors[vendorIndex],
    location: gujaratLocations[number - 1]?.[0] || `Gujarat Highway Corridor ${number}`,
    latitude: gujaratLocations[number - 1]?.[1] || baseLocation.latitude + Math.sin(angle) * 0.08,
    longitude: gujaratLocations[number - 1]?.[2] || baseLocation.longitude + Math.cos(angle) * 0.08,
    roadId: `ROAD-GJ-${String(((number - 1) % 40) + 1).padStart(3, '0')}`,
    intersectionId: `INT-GJ-${String(((number - 1) % 12) + 1).padStart(3, '0')}`,
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
  return Camera.find({ cameraId: /^CAM-GJ-/ }).sort({ cameraId: 1 }).lean();
}

export async function runSentinelTestCase(plateNumber = 'GJ01AB1234') {
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
    location: { latitude: detection.latitude, longitude: detection.longitude, label: cameras.find((camera) => camera.cameraId === detection.cameraId)?.location || 'Gujarat corridor' },
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