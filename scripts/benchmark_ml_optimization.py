"""Repeatable Ultralytics detector benchmark for baseline and optimized modes."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import psutil
import torch
import ultralytics
from ultralytics import YOLO

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ml_optimization import (  # noqa: E402
    ModelOptimizationService,
    accuracy_loss,
    energy_reduction_percent,
    integrate_power_samples,
    meets_relative_accuracy_limit,
    summarize_latencies,
)

IMAGE_EXTENSIONS = {".bmp", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"}


class NvidiaSmiPowerSampler:
    def __init__(self, interval_seconds: float = 0.25) -> None:
        self.interval_seconds = interval_seconds
        self.samples: list[tuple[float, float]] = []
        self.error: str | None = None
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._sample, daemon=True)

    def _sample(self) -> None:
        while not self._stop.is_set():
            try:
                result = subprocess.run(
                    [
                        "nvidia-smi",
                        "--query-gpu=power.draw",
                        "--format=csv,noheader,nounits",
                    ],
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=2,
                )
                value = float(result.stdout.strip().splitlines()[0])
                self.samples.append((time.perf_counter(), value))
            except (OSError, subprocess.SubprocessError, ValueError, IndexError) as error:
                self.error = str(error)
            self._stop.wait(self.interval_seconds)

    def __enter__(self) -> NvidiaSmiPowerSampler:
        self._thread.start()
        return self

    def __exit__(self, exc_type: Any, exc_value: Any, traceback: Any) -> None:
        self._stop.set()
        self._thread.join(timeout=3)

    def result(self, inference_count: int) -> dict[str, Any]:
        joules = integrate_power_samples(self.samples)
        return {
            "energy_joules": joules,
            "energy_per_inference_joules": (
                joules / inference_count if joules is not None and inference_count else None
            ),
            "telemetry": "sampled nvidia-smi GPU board power draw",
            "scope": "whole GPU during benchmark workload; includes idle power and input decoding",
            "sample_count": len(self.samples),
            "unavailable_reason": (
                "At least two power samples are required."
                if joules is None and self.error is None
                else self.error if joules is None else None
            ),
        }


def load_input_paths(directory: Path) -> list[Path]:
    paths = sorted(
        path for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )
    if not paths:
        raise ValueError(f"No supported image files found under {directory}")
    return paths


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def detection_rows(result: Any) -> list[dict[str, Any]]:
    boxes = getattr(result, "boxes", None)
    if boxes is None:
        return []
    rows = []
    for box in boxes:
        rows.append({
            "class_id": int(box.cls[0]),
            "confidence": float(box.conf[0]),
            "xyxy": [float(value) for value in box.xyxy[0].tolist()],
        })
    return rows


def intersection_over_union(first: list[float], second: list[float]) -> float:
    left = max(first[0], second[0])
    top = max(first[1], second[1])
    right = min(first[2], second[2])
    bottom = min(first[3], second[3])
    intersection = max(0.0, right - left) * max(0.0, bottom - top)
    first_area = max(0.0, first[2] - first[0]) * max(0.0, first[3] - first[1])
    second_area = max(0.0, second[2] - second[0]) * max(0.0, second[3] - second[1])
    union = first_area + second_area - intersection
    return intersection / union if union > 0 else 0.0


def matched_detection_count(first: list[dict[str, Any]], second: list[dict[str, Any]]) -> int:
    candidates = sorted(
        (
            (
                intersection_over_union(a["xyxy"], b["xyxy"]),
                left_index,
                right_index,
            )
            for left_index, a in enumerate(first)
            for right_index, b in enumerate(second)
            if a["class_id"] == b["class_id"]
            and intersection_over_union(a["xyxy"], b["xyxy"]) >= 0.5
        ),
        reverse=True,
    )
    matched_left: set[int] = set()
    matched_right: set[int] = set()
    for _, left_index, right_index in candidates:
        if left_index not in matched_left and right_index not in matched_right:
            matched_left.add(left_index)
            matched_right.add(right_index)
    return len(matched_left)


def benchmark_mode(
    model_path: Path,
    image_paths: list[Path],
    precision: str,
    image_size: int,
    warmup_runs: int,
    repeats: int,
) -> dict[str, Any]:
    optimizer = ModelOptimizationService(precision)
    status = optimizer.resolve("benchmark_detector", "detector", "ultralytics")
    options = optimizer.ultralytics_predict_options("benchmark_detector", precision)
    options["device"] = 0 if torch.cuda.is_available() else "cpu"
    model = YOLO(str(model_path))
    first_image = cv2.imread(str(image_paths[0]))
    if first_image is None:
        raise ValueError(f"Could not decode benchmark image: {image_paths[0]}")

    for _ in range(warmup_runs):
        model.predict(first_image, imgsz=image_size, verbose=False, **options)
    if torch.cuda.is_available():
        torch.cuda.synchronize()
        torch.cuda.reset_peak_memory_stats()

    latencies_ms: list[float] = []
    detections_by_input: dict[str, list[dict[str, Any]]] = {}
    process = psutil.Process()
    rss_before = process.memory_info().rss

    with NvidiaSmiPowerSampler() as power_sampler:
        for _ in range(repeats):
            for path in image_paths:
                image = cv2.imread(str(path))
                if image is None:
                    raise ValueError(f"Could not decode benchmark image: {path}")
                start = time.perf_counter()
                results = model.predict(image, imgsz=image_size, verbose=False, **options)
                if torch.cuda.is_available():
                    torch.cuda.synchronize()
                latencies_ms.append((time.perf_counter() - start) * 1000.0)
                detections_by_input[str(path)] = [
                    detection_rows(result) for result in results
                ][0]
    power = power_sampler.result(len(latencies_ms))

    memory: dict[str, Any] = {
        "process_rss_bytes_before": rss_before,
        "process_rss_bytes_after": process.memory_info().rss,
        "gpu_peak_allocated_bytes": (
            torch.cuda.max_memory_allocated() if torch.cuda.is_available() else None
        ),
    }
    return {
        "requested_precision": status["requested_precision"],
        "selected_precision": status["selected_precision"],
        "fallback_reason": status["fallback_reason"],
        "inference": summarize_latencies(latencies_ms),
        "inference_count": len(latencies_ms),
        "energy": power,
        "memory": memory,
        "detections_by_input": detections_by_input,
    }


def validate_accuracy(
    model_path: Path, data_yaml: Path, precision: str, image_size: int
) -> dict[str, float]:
    optimizer = ModelOptimizationService(precision)
    status = optimizer.resolve("benchmark_detector", "detector", "ultralytics")
    options = optimizer.ultralytics_predict_options("benchmark_detector", precision)
    options["device"] = 0 if torch.cuda.is_available() else "cpu"
    model = YOLO(str(model_path))
    metrics = model.val(data=str(data_yaml), imgsz=image_size, verbose=False, **options)
    return {
        "map50_95": float(metrics.box.map),
        "map50": float(metrics.box.map50),
        "precision": float(metrics.box.mp),
        "recall": float(metrics.box.mr),
        "selected_precision": status["selected_precision"],
    }


def prediction_agreement(
    baseline: dict[str, list[dict[str, Any]]],
    optimized: dict[str, list[dict[str, Any]]],
) -> float:
    matches = 0
    denominator = 0
    for input_path, baseline_rows in baseline.items():
        optimized_rows = optimized.get(input_path, [])
        matches += matched_detection_count(baseline_rows, optimized_rows)
        denominator += max(len(baseline_rows), len(optimized_rows))
    return matches / denominator if denominator else 1.0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, type=Path, help="Ultralytics .pt weights")
    parser.add_argument("--images", required=True, type=Path, help="Directory of benchmark images")
    parser.add_argument("--data", type=Path, help="Labeled Ultralytics dataset YAML for mAP validation")
    parser.add_argument("--precisions", nargs="+", default=["baseline", "fp16"],
                        choices=["baseline", "auto", "fp16", "int8", "onnx", "tensorrt"])
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--warmup-runs", type=int, default=10)
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "reports" / "green_ai" / "latest.json",
    )
    args = parser.parse_args()
    if not args.model.is_file():
        parser.error(f"Model file does not exist: {args.model}")
    if not args.images.is_dir():
        parser.error(f"Image directory does not exist: {args.images}")
    if args.data is not None and not args.data.is_file():
        parser.error(f"Dataset YAML does not exist: {args.data}")
    if args.warmup_runs < 0 or args.repeats < 1 or args.imgsz < 1:
        parser.error("warmup-runs must be >= 0, repeats and imgsz must be >= 1")
    if "baseline" not in args.precisions:
        parser.error("--precisions must include baseline to calculate comparisons.")
    if len(args.precisions) != len(set(args.precisions)):
        parser.error("--precisions cannot contain duplicate modes.")

    input_paths = load_input_paths(args.images)
    input_hashes = {str(path): sha256_file(path) for path in input_paths}
    modes: dict[str, Any] = {}
    for precision in args.precisions:
        modes[precision] = benchmark_mode(
            args.model, input_paths, precision, args.imgsz, args.warmup_runs, args.repeats
        )

    baseline = modes["baseline"]

    for precision, result in modes.items():
        result["unlabeled_prediction_agreement_with_baseline"] = (
            1.0 if precision == "baseline" else prediction_agreement(
                baseline["detections_by_input"], result["detections_by_input"]
            )
        )
        result.pop("detections_by_input")

    if args.data is not None:
        accuracy_results = {
            precision: validate_accuracy(args.model, args.data, precision, args.imgsz)
            for precision in args.precisions
        }
        baseline_metric = accuracy_results["baseline"]["map50_95"]
        for precision, metrics in accuracy_results.items():
            if precision == "baseline":
                metrics["loss_percentage_points"] = 0.0
                metrics["loss_relative_percent"] = 0.0
            else:
                metrics.update(accuracy_loss(baseline_metric, metrics["map50_95"]))
        optimized_results = [
            metrics for precision, metrics in accuracy_results.items() if precision != "baseline"
        ]
        relative_losses_available = all(
            metrics["loss_relative_percent"] is not None for metrics in optimized_results
        )
        accuracy_pass = (
            all(meets_relative_accuracy_limit(metrics) is True for metrics in optimized_results)
            if optimized_results and relative_losses_available
            else None
        )
        accuracy_validation: dict[str, Any] = {
            "status": "measured",
            "metric": "mAP50-95",
            "criterion": "relative loss < 2%",
            "results": accuracy_results,
            "criterion_pass": accuracy_pass,
        }
    else:
        accuracy_validation = {
            "status": "unavailable",
            "reason": "No labeled Ultralytics dataset was supplied; prediction agreement is not accuracy.",
            "criterion": "relative loss in mAP50-95 < 2%",
            "criterion_pass": None,
        }

    model_sha256 = sha256_file(args.model)
    baseline_energy = baseline["energy"]["energy_joules"]
    comparisons = {}
    for precision, result in modes.items():
        if precision == "baseline":
            continue
        optimized_energy = result["energy"]["energy_joules"]
        energy_reduction = (
            energy_reduction_percent(baseline_energy, optimized_energy)
            if baseline_energy is not None
            and optimized_energy is not None
            and baseline_energy > 0
            else None
        )
        comparisons[precision] = {
            "energy_reduction_percent": energy_reduction,
            "energy_target_50_percent_met": (
                energy_reduction >= 50.0 if energy_reduction is not None else None
            ),
        }

    capabilities = {
        "cuda_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "torch_version": torch.__version__,
        "cuda_runtime_version": torch.version.cuda,
        "gpu_capability": (
            list(torch.cuda.get_device_capability(0)) if torch.cuda.is_available() else None
        ),
        "cpu": platform.processor(),
        "cpu_count": os.cpu_count(),
    }
    accuracy_measured = (
        accuracy_validation["status"] == "measured"
        and accuracy_validation["criterion_pass"] is not None
    )
    energy_measured = bool(comparisons) and all(
        result["energy_reduction_percent"] is not None
        for result in comparisons.values()
    )
    acceptance_status = "unverified"
    if accuracy_measured and energy_measured:
        acceptance_status = (
            "verified"
            if accuracy_validation["criterion_pass"]
            and all(result["energy_target_50_percent_met"] for result in comparisons.values())
            else "failed"
        )
    report = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": {
            "name": args.model.stem,
            "path": str(args.model.resolve()),
            "size_bytes": args.model.stat().st_size,
            "version": f"sha256:{model_sha256}",
            "sha256": model_sha256,
            "runtime": f"Ultralytics {ultralytics.__version__}",
            "workload": {
                "images_directory": str(args.images.resolve()),
                "image_count": len(input_paths),
                "input_sha256": input_hashes,
                "validation_dataset": (
                    str(args.data.resolve()) if args.data is not None else None
                ),
                "imgsz": args.imgsz,
                "warmup_runs": args.warmup_runs,
                "repeats": args.repeats,
            },
        },
        "hardware": capabilities,
        "measurement_notes": {
            "latency": "Wall-clock Ultralytics predict call; CUDA synchronized at boundaries.",
            "energy": (
                "Sampled GPU board power over the benchmark workload, not model-only "
                "or whole-system energy; includes image-read gaps and GPU idle draw."
            ),
            "accuracy": "Only measured when --data supplies a labeled Ultralytics dataset.",
            "acceptance_interpretation": "Accuracy loss criterion is relative mAP50-95 decrease < 2%.",
        },
        "modes": modes,
        "comparisons_with_baseline": comparisons,
        "accuracy_validation": accuracy_validation,
        "acceptance": {
            "status": acceptance_status,
            "energy_target": "at least 50% reduction",
            "accuracy_target": "less than 2% relative mAP50-95 loss",
            "accuracy_target_met": accuracy_validation["criterion_pass"],
            "energy_target_50_percent_met": {
                precision: result["energy_target_50_percent_met"]
                for precision, result in comparisons.items()
            },
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "report": str(args.output.resolve()),
        "acceptance": report["acceptance"],
        "comparisons_with_baseline": comparisons,
        "accuracy_validation": accuracy_validation["status"],
    }, indent=2))


if __name__ == "__main__":
    main()
