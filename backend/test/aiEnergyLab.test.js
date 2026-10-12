import test from 'node:test';
import assert from 'node:assert/strict';

import {
  integratePowerSamplesToJoules,
  calculateEnergyPerInference,
  calculateEnergyReductionPct,
  calculateAccuracyLoss,
  captureHostTelemetry
} from '../services/hardwareTelemetryService.js';

import {
  calculateOperationalEmissions,
  scheduleWorkload,
  getCarbonIntensityStatus,
  NON_DEFERRABLE_SAFETY_WORKLOADS
} from '../services/carbonAwareSchedulerService.js';

import {
  getWorkloadCatalog,
  getActiveConfiguration,
  validateProposedConfiguration,
  calculateProjectedImpact,
  applyConfiguration,
  rollbackConfiguration
} from '../services/optimizationCartService.js';

import {
  runProvenanceBenchmark,
  getLiveVerificationMatrix
} from '../services/provenanceBenchmarkService.js';
import {
  computeFrameDeltaMetrics
} from '../services/videoDeltaProcessingService.js';

test('Hardware Telemetry: calculates energy via trapezoidal numerical integration', () => {
  // 10W power over 2 seconds: E = 10 * 2 = 20 Joules
  const samples = [
    [0.0, 10.0],
    [1.0, 10.0],
    [2.0, 10.0]
  ];
  const joules = integratePowerSamplesToJoules(samples);
  assert.equal(joules, 20.0);
});

test('Hardware Telemetry: calculates energy per inference correctly', () => {
  const energyPerInf = calculateEnergyPerInference(30.0, 60);
  assert.equal(energyPerInf, 0.5); // 30J / 60 inf = 0.5 J/inf

  // Invalid cases return null
  assert.equal(calculateEnergyPerInference(null, 60), null);
  assert.equal(calculateEnergyPerInference(30.0, 0), null);
});

test('Hardware Telemetry: calculates energy reduction percentage', () => {
  // Baseline: 1.0J, Optimized: 0.45J -> (1.0 - 0.45) / 1.0 = 55%
  const reduction = calculateEnergyReductionPct(1.0, 0.45);
  assert.equal(reduction, 55.0);

  // Baseline zero or negative returns null
  assert.equal(calculateEnergyReductionPct(0, 0.5), null);
});

test('Hardware Telemetry: calculates accuracy loss in percentage points and relative percentage', () => {
  // Baseline: 0.894 (89.4%), Optimized: 0.888 (88.8%)
  const loss = calculateAccuracyLoss(0.894, 0.888);
  assert.equal(loss.absoluteDifferencePercentagePoints, 0.6); // 0.6 percentage points
  assert.ok(loss.relativeLossPct < 2.0); // 0.67% relative loss < 2% target
  assert.equal(loss.meetsLimit, true);
});

test('Carbon Computing: calculates operational emissions with CEA India baseline', () => {
  // 3600 Joules = 0.001 kWh
  // At 725 gCO2e/kWh: 0.001 * 725 = 0.725 gCO2e
  const result = calculateOperationalEmissions(3600, 725);
  assert.equal(result.energyKwh, 0.001);
  assert.equal(result.emissionsGramsCo2e, 0.725);
  assert.equal(result.status, 'ESTIMATED');
});

test('Carbon Scheduler: rejects any attempt to defer safety-critical workloads', () => {
  for (const safetyType of NON_DEFERRABLE_SAFETY_WORKLOADS) {
    const decision = scheduleWorkload({
      workloadType: safetyType,
      deadlineMs: 3600000
    });
    assert.equal(decision.action, 'EXECUTE_IMMEDIATELY');
    assert.equal(decision.isDeferred, false);
    assert.match(decision.status, /SAFETY/);
  }
});

test('Carbon Scheduler: allows carbon-aware deferral for eligible background workloads', () => {
  const decision = scheduleWorkload({
    workloadType: 'batch_report_generation',
    deadlineMs: 7200000
  });
  assert.equal(decision.action, 'DEFERRED_FOR_LOW_CARBON');
  assert.equal(decision.isDeferred, true);
  assert.equal(decision.status, 'SCHEDULED_DEFERRED');
});

test('Optimization Cart: rejects proposed configuration that disables accident detection', () => {
  const proposal = {
    workloads: {
      vehicle_detection: { enabled: true, placement: 'EDGE', precision: 'FP16' },
      accident_detection: { enabled: false } // Attempt to disable safety
    }
  };
  const validation = validateProposedConfiguration(proposal);
  assert.equal(validation.valid, false);
  assert.equal(validation.lifecycleState, 'REJECTED');
  assert.ok(validation.errors.some(e => e.rule === 'SAFETY_MANDATORY_MONITORING'));
});

test('Optimization Cart: warns and adapts when CUDA is requested on Apple Silicon M3 host', () => {
  const proposal = {
    workloads: {
      vehicle_detection: { enabled: true, placement: 'EDGE', precision: 'CUDA' },
      accident_detection: { enabled: true, placement: 'EDGE', precision: 'FP16' }
    }
  };
  const validation = validateProposedConfiguration(proposal);
  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.some(w => w.rule === 'HARDWARE_PRECISION_ADAPTATION'));
});

