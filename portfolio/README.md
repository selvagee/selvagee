# Engineering portfolio — public demonstration roadmap

These are **independently implemented demonstrations**, not copies of employer or customer software. The projects below are planned and **not yet published as runnable repositories**.

| Demonstration | Engineering focus | Planned proof |
| --- | --- | --- |
| [Go RTSP Worker](go-rtsp-worker.md) | RTSP stream lifecycle, retries, segmented recording | CLI, integration tests with a synthetic RTSP source |
| [Node.js Event Receiver](node-event-receiver.md) | Ingestion, ACK-first handling, queues, idempotency | Local RabbitMQ/Redis/MySQL Docker Compose |
| [Python Operations Assistant](python-operations-assistant.md) | Tool calling, local Ollama, read-only operational Q&A | FastAPI, mock site data, testable tool contracts |

## Safety and provenance

- No customer IP addresses, credentials, production logs, proprietary code, or actual customer records.
- Use synthetic camera streams and fictitious device/site IDs.
- Mark all benchmarks as unverified until independently reproduced.
- AI agent actions should be read-only by default, with authorization and audit logging.

## Delivery checklist

- [ ] Separate public repositories created
- [ ] Runnable implementation and tests
- [ ] CI workflows passing
- [ ] Architecture diagram and threat model
- [ ] Reproducible local setup
- [ ] Screenshots and measured benchmarks
- [ ] Link completed demos from the profile README
