import { BaseAgent } from './BaseAgent.js';
import { createChallanFromViolation } from '../challanGenerationService.js';

export class EChallanAgent extends BaseAgent {
  constructor() {
    super('E-Challan Agent');
  }

  async retrieveContext(event) {
    return {
      candidate: event.candidate || null,
      event
    };
  }

  async reason(event, context) {
    if (!context.candidate) {
      return { status: 'INVALID_INPUT' };
    }

    const violationType = context.candidate.type;
    const fineAmount = {
      OVERSPEEDING: 1000,
      RASH_DRIVING: 1500,
      SIGNAL_BREAKING: 1000,
      ILLEGAL_PARKING: 1000,
      NO_HELMET: 500,
      STREET_VENDOR: 2000,
      HAWKER: 2000,
      ENCROACHMENT: 2000
    }[violationType] || 1000;
    
    return {
      status: 'READY_TO_ISSUE',
      violationType,
      fineAmount,
      legalSection: {
        OVERSPEEDING: 'Section 183(2), Motor Vehicles Act 1988 (Over-Speeding)',
        RASH_DRIVING: 'Section 184, Motor Vehicles Act 1988 (Dangerous/Rash Driving)',
        SIGNAL_BREAKING: 'Section 119/177, Motor Vehicles Act 1988 (Red Light Jumping)',
        ILLEGAL_PARKING: 'Section 122/177, Motor Vehicles Act 1988 (Illegal Parking / Obstruction)',
        NO_HELMET: 'Section 129, Motor Vehicles Act 1988 (No Helmet on 2-Wheeler)',
        STREET_VENDOR: 'Section 283 IPC / Municipal Encroachment Act',
        HAWKER: 'Section 283 IPC / Municipal Encroachment Act',
        ENCROACHMENT: 'Section 283 IPC / Municipal Encroachment Act'
      }[violationType] || 'Motor Vehicles Act 1988'
    };
  }

  async decide(event, context, reasoning) {
    if (reasoning.status === 'READY_TO_ISSUE') {
      return {
        action: 'GENERATE_CHALLAN',
        candidate: context.candidate,
        event,
        fineAmount: reasoning.fineAmount,
        legalSection: reasoning.legalSection,
        violationType: reasoning.violationType
      };
    }
    return { action: 'REVIEW_REQUIRED', reason: reasoning.status };
  }

  async act(decision) {
    if (decision.action === 'GENERATE_CHALLAN') {
      const { candidate, event } = decision;
      const challan = await createChallanFromViolation({
        ...candidate,
        vehicleNumber: candidate.vehicleNumber,
        violationType: decision.violationType,
        fineAmount: decision.fineAmount,
        legal_section: decision.legalSection,
        location: event.location?.name || event.location,
        latitude: event.location?.lat,
        longitude: event.location?.lng,
        timestamp: event.timestamp,
        cameraId: event.cameraId,
        imageUrl: event.evidence?.image || event.evidence?.frames?.[0]
      });

      const demoFallback = !challan && event.source?.type === 'AGENT_DEMO';
      if (!challan && !demoFallback) {
        throw new Error('E-Challan could not be persisted');
      }

      const fallbackNumber = `DEMO-CHN-${Date.now()}`;
      const ticket = challan || {
        challanNumber: fallbackNumber,
        violationType: decision.violationType,
        vehicleNumber: candidate.vehicleNumber,
        ownerName: 'Demo Vehicle Owner',
        ownerPhone: '+91 00000 00000',
        fineAmount: decision.fineAmount,
        legalSection: decision.legalSection,
        status: 'pending',
        paymentStatus: 'pending',
        violationDateTime: event.timestamp
      };

      const result = {
        challanNumber: ticket.challanNumber,
        challanId: ticket.challanNumber,
        violation: ticket.violationType,
        vehicleNumber: ticket.vehicleNumber,
        ownerName: ticket.ownerName,
        ownerPhone: ticket.ownerPhone,
        fineAmount: ticket.fineAmount,
        legalSection: ticket.legalSection,
        status: ticket.status,
        paymentStatus: ticket.paymentStatus,
        issueDate: ticket.violationDateTime,
        storage: demoFallback ? 'DEMO_MEMORY' : 'MONGODB'
      };
      console.log(`\n=================================================`);
      console.log(`[EChallanAgent] 📋 E-CHALLAN GENERATED`);
      console.log(`Challan ID: ${result.challanNumber}`);
      console.log(`Vehicle: ${result.vehicleNumber}`);
      console.log(`Violation: ${result.violation}`);
      console.log(`Fine: ₹${result.fineAmount}`);
      console.log(`=================================================\n`);
      return result;
    }
    return { status: decision.reason || 'REVIEW_REQUIRED' };
  }
}
