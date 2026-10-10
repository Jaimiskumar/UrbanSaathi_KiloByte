# UrbanSaathi: AI-Powered Smart Traffic & Urban Mobility Ecosystem

[![Architecture](https://img.shields.io/badge/Architecture-Monorepo%20%7C%20Microservices-blue.svg)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20TailwindCSS-61DAFB.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](#)
[![Database](https://img.shields.io/badge/Database-MongoDB%20%2B%20Mongoose-47A248.svg)](#)
[![AI/ML](https://img.shields.io/badge/AI%2FML-PyTorch%20%7C%20YOLOv5%20%7C%20OpenCV-EE4C2C.svg)](#)
[![V2X Safety](https://img.shields.io/badge/V2X%20Mesh-Connected%20Vehicle%20HUD-blueviolet.svg)](#)
[![Status](https://img.shields.io/badge/Milestone%208-Connected%20Vehicle%20(V2X)%20%26%20Driver%20HUD-brightgreen.svg)](#)

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
                          │   (Command Center & In-Cabin HUD)       │
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
    │      MongoDB Database       │    │           V2X Safety & Mesh Gateway           │
    │  (Fleets, Waypoints, Alerts)│    │          (V2VSafetyCenter.jsx)                │
    └─────────────────────────────┘    └──────────────────────┬────────────────────────┘
                                                              │
                     ┌────────────────────────────────────────┴────────────────────────────────────────┐
                     ▼                                                                                 ▼
    ┌───────────────────────────────────┐                             ┌────────────────────────────────────────────────┐
    │       Mobile Dashcam Client       │                             │         In-Cabin HUD Collision Warning         │
    │  • iPhone / Android Camera Mount  │                             │  • Emergency Vehicle Approaching Alert         │
    │  • Viidure Wi-Fi Camera Bridge    │                             │  • Pothole & Road Hazard Audio-Visual Cue      │
    │  • Zero-Lag WebRTC/HTTP Stream    │                             │  • Dynamic Speed Advisory & Safe Gap Guidance  │
    └───────────────────────────────────┘                             └────────────────────────────────────────────────┘
```

---

## 🛰️ Milestone 8: Connected Vehicle (V2X) Protocol & Driver In-Cabin HUD

This milestone introduces decentralized vehicular communication and intelligent in-cabin telemetry:

### 1. Vehicle-to-Everything (V2X) Telemetry Engine
- **Proximity Mesh Broadcasting**: Vehicles continuously publish micro-beacons containing GPS coordinates, speed vectors, yaw rates, and sudden deceleration triggers.
- **Predictive Crash Mitigation**: `v2v_risk_model.joblib` evaluates trajectories of adjacent connected nodes to compute Time-To-Collision (TTC), dispatching audible warnings before human reaction thresholds.
- **Secondary Pile-Up Suppression**: An initial collision alert automatically informs trailing vehicles up to 800 meters upstream to brake preemptively.

### 2. Mobile In-Cabin HUD & Dashcam (`/dashcam`, `/v2v-mobile`)
- **Smartphone Cockpit Mount**: Turns any smartphone mounted on a car dashboard into an intelligent vision sensor and HUD.
- **Rear/Front Camera Ingestion**: Captures live road surfaces, feeds frames directly to AI models, and broadcasts road conditions across the city mesh.
- **Driver Warning HUD**: Displays real-time speed, safe following distance, approaching emergency siren notifications, and speed-camera radar pins.

### 3. Verification & Specifications Suite
- **`ADVANCED_FEATURES_COMPLETE.md`**: Deep architectural dive into V2X protocol schemas, latency benchmarks, and edge synchronization.
- **`ML_MODELS_DATASET_SPECIFICATION.md`**: Complete training feature schema, input shapes, and normalization standards for vehicular telemetry.
- **`ML_AND_ADAPTIVE_SYSTEM.md`**: Dynamic signal cycle adaptation driven by connected vehicle density.
- **`QUICK_CHALLAN_IMPLEMENTATION.md`**: Immediate violation synthesis from mobile dashcam snapshots.

---

## 📁 Repository Structure (Milestone 8)

```text
UrbanSaathi/
├── ADVANCED_FEATURES_COMPLETE.md          # Complete V2X & connected vehicle specification
├── ML_AND_ADAPTIVE_SYSTEM.md              # Adaptive signal timing specs
├── ML_MODELS_DATASET_SPECIFICATION.md     # Feature schemas & dataset architecture
├── QUICK_CHALLAN_IMPLEMENTATION.md        # Rapid violation generation pipeline
├── frontend/
│   ├── public/videos/                     # Traffic camera test streams
│   │   ├── Hikvision_Traffic_Flow_Analysis_Camera_240P.mp4
│   │   ├── Vehicle Detection and Traffic Counting using AI..mp4
│   │   └── video_2.mp4, video_3.mp4, video_4.mp4
│   └── src/
│       ├── pages/MobileV2VDashcam.jsx     # Mobile windshield HUD & dashcam app
│       └── components/admin/V2VSafetyCenter.jsx # Municipal fleet safety command
├── backend/
├── ml_backend_api.py
├── urbanflow_app/
├── docs/
├── models/
├── training/
├── data/
├── scripts/
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 📱 Launching Mobile Dashcam HUD

```bash
# 1. Start application on your local network
cd frontend
npm run dev -- --host 0.0.0.0

# 2. Open on your mobile phone browser
http://<YOUR-LAPTOP-IP>:5173/dashcam
```
Mount your phone on the vehicle dashboard — the HUD will activate camera vision, speedometer, and real-time hazard alerts!

---

## 🗺️ Implementation Roadmap

- [x] **Milestone 1: Project Scaffolding & Setup**
- [x] **Milestone 2: Frontend Layout, Navigation & Portal UI**
- [x] **Milestone 3: Express Backend Core, Authentication & Database Models**
- [x] **Milestone 4: Full-Stack API Integration & State Synchronization**
- [x] **Milestone 5: AI/ML Infrastructure & Vehicle Detection Models**
- [x] **Milestone 6: Real-time Video Stream Inference & WebSocket Gateway**
- [x] **Milestone 7: Emergency Dispatch & Automated Green Corridor Bypass**
- [x] **Milestone 8: Connected Vehicle (V2X) Protocol & Driver HUD** *(Current)*
- [ ] **Milestone 9: Multi-Agent Signal Coordination & Explainable AI**
- [ ] **Milestone 10: Urban Digital Twin, Production Hardening & Final Polishing**
