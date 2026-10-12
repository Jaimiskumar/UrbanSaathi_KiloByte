import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_REGISTRY } from '../services/agents/AgentRegistry.js';
import { runAgentGraph } from '../services/agents/AgentGraph.js';
import { SmartHorizonOrchestrator } from '../services/agents/OrchestratorAgent.js';
import { VerificationAgent } from '../services/agents/VerificationAgent.js';
import {
  getAgentRegistry,
  planAgentAllocation
} from '../services/agents/featureDrivenAllocation.js';

const successfulAgent = (name, actionResult = {}) => ({
  name,
  calls: 0,
  async processEvent(event) {
    this.calls += 1;
    return { agent: name, eventId: event.eventId, status: 'SUCCESS', actionResult };
  },
  track() {}
});

const verificationAgent = (status = 'VERIFIED') => ({
  calls: 0,
  async processEvent(event) {
    this.calls += 1;
    const failedAgents = Object.entries(event.workflowResults || {})
      .filter(([, result]) => result?.status !== 'SUCCESS')
      .map(([name]) => name);
    failedAgents.push(...(event.allocationFailures || []).map(({ agent }) => agent));
    failedAgents.push(...(event.executionTrace || [])
      .filter(({ status }) => ['ERROR', 'BLOCKED'].includes(status))
      .map(({ agent }) => agent));
    return {
      agent: 'VerificationAgent',
      eventId: event.eventId,
      status: 'SUCCESS',
      actionResult: {
        status: failedAgents.length ? 'FAILED' : status,
        failedCount: failedAgents.length,
        failedAgents
      }
    };
  },
  track() {}
});

const createAgentSet = (overrides = {}) => ({
  CivicAndRoadHealthAgent: successfulAgent('CivicAndRoadHealthAgent'),
  TrafficAgent: successfulAgent('TrafficAgent'),
  AuthorityCoordinationAgent: successfulAgent('AuthorityCoordinationAgent'),
  EnforcementAgent: successfulAgent('EnforcementAgent'),
  EncroachmentAgent: successfulAgent('EncroachmentAgent'),
  EChallanAgent: successfulAgent('EChallanAgent'),
  AccidentEmergencyAgent: successfulAgent('AccidentEmergencyAgent', { needsAmbulance: false }),
  GreenCorridorAgent: successfulAgent('GreenCorridorAgent'),
  VerificationAgent: verificationAgent(),
  ...overrides
});

test('route request selects traffic analysis and skips unrelated agents', () => {
  const plan = planAgentAllocation({
    requestedFeature: 'route',
    disabledAgents: ['EnforcementAgent']
  });

  assert.equal(plan.requestedFeature, 'route_request');
  assert.deepEqual(plan.selectedAgents, ['TrafficAgent']);
  assert.ok(plan.conditionalAgents.some(({ agent }) => agent === 'VerificationAgent'));
  assert.ok(plan.skippedAgents.some(({ agent }) => agent === 'EnforcementAgent'));
});

test('pothole reports select civic workflow and not unrelated enforcement', () => {
  const plan = planAgentAllocation({ eventType: 'POTHOLE_DETECTED' });

  assert.equal(plan.requestedFeature, 'pothole_report');
  assert.deepEqual(plan.selectedAgents, ['CivicAndRoadHealthAgent']);
  assert.ok(plan.skippedAgents.some(({ agent }) => agent === 'TrafficAgent'));
  assert.ok(plan.skippedAgents.some(({ agent }) => agent === 'EnforcementAgent'));
});

test('parking requests use existing parking domain services without running AI agents', () => {
  const plan = planAgentAllocation({ requestedFeature: 'parking_request' });

  assert.equal(plan.requestedFeature, 'parking_request');
  assert.deepEqual(plan.selectedAgents, []);
  assert.deepEqual(plan.domainServices, ['ParkingSpot', 'ParkingBooking']);
  assert.equal(plan.conditionalAgents.length, 0);
});

test('accident safety agents cannot be disabled by ordinary request preferences', () => {
  const plan = planAgentAllocation({
    eventType: 'ACCIDENT_DETECTED',
    requestedFeature: 'parking_request',
    disabledAgents: ['AccidentEmergencyAgent', 'TrafficAgent', 'VerificationAgent', 'GreenCorridorAgent']
  });

  assert.equal(plan.requestedFeature, 'accident_response');
  assert.deepEqual(plan.selectedAgents, ['AccidentEmergencyAgent', 'TrafficAgent']);
  assert.ok(plan.mandatoryAgents.includes('AccidentEmergencyAgent'));
  assert.ok(plan.mandatoryAgents.includes('TrafficAgent'));
  assert.ok(plan.conditionalAgents.some(({ agent, mandatory }) => (
    agent === 'VerificationAgent' && mandatory
  )));
  assert.ok(plan.conditionalAgents.some(({ agent, mandatory }) => (
    agent === 'GreenCorridorAgent' && mandatory
  )));
});

