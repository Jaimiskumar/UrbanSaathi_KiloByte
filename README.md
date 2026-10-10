# UrbanSaathi: AI-Powered Smart Traffic & Urban Mobility Ecosystem

[![Architecture](https://img.shields.io/badge/Architecture-Monorepo%20%7C%20Microservices-blue.svg)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite%20%2B%20TailwindCSS-61DAFB.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](#)
[![Database](https://img.shields.io/badge/Database-MongoDB%20%2B%20Mongoose-47A248.svg)](#)
[![Status](https://img.shields.io/badge/Milestone%201-Project%20Scaffolding%20%26%20Setup-orange.svg)](#)

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
                          ┌────────────────────────┐
                          │   UrbanSaathi Client   │
                          │ (React / Vite / Mapbox)│
                          └───────────┬────────────┘
                                      │ REST / WebSocket
                                      ▼
                          ┌────────────────────────┐
                          │   Express API Server   │
                          │   (Node.js / JWT Auth) │
                          └─────┬────────────┬─────┘
                                │            │
                ┌───────────────┴────┐  ┌────┴─────────────────┐
                ▼                    ▼  ▼                      ▼
    ┌───────────────────────┐   ┌────────────────────────────────┐
    │   MongoDB Database    │   │      Python AI/ML Engine       │
    │ (Traffic, Users, Hubs)│   │  (YOLOv5, OpenCV, Deep Learning│
    └───────────────────────┘   └────────────────────────────────┘
```

---

## 📁 Repository Structure (Milestone 1)

```text
UrbanSaathi/
├── backend/
│   ├── package.json               # Backend dependencies (Express, Mongoose, Socket.io, JWT)
│   ├── package-lock.json
│   └── .env.example               # Backend environment templates
├── frontend/
│   ├── package.json               # Frontend dependencies (React, Vite, TailwindCSS, Lucide)
│   ├── package-lock.json
│   ├── vite.config.js             # Vite build & proxy configuration
│   ├── tailwind.config.js         # Tailwind styling tokens
│   ├── postcss.config.js
│   └── index.html                 # Single page application entrypoint
├── docker-compose.yml             # Container orchestration (App + Mongo + Redis)
├── setup.sh                       # Automated UNIX environment bootstrap script
├── setup.bat                      # Automated Windows bootstrap script
├── .env.production.example        # Production environment specification
├── .gitignore                     # Workspace ignore rules
└── README.md                      # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **MongoDB**: `v6.0+` (local or MongoDB Atlas)
- **Python**: `v3.10+` (for future ML services)

### Quick Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sashwatpuri/UrbanSaathi.git
   cd UrbanSaathi
   ```

2. **Install Backend Dependencies:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   ```

3. **Install Frontend Dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Environment Initialization:**
   Review `.env.example` inside `backend/` and configure database connection strings and secret keys.

---

## 🗺️ Implementation Roadmap

- [x] **Milestone 1: Project Scaffolding & Setup** *(Current)*
- [ ] **Milestone 2: Frontend Layout, Navigation & Portal UI**
- [ ] **Milestone 3: Express Backend Core, Authentication & Database Models**
- [ ] **Milestone 4: Full-Stack API Integration & State Synchronization**
- [ ] **Milestone 5: AI/ML Infrastructure & Vehicle Detection Models**
- [ ] **Milestone 6: Real-time Video Stream Inference & WebSocket Gateway**
- [ ] **Milestone 7: Emergency Dispatch & Automated Green Corridor Bypass**
- [ ] **Milestone 8: Connected Vehicle (V2X) Protocol & Driver HUD**
- [ ] **Milestone 9: Multi-Agent Signal Coordination & Explainable AI**
- [ ] **Milestone 10: Urban Digital Twin, Production Hardening & Final Polishing**
