"""Model-level inference precision selection and benchmark metric helpers."""

from __future__ import annotations

import copy
import importlib.util
import logging
import os
import re
import statistics
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

PRECISIONS = {"auto", "baseline", "fp16", "int8", "onnx", "tensorrt"}


@lru_cache(maxsize=1)
def available_runtime_capabilities() -> dict[str, Any]:
    try:
        import torch

        cuda_available = torch.cuda.is_available()
        gpu_name = torch.cuda.get_device_name(0) if cuda_available else None
    except ImportError:
        cuda_available = False
        gpu_name = None

    onnx_providers: list[str] = []
    if importlib.util.find_spec("onnxruntime"):
        import onnxruntime

        onnx_providers = onnxruntime.get_available_providers()

    return {
        "cuda_available": cuda_available,
        "gpu_name": gpu_name,
        "onnxruntime_available": bool(onnx_providers),
        "onnxruntime_providers": onnx_providers,
        "tensorrt_available": importlib.util.find_spec("tensorrt") is not None,
    }


class ModelOptimizationService:
    """Resolve configured inference modes and retain the original model as fallback."""

    def __init__(self, requested_precision: str | None = None) -> None:
        default_precision = (
            requested_precision
            if requested_precision is not None
            else os.getenv("URBANSAATHI_MODEL_PRECISION", "baseline")
        )
        self.default_precision = self._validate_precision(default_precision)
        self._model_status: dict[str, dict[str, Any]] = {}
        self._accelerated_models: dict[str, Any] = {}
        self._runtime_fallbacks: dict[str, str] = {}

    @staticmethod
    def _validate_precision(precision: str) -> str:
        normalized = precision.strip().lower()
        if normalized not in PRECISIONS:
            raise ValueError(
                f"Unsupported model precision {precision!r}; expected one of "
                f"{', '.join(sorted(PRECISIONS))}"
            )
        return normalized

    def requested_precision(self, model_name: str) -> str:
        env_key = f"URBANSAATHI_MODEL_PRECISION_{re.sub(r'[^A-Za-z0-9]', '_', model_name).upper()}"
        return self._validate_precision(os.getenv(env_key, self.default_precision))

    def resolve(
        self,
        model_name: str,
        model_type: str,
        runtime: str,
        precision: str | None = None,
    ) -> dict[str, Any]:
        requested = self._validate_precision(
            precision if precision is not None else self.requested_precision(model_name)
        )
        capabilities = available_runtime_capabilities()
        selected = requested
        reason = None

        if selected == "auto":
            selected = (
                "fp16"
                if capabilities["cuda_available"] and runtime in {"pytorch", "ultralytics"}
                else "baseline"
            )
            if selected == "baseline":
                reason = "FP16 CUDA inference is unavailable for this model/runtime."
        elif selected == "fp16":
            if not capabilities["cuda_available"] or runtime not in {"pytorch", "ultralytics"}:
                selected = "baseline"
                reason = "FP16 requires a CUDA-capable PyTorch or Ultralytics runtime."
        elif selected == "int8":
            selected = "baseline"
            reason = (
                "No representative-data-calibrated INT8 artifact is configured for this model."
            )
        elif selected == "onnx":
            selected = "baseline"
            providers = capabilities["onnxruntime_providers"]
            reason = (
                "An exported ONNX model and a compatible ONNX Runtime execution provider "
                f"are required; available providers: {providers or 'none'}."
            )
        elif selected == "tensorrt":
            selected = "baseline"
            reason = "TensorRT is not configured with an exported engine for this model."

        status = {
            "model": model_name,
            "runtime": runtime,
            "requested_precision": requested,
            "selected_precision": selected,
            "fallback_reason": reason,
        }
        self._model_status[model_name] = status
        return status

    def ultralytics_predict_options(
        self, model_name: str, precision: str | None = None
    ) -> dict[str, Any]:
        status = self.resolve(model_name, "detector", "ultralytics", precision)
        if model_name in self._runtime_fallbacks:
            status["selected_precision"] = "baseline"
            status["fallback_reason"] = self._runtime_fallbacks[model_name]
        return {"half": True, "device": 0} if status["selected_precision"] == "fp16" else {}

    def ultralytics_infer(
        self,
        model: Any,
        model_name: str,
        method: str,
        *args: Any,
        precision: str | None = None,
        **kwargs: Any,
    ) -> Any:
        infer = getattr(model, method)
        options = self.ultralytics_predict_options(model_name, precision)
        if not options:
            return infer(*args, **kwargs)

        try:
            return infer(*args, **kwargs, **options)
        except RuntimeError as error:
            fallback_reason = f"CUDA FP16 inference failed: {error}"
            self._runtime_fallbacks[model_name] = fallback_reason
            status = self._model_status[model_name]
            status["selected_precision"] = "baseline"
            status["fallback_reason"] = fallback_reason
            logger.warning(
                "FP16 inference failed for %s; retrying %s at baseline precision: %s",
                model_name,
                method,
                error,
            )
            return infer(*args, **kwargs)

    def classifier_logits(self, model: Any, tensor: Any, model_name: str) -> Any:
        import torch

        status = self.resolve(model_name, "classifier", "pytorch")
        fallback_reason = self._runtime_fallbacks.get(model_name)
        if fallback_reason is not None:
            status["selected_precision"] = "baseline"
            status["fallback_reason"] = fallback_reason
        if status["selected_precision"] != "fp16":
            with torch.inference_mode():
                return model(tensor.unsqueeze(0))

        try:
            accelerated_model = self._accelerated_models.get(model_name)
            if accelerated_model is None:
                accelerated_model = copy.deepcopy(model).eval().to("cuda").half()
                self._accelerated_models[model_name] = accelerated_model
            with torch.inference_mode():
                logits = accelerated_model(tensor.unsqueeze(0).to("cuda", dtype=torch.float16))
            return logits.float().cpu()
        except RuntimeError as error:
            fallback_reason = f"CUDA FP16 inference failed: {error}"
            self._runtime_fallbacks[model_name] = fallback_reason
            self._accelerated_models.pop(model_name, None)
            status["selected_precision"] = "baseline"
            status["fallback_reason"] = fallback_reason
            logger.warning(
                "FP16 inference failed for %s; retrying with the original model: %s",
                model_name,
                error,
            )
            with torch.inference_mode():
                return model(tensor.unsqueeze(0))

    def report(self) -> dict[str, Any]:
        return {
            "default_requested_precision": self.default_precision,
            "capabilities": available_runtime_capabilities(),
            "models": list(self._model_status.values()),
        }


