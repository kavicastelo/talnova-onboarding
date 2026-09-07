# Repository map — evidence-led

## FACT

This is a TypeScript React/Vite SPA plus a TypeScript Fastify/Mongoose API. There is no separate deployed worker, queue broker, relational migration directory, or LMS/KPI service. `package.json`, `server/package.json`, `server/src/app.ts`, and `server/src/server.ts` establish this.

| Area | Purpose and evidence |
|---|---|
| `src/` | Browser UI, API clients, hooks and feature pages. `src/App.tsx` routes operational, journey, workflow, HR and task screens. |
| `server/src/modules/*` | Feature modules with Fastify routes/controllers, service logic, Mongoose models, and selected repositories. `server/src/app.ts` registers their HTTP routes. |
| `server/src/modules/auth`, `organizations`, `employees` | Tenant/user identity and employment records; the employee entity is the only apparent onboarding subject. |
| `journeys`, `assignments` | Curriculum template and per-employee learning-progression record. This is the implemented LMS core. |
| `workflows` | Persisted rule definitions and execution-log records; `workflow.engine.ts` evaluates and performs actions synchronously. |
| `tasks`, `documents`, `milestones`, `buddy`, `calendar` | Independent operational onboarding artefacts. |
| `infrastructure/events` | Singleton in-process pub/sub. `event-bus.ts` has no persistence/outbox/broker. |
| `infrastructure/queue`, `scheduler` | In-memory queue and 60-second interval scans for overdue assignment/task alerts. |
| `server/src/tests` | Vitest endpoint/module tests arranged by delivery phase. |
| `docs/product` | Requirements evidence only; `docs/LEGACY(UNTRUSTED)` is historical evidence. |
| `scripts/seed_db.cjs`, `.env*`, `scripts/ecosystem.config.cjs` | seed/config/process deployment support. |

## FACT — runtime topology

`server.ts` connects MongoDB, calls `registerEventSubscribers()`, starts the local scheduler, then listens. `app.ts` exposes all APIs beneath `/api/v1`. MongoDB/Mongoose models are the persistence layer. Event handlers execute in the originating Node process; restarting loses subscriptions only re-register at boot and loses queued work/history.

## UNKNOWN

No database migrations were found. MongoDB collection evolution and environment/deployment configuration cannot establish historic production schema state or whether a durable external scheduler exists outside this repository.
