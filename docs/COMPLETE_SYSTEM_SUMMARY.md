# Smart-Horizon Complete System Summary

**Repository:** Smart-Horizon  
**Purpose:** Smart-city traffic, parking, safety, enforcement, and municipal response platform  
**Primary stack:** React/Vite, Node.js/Express, MongoDB/Mongoose, Socket.IO, Python/FastAPI ML services

## 1. Executive Summary

Smart-Horizon is a municipal operations platform with two main user experiences:

- **Admin operations:** traffic monitoring, parking and violation management, ML detection, encroachment response, emergency-vehicle coordination, connected-vehicle safety, analytics, and daily reports.
- **Citizen services:** parking discovery and booking, traffic and incident information, fines/challans, evidence-backed reports, road-issue reporting, and pedestrian/community safety tools.

The system is organized as a persistent Node.js API and real-time event server, a React dashboard, a Python computer-vision service, and an UrbanFlow multi-agent decision-support service. MongoDB stores the principal business records. Socket.IO distributes changes to connected dashboards and mobile clients. Some simulation, community-cloud, and orchestration state is intentionally process-local and is lost when the process restarts.

The repository is best understood as a feature-rich working prototype and integration platform. Several components are implemented end to end, while production camera hardware, physical signal controllers, field-trained ML models, and some deployment packaging still require integration or hardening.

## 2. Runtime Components and Ports

| Component | Location | Default port | Responsibility |
|---|---|---:|---|
| React/Vite frontend | `frontend/` | 3000 | Admin, citizen, mobile, dashcam, and V2V interfaces |
| Node.js/Express backend | `backend/server.js` | 5000 | Authentication, APIs, persistence, orchestration, and Socket.IO |
| MongoDB | Local/Atlas | 27017 | Persistent users, traffic, parking, enforcement, payment, and safety data |
| Vision ML API | `ml_backend_api.py` | 8000 | Frame, image, video, OCR, detection, and evidence processing |
| UrbanFlow API | `urbanflow_app/main.py` | 8001 | Multi-agent safety, prediction, orchestration, and V2V decisions |

## 3. User-Facing Features

### 3.1 Admin authority dashboard

- Authenticated administrative control center with role and permission checks.
- Traffic monitoring by zone, including selectable traffic/video sources and status views.
- Live traffic-signal state and congestion visibility.
- Parking-zone and parking-slot administration.
- Illegal-parking review, evidence, alerts, and fine/challan workflows.
- Street encroachment and hawker/blockage tracking, escalation, and resolution.
- Citizen-report review, verification, withdrawal, escalation, and reward handling.
- ML image/video upload and camera-frame processing.
- Helmet, speeding, signal, crowd, encroachment, parking, accident, and congestion result views where data is available.
- Emergency-vehicle registration, dispatch, location tracking, green-corridor control, rerouting, and corridor statistics.
- Coordinated signal corridors, timing algorithms, green waves, and performance metrics.
- AI Agent Center showing agent health, lifecycle events, decisions, approvals, and explanations.
- Connected-vehicle/V2V safety center and hazard broadcasts.
- Analytics, administrative daily reports, audit access, and operational statistics.

### 3.2 Citizen portal

- Searchable parking zones and dynamic slot maps.
- Parking booking, release, booking history, and availability updates.
- Fines and challans, payment initiation/verification, challenge, extension, and history workflows.
- Citizen violation reports with image evidence.
- Road-issue reporting and status tracking.
- Traffic, road news, incidents, and safety information.
- Smart City Shield and pedestrian-safety views.
- Notifications when reports, bookings, availability, challans, or payments change.

### 3.3 Mobile, dashcam, and connected-vehicle interfaces

- Mobile routes include `/mobile` and `/app`.
- Dashcam/V2V routes include `/dashcam` and `/v2v-mobile`.
- Front/rear camera selection, geolocation, orientation, speed, and heading telemetry.
- Canvas overlays for detections and hazard visualization.
- Wi-Fi webcam/RTSP proxy support where configured.
- V2V status and hazard transmission.
- Audio hazard warnings and nearby-vehicle safety notifications.

## 4. Backend API Domains

The Express server registers these major API groups:

