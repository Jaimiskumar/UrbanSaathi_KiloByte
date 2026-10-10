import { BaseAgent } from './BaseAgent.js';
import { MockDBService } from './MockDB.js';

export class CrowdSafetyAgent extends BaseAgent {
  constructor() {
    super('Crowd & Safety Agent');
  }

  async retrieveContext(event) {
    return {
      peopleCount: event.detection?.peopleCount || 500,
      areaSquareMeters: event.detection?.areaSquareMeters || 350,
      location: event.location
    };
  }

  async reason(event, context) {
    const density = context.peopleCount / context.areaSquareMeters; // people per sq meter
    
    let risk = 'LOW';
    if (density > 1.2) {
      risk = 'HIGH';
    } else if (density > 0.8) {
      risk = 'MEDIUM';
    }

    return {
      density: density.toFixed(2),
      risk,
      peopleCount: context.peopleCount,
      area: context.areaSquareMeters
    };
  }

  async decide(event, context, reasoning) {
    if (reasoning.risk === 'HIGH') {
      return {
        action: 'NOTIFY_PUBLIC_SAFETY',
        details: reasoning
      };
    }
    return { action: 'LOG_ONLY', details: reasoning };
  }

  async act(decision) {
    if (decision.action === 'NOTIFY_PUBLIC_SAFETY') {
      const { details } = decision;
      console.log(`\n=================================================`);
      console.log(`[CrowdSafetyAgent] 🚨 HIGH CROWD DENSITY DETECTED`);
      console.log(`Count: ${details.peopleCount} people`);
      console.log(`Density: ${details.density} people/m²`);
      console.log(`Action: Notified Public Safety Authority and Police.`);
      console.log(`=================================================\n`);
      return details;
    }
    return null;
  }
}
