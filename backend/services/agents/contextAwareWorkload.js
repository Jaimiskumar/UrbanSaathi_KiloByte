const positiveSetting = (name, fallback, minimum, maximum) => {
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) && configured >= minimum && configured <= maximum
    ? configured
    : fallback;
};

const maximumDetectionDelayMs = positiveSetting(
  'URBANSAATHI_MAX_DETECTION_DELAY_MS',
  15000,
  100,
  60000
);
const minimumIntervalMs = Math.min(
  positiveSetting('URBANSAATHI_MIN_INFERENCE_INTERVAL_MS', 500, 100, 30000),
  maximumDetectionDelayMs
);

export const WORKLOAD_LIMITS = Object.freeze({
  minimumIntervalMs,
  normalIntervalMs: positiveSetting('URBANSAATHI_NORMAL_INFERENCE_INTERVAL_MS', 5000, 100, 30000),
  stableIntervalMs: positiveSetting('URBANSAATHI_STABLE_INFERENCE_INTERVAL_MS', 10000, 100, 30000),
  elevatedIntervalMs: positiveSetting('URBANSAATHI_ELEVATED_INFERENCE_INTERVAL_MS', 2000, 100, 30000),
  emergencyIntervalMs: positiveSetting('URBANSAATHI_EMERGENCY_INFERENCE_INTERVAL_MS', 1000, 100, 30000),
  maximumDetectionDelayMs,
  maximumContextAgeMs: positiveSetting('URBANSAATHI_MAX_CONTEXT_AGE_MS', 300000, 1000, 3600000),
  cooldownMs: positiveSetting('URBANSAATHI_WORKLOAD_COOLDOWN_MS', 5000, 0, 60000)
});

const boundedNumber = (value, minimum, maximum) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : null;
};

const normalizedToken = (value) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/[\s-]+/g, '_');

const eventLocation = (event) => (
  typeof event.location === 'string'
    ? event.location
    : event.location?.roadSegmentId || event.location?.name || event.location?.address || null
);

function normalizedContext(event, now) {
  const input = event.context && typeof event.context === 'object' ? event.context : {};
  const observedAt = input.observedAt || input.timestamp || event.observedAt || event.timestamp || null;
  const timestampMs = observedAt ? Date.parse(observedAt) : NaN;
  const validTimestamp = Number.isFinite(timestampMs) && timestampMs <= now + 60000;
  const ageMs = validTimestamp ? Math.max(0, now - timestampMs) : null;
  const fresh = validTimestamp && ageMs <= WORKLOAD_LIMITS.maximumContextAgeMs;
  const invalidInputs = [];
  const missingInputs = [];

  if (!observedAt) missingInputs.push('context timestamp');
  else if (!validTimestamp) invalidInputs.push('context timestamp is invalid or in the future');
  else if (!fresh) invalidInputs.push('context is stale and was excluded from workload decisions');

  const value = (name, aliases, minimum, maximum) => {
    if (!fresh) return null;
    const found = [name, ...aliases].find((key) => input[key] !== undefined && input[key] !== null);
    if (!found) return null;
    const result = boundedNumber(input[found], minimum, maximum);
    if (result === null) invalidInputs.push(`${name} is outside its valid range`);
    return result;
  };
  const boolean = (name, aliases = []) => {
    if (!fresh) return null;
    const found = [name, ...aliases].find((key) => input[key] !== undefined && input[key] !== null);
    if (!found) return null;
    if (typeof input[found] !== 'boolean') {
      invalidInputs.push(`${name} must be a boolean`);
      return null;
    }
    return input[found];
  };

  const trafficDensityVehPerKm = value(
    'trafficDensityVehPerKm',
    ['traffic_density_veh_per_km', 'trafficDensity'],
    0,
    500
  );
  const queueLengthVehicles = value('queueLengthVehicles', ['queue_length_veh', 'queueLength'], 0, 10000);
  const visibilityKm = value('visibilityKm', ['visibility_km'], 0, 100);
  const rainIntensityMmph = value('rainIntensityMmph', ['rain_intensity_mmph'], 0, 1000);
  const modelConfidence = value('modelConfidence', ['model_confidence'], 0, 1);
  const trackingConfidence = value('trackingConfidence', ['tracking_confidence'], 0, 1);
  const cpuUtilizationPct = value('cpuUtilizationPct', ['cpu_utilization_pct'], 0, 100);
  const memoryPressurePct = value('memoryPressurePct', ['memory_pressure_pct'], 0, 100);
  const workQueueLength = value('workQueueLength', ['work_queue_length'], 0, 100000);

  const requestedTimeOfDay = normalizedToken(input.timeOfDay || input.time_of_day);
  const allowedTimes = new Set(['DAYTIME', 'MORNING_PEAK', 'EVENING_PEAK', 'NIGHT']);
  let timeOfDay = allowedTimes.has(requestedTimeOfDay) ? requestedTimeOfDay : null;
  if (requestedTimeOfDay && !timeOfDay && fresh) {
    invalidInputs.push('timeOfDay is unsupported');
  }
  const timeZone = input.timeZone || process.env.URBANSAATHI_TIME_ZONE || 'Asia/Kolkata';
  if (!timeOfDay && fresh) {
    let hour = null;
    try {
      hour = Number(new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        hourCycle: 'h23',
        timeZone
      }).format(timestampMs));
    } catch {
      invalidInputs.push('timeZone is unsupported; time-of-day policy was skipped');
    }
    if (hour !== null) {
      timeOfDay = hour >= 7 && hour < 10
        ? 'MORNING_PEAK'
        : hour >= 16 && hour < 20
          ? 'EVENING_PEAK'
          : hour >= 6 && hour < 22
            ? 'DAYTIME'
            : 'NIGHT';
    }
  }

  const affectedLocation = input.affectedLocation || input.affectedRoadSegmentId || null;
  const currentLocation = input.roadSegmentId || input.intersection || eventLocation(event);
  const eventAffected = Boolean(
    boolean('eventActive', ['event_active'])
    && affectedLocation
    && currentLocation
    && String(affectedLocation).toLowerCase() === String(currentLocation).toLowerCase()
  );

  return {
    observedAt: validTimestamp ? new Date(timestampMs).toISOString() : null,
    ageMs,
    freshness: fresh ? 'fresh' : observedAt ? 'stale_or_invalid' : 'missing',
    timeOfDay,
    timeZone,
    trafficDensityVehPerKm,
    queueLengthVehicles,
    visibilityKm,
    rainIntensityMmph,
    modelConfidence,
    trackingConfidence,
    sceneChanged: boolean('sceneChanged', ['scene_changed']),
    incidentActive: boolean('incidentActive', ['incident_active']),
    eventAffected,
    cpuUtilizationPct,
    memoryPressurePct,
    workQueueLength,
    invalidInputs: [...new Set(invalidInputs)],
    missingInputs
  };
}

