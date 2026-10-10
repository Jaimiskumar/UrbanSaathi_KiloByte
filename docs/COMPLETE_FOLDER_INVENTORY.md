# Complete Smart-Horizon Folder Inventory

This is the repository inventory for the opened `Smart-Horizon` folder. Paths use `/` separators for readability.

## Inventory totals

- **6,015 non-generated files** discovered.
- **Approximately 1.31 GB** of non-generated content.
- The inventory excludes dependency/build/runtime directories from the detailed source tree: `.git/`, `backend/node_modules/`, `frontend/node_modules/`, `frontend/dist/`, `__pycache__/`, and upload runtime data.
- The largest collection is `classification of vehicle/Vehicles/`, containing **5,590 image files**.
- The vendored YOLO source under `models/torch_hub/` is included by directory and purpose below.

## Root files

```text
.env.production.example
.gitattributes
.gitignore
ADVANCED_FEATURES_COMPLETE.md
DEPLOYMENT_GUIDE_ML_MODELS.md
DEPLOYMENT_READY.md
DEPLOYMENT_STATUS.txt
docker-compose.yml
EMERGENCY_VEHICLE_IMPLEMENTATION_COMPLETE.md
IMPLEMENTATION_COMPLETE.md
IMPLEMENTATION_STATUS_COMPLETE.md
ML_AND_ADAPTIVE_SYSTEM.md
ML_DEPLOYMENT_INDEX.md
ML_MODELS_DATASET_SPECIFICATION.md
ML_MODELS_DEPLOYMENT_SUMMARY.md
ML_TESTING_GUIDE.md
PPT_README.md
QUICK_CHALLAN_IMPLEMENTATION.md
QUICK_START.md
README.md
START_HERE.md
VERIFICATION_CHECKLIST.md
ml_backend_api.py
ml_requirements.txt
setup.bat
setup.sh
setup_ai.py
yolov5s.pt
```

## Backend

```text
backend/
├── .env
├── .env.example
├── package.json
├── package-lock.json
├── server.js
├── server-standalone.js
├── test-ml-detection.sh
├── config/
│   ├── bangaloreGeospatial.js
│   └── env.js
├── middleware/
│   └── auth.js
├── models/
│   ├── AuditLog.js
│   ├── Camera.js
│   ├── Challan.js
│   ├── CitizenEncroachmentReport.js
│   ├── Emergency.js
│   ├── EmergencyVehicle.js
│   ├── Encroachment.js
│   ├── Fine.js
│   ├── HelmetViolation.js
│   ├── IllegalParking.js
│   ├── MLDetectionLog.js
│   ├── ParkingBooking.js
│   ├── ParkingSpot.js
│   ├── ParkingZone.js
│   ├── PaymentTransaction.js
│   ├── RefreshToken.js
│   ├── RoadIssue.js
│   ├── RoadNetwork.js
│   ├── SignalCoordination.js
│   ├── StreetEncroachment.js
│   ├── TrafficSignal.js
│   ├── TrafficViolation.js
│   ├── User.js
│   ├── VehicleInsurance.js
│   ├── VehiclePUC.js
│   ├── VehicleRC.js
│   └── onnx/tiny-yolov3-11.onnx
├── routes/
│   ├── adminReports.js
│   ├── audit.js
│   ├── auth.js
│   ├── bangaloreRoutes.js
│   ├── cameras.js
│   ├── challanRoutes.js
│   ├── citizenReportRoutes.js
│   ├── documentRoutes.js
│   ├── emergency.js
│   ├── emergencyRoutes.js
│   ├── encroachment.js
│   ├── fines.js
│   ├── illegalParking.js
│   ├── mlDetection.js
│   ├── parking.js
│   ├── parkingAmenities.js
│   ├── paymentGateway.js
│   ├── payments.js
│   ├── roadIssues.js
│   ├── signalCoordinationRoutes.js
│   ├── streetEncroachment.js
│   ├── traffic.js
│   ├── trafficSignals.js
│   ├── urbanflow.js
│   ├── violations.js
│   └── weatherSignals.js
├── services/
│   ├── adminCitizenSyncService.js
│   ├── auditLogger.js
│   ├── challanGenerationService.js
│   ├── citizenReportVerificationService.js
│   ├── communityCloudService.js
│   ├── documentManagementService.js
│   ├── emergencyReroutingService.js
│   ├── encroachmentDetector.js
│   ├── fileUploadService.js
│   ├── fileUploadService_enhanced.js
│   ├── greenCorridorService.js
│   ├── illegalParkingDetector.js
│   ├── mlCameraService.js
│   ├── mlModelInference.js
│   ├── mockMLInference.js
│   ├── multiAgentOrchestrator.js
│   ├── parkingAmenitiesService.js
│   ├── paymentGatewayService.js
│   ├── paymentService.js
│   ├── realMLInference.js
│   ├── realMLInference_old.js
│   ├── signalCoordinationService.js
│   ├── trafficSimulator.js
│   ├── urbanflowService.js
│   └── weatherAdaptiveSignal.js
├── scripts/
│   ├── seed.js
│   ├── seedFinesAndViolations.mjs
│   ├── seedReports.mjs
│   └── seedReportsData.mjs
└── utils/
    ├── permissions.js
    └── tokens.js
```

