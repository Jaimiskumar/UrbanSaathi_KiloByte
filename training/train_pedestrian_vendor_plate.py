"""Train additional dashboard models exclusively from the supplied real data."""

import json
import random
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT.parent / "dataset"
OUT = ROOT / "models" / "real"
WORK = ROOT / "data" / "additional_real"
OUT.mkdir(parents=True, exist_ok=True)


def prepare_yolo(name, image_files, labels, class_names, limit=150):
    if WORK.exists():
        shutil.rmtree(WORK)
    for split in ("train", "val"):
        (WORK / name / "images" / split).mkdir(parents=True)
        (WORK / name / "labels" / split).mkdir(parents=True)
    random.Random(42).shuffle(image_files)
    image_files = image_files[:limit]
    split_at = max(1, int(len(image_files) * 0.8))
    for index, image in enumerate(image_files):
        split = "train" if index < split_at else "val"
        target_name = f"{index}_{image.name}"
        shutil.copy2(image, WORK / name / "images" / split / target_name)
        (WORK / name / "labels" / split / (Path(target_name).stem + ".txt")).write_text(labels[image], encoding="utf-8")
    yaml = WORK / name / "data.yaml"
    yaml.write_text(
        f"path: {(WORK / name).as_posix()}\ntrain: images/train\nval: images/val\n"
        f"names: {class_names!r}\n", encoding="utf-8"
    )
    return yaml


def train_yolo(name, yaml, output_name, epochs=10):
    model = YOLO("yolov8n.pt")
    result = model.train(data=str(yaml), epochs=epochs, imgsz=640, batch=4, workers=0, device="cpu", project=str(OUT), name=name, exist_ok=True)
    best = Path(result.save_dir) / "weights" / "best.pt"
    shutil.copy2(best, OUT / output_name)


def train_vendor():
    source = DATA / "Street Vendors Dataset" / "Street Vendors Dataset" / "Dataset"
    classes = (source / "classes.txt").read_text(encoding="utf-8").splitlines()
    images = list(source.glob("*.jpg"))
    labels = {image: (source / (image.stem + ".txt")).read_text(encoding="utf-8") for image in images if (source / (image.stem + ".txt")).exists()}
    images = list(labels)
    yaml = prepare_yolo("vendors", images, labels, classes, limit=450)
    train_yolo("vendors", yaml, "vendor_detector_yolov8n.pt")
    return {"dataset_type": "real", "samples": len(images), "classes": classes, "epochs": 10}


def train_plates():
    image_root = DATA / "number plate" / "Indian_Number_Plates" / "Sample_Images"
    annotation_root = DATA / "number plate" / "Annotations" / "Annotations"
    labels = {}
    for xml_path in annotation_root.glob("*.xml"):
        root = ET.parse(xml_path).getroot()
        image = image_root / root.findtext("filename", "")
        size = root.find("size")
        width, height = float(size.findtext("width")), float(size.findtext("height"))
        rows = []
        for box in root.findall("object/bndbox"):
            xmin, ymin = float(box.findtext("xmin")), float(box.findtext("ymin"))
            xmax, ymax = float(box.findtext("xmax")), float(box.findtext("ymax"))
            rows.append(f"0 {(xmin + xmax) / 2 / width} {(ymin + ymax) / 2 / height} {(xmax - xmin) / width} {(ymax - ymin) / height}")
        if image.exists() and rows:
            labels[image] = "\n".join(rows)
    yaml = prepare_yolo("plates", list(labels), labels, ["number_plate"], limit=len(labels))
    train_yolo("plates", yaml, "plate_detector_yolov8n.pt")
    return {"dataset_type": "real", "samples": len(labels), "classes": ["number_plate"], "epochs": 10}


def train_behavior():
    root = DATA / "pedestrian and driving behaviour" / "JAAD-JAAD_2.0" / "annotations_attributes"
    rows = []
    for xml_path in root.glob("*.xml"):
        for pedestrian in ET.parse(xml_path).getroot().findall("pedestrian"):
            row = dict(pedestrian.attrib)
            row["source"] = str(xml_path)
            rows.append(row)
    frame = pd.DataFrame(rows)
    target = "traffic_direction"
    feature_names = ["age", "gender", "group_size", "intersection", "motion_direction", "num_lanes", "signalized", "designated"]
    frame = frame[frame[target].notna()].copy()
    encoded = pd.get_dummies(frame[feature_names].fillna("unknown").astype(str))
    train, test = train_test_split(range(len(frame)), test_size=0.2, random_state=42, stratify=frame[target])
    model = RandomForestClassifier(n_estimators=200, random_state=42, class_weight="balanced")
    model.fit(encoded.iloc[train], frame[target].iloc[train])
    predictions = model.predict(encoded.iloc[test])
    joblib.dump({"model": model, "features": encoded.columns.tolist()}, OUT / "pedestrian_behavior_model.joblib")
    return {"dataset_type": "real", "samples": len(frame), "target": target, "classes": sorted(frame[target].unique().tolist()), "accuracy": accuracy_score(frame[target].iloc[test], predictions), "f1_score": f1_score(frame[target].iloc[test], predictions, average="weighted")}


def main():
    metrics = {"dataset_type": "real", "models": {"vendor_detector": train_vendor(), "plate_detector": train_plates(), "pedestrian_behavior": train_behavior()}}
    (OUT / "additional_metrics.json").write_text(json.dumps(metrics, indent=2, default=float), encoding="utf-8")
    print(json.dumps(metrics, indent=2, default=float))


if __name__ == "__main__":
    main()