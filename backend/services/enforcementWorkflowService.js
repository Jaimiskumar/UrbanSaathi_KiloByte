import { eventBus } from './agents/index.js';

const vehicleFor = (result, detection = {}) => (
  (result.vehicles || []).find((vehicle) => vehicle.id === detection.vehicleId)
  || {}
);

const plateFor = (vehicle, detection = {}) => (
  detection.licensePlate
  || detection.plateNumber
  || detection.vehicle_number
  || vehicle.plateNumber
  || vehicle.plate_number
  || null
);

const evidenceFor = (frame) => ({
  image: frame.imageUrl || null,
  frames: frame.imageUrl ? [frame.imageUrl] : []
});

export function buildEnforcementEvents(result = {}, frame = {}) {
  const events = [];
  const add = (eventType, detection, vehicle = {}) => {
    const licensePlate = plateFor(vehicle, detection);
    events.push({
      eventType,
      location: {
        lat: Number(frame.latitude),
        lng: Number(frame.longitude),
        name: frame.location
      },
      detection: {
        ...detection,
        licensePlate,
        vehicleId: detection.vehicleId || vehicle.id,
        model: detection.model || result.model?.name || 'vision-model'
      },
      evidence: evidenceFor(frame),
      source: { type: 'ML_MODEL', model: detection.model || result.model?.name || 'vision-model' },
      cameraId: frame.cameraId,
      timestamp: new Date().toISOString()
    });
  };

  for (const detection of result.helmets || []) {
    if (detection.helmetDetected === false) {
      const vehicle = vehicleFor(result, detection);
      add('HELMET_VIOLATION', {
        ...detection,
        confidence: Number(detection.confidence || 0),
        violation: 'NO_HELMET'
      }, vehicle);
    }
  }

  for (const detection of result.speeds || []) {
    if (!detection.isSpeeding && !detection.rashDriving) continue;
    const vehicle = vehicleFor(result, detection);
    const speed = Number(detection.speed || detection.speed_kmh || 0);
    const limit = Number(detection.speedLimit || frame.speedLimit || 60);
    const eventType = detection.rashDriving || speed >= limit * 1.25 ? 'RASH_DRIVING' : 'OVERSPEEDING';
    add(eventType, {
      ...detection,
      speed,
      speedLimit: limit,
      confidence: Number(detection.confidence || 0)
    }, vehicle);
  }

  for (const detection of result.speed_tracking_detections || []) {
    const speed = Number(detection.speed_kmh || detection.speed || 0);
    const limit = Number(detection.speedLimit || frame.speedLimit || 60);
    if (!detection.isSpeeding && speed <= limit) continue;
    const vehicle = vehicleFor(result, detection);
    add(detection.rashDriving || speed >= limit * 1.25 ? 'RASH_DRIVING' : 'OVERSPEEDING', {
      ...detection,
      speed,
      speedLimit: limit,
      confidence: Number(detection.confidence || 0)
    }, vehicle);
  }

  for (const detection of result.signalViolations || []) {
    const vehicle = vehicleFor(result, detection);
    add('SIGNAL_VIOLATION', {
      ...detection,
      confidence: Number(detection.confidence || 0.8),
      violation: 'SIGNAL_BREAKING'
    }, vehicle);
  }

  for (const detection of result.illegalParkings || []) {
    const vehicle = vehicleFor(result, detection);
    add('ILLEGAL_PARKING', {
      ...detection,
      licensePlate: detection.licensePlate || detection.plate,
      stationaryDuration: Number(detection.stationaryDuration || 90),
      confidence: Number(detection.confidence || 0.8)
    }, vehicle);
  }

  return events;
}

export function buildEncroachmentEvents(result = {}, frame = {}) {
  const detections = [];
  for (const detection of result.illegalParkings || []) {
    detections.push({
      ...detection,
      violation: 'ILLEGAL_PARKING',
      licensePlate: detection.licensePlate || detection.plate,
      stationaryDuration: Number(detection.stationaryDuration || 90)
    });
  }
  for (const detection of result.vendors || []) {
    detections.push({ ...detection, violation: 'STREET_VENDOR' });
  }
  for (const detection of result.urban_issues || []) {
    const label = detection.label || detection.class_name || detection.type || '';
    if (/vendor|hawker|encroach|stall/i.test(label)) detections.push({ ...detection, violation: label });
  }
  const hawkers = result.hawkers || {};
  if (hawkers.hawkersDetected) {
    for (const detection of hawkers.detections || [{ confidence: hawkers.confidence, type: 'HAWKER' }]) {
      detections.push({ ...detection, violation: 'HAWKER' });
    }
  }
  return detections.map((detection) => ({
    eventType: 'ENCROACHMENT_DETECTED',
    location: { lat: Number(frame.latitude), lng: Number(frame.longitude), name: frame.location },
    detection: {
      ...detection,
      class: detection.violation || detection.label || 'street vendor',
      confidence: Number(detection.confidence || 0),
      model: detection.model || result.model?.name || 'vendor-detector'
    },
    evidence: evidenceFor(frame),
    source: { type: 'ML_MODEL', model: detection.model || result.model?.name || 'vendor-detector' },
    cameraId: frame.cameraId,
    timestamp: new Date().toISOString()
  }));
}

export async function processEnforcementDetections(result, frame) {
  const workflows = [];
  for (const event of buildEnforcementEvents(result, frame)) {
    const { workflow } = await eventBus.publishAndWait(event);
    const enforcement = workflow?.results?.EnforcementAgent?.actionResult || {};
    const challan = workflow?.results?.EChallanAgent?.actionResult || null;
    workflows.push({
      eventId: event.eventId,
      eventType: event.eventType,
      agent: 'EnforcementAgent',
      status: enforcement.status || 'REVIEW_REQUIRED',
      reason: enforcement.reason || null,
      candidate: enforcement.candidate || null,
      challan,
      evidence: event.evidence,
      workflow
    });
  }
  return workflows;
}

export async function processEncroachmentDetections(result, frame) {
  const workflows = [];
  for (const event of buildEncroachmentEvents(result, frame)) {
    const { workflow } = await eventBus.publishAndWait(event);
    const encroachment = workflow?.results?.EncroachmentAgent?.actionResult || {};
    const challan = workflow?.results?.EChallanAgent?.actionResult || null;
    workflows.push({
      eventId: event.eventId,
      eventType: event.eventType,
      agent: 'EncroachmentAgent',
      status: encroachment.status || 'REVIEW_REQUIRED',
      reason: encroachment.reason || null,
      violation: encroachment.violation || null,
      authority: encroachment.authority || null,
      challan,
      evidence: event.evidence,
      workflow
    });
  }
  return workflows;
}
