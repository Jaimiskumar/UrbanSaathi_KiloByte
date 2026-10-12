import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { AGENT_REGISTRY } from './AgentRegistry.js';
import { planAgentAllocation } from './featureDrivenAllocation.js';
import {
  evaluateWorkload,
  recordWorkloadDecision
} from './contextAwareWorkload.js';

const AgentState = Annotation.Root({
  event: Annotation(),
  priority: Annotation(),
  targets: Annotation(),
  allocation: Annotation(),
  workload: Annotation(),
  executionTrace: Annotation(),
  startedAtMs: Annotation(),
  results: Annotation({ reducer: (left, right) => ({ ...left, ...right }), default: () => ({}) }),
  status: Annotation()
});

const priorityForEvent = (event, allocation) => {
  if (allocation.priority === 'CRITICAL') return 'CRITICAL';
  if (['ACCIDENT_DETECTED', 'HAZARD_DETECTED'].includes(event.eventType)) return 'CRITICAL';
  if (event.eventType === 'EMERGENCY_VEHICLE') return event.priority || 'CRITICAL';
  if (event.eventType === 'WATERLOGGING_DETECTED' || event.detection?.roadBlocked) return 'HIGH';
  if (
    event.detection?.severity === 'HIGH'
    || ['POTHOLE_DETECTED', 'OVERSPEEDING', 'HELMET_VIOLATION', 'RASH_DRIVING', 'SIGNAL_VIOLATION'].includes(event.eventType)
  ) return 'HIGH';
  return allocation.priority === 'HIGH' ? 'HIGH' : 'LOW';
};

const LEGACY_EVENT_TARGETS = Object.freeze({
  ENCROACHMENT_DETECTED: ['EncroachmentAgent', 'CivicAndRoadHealthAgent'],
  HAWKER_DETECTED: ['EncroachmentAgent', 'CivicAndRoadHealthAgent'],
  STREET_VENDOR_DETECTED: ['EncroachmentAgent', 'CivicAndRoadHealthAgent'],
  POTHOLE_DETECTED: ['CivicAndRoadHealthAgent'],
  CRACK_DETECTED: ['CivicAndRoadHealthAgent'],
  TREE_DETECTED: ['CivicAndRoadHealthAgent'],
  WATERLOGGING_DETECTED: ['CivicAndRoadHealthAgent', 'TrafficAgent'],
  ROAD_BLOCKAGE: ['CivicAndRoadHealthAgent', 'TrafficAgent'],
  ACCIDENT_DETECTED: ['AccidentEmergencyAgent', 'TrafficAgent'],
  HAZARD_DETECTED: ['AccidentEmergencyAgent', 'TrafficAgent'],
  EMERGENCY_VEHICLE: ['GreenCorridorAgent'],
  CROWD_DETECTED: ['CrowdSafetyAgent'],
  HELMET_VIOLATION: ['EnforcementAgent'],
  OVERSPEEDING: ['EnforcementAgent'],
  RASH_DRIVING: ['EnforcementAgent'],
  SIGNAL_VIOLATION: ['EnforcementAgent'],
  ILLEGAL_PARKING: ['EncroachmentAgent', 'EnforcementAgent'],
  TRAFFIC_CONGESTION: ['TrafficAgent'],
  TRAFFIC_ANALYSIS_REQUEST: ['TrafficAgent']
});

function traceSkippedAllocation(allocation) {
  return allocation.skippedAgents.map((item) => ({
    agent: item.agent,
    stage: 'allocation',
    status: 'SKIPPED',
    reason: item.reason,
    durationMs: 0
  }));
}

