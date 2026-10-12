import RoadIssue from '../models/RoadIssue.js';
import { eventBus } from './agents/index.js';
import { lookupRoad } from './roadIntelligenceService.js';
import { getSocketServer } from './socketServer.js';

const canonicalIssue = (label = '') => {
  const value = label.toLowerCase();
  if (value.includes('pothole')) return { eventType: 'POTHOLE_DETECTED', issueType: 'Pothole' };
  if (value.includes('water')) return { eventType: 'WATERLOGGING_DETECTED', issueType: 'Water Logging' };
  if (value.includes('tree')) return { eventType: 'TREE_DETECTED', issueType: 'Fallen Tree' };
  if (value.includes('encroach') || value.includes('hawker') || value.includes('vendor')) return { eventType: 'ENCROACHMENT_DETECTED', issueType: 'Encroachment' };
  if (value.includes('accident') || value.includes('collision')) return { eventType: 'ACCIDENT_DETECTED', issueType: 'Accident' };
  return null;
};

function detectionsToEvents(result, frame) {
  const events = [];
  const add = (label, detection = {}) => {
    const type = canonicalIssue(label);
    if (!type) return;
    const hasCoordinates = Number.isFinite(frame.latitude) && Number.isFinite(frame.longitude);
    events.push({
      eventType: type.eventType,
      location: {
        ...(hasCoordinates ? { lat: frame.latitude, lng: frame.longitude } : {}),
        ...(frame.location ? { name: frame.location } : {})
      },
      detection: {
        class: label,
        confidence: detection.confidence,
        severity: detection.severity || (type.eventType === 'ACCIDENT_DETECTED' ? 'CRITICAL' : 'HIGH'),
        roadBlocked: Boolean(detection.roadBlocked || detection.blocksRoad)
      },
      source: {
        type: 'ML_MODEL',
        model: result.model?.name || 'vision-model',
        precision: typeof result.model?.precision === 'string'
          ? result.model.precision
          : result.model?.selected_precision || null,
        runtime: result.model?.runtime || null
      },
      locationSource: frame.locationSource || null,
      context: frame.context || {},
      evidence: { image: frame.imageUrl },
      cameraId: frame.cameraId,
      timestamp: new Date()
    });
  };

  for (const item of result.potholes || []) add(item.label || 'pothole', item);
  const water = result.events?.water_logging || result.water_logging;
  if (!result.potholes?.length && water?.detected) add('waterlogging', water);
  if (result.fallen_tree?.label) add('fallen tree', result.fallen_tree);
  if (result.accident_detection?.accident_detected) add('accident', result.accident_detection.details || result.accident_detection);
  for (const item of result.urban_issues || []) add(item.label || item.class_name || item.type, item);
  if (result.hawkers?.hawkersDetected) add('hawker', result.hawkers);
  return events.filter((event, index, allEvents) => (
    allEvents.findIndex((candidate) => candidate.eventType === event.eventType) === index
  ));
}

export async function processAgentDetections(result, frame, userId) {
  const io = getSocketServer();
  const workflowRecords = [];
  for (const event of detectionsToEvents(result, frame)) {
    const { event: enrichedEvent, workflow } = await eventBus.publishAndWait(event);
    const civic = workflow.results?.CivicAndRoadHealthAgent?.actionResult;
    const authority = workflow.results?.AuthorityCoordinationAgent?.actionResult;
    const emergency = workflow.results?.AccidentEmergencyAgent?.actionResult;
    const isAccident = enrichedEvent.eventType === 'ACCIDENT_DETECTED';
    const issueData = civic || (isAccident ? {
      issue: 'ACCIDENT',
      severity: emergency?.escalationLevel || 'CRITICAL',
      priority: workflow.priority,
      authorityId: 'BENGALURU_TRAFFIC_POLICE',
      department: 'Traffic Police and Emergency Response',
      status: 'OPEN'
    } : {
      issue: String(enrichedEvent.detection.class || 'ROAD_HAZARD').toUpperCase(),
      severity: enrichedEvent.detection.severity || 'UNKNOWN',
      priority: workflow.priority || 'HIGH',
      status: 'NEEDS_REVIEW'
    });
    const aiRecommendation = issueData.department
      ? `Responsible authority: ${issueData.department}. SLA: ${issueData.slaHours || 48} hours.`
      : 'Automated triage did not complete; this report requires manual review.';
    const coordinates = enrichedEvent.location;
    if (!Number.isFinite(coordinates?.lat) || !Number.isFinite(coordinates?.lng)) {
      workflowRecords.push({
        issue: null,
        eventType: enrichedEvent.eventType,
        persistenceStatus: 'location_required',
        workflow
      });
      continue;
    }
    const roadIntelligence = await lookupRoad({
      coordinates: { lat: coordinates.lat, lng: coordinates.lng },
      issueType: issueData.issue
    });
    const record = await RoadIssue.create({
      userId,
      issueType: canonicalIssue(event.detection.class).issueType,
      locationName: frame.location,
      coordinates,
      description: `${event.detection.class} detected by ${event.source.model}`,
      imageUrl: frame.imageUrl || '',
      status: civic || (isAccident && emergency) ? 'Reported' : 'NeedsReview',
      roadIntelligence,
      priority: workflow.priority || issueData.priority || 'HIGH',
      riskScore: workflow.priority === 'CRITICAL' ? 95 : workflow.priority === 'HIGH' ? 75 : 40,
      aiRecommendation,
      source: frame.source || 'camera_ml',
      agentWorkflow: {
        eventId: event.eventId,
        selectedAgents: workflow.allocation?.actualAgents
          || [...new Set([...(workflow.targets || []), ...(authority ? ['AuthorityCoordinationAgent'] : [])])],
        allocation: workflow.allocation || null,
        executionTrace: workflow.executionTrace || [],
        measurements: workflow.allocation?.measurements || null,
        completedAt: new Date(),
        status: workflow.status,
        authorityStatus: authority?.status || (isAccident
          ? emergency?.status || 'NEEDS_REVIEW'
          : 'PENDING'),
        authorityTicketId: authority?.complaintId,
        authorityId: authority?.authorityId || issueData.authorityId,
        department: authority?.department || issueData.department,
        authorityJurisdiction: issueData.authorityJurisdiction,
        contractorName: issueData.contractorName,
        contractorId: issueData.contractorId,
        contractorContact: issueData.contractorContact,
        contractorPerformanceScore: issueData.contractorPerformanceScore,
        slaHours: issueData.slaHours,
        mlConfidence: event.detection.confidence,
        dispatches: authority?.dispatches || []
      }
    });
    workflowRecords.push({ issue: record, workflow });
    io.emit('new-road-issue', { issueId: record._id, type: record.issueType, status: record.status, agentWorkflow: record.agentWorkflow });
    if (authority?.dispatches?.length) {
      io.emit('complaint_ticket_created', {
        issueId: record._id,
        issueType: record.issueType,
        locationName: record.locationName,
        priority: record.priority,
        dispatches: authority.dispatches,
        agentWorkflow: record.agentWorkflow
      });
    }
  }
  return workflowRecords;
}