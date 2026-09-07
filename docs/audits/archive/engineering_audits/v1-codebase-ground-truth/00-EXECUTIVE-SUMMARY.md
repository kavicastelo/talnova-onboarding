# Ground-truth audit V1

## Evidence result

**IMPLEMENTED:** Fastify/Mongoose onboarding-LMS APIs, manual/bulk journey assignment, learner lesson progression, task state changes, event subscribers, workflow rules, HR lifecycle controls, and auxiliary document/milestone/buddy/calendar modules.

**VERIFIED:** only 45 pure validation/localization tests executed in this audit. The database-dependent API/workflow/onboarding suites were skipped after Mongo connection attempts; therefore no end-to-end onboarding behaviour is verified. `server/npm test` output is the runtime evidence.

**ACTUAL primary path:** invite → User document (`employment.status=invited`) → invitation acceptance → User status active. No journey, task, workflow, document, milestone, buddy or meeting follows from that call path. `employee.service.ts`, auth invitation endpoint, `event-subscribers.ts`.

**P0:** no `USER_CREATED` publisher; no aggregate onboarding state; event/queue execution is process-local; multiple direct assignment creators. The uncommitted onboarding/outbox code currently in the worktree is not reachable from user creation and is not treated as verified.

V1 appears to be an LMS/assignment core. V2 added automation and operations modules around it, but did not establish a consistent runtime orchestration path.
