import { BaseAgent } from './BaseAgent.js';
import { eventBus } from './EventBus.js';
import { runAgentGraph } from './AgentGraph.js';

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
      'POTHOLE_DETECTED': ['RoadHealthAgent'],
      'CRACK_DETECTED': ['RoadHealthAgent'],
      'TREE_DETECTED': ['CivicIssueAgent'],
      'WATERLOGGING_DETECTED': ['CivicIssueAgent', 'TrafficAgent'],
      'ENCROACHMENT_DETECTED': ['CivicIssueAgent'],
      'HAWKER_DETECTED': ['CivicIssueAgent'],
      'ROAD_BLOCKAGE': ['CivicIssueAgent', 'TrafficAgent'],
      'ACCIDENT_DETECTED': ['AccidentEmergencyAgent', 'TrafficAgent'],
      'CROWD_DETECTED': ['CrowdSafetyAgent'],
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
    
    const workflow = await runAgentGraph(this.agents, event);
    console.log(`[Orchestrator] Completed graph workflow for ${event.eventId}`);
    return workflow;
  }
}

export const orchestratorAgent = new SmartHorizonOrchestrator();