| API group | Main responsibility |
|---|---|
| `/api/auth` | Registration, login, refresh tokens, and logout |
| `/api/traffic` | Traffic signals, zones, and traffic state |
| `/api/parking` | Parking zones/spots, bookings, releases, and history |
| `/api/parking-amenities` | Nearby and shadow-parking services |
| `/api/fines` | Fine listing, issuance, payment state, and deletion |
| `/api/challans` | Challan retrieval, payment, challenges, extensions, and statistics |
| `/api/payments` | Payment orders, verification, webhooks, and transactions |
| `/api/illegal-parking` | Illegal-parking records, alerts, and fines |
| `/api/encroachments` | Encroachment monitoring and resolution |
| `/api/citizen-reports` | Citizen reports, evidence, verification, and withdrawal |
| `/api/road-issues` | Citizen road-issue workflow |
| `/api/cameras` | Camera registration, health, and management |
| `/api/violations` | Traffic and helmet violation records |
| `/api/street-encroachment` | ML-backed street-encroachment records |
| `/api/traffic-signals` | Signal status and congestion analysis |
| `/api/signal-coordination` | Corridors, timing algorithms, recommendations, and metrics |
| `/api/ml-detection` | Frame/image/video processing, logs, violations, and statistics |
| `/api/emergency` | Emergency incident activation and status |
| `/api/emergency-vehicles` | Emergency registration, dispatch, tracking, corridors, and rerouting |
| `/api/documents` | Insurance, RC, and PUC upload, verification, and renewal |
| `/api/admin-reports` | Administrative daily statistics |
| `/api/audit` | Audit-log access |
| `/api/urbanflow` | Agents, V2V, accidents, pedestrian safety, orchestration, and community APIs |
| `/api/bangalore` | Bengaluru zones, hotspots, corridors, and incidents |

JWT authentication protects the API, with admin/permission middleware for privileged operations. Camera heartbeat is the documented exception to the general authentication rule.

## 5. Persistence and Data Models

MongoDB/Mongoose models cover:

- Identity: `User`, `RefreshToken`
- Traffic and parking: `TrafficSignal`, `ParkingZone`, `ParkingSpot`, `ParkingBooking`
- Enforcement and payment: `Fine`, `Challan`, `PaymentTransaction`, `TrafficViolation`, `HelmetViolation`, `IllegalParking`
- Encroachment and reports: `Encroachment`, `StreetEncroachment`, `CitizenEncroachmentReport`, `RoadIssue`
- ML and cameras: `Camera`, `MLDetectionLog`
- Emergency and roads: `Emergency`, `EmergencyVehicle`, `RoadNetwork`, `SignalCoordination`
- Compliance documents: `VehicleInsurance`, `VehicleRC`, `VehiclePUC`
- Governance: `AuditLog`

MongoDB is the source of truth for records that must survive restarts. In contrast, the community-cloud connected-vehicle registry, hazard clusters, work orders, and the multi-agent orchestrator's active incident map are in-memory structures in the current implementation.

## 6. ML and AI Capabilities

### 6.1 Vision service on port 8000

Implemented in `ml_backend_api.py`, with Node integration through `backend/services/realMLInference.js`.

Available processing areas include:

- Vehicle/object detection using YOLO when the local model is available.
- Vehicle classification.
- License-plate recognition using EasyOCR.
- Bounding boxes and generated segmentation polygons.
- Speed-estimation logic.
- Signal-violation checks using signal state and configured detection zones.
- Illegal-parking/no-parking-zone checks.
- Helmet, crowd, hawker/encroachment, and congestion results.
- Accident/collision proximity heuristics.
- Water-logging color analysis.
- Road-closure endpoint with a not-configured fallback result.
- Evidence snapshot generation.
- Synthetic citizen/vehicle registry lookup.
- Auto-generated e-challan payloads.

Important endpoints include `/health`, `/batch/process-frame`, `/detect/video`, `/detect/comprehensive`, `/detect/vehicles`, `/detect/license-plate`, `/detect/helmet`, `/detect/crowd`, `/detect/illegal-parking`, `/detect/speed`, and event-specific detection routes.

The Node service calls the Python API for real processing and falls back to generated synthetic detections when the Python service is unavailable. Uploaded video is handled through frame extraction in `fileUploadService_enhanced.js`.

### 6.2 UrbanFlow models on port 8001

`urbanflow_app/main.py` loads serialized artifacts from `models/` for:

| Model artifact | Function |
|---|---|
| `accident_model.joblib` | Accident classification |
| `v2v_risk_model.joblib` | Vehicle-to-vehicle collision-risk classification |
| `pedestrian_risk_model.joblib` | Pedestrian/crosswalk risk |
| `hotspot_model.joblib` | Bengaluru traffic-hotspot risk |
| `traffic_prediction_model.joblib` | Future density, queue, and congestion prediction |
| `emergency_priority_model.joblib` | Emergency priority assessment |
| `multimodal_model.joblib` | Composite traffic-risk assessment |
| `pothole_model.joblib` | Pothole severity |
| `secondary_collision_model.joblib` | Secondary-collision risk |

