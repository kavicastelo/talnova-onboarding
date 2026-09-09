# Journey Audit — Offline Learning Progress Sync via PWA

## Journey ID
UJ-ONB-009

## Date
September 2026

## Role
Employee / Mobile PWA Worker

## Intended Behavior
A frontline or mobile worker consuming learning courses offline can complete lessons in the Progressive Web App (PWA). The PWA caches resources via a Service Worker, queues progress updates in IndexedDB, and automatically flushes and reconciles lesson completions with the cloud API upon reconnection.

## Actual Behavior
The backend endpoint `POST /api/v1/assignments/:id/progress` and Web Push subscription endpoints (`POST /api/v1/notifications/push-subscription`) are fully implemented, tested, and passing. The frontend includes service worker registration (`src/serviceWorkerRegistration.ts`) and PWA sync hooks. However, automated background synchronization is constrained on iOS Safari, and conflict resolution during offline quiz retries uses client-last-write rather than server-side state machine merging.

## Implementation Status
`PARTIALLY_IMPLEMENTED`

## What Is Implemented
- Backend bulk progress synchronization endpoint: `POST /api/v1/assignments/:assignmentId/progress`.
- Web push subscription management endpoints (`POST` / `DELETE` `/api/v1/notifications/push-subscription`).
- Frontend Service Worker registration in `src/serviceWorkerRegistration.ts`.
- PWA sync utility in `src/services/pwa.service.ts`.
- Automated test suite verifying progress merge and push subscriptions (`server/src/tests/phase18-mobile-pwa.test.ts`).

## What Is Missing
- Robust conflict resolution on multi-device concurrent quiz attempts.
- Background Sync API fallback polyfill for WebKit/iOS environments.

## What Is Incorrect
- None; the implementation functions reliably for lesson tracking, but complex assessment retries are restricted to online sessions.

## Evidence
- File: `server/src/modules/assignments/routes/assignment.routes.ts`
- Route: `POST /api/v1/assignments/:assignmentId/progress`
- Service: `server/src/modules/assignments/services/assignment.service.ts`
- Test: `server/src/tests/phase18-mobile-pwa.test.ts` (4 passed)
- Frontend: `src/serviceWorkerRegistration.ts`, `src/services/pwa.service.ts`

## Gap Analysis

| Requirement | Expected | Actual | Status |
| :--- | :--- | :--- | :--- |
| **PWA Service Worker** | Pre-caches core course lessons and static assets. | Implemented via `src/serviceWorkerRegistration.ts`. | `ALIGNED` |
| **Offline Lesson Sync** | Batches completed lessons and syncs upon reconnection. | Fully implemented via `POST /assignments/:id/progress`. | `ALIGNED` |
| **Push Subscriptions** | Subscribes to VAPID push notifications for offline alerts. | Fully implemented and tested in `phase18-mobile-pwa.test.ts`. | `ALIGNED` |
| **Offline Quiz Attempt** | Permits taking and grading multi-question quizzes offline. | Gated: Quizzes require online scoring to prevent key exposure. | `INTENTIONAL_GAP` |

## Impact
Low. Normal lesson viewing and progress syncing works offline; quizzes intentionally require online verification to safeguard assessment keys.

## Root Cause
Browser platform limitations (WebKit Background Sync) and security requirement to prevent distributing unhashed quiz answer keys into client offline caches.

## Recommended Fix
Document the intentional online requirement for quiz scoring in user documentation and add visual offline indicator badges on quiz steps.

## Verification Plan
1. Run `vitest run src/tests/phase18-mobile-pwa.test.ts` to confirm backend sync and push endpoints pass.
2. In browser DevTools Network tab, toggle Offline mode and verify cached lesson rendering.

## Related Code
- `server/src/modules/assignments/services/assignment.service.ts`
- `src/services/pwa.service.ts`

## Related Documentation
- `docs/user-journeys/onboarding/UJ-ONB-009.md`

## Related Test Prompt
`prompts/user-journeys/UJ-ONB-009.md`
