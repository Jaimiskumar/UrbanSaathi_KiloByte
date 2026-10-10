import { BaseAgent } from './BaseAgent.js';
import TrafficSignal from '../../models/TrafficSignal.js';
import { UrbanFlowService } from '../urbanflowService.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

const levelForScore = (score) => {
  if (score >= 85) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
};

const asArea = (area = {}, fallbackName = 'Current Area') => ({
  area: area.area || area.areaName || area.zone || area.location || fallbackName,
  vehicleCount: Number(area.vehicleCount ?? area.vehicles ?? 0),
  averageSpeedKmh: Number(area.averageSpeedKmh ?? area.averageSpeed ?? area.avgSpeed ?? 0),
  queueLength: Number(area.queueLength ?? area.queue ?? 0),
  roadBlocked: Boolean(area.roadBlocked || area.blocksRoad || area.blockage),
  blockageSeverity: area.blockageSeverity || area.severity || 'LOW',
  signalId: area.signalId || area.intersectionId || null,
  signalStatus: area.signalStatus || area.currentSignal || 'unknown',
  trend: area.trend || area.forecastTrend || 'stable',
  incidentCount: Number(area.incidentCount ?? area.incidents ?? 0),
  lanes: Array.isArray(area.lanes) ? area.lanes : []
});

function calculateIntensity(area) {
  const densityScore = clamp(area.vehicleCount / 10, 0, 45);
  const queueScore = clamp(area.queueLength / 2, 0, 30);
  const speedScore = area.averageSpeedKmh > 0
    ? clamp((50 - area.averageSpeedKmh) * 0.7, 0, 20)
    : 0;
  const blockageScore = area.roadBlocked ? 15 : 0;
  const score = Math.round(clamp(densityScore + queueScore + speedScore + blockageScore, 0, 100));
  const trendAdjustment = area.trend === 'rising' || area.trend === 'HIGH' ? 12 : area.trend === 'falling' || area.trend === 'LOW' ? -8 : 0;
  const forecast15 = Math.round(clamp(score + trendAdjustment, 0, 100));
  const forecast30 = Math.round(clamp(score + trendAdjustment * 2, 0, 100));
  const causes = [];
  if (densityScore >= 25) causes.push('high vehicle density');
  if (queueScore >= 15) causes.push('long queue formation');
  if (speedScore >= 10) causes.push('low average speed');
  if (area.roadBlocked) causes.push('road blockage');
  if (area.incidentCount > 0) causes.push(`${area.incidentCount} active incident${area.incidentCount > 1 ? 's' : ''}`);
  if (!causes.length) causes.push('normal traffic flow');
  const riskScore = Math.round(clamp(score + (area.roadBlocked ? 10 : 0) + area.incidentCount * 5, 0, 100));

  return {
    ...area,
    intensityScore: score,
    intensityLevel: levelForScore(score),
    scoreBreakdown: {
      vehicleDensity: Math.round(densityScore),
      queuePressure: Math.round(queueScore),
      speedImpact: Math.round(speedScore),
      blockageImpact: blockageScore
    },
    primaryCauses: causes,
    risk: { score: riskScore, level: levelForScore(riskScore) },
    estimatedDelayMinutes: Math.round((area.queueLength * 2.5 + (area.roadBlocked ? 12 : 0)) / 60 * 10) / 10,
    estimatedThroughputVehiclesPerHour: Math.round(area.vehicleCount * clamp((area.averageSpeedKmh || 0) / 35, 0.2, 1.4)),
    forecast: {
      trend: trendAdjustment > 0 ? 'WORSENING' : trendAdjustment < 0 ? 'IMPROVING' : 'STABLE',
      intensity15Min: { score: forecast15, level: levelForScore(forecast15) },
      intensity30Min: { score: forecast30, level: levelForScore(forecast30) }
    },
    laneDiagnostics: area.lanes.length
      ? area.lanes.map((lane, index) => ({
        lane: lane.name || lane.id || `Lane ${index + 1}`,
        vehicleCount: Number(lane.vehicleCount ?? lane.vehicles ?? 0),
        averageSpeedKmh: Number(lane.averageSpeedKmh ?? lane.averageSpeed ?? 0),
        queueLength: Number(lane.queueLength ?? lane.queue ?? 0),
        status: levelForScore(clamp(Number(lane.queueLength ?? lane.queue ?? 0) + (50 - Number(lane.averageSpeedKmh ?? lane.averageSpeed ?? 50)), 0, 100))
      }))
      : [{
        lane: 'Area aggregate',
        vehicleCount: area.vehicleCount,
        averageSpeedKmh: area.averageSpeedKmh,
        queueLength: area.queueLength,
        status: levelForScore(score)
      }]
  };
}