def summarize_latencies(latencies_ms: list[float]) -> dict[str, float]:
    if not latencies_ms:
        raise ValueError("At least one latency measurement is required.")
    ordered = sorted(latencies_ms)
    p95_index = max(0, min(len(ordered) - 1, int(0.95 * len(ordered) + 0.5) - 1))
    return {
        "mean_ms": statistics.fmean(ordered),
        "p95_ms": ordered[p95_index],
        "throughput_per_second": 1000.0 / statistics.fmean(ordered),
    }


def energy_reduction_percent(baseline_joules: float, optimized_joules: float) -> float:
    if baseline_joules <= 0:
        raise ValueError("Baseline energy must be greater than zero.")
    return 100.0 * (baseline_joules - optimized_joules) / baseline_joules


def accuracy_loss(
    baseline_metric: float, optimized_metric: float
) -> dict[str, float | None]:
    if baseline_metric < 0 or optimized_metric < 0:
        raise ValueError("Accuracy metrics cannot be negative.")
    loss = baseline_metric - optimized_metric
    return {
        "loss_percentage_points": loss * 100.0,
        "loss_relative_percent": (
            loss / baseline_metric * 100.0 if baseline_metric > 0 else None
        ),
    }


def meets_relative_accuracy_limit(
    loss: dict[str, float | None], limit_percent: float = 2.0
) -> bool | None:
    relative_loss = loss["loss_relative_percent"]
    return relative_loss < limit_percent if relative_loss is not None else None


def integrate_power_samples(samples: list[tuple[float, float]]) -> float | None:
    """Integrate timestamped power readings (watts) into joules."""
    if len(samples) < 2:
        return None
    ordered = sorted(samples)
    return sum(
        ((previous[1] + current[1]) / 2.0) * (current[0] - previous[0])
        for previous, current in zip(ordered, ordered[1:])
    )
