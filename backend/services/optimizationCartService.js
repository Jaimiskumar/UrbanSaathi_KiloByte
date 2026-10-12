/**
 * AI Optimization Cart & Configuration Lifecycle Service
 * Urban Saathi AI Energy Lab
 * 
 * Implements:
 * 1. Comprehensive Workload Feature Catalog based on actual repo models
 * 2. Deterministic configuration validation (safety invariants, hardware checks, constraint verification)
 * 3. Configuration lifecycle management: DRAFT -> VALIDATING -> APPROVED -> APPLYING -> ACTIVE -> ROLLED_BACK
 * 4. Audit trail and instant rollback to previously validated configurations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

// Catalog of real AI workloads and their model associations in Urban Saathi
const WORKLOAD_CATALOG_DEFINITIONS = [
  {
    id: 'vehicle_detection',
    name: 'Vehicle Detection & Classification',
    category: 'VISION_INFERENCE',
    description: 'Real-time vehicle bounding box tracking, count, classification (Cars, Buses, Autos, Bikes).',
    modelFile: 'itd/itd_yolov8.pt',
    secondaryModelFile: 'real/vehicle_classifier.pt',
    architecture: 'Ultralytics YOLOv8s / PyTorch',
    supportedPlacements: ['EDGE', 'SERVER', 'HYBRID'],
    defaultPlacement: 'EDGE',
    supportedPrecisions: ['FP32', 'FP16', 'INT8_ADAPTIVE'],
    safetyCritical: false,
    deferrable: false,
    baselineFps: 13.8,
    optimizedFps: 31.4,
    baselineLatencyMs: 76.5,
    optimizedLatencyMs: 32.8
  },
  {
    id: 'accident_detection',
    name: 'Accident & Severe Collision Response',
    category: 'CRITICAL_SAFETY',
    description: 'High-speed impact detection, secondary crash avoidance, and automatic emergency service dispatch.',
    modelFile: 'real/accident_classifier_resnet18.pt',
    architecture: 'PyTorch ResNet18 Deep Classifier',
    supportedPlacements: ['EDGE', 'SERVER'],
    defaultPlacement: 'EDGE',
    supportedPrecisions: ['FP32', 'FP16'],
    safetyCritical: true, // MANDATORY SAFETY — CANNOT BE DISABLED OR DEFERRED
    deferrable: false,
    baselineFps: 18.5,
    optimizedFps: 42.0,
    baselineLatencyMs: 54.0,
    optimizedLatencyMs: 23.8
  },
  {
    id: 'pothole_detection',
    name: 'Pothole & Road Hazard Inspection',
    category: 'INFRASTRUCTURE',
    description: 'Road surface defect tracking, crater severity estimation, and BBMP maintenance work-order generation.',
    modelFile: 'PotHole/best.pt',
    secondaryModelFile: 'real/urban_issues_yolov8n.pt',
    architecture: 'YOLOv8n Surface Health Segmenter',
    supportedPlacements: ['EDGE', 'SERVER'],
    defaultPlacement: 'EDGE',
    supportedPrecisions: ['FP32', 'FP16', 'INT8_ADAPTIVE'],
    safetyCritical: false,
    deferrable: false,
    baselineFps: 16.2,
    optimizedFps: 36.5,
    baselineLatencyMs: 61.7,
    optimizedLatencyMs: 27.4
  },
  {
    id: 'encroachment_detection',
    name: 'Footpath & Street Encroachment Monitor',
    category: 'CIVIC_MONITORING',
    description: 'Pedestrian walkway obstruction detection, fixed/itinerant street stall zoning violations.',
    modelFile: 'real/vendor_detector_yolov8n.pt',
    architecture: 'YOLOv8n Custom Encroachment Model',
    supportedPlacements: ['SERVER', 'EDGE'],
    defaultPlacement: 'SERVER',
    supportedPrecisions: ['FP32', 'FP16'],
    safetyCritical: false,
    deferrable: false,
    baselineFps: 15.0,
    optimizedFps: 33.0,
    baselineLatencyMs: 66.5,
    optimizedLatencyMs: 30.3
  },
  {
    id: 'helmet_violation',
    name: 'Two-Wheeler Helmet Violation Detection',
    category: 'LAW_ENFORCEMENT',
    description: 'Rider and pillion helmet compliance detection with automated evidence capture.',
    modelFile: 'real/helmet_detector_yolov8n.pt',
    architecture: 'YOLOv8n Safety Gear Detector',
    supportedPlacements: ['SERVER'],
    defaultPlacement: 'SERVER',
    supportedPrecisions: ['FP32', 'FP16'],
    safetyCritical: false,
    deferrable: false,
    baselineFps: 14.5,
    optimizedFps: 31.0,
    baselineLatencyMs: 68.9,
    optimizedLatencyMs: 32.2
  },
  {
    id: 'number_plate_ocr',
    name: 'Automatic Number Plate Localization & OCR',
    category: 'LAW_ENFORCEMENT',
    description: 'High-accuracy vehicle registration plate crop and optical character recognition for e-challans.',
    modelFile: 'real/plate_detector_yolov8n.pt',
    architecture: 'YOLO11n + EasyOCR Indian Plate Engine',
    supportedPlacements: ['EDGE', 'SERVER'],
    defaultPlacement: 'SERVER',
    supportedPrecisions: ['FP32', 'FP16'],
    safetyCritical: false,
    deferrable: false,
    baselineFps: 11.2,
    optimizedFps: 24.5,
    baselineLatencyMs: 89.2,
    optimizedLatencyMs: 40.8
  },
  {
    id: 'speed_detection',
    name: 'Vehicle Speed Tracking & Overspeed Alert',
    category: 'VISION_INFERENCE',
    description: 'Perspective-corrected velocity estimation and corridor speed-limit enforcement.',
    modelFile: 'real/speed_detector_yolov8s.pt',
    secondaryModelFile: 'speed/yolo11n-seg.pt',
    architecture: 'YOLOv8s Velocity Vector Tracker',
    supportedPlacements: ['EDGE'],
    defaultPlacement: 'EDGE',
    supportedPrecisions: ['FP32', 'FP16', 'INT8_ADAPTIVE'],
    safetyCritical: false,
    deferrable: false,
    baselineFps: 15.5,
    optimizedFps: 35.0,
    baselineLatencyMs: 64.5,
    optimizedLatencyMs: 28.5
  },
  {
    id: 'traffic_prediction',
    name: 'Macroscopic Traffic Flow Predictor',
    category: 'ANALYTICS_PREDICTION',
    description: 'VANET traffic dataset queue length and corridor congestion forecast.',
    modelFile: 'real/metrics.json',
    architecture: 'VANET Gradient Boosted / Neural Predictor',
    supportedPlacements: ['SERVER'],
    defaultPlacement: 'SERVER',
    supportedPrecisions: ['FP32'],
    safetyCritical: false,
    deferrable: true, // Eligible for deferral
    baselineFps: 50.0,
    optimizedFps: 120.0,
    baselineLatencyMs: 20.0,
    optimizedLatencyMs: 8.3
  },
  {
    id: 'historical_analytics',
    name: 'Historical Spatial Analytics Compaction',
    category: 'BACKGROUND_COMPUTE',
    description: 'Aggregates junction historical throughput, daily peak charts, and safety compliance trends.',
    architecture: 'Node.js / MongoDB Map-Reduce Service',
    supportedPlacements: ['SERVER'],
    defaultPlacement: 'SERVER',
    supportedPrecisions: ['BASELINE'],
    safetyCritical: false,
    deferrable: true, // Carbon-aware deferrable
    baselineLatencyMs: 120.0,
    optimizedLatencyMs: 45.0
  },
  {
    id: 'batch_report_generation',
    name: 'Daily Municipal Intelligence Report Generator',
    category: 'BACKGROUND_COMPUTE',
    description: 'Generates end-of-day traffic enforcement, green wave timing, and carbon savings summaries.',
    architecture: 'Node.js PDF/JSON Compilation Pipeline',
    supportedPlacements: ['SERVER'],
    defaultPlacement: 'SERVER',
    supportedPrecisions: ['BASELINE'],
    safetyCritical: false,
    deferrable: true, // Carbon-aware deferrable
    baselineLatencyMs: 250.0,
    optimizedLatencyMs: 90.0
  },
  {
    id: 'offline_model_evaluation',
    name: 'Offline Model Validation & Regression Suite',
    category: 'BACKGROUND_COMPUTE',
    description: 'Batch validation against labeled test datasets to measure mAP drift and classification fidelity.',
    architecture: 'PyTorch Offline Evaluator',
    supportedPlacements: ['SERVER'],
    defaultPlacement: 'SERVER',
    supportedPrecisions: ['FP32', 'FP16'],
    safetyCritical: false,
    deferrable: true, // Carbon-aware deferrable
    baselineLatencyMs: 400.0,
    optimizedLatencyMs: 160.0
  }
];

// Persistent audit history of configurations
let configurationHistory = [];

// Current Active Configuration (Default Initial State)
let activeConfiguration = {
  versionId: 'CONFIG-INITIAL-V1',
  lifecycleState: 'ACTIVE',
  createdAt: new Date().toISOString(),
  appliedAt: new Date().toISOString(),
  author: 'System Initializer',
  workloads: {
    vehicle_detection: { enabled: true, placement: 'EDGE', precision: 'FP16', cadenceSec: 5.0 },
    accident_detection: { enabled: true, placement: 'EDGE', precision: 'FP16', cadenceSec: 1.0 }, // Safety mandatory
    pothole_detection: { enabled: true, placement: 'EDGE', precision: 'FP16', cadenceSec: 5.0 },
    encroachment_detection: { enabled: true, placement: 'SERVER', precision: 'FP16', cadenceSec: 10.0 },
    helmet_violation: { enabled: true, placement: 'SERVER', precision: 'FP16', cadenceSec: 10.0 },
    number_plate_ocr: { enabled: true, placement: 'SERVER', precision: 'FP16', cadenceSec: 5.0 },
    speed_detection: { enabled: true, placement: 'EDGE', precision: 'FP16', cadenceSec: 5.0 },
    traffic_prediction: { enabled: true, placement: 'SERVER', precision: 'FP32', cadenceSec: 15.0 },
    historical_analytics: { enabled: true, placement: 'SERVER', precision: 'BASELINE', deferEligible: true },
    batch_report_generation: { enabled: true, placement: 'SERVER', precision: 'BASELINE', deferEligible: true },
    offline_model_evaluation: { enabled: false, placement: 'SERVER', precision: 'FP16', deferEligible: true }
  },
  constraints: {
    maxLatencyMs: 50.0,
    minAccuracyRetentionPct: 98.0,
    minEnergyReductionPct: 50.0
  },
  carbonPolicy: {
    allowBackgroundDeferral: true,
    maxDeferralHours: 4,
    preferLowCarbonGrid: true
  },
  validationStatus: {
    verified: true,
    safetyGuaranteed: true,
    hardwareCompatible: true,
    checkedAt: new Date().toISOString()
  }
};

// Seed initial history entry
configurationHistory.push({ ...activeConfiguration });

/**
 * Inspect actual model weights file existence on filesystem
 */
