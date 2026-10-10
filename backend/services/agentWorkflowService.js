import RoadIssue from '../models/RoadIssue.js';
import { eventBus } from './agents/index.js';
import { lookupRoad } from './roadIntelligenceService.js';
import { io } from '../server.js';

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
    events.push({
      eventType: type.eventType,
      location: { lat: Number(frame.latitude), lng: Number(frame.longitude) },
      detection: {
        class: label,
        confidence: detection.confidence,
        severity: detection.severity || (type.eventType === 'ACCIDENT_DETECTED' ? 'CRITICAL' : 'HIGH'),
        roadBlocked: Boolean(detection.roadBlocked || detection.blocksRoad)
      },
      source: { type: 'ML_MODEL', model: result.model?.name || 'vision-model' },
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
  return events;
}

export async function processAgentDetections(result, frame, userId) {
  const workflowRecords = [];
  for (const event of detectionsToEvents(result, frame)) {
    const { event: enrichedEvent, workflow } = await eventBus.publishAndWait(event);
    const civic = workflow.results?.CivicAndRoadHealthAgent?.actionResult;
    const authority = workflow.results?.AuthorityCoordinationAgent?.actionResult;
    const emergency = workflow.results?.AccidentEmergencyAgent?.actionResult;
    const issueData = civic || {
      issue: 'ACCIDENT',
      severity: emergency?.escalationLevel || 'CRITICAL',
      priority: workflow.priority,
      authorityId: 'BENGALURU_TRAFFIC_POLICE',
      department: 'Traffic Police and Emergency Response',
      status: 'OPEN'
    };
    const roadIntelligence = await lookupRoad({
      coordinates: { lat: event.location.lat, lng: event.location.lng },
      issueType: issueData.issue
    });
    const record = await RoadIssue.create({
      userId,
      issueType: canonicalIssue(event.detection.class).issueType,
      locationName: frame.location,
      coordinates: event.location,
      description: `${event.detection.class} detected by ${event.source.model}`,
      imageUrl: frame.imageUrl || '',
      status: 'Reported',
      roadIntelligence,
      priority: workflow.priority || issueData.priority || 'HIGH',
      riskScore: workflow.priority === 'CRITICAL' ? 95 : workflow.priority === 'HIGH' ? 75 : 40,
      aiRecommendation: `Responsible authority: ${issueData.department}. SLA: ${issueData.slaHours || 48} hours.`,
      source: frame.source || 'camera_ml',
      agentWorkflow: {
        eventId: event.eventId,
        selectedAgents: workflow.targets || [],
        completedAt: new Date(),
        status: workflow.status,
        authorityStatus: authority?.status || (event.eventType === 'ACCIDENT_DETECTED' ? 'EMERGENCY_ESCALATED' : 'PENDING'),
        authorityTicketId: authority?.complaintId,
        authorityId: authority?.authorityId || issueData.authorityId,
        department: authority?.department || issueData.department,
        slaHours: issueData.slaHours,
        mlConfidence: event.detection.confidence
      }
    });
    workflowRecords.push({ issue: record, workflow });
    io.emit('new-road-issue', { issueId: record._id, type: record.issueType, status: record.status, agentWorkflow: record.agentWorkflow });
  }
  return workflowRecords;
}