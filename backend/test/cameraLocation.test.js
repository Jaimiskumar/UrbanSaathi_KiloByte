import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCameraCoordinates,
  resolveCameraLocation
} from '../services/cameraLocationService.js';

test('camera coordinates require a complete, in-range pair', () => {
  assert.deepEqual(parseCameraCoordinates(undefined, undefined), {
    coordinates: null,
    error: null
  });
  assert.match(parseCameraCoordinates(12, undefined).error, /provided together/);
  assert.match(parseCameraCoordinates(91, 77).error, /valid latitude/);
  assert.deepEqual(parseCameraCoordinates('12.5', '77.2'), {
    coordinates: { latitude: 12.5, longitude: 77.2 },
    error: null
  });
});

test('device coordinates are labelled as device-reported, not registry-verified', async () => {
  const result = await resolveCameraLocation({
    cameraId: 'dashcam-1',
    latitude: '12.5',
    longitude: '77.2',
    locationName: 'Device location'
  }, {});

  assert.equal(result.status, 'available');
  assert.equal(result.source, 'device_reported_gps');
  assert.deepEqual(result.coordinates, { latitude: 12.5, longitude: 77.2 });
});

test('active registered-camera coordinates take precedence over an unverified label', async () => {
  const cameraModel = {
    db: { readyState: 1 },
    findOne(query) {
      assert.deepEqual(query, { cameraId: 'cam-1', isActive: true, status: 'active' });
      return {
        select(fields) {
          assert.equal(fields, 'cameraName location latitude longitude');
          return Promise.resolve({
            cameraName: 'North Gate Camera',
            location: 'North Gate Junction',
            latitude: 12.6,
            longitude: 77.3
          });
        }
      };
    }
  };
  const result = await resolveCameraLocation({
    cameraId: 'cam-1',
    locationName: 'Browser-provided name'
  }, cameraModel);

  assert.equal(result.source, 'registered_camera');
  assert.equal(result.name, 'North Gate Junction');
  assert.deepEqual(result.coordinates, { latitude: 12.6, longitude: 77.3 });
});

test('an unregistered camera keeps inference location explicitly unavailable', async () => {
  const cameraModel = {
    db: { readyState: 1 },
    findOne() {
      return { select: async () => null };
    }
  };
  const result = await resolveCameraLocation({
    cameraId: 'unknown',
    locationName: 'Unverified roadside label'
  }, cameraModel);

  assert.equal(result.status, 'unavailable');
  assert.equal(result.source, null);
  assert.equal(result.name, 'Unverified roadside label');
  assert.equal(result.coordinates, null);
  assert.match(result.reason, /No active registered camera/);
});
