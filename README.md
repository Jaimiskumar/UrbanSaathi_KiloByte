# UrbanSaathi: AI-Powered Smart Traffic & Urban Mobility Ecosystem

[![Architecture](https://img.shields.io/badge/Architecture-Monorepo%20%7C%20Microservices-blue.svg)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20TailwindCSS-61DAFB.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](#)
[![Database](https://img.shields.io/badge/Database-MongoDB%20%2B%20Mongoose-47A248.svg)](#)
[![AI/ML](https://img.shields.io/badge/AI%2FML-PyTorch%20%7C%20YOLOv5%20%7C%20OpenCV-EE4C2C.svg)](#)
[![Emergency](https://img.shields.io/badge/Emergency-Dynamic%20Green%20Corridor%20Preemption-red.svg)](#)
[![Status](https://img.shields.io/badge/Milestone%207-Emergency%20Dispatch%20%26%20Green%20Corridor-brightgreen.svg)](#)

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
                          │   (Command Center / Emergency HUD)      │
                          └────────────────────┬────────────────────┘
                                               │ REST / Socket.IO
                                               ▼
                          ┌─────────────────────────────────────────┐
                          │        Express API & Socket Gateway     │
                          │   (Node.js / Emergency Dispatcher)      │
                          └───────┬──────────────────────────┬──────┘
                                  │                          │
                 ┌────────────────┴───────────┐         ┌────┴────────────────────────┐
                 ▼                            ▼         ▼                             ▼
    ┌─────────────────────────────┐    ┌──────────────────────────────────────────────┐
    │     MongoDB Database        │    │          Dynamic Green Wave Engine           │
    │ (Corridors, Signals, Units) │    │        (greenCorridorService.js)             │
    └─────────────────────────────┘    └──────────────────────┬───────────────────────┘
                                                              │
                     ┌────────────────────────────────────────┴────────────────────────────────────────┐
                     ▼                                                                                 ▼
    ┌───────────────────────────────────┐                             ┌────────────────────────────────────────────────┐
    │     Cascaded Signal Preemption    │                             │         Dynamic Civilian Rerouting Engine      │
    │  • Predictive Waypoint Clearance  │                             │  • Emergency Bypass Calculation                │
    │  • Multi-Junction Green Waves     │                             │  • Citizen Mobile Warning Dissemination        │
    │  • Hosur & Outer Ring Road Artery │                             │  • Turn-by-Turn Path Re-anchoring              │
    └───────────────────────────────────┘                             └────────────────────────────────────────────────┘
```

---

## 🚑 Milestone 7: Emergency Dispatch & Automated Green Corridor Bypass

This milestone introduces mission-critical emergency vehicle routing and automated traffic light synchronization:

### 1. Dynamic Green Wave Preemption (`greenCorridorService.js`)
- **Cascaded Junction Interlock**: Automatically detects advancing emergency vehicles and preemptively switches downstream traffic signals to continuous green.
- **Buffer Clearance Calculation**: Flushes intersecting queues 45 seconds ahead of vehicle arrival, eliminating bottleneck decelerations for transit ambulances.
- **Emergency Priority Ranking**: Integrates with `emergency_priority_model.joblib` to rank simultaneous emergency dispatches based on patient severity and distance.

### 2. Multi-Path AI Routing Bypass
- **Civilian Divert Engine**: Disseminates live diversion vectors to consumer mapping clients, clearing priority emergency lanes before sirens reach audible range.
- **Bengaluru Artery Models**: Pre-configured dynamic corridor definitions across high-density corridors including Hosur Road, MG Road, and Silk Board Junction.

### 3. Emergency Architecture & Verification Suite (`docs/`)
- **`EMERGENCY_VEHICLE_IMPLEMENTATION_COMPLETE.md`**: Architectural breakdown of signal controller hooks and edge fail-safe protocols.
- **`EMERGENCY_VEHICLE_API_TESTING.md`**: Complete curl and Postman test scripts for dispatch triggers, status telemetry, and corridor decommissioning.
- **`SYSTEM_FLOW_DIAGRAMS.md`**: State machines and event flowcharts illustrating civilian diversion, camera confirmation, and emergency corridor closure.

---

## 📁 Repository Structure (Milestone 7)

```text
UrbanSaathi/
├── EMERGENCY_VEHICLE_IMPLEMENTATION_COMPLETE.md  # Emergency corridor technical specifications
├── docs/                                  # Complete system blueprints & test guides
│   ├── EMERGENCY_VEHICLE_SYSTEM.md
│   ├── EMERGENCY_VEHICLE_API_TESTING.md
│   ├── EMERGENCY_VEHICLE_ML_INTEGRATION.md
│   ├── SYSTEM_FLOW_DIAGRAMS.md
│   └── ...
├── backend/
│   ├── services/greenCorridorService.js   # Cascaded signal preemption engine
│   └── routes/emergencyRoutes.js          # Dispatch REST endpoints
├── ml_backend_api.py
├── urbanflow_app/
├── frontend/
├── models/
├── training/
├── data/
├── scripts/
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 🚀 Triggering an Emergency Corridor

```bash
# Trigger automated Green Corridor on Hosur Road
curl -X POST http://localhost:5001/api/emergency/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "AMB-KA01-9999",
    "emergencyType": "CRITICAL_CARE",
    "origin": "St. Johns Hospital",
    "destination": "NIMHANS Bengaluru",
    "corridor": "Hosur Road Artery"
  }'
```

---

## 🗺️ Implementation Roadmap

- [x] **Milestone 1: Project Scaffolding & Setup**
- [x] **Milestone 2: Frontend Layout, Navigation & Portal UI**
- [x] **Milestone 3: Express Backend Core, Authentication & Database Models**
- [x] **Milestone 4: Full-Stack API Integration & State Synchronization**
- [x] **Milestone 5: AI/ML Infrastructure & Vehicle Detection Models**
- [x] **Milestone 6: Real-time Video Stream Inference & WebSocket Gateway**
- [x] **Milestone 7: Emergency Dispatch & Automated Green Corridor Bypass** *(Current)*
- [ ] **Milestone 8: Connected Vehicle (V2X) Protocol & Driver HUD**
- [ ] **Milestone 9: Multi-Agent Signal Coordination & Explainable AI**
- [ ] **Milestone 10: Urban Digital Twin, Production Hardening & Final Polishing**