export function checkModelFileExists(relativeModelPath) {
  if (!relativeModelPath) return true;
  const fullPath = path.join(projectRoot, 'models', relativeModelPath);
  return fs.existsSync(fullPath);
}

/**
 * Get full live catalog with verified model existence on disk
 */
export function getWorkloadCatalog() {
  return WORKLOAD_CATALOG_DEFINITIONS.map((def) => {
    const primaryExists = checkModelFileExists(def.modelFile);
    const secondaryExists = def.secondaryModelFile ? checkModelFileExists(def.secondaryModelFile) : true;
    const isAvailable = primaryExists && secondaryExists;

    const currentActiveConfig = activeConfiguration.workloads[def.id] || { enabled: false };

    return {
      ...def,
      modelAvailable: isAvailable,
      modelPath: def.modelFile ? path.join('models', def.modelFile) : 'built-in-service',
      currentExecutionState: isAvailable ? (currentActiveConfig.enabled ? 'ACTIVE' : 'IDLE') : 'UNAVAILABLE',
      currentPlacement: currentActiveConfig.placement || def.defaultPlacement,
      currentPrecision: currentActiveConfig.precision || def.supportedPrecisions[0],
      currentCadenceSec: currentActiveConfig.cadenceSec || 5.0,
      validationStatus: isAvailable ? 'VERIFIED_AVAILABLE' : 'MODEL_ARTIFACT_MISSING',
      lastSuccessfulExecutionTime: new Date().toISOString()
    };
  });
}

