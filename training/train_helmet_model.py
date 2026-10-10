"""Convert and train the supplied real helmet annotations as a YOLO detector."""

import random
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT.parent / "dataset" / "helmet"
WORK = ROOT / "data" / "helmet_real"
OUT = ROOT / "models" / "real"
CLASSES = ["With Helmet", "Without Helmet"]


def prepare():
    if WORK.exists():
        shutil.rmtree(WORK)
    for split in ("train", "val"):
        (WORK / "images" / split).mkdir(parents=True)
        (WORK / "labels" / split).mkdir(parents=True)
    pairs = []
    for xml_path in (DATA / "annotations").glob("*.xml"):
        root = ET.parse(xml_path).getroot()
        image = DATA / "images" / root.findtext("filename", "")
        if image.exists():
            pairs.append((image, root))
    random.Random(42).shuffle(pairs)
    for index, (image, root) in enumerate(pairs):
        split = "train" if index < int(len(pairs) * 0.8) else "val"
        name = f"{index}_{image.name}"
        shutil.copy2(image, WORK / "images" / split / name)
        size = root.find("size")
        width = float(size.findtext("width"))
        height = float(size.findtext("height"))
        rows = []
        for obj in root.findall("object"):
            class_id = CLASSES.index(obj.findtext("name"))
            box = obj.find("bndbox")
            xmin, ymin = float(box.findtext("xmin")), float(box.findtext("ymin"))
            xmax, ymax = float(box.findtext("xmax")), float(box.findtext("ymax"))
            rows.append(f"{class_id} {(xmin+xmax)/2/width} {(ymin+ymax)/2/height} {(xmax-xmin)/width} {(ymax-ymin)/height}")
        (WORK / "labels" / split / (Path(name).stem + ".txt")).write_text("\n".join(rows), encoding="utf-8")
    yaml = WORK / "data.yaml"
    yaml.write_text(f"path: {WORK.as_posix()}\ntrain: images/train\nval: images/val\nnames: {CLASSES!r}\n", encoding="utf-8")
    return yaml, len(pairs)


def main():
    yaml, count = prepare()
    model = YOLO("yolov8n.pt")
    result = model.train(data=str(yaml), epochs=10, imgsz=640, batch=8, workers=0, device="cpu", project=str(OUT), name="helmet", exist_ok=True)
    shutil.copy2(Path(result.save_dir) / "weights" / "best.pt", OUT / "helmet_detector_yolov8n.pt")
    speed_model = DATA.parent / "Speed-detection-YOLO-main" / "Speed-detection-YOLO-main" / "yolov8s.pt"
    if speed_model.exists():
        shutil.copy2(speed_model, OUT / "speed_detector_yolov8s.pt")
    print(f"Trained helmet samples: {count}")


if __name__ == "__main__":
    main()