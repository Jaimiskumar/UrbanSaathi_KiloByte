export class BaseAgent {
  constructor(name) {
    this.name = name;
  }

  /**
   * Main entry point for the agent to process an event
   * @param {Object} event 
   */
  async processEvent(event) {
    console.log(`[${this.name}] Processing event: ${event.eventId}`);
    
    try {
      const context = await this.retrieveContext(event);
      const reasoning = await this.reason(event, context);
      const decision = await this.decide(event, context, reasoning);
      const actionResult = await this.act(decision);
      
      return {
        agent: this.name,
        eventId: event.eventId,
        status: 'SUCCESS',
        actionResult
      };
    } catch (error) {
      console.error(`[${this.name}] Error processing event:`, error);
      return {
        agent: this.name,
        eventId: event.eventId,
        status: 'ERROR',
        error: error.message
      };
    }
  }

  // To be overridden by specific agents
  async retrieveContext(event) { return {}; }
  async reason(event, context) { return {}; }
  async decide(event, context, reasoning) { return {}; }
  async act(decision) { return null; }
}
