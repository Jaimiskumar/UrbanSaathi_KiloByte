import { BaseAgent } from './BaseAgent.js';

export class EChallanAgent extends BaseAgent {
  constructor() {
    super('E-Challan Agent');
  }

  async retrieveContext(event) {
    // Expecting the event to contain the validated candidate from EnforcementAgent
    return {
      candidate: event.candidate || null
    };
  }

  async reason(event, context) {
    if (!context.candidate) {
      return { status: 'INVALID_INPUT' };
    }
    
    // In real life, query RTO database to get owner details
    const ownerName = 'John Doe (Mock)';
    const fineAmount = context.candidate.type === 'OVERSPEEDING' ? 1000 : 500;
    
    return {
      status: 'READY_TO_ISSUE',
      challanDetails: {
        challanId: `CHLN-${Date.now()}`,
        violation: context.candidate.type,
        vehicleNumber: context.candidate.vehicleNumber,
        ownerName,
        fineAmount,
        issueDate: new Date().toISOString()
      }
    };
  }

  async decide(event, context, reasoning) {
    if (reasoning.status === 'READY_TO_ISSUE') {
      return {
        action: 'GENERATE_CHALLAN',
        challan: reasoning.challanDetails
      };
    }
    return { action: 'IGNORE' };
  }

  async act(decision) {
    if (decision.action === 'GENERATE_CHALLAN') {
      const { challan } = decision;
      console.log(`\n=================================================`);
      console.log(`[EChallanAgent] 📋 E-CHALLAN GENERATED`);
      console.log(`Challan ID: ${challan.challanId}`);
      console.log(`Vehicle: ${challan.vehicleNumber}`);
      console.log(`Violation: ${challan.violation}`);
      console.log(`Fine: ₹${challan.fineAmount}`);
      console.log(`=================================================\n`);
      return challan;
    }
    return null;
  }
}