test('emergency routing keeps corridor and traffic safety agents mandatory', () => {
  const plan = planAgentAllocation({
    eventType: 'EMERGENCY_VEHICLE',
    disabledAgents: ['GreenCorridorAgent', 'TrafficAgent']
  });

  assert.deepEqual(plan.selectedAgents, ['GreenCorridorAgent', 'TrafficAgent']);
  assert.deepEqual(plan.mandatoryAgents, ['GreenCorridorAgent', 'TrafficAgent']);
});

test('critical pothole stays in civic workflow and does not launch accident response', () => {
  const plan = planAgentAllocation({
    eventType: 'POTHOLE_DETECTED',
    detection: { class: 'pothole', severity: 'CRITICAL' }
  });

  assert.equal(plan.requestedFeature, 'pothole_report');
  assert.deepEqual(plan.selectedAgents, ['CivicAndRoadHealthAgent']);
});

test('missing mandatory emergency dependency degrades the workflow explicitly', async () => {
  const agents = createAgentSet();
  delete agents.GreenCorridorAgent;

  const result = await runAgentGraph(agents, {
    eventId: 'emergency-dependency-test',
    eventType: 'EMERGENCY_VEHICLE',
    route: ['SIG001'],
    vehicleId: 'AMB-001'
  });

  assert.equal(result.status, 'DEGRADED');
  assert.ok(result.allocation.dependencyFailures.some(({ agent, mandatory }) => (
    agent === 'GreenCorridorAgent' && mandatory
  )));
  assert.ok(result.executionTrace.some((entry) => (
    entry.agent === 'GreenCorridorAgent' && entry.status === 'ERROR'
  )));
  assert.ok(!result.allocation.actualAgents.includes('GreenCorridorAgent'));
  assert.equal(result.results.VerificationAgent.actionResult.status, 'FAILED');
});