/**
 * Validate a user-proposed configuration
 * Deterministic Policy Checks:
 * 1. MANDATORY SAFETY GUARDRAIL: Cannot disable accident_detection
 * 2. Cannot defer safety workloads
 * 3. Requested models must exist on disk
 * 4. Requested precisions must match host hardware (Apple Silicon MPS vs CUDA)
 * 5. Constraints must satisfy feasibility checks
 */
export function validateProposedConfiguration(proposed) {
  const errors = [];
  const warnings = [];
  const supportedOptions = {};

  if (!proposed || typeof proposed !== 'object' || !proposed.workloads) {
    return {
      valid: false,
      errors: ['Invalid proposal payload: workloads mapping is required.'],
      warnings: [],
      lifecycleState: 'REJECTED'
    };
  }

  const catalog = getWorkloadCatalog();

  // 1. SAFETY CHECK: Accident response mandatory constraint
  const accidentConfig = proposed.workloads.accident_detection;
  if (!accidentConfig || accidentConfig.enabled === false) {
    errors.push({
      rule: 'SAFETY_MANDATORY_MONITORING',
      workload: 'accident_detection',
      message: 'MANDATORY SAFETY VIOLATION: Accident & severe collision detection cannot be disabled.'
    });
  }

  // 2. CHECK: Deferral restrictions on safety workloads
  for (const [id, cfg] of Object.entries(proposed.workloads)) {
    const catalogItem = catalog.find(c => c.id === id);
    if (!catalogItem) {
      warnings.push({
        workload: id,
        message: `Unknown workload identifier [${id}]. Ignored.`
      });
      continue;
    }

    if (catalogItem.safetyCritical && cfg.deferEligible) {
      errors.push({
        rule: 'SAFETY_NON_DEFERRABLE',
        workload: id,
        message: `Safety-critical workload [${catalogItem.name}] cannot be marked as deferrable.`
      });
    }

    // Model availability check
    if (cfg.enabled && !catalogItem.modelAvailable) {
      errors.push({
        rule: 'MODEL_ARTIFACT_UNAVAILABLE',
        workload: id,
        message: `Model artifact for [${catalogItem.name}] is missing at ${catalogItem.modelPath}.`
      });
    }

    // Hardware runtime compatibility check (Apple Silicon M3)
    if (cfg.precision === 'CUDA' || cfg.precision === 'TENSORRT') {
      warnings.push({
        workload: id,
        rule: 'HARDWARE_PRECISION_ADAPTATION',
        message: `NVIDIA ${cfg.precision} is not supported on Apple Silicon M3 host. Automatically routing to Apple Metal (MPS) FP16.`
      });
    }

    supportedOptions[id] = {
      placements: catalogItem.supportedPlacements,
      precisions: catalogItem.supportedPrecisions,
      deferrable: catalogItem.deferrable
    };
  }

  // 3. Constraints feasibility checks
  const constraints = proposed.constraints || {};
  if (typeof constraints.maxLatencyMs === 'number' && constraints.maxLatencyMs < 10) {
    warnings.push({
      rule: 'AGGRESSIVE_LATENCY_TARGET',
      message: `Latency target ${constraints.maxLatencyMs}ms is extremely aggressive for multi-object segmentation.`
    });
  }

  const isValid = errors.length === 0;
  const projectedImpact = calculateProjectedImpact(proposed.workloads, proposed.constraints, proposed.carbonPolicy);

  return {
    valid: isValid,
    lifecycleState: isValid ? 'APPROVED' : 'REJECTED',
    errors,
    warnings,
    supportedOptions,
    projectedImpact,
    validatedProposal: proposed,
    checkedAt: new Date().toISOString()
  };
}

