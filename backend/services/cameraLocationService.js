import Camera from '../models/Camera.js';

const validCoordinate = (value, minimum, maximum) => (
  typeof value === 'number'
  && Number.isFinite(value)
  && value >= minimum
  && value <= maximum
);

export function parseCameraCoordinates(latitude, longitude) {
  const hasLatitude = latitude !== undefined && latitude !== null && latitude !== '';
  const hasLongitude = longitude !== undefined && longitude !== null && longitude !== '';
  if (!hasLatitude && !hasLongitude) return { coordinates: null, error: null };
  if (!hasLatitude || !hasLongitude) {
    return { coordinates: null, error: 'Latitude and longitude must be provided together.' };
  }

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (
    !validCoordinate(parsedLatitude, -90, 90)
    || !validCoordinate(parsedLongitude, -180, 180)
  ) {
    return { coordinates: null, error: 'Camera coordinates are outside valid latitude/longitude ranges.' };
  }
  return {
    coordinates: { latitude: parsedLatitude, longitude: parsedLongitude },
    error: null
  };
}

export async function resolveCameraLocation(
  { cameraId, latitude, longitude, locationName, accuracyMeters },
  cameraModel = Camera
) {
  const parsed = parseCameraCoordinates(latitude, longitude);
  if (parsed.error) return { status: 'invalid', error: parsed.error };
  const parsedAccuracy = accuracyMeters === undefined || accuracyMeters === null || accuracyMeters === ''
    ? null
    : Number(accuracyMeters);
  if (
    parsedAccuracy !== null
    && (!Number.isFinite(parsedAccuracy) || parsedAccuracy < 0 || parsedAccuracy > 10000)
  ) {
    return { status: 'invalid', error: 'GPS accuracy must be a number between 0 and 10000 meters.' };
  }

  const requestedName = typeof locationName === 'string' && locationName.trim()
    ? locationName.trim()
    : null;

  if (cameraId && cameraModel.db?.readyState === 1) {
    try {
      const camera = await cameraModel.findOne({
        cameraId,
        isActive: true,
        status: 'active'
      }).select('cameraName location latitude longitude');
      if (
        camera
        && validCoordinate(camera.latitude, -90, 90)
        && validCoordinate(camera.longitude, -180, 180)
      ) {
        return {
          status: 'available',
          source: 'registered_camera',
          name: camera.location || camera.cameraName,
          coordinates: { latitude: camera.latitude, longitude: camera.longitude },
          accuracyMeters: 0
        };
      }
    } catch (error) {
      return {
        status: 'unavailable',
        source: null,
        name: requestedName,
        coordinates: null,
        reason: `Camera registry lookup failed: ${error.message}`
      };
    }
  }

  if (parsed.coordinates) {
    return {
      status: 'available',
      source: 'device_reported_gps',
      name: requestedName,
      coordinates: parsed.coordinates,
      accuracyMeters: parsedAccuracy
    };
  }

  return {
    status: 'unavailable',
    source: null,
    name: requestedName,
    coordinates: null,
    reason: cameraId && cameraModel.db?.readyState !== 1
      ? 'Camera registry is disconnected; provide device GPS or register this camera with coordinates.'
      : cameraId
        ? 'No active registered camera with trusted coordinates matches this camera ID.'
      : 'Provide device GPS coordinates or register this camera with its coordinates.'
  };
}
