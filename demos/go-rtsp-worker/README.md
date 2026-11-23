# Go RTSP Worker — independent public demo

A small, standard-library-only Go worker manager that runs FFmpeg for RTSP streams, records time-based MP4 segments, retries failed processes with bounded backoff, and exposes health/metrics endpoints.

**Status:** runnable code and unit tests; not yet tested against a real or synthetic RTSP server in this environment. This is an educational demonstration, not production-ready surveillance software.

## Requirements
- Go 1.22+
- FFmpeg installed and in PATH
- An **authorized, synthetic** RTSP test source (for example, one you host locally)

## Run

```bash
cd demos/go-rtsp-worker
go test ./...
go run ./cmd/rtsp-worker -streams 'rtsp://127.0.0.1:8554/test' -output ./segments -listen 127.0.0.1:9090
curl http://127.0.0.1:9090/healthz
curl http://127.0.0.1:9090/workers
curl http://127.0.0.1:9090/metrics
```

To stop: Ctrl+C. Segment durations depend on source keyframe intervals when using stream copy.

## Architecture

```mermaid
flowchart LR
  S[Authorized synthetic RTSP source] --> M[Go worker manager]
  M --> F[FFmpeg child process]
  F --> O[Local MP4 segments]
  M --> H[Health / metrics HTTP server]
```

## Scope and limitations
- One process per stream; duplicate names rejected.
- Bounded exponential retry with jitter; retry counter and state snapshots.
- Graceful shutdown via Go context and FFmpeg child-process cancellation.
- HTTP binds to loopback by default; no authentication on metrics endpoints.
- Stream URLs may include credentials; **do not commit them or expose process arguments on shared hosts**.
- No frame extraction, dynamic stream configuration, retention policy, distributed orchestration, or production benchmarking yet.
- Do not use customer cameras, production IP addresses, or proprietary code in this demo.

## License
MIT; see LICENSE.

## Milestone 4: synthetic RTSP integration test (manual)

The repository now includes a Docker Compose RTSP server and an integration-test script. The script generates a synthetic test-pattern stream with FFmpeg, publishes it over RTSP, runs the Go worker, checks for recorded MP4 segments using ffprobe, and queries the metrics endpoint.

Prerequisites: Docker Compose, Go, FFmpeg (with libx264), ffprobe, curl and Bash. Ensure ports **8554** and **19090** are free.

```bash
cd demos/go-rtsp-worker
bash scripts/integration-test.sh
```

**Verification status:** This end-to-end script has been added but has **not yet been executed in the connected GitHub environment**. Its success depends on local Docker/FFmpeg setup. GitHub Actions runs Go unit tests, race detection, static analysis and build; it does not currently run the Docker integration test.

### Observability limits

`/metrics` exposes a simple active-worker gauge and cumulative retry counter. The gauge reflects the worker's requested process state, not an independently verified video signal. Future work should add last-frame timestamps, segment-write checks, per-camera status and Prometheus labels with bounded cardinality.