`backend/node_modules/` is installed dependency content and is not part of the maintainable application source inventory. `backend/uploads/` is runtime upload storage.

## Frontend

```text
frontend/
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── public/
│   ├── favicon.ico
│   ├── images/
│   │   ├── encroachment/
│   │   │   ├── README.md
│   │   │   ├── hawker1.jpg
│   │   │   └── hawker2.jpg
│   │   └── illegal-parking/
│   │       ├── README.md
│   │       ├── parking1.jpg
│   │       ├── parking2.jpg
│   │       ├── parking3.jpg
│   │       ├── parking4.jpg
│   │       └── parking5.jpg
│   └── videos/
│       ├── Hikvision_Traffic_Flow_Analysis_Camera_240P.mp4
│       ├── Vehicle Detection and Traffic Counting using AI..mp4
│       ├── video_2.mp4
│       ├── video_3.mp4
│       └── video_4.mp4
└── src/
    ├── App.jsx
    ├── index.css
    ├── main.jsx
    ├── config/bangaloreGeospatial.js
    ├── pages/
    │   ├── AdminDashboard.jsx
    │   ├── CitizenDashboard.jsx
    │   ├── Login.jsx
    │   ├── MobileAppPage.jsx
    │   ├── MobileV2VDashcam.jsx
    │   └── PortalGateway.jsx
    └── components/
        ├── admin/
        │   ├── AIAgentCenter.jsx
        │   ├── Analytics.jsx
        │   ├── BangaloreTrafficMap.jsx
        │   ├── DailyReports.jsx
        │   ├── EmergencyControl.jsx
        │   ├── EncroachmentMonitoring.jsx
        │   ├── IllegalParkingDetection.jsx
        │   ├── MLDetectionUpload.jsx
        │   ├── MLDetectionUpload.README.md
        │   ├── ParkingManagement.jsx
        │   ├── TrafficMonitoring.jsx
        │   ├── V2VSafetyCenter.jsx
        │   └── ViolationManagement.jsx
        ├── citizen/
        │   ├── MyBookings.jsx
        │   ├── MyFines.jsx
        │   ├── ParkingBooking.jsx
        │   ├── ReportRoadIssue.jsx
        │   ├── ReportViolation.jsx
        │   ├── RoadNews.jsx
        │   ├── SmartCityShield.jsx
        │   └── TrafficMap.jsx
        ├── connected-vehicle/
        │   └── ConnectedVehicleDashboard.jsx
        └── mobile/
            ├── AdminMobileApp.jsx
            ├── CitizenMobileApp.jsx
            ├── MobileFieldApp.jsx
            └── PoliceLoginGate.jsx
```

`frontend/node_modules/` and `frontend/dist/` are installed/build output and are excluded from the source tree.

## Python, training, and utility files

```text
ml_backend_api.py                         # FastAPI vision service
urbanflow_app/main.py                     # UrbanFlow multi-agent API
training/
├── evaluate_models.py                    # Model evaluation
└── train_all.py                          # Train the model collection
scripts/
├── generate_synthetic_data.py             # Generate ML datasets
├── seedFines.mjs                          # Seed fine data
├── seedReports.mjs                        # Seed report data
├── takeScreenshots.js                     # Capture UI screenshots
└── test_connected_vehicle_system.js       # Connected-vehicle test flow
```

## Data and datasets

```text
data/
├── processed/data_quality_report.json
└── synthetic/
    ├── accidents/accidents_synthetic.csv
    ├── combined/multimodal_traffic_dataset.csv
    ├── emergency/emergency_v2x.csv
    ├── hotspots/hotspots_synthetic.csv
    ├── pedestrians/pedestrians_synthetic.csv
    ├── potholes/potholes_synthetic.csv
    ├── secondary_collision/secondary_collision_synthetic.csv
    ├── traffic/traffic_synthetic.csv
    ├── traffic_prediction/prediction_time_series.csv
    └── v2v/v2v_synthetic.csv
```

### Vehicle classification dataset

```text
classification of vehicle/
└── Vehicles/
    ├── Auto Rickshaws/     # 798 image files
    ├── Bikes/              # 798 image files
    ├── Cars/               # 798 image files
    ├── Motorcycles/        # 798 image files
    ├── Planes/             # 800 image files
    ├── Ships/              # 800 image files
    └── Trains/             # 798 image files
```

The images are numbered class-specific records and use `.jpg` and `.png` formats. The seven folders contain 5,590 images in total; individual image names are repetitive dataset records rather than application source files.

## Model artifacts

