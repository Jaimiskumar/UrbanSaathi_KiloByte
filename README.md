# UrbanSaathi: AI-Powered Smart Traffic & Urban Mobility Ecosystem

[![Architecture](https://img.shields.io/badge/Architecture-Monorepo%20%7C%20Microservices-blue.svg)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20TailwindCSS-61DAFB.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](#)
[![Database](https://img.shields.io/badge/Database-MongoDB%20%2B%20Mongoose-47A248.svg)](#)
[![AI/ML](https://img.shields.io/badge/AI%2FML-PyTorch%20%7C%20YOLOv5%20%7C%20OpenCV-EE4C2C.svg)](#)
[![Multi-Agent](https://img.shields.io/badge/Multi--Agent-Decentralized%20Junction%20Swarm-blueviolet.svg)](#)
[![Explainability](https://img.shields.io/badge/XAI-Explainable%20Decision%20Auditing-orange.svg)](#)
[![Status](https://img.shields.io/badge/Milestone%209-Multi--Agent%20Coordination%20%26%20Explainability-brightgreen.svg)](#)

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
                          │     (AIAgentCenter.jsx / Command)       │
                          └────────────────────┬────────────────────┘
                                               │ REST / Socket.IO
                                               ▼
                          ┌─────────────────────────────────────────┐
                          │        Express API & Socket Gateway     │
                          │   (Node.js / Multi-Agent Coordinator)   │
                          └───────┬──────────────────────────┬──────┘
                                  │                          │
                 ┌────────────────┴───────────┐         ┌────┴────────────────────────┐
                 ▼                            ▼         ▼                             ▼
    ┌─────────────────────────────┐    ┌──────────────────────────────────────────────┐
    │     MongoDB Database        │    │         Multi-Agent Orchestrator             │
    │ (Agent States, Audit Logs)  │    │      (multiAgentOrchestrator.js)             │
    └─────────────────────────────┘    └──────────────────────┬───────────────────────┘
                                                              │
                     ┌────────────────────────────────────────┴────────────────────────────────────────┐
                     ▼                                                                                 ▼
    ┌───────────────────────────────────┐                             ┌────────────────────────────────────────────────┐
    │    Inter-Junction Agent Swarm     │                             │        Transparent Explainable AI (XAI)        │
    │  • Node-to-Node Pressure Exchange │                             │  • Human-Readable Decision Audit Trails        │
    │  • Cooperative Game Optimization  │                             │  • Queue Length & Wait-Time Feature Weights    │
    │  • Phantom Jam Spillback Damping  │                             │  • Real-time Confidence & Rationale Log HUD    │
    └───────────────────────────────────┘                             └────────────────────────────────────────────────┘
```

---

## 🤝 Milestone 9: Multi-Agent Signal Coordination & AI Explainability

This milestone establishes decentralized swarm intelligence and transparent decision-making across municipal traffic junctions:

### 1. Multi-Agent Grid Orchestration (`multiAgentOrchestrator.js`)
- **Autonomous Node Agents**: Every intersection acts as an independent software agent assessing localized camera feeds and vehicle queues.
- **Neighbor Consensus Protocol**: Agents continuously negotiate with upstream and downstream neighboring intersections, dampening shockwaves and preventing gridlock spillback.
- **Cooperative Game Theory**: Optimizes network-wide vehicular throughput rather than selfish single-intersection cycle hoarding.

### 2. Explainable AI Decision Engine (XAI)
- **Transparent Audit Trails**: Eliminates "black-box" automation by generating real-time human-readable rationale logs for every signal phase extension or truncation:
  > *"Extended Green Phase on Hosur North approach by +15s: 38 vehicles queued (82% heavy transit), downstream capacity clear (91% confidence score)."*
- **AIAgentCenter Command Console (`AIAgentCenter.jsx`)**: Administrative dashboard displaying agent states, active negotiations, consensus scores, and decision attribution graphs.

### 3. Model Deployment & Benchmark Runbooks
- **`DEPLOYMENT_GUIDE_ML_MODELS.md`**: Step-by-step instructions for containerized multi-agent edge nodes.
- **`ML_MODELS_DEPLOYMENT_SUMMARY.md`**: Complete summary of model architectures, inference latency budgets (<45ms), and precision benchmarks.
- **`QUICK_START.md`**: Quick reference guide to initialize, verify, and monitor multi-agent networks.

---

## 📁 Repository Structure (Milestone 9)

```text
UrbanSaathi/
├── DEPLOYMENT_GUIDE_ML_MODELS.md          # Multi-agent edge deployment runbook
├── ML_MODELS_DEPLOYMENT_SUMMARY.md        # AI inference latency & accuracy summary
├── QUICK_START.md                         # Quick start guide
├── backend/
│   ├── services/multiAgentOrchestrator.js # Swarm intelligence coordinator
│   └── services/signalCoordinationService.js # Inter-signal synchronization
├── frontend/
│   └── src/components/admin/AIAgentCenter.jsx # Real-time AI agent telemetry UI
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

## 🧪 Inspecting Multi-Agent State & Decisions

```bash
# Query active agent consensus status
curl http://localhost:5001/api/signals/coordination-status

# Fetch real-time AI decision explanation log
curl http://localhost:5001/api/signals/explainability-logs
```

---

## 🗺️ Implementation Roadmap

- [x] **Milestone 1: Project Scaffolding & Setup**
- [x] **Milestone 2: Frontend Layout, Navigation & Portal UI**
- [x] **Milestone 3: Express Backend Core, Authentication & Database Models**
- [x] **Milestone 4: Full-Stack API Integration & State Synchronization**
- [x] **Milestone 5: AI/ML Infrastructure & Vehicle Detection Models**
- [x] **Milestone 6: Real-time Video Stream Inference & WebSocket Gateway**
- [x] **Milestone 7: Emergency Dispatch & Automated Green Corridor Bypass**
- [x] **Milestone 8: Connected Vehicle (V2X) Protocol & Driver HUD**
- [x] **Milestone 9: Multi-Agent Signal Coordination & Explainable AI** *(Current)*
- [ ] **Milestone 10: Urban Digital Twin, Production Hardening & Final Polishing**