async function executeAgent(agentName, agents, event, executionTrace, reason, stage = 'specialist') {
  const definition = AGENT_REGISTRY[agentName];
  const agent = agents[agentName];
  if (!definition || !agent || typeof agent.processEvent !== 'function') {
    const error = !definition
      ? 'Agent is not declared in the agent registry.'
      : 'Agent implementation is not registered with the orchestrator.';
    executionTrace.push({
      agent: agentName,
      stage: 'allocation',
      status: 'ERROR',
      errorCode: 'AGENT_DEPENDENCY_UNAVAILABLE',
      error,
      reason,
      durationMs: 0
    });
    return {
      agent: agentName,
      eventId: event.eventId,
      status: 'ERROR',
      errorCode: 'AGENT_DEPENDENCY_UNAVAILABLE',
      error
    };
  }

  const startedAt = Date.now();
  let timeoutId;
  try {
    const result = await Promise.race([
      agent.processEvent(event),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const error = new Error(`${agentName} exceeded its ${definition.timeoutMs}ms timeout.`);
          error.code = 'AGENT_TIMEOUT';
          reject(error);
        }, definition.timeoutMs);
      })
    ]);
    const verificationFailed = agentName === 'VerificationAgent'
      && result?.actionResult?.status !== 'VERIFIED';
    const status = result?.status === 'SUCCESS' && !verificationFailed ? 'SUCCESS' : 'ERROR';
    const executionError = verificationFailed
      ? `Workflow verification failed for ${result?.actionResult?.failedCount || 0} agent(s).`
      : result?.error || null;
    executionTrace.push({
      agent: agentName,
      stage,
      status,
      reason,
      durationMs: Date.now() - startedAt,
      error: executionError
    });
    return status === 'SUCCESS'
      ? result
      : {
          ...result,
          status: 'ERROR',
          errorCode: verificationFailed ? 'WORKFLOW_VERIFICATION_FAILED' : 'AGENT_EXECUTION_FAILED',
          error: executionError
        };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    executionTrace.push({
      agent: agentName,
      stage,
      status: 'ERROR',
      errorCode: error?.code || 'AGENT_EXECUTION_FAILED',
      error: message,
      reason,
      durationMs: Date.now() - startedAt
    });
    console.error(`[AgentGraph] ${agentName} failed: ${message}`);
    return {
      agent: agentName,
      eventId: event.eventId,
      status: 'ERROR',
      errorCode: error?.code || 'AGENT_EXECUTION_FAILED',
      error: message
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function executeConditionalAgent(
  agentName,
  agents,
  event,
  executionTrace,
  reason,
  dependencyResults,
  stage = 'followup'
) {
  const unmetDependency = dependencyResults.find((dependency) => (
    !dependency.result || dependency.result.status !== 'SUCCESS'
  ));
  if (unmetDependency) {
    const error = `Dependency ${unmetDependency.agent} did not complete successfully.`;
    executionTrace.push({
      agent: agentName,
      stage: 'followup',
      status: 'BLOCKED',
      errorCode: 'AGENT_DEPENDENCY_FAILED',
      error,
      reason,
      durationMs: 0
    });
    return {
      agent: agentName,
      eventId: event.eventId,
      status: 'ERROR',
      errorCode: 'AGENT_DEPENDENCY_FAILED',
      error
    };
  }
  return executeAgent(agentName, agents, event, executionTrace, reason, stage);
}

function conditionalSkip(executionTrace, agent, reason) {
  executionTrace.push({
    agent,
    stage: 'followup',
    status: 'SKIPPED',
    reason,
    durationMs: 0
  });
}

export function createAgentGraph(agents) {
  const graph = new StateGraph(AgentState)
    .addNode('classify', async (state) => {
      const allocation = planAgentAllocation(state.event, {
        availableAgents: Object.keys(agents)
      });
      const workload = evaluateWorkload(state.event);
      recordWorkloadDecision(state.event, workload, allocation.requestedFeature, allocation);
      const priority = priorityForEvent(state.event, allocation);
      const skipped = traceSkippedAllocation(allocation);
      const missingMandatory = allocation.dependencyFailures.filter((failure) => failure.mandatory);
      for (const failure of allocation.dependencyFailures) {
        skipped.push({
          agent: failure.agent,
          stage: 'allocation',
          status: 'ERROR',
          errorCode: 'AGENT_DEPENDENCY_UNAVAILABLE',
          error: failure.reason,
          reason: failure.reason,
          durationMs: 0
        });
      }
      console.info(
        `[AgentGraph] ${state.event.eventId || 'unknown-event'} feature=${allocation.requestedFeature} priority=${priority} selected=${allocation.selectedAgents.join(',') || 'none'}`
      );
      return {
        allocation,
        workload,
        priority,
        targets: allocation.selectedAgents,
        executionTrace: skipped,
        startedAtMs: Date.now(),
        status: missingMandatory.length ? 'DEGRADED' : 'STARTED'
      };
    })
    .addNode('specialists', async (state) => {
      const executionTrace = [...state.executionTrace];
      const orderedTargets = [...state.targets].sort(
        (left, right) => (AGENT_REGISTRY[right]?.priority || 0) - (AGENT_REGISTRY[left]?.priority || 0)
      );
      const entries = await Promise.all(orderedTargets.map(async (name) => {
        const reason = state.allocation.activationReasons[name] || 'Selected by feature policy.';
        const result = await executeAgent(name, agents, {
          ...state.event,
          priority: state.priority
        }, executionTrace, reason);
        return [name, result];
      }));
      return {
        results: Object.fromEntries(entries),
        executionTrace
      };
    })
    .addNode('followups', async (state) => {
      const results = {};
      const executionTrace = [...state.executionTrace];
      const enforcement = state.results.EnforcementAgent?.actionResult;
      const encroachment = state.results.EncroachmentAgent?.actionResult;
      const challanCandidate = enforcement?.candidate
        ? { ...enforcement.candidate, dependencyAgent: 'EnforcementAgent' }
        : !enforcement?.candidate && encroachment?.violation
          ? {
              ...encroachment.violation,
              type: encroachment.violation.type,
              vehicleNumber: encroachment.violation.vehicleNumber || 'UNIDENTIFIED_VENDOR',
              dependencyAgent: 'EncroachmentAgent'
            }
          : null;

      if (challanCandidate && agents.EChallanAgent) {
        const dependencyAgent = challanCandidate.dependencyAgent;
        results.EChallanAgent = await executeConditionalAgent(
          'EChallanAgent',
          agents,
          { ...state.event, candidate: challanCandidate },
          executionTrace,
          'A validated violation candidate was produced.',
          [{ agent: dependencyAgent, result: state.results[dependencyAgent] }]
        );
      } else {
        conditionalSkip(
          executionTrace,
          'EChallanAgent',
          agents.EChallanAgent
            ? 'No validated violation candidate was produced.'
            : 'E-Challan agent implementation is not registered.'
        );
      }

      const emergency = state.results.AccidentEmergencyAgent?.actionResult;
      if (emergency?.needsAmbulance && agents.GreenCorridorAgent) {
        results.GreenCorridorAgent = await executeConditionalAgent(
          'GreenCorridorAgent',
          agents,
          {
            ...state.event,
            vehicleId: state.event.vehicleId || 'AMB-112',
            destination: state.event.destination || 'Nearest Trauma Centre'
          },
          executionTrace,
          'Emergency agent confirmed ambulance routing is required.',
          [{ agent: 'AccidentEmergencyAgent', result: state.results.AccidentEmergencyAgent }]
        );
      } else if (state.allocation.conditionalAgents.some((item) => item.agent === 'GreenCorridorAgent')) {
        conditionalSkip(
          executionTrace,
          'GreenCorridorAgent',
          'Emergency specialist did not request ambulance corridor activation.'
        );
      }

      if (state.results.CivicAndRoadHealthAgent?.actionResult) {
        agents.VerificationAgent?.track?.(state.results.CivicAndRoadHealthAgent.actionResult);
      }
      return { results, executionTrace };
    })
    .addNode('coordinate', async (state) => {
      const executionTrace = [...state.executionTrace];
      const coordination = agents.AuthorityCoordinationAgent;
      if (!coordination) {
        conditionalSkip(executionTrace, 'AuthorityCoordinationAgent', 'Agent implementation is not registered.');
        return { executionTrace };
      }
      const complaints = Object.values(state.results)
        .map((item) => item?.actionResult)
        .flatMap((action) => {
          if (!action) return [];
          if (action.complaint) return [action.complaint];
          if (action.analysis?.signalRecommendations?.length) {
            return [{
              complaintId: `TRAFFIC-${state.event.eventId}`,
              issue: 'TRAFFIC_CONTROL',
              authorityId: 'NOIDA_TRAFFIC_POLICE',
              department: 'Noida Traffic Police',
              priority: state.priority,
              slaHours: 4,
              status: 'OPEN'
            }];
          }
          return [];
        });
      if (!complaints.length) {
        conditionalSkip(executionTrace, 'AuthorityCoordinationAgent', 'No dispatchable complaint or traffic ticket was produced.');
        return { executionTrace };
      }

      const dependencyNames = Object.keys(state.results).filter((name) => (
        state.results[name]?.actionResult?.complaint
        || state.results[name]?.actionResult?.analysis?.signalRecommendations?.length
      ));
      const dependencyResults = dependencyNames.map((agent) => ({
        agent,
        result: state.results[agent]
      }));
      const result = await executeConditionalAgent(
        'AuthorityCoordinationAgent',
        agents,
        { ...state.event, complaints },
        executionTrace,
        'A specialist produced a dispatchable complaint or traffic ticket.',
        dependencyResults
      );
      return { results: { AuthorityCoordinationAgent: result }, executionTrace };
    })
    .addNode('verify', async (state) => {
      const executionTrace = [...state.executionTrace];
      if (!state.targets.length && !state.allocation.dependencyFailures.length) {
        conditionalSkip(executionTrace, 'VerificationAgent', 'No agent or domain-service workflow was activated.');
        return { executionTrace };
      }
      const verification = await executeConditionalAgent(
        'VerificationAgent',
        agents,
        {
          ...state.event,
          workflowResults: state.results,
          allocationFailures: state.allocation.dependencyFailures,
          executionTrace: state.executionTrace
        },
        executionTrace,
        'Final workflow verification is required for every activated agent workflow.',
        [],
        'verification'
      );
      return { results: { VerificationAgent: verification }, executionTrace };
    })
    .addNode('finalize', async (state) => {
      const failures = state.executionTrace.filter((entry) => (
        ['ERROR', 'BLOCKED'].includes(entry.status)
      ));
      const status = failures.length || state.status === 'DEGRADED' ? 'DEGRADED' : 'COMPLETED';
      const invokedAgents = state.executionTrace.filter((entry) => (
        ['specialist', 'followup', 'verification'].includes(entry.stage)
        && ['SUCCESS', 'ERROR'].includes(entry.status)
      ));
      const actualAgents = [...new Set(invokedAgents.map((entry) => entry.agent))];
      const followupInvocations = invokedAgents.filter((entry) => entry.stage === 'followup').length;
      const eventType = state.event.eventType || state.event.event_type || state.event.type;
      const legacyPrimaryTargets = (LEGACY_EVENT_TARGETS[eventType] || [])
        .filter((agentName) => typeof agents[agentName]?.processEvent === 'function');
      const legacyExpectedExecutions = legacyPrimaryTargets.length + 1 + followupInvocations;
      const allocation = {
        ...state.allocation,
        workload: state.workload,
        actualAgents,
        executionCount: invokedAgents.length,
        successfulExecutionCount: invokedAgents.filter((entry) => entry.status === 'SUCCESS').length,
        comparison: {
          baseline: 'Previous LangGraph target matrix plus unconditional verification and current conditional follow-ups.',
          legacyPrimaryAgents: legacyPrimaryTargets,
          legacyExpectedAgentExecutions: legacyExpectedExecutions,
          featureDrivenAgentExecutions: invokedAgents.length,
          executionReductionPercent: legacyExpectedExecutions
            ? 100 * (legacyExpectedExecutions - invokedAgents.length) / legacyExpectedExecutions
            : null,
          energyImpact: 'not-inferred-from-call-count'
        },
        modelUsage: state.event.source?.model
          ? [{
              model: state.event.source.model,
              precision: state.event.source.precision || 'not-reported-by-inference-source',
              runtime: state.event.source.runtime || 'not-reported-by-inference-source'
            }]
          : [],
        measurements: {
          totalLatencyMs: Date.now() - state.startedAtMs,
          sampling: state.workload.sampling,
          energy: {
            status: 'unavailable',
            reason: 'The Node agent graph has no per-task power telemetry or energy attribution.'
          }
        }
      };
      recordWorkloadDecision(
        state.event,
        state.workload,
        state.allocation.requestedFeature,
        allocation,
        {
          status,
          actualAgents,
          executionCount: allocation.executionCount,
          successfulExecutionCount: allocation.successfulExecutionCount,
          executionTrace: state.executionTrace,
          modelUsage: allocation.modelUsage,
          measurements: allocation.measurements
        }
      );
      return {
        status,
        allocation,
        executionTrace: state.executionTrace
      };
    })
    .addEdge(START, 'classify')
    .addEdge('classify', 'specialists')
    .addEdge('specialists', 'followups')
    .addEdge('followups', 'coordinate')
    .addEdge('coordinate', 'verify')
    .addEdge('verify', 'finalize')
    .addEdge('finalize', END);

  return graph.compile();
}

export async function runAgentGraph(agents, event) {
  return createAgentGraph(agents).invoke({
    event,
    results: {},
    executionTrace: [],
    status: 'STARTED'
  });
}