```text
models/
├── accident_model.joblib
├── accident_model_v1.joblib
├── emergency_model_v1.joblib
├── emergency_priority_model.joblib
├── feature_importance.json
├── hotspot_model.joblib
├── hotspot_model_v1.joblib
├── metrics.json
├── multimodal_model.joblib
├── multimodal_model_v1.joblib
├── pedestrian_model_v1.joblib
├── pedestrian_risk_model.joblib
├── pothole_model.joblib
├── pothole_model_v1.joblib
├── secondary_collision_model.joblib
├── secondary_collision_model_v1.joblib
├── easyocr/
│   ├── craft_mlt_25k.pth
│   └── english_g2.pth
└── torch_hub/
    ├── trusted_list
    └── ultralytics_yolov5_master/
```

The `models/torch_hub/ultralytics_yolov5_master/` directory is a vendored YOLOv5 checkout. Its major folders are `.github/`, `classify/`, `data/`, `models/`, `segment/`, and `utils/`, with training, prediction, segmentation, logging, Docker, and deployment support files. It is third-party model implementation content, not Smart-Horizon business logic.

The root `yolov5s.pt` is the main YOLO model artifact. `backend/models/onnx/tiny-yolov3-11.onnx` is an additional ONNX detector artifact.

## Documentation

```text
docs/
├── 00_START_HERE.md
├── ADVANCED_FEATURES_GUIDE.md
├── ADVANCED_FEATURES_STATUS.md
├── API_TESTING_GUIDE.md
├── ARCHITECTURE.md
├── COMPLETE_INTEGRATION_GUIDE.md
├── COMPLETE_SYSTEM_SUMMARY.md
├── COMPLETE_FOLDER_INVENTORY.md
├── DEPLOYMENT_CHECKLIST.md
├── EMERGENCY_VEHICLE_API_TESTING.md
├── EMERGENCY_VEHICLE_IMPLEMENTATION_SUMMARY.md
├── EMERGENCY_VEHICLE_ML_INTEGRATION.md
├── EMERGENCY_VEHICLE_QUICK_REFERENCE.md
├── EMERGENCY_VEHICLE_SYSTEM.md
├── EMERGENCY_VEHICLE_UI_INTEGRATION.md
├── ENCROACHMENT_MONITORING.md
├── ILLEGAL_PARKING_DETECTION.md
├── IMAGE_FEATURE_OVERVIEW.md
├── IMPLEMENTATION_SUMMARY.md
├── INTEGRATION_CHECKLIST.md
├── ML_DETECTION_COMPLETE.md
├── ML_DETECTION_QUICK_START.md
├── ML_DOCUMENTATION_INDEX.md
├── ML_SYSTEM_GUIDE.md
├── PYTHON_ML_SERVICE_SETUP.md
├── QUICKSTART_ML_SYSTEM.md
├── SOLAPUR_SCALABILITY.md
├── SYSTEM_FLOW_DIAGRAMS.md
├── changes.md
├── current.md
├── guides/
│   ├── ADD_ILLEGAL_PARKING_IMAGES.md
│   ├── ENCROACHMENT_FEATURE.md
│   ├── ENCROACHMENT_FLOW.md
│   ├── FILES_CREATED.md
│   ├── FINAL_CHECKLIST.md
│   ├── ILLEGAL_PARKING_FEATURE.md
│   ├── IMAGE_INTEGRATION_COMPLETE.md
│   ├── IMAGE_INTEGRATION_GUIDE.md
│   ├── IMAGES_READY.md
│   └── QUICK_IMAGE_SETUP.txt
├── setup/
│   ├── SETUP.md
│   ├── SETUP_COMPLETE.md
│   └── START_HERE.md
└── screenshots/
    ├── 2_admin_dashboard.png
    ├── 3_traffic_monitoring.png
    ├── 4_citizen_dashboard.png
    ├── 5_citizen_report.png
    ├── admin_flow_demo.webp
    ├── citizen_flow_demo.webp
    ├── admin_portal/                  # 7 PNG screenshots
    └── citizen_portal/                # 3 PNG screenshots
```

## Runtime and generated folders

These folders may exist locally but are not maintainable source files:

```text
.git/                         # Git metadata
backend/node_modules/         # Node dependencies
backend/uploads/              # Backend runtime uploads
frontend/node_modules/        # Node dependencies
frontend/dist/                # Frontend build output, if generated
uploads/                      # Repository-level evidence/runtime uploads
__pycache__/                  # Python bytecode cache
```

## Quick navigation by task

| Task | Start here |
|---|---|
| Run the web application | `frontend/src/App.jsx`, `backend/server.js`, `README.md` |
| Add or inspect an API | `backend/routes/` and matching `backend/services/` |
| Add or inspect stored data | `backend/models/` |
| Inspect admin UI | `frontend/src/components/admin/` |
| Inspect citizen UI | `frontend/src/components/citizen/` |
| Inspect mobile/V2V UI | `frontend/src/components/mobile/`, `frontend/src/components/connected-vehicle/` |
| Inspect computer vision | `ml_backend_api.py`, `backend/services/realMLInference.js` |
| Inspect agents/orchestration | `urbanflow_app/main.py`, `backend/services/multiAgentOrchestrator.js` |
| Retrain/evaluate models | `scripts/generate_synthetic_data.py`, `training/` |
| Understand deployment | `docker-compose.yml`, root deployment guides, `docs/setup/` |