let lastModeTransitionAt = 0;
let lastStableMode = 'NORMAL';
let latestWorkloadDecision = null;

export function evaluateWorkload(event = {}, now = Date.now()) {
  const context = normalizedContext(event, now);
  const eventType = normalizedToken(event.eventType || event.event_type || event.type);
  const detection = event.detection && typeof event.detection === 'object' ? event.detection : {};
  const detectionLabel = normalizedToken(detection.class || detection.type || detection.label);
  const emergency = /ACCIDENT|COLLISION|CRASH|EMERGENCY|AMBULANCE|LIFE_THREATENING/.test(
    `${eventType}_${detectionLabel}`
  );
  const explicitIncident = context.freshness === 'fresh'
    && (context.incidentActive === true || context.sceneChanged === true);
  const trafficDemand = context.freshness === 'fresh'
    && ((context.trafficDensityVehPerKm ?? 0) >= 35 || (context.queueLengthVehicles ?? 0) >= 12);
  const peakDemand = trafficDemand
    && ['MORNING_PEAK', 'EVENING_PEAK'].includes(context.timeOfDay);
  const visibilityRisk = context.freshness === 'fresh'
    && context.visibilityKm !== null
    && context.visibilityKm <= 2;
  const rainRisk = context.freshness === 'fresh'
    && context.rainIntensityMmph !== null
    && context.rainIntensityMmph >= 5;
  const uncertainty = context.freshness === 'fresh'
    && [context.modelConfidence, context.trackingConfidence]
      .some((confidence) => confidence !== null && confidence < 0.65);
  const resourcePressure = context.freshness === 'fresh'
    && [context.cpuUtilizationPct, context.memoryPressurePct]
      .some((pressure) => pressure !== null && pressure >= 90);
  const severity = normalizedToken(detection.severity || event.severity);
  const roadHazard = /POTHOLE|WATERLOGGING|BLOCKAGE|ROAD_HAZARD|CRACK/.test(
    `${eventType}_${detectionLabel}`
  );
  const affectedEventWithDemand = context.eventAffected && trafficDemand;

  let mode = 'NORMAL';
  const reasons = [];
  if (emergency) {
    mode = 'EMERGENCY';
    reasons.push('Emergency/accident signal detected; mandatory safety work remains active.');
  } else if (
    explicitIncident
    || trafficDemand
    || visibilityRisk
    || rainRisk
    || uncertainty
    || roadHazard
    || ['HIGH', 'CRITICAL'].includes(severity)
    || affectedEventWithDemand
  ) {
    mode = 'ELEVATED';
    if (explicitIncident) reasons.push('A fresh scene-change or incident signal requires escalation.');
    if (trafficDemand) reasons.push('Fresh traffic density or queue measurements exceed the demand threshold.');
    if (peakDemand) reasons.push('Peak-hour increase is applied only because measured local traffic demand is high.');
    if (visibilityRisk || rainRisk) reasons.push('Fresh visibility or rainfall measurements indicate hazardous conditions.');
    if (uncertainty) reasons.push('Low model/tracking confidence requests additional verification; confidence is not treated as proof.');
    if (roadHazard) reasons.push('Road-hazard events receive elevated validation priority.');
    if (['HIGH', 'CRITICAL'].includes(severity)) reasons.push(`${severity} event severity requests faster verification.`);
    if (affectedEventWithDemand) reasons.push('A local event is affected and traffic demand is elevated in the same area.');
  } else if (
    context.freshness === 'fresh'
    && context.trafficDensityVehPerKm !== null
    && context.trafficDensityVehPerKm <= 10
    && context.queueLengthVehicles !== null
    && context.queueLengthVehicles <= 3
    && context.sceneChanged === false
    && context.incidentActive === false
  ) {
    mode = 'STABLE';
    reasons.push('Fresh low-demand measurements and explicit stable-scene signals permit slower sampling.');
  } else {
    reasons.push(
      context.freshness === 'fresh'
        ? 'No combined demand or risk trigger; retain the normal safety cadence.'
        : 'Context is missing or stale; ignore it and retain the normal safety cadence.'
    );
  }

  const modeSinceMs = now - lastModeTransitionAt;
  if (
    mode !== 'EMERGENCY'
    && mode !== lastStableMode
    && lastModeTransitionAt > 0
    && modeSinceMs < WORKLOAD_LIMITS.cooldownMs
  ) {
    const requestedMode = mode;
    mode = lastStableMode;
    reasons.push(`Mode transition held for cooldown (${WORKLOAD_LIMITS.cooldownMs}ms); pending ${requestedMode}.`);
  } else if (mode !== lastStableMode) {
    lastStableMode = mode;
    lastModeTransitionAt = now;
  }

  const requestedIntervalMs = mode === 'EMERGENCY'
    ? WORKLOAD_LIMITS.emergencyIntervalMs
    : mode === 'ELEVATED'
      ? WORKLOAD_LIMITS.elevatedIntervalMs
      : mode === 'STABLE'
        ? WORKLOAD_LIMITS.stableIntervalMs
        : WORKLOAD_LIMITS.normalIntervalMs;
  const intervalMs = Math.min(
    WORKLOAD_LIMITS.maximumDetectionDelayMs,
    Math.max(WORKLOAD_LIMITS.minimumIntervalMs, requestedIntervalMs)
  );
  if (resourcePressure) {
    reasons.push('Host resource pressure is high; work is visible for scheduling, but safety monitoring is not suppressed.');
  }

  return {
    mode,
    priority: mode === 'EMERGENCY' ? 'CRITICAL' : mode === 'ELEVATED' ? 'HIGH' : 'NORMAL',
    escalated: mode === 'EMERGENCY' || mode === 'ELEVATED',
    reasons,
    context,
    sampling: {
      intervalMs,
      minimumIntervalMs: WORKLOAD_LIMITS.minimumIntervalMs,
      maximumDetectionDelayMs: WORKLOAD_LIMITS.maximumDetectionDelayMs,
      mandatorySafetyMonitoring: true
    },
    resourcePressure
  };
}