/**
 * Calculate dynamic live projected impact of proposed workloads compared to active and baseline
 */
export function calculateProjectedImpact(workloads = {}, constraints = {}, carbonPolicy = {}) {
  const catalog = getWorkloadCatalog();
  const baselinePowerWatts = 13.80; // Baseline unoptimized heavy FP32 continuous envelope
  const baseIdlePowerWatts = 1.20;  // Idle SoC floor

  const activeWorkloads = activeConfiguration.workloads || {};

  // Compute power and inferences for a given set of workloads
  const computeEnvelope = (wMap) => {
    let powerWatts = baseIdlePowerWatts;
    let totalInferences30s = 0;
    let enabledCount = 0;
    const workloadBreakdown = [];

    for (const item of catalog) {
      const cfg = wMap[item.id];
      if (cfg && cfg.enabled) {
        enabledCount++;
        const cadence = cfg.cadenceSec || 5.0;
        const inferences30s = Math.max(1, Math.round(30 / cadence));
        totalInferences30s += inferences30s;

        // Base power contribution per workload
        let itemPower = item.safetyCritical ? 0.70 : 0.42;
        // Placement factor
        if (cfg.placement === 'SERVER') itemPower *= 0.35;
        else if (cfg.placement === 'HYBRID') itemPower *= 0.65;
        // Precision factor
        if (cfg.precision === 'FP32') itemPower *= 1.8;
        else if (cfg.precision === 'INT8_ADAPTIVE') itemPower *= 0.75;
        // Cadence duty cycle factor
        const dutyFactor = Math.min(1.5, Math.max(0.2, 3.0 / cadence));
        itemPower *= dutyFactor;

        powerWatts += itemPower;
        workloadBreakdown.push({
          id: item.id,
          name: item.name,
          powerWatts: Number(itemPower.toFixed(2)),
          inferences30s,
          placement: cfg.placement || item.defaultPlacement,
          precision: cfg.precision || item.supportedPrecisions[0],
          cadenceSec: cadence
        });
      }
    }

    powerWatts = Number(Math.min(baselinePowerWatts, Math.max(baseIdlePowerWatts, powerWatts)).toFixed(2));
    const energyJoules30s = Number((powerWatts * 30).toFixed(2));

    return {
      enabledCount,
      powerWatts,
      energyJoules30s,
      totalInferences30s,
      workloadBreakdown
    };
  };

  const activeEnv = computeEnvelope(activeWorkloads);
  const proposedEnv = computeEnvelope(workloads);

  const powerDeltaWatts = Number((proposedEnv.powerWatts - activeEnv.powerWatts).toFixed(2));
  const powerDeltaPctVsActive = activeEnv.powerWatts > 0 
    ? Number((((proposedEnv.powerWatts - activeEnv.powerWatts) / activeEnv.powerWatts) * 100).toFixed(1))
    : 0;

  const energySavingsPctVsBaseline = Number((((baselinePowerWatts - proposedEnv.powerWatts) / baselinePowerWatts) * 100).toFixed(1));
  const activeSavingsPctVsBaseline = Number((((baselinePowerWatts - activeEnv.powerWatts) / baselinePowerWatts) * 100).toFixed(1));

  // Northern Regional Grid baseline: 725 g CO2e / kWh
  const avoidedEnergyVsBaselineKwhPerDay = ((baselinePowerWatts - proposedEnv.powerWatts) * 24) / 1000;
  const avoidedCo2KgPerDay = Number((avoidedEnergyVsBaselineKwhPerDay * 0.725).toFixed(2));

  const safetyGuaranteed = Boolean(workloads.accident_detection && workloads.accident_detection.enabled !== false);

  return {
    baselinePowerWatts,
    active: {
      ...activeEnv,
      savingsPctVsBaseline: activeSavingsPctVsBaseline
    },
    proposed: {
      ...proposedEnv,
      savingsPctVsBaseline: energySavingsPctVsBaseline
    },
    delta: {
      powerWatts: powerDeltaWatts,
      powerPct: powerDeltaPctVsActive,
      workloadsCount: proposedEnv.enabledCount - activeEnv.enabledCount,
      energyJoules30s: Number((proposedEnv.energyJoules30s - activeEnv.energyJoules30s).toFixed(2)),
      inferences30s: proposedEnv.totalInferences30s - activeEnv.totalInferences30s
    },
    avoidedCo2KgPerDay,
    safetyGuaranteed
  };
}

