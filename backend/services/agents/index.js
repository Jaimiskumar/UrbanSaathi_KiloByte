import { orchestratorAgent } from './OrchestratorAgent.js';
import { CivicAndRoadHealthAgent } from './CivicAndRoadHealthAgent.js';
import { TrafficAgent } from './TrafficAgent.js';
import { AuthorityCoordinationAgent } from './AuthorityCoordinationAgent.js';
import { EnforcementAgent } from './EnforcementAgent.js';
import { EncroachmentAgent } from './EncroachmentAgent.js';
import { EChallanAgent } from './EChallanAgent.js';
import { AccidentEmergencyAgent } from './AccidentEmergencyAgent.js';
import { GreenCorridorAgent } from './GreenCorridorAgent.js';
import { VerificationAgent } from './VerificationAgent.js';
import { eventBus } from './EventBus.js';

// Instantiate all agents
const agents = {
  CivicAndRoadHealthAgent: new CivicAndRoadHealthAgent(),
  TrafficAgent: new TrafficAgent(),
  AuthorityCoordinationAgent: new AuthorityCoordinationAgent(),
  EnforcementAgent: new EnforcementAgent(),
  EncroachmentAgent: new EncroachmentAgent(),
  EChallanAgent: new EChallanAgent(),
  AccidentEmergencyAgent: new AccidentEmergencyAgent(),
  GreenCorridorAgent: new GreenCorridorAgent(),
  VerificationAgent: new VerificationAgent()
};

// Register agents with the Orchestrator
orchestratorAgent.registerAgents(agents);

export { orchestratorAgent, eventBus };
