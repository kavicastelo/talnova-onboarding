# Offline Learning Progress Sync via PWA

## Journey ID
UJ-ONB-009

## Primary Role
Employee / Mobile PWA Worker

## Business Goal
Allow remote or frontline workers with intermittent connectivity to consume cached learning content, record lesson progress offline in IndexedDB, and synchronize progress to the cloud gateway upon network restoration.

## Preconditions
1. Employee is using PWA mode on mobile or tablet.
2. Content service worker has cached course resources.

## Trigger
Device goes offline (`navigator.onLine == false`) while employee is consuming a lesson, completes the lesson, and reconnects to the network.

## Expected Outcome
1. Service worker intercepts lesson completion request and buffers payload in client-side storage (IndexedDB).
2. Upon `online` event, PWA sync service replays queued progress mutations via `POST /api/v1/assignments/:id/progress`.
3. Backend reconciles timestamps, marks lessons complete, and confirms sync status.

## Journey Steps
1. Worker opens mobile PWA and accesses cached course module.
2. Network connection drops.
3. Worker finishes viewing lesson.
4. Client logs completion record in offline queue.
5. Network connectivity is restored.
6. PWA background sync sends `POST /api/v1/assignments/:id/progress` with array of completed lesson IDs and timestamps.
7. Backend validates user token, merges progress without overwriting upstream data, and returns HTTP 200.

## Alternative Paths
- If offline token expires before reconnection, client flags authentication refresh required on reconnect.

## Validation Rules
- Offline sync cannot forge completion of compliance documents or unverified quizzes.

## Permissions
Assigned employee.

## APIs / Backend Dependencies
- `POST /api/v1/assignments/:assignmentId/progress` (`server/src/modules/assignments/routes/assignment.routes.ts`)
- `POST /api/v1/notifications/push-subscription` (`server/src/modules/notifications/routes/notification.routes.ts`)

## Data Dependencies
- Client IndexedDB queue, `Assignment` record.

## Notifications / Integrations
- Web Push Notifications via VAPID keys.

## Failure Scenarios
- Conflict resolution when concurrent online updates occurred.

## Current Implementation

### Status
`PARTIALLY_IMPLEMENTED`

### Evidence
- Frontend: `src/serviceWorkerRegistration.ts`, `src/services/pwa.service.ts`
- Backend: `server/src/tests/phase18-mobile-pwa.test.ts`

### Missing Pieces
- Client-side automatic background sync registration is limited by mobile browser permissions; offline push subscription registration is implemented, but robust conflict reconciliation on complex quiz retries is simplified.

### Known Issues
- Safari iOS limits background sync API availability compared to Chromium PWA.

## Test Coverage
Automated in `server/src/tests/phase18-mobile-pwa.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ONB-009.md`
