import { BaseAgent } from './BaseAgent.js';

export class AuthorityCoordinationAgent extends BaseAgent {
  constructor() {
    super('Authority Coordination Agent');
  }

  async retrieveContext(event) {
    return {
      ticketDetails: event.complaint || event.actionResult || {}
    };
  }

  async reason(event, context) {
    const { ticketDetails } = context;
    // Ensure all required fields for an official ticket are present
    const isComplete = ticketDetails.authorityId && ticketDetails.issue;
    
    return {
      isValidTicket: isComplete,
      ticket: ticketDetails
    };
  }

  async decide(event, context, reasoning) {
    if (reasoning.isValidTicket) {
      return {
        action: 'DISPATCH_OFFICIAL_TICKET',
        ticket: reasoning.ticket
      };
    }
    return { action: 'IGNORE' };
  }

  async act(decision) {
    if (decision.action === 'DISPATCH_OFFICIAL_TICKET') {
      console.log(`[AuthorityCoordination] 🏛️ Ticket dispatched to official government API for ${decision.ticket.department}.`);
      return { status: 'DISPATCHED', ...decision.ticket };
    }
    return null;
  }
}