test('Optimization Cart: applies configuration and supports instant rollback', () => {
  const initial = getActiveConfiguration();
  const validProposal = {
    workloads: {
      vehicle_detection: { enabled: true, placement: 'EDGE', precision: 'FP16', cadenceSec: 4.0 },
      accident_detection: { enabled: true, placement: 'EDGE', precision: 'FP16', cadenceSec: 1.0 },
      pothole_detection: { enabled: true, placement: 'EDGE', precision: 'FP16', cadenceSec: 5.0 }
    }
  };

  const applyRes = applyConfiguration(validProposal, 'Test Runner');
  assert.equal(applyRes.success, true);
  assert.equal(applyRes.lifecycleState, 'ACTIVE');
  const appliedVersion = applyRes.versionId;

  // Now roll back to initial version
  const rollbackRes = rollbackConfiguration(initial.versionId);
  assert.equal(rollbackRes.success, true);
  assert.equal(rollbackRes.restoredVersionId, initial.versionId);
});

test('Optimization Cart: calculateProjectedImpact computes live power delta and emissions accurately', () => {
  const proposal = {
    accident_detection: { enabled: true, placement: 'EDGE', precision: 'FP16', cadenceSec: 1.0 },
    vehicle_detection: { enabled: true, placement: 'EDGE', precision: 'FP16', cadenceSec: 5.0 }
  };
  const impact = calculateProjectedImpact(proposal);
  assert.equal(impact.baselinePowerWatts, 13.80);
  assert.ok(impact.proposed.powerWatts < impact.baselinePowerWatts);
  assert.ok(impact.proposed.savingsPctVsBaseline > 50.0);
  assert.equal(impact.safetyGuaranteed, true);
  assert.ok(impact.avoidedCo2KgPerDay > 0);
  assert.equal(impact.proposed.enabledCount, 2);
});

test('Provenance Benchmark: runs comparable evaluation and verifies >= 50% energy cut and < 2% accuracy loss', async () => {
  const benchmark = await runProvenanceBenchmark({
    scenarioId: 'test_corridor',
    fixedWindowSeconds: 30,
    inputFrameCount: 300
  });

  assert.ok(benchmark.benchmarkId.startsWith('BM-'));
  assert.equal(benchmark.fixedWindowDurationSec, 30);
  assert.ok(benchmark.comparisons.energyPerInferenceReductionPct >= 50.0);
  assert.ok(benchmark.comparisons.accuracyRelativeLossPct < 2.0);
  assert.equal(benchmark.verificationStatus, 'VERIFIED_PASSED');
});

test('Live Verification Matrix: reflects real verified condition statuses', () => {
  const matrix = getLiveVerificationMatrix();
  assert.ok(Array.isArray(matrix));
  assert.ok(matrix.length >= 7);

  const accidentEntry = matrix.find(m => m.dimension === 'Accident Emergency Response');
  assert.equal(accidentEntry.verified, true);
  assert.equal(accidentEntry.statusText, 'SAFETY_LOCKED_ACTIVE');

  const pmuEntry = matrix.find(m => m.dimension === 'Hardware PMU Energy Sensor');
  assert.ok(pmuEntry.provenance === 'LIVE_MEASURED' || pmuEntry.provenance === 'UNAVAILABLE');

  const deltaEntry = matrix.find(m => m.dimension === 'Video Delta Gating (Static Bypass)');
  assert.ok(deltaEntry);
  assert.equal(deltaEntry.verified, true);
  assert.equal(deltaEntry.statusText, 'DELTA_BYPASS_VERIFIED');
});

test('Video Delta Processing: partitions frame into macro-tiles and calculates static bypass percentage', () => {
  const detections = [
    { class: 'car', bbox: { x1: 20, y1: 30, x2: 40, y2: 60 } }
  ];
  const result = computeFrameDeltaMetrics(detections);

  assert.equal(result.deltaDetectionEnabled, true);
  assert.equal(result.gridMetrics.totalTiles, 144);
  assert.ok(result.workloadMetrics.staticBypassedAreaPct > 50.0); // Majority of static road/sky bypassed
  assert.ok(result.workloadMetrics.dynamicRoiAreaPct < 50.0);
  assert.ok(result.workloadMetrics.netFlopsSavedPct > 45.0);
});

test('Video Delta Processing: computes FLOPs and carbon emissions reduction accurately', () => {
  const result = computeFrameDeltaMetrics([
    { class: 'car', bbox: { x1: 10, y1: 20, x2: 25, y2: 50 } },
    { class: 'bus', bbox: { x1: 50, y1: 30, x2: 70, y2: 70 } }
  ]);

  assert.ok(result.energyMetrics.totalEnergyCutPct > 80.0);
  assert.ok(result.carbonMetrics.emissionsSavedPer1kGrams > 0.1);
  assert.equal(result.carbonMetrics.carbonIntensityFactor, 725.0);
});

test('Precision Tradeoffs: FP16 halves VRAM bandwidth and retains >98% accuracy compared to FP32', () => {
  const result = computeFrameDeltaMetrics([]);
  const tradeoffs = result.precisionComparison.tradeoffs;

  assert.equal(tradeoffs.memoryFootprintReductionPct, 50.0);
  assert.ok(tradeoffs.latencySpeedupFactor >= 2.0);
  assert.ok(tradeoffs.accuracyRetentionPct > 98.0);
  assert.ok(tradeoffs.relativeAccuracyLossPct < 2.0);
});

