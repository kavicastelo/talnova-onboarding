# Architecture from code

`src/` is React/Vite UI calling `/api/v1`; `server/src/app.ts` registers Fastify modules. MongoDB/Mongoose is persistence (`database/connection.ts`). Authentication is JWT plus `requireRole` (`middleware/auth.middleware.ts`).

`server.ts` starts database connection, registers in-memory event subscribers, then `SchedulerService`. `EventBus` holds handlers in a process Map and awaits handlers with `Promise.allSettled`; errors are logged, not propagated. `QueueService` holds queued/completed/failed jobs and idempotency keys in arrays/Sets; it vanishes on restart. Scheduler runs every 60 seconds and queues overdue scans. No deployed broker/worker boundary is represented in code.

Modules own their Mongoose models and direct services: auth/employees, journeys/assignments, tasks/workflows, notifications, HR/manager and peripheral modules. There is no registered onboarding module route/aggregate in `app.ts`; the uncommitted `modules/onboarding` code is a worktree change, not a reachable production API.
