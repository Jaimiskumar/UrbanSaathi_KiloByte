import { EventEmitter } from 'events';

class SmartHorizonEventBus extends EventEmitter {
  constructor() {
    super();
    this.history = []; // Simple history for the hackathon POC
  }

  /**
   * Publish a standardized ML event to the orchestrator.
   * @param {Object} event
   */
  publish(event) {
    const enrichedEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      eventId: event.eventId || `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    };
    
    this.history.push(enrichedEvent);
    console.log(`[EventBus] Published: ${enrichedEvent.eventType} (${enrichedEvent.eventId})`);
    
    // Emit to orchestrator
    this.emit('NEW_DETECTION', enrichedEvent);
    return enrichedEvent;
  }

  getHistory() {
    return this.history;
  }
}

export const eventBus = new SmartHorizonEventBus();
