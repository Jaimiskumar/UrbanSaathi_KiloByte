# UrbanSaathi: AI-Powered Smart Traffic & Urban Mobility Ecosystem

[![Architecture](https://img.shields.io/badge/Architecture-Monorepo%20%7C%20Microservices-blue.svg)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20TailwindCSS-61DAFB.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](#)
[![Database](https://img.shields.io/badge/Database-MongoDB%20%2B%20Mongoose-47A248.svg)](#)
[![AI/ML](https://img.shields.io/badge/AI%2FML-PyTorch%20%7C%20YOLOv5%20%7C%20Scikit--Learn-EE4C2C.svg)](#)
[![Status](https://img.shields.io/badge/Milestone%205-AI%2FML%20Infrastructure%20%26%20Models-brightgreen.svg)](#)

---

## 🚦 Project Overview

**UrbanSaathi** is an end-to-end intelligent urban traffic, incident, and parking management platform designed to eliminate metropolitan traffic congestion, optimize emergency vehicle dispatch via dynamic green corridors, automate violation detection (E-Challan) with AI computer vision, and provide real-time digital twin telemetry for municipal authorities and citizens alike.

### Core Objectives
1. **Adaptive Signal Optimization**: Real-time traffic density estimation using computer vision to adjust signal timings dynamically.
2. **Emergency Vehicle Priority (Green Wave)**: Instant clearance corridors for ambulances and fire services.
3. **Automated AI Violation Detection**: Helmet compliance, license plate recognition, and lane encroachment monitoring.
4. **Smart Parking Management**: Real-time slot availability, pre-booking, and automated fee computation.
5. **Urban Digital Twin & V2X HUD**: Interactive 2D/3D map monitoring and vehicle-to-everything alerts for drivers.

---

## 🏗️ System Architecture Blueprint

```
                          ┌─────────────────────────────────────┐
                          │         UrbanSaathi Client          │
                          │ (React 18 / Vite / Tailwind / Lucide│
                          └──────────────────┬──────────────────┘
                                             │ REST / WebSocket
                                             ▼
                          ┌─────────────────────────────────────┐
                          │      Express API & Socket Gateway   │
                          │       (Node.js / JWT Auth / CORS)   │
                          └──────────┬─────────────────┬────────┘
                                     │                 │
                ┌────────────────────┴────┐       ┌────┴────────────────────────┐
                ▼                         ▼       ▼                             ▼
    ┌───────────────────────────┐    ┌──────────────────────────────────────────────┐
    │     MongoDB Database      │    │             Python AI/ML Engine              │
    │  (26 Mongoose Schemas)    │    │        (PyTorch / YOLOv5 / ONNX / Hub)       │
    └───────────────────────────┘    └──────────────────────┬───────────────────────┘
                                                            │
                     ┌──────────────────────────────────────┴──────────────────────────────────────┐
                     ▼                                                                             ▼
    ┌───────────────────────────────────┐                         ┌───────────────────────────────────────────────┐
    │      Computer Vision Models       │                         │       Multimodal Predictive Regressors        │
    │  • YOLOv5s Vehicle Classifier     │                         │  • Accident Severity & Secondary Collision    │
    │  • Tiny YOLOv3 ONNX Edge Model    │                         │  • Congestion Hotspots & Traffic Prediction   │
    │  • Helmet & Plate Detection Hooks │                         │  • Pedestrian Hazards & V2V Collision Risks   │
    └───────────────────────────────────┘                         └───────────────────────────────────────────────┘
```

---

## 🧠 Milestone 5: AI/ML Infrastructure & Vehicle Detection Models

This milestone establishes the artificial intelligence foundation, deep learning computer vision weights, and multimodal risk estimation classifiers:

### 1. Deep Learning Vision Models
- **`yolov5s.pt`**: Pre-trained and fine-tuned YOLOv5 architecture detecting multi-class urban traffic entities (compact cars, SUVs, heavy transport trucks, transit buses, two-wheelers, and pedestrians) with high mAP inference.
- **`tiny-yolov3-11.onnx`**: Lightweight ONNX runtime model optimized for low-latency edge camera inference and municipal junction processing.
- **Ultralytics YOLOv5 Torch Hub (`models/torch_hub/`)**: Comprehensive model definitions, anchor specifications, and custom layer heads for detection and segmentation.

### 2. Trained Machine Learning Suite (`models/*.joblib`)
A production suite of 8 trained predictive models providing real-time risk scores and telemetry estimations:
- **`accident_model.joblib`**: Predicts traffic accident probability based on road geometry, rain intensity, and vehicle volume.
- **`traffic_prediction_model.joblib`**: Time-series congestion regressor forecasting junction wait times up to 60 minutes in advance.
- **`hotspot_model.joblib`**: Spatial clustering classifier pinpointing high-frequency congestion bottlenecks.
- **`emergency_priority_model.joblib`**: Evaluates responder urgency, vehicle type, and patient condition to rank preemption queue.
- **`pedestrian_risk_model.joblib`**: Quantifies pedestrian hazard indices at un-signaled pedestrian crosswalks.
- **`pothole_model.joblib`**: Road distress and pavement surface degradation severity classifier.
- **`secondary_collision_model.joblib`**: Evaluates pile-up risk downstream of an initial road incident.
- **`v2v_risk_model.joblib`**: High-frequency vehicle-to-vehicle trajectory proximity conflict detector.
- **`multimodal_model.joblib`**: Ensemble engine combining visual density, weather conditions, and spatial metrics into a unified city safety index.

### 3. Model Training & Evaluation Tooling (`training/`)
- **`train_all.py`**: Automated pipeline training all 8 models against synthetic and verified historical datasets.
- **`evaluate_models.py`**: Model verification harness computing R² score, Precision, Recall, and F1 metrics.
- **`training_metadata.json`**: Exact training timestamps, hyperparameter logs, and benchmark accuracy records.

---

## 📁 Repository Structure (Milestone 5)

```text
UrbanSaathi/
├── backend/
│   ├── models/onnx/
│   │   └── tiny-yolov3-11.onnx            # Edge ONNX vision model
│   └── ...
├── frontend/
├── data/
├── models/                                # Trained AI/ML models & weights
│   ├── yolov5s.pt                         # YOLOv5 vehicle detector weights
│   ├── accident_model.joblib
│   ├── emergency_priority_model.joblib
│   ├── hotspot_model.joblib
│   ├── multimodal_model.joblib
│   ├── pedestrian_risk_model.joblib
│   ├── pothole_model.joblib
│   ├── secondary_collision_model.joblib
│   ├── traffic_prediction_model.joblib
│   ├── v2v_risk_model.joblib
│   ├── training_metadata.json             # Model metrics & validation specs
│   └── torch_hub/                         # Ultralytics architecture configs
├── training/                              # Model training pipelines
│   ├── train_all.py
│   └── evaluate_models.py
├── scripts/
├── ml_requirements.txt                    # Python AI/ML dependencies
├── setup_ai.py                            # AI environment initializer
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 🚀 Setting Up the AI Environment

```bash
# 1. Create and activate Python virtual environment
python3 -m venv venv
source venv/bin/activate    # On Windows: venv\Scripts\activate

# 2. Install ML requirements
pip install -r ml_requirements.txt

# 3. Verify models and dependencies
python3 setup_ai.py

# 4. (Optional) Run model evaluation benchmark
python3 training/evaluate_models.py
```

---

## 🗺️ Implementation Roadmap

- [x] **Milestone 1: Project Scaffolding & Setup**
- [x] **Milestone 2: Frontend Layout, Navigation & Portal UI**
- [x] **Milestone 3: Express Backend Core, Authentication & Database Models**
- [x] **Milestone 4: Full-Stack API Integration & State Synchronization**
- [x] **Milestone 5: AI/ML Infrastructure & Vehicle Detection Models** *(Current)*
- [ ] **Milestone 6: Real-time Video Stream Inference & WebSocket Gateway**
- [ ] **Milestone 7: Emergency Dispatch & Automated Green Corridor Bypass**
- [ ] **Milestone 8: Connected Vehicle (V2X) Protocol & Driver HUD**
- [ ] **Milestone 9: Multi-Agent Signal Coordination & Explainable AI**
- [ ] **Milestone 10: Urban Digital Twin, Production Hardening & Final Polishing**
