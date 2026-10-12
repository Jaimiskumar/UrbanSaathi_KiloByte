import pytest
import torch
import cv2
import numpy as np

import ml_optimization
from ml_optimization import (
    ModelOptimizationService,
    accuracy_loss,
    energy_reduction_percent,
    integrate_power_samples,
    meets_relative_accuracy_limit,
    summarize_latencies,
)


def test_baseline_classifier_preserves_output_shape_and_values():
    model = torch.nn.Linear(4, 2).eval()
    tensor = torch.arange(4, dtype=torch.float32)
    expected = model(tensor.unsqueeze(0))

    actual = ModelOptimizationService("baseline").classifier_logits(
        model, tensor, "test_classifier"
    )

    assert actual.shape == expected.shape
    torch.testing.assert_close(actual, expected)


def test_fp16_uses_baseline_when_cuda_is_unavailable(monkeypatch):
    monkeypatch.setattr(
        ml_optimization,
        "available_runtime_capabilities",
        lambda: {
            "cuda_available": False,
            "gpu_name": None,
            "onnxruntime_available": True,
            "onnxruntime_providers": ["CPUExecutionProvider"],
            "tensorrt_available": False,
        },
    )
    optimizer = ModelOptimizationService("fp16")

    options = optimizer.ultralytics_predict_options("vehicle_detector")

    assert options == {}
    assert optimizer.report()["models"][0]["selected_precision"] == "baseline"
    assert "CUDA" in optimizer.report()["models"][0]["fallback_reason"]


@pytest.mark.skipif(not torch.cuda.is_available(), reason="CUDA is not available")
def test_fp16_classifier_runs_and_preserves_output_compatibility():
    model = torch.nn.Linear(4, 2).eval()
    tensor = torch.arange(4, dtype=torch.float32)
    expected = model(tensor.unsqueeze(0))
    optimizer = ModelOptimizationService("fp16")

    actual = optimizer.classifier_logits(model, tensor, "test_classifier")

    assert actual.shape == expected.shape
    torch.testing.assert_close(actual, expected, rtol=1e-2, atol=1e-2)
    assert optimizer.report()["models"][0]["selected_precision"] == "fp16"


@pytest.mark.skipif(not torch.cuda.is_available(), reason="CUDA is not available")
def test_ultralytics_fp16_options_select_cuda_half_precision():
    optimizer = ModelOptimizationService("fp16")

    assert optimizer.ultralytics_predict_options("vehicle_detector") == {
        "half": True,
        "device": 0,
    }


def test_ultralytics_fp16_runtime_failure_retries_baseline_and_sticks_to_it(monkeypatch):
    monkeypatch.setattr(
        ml_optimization,
        "available_runtime_capabilities",
        lambda: {
            "cuda_available": True,
            "gpu_name": "test GPU",
            "onnxruntime_available": False,
            "onnxruntime_providers": [],
            "tensorrt_available": False,
        },
    )

    class FailingHalfModel:
        def __init__(self):
            self.calls = []

        def predict(self, image, **kwargs):
            self.calls.append(kwargs)
            if kwargs.get("half"):
                raise RuntimeError("simulated half-precision failure")
            return ["baseline result"]

    model = FailingHalfModel()
    optimizer = ModelOptimizationService("fp16")

    result = optimizer.ultralytics_infer(
        model, "vehicle_detector", "predict", "frame", imgsz=640
    )
    next_result = optimizer.ultralytics_infer(
        model, "vehicle_detector", "predict", "frame", imgsz=640
    )

    assert result == ["baseline result"]
    assert next_result == ["baseline result"]
    assert model.calls == [
        {"imgsz": 640, "half": True, "device": 0},
        {"imgsz": 640},
        {"imgsz": 640},
    ]
    status = optimizer.report()["models"][0]
    assert status["selected_precision"] == "baseline"
    assert "simulated half-precision failure" in status["fallback_reason"]


def test_unavailable_optimized_runtimes_report_baseline_fallback(monkeypatch):
    monkeypatch.setattr(
        ml_optimization,
        "available_runtime_capabilities",
        lambda: {
            "cuda_available": True,
            "gpu_name": "test GPU",
            "onnxruntime_available": True,
            "onnxruntime_providers": ["CPUExecutionProvider"],
            "tensorrt_available": False,
        },
    )
    optimizer = ModelOptimizationService()

    for precision in ("int8", "onnx", "tensorrt"):
        status = optimizer.resolve(
            "test_detector", "detector", "ultralytics", precision
        )
        assert status["requested_precision"] == precision
        assert status["selected_precision"] == "baseline"
        assert status["fallback_reason"]


def test_per_model_precision_configuration(monkeypatch):
    monkeypatch.setenv("URBANSAATHI_MODEL_PRECISION", "baseline")
    monkeypatch.setenv("URBANSAATHI_MODEL_PRECISION_POTHOLE_DETECTOR", "fp16")
    optimizer = ModelOptimizationService()

    assert optimizer.requested_precision("pothole_detector") == "fp16"
    assert optimizer.requested_precision("vehicle_detector") == "baseline"


def test_latency_and_energy_calculations():
    summary = summarize_latencies([1.0, 2.0, 3.0, 4.0])

    assert summary["mean_ms"] == 2.5
    assert summary["p95_ms"] == 4.0
    assert summary["throughput_per_second"] == 400.0
    assert energy_reduction_percent(10.0, 4.0) == 60.0
    assert integrate_power_samples([(0.0, 20.0), (1.0, 30.0)]) == 25.0
    assert integrate_power_samples([(0.0, 20.0)]) is None


def test_invalid_measurement_inputs_are_rejected():
    with pytest.raises(ValueError):
        summarize_latencies([])

    with pytest.raises(ValueError):
        energy_reduction_percent(0.0, 1.0)


def test_accuracy_loss_reports_percentage_points_and_relative_loss():
    result = accuracy_loss(0.80, 0.79)

    assert abs(result["loss_percentage_points"] - 1.0) < 1e-9
    assert abs(result["loss_relative_percent"] - 1.25) < 1e-9
    assert meets_relative_accuracy_limit(result) is True
    assert meets_relative_accuracy_limit(accuracy_loss(0.80, 0.78)) is False
    assert meets_relative_accuracy_limit(accuracy_loss(0.0, 0.0)) is None


def test_detection_matching_is_one_to_one_and_class_aware():
    from scripts.benchmark_ml_optimization import matched_detection_count

    first = [
        {"class_id": 1, "xyxy": [0.0, 0.0, 10.0, 10.0]},
        {"class_id": 2, "xyxy": [20.0, 20.0, 30.0, 30.0]},
    ]
    second = [
        {"class_id": 1, "xyxy": [1.0, 1.0, 11.0, 11.0]},
        {"class_id": 9, "xyxy": [20.0, 20.0, 30.0, 30.0]},
    ]

    assert matched_detection_count(first, second) == 1


def test_benchmark_inputs_are_sorted_for_reproducibility(tmp_path):
    from scripts.benchmark_ml_optimization import load_input_paths

    cv2.imwrite(str(tmp_path / "z-last.png"), np.zeros((8, 8, 3), dtype=np.uint8))
    cv2.imwrite(str(tmp_path / "a-first.png"), np.zeros((8, 8, 3), dtype=np.uint8))

    assert [path.name for path in load_input_paths(tmp_path)] == [
        "a-first.png",
        "z-last.png",
    ]