function recommendTiming(signal, area) {
  const currentGreen = Number(signal?.timings?.green ?? signal?.greenDuration ?? 30);
  const currentCycle = Number(signal?.cycleDuration ?? currentGreen + 35);
  const adjustment = area.intensityScore >= 85 ? 20 : area.intensityScore >= 65 ? 12 : area.intensityScore >= 35 ? 5 : -5;
  const green = clamp(currentGreen + adjustment, 15, 120);
  const speed = clamp(area.averageSpeedKmh || 30, 10, 50);

  return {
    signalId: signal?.signalId || area.signalId,
    area: area.area,
    algorithm: 'adaptive_webster_scoot',
    currentGreenSeconds: currentGreen,
    recommendedGreenSeconds: green,
    cycleSeconds: clamp(currentCycle, 60, 180),
    offsetSeconds: Math.round(500 / (speed / 3.6)),
    confidence: Number((0.72 + Math.min(area.intensityScore, 100) / 400).toFixed(2)),
    reason: area.roadBlocked
      ? 'Protect the blocked approach and meter arriving traffic until clearance.'
      : `${area.intensityLevel} traffic intensity requires adaptive green allocation.`
  };
}

export class TrafficAgent extends BaseAgent {
  constructor() {
    super('Traffic Management Agent');
    this.urbanFlow = new UrbanFlowService();
  }

  async retrieveContext(event) {
    const location = event.location || {};
    const detection = event.detection || {};
    const fallbackArea = asArea({
      area: location.areaName || location.zone || location.name || location.intersectionId,
      vehicleCount: detection.vehicleCount ?? detection.vehicles ?? event.vehicleCount,
      averageSpeedKmh: detection.averageSpeedKmh ?? detection.averageSpeed ?? event.averageSpeed,
      queueLength: detection.queueLength ?? detection.queue,
      roadBlocked: detection.roadBlocked || event.eventType === 'ROAD_BLOCKAGE',
      blockageSeverity: detection.severity,
      signalId: location.signalId || location.intersectionId
    });
    const requestedAreas = event.areas || event.trafficAreas || detection.areas || [];
    const areas = (Array.isArray(requestedAreas) && requestedAreas.length
      ? requestedAreas.map((area) => asArea(area, fallbackArea.area))
      : [fallbackArea]);

    let signals = [];
    try {
      const query = {};
      const signalIds = [...new Set(areas.map((area) => area.signalId).filter(Boolean))];
      if (signalIds.length) query.signalId = { $in: signalIds.map((id) => String(id).toUpperCase()) };
      else if (location.zone) query.syncedZone = String(location.zone).toUpperCase();
      else if (location.name) query['location.name'] = new RegExp(location.name, 'i');
      signals = await TrafficSignal.find(query).limit(50).lean();
    } catch (error) {
      console.warn(`[TrafficAgent] Signal context unavailable: ${error.message}`);
    }

    return {
      area: location.areaName || location.zone || location.name || 'Bengaluru',
      areas,
      signals,
      currentTime: new Date().toISOString(),
      dataSource: signals.length ? 'traffic-signals-and-event-stream' : 'event-stream'
    };
  }

