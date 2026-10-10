# UrbanSaathi: AI-Powered Smart Traffic & Urban Mobility Ecosystem

[![Architecture](https://img.shields.io/badge/Architecture-Monorepo%20%7C%20Microservices-blue.svg)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20TailwindCSS-61DAFB.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](#)
[![Database](https://img.shields.io/badge/Database-MongoDB%20%2B%20Mongoose-47A248.svg)](#)
[![Data Engine](https://img.shields.io/badge/Data%20Engine-Traffic%20%26%20Incident%20Pipelines-purple.svg)](#)
[![Status](https://img.shields.io/badge/Milestone%204-Full--Stack%20Integration%20%26%20Incident%20Data-brightgreen.svg)](#)

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
    │  (26 Mongoose Schemas)    │    │     (YOLOv5, OpenCV, Deep Learning)          │
    └─────────────┬─────────────┘    └──────────────────────┬───────────────────────┘
                  │                                         │
                  ▼                                         ▼
    ┌───────────────────────────┐    ┌──────────────────────────────────────────────┐
    │   Traffic & Incidents     │    │        Synthetic City Traffic Datasets       │
    │  (Accidents, Violations)  │    │      (Potholes, Hotspots, Trajectories)      │
    └───────────────────────────┘    └──────────────────────────────────────────────┘
```

---

## 🔄 Milestone 4: Full-Stack Integration & Incident Data Pipelines

This milestone establishes complete client-server cohesion and integrates comprehensive traffic telemetry datasets:

### 1. Client-to-Server Data Synchronization
- **JWT Session Persistence**: Client interceptors dynamically manage access tokens, automatic refresh rotations, and authorization headers across all API endpoints.
- **Dynamic Parking Engine**: Real-time bay occupancy fetches, dynamic fare calculation, and instant pass verification.
- **Violation & Appeal Workflow**: Citizen penalty retrieval with photographic proof and direct appeal review pipelines.

### 2. Urban Traffic & Incident Dataset Suite (`data/`)
Rich datasets structured to train and evaluate traffic density and incident detection models:
- **`accidents/`**: Historical and simulated metropolitan collision records with severity indexing.
- **`hotspots/`**: Spatial density clusters identifying recurring urban bottlenecks.
- **`pedestrians/`**: Crossing patterns and pedestrian hazard risk metrics.
- **`potholes/`**: Road surface degradation coordinates for municipal prioritization.
- **`v2v/`**: Connected vehicle beacon trajectories and telemetry logs.

### 3. Simulation & Seed Tooling (`scripts/`)
- **`generate_synthetic_data.py`**: Parametric generation of realistic urban mobility patterns and congestion cycles.
- **`seedReports.mjs` & `seedFines.mjs`**: High-fidelity municipal violation records and citizen reports for local testing.
- **`test_connected_vehicle_system.js`**: Simulated V2X packet broadcast and latency verification.

---

## 📁 Repository Structure (Milestone 4)

```text
UrbanSaathi/
├── backend/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── scripts/
│   ├── uploads/                           # Dynamic file storage (proofs, evidence)
│   ├── utils/
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   └── package.json
├── data/                                  # Traffic & incident dataset pipelines
│   ├── synthetic/
│   │   ├── accidents/
│   │   ├── emergency/
│   │   ├── hotspots/
│   │   ├── pedestrians/
│   │   ├── potholes/
│   │   ├── traffic/
│   │   └── v2v/
│   └── processed/
├── scripts/                               # Data generators & seed scripts
│   ├── generate_synthetic_data.py
│   ├── seedFines.mjs
│   ├── seedReports.mjs
│   └── test_connected_vehicle_system.js
├── docker-compose.yml
├── setup.sh
├── setup.bat
├── .env.production.example
├── .gitignore
└── README.md
```

---

## 🚀 Running Full-Stack

```bash
# Terminal 1: Start Express API
cd backend
npm run dev

# Terminal 2: Start React Frontend
cd frontend
npm run dev

# (Optional) Generate fresh synthetic mobility data
python3 scripts/generate_synthetic_data.py
```

---

## 🗺️ Implementation Roadmap

- [x] **Milestone 1: Project Scaffolding & Setup**
- [x] **Milestone 2: Frontend Layout, Navigation & Portal UI**
- [x] **Milestone 3: Express Backend Core, Authentication & Database Models**
- [x] **Milestone 4: Full-Stack API Integration & State Synchronization** *(Current)*
- [ ] **Milestone 5: AI/ML Infrastructure & Vehicle Detection Models**
- [ ] **Milestone 6: Real-time Video Stream Inference & WebSocket Gateway**
- [ ] **Milestone 7: Emergency Dispatch & Automated Green Corridor Bypass**
- [ ] **Milestone 8: Connected Vehicle (V2X) Protocol & Driver HUD**
- [ ] **Milestone 9: Multi-Agent Signal Coordination & Explainable AI**
- [ ] **Milestone 10: Urban Digital Twin, Production Hardening & Final Polishing**