Training is defined in `training/train_all.py` and uses synthetic data under `data/synthetic/`, primarily with Random Forest classifiers/regressors. The recorded metrics describe synthetic-data performance, not field validation. The model metadata identifies the dataset as synthetic `v1.0-synthetic` and states that field calibration is required.

### 6.3 Detection-to-enforcement path

```text
Camera frame or uploaded image/video
  -> Node /api/ml-detection
  -> Python vision service
  -> detection normalization and violation processing
  -> MongoDB ML logs, violations, and challans
  -> Socket.IO events
  -> admin dashboard and connected clients
```

## 7. Agents and Autonomous Components

### 7.1 UrbanFlow named agents

The UrbanFlow status surface reports these 14 named agents:

1. Accident Detection
2. V2V Safety
3. Pedestrian Safety
4. Traffic Perception
5. Infrastructure
6. Noise/Acoustic
7. Emergency V2X
8. Bengaluru Hotspot Engine
9. Spillover/Time Prediction
10. Intervention
11. Policy/Safety Compliance
12. Digital Twin
13. Consensus
14. Explainability

The repository documentation sometimes calls this a 12-agent system. The source currently reports 14 entries, and the orchestrator stages are mostly coordinated service functions rather than separately deployed autonomous processes.

### 7.2 Synchronized orchestration pipeline

`multiAgentOrchestrator.js` coordinates:

1. Multi-modal ingestion
2. V2V communication
3. Accident detection
4. Traffic perception
5. Pedestrian safety
6. Spillover/time prediction
7. Infrastructure/work-order handling
8. Intervention formulation
9. Policy validation
10. Digital-twin simulation
11. Consensus scoring
12. Explainability/operator bridge

It emits lifecycle events and tracks active incidents in an in-memory `Map`. The safety contract requires human approval, blocks autonomous actuation, and requires operator approval for physical intervention. `/api/urbanflow/orchestrate/approve` simulates execution and then emits execution events.

### 7.3 Other automated services

- `trafficSimulator.js`: seeds Bengaluru signals and parking zones and updates simulated signal traffic approximately every five seconds.
- `greenCorridorService.js`: activates emergency signal priority along a route and restores signals afterward.
- `emergencyReroutingService.js`: analyzes traffic ahead, scores alternatives, detects blocked roads, and applies reroutes.
- `signalCoordinationService.js`: provides Webster-style offsets, SCOOT-like timing, AI-labelled timing, green waves, and performance metrics.
- `weatherAdaptiveSignal.js`: caches weather-aware timing adjustments and updates them periodically.
- `communityCloudService.js`: keeps connected vehicles, hazard clusters, proximity warnings, verification, and work orders in process memory.
- `citizenReportVerificationService.js`: analyzes evidence quality, auto-verifies or escalates reports, generates challans, and calculates rewards.
- `adminCitizenSyncService.js`: broadcasts booking, challan, and availability changes.

## 8. Synchronization Model

### 8.1 Request/response synchronization

The frontend uses Axios to call the Node API. Writes such as bookings, reports, violations, challans, documents, and payments are validated by routes and persisted to MongoDB. Subsequent reads return the durable state.

### 8.2 Real-time synchronization

The backend uses Socket.IO to publish state changes without requiring dashboard refreshes. The main event families include:

- Traffic and signal status/timing changes.
- Parking booking and availability changes.
- Violation, illegal-parking, encroachment, and citizen-report alerts.
- Fine, challan, payment, and administrative updates.
- Emergency registration, location, green-corridor, and reroute updates.
- Agent lifecycle, recommendations, approvals, execution, and explanations.
- V2V messages, hazard broadcasts, proximity warnings, and secondary-collision warnings.
- Road hazards, work orders, congestion, and incident notifications.

Important documented event names include `helmet_violation_detected`, `speeding_detected`, `signal_violation_detected`, `street_encroachment_detected`, `high_congestion_alert`, `signal_status_change`, `signal_timing_adjusted`, `emergency_vehicle_detected`, `green_corridor_activated`, `emergency_reroute_applied`, and `emergency_location_update`.

The frontend consumes these events in components such as `AIAgentCenter`, `MLDetectionUpload`, `V2VSafetyCenter`, `MyFines`, and `SmartCityShield`.

### 8.3 Example citizen-to-admin flow