  async reason(event, context) {
    const intensityByArea = context.areas.map(calculateIntensity);
    const signalRecommendations = intensityByArea.map((area) => {
      const signal = context.signals.find((item) => item.signalId === area.signalId)
        || context.signals.find((item) => item.location?.name === area.area);
      return recommendTiming(signal, area);
    });
    const blockedAreas = intensityByArea.filter((area) => area.roadBlocked);
    const totalVehicles = intensityByArea.reduce((sum, area) => sum + area.vehicleCount, 0);
    const averageIntensity = intensityByArea.length
      ? Math.round(intensityByArea.reduce((sum, area) => sum + area.intensityScore, 0) / intensityByArea.length)
      : 0;
    const emergency = event.eventType === 'EMERGENCY_VEHICLE' || event.eventType === 'ACCIDENT_DETECTED';
    const rankedHotspots = [...intensityByArea]
      .sort((left, right) => right.intensityScore - left.intensityScore)
      .slice(0, 5)
      .map((area, index) => ({
        rank: index + 1,
        area: area.area,
        score: area.intensityScore,
        level: area.intensityLevel,
        primaryCause: area.primaryCauses[0]
      }));
    const averageSpeed = intensityByArea.length
      ? Math.round(intensityByArea.reduce((sum, area) => sum + area.averageSpeedKmh, 0) / intensityByArea.length * 10) / 10
      : 0;
    const totalQueue = intensityByArea.reduce((sum, area) => sum + area.queueLength, 0);

    return {
      overallIntensity: { score: averageIntensity, level: levelForScore(averageIntensity) },
      intensityByArea,
      totalVehicles,
      averageSpeedKmh: averageSpeed,
      totalQueueLength: totalQueue,
      rankedHotspots,
      networkSummary: {
        areaCount: intensityByArea.length,
        criticalAreas: intensityByArea.filter((area) => area.intensityLevel === 'CRITICAL').length,
        highRiskAreas: intensityByArea.filter((area) => area.risk.level === 'HIGH' || area.risk.level === 'CRITICAL').length,
        estimatedThroughputVehiclesPerHour: intensityByArea.reduce((sum, area) => sum + area.estimatedThroughputVehiclesPerHour, 0),
        dataFreshness: context.currentTime,
        dataSource: context.dataSource
      },
      blockedAreas,
      signalRecommendations: emergency
        ? signalRecommendations.map((recommendation) => ({ ...recommendation, emergencyPriority: true, recommendedGreenSeconds: 15 }))
        : signalRecommendations,
      vehicleAutomation: {
        mode: 'ADVISORY_ONLY',
        autonomousActuationBlocked: true,
        recommendedActions: blockedAreas.length
          ? ['reroute_connected_vehicles', 'broadcast_road_blockage', 'reduce_inflow_to_blocked_approach']
          : ['share_speed_advisory', 'coordinate_lane_flow', 'broadcast_signal_plan'],
        explanation: 'The agent can advise connected vehicles and coordinate signals, but cannot directly control vehicle steering or acceleration.'
      },
      optimization: {
        algorithm: 'LangGraph traffic analysis -> adaptive Webster/SCOOT plan',
        estimatedImprovementPercent: Math.min(35, Math.max(5, Math.round(averageIntensity * 0.25))),
        approvalRequired: !event.applySignalChanges,
        priorityOrder: rankedHotspots.map((hotspot) => hotspot.area)
      }
    };
  }

  async decide(event, context, reasoning) {
    return {
      action: 'ANALYZE_AND_OPTIMIZE_TRAFFIC',
      analysis: reasoning,
      applySignalChanges: Boolean(event.applySignalChanges),
      signalRecommendation: reasoning.signalRecommendations,
      metrics: {
        overallIntensity: reasoning.overallIntensity,
        areaCount: reasoning.intensityByArea.length,
        totalVehicles: reasoning.totalVehicles,
        blockedAreaCount: reasoning.blockedAreas.length
      }
    };
  }

  async act(decision) {
    const appliedSignals = [];
    if (decision.applySignalChanges) {
      for (const recommendation of decision.signalRecommendation) {
        if (!recommendation.signalId) continue;
        try {
          const signal = await TrafficSignal.findOne({ signalId: recommendation.signalId });
          if (!signal || signal.mode !== 'auto' || !signal.isActive) continue;
          signal.timings.green = recommendation.recommendedGreenSeconds;
          signal.currentTimer = recommendation.recommendedGreenSeconds;
          signal.lastUpdated = new Date();
          await signal.save();
          appliedSignals.push({ signalId: signal.signalId, greenSeconds: signal.timings.green });
        } catch (error) {
          console.warn(`[TrafficAgent] Could not apply signal ${recommendation.signalId}: ${error.message}`);
        }
      }
    }

    const blockedArea = decision.analysis.blockedAreas[0];
    let vehicleAdvisory = null;
    if (blockedArea) {
      vehicleAdvisory = await this.urbanFlow.broadcastHazard({
        hazard_type: 'ROAD_BLOCKAGE',
        zone: blockedArea.area,
        severity: blockedArea.blockageSeverity,
        vehicle_count: blockedArea.vehicleCount,
        recommended_action: 'REROUTE_AND_REDUCE_SPEED'
      });
    }

    return {
      ...decision,
      appliedSignals,
      vehicleAdvisory,
      status: decision.applySignalChanges ? 'OPTIMIZATION_APPLIED' : 'ANALYSIS_READY_FOR_APPROVAL'
    };
  }
}
