import os
import cv2
import numpy as np
from typing import Dict, Any, List, Optional
from collections import defaultdict, Counter

from .pipeline import ALPRPipeline
from .utils import annotate_image, save_csv_results, save_json_results

def compute_iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

    iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
    return iou


class VideoALPRProcessor:
    """
    Video ALPR Processor with temporal consistency tracking.
    - Associates plate detections across consecutive frames via IoU.
    - Avoids re-running heavy OCR on every frame for steady tracklets.
    - Aggregates multi-frame OCR predictions using confidence-weighted voting.
    """

    def __init__(self, pipeline: ALPRPipeline, ocr_interval_frames: int = 5, iou_thresh: float = 0.35):
        self.pipeline = pipeline
        self.ocr_interval = ocr_interval_frames
        self.iou_thresh = iou_thresh

    def process_video(
        self,
        video_path: str,
        output_video_path: Optional[str] = None,
        output_dir: str = "outputs"
    ) -> Dict[str, Any]:
        """
        Processes a video file, performs temporal ALPR tracking, and aggregates results.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise IOError(f"Cannot open video {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        writer = None
        if output_video_path:
            os.makedirs(os.path.dirname(os.path.abspath(output_video_path)), exist_ok=True)
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))

        # Active tracks: track_id -> { "bbox", "last_frame", "readings": [(text, conf, fmt_conf)] }
        tracks = {}
        next_track_id = 1
        frame_idx = 0

        print(f"[VideoALPR] Processing {video_path} ({total_frames} frames, {fps:.1f} FPS)...")

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1

            # Step 1: Detect plates using YOLO
            detections = self.pipeline.detector.detect(frame)
            current_frame_plates = []

            # Step 2: Match detections with existing tracks
            matched_det_indices = set()
            for track_id, track_data in list(tracks.items()):
                # Drop track if inactive for more than 15 frames
                if frame_idx - track_data["last_frame"] > 15:
                    continue

                best_iou = 0.0
                best_det_idx = -1
                for d_idx, det in enumerate(detections):
                    if d_idx in matched_det_indices:
                        continue
                    iou = compute_iou(track_data["bbox"], det["bbox"])
                    if iou > best_iou:
                        best_iou = iou
                        best_det_idx = d_idx

                if best_iou >= self.iou_thresh:
                    matched_det_indices.add(best_det_idx)
                    det = detections[best_det_idx]
                    track_data["bbox"] = det["bbox"]
                    track_data["det_conf"] = det["confidence"]
                    track_data["last_frame"] = frame_idx

                    # Run OCR only periodically or if track has no confident reading
                    has_high_conf = any(c >= 0.88 for _, c, _ in track_data["readings"])
                    if (frame_idx % self.ocr_interval == 0) or not has_high_conf:
                        self._run_ocr_on_crop(det["crop"], track_data)

            # Step 3: Create new tracks for unmatched detections
            for d_idx, det in enumerate(detections):
                if d_idx not in matched_det_indices:
                    t_id = next_track_id
                    next_track_id += 1
                    tracks[t_id] = {
                        "track_id": t_id,
                        "bbox": det["bbox"],
                        "det_conf": det["confidence"],
                        "last_frame": frame_idx,
                        "readings": []
                    }
                    # Run initial OCR
                    self._run_ocr_on_crop(det["crop"], tracks[t_id])

            # Step 4: Build current frame visualization
            for t_id, t_data in tracks.items():
                if t_data["last_frame"] == frame_idx:
                    agg = self._aggregate_track_readings(t_data)
                    current_frame_plates.append({
                        "plate_id": t_id,
                        "bbox": t_data["bbox"],
                        "detection_confidence": t_data["det_conf"],
                        "plate_text": agg["plate_text"],
                        "ocr_confidence": agg["ocr_confidence"],
                        "format_confidence": agg["format_confidence"],
                        "final_confidence": agg["final_confidence"],
                        "status": agg["status"]
                    })

            annotated_frame = annotate_image(frame, current_frame_plates)
            if writer:
                writer.write(annotated_frame)

        cap.release()
        if writer:
            writer.release()

        # Step 5: Final summary compilation across all tracks
        summary_tracks = []
        csv_rows = []
        for t_id, t_data in tracks.items():
            if not t_data["readings"]:
                continue
            agg = self._aggregate_track_readings(t_data)
            entry = {
                "track_id": t_id,
                "bbox": t_data["bbox"],
                "detection_confidence": t_data["det_conf"],
                "plate_text": agg["plate_text"],
                "ocr_confidence": agg["ocr_confidence"],
                "format_confidence": agg["format_confidence"],
                "final_confidence": agg["final_confidence"],
                "status": agg["status"],
                "total_observations": len(t_data["readings"])
            }
            summary_tracks.append(entry)
            csv_rows.append({
                "filename": os.path.basename(video_path),
                "plate_id": t_id,
                "bbox": t_data["bbox"],
                "detection_confidence": t_data["det_conf"],
                "plate_text": agg["plate_text"],
                "ocr_confidence": agg["ocr_confidence"],
                "format_confidence": agg["format_confidence"],
                "final_confidence": agg["final_confidence"],
                "preprocessing_method": "temporal_aggregation",
                "status": agg["status"]
            })

        # Save summary CSV and JSON
        csv_path = os.path.join(output_dir, "results.csv")
        save_csv_results(csv_path, csv_rows)

        summary_json = {
            "video": os.path.basename(video_path),
            "total_frames_processed": frame_idx,
            "unique_plates_tracked": len(summary_tracks),
            "tracks": summary_tracks
        }
        json_path = os.path.join(output_dir, "video_summary.json")
        save_json_results(json_path, summary_json)

        print(f"[VideoALPR] Completed processing {frame_idx} frames. Tracked {len(summary_tracks)} unique plates.")
        return summary_json

    def _run_ocr_on_crop(self, crop: np.ndarray, track_data: Dict[str, Any]):
        variants = self.pipeline.preprocessor.generate_variants(crop)
        candidates = []
        for var_name, var_img in variants.items():
            ocr_out = self.pipeline.ocr.recognize_plate(var_img, psm=7)
            raw = ocr_out.get("text", "")
            norm = self.pipeline.preprocessor.__class__.__module__ # just reference
            from .validator import normalize_plate
            norm_text = normalize_plate(raw)
            if norm_text:
                candidates.append({
                    "variant": var_name,
                    "normalized_text": norm_text,
                    "ocr_conf": ocr_out.get("confidence", 0.0)
                })
        if candidates:
            best = self.pipeline._select_best_candidate(candidates)
            if best["status"] != "unreadable":
                track_data["readings"].append((
                    best["plate_text"],
                    best["ocr_confidence"],
                    best["format_confidence"]
                ))

    def _aggregate_track_readings(self, track_data: Dict[str, Any]) -> Dict[str, Any]:
        readings = track_data["readings"]
        if not readings:
            return {
                "plate_text": "UNREADABLE",
                "ocr_confidence": 0.0,
                "format_confidence": 0.0,
                "final_confidence": round(track_data["det_conf"] * 0.3, 4),
                "status": "unreadable"
            }

        # Weighted voting by OCR confidence
        vote_scores = defaultdict(float)
        max_ocr = defaultdict(float)
        max_fmt = defaultdict(float)

        for text, o_conf, f_conf in readings:
            vote_scores[text] += (o_conf + f_conf)
            if o_conf > max_ocr[text]:
                max_ocr[text] = o_conf
            if f_conf > max_fmt[text]:
                max_fmt[text] = f_conf

        best_text = max(vote_scores, key=vote_scores.get)
        best_ocr = max_ocr[best_text]
        best_fmt = max_fmt[best_text]
        det_conf = track_data["det_conf"]

        final_conf = round((det_conf * 0.20) + (best_ocr * 0.40) + (best_fmt * 0.40), 4)
        return {
            "plate_text": best_text,
            "ocr_confidence": round(best_ocr, 4),
            "format_confidence": round(best_fmt, 4),
            "final_confidence": final_conf,
            "status": "recognized"
        }
