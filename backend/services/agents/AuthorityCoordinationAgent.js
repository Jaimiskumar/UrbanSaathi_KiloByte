import { BaseAgent } from './BaseAgent.js';

export class AuthorityCoordinationAgent extends BaseAgent {
  constructor() {
    super('Authority Coordination Agent');
  }

  async retrieveContext(event) {
    return {
      ticketDetails: event.complaints || (event.complaint ? [event.complaint] : [event.actionResult || {}])
    };
  }

  async reason(event, context) {
    const tickets = context.ticketDetails.filter((ticket) => ticket?.authorityId && ticket?.issue);
    
    return {
      isValidTicket: tickets.length > 0,
      tickets
    };
  }

  async decide(event, context, reasoning) {
    if (reasoning.isValidTicket) {
      return {
        action: 'DISPATCH_OFFICIAL_TICKET',
        tickets: reasoning.tickets
      };
    }
    return { action: 'IGNORE' };
  }

  async act(decision) {
    if (decision.action === 'DISPATCH_OFFICIAL_TICKET') {
      const dispatches = decision.tickets.map((ticket) => ({
        ticketId: ticket.complaintId || `AUTH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        issue: ticket.issue,
        authorityId: ticket.authorityId,
        department: ticket.department,
        priority: ticket.priority || 'MEDIUM',
        slaHours: ticket.slaHours || 48,
        status: 'DISPATCHED',
        dispatchedAt: new Date().toISOString()
      }));
      dispatches.forEach((dispatch) => {
        console.log(`[AuthorityCoordination] Ticket ${dispatch.ticketId} dispatched to ${dispatch.department}.`);
      });
      return {
        status: 'DISPATCHED',
        dispatches,
        ticketId: dispatches[0]?.ticketId,
        complaintId: dispatches[0]?.ticketId,
        authorityId: dispatches[0]?.authorityId,
        department: dispatches[0]?.department,
        priority: dispatches[0]?.priority
      };
    }
    return null;
  }
}
