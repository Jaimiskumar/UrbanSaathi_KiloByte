# UrbanSaathi Road Intelligence

Road Intelligence enriches a GPS-based road issue with KGIS road attributes and, when a verified match exists, BBMP road-history information.

## Trust boundary

The trusted chain is:

```text
GPS -> nearest KGIS geometry -> road_match -> BBMP road history -> authority report
```

`KGISRoad_CentrelineID` and `BBMP segment_id` are different identifiers. They must only be connected through the `RoadMatch` collection. If a match or road-history record is absent, the API returns:

> Road identified, but verified BBMP road-history information is unavailable.

No contractor or work-order value is inferred from a missing record.

## API

`GET /api/road-intelligence/lookup?lat=12.9716&lng=77.5946&issueType=Pothole`

The endpoint requires an access token and returns KGIS attributes, verified BBMP history when available, an explainable priority, and an `aiPrediction` field reserved for the experimental contractor model. The current implementation returns `aiPrediction: null` until the model assets and inference runtime are installed.

Citizen submissions to `POST /api/road-issues` automatically attach the lookup result, priority, risk score, and a recommendation. Evidence is optional at the API level.

## Collections

- `roadmasters`: KGIS LineString geometries and road attributes
- `roadmatches`: verified or reviewed KGIS-to-BBMP associations
- `roadworkhistories`: imported BBMP work-history records
- `issueverifications`: later evidence that an issue was resolved or remains present

The current authority view is available at `/admin/road-intelligence`.

## Data loading

Place source data under `data/raw/` and preprocess it into MongoDB. Do not put the complete KML or CSV into frontend code. The repository currently contains no official KGIS or BBMP source files; until they are loaded, the service intentionally reports unavailable road context.