export function recordWorkloadDecision(
  event,
  workload,
  requestedFeature,
  allocation = null,
  execution = null
) {
  const executionTrace = Array.isArray(execution?.executionTrace)
    ? execution.executionTrace.slice(0, 100).map((entry) => ({
        agent: entry.agent,
        stage: entry.stage,
        status: entry.status,
        reason: entry.reason || null,
        durationMs: Number.isFinite(entry.durationMs) ? entry.durationMs : 0,
        errorCode: entry.errorCode || null,
        error: entry.error || null
      }))
    : [];
  latestWorkloadDecision = {
    occurredAt: latestWorkloadDecision?.eventId && latestWorkloadDecision.eventId === event.eventId
      ? latestWorkloadDecision.occurredAt
      : new Date().toISOString(),
    eventId: event.eventId || null,
    requestedFeature: requestedFeature || null,
    selectedAgents: allocation?.selectedAgents || [],
    activationReasons: allocation?.activationReasons || {},
    skippedAgents: allocation?.skippedAgents || [],
    workflowStatus: execution?.status || 'PLANNED',
    actualAgents: execution?.actualAgents || [],
    executionCount: execution?.executionCount || 0,
    successfulExecutionCount: execution?.successfulExecutionCount || 0,
    executionTrace,
    modelUsage: execution?.modelUsage || [],
    measurements: execution?.measurements || null,
    mode: workload.mode,
    priority: workload.priority,
    escalated: workload.escalated,
    reasons: workload.reasons,
    context: workload.context,
    sampling: workload.sampling,
    resourcePressure: workload.resourcePressure
  };
}

export function getLatestWorkloadDecision() {
  return latestWorkloadDecision ? { ...latestWorkloadDecision } : null;
}

export function resetWorkloadPolicyState() {
  lastModeTransitionAt = 0;
  lastStableMode = 'NORMAL';
  latestWorkloadDecision = null;
}
