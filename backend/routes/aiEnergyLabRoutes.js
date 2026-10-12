/**
 * AI Energy Lab & Optimization Control Center Express Router
 * Endpoints mounted under /api/ai-energy-lab
 */

import express from 'express';
import {
  getWorkloadCatalog,
  getActiveConfiguration,
  getConfigurationHistory,
  validateProposedConfiguration,
  calculateProjectedImpact,
  applyConfiguration,
  rollbackConfiguration
} from '../services/optimizationCartService.js';
import {
  getLatestTelemetryWithFreshness
} from '../services/hardwareTelemetryService.js';
import {
  getCarbonIntensityStatus,
  scheduleWorkload,
  getQueuedJobs,
  removeJob
} from '../services/carbonAwareSchedulerService.js';
import {
  runProvenanceBenchmark,
  getBenchmarkHistory,
  getBenchmarkById,
  getLiveVerificationMatrix
} from '../services/provenanceBenchmarkService.js';
import { computeFrameDeltaMetrics } from '../services/videoDeltaProcessingService.js';
import { getSocketServer } from '../services/socketServer.js';

const router = express.Router();

/**
 * GET /api/ai-energy-lab/catalog
 * Retrieve complete catalog of supported AI workloads and real model artifacts
 */
router.get('/catalog', (req, res) => {
  try {
    const catalog = getWorkloadCatalog();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalWorkloads: catalog.length,
      availableWorkloadsCount: catalog.filter(c => c.modelAvailable).length,
      catalog
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai-energy-lab/config/active
 * Retrieve current active configuration and configuration history
 */
router.get('/config/active', (req, res) => {
  try {
    const active = getActiveConfiguration();
    const history = getConfigurationHistory();
    res.json({
      success: true,
      activeConfiguration: active,
      historyCount: history.length,
      history
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-energy-lab/config/validate
 * Validate a proposed configuration proposal without applying it
 */
router.post('/config/validate', (req, res) => {
  try {
    const proposal = req.body;
    const validation = validateProposedConfiguration(proposal);
    res.json({
      success: true,
      ...validation
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-energy-lab/config/project-impact
 * Calculate dynamic live impact comparison of workloads before applying
 */
router.post('/config/project-impact', (req, res) => {
  try {
    const { workloads, constraints, carbonPolicy } = req.body || {};
    const impact = calculateProjectedImpact(workloads, constraints, carbonPolicy);
    res.json({
      success: true,
      impact
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-energy-lab/config/apply
 * Apply a validated configuration to the runtime system
 */
router.post('/config/apply', (req, res) => {
  try {
    const { proposal, author } = req.body || {};
    const result = applyConfiguration(proposal, author || 'Admin Operator');

    if (!result.success) {
      return res.status(422).json(result);
    }

    // Broadcast configuration change via Socket.IO
    try {
      const io = getSocketServer();
      if (io) {
        io.emit('ai_optimization_config_applied', {
          versionId: result.versionId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {}

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-energy-lab/config/rollback
 * Roll back to a previous validated configuration version ID
 */
router.post('/config/rollback', (req, res) => {
  try {
    const { versionId } = req.body || {};
    if (!versionId) {
      return res.status(400).json({ success: false, error: 'versionId is required for rollback.' });
    }
    const result = rollbackConfiguration(versionId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    // Broadcast rollback event
    try {
      const io = getSocketServer();
      if (io) {
        io.emit('ai_optimization_config_rolled_back', {
          restoredVersionId: result.restoredVersionId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {}

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai-energy-lab/telemetry/live
 * Instantaneous host compute, CPU, memory, and PMU energy telemetry
 */
router.get('/telemetry/live', (req, res) => {
  try {
    const telemetry = getLatestTelemetryWithFreshness();
    res.json({
      success: true,
      telemetry
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai-energy-lab/carbon/status
 * Electricity grid carbon intensity status and provider health
 */
router.get('/carbon/status', async (req, res) => {
  try {
    const status = await getCarbonIntensityStatus();
    res.json({
      success: true,
      carbonStatus: status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-energy-lab/scheduler/jobs
 * Submit a background task to the carbon-aware scheduler
 */
router.post('/scheduler/jobs', (req, res) => {
  try {
    const jobPayload = req.body;
    const decision = scheduleWorkload(jobPayload);
    res.json({
      success: true,
      decision
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai-energy-lab/scheduler/jobs
 * Get list of queued carbon-aware background jobs
 */
router.get('/scheduler/jobs', (req, res) => {
  try {
    const jobs = getQueuedJobs();
    res.json({
      success: true,
      totalQueued: jobs.length,
      jobs
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/ai-energy-lab/scheduler/jobs/:id
 * Remove or cancel a queued background job
 */
router.delete('/scheduler/jobs/:id', (req, res) => {
  try {
    const removed = removeJob(req.params.id);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }
    res.json({ success: true, removedJob: removed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-energy-lab/benchmark/run
 * Execute a comparable baseline vs optimized benchmark
 */
router.post('/benchmark/run', async (req, res) => {
  try {
    const { scenarioId, fixedWindowSeconds, inputFrameCount, workloadTarget } = req.body || {};
    const benchmark = await runProvenanceBenchmark({
      scenarioId: scenarioId || 'stable_corridor',
      fixedWindowSeconds: Number(fixedWindowSeconds) || 30,
      inputFrameCount: Number(inputFrameCount) || 300,
      workloadTarget: workloadTarget || 'vehicle_detection'
    });

    // Notify connected UI dashboards via WebSocket
    try {
      const io = getSocketServer();
      if (io) {
        io.emit('ai_optimization_benchmark_completed', {
          benchmarkId: benchmark.benchmarkId,
          timestamp: benchmark.timestamp,
          energyReductionPct: benchmark.comparisons.energyPerInferenceReductionPct,
          fpsSpeedupPct: benchmark.comparisons.fpsSpeedupPct
        });
      }
    } catch (e) {}

    res.json({
      success: true,
      benchmark
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai-energy-lab/benchmark/history
 * Retrieve all completed benchmark evaluation records
 */
router.get('/benchmark/history', (req, res) => {
  try {
    const history = getBenchmarkHistory();
    res.json({
      success: true,
      totalBenchmarks: history.length,
      history
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai-energy-lab/benchmark/:runId
 * Retrieve specific benchmark by run ID
 */
router.get('/benchmark/:runId', (req, res) => {
  try {
    const benchmark = getBenchmarkById(req.params.runId);
    if (!benchmark) {
      return res.status(404).json({ success: false, message: 'Benchmark not found.' });
    }
    res.json({ success: true, benchmark });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai-energy-lab/matrix
 * Retrieve Live Tick-and-Cross Verification Matrix
 */
router.get('/matrix', (req, res) => {
  try {
    const matrix = getLiveVerificationMatrix();
    res.json({
      success: true,
      matrix
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai-energy-lab/export/:runId
 * Export benchmark report as JSON or CSV
 */
router.get('/export/:runId', (req, res) => {
  try {
    const benchmark = getBenchmarkById(req.params.runId) || getBenchmarkHistory()[0];
    const format = String(req.query.format || 'json').toLowerCase();

    if (!benchmark) {
      return res.status(404).send('No benchmark record found to export.');
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=benchmark_${benchmark.benchmarkId}.csv`);
      const csvRows = [
        'Metric Dimension,Baseline,Optimized,Delta / Unit,Provenance Status',
        `Inference Latency Mean,${benchmark.baseline.meanLatencyMs},${benchmark.optimized.meanLatencyMs},-${benchmark.comparisons.latencyReductionMs} ms,BENCHMARK_MEASURED`,
        `Throughput,${benchmark.baseline.throughputFps},${benchmark.optimized.throughputFps},+${benchmark.comparisons.fpsSpeedupPct}%,BENCHMARK_MEASURED`,
        `Average Device Power,${benchmark.baseline.averagePowerWatts},${benchmark.optimized.averagePowerWatts},Watts,LIVE_MEASURED`,
        `Energy Per Processed Inference,${benchmark.baseline.energyPerInferenceJoules},${benchmark.optimized.energyPerInferenceJoules},-${benchmark.comparisons.energyPerInferenceReductionPct}%,CALCULATED`,
        `Total Window Energy (30s),${benchmark.baseline.totalWindowEnergyJoules},${benchmark.optimized.totalWindowEnergyJoules},-${benchmark.comparisons.totalWorkloadEnergyReductionPct}%,CALCULATED`,
        `Accuracy mAP50-95,${benchmark.baseline.accuracyMap50_95},${benchmark.optimized.accuracyMap50_95},-${benchmark.comparisons.accuracyRelativeLossPct}%,BENCHMARK_MEASURED`,
        `Operational Emissions,${benchmark.baseline.estimatedEmissionsGramsCo2e},${benchmark.optimized.estimatedEmissionsGramsCo2e},gCO2e,ESTIMATED`
      ];
      return res.send(csvRows.join('\n'));
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=benchmark_${benchmark.benchmarkId}.json`);
    res.json(benchmark);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

/**
 * GET /api/ai-energy-lab/video/delta-status
 * Retrieve real-time video delta processing configuration and baseline metrics
 */
router.get('/video/delta-status', (req, res) => {
  try {
    const metrics = computeFrameDeltaMetrics([
      { class: 'car', bbox: { x1: 20, y1: 35, x2: 40, y2: 75 } },
      { class: 'bus', bbox: { x1: 55, y1: 30, x2: 80, y2: 80 } }
    ]);
    res.json({
      success: true,
      deltaMetrics: metrics
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-energy-lab/video/delta-analyze
 * Run dynamic frame delta differencing on provided bounding box / scene detections
 */
router.post('/video/delta-analyze', (req, res) => {
  try {
    const { detections = [], options = {} } = req.body;
    const metrics = computeFrameDeltaMetrics(detections, options);
    res.json({
      success: true,
      deltaMetrics: metrics
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
