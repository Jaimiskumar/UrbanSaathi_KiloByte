# Models Directory Structure

This directory organizes all machine learning and deep learning models:

## 1. `real/` (Trained on Real-World Datasets)
Contains vision classifiers, ALPR detectors, pedestrian behavior models, and congestion predictors trained on real-world datasets:
- `congestion_model.joblib` (195,714 real VANET traffic samples)
- `vehicle_classifier.pt` (5,589 real vehicle photos)
- `accident_classifier.pt` (791 real accident scene images)
- `vendor_detector_yolov8n.pt` (1,396 real street vendor images)
- `plate_detector_yolov8n.pt` (License plate detector - YOLO11n, 98.12% mAP50, 97.8% Precision)
- `pedestrian_behavior_model.joblib` (686 real pedestrian crossing records)
- `metrics.json` & `additional_metrics.json` (Real evaluation benchmark scores)

## 2. `itd/`, `PotHole/`, `speed/`, `crowd/` (Specialized Vision Weights)
- `itd/itd_yolov8.pt` (Indian Traffic Dataset v1.2 detector & ByteTrack)
- `PotHole/best.pt` (Road damage & pothole detection)
- `speed/yolo11n-seg.pt` (Instance segmentation & telemetry)
- `crowd/yolo11n.pt` (Crowd density and pedestrian flow)

## 3. `synthetic/` (Isolated Synthetic Simulation Models)
All 9 models trained strictly on synthetic simulation datasets are isolated in `models/synthetic/`:
- `accident_model.joblib`
- `v2v_risk_model.joblib`
- `pedestrian_risk_model.joblib`
- `hotspot_model.joblib`
- `traffic_prediction_model.joblib`
- `emergency_priority_model.joblib`
- `multimodal_model.joblib`
- `pothole_model.joblib`
- `secondary_collision_model.joblib`
- `metrics.json`, `feature_importance.json`, `training_metadata.json`