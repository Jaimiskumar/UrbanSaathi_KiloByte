"""Catalogue-driven live camera ingestion for Sentinel-X.

This worker consumes streams. It never publishes to the gateway and never seeks.
Use one process per actively processed camera or a small supervised worker pool.
"""

import argparse
import base64
import logging
import math
import os
import threading
import time
from typing import Any, Dict, Iterable, Optional

os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")

import cv2
import requests

LOGGER = logging.getLogger("sentinel.live_ingest")


def first_value(camera: Dict[str, Any], *paths: str) -> Optional[Any]:
    for path in paths:
        value: Any = camera
        for part in path.split("."):
            if not isinstance(value, dict):
                value = None
                break
            value = value.get(part)
        if value:
            return value
    return None


def camera_id(camera: Dict[str, Any]) -> str:
    return str(first_value(camera, "id", "camera_id", "cameraId") or "unknown")


def stream_url(camera: Dict[str, Any]) -> Optional[str]:
    return first_value(
        camera,
        "urls.rtsp",
        "streams.rtsp",
        "rtsp_url",
        "rtspUrl",
        "rtsp",
    )


def is_live(camera: Dict[str, Any]) -> bool:
    status = first_value(camera, "status", "live_status", "liveStatus")
    if status is None:
        return True
    return str(status).lower() in {"online", "live", "active", "true", "1"}


def load_catalogue(catalogue_url: str, timeout: float) -> Iterable[Dict[str, Any]]:
    response = requests.get(catalogue_url, timeout=timeout)
    response.raise_for_status()
    payload = response.json()
    cameras = payload.get("cameras", payload) if isinstance(payload, dict) else payload
    if not isinstance(cameras, list):
        raise ValueError("/api/ingest must return a camera list or a {cameras: []} object")
    return cameras


def pts_milliseconds(capture: cv2.VideoCapture) -> Optional[float]:
    value = float(capture.get(cv2.CAP_PROP_POS_MSEC))
    return value if math.isfinite(value) and value >= 0 else None


def encode_frame(frame: Any) -> str:
    success, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    if not success:
        raise RuntimeError("Could not encode decoded frame")
    return base64.b64encode(encoded.tobytes()).decode("ascii")


def process_camera(
    camera: Dict[str, Any],
    ml_url: str,
    sample_interval_ms: float,
    request_timeout: float,
    max_reconnect_seconds: float,
    once: bool,
) -> None:
    identifier = camera_id(camera)
    url = stream_url(camera)
    if not url:
        LOGGER.warning("camera=%s skipped reason=no_rtsp_url", identifier)
        return
    if not is_live(camera):
        LOGGER.info("camera=%s skipped reason=not_live", identifier)
        return

    backoff = 2.0
    last_pts = None
    last_processed_pts = None
    while True:
        capture = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not capture.isOpened():
            capture.release()
            LOGGER.warning("camera=%s connect_failed retry_seconds=%.1f", identifier, backoff)
            if once:
                return
            time.sleep(backoff)
            backoff = min(backoff * 2, max_reconnect_seconds)
            continue

        LOGGER.info("camera=%s connected protocol=RTSP transport=TCP", identifier)
        backoff = 2.0
        try:
            while True:
                ok, frame = capture.read()
                if not ok:
                    LOGGER.warning("camera=%s frame_read_failed reconnecting=true", identifier)
                    break

                pts_ms = pts_milliseconds(capture)
                if pts_ms is None:
                    LOGGER.warning("camera=%s frame_skipped reason=missing_pts", identifier)
                    continue
                if last_pts is not None and pts_ms < last_pts:
                    LOGGER.warning("camera=%s scene_or_pts_reset previous_pts=%.2f current_pts=%.2f", identifier, last_pts, pts_ms)
                    last_processed_pts = None
                last_pts = pts_ms
                if last_processed_pts is not None and pts_ms - last_processed_pts < sample_interval_ms:
                    continue

                payload = {
                    "camera_id": identifier,
                    "frame_base64": encode_frame(frame),
                    "pts_ms": pts_ms,
                    "location": first_value(camera, "location", "name") or identifier,
                    "latitude": first_value(camera, "latitude", "location.latitude"),
                    "longitude": first_value(camera, "longitude", "location.longitude"),
                    "road_id": first_value(camera, "road_id", "roadId"),
                    "intersection_id": first_value(camera, "intersection_id", "intersectionId"),
                    "source": "live_rtsp",
                }
                response = requests.post(f"{ml_url.rstrip('/')}/batch/process-frame", json=payload, timeout=request_timeout)
                response.raise_for_status()
                last_processed_pts = pts_ms
                LOGGER.info("camera=%s inference_complete pts_ms=%.2f", identifier, pts_ms)
        except (requests.RequestException, RuntimeError, cv2.error) as error:
            LOGGER.warning("camera=%s processing_error=%s", identifier, error)
        finally:
            capture.release()

        if once:
            return
        time.sleep(backoff)
        backoff = min(backoff * 2, max_reconnect_seconds)


def main() -> None:
    parser = argparse.ArgumentParser(description="Consume live Sentinel-X RTSP cameras from a catalogue")
    parser.add_argument("--catalogue-url", default=os.getenv("INGEST_CATALOGUE_URL"), required=not os.getenv("INGEST_CATALOGUE_URL"))
    parser.add_argument("--ml-url", default=os.getenv("ML_BACKEND_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--camera-id", action="append", help="Limit processing to one or more catalogue camera ids")
    parser.add_argument("--sample-interval-ms", type=float, default=500.0)
    parser.add_argument("--catalogue-timeout", type=float, default=10.0)
    parser.add_argument("--request-timeout", type=float, default=30.0)
    parser.add_argument("--max-reconnect-seconds", type=float, default=30.0)
    parser.add_argument("--once", action="store_true", help="Attempt one connection per camera and exit")
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cameras = list(load_catalogue(args.catalogue_url, args.catalogue_timeout))
    selected = [camera for camera in cameras if not args.camera_id or camera_id(camera) in set(args.camera_id)]
    LOGGER.info("catalogue_loaded cameras=%d selected=%d", len(cameras), len(selected))
    if args.workers <= 1:
        for camera in selected:
            process_camera(camera, args.ml_url, args.sample_interval_ms, args.request_timeout, args.max_reconnect_seconds, args.once)
        return

    threads = []
    for camera in selected:
        thread = threading.Thread(target=process_camera, args=(camera, args.ml_url, args.sample_interval_ms, args.request_timeout, args.max_reconnect_seconds, args.once), daemon=True)
        thread.start()
        threads.append(thread)
    for thread in threads:
        thread.join()


if __name__ == "__main__":
    main()