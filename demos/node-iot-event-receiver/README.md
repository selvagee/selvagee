# Node.js IoT Event Receiver — synthetic portfolio demonstration

A small event-driven TCP receiver using Node.js, RabbitMQ, MySQL, and Redis. **No customer protocol, credentials, or production data included.**

## Architecture

```mermaid
flowchart LR
  D[Synthetic TCP Device] --> R[Node TCP Receiver]
  R -->|Publisher-confirmed ACK| Q[RabbitMQ durable queue]
  Q --> W[Node Consumer]
  W --> DB[(MySQL idempotent store)]
  W --> C[(Redis last reading)]
  Q --> DLQ[Dead-letter queue]
```

## Start locally

Requires Node.js 20+, npm, Docker Compose and a TCP client such as `nc`.

```bash
cd demos/node-iot-event-receiver
docker compose up -d
npm install
npm test
# Separate terminals:
npm start
npm run worker
# Send synthetic packet (the ACK confirms broker publication, not database storage):
printf '@,device01,event001,26.4,1,#\n' | nc 127.0.0.1 7070
# Inspect MySQL:
docker compose exec mysql mysql -uiot -piot iot -e 'SELECT device_id,event_id,temperature,alarm FROM telemetry;'
```

The demo assumes local Docker services have started; retry `npm start` if RabbitMQ is still initializing.

## Design decisions

- Demo protocol is `@,deviceId,eventId,temperature,alarm,#` with newline-delimited packets. This is **not** a real customer protocol.
- The receiver ACKs **after RabbitMQ publisher confirmation**, not immediately on TCP receipt. This avoids falsely acknowledging events before durable enqueue. A production implementation must choose an explicit device-level acknowledgement contract.
- The MySQL unique `event_hash` provides idempotent storage for repeated `(deviceId,eventId)` events.
- Redis cache updates are best-effort and expire after one hour.
- Invalid packets receive NACK; consumer failures go to a dead-letter queue for manual inspection. A production system should classify transient versus permanent failures and implement delayed retry queues.
- Local ports bind to loopback. Docker credentials are **demo-only** and must not be reused in deployment.

## Known limitations

- Not yet executed end-to-end against Docker in this environment; only protocol unit tests and syntax checks are available.
- No TLS, authentication, schema versioning, message signature, device provisioning, replay protection, monitoring or HA.
- TCP receiver buffers newline-delimited messages and queues operations per connection; not designed for unlimited concurrent devices or slow-broker backpressure.
- Redis cache may lag or be out of order for duplicate events.
- This repository is educational and **not production-ready**.

## V2 milestone (review branch)

V2 adds two **synthetic** protocol adapters, bounded delayed retries, simple Prometheus-compatible counters, a PM2 ecosystem file, CI checks, and a local integration-test script.

### Select an adapter

The default `csv-v1` accepts `@,device01,event001,26.4,1,#`. To accept newline-delimited JSON instead:

```bash
PROTOCOL_ADAPTER=json-v1 npm start
# Send {"version":1,"deviceId":"device01","eventId":"event002","temperature":26.4,"alarm":true}
```

### Retry behavior

On consumer errors, the event is published with a publisher confirmation to `iot.retry`, a durable queue with a **10-second TTL**. Expired messages return to `iot.telemetry`. After three retries, the event goes to `iot.dead.messages` through the dead-letter exchange. This is an educational fixed-delay pattern; production use should distinguish invalid data from transient database outages and monitor poison messages.

### Metrics and PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 status
curl http://127.0.0.1:9091/metrics  # receiver
curl http://127.0.0.1:9092/metrics  # consumer
```

The endpoints bind to loopback and report process-local counters only; they are not readiness probes and reset on restart.

### Local end-to-end smoke test

```bash
bash scripts/integration-test.sh
```

This starts Docker dependencies and both Node services, sends a synthetic packet, checks the publisher ACK and verifies one MySQL row. **It has not been run in the GitHub connector environment.** Ensure ports 7070, 9091, 9092, 5672, 3306 and 6379 are available before running.

### Remaining production gaps

No authentication/TLS, persistent metrics, graceful in-flight message draining, broker reconnection strategy, load tests, device authentication, or hardened resource limits. Demo Docker credentials are intentionally insecure and local-only. Do not publish actual customer device payloads.
