# UrbanSaathi Contractor Prediction Model Card

## Model

- **Name:** UrbanSaathi Contractor Prediction Model
- **Type:** Neural network multiclass classification
- **Training:** 500 epochs
- **Target:** `contractor_name`
- **Classes:** approximately 1,161 contractors
- **Observed test accuracy:** approximately 25.59%

## Features

The model was trained with latitude, longitude, ward number, GIS road length, road type, road surface, and road class.

## Intended use

The model is an experimental supporting prediction component. It may rank candidate contractors or provide a fallback when an exact verified road match is unavailable.

## Limitation and trust rule

The model is not authoritative and must not be described as a reliable contractor-identification system. Contractor, work-order, ward, road-name, and maintenance-history facts must come from the verified GIS-to-BBMP mapping. When that mapping is missing, the application must return `null` or `unknown` rather than inventing a value.

## Assets

```text
models/urbansaathi_contractor_500epochs.keras
models/urbansaathi_preprocessor.pkl
models/urbansaathi_label_encoder.pkl
```

The model assets supplied with the task are not currently present in this checkout. They should be loaded once at inference-service startup, never retrained in the production application.