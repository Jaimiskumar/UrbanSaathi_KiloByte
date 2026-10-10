"""Train dashboard models from the original datasets in ../dataset.

This script deliberately fails when a required real dataset is missing and
never falls back to data/synthetic. It produces TorchScript image classifiers
for video frames and a scikit-learn congestion classifier for telemetry.
"""

import json
import os
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import torch
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT.parent / "dataset"
MODEL_DIR = ROOT / "models" / "real"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)


def train_image_model(name: str, data_dir: Path, epochs: int = 15, max_per_class: int = 500, eval_dir: Path | None = None):
    if not data_dir.exists():
        raise FileNotFoundError(f"Real dataset not found: {data_dir}")

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    dataset = datasets.ImageFolder(data_dir, transform=transform)
    if len(dataset.classes) < 2:
        raise ValueError(f"{name} needs at least two labeled classes")

    by_class = {label: [] for label in range(len(dataset.classes))}
    for index, (_, label) in enumerate(dataset.samples):
        if len(by_class[label]) < max_per_class:
            by_class[label].append(index)
    selected = np.array([index for indices in by_class.values() for index in indices])
    labels = [dataset.targets[index] for index in selected]
    train_loader = DataLoader(torch.utils.data.Subset(dataset, selected), batch_size=32, shuffle=True)
    evaluation_dataset = datasets.ImageFolder(eval_dir, transform=transform) if eval_dir and eval_dir.exists() else dataset
    test_loader = DataLoader(evaluation_dataset, batch_size=32)

    model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    for parameter in model.parameters():
        parameter.requires_grad = False
    for parameter in model.layer4.parameters():
        parameter.requires_grad = True
    model.fc = nn.Linear(model.fc.in_features, len(dataset.classes))
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    optimizer = torch.optim.AdamW(filter(lambda parameter: parameter.requires_grad, model.parameters()), lr=1e-4)
    criterion = nn.CrossEntropyLoss()
    model.train()
    for _ in range(epochs):
        for images, targets in train_loader:
            images, targets = images.to(device), targets.to(device)
            optimizer.zero_grad()
            loss = criterion(model(images), targets)
            loss.backward()
            optimizer.step()

    predictions, actual = [], []
    model.eval()
    with torch.no_grad():
        for images, targets in test_loader:
            predictions.extend(model(images.to(device)).argmax(1).cpu().tolist())
            actual.extend(targets.tolist())

    artifact = MODEL_DIR / f"{name}.pt"
    scripted = torch.jit.script(model.cpu())
    scripted.save(str(artifact))
    metrics = {
        "dataset_type": "real",
        "dataset": str(data_dir),
        "classes": dataset.classes,
        "samples": len(dataset),
        "evaluation_dataset": str(eval_dir) if eval_dir and eval_dir.exists() else str(data_dir),
        "accuracy": round(float(accuracy_score(actual, predictions)), 4),
        "f1_score": round(float(f1_score(actual, predictions, average="weighted")), 4),
        "epochs": epochs,
        "trained_at": datetime.now().isoformat(),
    }
    return metrics


def train_congestion_model():
    csv_path = DATASET / "Traffic congestion" / "vanet_traffic_data.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"Real dataset not found: {csv_path}")
    frame = pd.read_csv(csv_path)
    features = [
        "avg_speed_kmph", "density_veh_per_km", "avg_wait_time_s",
        "occupancy_pct", "flow_veh_per_hr", "queue_length_veh",
        "avg_accel_ms2", "signal_state_num", "incident_num",
        "visibility_km", "rain_intensity_mmph", "congestion_pressure",
    ]
    missing = [column for column in features + ["label"] if column not in frame.columns]
    if missing:
        raise ValueError(f"Missing real congestion columns: {missing}")
    frame = frame.dropna(subset=features + ["label"])
    train, test = train_test_split(frame, test_size=0.2, random_state=SEED, stratify=frame["label"])
    model = RandomForestClassifier(n_estimators=250, random_state=SEED, class_weight="balanced")
    model.fit(train[features], train["label"])
    predictions = model.predict(test[features])
    joblib.dump({"model": model, "features": features}, MODEL_DIR / "congestion_model.joblib")
    return {
        "dataset_type": "real",
        "dataset": str(csv_path),
        "samples": len(frame),
        "classes": sorted(frame["label"].unique().tolist()),
        "accuracy": round(float(accuracy_score(test["label"], predictions)), 4),
        "f1_score": round(float(f1_score(test["label"], predictions, average="weighted")), 4),
        "training_method": "RandomForestClassifier (no epochs)",
        "trained_at": datetime.now().isoformat(),
    }


def main():
    metrics = {
        "dataset_type": "real",
        "generated_at": datetime.now().isoformat(),
        "models": {
            "accident_classifier": train_image_model(
                "accident_classifier", DATASET / "accident detection" / "data" / "train",
                eval_dir=DATASET / "accident detection" / "data" / "val"
            ),
            "vehicle_classifier": train_image_model(
                "vehicle_classifier", DATASET / "classification of vehicle" / "Vehicles"
            ),
            "congestion_model": train_congestion_model(),
        },
    }
    with open(MODEL_DIR / "metrics.json", "w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2)
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()