#!/usr/bin/env bash
set -Eeuo pipefail

# Requires Docker Compose, ffmpeg, ffprobe, curl and Go. Uses only a generated test pattern.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
for command in docker ffmpeg ffprobe curl go; do
  command -v "$command" >/dev/null || { echo "Missing: $command" >&2; exit 2; }
done
TMP="$(mktemp -d)"
PUBLISHER=""
WORKER=""
cleanup() {
  [[ -z "$WORKER" ]] || { kill "$WORKER" 2>/dev/null || true; wait "$WORKER" 2>/dev/null || true; }
  [[ -z "$PUBLISHER" ]] || { kill "$PUBLISHER" 2>/dev/null || true; wait "$PUBLISHER" 2>/dev/null || true; }
  docker compose down >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

docker compose up -d
echo "Waiting for synthetic RTSP publisher..."
ffmpeg -nostdin -hide_banner -loglevel error -re -f lavfi -i 'testsrc2=size=320x240:rate=10' \
  -c:v libx264 -preset ultrafast -tune zerolatency -g 10 -pix_fmt yuv420p \
  -f rtsp -rtsp_transport tcp 'rtsp://127.0.0.1:8554/test' >"$TMP/publisher.log" 2>&1 &
PUBLISHER=$!
for i in $(seq 1 30); do
  if ffprobe -v error -rtsp_transport tcp -show_entries stream=codec_name \
     -of default=noprint_wrappers=1 'rtsp://127.0.0.1:8554/test' 2>/dev/null | grep -q h264; then
    break
  fi
  if ! kill -0 "$PUBLISHER" 2>/dev/null; then cat "$TMP/publisher.log"; exit 1; fi
  sleep 1
done

go build -o "$TMP/rtsp-worker" ./cmd/rtsp-worker
"$TMP/rtsp-worker" -streams 'rtsp://127.0.0.1:8554/test' \
  -output "$TMP/segments" -segment-seconds 2 -listen 127.0.0.1:19090 >"$TMP/worker.log" 2>&1 &
WORKER=$!
for i in $(seq 1 40); do
  if ! kill -0 "$WORKER" 2>/dev/null; then cat "$TMP/worker.log"; exit 1; fi
  if curl -fsS 'http://127.0.0.1:19090/healthz' >/dev/null 2>&1 && \
     find "$TMP/segments" -name '*.mp4' -size +100c | grep -q .; then
    break
  fi
  sleep 1
done
# Allow a segment to close, since MP4 metadata is finalized at segment rotation.
sleep 5
FILE="$(find "$TMP/segments" -name '*.mp4' -size +100c | sort | head -n 1)"
[[ -n "$FILE" ]] || { cat "$TMP/worker.log"; echo "No segments created" >&2; exit 1; }
ffprobe -v error -show_entries stream=codec_name -of default=noprint_wrappers=1 "$FILE" | grep -q h264
curl -fsS 'http://127.0.0.1:19090/metrics' | grep -q 'rtsp_workers_active'
echo "PASS: RTSP ingest, segmented MP4, ffprobe codec and metrics"
