import { BaseAgent } from './BaseAgent.js';

export class AccidentEmergencyAgent extends BaseAgent {
  constructor() {
    super('Accident & Emergency Agent');
  }

  async retrieveContext(event) {
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      severity: String(event.detection?.severity || 'HIGH').toUpperCase(),
      roadBlocked: Boolean(event.detection?.roadBlocked || event.detection?.blocksRoad),
      involvesPedestrian: Boolean(event.detection?.involvesPedestrian || event.detection?.pedestrianInvolved),
      location: event.location || null
    };
  }

  async reason(event, context) {
    const isCritical = context.severity === 'CRITICAL' || context.roadBlocked || context.involvesPedestrian;
    return {
      eventId: context.eventId,
      eventType: context.eventType,
      escalationLevel: isCritical ? 'CRITICAL' : 'HIGH',
      needsAmbulance: true,
      needsPolice: true,
      needsTrafficDiversion: context.roadBlocked,
      responseChannels: ['AMBULANCE_112', 'BENGALURU_TRAFFIC_POLICE'],
      dispatchId: `EMR-${Date.now()}`,
      location: context.location,
      issue: 'ACCIDENT',
      authorityId: 'BENGALURU_TRAFFIC_POLICE',
      department: 'Traffic Police and Emergency Response',
      status: 'EMERGENCY_ESCALATED'
    };
  }

  async decide(event, context, reasoning) {
    return {
      action: 'ESCALATE_EMERGENCY',
      escalation: reasoning
    };
  }

  async act(decision) {
    if (decision.action === 'ESCALATE_EMERGENCY') {
      const e = decision.escalation;
      console.log(`\n=================================================`);
      console.log(`[AccidentEmergencyAgent] 🚑 EMERGENCY ESCALATION (${e.escalationLevel})`);
      if (e.needsAmbulance) console.log(`- Notifying Ambulance Services`);
      if (e.needsPolice) console.log(`- Notifying Police Department`);
      if (e.needsTrafficDiversion) console.log(`- Triggering Traffic Diversion (via TrafficAgent)`);
      console.log(`=================================================\n`);
      return {
        ...e,
        action: decision.action,
        dispatchedAt: new Date().toISOString()
      };
    }
    return { status: 'REVIEW_REQUIRED' };
  }
}
