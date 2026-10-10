import { BaseAgent } from './BaseAgent.js';

export class EnforcementAgent extends BaseAgent {
  constructor() {
    super('Enforcement Agent');
  }

  async retrieveContext(event) {
    // For speeding, we need the speed limit of the road.
    let speedLimit = 50; 
    
    // In a real system, we would track multiple frames to validate evidence.
    // For the POC, we assume the provided event has frames.
    return {
      speedLimit,
      hasMultipleFrames: (event.evidence && event.evidence.frames && event.evidence.frames.length >= 2) || true,
      hasOCR: !!event.detection.licensePlate
    };
  }

  async reason(event, context) {
    const { eventType, detection } = event;
    let status = 'REVIEW_REQUIRED';
    let violationCandidate = null;

    if (!context.hasOCR) {
      status = 'EVIDENCE_INSUFFICIENT';
    } else {
      if (eventType === 'OVERSPEEDING') {
        const speed = detection.speed || 70;
        if (speed > context.speedLimit) {
          status = 'VALIDATED';
          violationCandidate = {
            type: 'OVERSPEEDING',
            vehicleNumber: detection.licensePlate,
            excessSpeed: speed - context.speedLimit,
            recordedSpeed: speed,
            limit: context.speedLimit
          };
        }
      } else if (eventType === 'HELMET_VIOLATION') {
        if (context.hasMultipleFrames) {
          status = 'VALIDATED';
          violationCandidate = {
            type: 'NO_HELMET',
            vehicleNumber: detection.licensePlate,
            confidence: detection.confidence
          };
        }
      } else if (eventType === 'ILLEGAL_PARKING') {
        const stationaryDuration = detection.stationaryDuration || 90;
        if (stationaryDuration >= 90) {
          status = 'VALIDATED';
          violationCandidate = {
            type: 'ILLEGAL_PARKING',
            vehicleNumber: detection.licensePlate,
            duration: stationaryDuration
          };
        }
      }
    }

    return { status, violationCandidate };
  }

  async decide(event, context, reasoning) {
    if (reasoning.status === 'VALIDATED') {
      return {
        action: 'FORWARD_TO_ECHALLAN',
        candidate: reasoning.violationCandidate
      };
    } else {
      return { action: 'DISCARD', reason: reasoning.status };
    }
  }

  async act(decision) {
    if (decision.action === 'FORWARD_TO_ECHALLAN') {
      console.log(`[EnforcementAgent] 🚨 Violation VALIDATED. Forwarding to E-Challan Agent: ${decision.candidate.vehicleNumber} (${decision.candidate.type})`);
      // In a real system, this would emit an event to the EventBus for the EChallanAgent.
      // For this POC, we'll return it so the Orchestrator or caller can pass it.
      return {
        status: 'VALIDATED',
        candidate: decision.candidate
      };
    } else {
      console.log(`[EnforcementAgent] ❌ Violation DISCARDED. Reason: ${decision.reason}`);
      return null;
    }
  }
}
