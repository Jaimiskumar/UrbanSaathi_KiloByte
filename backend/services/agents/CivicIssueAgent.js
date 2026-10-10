import { BaseAgent } from './BaseAgent.js';
import { MockDBService } from './MockDB.js';

export class CivicIssueAgent extends BaseAgent {
  constructor() {
    super('Civic Issue Agent');
  }

  async retrieveContext(event) {
    const { lat, lng } = event.location;
    const road = MockDBService.getRoadByLocation(lat, lng);
    const authority = MockDBService.getAuthorityForIssue(event.detection.class.toUpperCase());
    
    return { road, authority };
  }

  async reason(event, context) {
    const { road, authority } = context;
    const { class: issueType, severity } = event.detection;
    
    let priority = 'LOW';
    let requiresTrafficDiversion = false;

    // specific reasoning logic based on issue
    if (issueType === 'waterlogging') {
      priority = severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
      if (severity === 'HIGH') requiresTrafficDiversion = true;
    } else if (issueType === 'tree') {
      // If tree is blocking the road
      const blocksRoad = event.detection.blocksRoad || false;
      if (blocksRoad) {
        priority = 'CRITICAL';
        requiresTrafficDiversion = true;
      } else {
        priority = 'MEDIUM';
      }
    } else if (['encroachment', 'hawker'].includes(issueType)) {
      priority = 'MEDIUM';
    }

    const complaintDetails = {
      issue: issueType.toUpperCase(),
      priority,
      roadName: road?.name || 'Unknown',
      department: authority?.department || 'BBMP Encroachment & Civic',
      requiresTrafficDiversion,
      status: 'OFFICER_NOTIFIED'
    };

    return { complaintDetails };
  }

  async decide(event, context, reasoning) {
    return {
      action: 'CREATE_AUTHORITY_COMPLAINT',
      complaint: reasoning.complaintDetails,
      triggerTrafficAgent: reasoning.complaintDetails.requiresTrafficDiversion
    };
  }

  async act(decision) {
    const c = decision.complaint;
    console.log(`\n=================================================`);
    console.log(`[CivicIssueAgent] 🏪 CIVIC ISSUE REPORTED`);
    console.log(`Issue: ${c.issue} | Priority: ${c.priority}`);
    console.log(`Location: ${c.roadName}`);
    console.log(`Assigned To: ${c.department}`);
    console.log(`Status: ${c.status}`);
    
    if (decision.triggerTrafficAgent) {
      console.log(`⚠️  Traffic diversion recommended. Escalate to Traffic Agent.`);
    }
    console.log(`=================================================\n`);
    return decision.complaint;
  }
}