```text
Citizen uploads evidence
  -> report API stores report/evidence metadata
  -> verification service scores image quality and content
  -> auto-verification or admin escalation
  -> optional challan and citizen reward
  -> Socket.IO notification to admin/citizen clients
```

### 8.4 Emergency synchronization flow

```text
Vehicle registration or ML detection
  -> route calculation
  -> green corridor activation
  -> live location updates every 5-10 seconds
  -> traffic-ahead analysis and optional reroute
  -> corridor deactivation on arrival
```

### 8.5 V2V synchronization flow

The Node layer relays mobile events such as `v2v_mobile_frame`, `v2v_mobile_hazard`, and `v2v_mobile_status` to broadcast equivalents. UrbanFlow also publishes `v2v_message`, `hazard_broadcast`, `v2v_proximity_warning`, `secondary_crash_warning`, `v2v_execution`, and `traffic_signal_recommendation`.

## 9. Safety and Governance Controls

- JWT authentication and refresh-token support.
- Role and permission checks for administrative operations.
- Audit-log model and audit service.
- Evidence and report verification before enforcement decisions.
- Human approval required for UrbanFlow orchestration.
- Autonomous physical actuation explicitly blocked by the safety endpoint.
- Payment verification and webhook paths.
- Production guidance calls for HTTPS, rate limiting, API keys for camera registration, monitoring, and secure cloud storage.

The current implementation changes signal state in MongoDB and emits events. It does not demonstrate a verified hardware controller connection to physical traffic lights.

## 10. Deployment and Operational Status

The repository includes setup scripts, Docker Compose configuration, ML deployment guides, model artifacts, and testing guides. The documented intended deployment includes MongoDB, the Node backend, the frontend, the Python ML service, optional Redis/S3 integrations, payment services, and notification providers.

Before calling the deployment production-ready, resolve these repository-level inconsistencies:

- Compose references `Dockerfile.ml`, `backend/Dockerfile`, and `frontend/Dockerfile`; expected Dockerfiles are not present in the checked-in tree.
- Compose does not define the port-8001 UrbanFlow service.
- The Compose backend health check calls `/health`, while the Node server exposes `/api/health`.
- Vite is configured for port 3000, while Compose/documents also reference 5173.
- The Vite default proxy target is 5001, while the main Node backend defaults to 5000.
- `setup.bat` contains a malformed-looking `.env.production.example` copy command that should be verified.
- Node startup requires MongoDB and JWT configuration.
- Razorpay is optional; the default payment provider is `mock`.

## 11. What Is Implemented vs. What Still Needs Integration

### Strongly implemented in the repository

- React admin and citizen application shells and feature views.
- Express route registration across the traffic, parking, enforcement, payment, emergency, ML, V2V, and reporting domains.
- MongoDB models for the major operational records.
- Socket.IO event distribution and frontend listeners.
- Emergency green-corridor and rerouting service logic.
- Signal coordination and weather-adaptive timing logic.
- Python frame/image/video processing path with OCR and detection fallbacks.
- UrbanFlow model loading, agent status, recommendations, approvals, and safety gates.
- Synthetic traffic/parking simulation for local demonstrations.

### Requires production integration or validation

- Real camera fleet and reliable live RTSP operations.
- Dedicated field-trained models for every advertised detection category.
- Road-closure model configuration; the current endpoint reports that it is not configured.
- Physical traffic-signal controller integration.
- Persistent storage for community-cloud and active orchestration state.
- Field validation of synthetic-data model metrics.
- Consistent Dockerfiles, ports, health checks, environment setup, and UrbanFlow deployment.
- Production payment, SMS/email, maps, object storage, monitoring, TLS, and scaling configuration.

## 12. Key Source References

- `README.md` - product overview and local startup.
- `backend/server.js` - route registration and server integration.
- `frontend/src/App.jsx` - application routes and client surfaces.
- `backend/services/multiAgentOrchestrator.js` - synchronized agent pipeline.
- `backend/services/adminCitizenSyncService.js` - cross-dashboard broadcasts.
- `backend/services/realMLInference.js` - Node-to-Python ML integration and fallback.
- `backend/services/greenCorridorService.js` - emergency signal priority.
- `backend/services/emergencyReroutingService.js` - emergency route analysis.
- `ml_backend_api.py` - vision API.
- `urbanflow_app/main.py` - UrbanFlow API and model loading.
- `training/train_all.py` - model training pipeline.
- `docs/ML_SYSTEM_GUIDE.md` - ML architecture and API details.
- `docs/EMERGENCY_VEHICLE_SYSTEM.md` - emergency vehicle architecture.
- `docker-compose.yml` - intended container topology.
