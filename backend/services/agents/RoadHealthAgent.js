import { BaseAgent } from './BaseAgent.js';
import { MockDBService } from './MockDB.js';

export class RoadHealthAgent extends BaseAgent {
  constructor() {
    super('Road Health Agent');
  }

  async retrieveContext(event) {
    const { lat, lng } = event.location;
    
    // 1. Identify road segment
    const road = MockDBService.getRoadByLocation(lat, lng);
    
    // 2. Identify responsible authority
    const authority = MockDBService.getAuthorityForIssue(event.detection.class.toUpperCase() || 'POTHOLE');
    
    // 3. Find active contract/contractor
    const contractor = MockDBService.getContractorForZone(authority?.department, road?.zone);
    
    return { road, authority, contractor };
  }

  async reason(event, context) {
    const { road, authority, contractor } = context;
    const { severity } = event.detection;
    
    let priority = 'LOW';
    if (severity === 'HIGH' || road.type === 'Arterial' || road.type === 'CBD') {
      priority = 'HIGH';
    }

    const complaintDetails = {
      issue: event.detection.class.toUpperCase(),
      severity: severity || 'UNKNOWN',
      roadName: road ? road.name : 'Unknown Road',
      priority,
      authorityId: authority ? authority.authorityId : 'UNASSIGNED',
      department: authority ? authority.department : 'Unknown',
      contractorName: contractor ? contractor.name : 'Unknown Contractor',
      contractorId: contractor ? contractor.contractorId : 'UNASSIGNED',
      slaHours: contractor ? contractor.slaHours : 48,
      status: 'OPEN'
    };

    return { complaintDetails };
  }

  async decide(event, context, reasoning) {
    const { complaintDetails } = reasoning;
    const complaintId = `COMP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;
    
    return {
      action: 'CREATE_COMPLAINT_AND_NOTIFY',
      complaint: {
        complaintId,
        ...complaintDetails,
        detectedAt: event.timestamp,
        cameraId: event.cameraId || 'UNKNOWN',
        mlConfidence: event.detection.confidence
      }
    };
  }

  async act(decision) {
    if (decision.action === 'CREATE_COMPLAINT_AND_NOTIFY') {
      const c = decision.complaint;
      console.log(`\n=================================================`);
      console.log(`[RoadHealthAgent] 🕳️ POTHOLE/ROAD COMPLAINT CREATED`);
      console.log(`Complaint ID: ${c.complaintId}`);
      console.log(`Road: ${c.roadName} | Priority: ${c.priority}`);
      console.log(`Assigned To: ${c.department}`);
      console.log(`Contractor: ${c.contractorName} (${c.contractorId})`);
      console.log(`SLA: ${c.slaHours} hours | Status: ${c.status}`);
      console.log(`=================================================\n`);
      
      // Simulate notifying authority and contractor
      console.log(`[RoadHealthAgent] ✉️  SIMULATED SMS SENT TO ${c.contractorName} (ops@contractor.in)`);
      console.log(`[RoadHealthAgent] ✉️  SIMULATED ALERT SENT TO ${c.department} Dashboard`);
      
      return decision.complaint;
    }
    return null;
  }
}
