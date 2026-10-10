import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

const AgentState = Annotation.Root({
  event: Annotation(),
  priority: Annotation(),
  targets: Annotation(),
  results: Annotation({ reducer: (left, right) => ({ ...left, ...right }), default: () => ({}) }),
  status: Annotation()
});

const routeForEvent = (event) => {
  const type = event.eventType;
  if (['POTHOLE_DETECTED', 'CRACK_DETECTED', 'TREE_DETECTED', 'WATERLOGGING_DETECTED', 'ENCROACHMENT_DETECTED', 'HAWKER_DETECTED'].includes(type)) {
    return ['CivicAndRoadHealthAgent'];
  }
  if (['ACCIDENT_DETECTED'].includes(type)) return ['AccidentEmergencyAgent', 'TrafficAgent'];
  if (['EMERGENCY_VEHICLE'].includes(type)) return ['GreenCorridorAgent'];
  if (['CROWD_DETECTED'].includes(type)) return ['CrowdSafetyAgent'];
  if (['HELMET_VIOLATION', 'OVERSPEEDING', 'RASH_DRIVING', 'ILLEGAL_PARKING'].includes(type)) return ['EnforcementAgent'];
  if (type === 'TRAFFIC_CONGESTION' || type === 'ROAD_BLOCKAGE') return ['TrafficAgent'];
  return [];
};

const priorityForEvent = (event) => {
  if (event.eventType === 'ACCIDENT_DETECTED' || event.detection?.severity === 'CRITICAL') return 'CRITICAL';
  if (event.eventType === 'WATERLOGGING_DETECTED' || event.detection?.roadBlocked) return 'HIGH';
  if (event.detection?.severity === 'HIGH' || ['POTHOLE_DETECTED', 'OVERSPEEDING', 'HELMET_VIOLATION'].includes(event.eventType)) return 'HIGH';
  return 'LOW';
};

export function createAgentGraph(agents) {
  const graph = new StateGraph(AgentState)
    .addNode('classify', async (state) => ({
      priority: priorityForEvent(state.event),
      targets: routeForEvent(state.event)
    }))
    .addNode('specialists', async (state) => {
      const results = {};
      await Promise.all(state.targets.map(async (name) => {
        const agent = agents[name];
        if (agent) results[name] = await agent.processEvent({ ...state.event, priority: state.priority });
      }));
      return { results };
    })
    .addNode('followups', async (state) => {
      const results = {};
      const enforcement = state.results.EnforcementAgent?.actionResult;
      if (enforcement?.candidate && agents.EChallanAgent) {
        results.EChallanAgent = await agents.EChallanAgent.processEvent({ ...state.event, ...enforcement });
      }

      const emergency = state.results.AccidentEmergencyAgent?.actionResult;
      if (emergency?.needsAmbulance && agents.GreenCorridorAgent) {
        results.GreenCorridorAgent = await agents.GreenCorridorAgent.processEvent({
          ...state.event,
          vehicleId: state.event.vehicleId || 'AMB-112',
          destination: state.event.destination || 'Nearest Trauma Centre'
        });
      }

      const civic = state.results.CivicAndRoadHealthAgent?.actionResult;
      if (civic && agents.VerificationAgent?.track) agents.VerificationAgent.track(civic);
      return { results };
    })
    .addNode('coordinate', async (state) => {
      const coordination = agents.AuthorityCoordinationAgent;
      const workOrder = Object.values(state.results).map((item) => item?.actionResult).find((item) => item?.authorityId || item?.department);
      if (!coordination || !workOrder) return {};
      return { results: { AuthorityCoordinationAgent: await coordination.processEvent({ ...state.event, complaint: workOrder }) } };
    })
    .addNode('verify', async (state) => {
      const verification = agents.VerificationAgent;
      if (!verification) return {};
      return { results: { VerificationAgent: await verification.processEvent({ ...state.event, workflowResults: state.results }) } };
    })
    .addNode('finalize', async () => ({ status: 'COMPLETED' }))
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
  return createAgentGraph(agents).invoke({ event, results: {}, status: 'STARTED' });
}