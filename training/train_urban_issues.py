"""Prepare and train the supplied Urban Issues YOLO dataset."""

import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "dataset" / "urban issues"
DATA = ROOT / "data" / "urban_issues_real"
MODEL = ROOT / "models" / "real" / "urban_issues_yolov8n.pt"

GROUPS = {
    "IllegalParking": 0,
    "DamagedRoadSigns": 1,
    "FallenTrees": 2,
    "Garbage": 3,
    "Graffitti": 4,
    "DeadAnimalsPollution": 5,
    "Damaged concrete structures": 6,
    "DamagedElectricalPoles": 7,
}
NAMES = [
    "Illegal Parking Issues", "Broken Road Sign Issues", "Fallen trees",
    "Littering/Garbage on Public Places", "Vandalism Issues", "Dead Animal Pollution",
    "Damaged concrete structures", "Damaged Electric wires and poles",
]


def recover(max_per_class: int):
    if not SOURCE.exists():
        raise FileNotFoundError(f"Urban issues dataset not found: {SOURCE}")
    if DATA.exists():
        shutil.rmtree(DATA)
    for split in ("train", "val", "test"):
        (DATA / "images" / split).mkdir(parents=True)
        (DATA / "labels" / split).mkdir(parents=True)

    counts = {(split, class_id): 0 for split in ("train", "val", "test") for class_id in GROUPS.values()}
    for source_group, class_id in GROUPS.items():
        group_root = SOURCE / source_group
        for source_split in ("train", "valid", "test"):
            image_dir = next((path for path in (group_root / source_split / "images", group_root / source_group / source_split / "images") if path.exists()), None)
            label_dir = next((path for path in (group_root / source_split / "labels", group_root / source_group / source_split / "labels") if path.exists()), None)
            if not image_dir or not label_dir:
                continue
            output_split = "val" if source_split == "valid" else source_split
            for label_source in sorted(label_dir.glob("*.txt")):
                if counts[(output_split, class_id)] >= max_per_class:
                    break
                image_source = next((image_dir / f"{label_source.stem}{suffix}" for suffix in (".jpg", ".jpeg", ".png" ) if (image_dir / f"{label_source.stem}{suffix}").exists()), None)
                if not image_source:
                    continue
                image_name = f"{class_id}_{source_group}_{label_source.stem}{image_source.suffix}"
                image_target = DATA / "images" / output_split / image_name
                label_target = DATA / "labels" / output_split / f"{Path(image_name).stem}.txt"
                shutil.copy2(image_source, image_target)
                rows = []
                for row in label_source.read_text(encoding="utf-8").splitlines():
                    parts = row.split()
                    if len(parts) == 5:
                        rows.append(f"{class_id} {' '.join(parts[1:])}")
                label_target.write_text("\n".join(rows), encoding="utf-8")
                counts[(output_split, class_id)] += 1

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