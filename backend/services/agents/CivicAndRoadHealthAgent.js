import { BaseAgent } from './BaseAgent.js';
import { MockDBService } from './MockDB.js';

const ROAD_ISSUES = new Set(['POTHOLE', 'CRACK', 'ROAD_DAMAGE', 'TREE', 'WATERLOGGING', 'ENCROACHMENT', 'HAWKER', 'VENDOR']);

export class CivicAndRoadHealthAgent extends BaseAgent {
  constructor() {
    super('CivicAndRoadHealthAgent');
  }

  async retrieveContext(event) {
    const issue = String(event.detection?.class || event.eventType || '').toUpperCase();
    const road = MockDBService.getRoadByLocation(event.location?.lat, event.location?.lng);
    const authority = MockDBService.getAuthorityForIssue(issue);
    const contractor = MockDBService.getContractorForZone(authority?.department, road?.zone);
    return { issue, road, authority, contractor };
  }

  async reason(event, context) {
    const { issue, road, authority, contractor } = context;
    const severity = String(event.detection?.severity || 'MEDIUM').toUpperCase();
    const blocksRoad = Boolean(event.detection?.blocksRoad || event.detection?.roadBlocked);
    const priority = severity === 'CRITICAL' || blocksRoad ? 'CRITICAL' : severity === 'HIGH' || road?.type === 'Arterial' ? 'HIGH' : 'MEDIUM';
    return {
      complaint: {
        complaintId: `COMP-${Date.now()}`,
        issue: issue || 'CIVIC_ISSUE',
        severity,
        priority,
        roadName: road?.name || 'Unknown Road',
        authorityId: authority?.authorityId || 'UNASSIGNED',
        department: authority?.department || 'BBMP Civic Operations',
        contractorId: contractor?.contractorId || 'UNASSIGNED',
        contractorName: contractor?.name || 'Unassigned',
        slaHours: contractor?.slaHours || authority?.slaHours || 48,
        requiresTrafficDiversion: blocksRoad || issue === 'WATERLOGGING',
        mlConfidence: event.detection?.confidence ?? null,
        detectedAt: event.timestamp,
        status: 'OPEN'
      }
    };
  }

  async decide(event, context, reasoning) {
    return ROAD_ISSUES.has(reasoning.complaint.issue)
      ? { action: 'CREATE_CIVIC_WORK_ORDER', complaint: reasoning.complaint }
      : { action: 'IGNORE', reason: 'Not a civic or road-health issue' };
  }

  async act(decision) {
    if (decision.action !== 'CREATE_CIVIC_WORK_ORDER') return null;
    return { ...decision.complaint, status: 'WORK_ORDER_CREATED' };
  }
}