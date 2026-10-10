import { BaseAgent } from './BaseAgent.js';

export class AccidentEmergencyAgent extends BaseAgent {
  constructor() {
    super('Accident & Emergency Agent');
  }

  async retrieveContext(event) {
    return {
      severity: event.detection?.severity || 'HIGH',
      roadBlocked: event.detection?.roadBlocked || false,
      involvesPedestrian: event.detection?.involvesPedestrian || false
    };
  }

  async reason(event, context) {
    const isCritical = context.severity === 'CRITICAL' || context.roadBlocked || context.involvesPedestrian;
    return {
      escalationLevel: isCritical ? 'CRITICAL' : 'HIGH',
      needsAmbulance: true,
      needsPolice: true,
      needsTrafficDiversion: context.roadBlocked
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
      return e;
    }
    return null;
  }
}
