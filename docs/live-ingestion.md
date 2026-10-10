# Live Camera Ingestion

SENTINEL-X consumes the camera catalogue before opening a stream. Do not hard-code camera ids or stream URLs.

## Start a worker

From the repository root:

```powershell
$env:INGEST_CATALOGUE_URL = "http://<host>/api/ingest"
python scripts/live_ingest.py --camera-id <catalogue-camera-id> --ml-url http://127.0.0.1:8000
```

The catalogue is expected to return either a camera array or `{ "cameras": [] }`. Each camera should provide an id, live status, location, and an RTSP URL under one of the supported catalogue fields. The worker prefers RTSP because it is the inference transport; HLS and WebRTC remain dashboard playback transports.

## Runtime behavior

- RTSP is opened with FFmpeg TCP transport.
- Frames are processed from a live `VideoCapture`; the worker never seeks, downloads, or publishes streams.
- Sampling and timing use `CAP_PROP_POS_MSEC` PTS values, never declared FPS or frame arrival time.
- Missing PTS frames are skipped rather than assigned wall-clock timestamps.
- Reconnects use exponential backoff from 2 seconds up to 30 seconds.
- Decoder warnings and scene/PTS resets are logged and do not permanently terminate a camera worker.
- Camera resolution, codec, bitrate, and frame rate are not assumed to be uniform.

Use `--workers N` only for cameras that are actively needed. Each connected client receives its own stream copy, so the catalogue should be filtered with `--camera-id` for focused evaluation.

## Smoke check

```powershell
python scripts/live_ingest.py --catalogue-url http://<host>/api/ingest --camera-id <id> --once
```

`--once` attempts one connection and exits, which is useful for confirming catalogue status and decoder support without creating a long-running worker.