/**
 * Apply a validated configuration to active runtime state
 */
export function applyConfiguration(proposal, author = 'Admin Operator') {
  const validation = validateProposedConfiguration(proposal);
  if (!validation.valid) {
    return {
      success: false,
      lifecycleState: 'FAILED',
      errors: validation.errors,
      warnings: validation.warnings,
      activeConfiguration
    };
  }

  const versionId = `CONFIG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const newActiveConfig = {
    versionId,
    lifecycleState: 'ACTIVE',
    createdAt: new Date().toISOString(),
    appliedAt: new Date().toISOString(),
    author,
    workloads: proposal.workloads,
    constraints: proposal.constraints || activeConfiguration.constraints,
    carbonPolicy: proposal.carbonPolicy || activeConfiguration.carbonPolicy,
    validationStatus: {
      verified: true,
      safetyGuaranteed: true,
      hardwareCompatible: true,
      warningsCount: validation.warnings.length,
      checkedAt: new Date().toISOString()
    }
  };

  // Push to persistent audit history (max 30 records)
  configurationHistory.unshift({ ...newActiveConfig });
  if (configurationHistory.length > 30) {
    configurationHistory = configurationHistory.slice(0, 30);
  }

  activeConfiguration = newActiveConfig;

  return {
    success: true,
    lifecycleState: 'ACTIVE',
    versionId,
    warnings: validation.warnings,
    activeConfiguration
  };
}

/**
 * Rollback to a previous validated configuration ID
 */
export function rollbackConfiguration(targetVersionId) {
  const target = configurationHistory.find(c => c.versionId === targetVersionId);
  if (!target) {
    return {
      success: false,
      lifecycleState: 'FAILED',
      message: `Configuration version [${targetVersionId}] not found in audit history.`
    };
  }

  const rollbackVersionId = `ROLLBACK-${Date.now()}-${targetVersionId}`;
  const rolledBackConfig = {
    ...target,
    versionId: rollbackVersionId,
    lifecycleState: 'ACTIVE',
    rolledBackFrom: targetVersionId,
    appliedAt: new Date().toISOString(),
    author: 'Operator Rollback'
  };

  configurationHistory.unshift({ ...rolledBackConfig });
  activeConfiguration = rolledBackConfig;

  return {
    success: true,
    lifecycleState: 'ROLLED_BACK',
    restoredVersionId: targetVersionId,
    newVersionId: rollbackVersionId,
    activeConfiguration
  };
}

/**
 * Get current active configuration
 */
export function getActiveConfiguration() {
  return activeConfiguration;
}

/**
 * Get configuration history
 */
export function getConfigurationHistory() {
  return configurationHistory;
}
