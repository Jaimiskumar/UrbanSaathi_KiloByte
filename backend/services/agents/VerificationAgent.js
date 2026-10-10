import { BaseAgent } from './BaseAgent.js';

export class VerificationAgent extends BaseAgent {
  constructor() {
    super('Verification & Monitoring Agent');
    // Store active resolutions we're waiting for
    this.pendingVerifications = new Map();
  }

  track(actionEvent) {
    // We can manually call this to track an issue
    if (actionEvent && actionEvent.complaintId) {
      this.pendingVerifications.set(actionEvent.complaintId, {
        status: 'PENDING_VERIFICATION',
        expectedResolutionTime: Date.now() + (actionEvent.slaHours * 3600 * 1000),
        data: actionEvent
      });
    }
  }

  async retrieveContext(event) {
    return {
      trackedIssues: this.pendingVerifications
    };
  }

  async reason(event, context) {
    const workflowResults = event.workflowResults || {};
    const checks = Object.entries(workflowResults)
      .filter(([agentName]) => agentName !== 'VerificationAgent')
      .map(([agentName, result]) => ({
        agent: agentName,
        status: result?.status || 'MISSING',
        passed: result?.status === 'SUCCESS' && result.actionResult !== null && result.actionResult !== undefined,
        error: result?.error || null
      }));
    const failedAgents = checks.filter((check) => !check.passed);

    return {
      action: 'VERIFY_WORKFLOW',
      eventId: event.eventId,
      trackedCount: context.trackedIssues.size,
      checkedAt: new Date().toISOString(),
      overallStatus: checks.length > 0 && failedAgents.length === 0 ? 'VERIFIED' : 'FAILED',
      checks,
      passedAgents: checks.filter((check) => check.passed).map((check) => check.agent),
      failedAgents: failedAgents.map((check) => check.agent),
      failureDetails: failedAgents
    };
  }

  async decide(event, context, reasoning) {
    return reasoning;
  }

  async act(decision) {
    return {
      status: decision.overallStatus,
      action: decision.action,
      eventId: decision.eventId,
      checkedAt: decision.checkedAt,
      trackedCount: decision.trackedCount,
      totalAgents: decision.checks.length,
      passedCount: decision.passedAgents.length,
      failedCount: decision.failedAgents.length,
      passedAgents: decision.passedAgents,
      failedAgents: decision.failedAgents,
      checks: decision.checks,
      failureDetails: decision.failureDetails
    };
  }
}
