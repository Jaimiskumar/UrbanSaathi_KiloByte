import { BaseAgent } from './BaseAgent.js';

export class TrafficAgent extends BaseAgent {
  constructor() {
    super('Traffic Management Agent');
  }

  async retrieveContext(event) {
    // In a real scenario, this fetches live traffic data for the intersection.
    // For the POC, we mock the intersection data if not provided in the event.
    return {
      intersectionId: event.location?.intersectionId || 'JUNC_A',
      currentSignals: { NS: 90, EW: 70 }, // Green light duration in seconds
      lanes: {
        NS: { vehicles: event.detection?.vehiclesNS || 142, queueLength: event.detection?.queueNS || 87, avgSpeed: 11 },
        EW: { vehicles: event.detection?.vehiclesEW || 34, queueLength: event.detection?.queueEW || 18, avgSpeed: 31 }
      }
    };
  }

  async reason(event, context) {
    const { NS, EW } = context.lanes;
    const { currentSignals } = context;

    // Calculate initial congestion score (0 to 1)
    const congestionBefore = Math.min((NS.queueLength + EW.queueLength) / 150, 1.0);

    let recommendedSignals = { ...currentSignals };
    let recommendationReason = 'No change needed.';

    // Very simple heuristic: give more green time to the lane with a longer queue
    if (NS.queueLength > EW.queueLength * 2) {
      recommendedSignals.NS = Math.min(currentSignals.NS + 35, 125);
      recommendedSignals.EW = Math.max(currentSignals.EW - 25, 45);
      recommendationReason = 'High congestion on North-South axis; redistributing green time.';
    } else if (EW.queueLength > NS.queueLength * 2) {
      recommendedSignals.EW = Math.min(currentSignals.EW + 35, 125);
      recommendedSignals.NS = Math.max(currentSignals.NS - 25, 45);
      recommendationReason = 'High congestion on East-West axis; redistributing green time.';
    }

    // Emergency Vehicle override
    if (event.eventType === 'EMERGENCY_VEHICLE' || event.eventType === 'ACCIDENT_DETECTED') {
      recommendedSignals.NS = 150; // Force open
      recommendedSignals.EW = 30;
      recommendationReason = 'EMERGENCY OVERRIDE: Holding NS Green for emergency response.';
    }

    // Simulated improvement
    const congestionAfter = Math.max(congestionBefore - 0.23, 0.1);
    const improvementPercent = Math.round(((congestionBefore - congestionAfter) / congestionBefore) * 100);

    return {
      congestionBefore,
      congestionAfter,
      improvementPercent,
      recommendedSignals,
      recommendationReason
    };
  }

  async decide(event, context, reasoning) {
    return {
      action: 'OPTIMIZE_SIGNAL',
      signalRecommendation: reasoning.recommendedSignals,
      metrics: {
        before: reasoning.congestionBefore.toFixed(2),
        after: reasoning.congestionAfter.toFixed(2),
        improvement: `${reasoning.improvementPercent}%`
      },
      reason: reasoning.recommendationReason
    };
  }

  async act(decision) {
    if (decision.action === 'OPTIMIZE_SIGNAL') {
      console.log(`\n=================================================`);
      console.log(`[TrafficAgent] 🚦 SIGNAL TIMING OPTIMIZATION`);
      console.log(`Reason: ${decision.reason}`);
      console.log(`Simulated Changes: NS Green -> ${decision.signalRecommendation.NS}s, EW Green -> ${decision.signalRecommendation.EW}s`);
      console.log(`Expected Congestion Improvement: ${decision.metrics.improvement}`);
      console.log(`=================================================\n`);
      return decision;
    }
    return null;
  }
}
