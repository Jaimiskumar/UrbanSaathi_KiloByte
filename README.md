# UrbanSaathi

UrbanSaathi is a web platform for traffic monitoring, urban mobility services, and computer-vision-assisted traffic analysis.

## Problem

Traffic authorities need one place to inspect traffic conditions, manage violations and parking, coordinate emergency response, and share useful services with citizens. These workflows are often split across separate tools and data sources.

## Solution

UrbanSaathi combines role-based web portals, an Express API, real-time Socket.IO events, a Python vision API, and optional UrbanFlow services. The platform supports traffic and parking operations, citizen reports, emergency workflows, and analysis of uploaded traffic frames or video-derived frames.

## Key Features

- Admin portal for traffic, parking, violations, cameras, reports, and emergency operations.
- Citizen portal for parking, fines, reports, and service workflows.
- Mobile field portal at `/mobile` and `/app`.
- Connected-driver dashcam interface at `/dashcam`.
- ITD YOLOv8 vehicle detection for Indian traffic classes.
- License-plate OCR, violation processing, evidence snapshots, and challan workflows.
- Real-time Socket.IO notifications and UrbanFlow/V2X simulation endpoints.

## How It Works

```text
React/Vite frontend (5173)
        |
        v
Express API and Socket.IO (5001, or standalone 5000)
        |                         |
        v                         v
MongoDB                  Python vision API (8000)
                                  |
                                  v
                         ITD YOLOv8 + OCR and image analysis
```

The optional UrbanFlow service runs on port `8001` and provides model-backed or simulated mobility and V2X endpoints.

## AI/ML

The Python service loads `models/itd/itd_yolov8.pt` when available. This ITD v1.2 checkpoint is an Ultralytics YOLOv8 detection model with these classes:

- Two-wheeler, autorickshaw, car, bus, LCV, truck, bicycle, and pedestrian.

The vision service also contains license-plate OCR, traffic-frame processing, congestion and violation logic, and optional real-data model loading from `models/real/`. UrbanFlow loads the tabular artifacts in `models/` when its configuration permits them. The installed ITD checkpoint does not by itself provide lane-behavior, turning-movement, or time-to-collision models.

## Tech Stack

- Frontend: React 18, Vite, React Router, Tailwind CSS, Axios, Socket.IO client.
- Backend: Node.js, Express, MongoDB, Mongoose, Socket.IO, JWT.
- Vision: Python, FastAPI, Ultralytics YOLO, PyTorch, OpenCV, Pillow, EasyOCR.
- Supporting service: FastAPI, pandas, NumPy, and joblib models in `urbanflow_app/`.

## Repository Structure

```text
backend/          Express API, routes, models, and services
frontend/         React/Vite application and demo assets
models/           Trained model artifacts and ITD weights
training/         Training and evaluation scripts
data/             Synthetic and processed datasets
scripts/          Data, setup, and utility scripts
docs/             Detailed technical and feature documentation
urbanflow_app/    Optional UrbanFlow FastAPI service
ml_backend_api.py Python vision API entrypoint
```

## Documentation

Use these documents for deeper review:

| Topic | Document |
|---|---|
| Project documentation index | [docs/00_START_HERE.md](docs/00_START_HERE.md) |
| System architecture | [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) |
| Service and data flow | [docs/architecture/SYSTEM_FLOW_DIAGRAMS.md](docs/architecture/SYSTEM_FLOW_DIAGRAMS.md) |
| Setup and quick start | [docs/getting-started/SETUP.md](docs/getting-started/SETUP.md) |
| ML system guide | [docs/ml/ML_SYSTEM_GUIDE.md](docs/ml/ML_SYSTEM_GUIDE.md) |
| ITD and model specification | [docs/ml/ML_MODELS_DATASET_SPECIFICATION.md](docs/ml/ML_MODELS_DATASET_SPECIFICATION.md) |
| ML detection quick start | [docs/ml/ML_DETECTION_QUICK_START.md](docs/ml/ML_DETECTION_QUICK_START.md) |
| Deployment guide | [docs/deployment/DEPLOYMENT_GUIDE_ML_MODELS.md](docs/deployment/DEPLOYMENT_GUIDE_ML_MODELS.md) |
| Emergency vehicle system | [docs/emergency/EMERGENCY_VEHICLE_SYSTEM.md](docs/emergency/EMERGENCY_VEHICLE_SYSTEM.md) |
| API testing | [docs/API_TESTING_GUIDE.md](docs/API_TESTING_GUIDE.md) |
| Presentation guide | [docs/presentation/PPT_README.md](docs/presentation/PPT_README.md) |

## Setup & Run

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### Standalone local backend

This mode does not require MongoDB and is useful for UI demonstrations. Run it from separate terminals:

```bash
cd backend
npm install
npm run dev:standalone
```

The standalone API listens on `http://localhost:5000`.

### Full backend and vision service

Start MongoDB, then run:

```bash
cd backend
npm install
npm run dev
```

From the repository root, create a Python environment and install the ML dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r ml_requirements.txt
python ml_backend_api.py
```

The full Express API defaults to `http://localhost:5001`; the vision API uses `http://localhost:8000`. Configure deployment values with environment variables based on `.env.production.example`.

### Docker

The repository also contains `docker-compose.yml` for MongoDB, the ML service, the backend, and the frontend. Docker Desktop must be running before using:

```bash
docker compose up --build
```

## Demo / Usage

1. Open the frontend and sign in with the credentials configured by the backend environment.
2. Open **Admin Dashboard -> ML Detection**.
3. Upload an image or MP4. MP4 analysis extracts a browser-readable frame before sending it to the vision API.
4. Click **Run Full Video ML Analysis** to view detections and the annotated result image.
5. Sample traffic videos are in `frontend/public/videos/`.

Check the vision service with:

```bash
curl http://localhost:8000/health
```

The response reports the loaded detector name, backend, task, image size, and model availability.

## Credits

The ITD detector is based on the ITD Indian Traffic Dataset project by IIT Roorkee. See the [ITD repository](https://github.com/teg-iitr/ITD-Indian-traffic-dataset) and its [CC BY-NC 4.0 license](https://creativecommons.org/licenses/by-nc/4.0/). Use the model according to its license and cite the original ITD paper when appropriate.
