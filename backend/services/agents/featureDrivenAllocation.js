import { AGENT_REGISTRY, FEATURE_AGENT_POLICY } from './AgentRegistry.js';

const EVENT_FEATURES = new Map([
  ['ROUTE', 'route_request'],
  ['ROUTE_REQUEST', 'route_request'],
  ['ROUTE_PLANNING_REQUEST', 'route_request'],
  ['ROUTE_OPTIMIZATION_REQUEST', 'route_request'],
  ['POTHOLE', 'pothole_report'],
  ['POTHOLE_REPORT', 'pothole_report'],
  ['POTHOLE_DETECTED', 'pothole_report'],
  ['CRACK_DETECTED', 'pothole_report'],
  ['TREE_DETECTED', 'pothole_report'],
  ['PARKING', 'parking_request'],
  ['PARKING_REQUEST', 'parking_request'],
  ['PARKING_AVAILABILITY_REQUEST', 'parking_request'],
  ['ACCIDENT', 'accident_response'],
  ['ACCIDENT_DETECTED', 'accident_response'],
  ['HAZARD_DETECTED', 'accident_response'],
  ['EMERGENCY', 'emergency_route'],
  ['EMERGENCY_VEHICLE', 'emergency_route'],
  ['WATERLOGGING_DETECTED', 'waterlogging_response'],
  ['ROAD_BLOCKAGE', 'waterlogging_response'],
  ['ENCROACHMENT_DETECTED', 'encroachment_report'],
  ['HAWKER_DETECTED', 'encroachment_report'],
  ['STREET_VENDOR_DETECTED', 'encroachment_report'],
  ['ILLEGAL_PARKING', 'illegal_parking_response'],
  ['HELMET_VIOLATION', 'violation_review'],
  ['OVERSPEEDING', 'violation_review'],
  ['RASH_DRIVING', 'violation_review'],
  ['SIGNAL_VIOLATION', 'violation_review'],
  ['TRAFFIC_CONGESTION', 'traffic_analysis'],
  ['TRAFFIC_ANALYSIS_REQUEST', 'traffic_analysis']
]);

const normalizeFeature = (value) => String(value || '')
  .trim()
  .replace(/[\s-]+/g, '_')
  .toUpperCase();

function inferFeature(event) {
  const eventType = normalizeFeature(event.eventType || event.event_type || event.type);
  const explicit = normalizeFeature(event.requestedFeature || event.feature);

  // Event evidence takes precedence over user preference for safety-critical work.
  const issueLabel = normalizeFeature(
    event.detection?.class || event.detection?.type || event.issueType
  );
  if (
    ['ACCIDENT_DETECTED', 'HAZARD_DETECTED'].includes(eventType)
    || /ACCIDENT|COLLISION|VEHICLE_CRASH/.test(issueLabel)
  ) return 'accident_response';
  if (eventType === 'EMERGENCY_VEHICLE' || eventType === 'EMERGENCY') return 'emergency_route';
  if (eventType === 'WATERLOGGING_DETECTED' && (event.detection?.roadBlocked || event.detection?.blocksRoad)) {
    return 'waterlogging_response';
  }

  const eventFeature = EVENT_FEATURES.get(eventType);
  if (eventFeature) return eventFeature;
  const explicitFeature = EVENT_FEATURES.get(explicit)
    || (Object.hasOwn(FEATURE_AGENT_POLICY, explicit.toLowerCase()) ? explicit.toLowerCase() : null);
  if (explicitFeature) return explicitFeature;
  return EVENT_FEATURES.get(eventType) || 'unsupported';
}

