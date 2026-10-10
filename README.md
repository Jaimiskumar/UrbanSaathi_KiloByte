# UrbanSaathi: AI-Powered Smart Traffic & Urban Mobility Ecosystem

[![Architecture](https://img.shields.io/badge/Architecture-Monorepo%20%7C%20Microservices-blue.svg)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20TailwindCSS-61DAFB.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](#)
[![Database](https://img.shields.io/badge/Database-MongoDB%20%2B%20Mongoose-47A248.svg)](#)
[![Status](https://img.shields.io/badge/Milestone%202-Frontend%20Portals%20%26%20Dashboards-brightgreen.svg)](#)

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
                          │         Express API Server          │
                          │       (Node.js / JWT Auth)          │
                          └──────────┬─────────────────┬────────┘
                                     │                 │
                ┌────────────────────┴────┐       ┌────┴────────────────────────┐
                ▼                         ▼       ▼                             ▼
    ┌───────────────────────────┐    ┌──────────────────────────────────────────────┐
    │     MongoDB Database      │    │             Python AI/ML Engine              │
    │  (Traffic, Users, Hubs)   │    │     (YOLOv5, OpenCV, Deep Learning)          │
    └───────────────────────────┘    └──────────────────────────────────────────────┘
```

---

## 💻 Milestone 2: Frontend Architecture & User Interfaces

This milestone establishes the comprehensive client-side architecture with high-fidelity, role-based interfaces:

### 1. Multi-Role Portal Gateway (`/`)
- Unified access portal routing users to **Citizen**, **Traffic Police/Authority**, or **Mobile Dashcam** interfaces.
- Dynamic session persistence and role-based route guard transitions.

### 2. Citizen Services Portal (`/citizen`)
- **Smart Parking Hub**: Visual parking bay selection, real-time vacancy indicators, slot reservation, and duration pricing.
- **My Bookings & QR Verification**: Active parking pass management with instant status indicators.
- **E-Challan & Violation Appeals**: Review disputed traffic penalties, view violation timestamps, and submit verification appeals.
- **Civic Issue Reporting**: Citizen hazard submission interface with photo attachment and geolocation tagging.
- **Live Traffic Map**: City-wide congestion heatmaps and incident advisories.

### 3. Traffic Authority Command Center (`/admin`)
- **Live Junction Grid**: Real-time camera feeds, vehicle classification counters, and adaptive signal phase indicators.
- **Violation & Encroachment Center**: Multi-camera AI surveillance feed monitoring helmet compliance, stop-line violations, and illegal parking.
- **Emergency Vehicle Dispatch**: Dedicated priority routing controls, dynamic green wave toggle, and signal preemption telemetry.
- **V2X Fleet Safety Hub**: Connected vehicle incident broadcasting and in-cabin alert dissemination.

### 4. Mobile Driver Dashcam & In-Cabin HUD (`/dashcam`, `/app`)
- Optimized for mobile viewports and vehicle mount displays.
- Live road stream rendering, GPS telemetry overlay, and collision advisory warnings.

---

## 📁 Repository Structure (Milestone 2)

```text
UrbanSaathi/
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── public/
│   │   ├── favicon.ico
│   │   └── images/
│   └── src/
│       ├── main.jsx                       # Application entry & DOM bootstrap
│       ├── App.jsx                        # Global routing, toast alerts & socket hooks
│       ├── index.css                      # Tailwind base & custom design tokens
│       ├── config/
│       │   └── bangaloreGeospatial.js     # Spatial coordinates, bounding boxes & landmarks
│       ├── pages/
│       │   ├── PortalGateway.jsx          # Public landing & portal selection
│       │   ├── Login.jsx                  # Unified role authentication view
│       │   ├── CitizenDashboard.jsx       # Citizen services hub layout
│       │   ├── AdminDashboard.jsx         # Command center hub layout
│       │   ├── MobileAppPage.jsx          # Mobile standalone web app container
│       │   └── MobileV2VDashcam.jsx       # Vehicle HUD & Dashcam video view
│       └── components/
│           ├── citizen/                   # Parking booking, fines, issue reports, maps
│           ├── admin/                     # Junction monitoring, AI agent center, emergency
│           ├── mobile/                    # Mobile optimized navigation & components
│           └── connected-vehicle/         # V2X telemetry & driver alerts
├── docker-compose.yml
├── setup.sh
├── setup.bat
├── .env.production.example
├── .gitignore
└── README.md
```

---

## 🚀 Running the Frontend

```bash
cd frontend
npm install
npm run dev
```
The client application will start at `http://localhost:5173`.

---

## 🗺️ Implementation Roadmap

- [x] **Milestone 1: Project Scaffolding & Setup**
- [x] **Milestone 2: Frontend Layout, Navigation & Portal UI** *(Current)*
- [ ] **Milestone 3: Express Backend Core, Authentication & Database Models**
- [ ] **Milestone 4: Full-Stack API Integration & State Synchronization**
- [ ] **Milestone 5: AI/ML Infrastructure & Vehicle Detection Models**
- [ ] **Milestone 6: Real-time Video Stream Inference & WebSocket Gateway**
- [ ] **Milestone 7: Emergency Dispatch & Automated Green Corridor Bypass**
- [ ] **Milestone 8: Connected Vehicle (V2X) Protocol & Driver HUD**
- [ ] **Milestone 9: Multi-Agent Signal Coordination & Explainable AI**
- [ ] **Milestone 10: Urban Digital Twin, Production Hardening & Final Polishing**
