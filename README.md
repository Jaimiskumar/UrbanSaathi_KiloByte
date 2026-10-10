# UrbanSaathi: AI-Powered Smart Traffic & Urban Mobility Ecosystem

[![Architecture](https://img.shields.io/badge/Architecture-Monorepo%20%7C%20Microservices-blue.svg)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20TailwindCSS-61DAFB.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](#)
[![Database](https://img.shields.io/badge/Database-MongoDB%20%2B%20Mongoose-47A248.svg)](#)
[![AI/ML](https://img.shields.io/badge/AI%2FML-PyTorch%20%7C%20YOLOv5%20%7C%20OpenCV-EE4C2C.svg)](#)
[![Streaming](https://img.shields.io/badge/Streaming-FastAPI%20%7C%20WebSocket%20%7C%20Socket.IO-009688.svg)](#)
[![Status](https://img.shields.io/badge/Milestone%206-Real--time%20ML%20Inference%20%26%20Streaming%20API-brightgreen.svg)](#)

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
                          ┌─────────────────────────────────────────┐
                          │           UrbanSaathi Client            │
                          │   (React 18 / Live Video Canvas / HUD)  │
                          └────────────────────┬────────────────────┘
                                               │ REST / Socket.IO
                                               ▼
                          ┌─────────────────────────────────────────┐
                          │        Express API & Socket Gateway     │
                          │         (Node.js / Port 5001)           │
                          └────────────┬──────────────────┬─────────┘
                                       │                  │
                ┌──────────────────────┴──────┐      ┌────┴────────────────────────┐
                ▼                             ▼      ▼                             ▼
    ┌─────────────────────────────┐    ┌───────────────────────────────────────────────┐
    │      MongoDB Database       │    │           Python ML Backend Service           │
    │  (Incidents, Challans, Hubs)│    │       (ml_backend_api.py / Port 8000)         │
    └─────────────────────────────┘    └──────────────────────┬────────────────────────┘
                                                              │
                     ┌────────────────────────────────────────┴────────────────────────────────────────┐
                     ▼                                                                                 ▼
    ┌───────────────────────────────────┐                             ┌────────────────────────────────────────────────┐
    │    Live OpenCV Stream Analysis    │                             │       UrbanFlow Edge Coordination Agent        │
    │  • Multi-camera Video Feeds       │                             │  • urbanflow_app/main.py                       │
    │  • Bounding Boxes & Tracking      │                             │  • Adaptive Signal Time Allocation             │
    │  • Helmet & Plate OCR Engine      │                             │  • Real-time Congestion Metric Synthesis       │
    └───────────────────────────────────┘                             └────────────────────────────────────────────────┘
```

---

## ⚡ Milestone 6: Real-time Video Stream Inference & ML API Gateway

This milestone brings computer vision models to life by establishing the real-time video stream ingestion, frame annotation, and WebSocket streaming pipeline:

### 1. High-Performance ML Inference API (`ml_backend_api.py`)
- **Video Ingestion Engine**: Decodes RTSP surveillance streams, mobile dashcam HTTP tunnels, and high-definition MP4 feeds via OpenCV.
- **Dynamic Entity Tracking**: Processes incoming frames with YOLOv5s, computing centroid tracking, vehicle classification (cars, two-wheelers, heavy vehicles), and lane speed estimates.
- **Automated Violation Trigger**: Crops high-confidence violation regions (riders without helmets, stop-line encroachment), computes license plate OCR, and transmits violation payloads to the Node.js backend.
- **REST & SSE Endpoints**:
  - `POST /api/ml/detect-frame`: Single-frame inference for uploaded surveillance snapshots.
  - `POST /api/ml/analyze-video`: Asynchronous batch video processing with timeline violation bookmarks.
  - `GET /api/ml/live-stream`: Server-Sent Events (SSE) / multipart stream broadcasting annotated bounding-box video directly to the browser.

### 2. UrbanFlow Edge AI Agent (`urbanflow_app/main.py`)
- Standalone edge computing runtime designed to run directly on junction IPC hardware.
- Real-time density calculation per junction arm, dynamically negotiating phase durations to minimize cumulative queue delay.

### 3. ML Testing & Verification Guides
- **`ML_TESTING_GUIDE.md`**: Complete test harness for synthetic and real camera video feeds, verifying frames per second (FPS), detection latency, and memory footprint.
- **`ML_DEPLOYMENT_INDEX.md`**: Architectural directory of model dependencies, hardware acceleration flags (CUDA / MPS / CPU), and port configurations.

---

## 📁 Repository Structure (Milestone 6)

```text
UrbanSaathi/
├── ml_backend_api.py                      # FastAPI/Flask live vision stream service
├── urbanflow_app/
│   └── main.py                            # Edge junction AI coordination agent
├── ML_TESTING_GUIDE.md                    # ML verification & benchmark runbook
├── ML_DEPLOYMENT_INDEX.md                 # Deployment specifications & port bindings
├── backend/
├── frontend/
├── models/
├── training/
├── data/
├── scripts/
├── ml_requirements.txt
├── setup_ai.py
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 🚀 Running the Full AI Stream Pipeline

```bash
# 1. Start Python ML Inference Service (Terminal 1)
source venv/bin/activate
python3 ml_backend_api.py

# 2. Start Express API & Socket Gateway (Terminal 2)
cd backend
npm run dev

# 3. Start React Frontend Client (Terminal 3)
cd frontend
npm run dev
```

---

## 🗺️ Implementation Roadmap

- [x] **Milestone 1: Project Scaffolding & Setup**
- [x] **Milestone 2: Frontend Layout, Navigation & Portal UI**
- [x] **Milestone 3: Express Backend Core, Authentication & Database Models**
- [x] **Milestone 4: Full-Stack API Integration & State Synchronization**
- [x] **Milestone 5: AI/ML Infrastructure & Vehicle Detection Models**
- [x] **Milestone 6: Real-time Video Stream Inference & WebSocket Gateway** *(Current)*
- [ ] **Milestone 7: Emergency Dispatch & Automated Green Corridor Bypass**
- [ ] **Milestone 8: Connected Vehicle (V2X) Protocol & Driver HUD**
- [ ] **Milestone 9: Multi-Agent Signal Coordination & Explainable AI**
- [ ] **Milestone 10: Urban Digital Twin, Production Hardening & Final Polishing**
