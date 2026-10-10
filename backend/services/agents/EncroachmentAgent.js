import { BaseAgent } from './BaseAgent.js';

const normalizeType = (event) => {
  const value = `${event.eventType || ''} ${event.detection?.class || ''} ${event.detection?.type || ''} ${event.detection?.violation || ''}`.toLowerCase();
  if (value.includes('parking')) return 'ILLEGAL_PARKING';
  if (value.includes('hawker')) return 'HAWKER';
  if (value.includes('vendor')) return 'STREET_VENDOR';
  return 'ENCROACHMENT';
};

export class EncroachmentAgent extends BaseAgent {
  constructor() {
    super('Encroachment Agent');
  }

  async retrieveContext(event) {
    const detection = event.detection || {};
    const confidence = Number(detection.confidence || 0);
    const hasEvidence = Boolean(event.evidence?.image || event.evidence?.frames?.length);
    const hasPlate = Boolean(detection.licensePlate || detection.plateNumber || detection.plate);
    return {
      violationType: normalizeType(event),
      confidence,
      hasEvidence,
      hasPlate,
      minimumConfidence: Number(process.env.ENCROACHMENT_AGENT_CONFIDENCE || 0.4),
      stationaryDuration: Number(detection.stationaryDuration || 0),
      blockagePercent: Number(detection.roadBlockagePercentage || detection.blockagePercent || 0)
    };
  }

  async reason(event, context) {
    if (!context.hasEvidence) {
      return { status: 'EVIDENCE_INSUFFICIENT', reason: 'Detection evidence image or frame is missing' };
    }
    if (context.confidence < context.minimumConfidence) {
      return { status: 'REVIEW_REQUIRED', reason: `Model confidence ${Math.round(context.confidence * 100)}% is below the ${Math.round(context.minimumConfidence * 100)}% threshold` };
    }
    if (context.violationType === 'ILLEGAL_PARKING' && (!context.hasPlate || context.stationaryDuration < 90)) {
      return { status: 'REVIEW_REQUIRED', reason: 'Illegal parking needs a readable plate and at least 90 seconds stationary evidence' };
    }

    return {
      status: 'VALIDATED',
      violationType: context.violationType,
      reason: context.violationType === 'ILLEGAL_PARKING'
        ? 'Plate, stationary-duration, and model evidence validated'
        : 'Vendor or hawker model evidence validated for civic enforcement',
      violation: {
        type: context.violationType,
        confidence: context.confidence,
        blockagePercent: context.blockagePercent,
        vehicleNumber: event.detection?.licensePlate || event.detection?.plateNumber || event.detection?.plate || null,
        location: event.location?.name || null
      }
    };
  }

  async decide(event, context, reasoning) {
    return reasoning.status === 'VALIDATED'
      ? { action: 'CREATE_ENCROACHMENT_VIOLATION', violation: reasoning.violation, reason: reasoning.reason }
      : { action: 'REVIEW', reason: reasoning.reason || reasoning.status };
  }

  async act(decision) {
    if (decision.action === 'CREATE_ENCROACHMENT_VIOLATION') {
      return {
        status: 'VALIDATED',
        violation: decision.violation,
        reason: decision.reason,
        authority: decision.violation.type === 'ILLEGAL_PARKING'
          ? 'Bengaluru Traffic Police'
          : 'BBMP Encroachment & Civic'
      };
    }
    return { status: decision.action === 'REVIEW' ? 'REVIEW_REQUIRED' : 'REJECTED', reason: decision.reason };
  }
}
