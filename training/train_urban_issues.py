"""Recover and train the real Kaggle Urban Issues YOLO dataset on Windows."""

import argparse
import shutil
import zipfile
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path.home() / ".cache" / "kagglehub" / "datasets" / "akinduhiman" / "urban-issues-dataset"
ARCHIVE = CACHE / "19.archive"
DATA = ROOT / "data" / "urban_issues_real"
MODEL = ROOT / "models" / "real" / "urban_issues_yolov8n.pt"

GROUPS = {
    "Potholes and RoadCracks": 0,
    "IllegalParking": 1,
    "DamagedRoadSigns": 2,
    "FallenTrees": 3,
    "Garbage": 4,
    "Graffitti": 5,
    "DeadAnimalsPollution": 6,
    "Damaged concrete structures": 7,
    "DamagedElectricalPoles": 8,
}
NAMES = [
    "Damaged Road issues", "Pothole Issues", "Illegal Parking Issues",
    "Broken Road Sign Issues", "Fallen trees", "Littering/Garbage on Public Places",
    "Vandalism Issues", "Dead Animal Pollution", "Damaged concrete structures",
    "Damaged Electric wires and poles",
]


def recover(max_per_class: int):
    if not ARCHIVE.exists():
        raise FileNotFoundError(f"Kaggle archive not found: {ARCHIVE}")
    if DATA.exists():
        shutil.rmtree(DATA)
    for split in ("train", "val", "test"):
        (DATA / "images" / split).mkdir(parents=True)
        (DATA / "labels" / split).mkdir(parents=True)

    counts = {class_id: 0 for class_id in GROUPS.values()}
    with zipfile.ZipFile(ARCHIVE) as archive:
        names = archive.namelist()
        for source_group, class_id in GROUPS.items():
            labels = [
                name for name in names
                if name.startswith(source_group + "/") and "/labels/" in name and name.endswith(".txt")
            ]
            for label_name in labels:
                if counts[class_id] >= max_per_class:
                    break
                relative = Path(label_name)
                split = next((part for part in ("train", "valid", "test") if part in relative.parts), None)
                if split is None:
                    continue
                output_split = "val" if split == "valid" else split
                image_name = label_name.rsplit("/labels/", 1)[1][:-4] + ".jpg"
                image_name = f"{class_id}_{Path(image_name).name}"
                image_source = label_name.replace("/labels/", "/images/")[:-4] + ".jpg"
                if image_source not in names:
                    continue
                image_target = DATA / "images" / output_split / image_name
                label_target = DATA / "labels" / output_split / (image_name[:-4] + ".txt")
                image_target.write_bytes(archive.read(image_source))
                rows = []
                for row in archive.read(label_name).decode("utf-8").splitlines():
                    parts = row.split()
                    if len(parts) == 5:
                        rows.append(f"{class_id} {' '.join(parts[1:])}")
                label_target.write_text("\n".join(rows), encoding="utf-8")
                counts[class_id] += 1

    yaml = DATA / "data.yaml"
    yaml.write_text(
        f"path: {DATA.as_posix()}\ntrain: images/train\nval: images/val\ntest: images/test\n"
        f"names: {NAMES!r}\n",
        encoding="utf-8",
    )
    print(f"Recovered real labels: {counts}")
    return yaml


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-per-class", type=int, default=250)
    parser.add_argument("--epochs", type=int, default=10)
    args = parser.parse_args()
    yaml = recover(args.max_per_class)
    model = YOLO("yolov8n.pt")
    result = model.train(data=str(yaml), epochs=args.epochs, imgsz=640, batch=4, workers=0, device="cpu", project=str(ROOT / "models" / "real"), name="urban_issues", exist_ok=True)
    best = Path(result.save_dir) / "weights" / "best.pt"
    if best.exists():
        shutil.copy2(best, MODEL)
    print(f"Urban Issues model saved to {MODEL}")


if __name__ == "__main__":
    main()