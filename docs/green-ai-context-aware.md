# Green AI Layer 3: Context-aware workload allocation

Layer 3 extends the existing LangGraph and detector flow. It does not add a
second agent runtime, alter Layer 1 precision selection, or claim energy
savings from skipped work.

## Three-layer view

Open **Admin → Green AI · 3 Layers** (`/admin/green-ai`) to see:

1. **Model optimization:** the ML health response, loaded model inventory,
   precision selection and a measured benchmark report when one exists.
2. **Feature allocation:** the existing registered LangGraph agents and the
   latest real workflow's selected and actually executed agents, activation
   reasons, skipped-agent explanations and per-agent outcome trace.
3. **Context-aware workload:** the latest decision, input freshness,
   escalation rationale and detector sampling interval.

The execution view reports workflow latency and agent outcomes from the live
backend process. Model/runtime details are shown only when returned by the
inference service. Energy is explicitly unavailable until per-workflow power
telemetry is connected; fewer agent calls are not presented as measured energy
savings. Dry-run previews remain separate from this live trace.

The deterministic scenario controls call the allocation planner in dry-run
mode. They do not run inference, trigger an agent, alter a signal, or represent
live conditions. Historical model metrics are marked as artifact-reported;
live benchmark evidence is shown separately. A missing benchmark is not
displayed as zero energy or a successful optimization.

## Context and safety policy

The policy accepts per-event `context` fields when supplied:

```json
{
  "observedAt": "2026-06-15T12:00:00.000Z",
  "timeOfDay": "EVENING_PEAK",
  "trafficDensityVehPerKm": 48,
  "queueLengthVehicles": 18,
  "visibilityKm": 1.5,
  "rainIntensityMmph": 8,
  "modelConfidence": 0.58,
  "trackingConfidence": 0.7,
  "sceneChanged": false,
  "incidentActive": false,
  "eventActive": true,
  "affectedRoadSegmentId": "SEGMENT-123",
  "roadSegmentId": "SEGMENT-123"
}
```

Inputs are range checked and rejected as workload signals when their timestamp
is missing, invalid, future-dated, or older than the configured freshness
window. A local event affects workload only when its affected road/intersection
matches the event location and fresh traffic demand is also elevated. Peak time
alone does not raise city-wide work. If local time is derived from a timestamp,
the default time zone is `Asia/Kolkata`; set `URBANSAATHI_TIME_ZONE` for another
deployment region.

Accident/emergency event types select the emergency cadence independently of
context freshness or resource pressure. Feature-driven Layer 2 mandatory
agents remain mandatory. Stable cadence reduction requires fresh low-density,
short-queue readings and explicit stable-scene/no-incident signals; otherwise
the normal cadence is retained. Low confidence escalates verification but is
not treated as proof of correctness.

The returned `maximumDetectionDelayMs` bounds the interval between requested
detector invocations. It cannot guarantee completion latency if the model,
network, or downstream workflow is stalled; such failures remain visible as
request/workflow errors and must be monitored operationally.

Configurable limits (milliseconds):

| Variable | Default | Purpose |
| --- | ---: | --- |
| `URBANSAATHI_MIN_INFERENCE_INTERVAL_MS` | 500 | Lower bound on inference interval |
| `URBANSAATHI_NORMAL_INFERENCE_INTERVAL_MS` | 5000 | Cadence with missing or normal context |
| `URBANSAATHI_STABLE_INFERENCE_INTERVAL_MS` | 10000 | Cadence for explicitly verified stable scenes |
| `URBANSAATHI_ELEVATED_INFERENCE_INTERVAL_MS` | 2000 | Cadence for demand, hazard, uncertainty or incident escalation |
| `URBANSAATHI_EMERGENCY_INFERENCE_INTERVAL_MS` | 1000 | Emergency cadence |
| `URBANSAATHI_MAX_DETECTION_DELAY_MS` | 15000 | Maximum interval between inference requests |
| `URBANSAATHI_MAX_CONTEXT_AGE_MS` | 300000 | Maximum age accepted for context |
| `URBANSAATHI_WORKLOAD_COOLDOWN_MS` | 5000 | Hysteresis for non-emergency mode transitions |
| `URBANSAATHI_TIME_ZONE` | `Asia/Kolkata` | Zone used when deriving local time from a fresh timestamp |

## Real datasets and model training

The repository detects the adjacent `dataset` folder by default. For another
local location, set `URBANSAATHI_DATASET_ROOT` in both the backend and ML
service environments. The Green AI status endpoint reports only whether the
expected local source folders exist; it does not copy, publish, or count
private dataset files.

The checked-in training scripts use these original sources and fail if a
required source is missing (they do not substitute `data/synthetic`):

```powershell
$env:URBANSAATHI_DATASET_ROOT = 'C:\data\urbansaathi\dataset'
python training\train_real_models.py
python training\train_urban_issues.py --epochs 10 --max-per-class 250
python training\train_pedestrian_vendor_plate.py
```

`train_real_models.py` uses the accident train/validation folders, a
stratified held-out split for vehicle images, and the VANET traffic CSV. Its
accident checkpoint format matches the runtime loader. The urban-issues
trainer includes the supplied pothole/road-crack labels. Review the generated
evaluation report and validate the artifact on an independent local holdout
before deploying it. Training overwrites corresponding model/report files
under `models/real`; retain a backup when promoting new weights.

The ML service uses the supplied trained waterlogging `best.pt` and prefers
the supplied helmet training run's `best.pt` when present; the local model
artifact remains a fallback. `URBANSAATHI_HELMET_MODEL_PATH` may select a
validated promoted checkpoint explicitly. Other trained detectors remain
loaded from `models/real`. Dataset presence does not itself prove model
accuracy or suitability for a target camera/domain.

## Connected-vehicle data and storage

Connected-vehicle routes default to `URBANSAATHI_CONNECTED_VEHICLE_DEMO_MODE=false`:
they do not seed vehicles or hazards, and incoming telemetry and hazard reports
must include real identifiers and coordinates. State is currently held in
process memory, so it is lost on restart and is not shared across backend
instances. Enable demo mode only for an explicitly simulated showcase.
Community confirmation requires distinct reporter IDs with GPS accuracy within
`URBANSAATHI_HAZARD_GPS_MAX_ACCURACY_M` (default 40 meters) and a prior report
within `URBANSAATHI_HAZARD_CONFIRMATION_MAX_AGE_MS` (default 30 minutes); this
is still process-local corroboration, not independent identity verification.

## Live context gaps and measurements

- GPS/road-segment context must be attached to each event by a real device or
  trusted service; the dashboard does not manufacture coordinates.
- The weather adapter requires `WEATHER_API_KEY` for live API readings. An
  explicit `WEATHER_API_KEY=demo` opts into clearly marked random demo weather;
  an absent key or API failure is unavailable, never a synthetic live
  fallback.
- No festival/event calendar is wired in this repository; the dashboard marks
  that source as not configured.
- The scheduler reports invocation cadence, not energy savings. Layer 1 energy
  and accuracy claims require a measured benchmark report with suitable power
  telemetry and labeled validation data. Energy attribution for Node agent
  work remains unavailable.
- Route alternatives, travel times, and risk trade-offs are not fabricated by
  this layer. Existing route services must provide fresh road conditions and
  route measurements before such recommendations can be reported.

Run focused tests:

```powershell
cd backend
node --test test\contextAwareWorkload.test.js test\agentAllocation.test.js test\greenAiStatus.test.js
```
