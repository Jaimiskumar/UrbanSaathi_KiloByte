import os
import torch
import numpy as np
from typing import List, Dict, Any, Optional
from ultralytics import YOLO

class PlateDetector:
    """
    YOLOv8n License Plate Detector.
    Responsible ONLY for localization (bounding box detection), NOT character recognition.
    """
    def __init__(self, model_path: str = "models/real/plate_detector_yolov8n.pt", conf_thresh: float = 0.25, device: Optional[str] = None):
        self.model_path = model_path
        self.conf_thresh = conf_thresh
        
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
            
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Plate detector model not found at {self.model_path}")
            
        print(f"[PlateDetector] Loading YOLOv8n detector from {self.model_path} onto {self.device.upper()}...")
        self.model = YOLO(self.model_path)
        print("[PlateDetector] Model loaded successfully.")

    def detect(self, image: np.ndarray, conf_threshold: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Detect license plates in an image.
        Returns a list of detections:
        [
            {
                "bbox": [x1, y1, x2, y2],
                "confidence": float,
                "crop": np.ndarray (cropped plate image)
            },
            ...
        ]
        """
        conf = conf_threshold if conf_threshold is not None else self.conf_thresh
        if image is None or image.size == 0:
            return []

        h, w = image.shape[:2]
        results = self.model.predict(
            source=image,
            conf=conf,
            device=self.device,
            verbose=False,
            imgsz=640
        )

        detections = []
        if not results or len(results) == 0:
            return detections

        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            return detections

        for box in boxes:
            coords = box.xyxy[0].cpu().numpy().tolist()
            x1, y1, x2, y2 = [int(round(c)) for c in coords]

            # Boundary clipping
            x1 = max(0, min(x1, w - 1))
            y1 = max(0, min(y1, h - 1))
            x2 = max(x1 + 1, min(x2, w))
            y2 = max(y1 + 1, min(y2, h))

            crop_w = x2 - x1
            crop_h = y2 - y1

            # Skip tiny / invalid boxes (< 10x5 pixels)
            if crop_w < 10 or crop_h < 5:
                continue

            plate_crop = image[y1:y2, x1:x2].copy()
            det_conf = float(box.conf[0].cpu().item())

            detections.append({
                "bbox": [x1, y1, x2, y2],
                "confidence": round(det_conf, 4),
                "crop": plate_crop
            })

        return detections