test('parking feature does not execute agents, and workflow latency is reported', async () => {
  const agents = createAgentSet();
  const result = await runAgentGraph(agents, {
    eventId: 'parking-request-test',
    requestedFeature: 'parking_request'
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.allocation.executionCount, 0);
  assert.deepEqual(result.allocation.actualAgents, []);
  assert.ok(result.allocation.measurements.totalLatencyMs >= 0);
  assert.equal(result.allocation.measurements.energy.status, 'unavailable');
  assert.equal(result.allocation.comparison.legacyExpectedAgentExecutions, 1);
  assert.equal(result.allocation.comparison.featureDrivenAgentExecutions, 0);
  assert.equal(result.allocation.comparison.executionReductionPercent, 100);
  assert.equal(result.allocation.comparison.energyImpact, 'not-inferred-from-call-count');
  assert.equal(agents.VerificationAgent.calls, 0);
});

test('pothole workflow runs one civic specialist and final verification', async () => {
  const agents = createAgentSet();
  const result = await runAgentGraph(agents, {
    eventId: 'pothole-report-test',
    eventType: 'POTHOLE_DETECTED',
    location: { lat: 28.5, lng: 77.3 },
    detection: { class: 'pothole', severity: 'HIGH', confidence: 0.9 }
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(agents.CivicAndRoadHealthAgent.calls, 1);
  assert.equal(agents.TrafficAgent.calls, 0);
  assert.equal(agents.VerificationAgent.calls, 1);
  assert.equal(result.allocation.executionCount, 2);
  assert.equal(result.allocation.comparison.legacyExpectedAgentExecutions, 2);
  assert.equal(result.allocation.comparison.executionReductionPercent, 0);
});

test('route requests add the missing traffic workflow and report the call-count tradeoff', async () => {
  const agents = createAgentSet();
  const result = await runAgentGraph(agents, {
    eventId: 'route-request-test',
    requestedFeature: 'route_request'
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(agents.TrafficAgent.calls, 1);
  assert.equal(agents.VerificationAgent.calls, 1);
  assert.equal(result.allocation.comparison.legacyExpectedAgentExecutions, 1);
  assert.equal(result.allocation.comparison.featureDrivenAgentExecutions, 2);
  assert.equal(result.allocation.comparison.executionReductionPercent, -100);
  assert.equal(result.allocation.comparison.energyImpact, 'not-inferred-from-call-count');
});

test('emergency graph runs mandatory actions plus verification and records model precision', async () => {
  const agents = createAgentSet();
  const result = await runAgentGraph(agents, {
    eventId: 'emergency-route-test',
    eventType: 'EMERGENCY_VEHICLE',
    vehicleId: 'AMB-001',
    route: ['SIG001'],
    source: { model: 'vehicle_detector', precision: 'fp16' }
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(agents.GreenCorridorAgent.calls, 1);
  assert.equal(agents.TrafficAgent.calls, 1);
  assert.equal(agents.VerificationAgent.calls, 1);
  assert.equal(result.allocation.comparison.legacyExpectedAgentExecutions, 2);
  assert.equal(result.allocation.comparison.featureDrivenAgentExecutions, 3);
  assert.equal(result.allocation.comparison.executionReductionPercent, -50);
  assert.deepEqual(result.allocation.modelUsage, [
    {
      model: 'vehicle_detector',
      precision: 'fp16',
      runtime: 'not-reported-by-inference-source'
    }
  ]);
});

test('failed dependencies block follow-up agents and verification reports failure', async () => {
  const agents = createAgentSet({
    EnforcementAgent: {
      async processEvent(event) {
        return {
          agent: 'EnforcementAgent',
          eventId: event.eventId,
          status: 'ERROR',
          actionResult: {
            candidate: { type: 'OVERSPEEDING', vehicleNumber: 'TEST-123' }
          }
        };
      }
    }
  });

  const result = await runAgentGraph(agents, {
    eventId: 'enforcement-dependency-test',
    eventType: 'OVERSPEEDING',
    detection: { speed: 80, licensePlate: 'TEST-123' },
    evidence: { image: 'evidence.jpg' }
  });

  assert.equal(agents.EChallanAgent.calls, 0);
  assert.equal(result.status, 'DEGRADED');
  assert.ok(result.executionTrace.some((entry) => (
    entry.agent === 'EChallanAgent' && entry.status === 'BLOCKED'
  )));
  assert.equal(result.results.VerificationAgent.actionResult.status, 'FAILED');
});

test('validated violation runs the challan follow-up once through its shared dependency', async () => {
  const agents = createAgentSet({
    EnforcementAgent: successfulAgent('EnforcementAgent', {
      candidate: { type: 'OVERSPEEDING', vehicleNumber: 'TEST-123' }
    })
  });

  const result = await runAgentGraph(agents, {
    eventId: 'validated-violation-test',
    eventType: 'OVERSPEEDING'
  });

  assert.equal(agents.EnforcementAgent.calls, 1);
  assert.equal(agents.EChallanAgent.calls, 1);
  assert.equal(result.executionTrace.filter(({ agent }) => agent === 'EChallanAgent').length, 1);
});

test('registry only reports agents implemented by the existing orchestrator', () => {
  const agents = createAgentSet();
  delete agents.GreenCorridorAgent;

  assert.equal(getAgentRegistry(Object.keys(agents)).length, Object.keys(AGENT_REGISTRY).length);
  assert.equal(
    getAgentRegistry(Object.keys(agents)).find(({ id }) => id === 'GreenCorridorAgent').registered,
    false
  );
  assert.ok(!Object.hasOwn(AGENT_REGISTRY, 'ParkingAgent'));
});

test('production verification marks missing mandatory dependencies as failed', async () => {
  const verification = new VerificationAgent();
  const result = await verification.processEvent({
    eventId: 'verify-missing-safety-agent',
    workflowResults: {
      TrafficAgent: { status: 'SUCCESS', actionResult: {} }
    },
    allocationFailures: [{
      agent: 'GreenCorridorAgent',
      mandatory: true,
      reason: 'Emergency route agent is unavailable.'
    }]
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.actionResult.status, 'FAILED');
  assert.ok(result.actionResult.failedAgents.includes('GreenCorridorAgent'));
});

test('duplicate in-flight event ids share work without caching completed safety outcomes', async () => {
  const orchestrator = new SmartHorizonOrchestrator();
  const trafficAgent = successfulAgent('TrafficAgent');
  trafficAgent.processEvent = async (event) => {
    trafficAgent.calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return { agent: 'TrafficAgent', eventId: event.eventId, status: 'SUCCESS', actionResult: {} };
  };
  orchestrator.registerAgents({
    TrafficAgent: trafficAgent,
    VerificationAgent: verificationAgent()
  });
  const event = { eventId: 'dedupe-traffic-event', eventType: 'TRAFFIC_CONGESTION' };

  const [first, duplicate] = await Promise.all([
    orchestrator.handleNewEvent(event),
    orchestrator.handleNewEvent(event)
  ]);

  assert.equal(trafficAgent.calls, 1);
  assert.equal(first.allocation.executionCount, duplicate.allocation.executionCount);
  await orchestrator.handleNewEvent(event);
  assert.equal(trafficAgent.calls, 2);
  assert.equal(orchestrator.inFlightEvents.size, 0);
});