export function planAgentAllocation(event = {}, options = {}) {
  const requestedFeature = inferFeature(event);
  const policy = FEATURE_AGENT_POLICY[requestedFeature] || FEATURE_AGENT_POLICY.unsupported;
  const availableAgents = new Set(
    options.availableAgents || Object.keys(AGENT_REGISTRY)
  );
  const exclusions = options.excludedAgents || event.disabledAgents || [];
  const excludedAgents = new Set(Array.isArray(exclusions) ? exclusions : []);
  const mandatoryAgents = new Set(policy.agents.filter((name) => (
    !AGENT_REGISTRY[name]?.optional
    || requestedFeature === 'accident_response'
    || requestedFeature === 'emergency_route'
    || (requestedFeature === 'waterlogging_response'
      && (event.detection?.roadBlocked || event.detection?.blocksRoad))
  )));
  const selectedAgents = [];
  const activationReasons = {};
  const dependencyFailures = [];

  for (const agentName of policy.agents) {
    const definition = AGENT_REGISTRY[agentName];
    if (!definition) {
      dependencyFailures.push({
        agent: agentName,
        reason: 'Agent is not defined in the existing agent registry.'
      });
      continue;
    }
    if (!availableAgents.has(agentName)) {
      dependencyFailures.push({
        agent: agentName,
        reason: 'Agent is registered in policy but is not available in this orchestrator.',
        mandatory: mandatoryAgents.has(agentName)
      });
      continue;
    }
    if (excludedAgents.has(agentName) && !mandatoryAgents.has(agentName)) continue;
    selectedAgents.push(agentName);
    activationReasons[agentName] = mandatoryAgents.has(agentName)
      ? `${policy.reasons[agentName]} Mandatory safety work cannot be disabled by request preferences.`
      : policy.reasons[agentName] || 'Selected by the requested feature policy.';
  }

  const conditionalAgents = [];
  if (selectedAgents.length) {
    conditionalAgents.push({
      agent: 'VerificationAgent',
      reason: 'Verify all specialist and follow-up outcomes after this workflow executes.',
      mandatory: true
    });
    conditionalAgents.push({
      agent: 'AuthorityCoordinationAgent',
      reason: 'Run only if a specialist produces a dispatchable complaint or traffic ticket.',
      mandatory: false
    });
    conditionalAgents.push({
      agent: 'EChallanAgent',
      reason: 'Run only if enforcement or encroachment returns a validated challan candidate.',
      mandatory: false
    });
    if (requestedFeature === 'accident_response') {
      conditionalAgents.push({
        agent: 'GreenCorridorAgent',
        reason: 'Run only if the emergency specialist confirms ambulance routing is required.',
        mandatory: true
      });
    }
  }

  const skippedAgents = Object.keys(AGENT_REGISTRY)
    .filter((name) => !selectedAgents.includes(name) && !conditionalAgents.some((item) => item.agent === name))
    .map((agent) => ({
      agent,
      reason: excludedAgents.has(agent)
        ? 'Excluded by request preference; no mandatory safety rule requires it.'
        : requestedFeature === 'parking_request'
          ? 'Parking availability and booking use the existing parking domain service; no AI agent is registered for that operation.'
          : 'Not required by the requested feature.'
    }));

  const unavailableConditionals = conditionalAgents.filter((item) => !availableAgents.has(item.agent));
  for (const item of unavailableConditionals) {
    if (item.mandatory) {
      dependencyFailures.push({
        agent: item.agent,
        reason: `Conditional dependency is unavailable: ${item.reason}`,
        mandatory: true
      });
    } else {
      skippedAgents.push({
        agent: item.agent,
        reason: `Optional conditional agent is not registered: ${item.reason}`
      });
    }
  }

  return {
    requestedFeature,
    selectedAgents,
    mandatoryAgents: [...mandatoryAgents],
    conditionalAgents: conditionalAgents.filter((item) => availableAgents.has(item.agent)),
    skippedAgents,
    activationReasons,
    domainServices: [...policy.domainServices],
    dependencyFailures,
    priority: requestedFeature === 'accident_response' || requestedFeature === 'emergency_route'
      ? 'CRITICAL'
      : requestedFeature === 'pothole_report' || requestedFeature === 'waterlogging_response'
        ? 'HIGH'
        : 'NORMAL'
  };
}

export function getAgentRegistry(availableAgents = Object.keys(AGENT_REGISTRY)) {
  const available = new Set(availableAgents);
  return Object.entries(AGENT_REGISTRY).map(([id, definition]) => ({
    id,
    ...definition,
    registered: available.has(id)
  }));
}

export function featurePolicySummary() {
  return Object.entries(FEATURE_AGENT_POLICY).map(([feature, policy]) => ({
    feature,
    agents: [...policy.agents],
    domainServices: [...policy.domainServices]
  }));
}
