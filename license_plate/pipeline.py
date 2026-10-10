import os
import cv2
import numpy as np
from typing import Dict, Any, List, Optional, Union
from collections import Counter

from .detector import PlateDetector
from .preprocessing import PlatePreprocessor
from .ocr import BaseOCREngine, get_ocr_engine
from .validator import normalize_plate, validate_indian_plate
from .utils import annotate_image, save_csv_results, save_json_results

class ALPRPipeline:
    """
    Complete License Plate Recognition (ALPR/ANPR) Pipeline.
    YOLOv8n (Localization) -> Bounding box padding (5-10%) -> Optional perspective correction ->
    Multi-variant Preprocessing (12 variants) -> Multi-PSM OCR ->
    Indian Plate Normalization & Format Validation -> Candidate Selection -> Confidence Breakdown -> Outputs.
    """

    def __init__(
        self,
        model_path: str = "models/real/plate_detector_yolov8n.pt",
        conf_thresh: float = 0.25,
        ocr_engine: Optional[Union[str, BaseOCREngine]] = "tesseract",
        device: Optional[str] = None
    ):
        # 1. Initialize YOLOv8n detector
        self.detector = PlateDetector(model_path=model_path, conf_thresh=conf_thresh, device=device)

        # 2. Initialize Preprocessor
        self.preprocessor = PlatePreprocessor()

        # 3. Initialize Modular OCR Engine
        if isinstance(ocr_engine, BaseOCREngine):
            self.ocr = ocr_engine
        else:
            self.ocr = get_ocr_engine(str(ocr_engine))

    def _select_best_candidate(self, candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Score each candidate using:
        - OCR confidence: 35%
        - Format plausibility: 25%
        - Variant agreement across variants & PSM modes: 25%
        - Length/character score: 15%

        Do not reject a candidate merely because it does not perfectly match a regex.
        If OCR produces a plausible 8-10 character alphanumeric candidate with reasonable confidence,
        preserve it as a recognized candidate.
        """
        if not candidates:
            return {
                "plate_text": "UNREADABLE",
                "ocr_confidence": 0.0,
                "format_confidence": 0.0,
                "composite_score": 0.0,
                "preprocessing_method": "none",
                "psm": 7,
                "status": "unreadable"
            }

        valid_candidates = [c for c in candidates if c.get("normalized_text")]
        if not valid_candidates:
            return {
                "plate_text": "UNREADABLE",
                "ocr_confidence": 0.0,
                "format_confidence": 0.0,
                "composite_score": 0.0,
                "preprocessing_method": candidates[0].get("variant", "unknown"),
                "psm": candidates[0].get("psm", 7),
                "status": "unreadable"
            }

        # Count agreements across preprocessing variants and PSM modes
        text_counts = Counter([c["normalized_text"] for c in valid_candidates])
        total_evaluations = len(valid_candidates)

        scored_candidates = []
        for cand in valid_candidates:
            text = cand["normalized_text"]
            ocr_conf = float(cand.get("ocr_conf", 0.0))
            variant_name = cand.get("variant", "unknown")
            psm_mode = cand.get("psm", 7)

            # Format validation & plausibility score
            val_info = validate_indian_plate(text)
            fmt_conf = float(val_info.get("format_confidence", 0.20))

            # Agreement score: ratio of evaluations that produced this exact string
            agreement_ratio = text_counts[text] / float(total_evaluations)
            variant_agreement_score = agreement_ratio

            # Length / alphanumeric character score (15%)
            length = len(text)
            has_letters = bool(any(c.isalpha() for c in text))
            has_digits = bool(any(c.isdigit() for c in text))
            both_types = 1.0 if (has_letters and has_digits) else 0.5

            if 8 <= length <= 10:
                length_score = 1.0 * both_types
            elif 7 <= length <= 11:
                length_score = 0.8 * both_types
            elif 4 <= length <= 12:
                length_score = 0.5 * both_types
            else:
                length_score = 0.2

            # Weighted composite score:
            # OCR confidence: 35%
            # Format plausibility: 25%
            # Variant agreement: 25%
            # Length/character score: 15%
            composite_score = (
                (ocr_conf * 0.35) +
                (fmt_conf * 0.25) +
                (variant_agreement_score * 0.25) +
                (length_score * 0.15)
            )

            # Bonus for strong known formats (Bharat series or Standard Indian)
            if val_info.get("is_valid_structure"):
                composite_score += 0.05

            scored_candidates.append({
                "plate_text": text,
                "raw_text": cand.get("raw_text", ""),
                "ocr_confidence": round(ocr_conf, 4),
                "format_confidence": round(fmt_conf, 4),
                "composite_score": round(composite_score, 4),
                "preprocessing_method": variant_name,
                "psm": psm_mode,
                "validation_info": val_info
            })

        scored_candidates.sort(key=lambda x: x["composite_score"], reverse=True)
        best = scored_candidates[0]

        # Status threshold: Only display "unreadable" if genuinely no plausible text exists
        # If OCR produced >= 6 chars with alphanumeric content, recognize it!
        length = len(best["plate_text"])
        is_plausible = (length >= 6) and (best["composite_score"] >= 0.20 or best["ocr_confidence"] >= 0.15)

        if is_plausible:
            best["status"] = "recognized"
        else:
            best["status"] = "unreadable"
            best["plate_text"] = "UNREADABLE"

        return best

    def process_image(
        self,
        image_or_path: Union[str, np.ndarray],
        output_dir: Optional[str] = "outputs",
        filename: Optional[str] = None,
        save_visuals: bool = True
    ) -> Dict[str, Any]:
        """
        Processes a single image:
        1. YOLOv8n localization -> Bounding boxes
        2. Applies 5-10% padding around bounding box, clipped to image boundary
        3. Optional perspective deskew
        4. 12 Preprocessing variants across PSM modes [6, 7, 8, 11, 13]
        5. Detailed debug logging [PLATE DETECTOR], [ALPR OCR DEBUG], [OCR], [VALIDATOR], [FINAL]
        6. Saves debug crops to outputs/plates and outputs/ocr_preprocessed
        """
        if isinstance(image_or_path, str):
            filepath = image_or_path
            orig_name = os.path.basename(filepath)
            img = cv2.imread(filepath)
            if img is None:
                return {
                    "filename": orig_name,
                    "error": f"Failed to read image at {filepath}",
                    "plates": []
                }
        else:
            orig_name = filename or "image_frame.jpg"
            img = image_or_path.copy()

        img_h, img_w = img.shape[:2]

        # Step 1: Detect plates using YOLOv8n
        detections = self.detector.detect(img)
        recognized_plates = []
        csv_rows = []

        annotated_dir = os.path.join(output_dir, "annotated") if output_dir else None
        plates_dir = os.path.join(output_dir, "plates") if output_dir else None
        ocr_prep_dir = os.path.join(output_dir, "ocr_preprocessed") if output_dir else None

        if save_visuals and output_dir:
            os.makedirs(annotated_dir, exist_ok=True)
            os.makedirs(plates_dir, exist_ok=True)
            os.makedirs(ocr_prep_dir, exist_ok=True)

        base_stem = os.path.splitext(orig_name)[0]

        # Step 2: For each plate detection
        for idx, det in enumerate(detections, start=1):
            det_conf = det["confidence"]
            bbox = det["bbox"] # [x1, y1, x2, y2]
            x1, y1, x2, y2 = bbox
            bw = x2 - x1
            bh = y2 - y1

            # Bounding box padding: 8% horizontal, 8% vertical
            pad_x = int(bw * 0.08)
            pad_y = int(bh * 0.08)

            px1 = max(0, x1 - pad_x)
            py1 = max(0, y1 - pad_y)
            px2 = min(img_w, x2 + pad_x)
            py2 = min(img_h, y2 + pad_y)

            plate_crop = img[py1:py2, px1:px2].copy()

            # Optional perspective correction / deskew
            corrected_crop = self.preprocessor.deskew_and_correct_perspective(plate_crop)

            print("\n" + "="*50)
            print("[PLATE DETECTOR]")
            print(f"confidence: {det_conf:.4f}")
            print(f"bbox: {bbox} (padded: [{px1}, {py1}, {px2}, {py2}])")

            # Save debug crop
            crop_filename = f"{base_stem}_plate_{idx}.jpg"
            if save_visuals and plates_dir:
                cv2.imwrite(os.path.join(plates_dir, crop_filename), corrected_crop)

            # Generate 12 OpenCV preprocessing variants
            variants = self.preprocessor.generate_variants(corrected_crop)
            candidate_results = []

            # Test multiple PSM modes if Tesseract is engine; for EasyOCR evaluate across all variants
            is_tess = hasattr(self.ocr, 'is_available') and self.ocr.is_available()
            psm_modes = [7, 8, 6, 11, 13] if is_tess else [7]

            for var_name, var_img in variants.items():
                if save_visuals and ocr_prep_dir:
                    var_filename = f"{base_stem}_plate_{idx}_{var_name}.jpg"
                    cv2.imwrite(os.path.join(ocr_prep_dir, var_filename), var_img)

                for psm in psm_modes:
                    ocr_out = self.ocr.recognize_plate(var_img, psm=psm)
                    raw_text = ocr_out.get("text", "")
                    ocr_conf = float(ocr_out.get("confidence", 0.0))

                    norm_text = normalize_plate(raw_text)
                    val_info = validate_indian_plate(norm_text)
                    fmt_conf = val_info["format_confidence"]

                    # Detailed debug log for every detected plate variant & PSM
                    if raw_text or ocr_conf > 0:
                        print(f"\n[ALPR OCR DEBUG]")
                        print(f"variant = {var_name}")
                        print(f"psm = {psm}")
                        print(f"raw_text = \"{raw_text}\"")
                        print(f"ocr_confidence = {ocr_conf:.4f}")
                        print(f"normalized_text = \"{norm_text}\"")
                        print(f"format_confidence = {fmt_conf:.4f}")
                        print(f"status = {'recognized' if len(norm_text) >= 6 else 'unreadable'}")

                    candidate_results.append({
                        "variant": var_name,
                        "psm": psm,
                        "raw_text": raw_text,
                        "normalized_text": norm_text,
                        "ocr_conf": ocr_conf
                    })

            # Select best candidate
            best_cand = self._select_best_candidate(candidate_results)

            ocr_conf = best_cand["ocr_confidence"]
            fmt_conf = best_cand["format_confidence"]
            val_info = best_cand.get("validation_info", {})

            # Debug blocks
            print("\n[OCR]")
            print(f"best raw text: \"{best_cand.get('raw_text', '')}\"")
            print(f"normalized: \"{best_cand['plate_text']}\"")
            print(f"psm: {best_cand.get('psm', 7)}")
            print(f"variant: {best_cand['preprocessing_method']}")
            print(f"ocr confidence: {ocr_conf:.4f}")

            print("\n[VALIDATOR]")
            print(f"format: {val_info.get('format_type', 'unknown')}")
            print(f"format confidence: {fmt_conf:.4f}")

            # Final confidence weights: Detection (20%), OCR (40%), Format Plausibility (40%)
            if best_cand["status"] != "unreadable":
                final_conf = round((det_conf * 0.20) + (ocr_conf * 0.40) + (fmt_conf * 0.40), 4)
            else:
                final_conf = round(det_conf * 0.30, 4)

            print("\n[FINAL]")
            print(f"plate: {best_cand['plate_text']}")
            print(f"final confidence: {final_conf:.4f}")
            print("="*50 + "\n")

            plate_info = {
                "plate_id": idx,
                "bbox": bbox,
                "detection_confidence": det_conf,
                "plate_text": best_cand["plate_text"],
                "ocr_confidence": ocr_conf,
                "format_confidence": fmt_conf,
                "final_confidence": final_conf,
                "preprocessing_method": best_cand["preprocessing_method"],
                "psm": best_cand.get("psm", 7),
                "status": best_cand["status"]
            }
            recognized_plates.append(plate_info)

            # CSV row
            csv_rows.append({
                "filename": orig_name,
                "plate_id": idx,
                "bbox": bbox,
                "detection_confidence": det_conf,
                "plate_text": best_cand["plate_text"],
                "ocr_confidence": ocr_conf,
                "format_confidence": fmt_conf,
                "final_confidence": final_conf,
                "preprocessing_method": best_cand["preprocessing_method"],
                "status": best_cand["status"]
            })

        # Save annotated image
        if save_visuals and annotated_dir:
            annotated_img = annotate_image(img, recognized_plates)
            annotated_path = os.path.join(annotated_dir, f"{base_stem}_annotated.jpg")
            cv2.imwrite(annotated_path, annotated_img)

        # Append to CSV
        if output_dir and csv_rows:
            csv_path = os.path.join(output_dir, "results.csv")
            save_csv_results(csv_path, csv_rows)

        # Build clean JSON response
        result_json = {
            "filename": orig_name,
            "plates": [
                {
                    "bbox": p["bbox"],
                    "detection_confidence": p["detection_confidence"],
                    "plate_text": p["plate_text"],
                    "ocr_confidence": p["ocr_confidence"],
                    "format_confidence": p["format_confidence"],
                    "final_confidence": p["final_confidence"],
                    "status": p["status"]
                }
                for p in recognized_plates
            ]
        }

        return result_json
