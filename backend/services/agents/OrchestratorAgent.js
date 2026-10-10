import { BaseAgent } from './BaseAgent.js';
import { eventBus } from './EventBus.js';

class SmartHorizonOrchestrator extends BaseAgent {
  constructor() {
    super('Orchestrator Agent');
    this.agents = {};
    
    // Subscribe to new detections
    eventBus.on('NEW_DETECTION', this.handleNewEvent.bind(this));
  }

  registerAgents(agentsMap) {
    this.agents = agentsMap;
  }

  calculatePriority(event) {
    // Basic priority engine based on severity and type
    if (event.eventType === 'ACCIDENT_DETECTED') {
      return event.detection?.roadBlocked ? 'CRITICAL' : 'HIGH';
    }
    
    if (event.eventType === 'WATERLOGGING_DETECTED' && event.detection?.severity === 'HIGH') {
      return 'HIGH';
    }
    
    if (event.eventType === 'POTHOLE_DETECTED') {
      return event.detection?.severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
    }
    
    if (['HELMET_VIOLATION', 'OVERSPEEDING'].includes(event.eventType)) {
      return 'MEDIUM'; // Enforcement is routine
    }

    return 'LOW';
  }

  getRoutingMatrix(eventType) {
    const matrix = {
      'POTHOLE_DETECTED': ['CivicAndRoadHealthAgent'],
      'CRACK_DETECTED': ['CivicAndRoadHealthAgent'],
      'TREE_DETECTED': ['CivicAndRoadHealthAgent'],
      'WATERLOGGING_DETECTED': ['CivicAndRoadHealthAgent', 'TrafficAgent'],
      'ENCROACHMENT_DETECTED': ['CivicAndRoadHealthAgent'],
      'HAWKER_DETECTED': ['CivicAndRoadHealthAgent'],
      'ROAD_BLOCKAGE': ['CivicAndRoadHealthAgent', 'TrafficAgent'],
      'ACCIDENT_DETECTED': ['AccidentEmergencyAgent', 'TrafficAgent'],
      'HELMET_VIOLATION': ['EnforcementAgent'],
      'OVERSPEEDING': ['EnforcementAgent'],
      'RASH_DRIVING': ['EnforcementAgent'],
      'ILLEGAL_PARKING': ['EnforcementAgent'],
      'TRAFFIC_CONGESTION': ['TrafficAgent'],
      'EMERGENCY_VEHICLE': ['GreenCorridorAgent']
    };
    return matrix[eventType] || [];
  }

  async handleNewEvent(event) {
    console.log(`\n[Orchestrator] 🧠 Received ${event.eventType} (${event.eventId})`);
    
    // 1. Calculate Priority
    event.priority = this.calculatePriority(event);
    console.log(`[Orchestrator] Priority assessed as: ${event.priority}`);

    // 2. Determine target agents
    const targetAgentNames = this.getRoutingMatrix(event.eventType);
    
    if (targetAgentNames.length === 0) {
      console.log(`[Orchestrator] No routing defined for ${event.eventType}`);
      return;
    }

    console.log(`[Orchestrator] Routing to: ${targetAgentNames.join(', ')}`);

    // 3. Dispatch to agents
    const dispatchPromises = targetAgentNames.map(async (agentName) => {
      const agent = this.agents[agentName];
      if (agent) {
        return agent.processEvent(event);
      } else {
        console.warn(`[Orchestrator] Agent ${agentName} is not registered.`);
      }
    });

    const results = await Promise.all(dispatchPromises);
    console.log(`[Orchestrator] Completed orchestration for ${event.eventId}`);
    return results;
  }
}

export const orchestratorAgent = new SmartHorizonOrchestrator();
