import { BaseAgent } from './BaseAgent.js';

export class EnforcementAgent extends BaseAgent {
  constructor() {
    super('Enforcement Agent');
  }

  async retrieveContext(event) {
    const speedLimit = Number(event.detection?.speedLimit || 50);
    const frames = event.evidence?.frames || [];
    return {
      speedLimit,
      hasEvidence: Boolean(event.evidence?.image || frames.length),
      hasMultipleFrames: frames.length >= 2,
      hasOCR: Boolean(event.detection?.licensePlate)
    };
  }

  async reason(event, context) {
    const { eventType, detection } = event;
    let status = 'REVIEW_REQUIRED';
    let violationCandidate = null;

    if (!context.hasEvidence || !context.hasOCR) {
      status = 'EVIDENCE_INSUFFICIENT';
    } else {
      if (eventType === 'OVERSPEEDING') {
        const speed = Number(detection.speed || 0);
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
        if (context.hasMultipleFrames || detection.confidence >= 0.2) {
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
      } else if (eventType === 'SIGNAL_VIOLATION') {
        status = 'VALIDATED';
        violationCandidate = {
          type: 'SIGNAL_BREAKING',
          vehicleNumber: detection.licensePlate,
          confidence: detection.confidence
        };
      } else if (eventType === 'RASH_DRIVING') {
        const speed = Number(detection.speed || 0);
        if (speed > context.speedLimit) {
          status = 'VALIDATED';
          violationCandidate = {
            type: 'RASH_DRIVING',
            vehicleNumber: detection.licensePlate,
            recordedSpeed: speed,
            limit: context.speedLimit,
            excessSpeed: speed - context.speedLimit
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
        candidate: decision.candidate,
        reason: 'Model evidence, OCR identity, and violation rule validated'
      };
    } else {
      console.log(`[EnforcementAgent] ❌ Violation DISCARDED. Reason: ${decision.reason}`);
      return { status: decision.reason || 'REVIEW_REQUIRED', reason: decision.reason, candidate: null };
    }
  }
}
