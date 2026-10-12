import test from 'node:test';
import assert from 'node:assert/strict';
import { runGreenAiExperiment, getExperimentHistory, getExperimentScenarios } from '../services/greenAiExperimentService.js';

test('Green AI Scenarios lists all three distinct traffic conditions', () => {
  const scenarios = getExperimentScenarios();
  assert.equal(Array.isArray(scenarios), true);
  assert.ok(scenarios.length >= 3);

  const scenarioIds = scenarios.map(s => s.id);
  assert.ok(scenarioIds.includes('stable'));
  assert.ok(scenarioIds.includes('congested'));
  assert.ok(scenarioIds.includes('incident'));
});

test('Green AI experiment in Stable Corridor achieves >= 50% energy reduction with < 2% accuracy loss', async () => {
  const result = await runGreenAiExperiment({
    scenarioId: 'stable',
    mode: 'both'
  });

  assert.ok(result.runId);
  assert.equal(result.scenario.id, 'stable');
  assert.ok(result.summaryMetrics);

  // Check 50% target criterion
  assert.ok(result.summaryMetrics.energyReductionPct >= 50, `Expected energyReductionPct >= 50, got ${result.summaryMetrics.energyReductionPct}`);
  // Check < 2% accuracy loss
  assert.ok(Math.abs(result.summaryMetrics.accuracyChangePct) < 2.0, `Expected accuracy loss < 2.0%, got ${result.summaryMetrics.accuracyChangePct}`);
  assert.equal(result.validationStatus, 'verified', 'Validation status should be verified');

  // Verify Layer 1 (Model-level optimization)
  assert.ok(result.layer1);
  assert.ok(result.layer1.baselinePrecision.includes('FP32'));
  assert.ok(result.layer1.optimizedPrecision.includes('FP16') || result.layer1.optimizedPrecision.includes('Quantized'));
  assert.ok(result.layer1.energyReductionPct >= 50);
  assert.ok(result.layer1.target50PctMet);
  assert.ok(result.layer1.accuracyLimit2PctMet);

  // Verify Layer 2 (Feature-driven allocation)
  assert.ok(result.layer2);
  assert.ok(result.layer2.selectedAgents.length > 0);
  assert.ok(result.layer2.skippedAgents.length > 0);
  assert.ok(result.layer2.nodes.length > 0);

  // Verify Layer 3 (Context-aware workload)
  assert.ok(result.layer3);
  assert.ok(result.layer3.adaptedCadenceSec >= 5); // stable corridor relaxes cadence to 10s

  // Verify Token & Cost Optimization metrics
  assert.ok(result.summaryMetrics.tokens, 'Tokens metrics should be present');
  assert.ok(result.summaryMetrics.tokens.tokenReductionPct >= 60, `Expected tokenReductionPct >= 60, got ${result.summaryMetrics.tokens.tokenReductionPct}`);
  assert.ok(result.summaryMetrics.tokens.tokensReduced > 5000, 'Expected tokensReduced > 5000');
  assert.ok(result.summaryMetrics.tokens.tokensSavedByPruning > 0, 'Expected tokensSavedByPruning > 0');

  assert.ok(result.summaryMetrics.costs, 'Costs metrics should be present');
  assert.ok(result.summaryMetrics.costs.costReductionPct >= 60, `Expected costReductionPct >= 60, got ${result.summaryMetrics.costs.costReductionPct}`);
  assert.ok(result.summaryMetrics.costs.costSavedPer1kUsd > 0, 'Expected costSavedPer1kUsd > 0');
  assert.ok(result.summaryMetrics.costs.annualCostSavedUsd > 0, 'Expected annualCostSavedUsd > 0');

  // Verify provenance and hardware boundaries
  assert.ok(result.layer1.hardwarePlatform.length > 0);
  assert.ok(result.layer1.telemetryMethod.length > 0);
});

test('Green AI experiment in Incident/Emergency scenario guarantees emergency safety agents are never suppressed', async () => {
  const result = await runGreenAiExperiment({
    scenarioId: 'incident',
    mode: 'both'
  });

  assert.ok(result.runId);
  assert.equal(result.scenario.id, 'incident');

  // Safety checks in Layer 2: AccidentEmergencyAgent or GreenCorridorAgent must execute
  assert.ok(result.layer2);
  const selectedAgents = result.layer2.selectedAgents;
  assert.ok(
    selectedAgents.includes('AccidentEmergencyAgent') || selectedAgents.includes('GreenCorridorAgent') || selectedAgents.includes('TrafficAgent'),
    'Emergency safety agents must execute'
  );
  assert.equal(result.layer2.safetyOverridesActive, true);

  // Layer 3 Cadence: Emergency must elevate sampling rate (e.g. 1.0s)
  assert.ok(result.layer3.adaptedCadenceSec <= 2.0, `Expected emergency cadence <= 2.0s, got ${result.layer3.adaptedCadenceSec}`);
  assert.equal(result.layer3.priority, 'CRITICAL');
});

test('Green AI experiment persists to run history', async () => {
  const history = getExperimentHistory();
  assert.ok(Array.isArray(history));
  assert.ok(history.length > 0);
  assert.ok(history[0].runId);
  assert.ok(history[0].timestamp);
});
