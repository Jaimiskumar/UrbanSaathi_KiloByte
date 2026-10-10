import { orchestratorAgent } from './OrchestratorAgent.js';
import { RoadHealthAgent } from './RoadHealthAgent.js';
import { TrafficAgent } from './TrafficAgent.js';
import { CivicIssueAgent } from './CivicIssueAgent.js';
import { CivicAndRoadHealthAgent } from './CivicAndRoadHealthAgent.js';
import { AuthorityCoordinationAgent } from './AuthorityCoordinationAgent.js';
import { EnforcementAgent } from './EnforcementAgent.js';
import { EChallanAgent } from './EChallanAgent.js';
import { AccidentEmergencyAgent } from './AccidentEmergencyAgent.js';
import { GreenCorridorAgent } from './GreenCorridorAgent.js';
import { CrowdSafetyAgent } from './CrowdSafetyAgent.js';
import { VerificationAgent } from './VerificationAgent.js';
import { eventBus } from './EventBus.js';

// Instantiate all agents
const agents = {
  RoadHealthAgent: new RoadHealthAgent(),
  TrafficAgent: new TrafficAgent(),
  CivicIssueAgent: new CivicIssueAgent(),
  CivicAndRoadHealthAgent: new CivicAndRoadHealthAgent(),
  AuthorityCoordinationAgent: new AuthorityCoordinationAgent(),
  EnforcementAgent: new EnforcementAgent(),
  EChallanAgent: new EChallanAgent(),
  AccidentEmergencyAgent: new AccidentEmergencyAgent(),
  GreenCorridorAgent: new GreenCorridorAgent(),
  CrowdSafetyAgent: new CrowdSafetyAgent(),
  VerificationAgent: new VerificationAgent()
};

// Register agents with the Orchestrator
orchestratorAgent.registerAgents(agents);

export { orchestratorAgent, eventBus };
