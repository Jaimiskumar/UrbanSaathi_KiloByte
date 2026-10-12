import { BaseAgent } from './BaseAgent.js';
import { eventBus } from './EventBus.js';
import { runAgentGraph } from './AgentGraph.js';
import { getAgentRegistry, planAgentAllocation } from './featureDrivenAllocation.js';

export class SmartHorizonOrchestrator extends BaseAgent {
  constructor() {
    super('Orchestrator Agent');
    this.agents = {};
    this.inFlightEvents = new Map();
    
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
    return planAgentAllocation({ eventType }).selectedAgents;
  }

  planEvent(event, options = {}) {
    return planAgentAllocation(event, {
      ...options,
      availableAgents: Object.keys(this.agents)
    });
  }

  getAgentRegistry() {
    return getAgentRegistry(Object.keys(this.agents));
  }

  async handleNewEvent(event) {
    console.log(`\n[Orchestrator] 🧠 Received ${event.eventType} (${event.eventId})`);
    const eventKey = event.eventId ? String(event.eventId) : null;
    if (eventKey && this.inFlightEvents.has(eventKey)) {
      console.info(`[Orchestrator] Joining in-flight workflow for event ${eventKey}`);
      return this.inFlightEvents.get(eventKey);
    }

    const execution = Promise.resolve().then(() => runAgentGraph(this.agents, event));
    if (eventKey) this.inFlightEvents.set(eventKey, execution);
    let workflow;
    try {
      workflow = await execution;
    } finally {
      if (eventKey && this.inFlightEvents.get(eventKey) === execution) {
        this.inFlightEvents.delete(eventKey);
      }
    }
    console.log(
      `[Orchestrator] ${workflow.status} feature=${workflow.allocation.requestedFeature} `
      + `executions=${workflow.allocation.executionCount} event=${event.eventId}`
    );
    return workflow;
  }
}

export const orchestratorAgent = new SmartHorizonOrchestrator();
