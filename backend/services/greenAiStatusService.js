import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLatestWorkloadDecision } from './agents/contextAwareWorkload.js';

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serviceDirectory, '..', '..');
const defaultDatasetRoot = path.resolve(projectRoot, '..', 'dataset');

const DATASET_PATHS = Object.freeze({
  'Accident images': ['accident detection', 'data'],
  'Vehicle classification images': ['classification of vehicle', 'Vehicles'],
  'Helmet detection labels': ['helmet', 'annotations'],
  'Number-plate labels': ['number plate', 'Annotations'],
  'Urban road-issue labels': ['urban issues'],
  'Waterlogging labels': ['water logging', 'yolo_dataset'],
  'Traffic telemetry CSV': ['Traffic congestion', 'vanet_traffic_data.csv'],
  'Street-vendor images': ['Street Vendors Dataset'],
  'Traffic-forecast source': ['traffic forcast', 'NeurIPS2022-traffic4cast-main'],
  'Pedestrian behaviour source': ['pedestrian and driving behaviour', 'JAAD-JAAD_2.0']
});

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function summarizedTrainingMetrics(report) {
  if (!report || typeof report !== 'object' || !report.models) return null;
  return Object.fromEntries(Object.entries(report.models).map(([name, model]) => [
    name,
    {
      datasetType: model.dataset_type || 'not-reported',
      architecture: model.architecture || null,
      classes: Array.isArray(model.classes) ? model.classes : [],
      samples: Number.isFinite(model.samples) ? model.samples : null,
      accuracy: Number.isFinite(model.accuracy) ? model.accuracy : null,
      f1Score: Number.isFinite(model.f1_score) ? model.f1_score : null,
      precision: model.precision && typeof model.precision === 'object' ? model.precision : null,
      recall: model.recall && typeof model.recall === 'object' ? model.recall : null,
      mAP50: Number.isFinite(model.mAP50) ? model.mAP50 : null,
      mAP50_95: Number.isFinite(model.mAP50_95) ? model.mAP50_95 : null,
      testImages: Number.isFinite(model.test_images) ? model.test_images : null,
      trainedAt: model.trained_at || report.generated_at || null
    }
  ]));
}

function summarizedBenchmark(report) {
  if (!report || typeof report !== 'object') return null;
  const modes = Object.fromEntries(Object.entries(report.modes || {}).map(([name, mode]) => [
    name,
    {
      selectedPrecision: mode.selected_precision || name,
      meanLatencyMs: mode.inference?.mean_ms ?? null,
      p95LatencyMs: mode.inference?.p95_ms ?? null,
      throughputPerSecond: mode.inference?.throughput_per_second ?? null,
      energyJoules: mode.energy?.energy_joules ?? null,
      energyPerInferenceJoules: mode.energy?.energy_per_inference_joules ?? null,
      energyScope: mode.energy?.scope || null,
      modelSizeBytes: mode.model_size_bytes ?? null
    }
  ]));
  return {
    generatedAt: report.generated_at || null,
    modelName: report.model?.name || null,
    runtime: report.model?.runtime || null,
    hardware: report.hardware
      ? { gpuName: report.hardware.gpu_name || null, cudaAvailable: Boolean(report.hardware.cuda_available) }
      : null,
    modes,
    comparisonsWithBaseline: report.comparisons_with_baseline || {},
    accuracyValidation: report.accuracy_validation
      ? {
          status: report.accuracy_validation.status,
          metric: report.accuracy_validation.metric || null,
          criterion: report.accuracy_validation.criterion || null,
          results: report.accuracy_validation.results || null,
          criterionPass: report.accuracy_validation.criterion_pass ?? null,
          reason: report.accuracy_validation.reason || null
        }
      : null,
    acceptanceStatus: report.acceptance?.status || 'unverified',
    measurementNotes: report.measurement_notes || {}
  };
}

export function getGreenAiStatus(databaseReadyState) {
  const configuredDatasetRoot = process.env.URBANSAATHI_DATASET_ROOT;
  const datasetRoot = configuredDatasetRoot
    ? path.resolve(configuredDatasetRoot)
    : defaultDatasetRoot;
  const datasetRootAvailable = fs.existsSync(datasetRoot);
  const datasets = Object.entries(DATASET_PATHS).map(([name, relativePath]) => ({
    name,
    available: datasetRootAvailable && fs.existsSync(path.join(datasetRoot, ...relativePath))
  }));
  const metricsPath = path.join(projectRoot, 'models', 'real', 'metrics.json');
  const additionalMetricsPath = path.join(projectRoot, 'models', 'real', 'additional_metrics.json');
  const benchmarkPath = path.join(projectRoot, 'reports', 'green_ai', 'latest.json');
  const metrics = readJsonIfPresent(metricsPath);
  const additionalMetrics = readJsonIfPresent(additionalMetricsPath);
  const benchmark = readJsonIfPresent(benchmarkPath);
  const cpu = os.cpus()[0];
  const memory = process.memoryUsage();

  return {
    observedAt: new Date().toISOString(),
    runtime: {
      platform: process.platform,
      nodeVersion: process.version,
      cpuModel: cpu?.model || 'unavailable',
      cpuCores: os.cpus().length,
      hostMemoryBytes: os.totalmem(),
      hostFreeMemoryBytes: os.freemem(),
      processMemoryBytes: memory.rss
    },
    database: {
      connected: databaseReadyState === 1,
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][databaseReadyState] || 'unknown'
    },
    datasets: {
      rootConfigured: Boolean(configuredDatasetRoot),
      rootAvailable: datasetRootAvailable,
      source: configuredDatasetRoot ? 'configured-local-path' : 'adjacent-local-dataset-folder',
      availableCount: datasets.filter((item) => item.available).length,
      totalCount: datasets.length,
      items: datasets
    },
    trainingMetrics: {
      source: 'local model metrics artifacts; not a live evaluation',
      models: {
        ...(summarizedTrainingMetrics(metrics) || {}),
        ...(summarizedTrainingMetrics(additionalMetrics) || {})
      }
    },
    benchmark: benchmark
      ? { available: true, source: 'measured-local-benchmark-report', report: summarizedBenchmark(benchmark) }
      : { available: false, reason: 'No measured benchmark report is present.' },
    contextSources: {
      weatherApiConfigured: Boolean(process.env.WEATHER_API_KEY && process.env.WEATHER_API_KEY !== 'demo'),
      weatherDemoMode: process.env.WEATHER_API_KEY === 'demo',
      gps: 'provided-per-event-only',
      festivalCalendar: 'not-configured'
    },
    latestWorkloadDecision: getLatestWorkloadDecision()
  };
}
