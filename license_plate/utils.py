import os
import csv
import json
import cv2
import numpy as np
from typing import List, Dict, Any, Optional

def annotate_image(image: np.ndarray, plates_data: List[Dict[str, Any]]) -> np.ndarray:
    """
    Draws bounding boxes and structured recognition labels:
    [license plate bounding box]
    Plate: DL01AB1234
    Detection: 0.91
    OCR: 0.94
    """
    annotated = image.copy()
    for plate in plates_data:
        x1, y1, x2, y2 = plate["bbox"]
        plate_text = plate.get("plate_text", "UNREADABLE")
        det_conf = plate.get("detection_confidence", 0.0)
        ocr_conf = plate.get("ocr_confidence", 0.0)

        # Draw green bounding box for plate
        color = (0, 200, 0) if plate_text != "UNREADABLE" else (0, 0, 220)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

        # Label lines
        l1 = f"Plate: {plate_text}"
        l2 = f"Detection: {det_conf:.2f} | OCR: {ocr_conf:.2f}"

        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.55
        thickness = 1

        # Text size calculation
        (w1, h1), _ = cv2.getTextSize(l1, font, font_scale, thickness)
        (w2, h2), _ = cv2.getTextSize(l2, font, font_scale, thickness)
        box_w = max(w1, w2) + 12
        box_h = h1 + h2 + 18

        # Draw background pill above or below the bounding box
        label_y1 = max(0, y1 - box_h - 4)
        label_y2 = label_y1 + box_h
        label_x2 = min(image.shape[1], x1 + box_w)

        # Dark translucent overlay
        overlay = annotated.copy()
        cv2.rectangle(overlay, (x1, label_y1), (label_x2, label_y2), (20, 20, 20), -1)
        cv2.addWeighted(overlay, 0.75, annotated, 0.25, 0, annotated)
        cv2.rectangle(annotated, (x1, label_y1), (label_x2, label_y2), color, 1)

        # Text render
        cv2.putText(annotated, l1, (x1 + 6, label_y1 + h1 + 4), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)
        cv2.putText(annotated, l2, (x1 + 6, label_y1 + h1 + h2 + 10), font, font_scale, (200, 240, 200), thickness, cv2.LINE_AA)

    return annotated


def save_csv_results(csv_path: str, rows: List[Dict[str, Any]]) -> None:
    """
    Appends or creates results.csv with standard columns:
    filename, plate_id, bbox, detection_confidence, plate_text, ocr_confidence,
    format_confidence, final_confidence, preprocessing_method, status
    """
    fieldnames = [
        "filename",
        "plate_id",
        "bbox",
        "detection_confidence",
        "plate_text",
        "ocr_confidence",
        "format_confidence",
        "final_confidence",
        "preprocessing_method",
        "status"
    ]
    file_exists = os.path.exists(csv_path) and os.path.getsize(csv_path) > 0
    os.makedirs(os.path.dirname(os.path.abspath(csv_path)), exist_ok=True)

    with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        for r in rows:
            # Format bbox as string [x1,y1,x2,y2]
            row_data = dict(r)
            if isinstance(row_data.get("bbox"), list):
                row_data["bbox"] = str(row_data["bbox"]).replace(" ", "")
            writer.writerow(row_data)


def save_json_results(json_path: str, data: Any) -> None:
    """
    Writes structured JSON results.
    """
    os.makedirs(os.path.dirname(os.path.abspath(json_path)), exist_ok=True)
    with open(json_path, mode="w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)
