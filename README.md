# UrbanSaathi: AI-Powered Smart Traffic & Urban Mobility Ecosystem

[![Architecture](https://img.shields.io/badge/Architecture-Monorepo%20%7C%20Microservices-blue.svg)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20TailwindCSS-61DAFB.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](#)
[![Database](https://img.shields.io/badge/Database-MongoDB%20%2B%20Mongoose-47A248.svg)](#)
[![Status](https://img.shields.io/badge/Milestone%203-Backend%20Core%20%26%20Database%20Architecture-brightgreen.svg)](#)

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
    └───────────────────────────┘    └──────────────────────────────────────────────┘
```

---

## ⚙️ Milestone 3: Backend Core & Database Architecture

This milestone establishes the robust server runtime, database schemas, and authenticated RESTful API gateway:

### 1. Express Application Runtime (`server.js` & `server-standalone.js`)
- Highly resilient Express server architecture featuring zero-crash fallback mechanisms.
- Real-time Socket.IO event gateway enabling synchronized telemetry across mobile, desktop, and administrative command consoles.
- Modular route mounting, request logging, error middleware, and CORS security.

### 2. Database Models & Schema Design (`backend/models/`)
Comprehensive Mongoose data models encapsulating urban municipal operations:
- **`User.js` & `RefreshToken.js`**: Multi-role identity (Citizen, Admin, Traffic Police, Field Agent) with hashed credentials and secure token invalidation.
- **`Challan.js`, `Fine.js`, `TrafficViolation.js`**: E-Challan records, violation proofs, payment verification statuses, and citizen appeal logs.
- **`HelmetViolation.js` & `Encroachment.js`**: AI vision incident structures capturing bounding coordinates, confidence metrics, and timestamped snapshots.
- **`ParkingSpot.js` & `ParkingBooking.js`**: Real-time slot occupancy tracking, dynamic hourly tariff calculations, and QR verification codes.
- **`EmergencyVehicle.js` & `SignalCoordination.js`**: Priority vehicle telemetry, destination waypoints, and automated green corridor stages.
- **`RoadNetwork.js` & `TrafficSignal.js`**: Urban road geometry, intersection junction nodes, and adaptive signal phase timings.

### 3. Service Layer Architecture (`backend/services/`)
- **`challanGenerationService.js`**: Automated e-challan synthesis from camera violation events.
- **`greenCorridorService.js`**: Dynamic signal preemption algorithm routing priority responders through congestion bottlenecks.
- **`adminCitizenSyncService.js`**: Bidirectional state synchronization between citizen violation appeals and administrative resolutions.
- **`parkingAmenitiesService.js`**: Real-time bay reservation validation and payment reconciliation.

### 4. API Endpoints Catalog
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate user & issue JWT tokens | Public |
| `POST` | `/api/auth/register` | Register citizen profile | Public |
| `GET` | `/api/parking/spots` | Retrieve live parking bays and vacancy states | Optional |
| `POST` | `/api/parking/book` | Reserve parking slot and generate pass | Citizen |
| `GET` | `/api/challans/my-fines` | Fetch outstanding traffic penalties | Citizen |
| `POST` | `/api/challans/appeal` | Submit penalty review appeal with evidence | Citizen |
| `GET` | `/api/traffic/junctions` | Live traffic junction congestion levels | Admin |
| `POST` | `/api/emergency/dispatch` | Trigger green corridor signal preemption | Admin / Fleet |
| `GET` | `/api/urbanflow/network-info` | Network interface detection for LAN & mobile access | Public |

---

## 📁 Repository Structure (Milestone 3)

```text
UrbanSaathi/
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example
│   ├── server.js                          # Core Express API entrypoint
│   ├── server-standalone.js               # Resilient standalone gateway
│   ├── test-ml-detection.sh               # API verification script
│   ├── config/
│   │   ├── env.js                         # Environment validation
│   │   └── bangaloreGeospatial.js         # Geospatial landmarks & boundaries
│   ├── middleware/
│   │   └── auth.js                        # JWT verification & role authorization
│   ├── models/                            # 26 Mongoose schema models
│   │   ├── User.js, RefreshToken.js
│   │   ├── Challan.js, Fine.js, TrafficViolation.js
│   │   ├── HelmetViolation.js, Encroachment.js, IllegalParking.js
│   │   ├── ParkingSpot.js, ParkingBooking.js, ParkingZone.js
│   │   ├── EmergencyVehicle.js, SignalCoordination.js
│   │   └── RoadNetwork.js, TrafficSignal.js, Camera.js
│   ├── routes/                            # 26 Express REST controllers
│   ├── services/                          # Business logic & automation engines
│   ├── scripts/                           # Database seeders (seed.js)
│   └── utils/                             # Token generators & permissions
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── public/
│   └── src/
├── docker-compose.yml
├── setup.sh
├── setup.bat
├── .env.production.example
├── .gitignore
└── README.md
```

---

## 🚀 Running the Backend

```bash
cd backend
npm install
cp .env.example .env

# Seed initial database with Bengaluru urban junctions & parking hubs
npm run seed

# Start server
npm run dev
```
The API server will listen on `http://localhost:5001`.

---

## 🗺️ Implementation Roadmap

- [x] **Milestone 1: Project Scaffolding & Setup**
- [x] **Milestone 2: Frontend Layout, Navigation & Portal UI**
- [x] **Milestone 3: Express Backend Core, Authentication & Database Models** *(Current)*
- [ ] **Milestone 4: Full-Stack API Integration & State Synchronization**
- [ ] **Milestone 5: AI/ML Infrastructure & Vehicle Detection Models**
- [ ] **Milestone 6: Real-time Video Stream Inference & WebSocket Gateway**
- [ ] **Milestone 7: Emergency Dispatch & Automated Green Corridor Bypass**
- [ ] **Milestone 8: Connected Vehicle (V2X) Protocol & Driver HUD**
- [ ] **Milestone 9: Multi-Agent Signal Coordination & Explainable AI**
- [ ] **Milestone 10: Urban Digital Twin, Production Hardening & Final Polishing**
