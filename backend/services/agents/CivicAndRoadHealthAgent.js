import { BaseAgent } from './BaseAgent.js';
import { MockDBService } from './MockDB.js';

export class CivicAndRoadHealthAgent extends BaseAgent {
  constructor() {
    super('Civic And Road Health Agent');
  }

  async retrieveContext(event) {
    const { lat, lng } = event.location;
    
    // 1. Identify road segment
    const road = MockDBService.getRoadByLocation(lat, lng);
    
    // 2. Identify responsible authority
    const authority = MockDBService.getAuthorityForIssue(event.detection.class || 'POTHOLE');
    
    // 3. Find active contract/contractor (mainly for road health issues like pothole)
    const contractor = MockDBService.getContractorForZone(authority?.department, road?.zone);
    
    return { road, authority, contractor };
  }

  async reason(event, context) {
    const { road, authority, contractor } = context;
    const { class: issueType, severity } = event.detection;
    const issueUpper = (issueType || 'POTHOLE').toUpperCase().replace(/[-\s]+/g, '_');
    
    let priority = 'LOW';
    let requiresTrafficDiversion = false;

    // Road health logic
    if (['POTHOLE', 'CRACK'].includes(issueUpper)) {
      if (severity === 'HIGH' || road?.type === 'Arterial' || road?.type === 'CBD') {
        priority = 'HIGH';
      }
    } 
    // Civic issue logic
    else if (issueUpper === 'WATERLOGGING') {
      priority = severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
      if (severity === 'HIGH') requiresTrafficDiversion = true;
    } else if (['TREE', 'FALLEN_TREE'].includes(issueUpper)) {
      const blocksRoad = event.detection.blocksRoad || event.detection.roadBlocked || false;
      if (blocksRoad) {
        priority = 'CRITICAL';
        requiresTrafficDiversion = true;
      } else {
        priority = 'MEDIUM';
      }
    } else if (['ENCROACHMENT', 'HAWKER'].includes(issueUpper)) {
      priority = 'MEDIUM';
    } else {
      // Default fallback
      priority = severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
    }

    const complaintDetails = {
      issue: issueUpper,
      severity: severity || 'UNKNOWN',
      roadName: road ? road.name : 'Unknown Road',
      priority,
      authorityId: authority ? authority.authorityId : 'UNASSIGNED',
      department: authority ? authority.department : 'BBMP Encroachment & Civic',
      contractorName: contractor ? contractor.name : 'Unknown Contractor',
      contractorId: contractor ? contractor.contractorId : 'UNASSIGNED',
      contractorContact: contractor ? contractor.contact : null,
      contractorPerformanceScore: contractor ? contractor.performanceScore : null,
      authorityJurisdiction: authority ? authority.jurisdiction : 'Bengaluru Urban',
      slaHours: contractor?.slaHours || authority?.slaHours || 48,
      requiresTrafficDiversion,
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
        mlConfidence: event.detection.confidence || 1.0
      },
      triggerTrafficAgent: complaintDetails.requiresTrafficDiversion
    };
  }

  async act(decision) {
    if (decision.action === 'CREATE_COMPLAINT_AND_NOTIFY') {
      const c = decision.complaint;
      console.log(`\n=================================================`);
      console.log(`[CivicAndRoadHealthAgent] 🕳️/🏪 CIVIC & ROAD COMPLAINT CREATED`);
      console.log(`Complaint ID: ${c.complaintId}`);
      console.log(`Issue: ${c.issue} | Priority: ${c.priority}`);
      console.log(`Road: ${c.roadName}`);
      console.log(`Assigned To: ${c.department}`);
      
      if (['POTHOLE', 'CRACK'].includes(c.issue)) {
        console.log(`Contractor: ${c.contractorName} (${c.contractorId})`);
        console.log(`SLA: ${c.slaHours} hours | Status: ${c.status}`);
        console.log(`=================================================\n`);
        console.log(`[CivicAndRoadHealthAgent] ✉️  SIMULATED SMS SENT TO ${c.contractorName} (ops@contractor.in)`);
      } else {
        console.log(`Status: ${c.status}`);
        if (decision.triggerTrafficAgent) {
          console.log(`⚠️  Traffic diversion recommended. Escalate to Traffic Agent.`);
        }
        console.log(`=================================================\n`);
      }
      
      console.log(`[CivicAndRoadHealthAgent] ✉️  SIMULATED ALERT SENT TO ${c.department} Dashboard`);
      
      return decision.complaint;
    }
    return null;
  }
}
