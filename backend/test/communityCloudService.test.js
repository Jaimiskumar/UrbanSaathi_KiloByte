import test from 'node:test';
import assert from 'node:assert/strict';
import { CommunityCloudService } from '../services/communityCloudService.js';

function createLiveService() {
  const previous = process.env.URBANSAATHI_CONNECTED_VEHICLE_DEMO_MODE;
  process.env.URBANSAATHI_CONNECTED_VEHICLE_DEMO_MODE = 'false';
  const service = new CommunityCloudService();
  if (previous === undefined) delete process.env.URBANSAATHI_CONNECTED_VEHICLE_DEMO_MODE;
  else process.env.URBANSAATHI_CONNECTED_VEHICLE_DEMO_MODE = previous;
  return service;
}

test('live-input mode starts without seeded vehicles and hazards', () => {
  const service = createLiveService();
  assert.equal(service.mode, 'live_input_only');
  assert.deepEqual(service.getAllVehicles(), []);
  assert.deepEqual(service.getAllHazards(), []);
});

test('hazard reports reject missing coordinates instead of using sample coordinates', () => {
  const service = createLiveService();
  assert.throws(
    () => service.reportHazard({
      camera_id: 'CAMERA-1',
      category: 'POTHOLE',
      confidence: 0.9
    }),
    (error) => error.statusCode === 400 && /no default location/.test(error.message)
  );
  assert.deepEqual(service.getAllHazards(), []);
});

test('uncertain or missing GPS accuracy cannot community-verify hazards', () => {
  const service = createLiveService();
  const first = service.reportHazard({
    reported_by: 'DRIVER-1',
    category: 'POTHOLE',
    latitude: 28.5,
    longitude: 77.3,
    confidence: 0.9
  });
  const second = service.reportHazard({
    reported_by: 'DRIVER-2',
    category: 'POTHOLE',
    latitude: 28.50001,
    longitude: 77.30001,
    confidence: 0.92
  });
  assert.equal(first.verified, false);
  assert.equal(first.location_verification, 'location_accuracy_unverified');
  assert.equal(second.action, 'CREATED');
  assert.equal(service.getAllHazards().length, 2);
});

test('fresh independent precise reports verify one nearby hazard', () => {
  const service = createLiveService();
  const first = service.reportHazard({
    reported_by: 'DRIVER-1',
    category: 'POTHOLE',
    latitude: 28.5,
    longitude: 77.3,
    location_accuracy_meters: 5,
    confidence: 0.9
  });
  const second = service.reportHazard({
    reported_by: 'DRIVER-2',
    category: 'POTHOLE',
    latitude: 28.50001,
    longitude: 77.30001,
    location_accuracy_meters: 7,
    confidence: 0.92
  });
  assert.equal(first.location_verification, 'eligible_for_independent_confirmation');
  assert.equal(second.action, 'VERIFIED');
  assert.equal(second.verification_count, 2);
});

test('stale precise reports do not verify a new hazard report', () => {
  const service = createLiveService();
  service.reportHazard({
    reported_by: 'DRIVER-1',
    category: 'POTHOLE',
    latitude: 28.5,
    longitude: 77.3,
    location_accuracy_meters: 5
  });
  service.getAllHazards()[0].reported_at = new Date(Date.now() - 1800001).toISOString();
  const second = service.reportHazard({
    reported_by: 'DRIVER-2',
    category: 'POTHOLE',
    latitude: 28.50001,
    longitude: 77.30001,
    location_accuracy_meters: 7
  });
  assert.equal(second.action, 'CREATED');
  assert.equal(second.verified, false);
  assert.equal(service.getAllHazards().length, 2);
});

test('vehicle telemetry requires a real ID and valid GPS/speed/heading', () => {
  const service = createLiveService();
  assert.throws(
    () => service.updateVehicleTelemetry({ speed: 10, heading: 0 }),
    (error) => error.statusCode === 400
  );
  const result = service.updateVehicleTelemetry({
    vehicle_id: 'VEHICLE-1',
    latitude: 28.5,
    longitude: 77.3,
    speed: 12,
    heading: 180
  });
  assert.equal(result.vehicle.id, 'VEHICLE-1');
  assert.equal(result.vehicle.lat, 28.5);
  assert.equal(result.vehicle.lng, 77.3);
});
