# Green AI model-level optimization

The ML service keeps its existing inference behavior by default. Enable model-level
FP16 per process or per model only after validating the candidate against a
labeled dataset:

```powershell
$env:URBANSAATHI_MODEL_PRECISION = "fp16"
```

Per-model settings take precedence over the process default. The model name is
uppercased and non-alphanumeric characters become underscores:

```powershell
$env:URBANSAATHI_MODEL_PRECISION_POTHOLE_DETECTOR = "fp16"
```

Supported settings are `baseline`, `auto`, `fp16`, `int8`, `onnx`, and
`tensorrt`. FP16 is enabled only on CUDA-capable PyTorch/Ultralytics runtimes.
Unsupported INT8, ONNX, and TensorRT requests explicitly fall back to the
original model and are reported by `GET /optimization/status`. This checkout
does not include a representative image calibration set or an ONNX CUDA /
TensorRT inference runtime, so those modes are not activated. If CUDA FP16
inference fails for a detector, that model is retried immediately at baseline
precision and remains on baseline for subsequent calls during that process.
The original FP32/CPU classifier remains available if CUDA FP16 classifier
inference fails.

## Reproducible detector benchmark

Use the same model and image directory for both modes. The script sorts inputs,
records each input's SHA-256, performs warm-up runs, repeats inference, and
reports mean/p95 latency, throughput, memory observations, model size, sampled
GPU energy when available, and unlabeled detection agreement:

```powershell
python scripts\benchmark_ml_optimization.py `
  --model models\real\urban_issues_yolov8n.pt `
  --images C:\path\to\road\images `
  --warmup-runs 10 `
  --repeats 5
```

Supply an Ultralytics dataset YAML with labeled validation data to measure
mAP50-95, mAP50, precision, and recall for both modes:

```powershell
python scripts\benchmark_ml_optimization.py `
  --model models\real\urban_issues_yolov8n.pt `
  --images C:\path\to\road\images `
  --data C:\path\to\dataset.yaml
```

The acceptance interpretation is **relative mAP50-95 loss below 2%**; the
report also includes percentage-point loss. Detection agreement on unlabeled
images is explicitly not treated as accuracy. The energy target is at least a
50% reduction. When `nvidia-smi` is available, energy is integrated from sampled
GPU-board power readings over the benchmark workload window; this includes GPU
idle draw and gaps while inputs are decoded, and is not model-only or
whole-system energy. Missing telemetry or labels leave the corresponding
criterion unverified rather than estimating or fabricating results.

The JSON report is written to
`reports\green_ai\latest.json` by default and can be fetched from
`GET /optimization/benchmark/latest` while the ML API is running. Set
`URBANSAATHI_BENCHMARK_REPORT` to use another report path. The default report
is ignored by Git so generated local measurements are not committed by
accident.

Run the focused tests with:

```powershell
python -m pytest tests\test_ml_optimization.py
```
