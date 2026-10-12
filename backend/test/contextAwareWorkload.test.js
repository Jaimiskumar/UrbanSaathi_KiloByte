import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateWorkload,
  getLatestWorkloadDecision,
  recordWorkloadDecision,
  resetWorkloadPolicyState,
  WORKLOAD_LIMITS
} from '../services/agents/contextAwareWorkload.js';
import { runAgentGraph } from '../services/agents/AgentGraph.js';

const now = Date.parse('2026-06-15T12:00:00.000Z');
const contextAt = (properties = {}, offsetMs = 0) => ({
  observedAt: new Date(now - offsetMs).toISOString(),
  ...properties
});

test('peak time raises sampling only when fresh local traffic demand is high', () => {
  resetWorkloadPolicyState();
  const highDemand = evaluateWorkload({
    eventType: 'TRAFFIC_ANALYSIS_REQUEST',
    context: contextAt({
      timeOfDay: 'EVENING_PEAK',
      trafficDensityVehPerKm: 50,
      queueLengthVehicles: 20
    })
  }, now);

  assert.equal(highDemand.mode, 'ELEVATED');
  assert.ok(highDemand.reasons.some((reason) => reason.includes('Peak-hour increase')));

  resetWorkloadPolicyState();
  const lowDemand = evaluateWorkload({
    eventType: 'TRAFFIC_ANALYSIS_REQUEST',
    context: contextAt({
      timeOfDay: 'EVENING_PEAK',
      trafficDensityVehPerKm: 8,
      queueLengthVehicles: 2,
      sceneChanged: false,
      incidentActive: false
    })
  }, now);

  assert.equal(lowDemand.mode, 'STABLE');
  assert.equal(lowDemand.sampling.intervalMs, WORKLOAD_LIMITS.stableIntervalMs);
});

test('stale and malformed context is excluded and falls back to the normal cadence', () => {
  resetWorkloadPolicyState();
  const workload = evaluateWorkload({
    eventType: 'TRAFFIC_ANALYSIS_REQUEST',
    context: contextAt({
      trafficDensityVehPerKm: 501,
      queueLengthVehicles: 30
    }, WORKLOAD_LIMITS.maximumContextAgeMs + 1)
  }, now);

  assert.equal(workload.mode, 'NORMAL');
  assert.equal(workload.context.freshness, 'stale_or_invalid');
  assert.equal(workload.context.trafficDensityVehPerKm, null);
  assert.ok(workload.context.invalidInputs.some((reason) => reason.includes('stale')));
  assert.equal(workload.sampling.intervalMs, WORKLOAD_LIMITS.normalIntervalMs);
});

test('accident escalation remains critical even with missing context or high resource pressure', () => {
  resetWorkloadPolicyState();
  const workload = evaluateWorkload({
    eventType: 'ACCIDENT_DETECTED',
    detection: { severity: 'CRITICAL' },
    context: contextAt({ cpuUtilizationPct: 98, memoryPressurePct: 97 })
  }, now);

  assert.equal(workload.mode, 'EMERGENCY');
  assert.equal(workload.priority, 'CRITICAL');
  assert.equal(workload.resourcePressure, true);
  assert.equal(workload.sampling.mandatorySafetyMonitoring, true);
  assert.ok(workload.sampling.intervalMs <= workload.sampling.maximumDetectionDelayMs);
});

test('low confidence, rain and visibility loss escalate only when context is fresh', () => {
  resetWorkloadPolicyState();
  const workload = evaluateWorkload({
    eventType: 'TRAFFIC_ANALYSIS_REQUEST',
    context: contextAt({
      modelConfidence: 0.3,
      visibilityKm: 1.5,
      rainIntensityMmph: 8
    })
  }, now);

  assert.equal(workload.mode, 'ELEVATED');
  assert.ok(workload.reasons.some((reason) => reason.includes('additional verification')));
  assert.ok(workload.reasons.some((reason) => reason.includes('visibility or rainfall')));
});

