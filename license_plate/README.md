# UrbanSaathi Complete License Plate Recognition (ALPR/ANPR) System

A robust, production-ready Automatic License Plate Recognition pipeline engineered for Indian vehicle registration plates.

The architecture decouples **localization** from **character recognition**:
- **YOLOv8n**: Solely detects and locates license plates (no character classification).
- **OpenCV**: Generates 7 multi-variant preprocessed crops.
- **Dedicated OCR**: Modular OCR engine (Tesseract OCR / EasyOCR fallback) extracts alphanumeric characters.
- **Validation & Plausibility Scoring**: Normalizes Indian registration structures and validates state/series codes.
- **Temporal Consistency**: Video tracker aggregates multi-frame observations to yield high-confidence plate numbers.

---

## 1. System Pipeline Architecture

```
INPUT IMAGE / VIDEO
        ¦
        ?
YOLOv8n License Plate Detection (`models/real/plate_detector_yolov8n.pt`, conf >= 0.25)
        ¦
        ?
Plate Bounding Box [x1, y1, x2, y2]
        ¦
        ?
Crop Plate Region (with safety bounds)
        ¦
        ?
Multi-Variant Preprocessing (OpenCV)
  +-- A. Original Crop
  +-- B. Grayscale
  +-- C. Upscaled Grayscale (Bicubic 2x-3x)
  +-- D. Contrast-Enhanced (CLAHE)
  +-- E. Adaptive Threshold (Gaussian)
  +-- F. Otsu Threshold
  +-- G. Sharpened Image (Laplacian/Unsharp kernel)
        ¦
        ?
Dedicated OCR Character Recognition (Tesseract PSM 7 / Whitelist `[A-Z0-9]` or EasyOCR)
        ¦
        ?
Indian License Plate Normalization (Uppercase, strip punctuation, contextual 0/O & 1/I correction)
        ¦
        ?
Format Plausibility Scoring & Candidate Agreement Selection
        ¦
        ?
Confidence Breakdown (Detection, OCR, Format, Final)
        ¦
        ?
Structured CSV / JSON Output + Annotated Visual Overlays
```

---

## 2. Directory Structure

```
license_plate/
+-- __init__.py           # Package marker
+-- detector.py           # YOLOv8n detector wrapper (loads model once)
+-- preprocessing.py      # 7 OpenCV preprocessing variants
+-- ocr.py                # BaseOCREngine, TesseractEngine, EasyOCREngine
+-- validator.py          # Normalization & Indian registration format scoring
+-- pipeline.py           # End-to-end image ALPR pipeline & consensus selector
+-- video_processor.py    # Temporal tracking across video frames with IoU & voting
+-- utils.py              # Visual annotation, CSV and JSON writers
+-- main.py               # CLI entry point (--image, --folder, --video, --test)
+-- requirements.txt      # Python dependencies
+-- README.md             # Complete documentation
```

---

## 3. Installation Instructions

### Step 1: Install Python Dependencies
```bash
pip install -r license_plate/requirements.txt
```

### Step 2: Tesseract OCR Engine Setup

#### On Windows:
1. Download installer from UB-Mannheim:
   https://github.com/UB-Mannheim/tesseract/releases
   or install via Windows Package Manager:
   ```powershell
   winget install -e --id UB-Mannheim.TesseractOCR
   ```
2. Default install directory: `C:\Program Files\Tesseract-OCR\tesseract.exe`.
3. Add `C:\Program Files\Tesseract-OCR` to your Windows System `PATH`.

*(Note: The module includes automatic detection of standard Windows paths and a pluggable EasyOCR fallback so the pipeline never crashes if Tesseract binaries are not yet installed).*

#### On Linux / Ubuntu:
```bash
sudo apt update
sudo apt install -y tesseract-ocr
```

#### On macOS:
```bash
brew install tesseract
```

---

## 4. Usage Commands

### 1. Single Image Mode
```bash
python -m license_plate.main --image path/to/vehicle.jpg --output-dir outputs/
```

### 2. Batch Folder Mode
Processes all images in a folder and saves crops, preprocessed variants, annotated images, and `results.csv`:
```bash
python -m license_plate.main --folder path/to/images_dir/ --output-dir outputs/
```

### 3. Video Mode (Temporal ALPR Tracking)
Tracks plates across frames, prevents repeated OCR computation on the same vehicle, aggregates multi-frame readings:
```bash
python -m license_plate.main --video path/to/traffic_cctv.mp4 --output-dir outputs/
```

### 4. Benchmark / Test Mode
Runs an automated batch evaluation and prints a detailed statistical report:
```bash
python -m license_plate.main --test path/to/test_folder/ --output-dir outputs/
```

---

## 5. Output Format

### Output Directory Structure
```
outputs/
+-- annotated/           # Visual overlays with bounding box, plate number, det & OCR scores
+-- plates/              # High-resolution crops of localized license plates
+-- ocr_preprocessed/    # 7 OpenCV variants saved per plate
+-- results.csv          # Comprehensive spreadsheet of all detections
+-- video_summary.json   # (In video mode) Tracked vehicles and consolidated readings
```

### Sample CSV Output (`outputs/results.csv`)
```csv
filename,plate_id,bbox,detection_confidence,plate_text,ocr_confidence,format_confidence,final_confidence,preprocessing_method,status
traffic_001.jpg,1,"[420,280,570,330]",0.9100,DL01AB1234,0.9400,0.9600,0.9400,adaptive_threshold,recognized
traffic_002.jpg,1,"[190,410,360,465]",0.8950,MH12DE1433,0.9250,1.0000,0.9500,contrast_enhanced,recognized
traffic_003.jpg,1,"[510,320,680,365]",0.8400,UNREADABLE,0.0000,0.1000,0.2520,original,unreadable
```

### Sample JSON API Output
```json
{
  "filename": "traffic_001.jpg",
  "plates": [
    {
      "bbox": [420, 280, 570, 330],
      "detection_confidence": 0.91,
      "plate_text": "DL01AB1234",
      "ocr_confidence": 0.94,
      "format_confidence": 0.96,
      "final_confidence": 0.94,
      "status": "recognized"
    }
  ]
}
```

---

## 6. Integration into UrbanSaathi Backend

You can import and call `ALPRPipeline` directly within FastAPI, Flask, or background worker processes:

```python
import cv2
from license_plate.pipeline import ALPRPipeline

# 1. Initialize once at server startup
alpr = ALPRPipeline(
    model_path="models/real/plate_detector_yolov8n.pt",
    conf_thresh=0.25,
    ocr_engine="tesseract" # or "easyocr"
)

# 2. Process image from upload or RTSP frame
frame = cv2.imread("uploaded_image.jpg")
result = alpr.process_image(frame, save_visuals=False)

# 3. Access recognized plates
for plate in result["plates"]:
    print(f"Plate: {plate['plate_text']} (Confidence: {plate['final_confidence']})")
```
