import { BaseAgent } from './BaseAgent.js';

export class GreenCorridorAgent extends BaseAgent {
  constructor() {
    super('Emergency Routing / Green Corridor Agent');
  }

  async retrieveContext(event) {
    return {
      vehicleId: event.vehicleId || 'AMB-102',
      destination: event.destination || 'City Hospital',
      currentRoute: event.route?.length ? event.route : ['JUNC_A', 'JUNC_B', 'JUNC_C'],
      priority: event.priority || 'CRITICAL',
      eventId: event.eventId
    };
  }

  async reason(event, context) {
    const signalPlan = context.currentRoute.map((signalId, index) => ({
      signalId,
      sequenceOrder: index + 1,
      action: 'PREEMPT_GREEN',
      greenDurationSeconds: Math.max(30, 45 - index * 5),
      v2xMessage: `PRIORITY_GREEN:${context.vehicleId}:${signalId}`
    }));

    return {
      route: context.currentRoute,
      signalPlan,
      estimatedTimeSavedMinutes: Math.max(3, context.currentRoute.length * 2),
      priority: context.priority,
      destination: context.destination,
      eventId: context.eventId
    };
  }

  async decide(event, context, reasoning) {
    return {
      action: 'ESTABLISH_GREEN_CORRIDOR',
      route: reasoning.route,
      vehicle: context.vehicleId,
      destination: reasoning.destination,
      priority: reasoning.priority,
      signalPlan: reasoning.signalPlan,
      estimatedTimeSavedMinutes: reasoning.estimatedTimeSavedMinutes,
      corridorId: `V2X-${context.vehicleId}-${Date.now()}`
    };
  }

  async act(decision) {
    if (decision.action === 'ESTABLISH_GREEN_CORRIDOR') {
      console.log(`\n=================================================`);
      console.log(`[GreenCorridorAgent] 🟢 GREEN CORRIDOR ESTABLISHED`);
      console.log(`Vehicle: ${decision.vehicle}`);
      console.log(`Route: ${decision.route.join(' -> ')}`);
      console.log(`Destination: ${decision.destination}`);
      console.log(`Actions: Pre-empting ${decision.signalPlan.length} signals to GREEN.`);
      console.log(`=================================================\n`);
      return {
        ...decision,
        status: 'CORRIDOR_ACTIVE',
        v2xBroadcast: {
          messageType: 'EMERGENCY_PRIORITY_CORRIDOR',
          corridorId: decision.corridorId,
          vehicleId: decision.vehicle,
          priority: decision.priority,
          signalIds: decision.route,
          destination: decision.destination
        },
        activatedAt: new Date().toISOString()
      };
    }
    return { status: 'REVIEW_REQUIRED' };
  }
}