test('local event demand requires an affected location and does not raise city-wide load', () => {
  resetWorkloadPolicyState();
  const local = evaluateWorkload({
    eventType: 'TRAFFIC_ANALYSIS_REQUEST',
    location: { roadSegmentId: 'SEG-1' },
    context: contextAt({
      eventActive: true,
      affectedRoadSegmentId: 'SEG-1',
      trafficDensityVehPerKm: 40,
      queueLengthVehicles: 12
    })
  }, now);
  assert.ok(local.reasons.some((reason) => reason.includes('same area')));

  resetWorkloadPolicyState();
  const unrelated = evaluateWorkload({
    eventType: 'TRAFFIC_ANALYSIS_REQUEST',
    location: { roadSegmentId: 'SEG-1' },
    context: contextAt({
      eventActive: true,
      affectedRoadSegmentId: 'SEG-2',
      trafficDensityVehPerKm: 8,
      queueLengthVehicles: 2,
      sceneChanged: false,
      incidentActive: false
    })
  }, now);
  assert.equal(unrelated.mode, 'STABLE');
  assert.ok(!unrelated.reasons.some((reason) => reason.includes('same area')));
});

test('workload decision telemetry is observable without caching event payloads', () => {
  resetWorkloadPolicyState();
  const workload = evaluateWorkload({ eventType: 'POTHOLE_DETECTED' }, now);
  recordWorkloadDecision(
    { eventId: 'test-event', location: { lat: 1, lng: 2 }, eventType: 'POTHOLE_DETECTED' },
    workload,
    'pothole_report',
    {
      selectedAgents: ['CivicAndRoadHealthAgent'],
      activationReasons: { CivicAndRoadHealthAgent: 'Required for pothole triage.' },
      skippedAgents: []
    }
  );
  const latest = getLatestWorkloadDecision();

  assert.equal(latest.requestedFeature, 'pothole_report');
  assert.deepEqual(latest.selectedAgents, ['CivicAndRoadHealthAgent']);
  assert.equal(latest.location, undefined);
  assert.equal(latest.context.freshness, 'missing');
  assert.equal(latest.workflowStatus, 'PLANNED');
});

test('LangGraph includes the workload decision while retaining mandatory accident agents', async () => {
  resetWorkloadPolicyState();
  const called = [];
  const agent = (name, actionResult = {}) => ({
    async processEvent(event) {
      called.push(name);
      return { agent: name, eventId: event.eventId, status: 'SUCCESS', actionResult };
    },
    track() {}
  });
  const agents = {
    AccidentEmergencyAgent: agent('AccidentEmergencyAgent', { needsAmbulance: false }),
    GreenCorridorAgent: agent('GreenCorridorAgent'),
    TrafficAgent: agent('TrafficAgent'),
    VerificationAgent: agent('VerificationAgent', { status: 'VERIFIED', failedCount: 0 })
  };
  const workflow = await runAgentGraph(agents, {
    eventId: 'layer-three-accident',
    eventType: 'ACCIDENT_DETECTED',
    disabledAgents: ['AccidentEmergencyAgent', 'TrafficAgent'],
    detection: { severity: 'CRITICAL' },
    source: { model: 'vision-test-model', precision: 'int8', runtime: 'onnxruntime' }
  });

  assert.equal(workflow.workload.mode, 'EMERGENCY');
  assert.equal(workflow.allocation.workload.mode, 'EMERGENCY');
  assert.ok(workflow.workload.sampling.intervalMs <= WORKLOAD_LIMITS.maximumDetectionDelayMs);
  assert.ok(called.includes('AccidentEmergencyAgent'));
  assert.ok(called.includes('TrafficAgent'));
  const latest = getLatestWorkloadDecision();
  assert.equal(latest.workflowStatus, 'COMPLETED');
  assert.deepEqual(latest.actualAgents, workflow.allocation.actualAgents);
  assert.equal(latest.executionCount, workflow.allocation.executionCount);
  assert.ok(latest.executionTrace.some((entry) => entry.status === 'SUCCESS'));
  assert.deepEqual(latest.modelUsage, [{
    model: 'vision-test-model',
    precision: 'int8',
    runtime: 'onnxruntime'
  }]);
  assert.equal(latest.measurements.totalLatencyMs, workflow.allocation.measurements.totalLatencyMs);
});
