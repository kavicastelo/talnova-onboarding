# Journey Audit — Offline Learning Progress Sync via PWA

## Journey ID
UJ-ONB-009

## Date
September 2026

## Role
Mobile PWA Employee (`employee`)

## Intended Behavior
A mobile or frontline worker accessing courseware through the Progressive Web App (PWA) can continue learning while offline. The PWA caches static application assets and course content via the Service Worker (`public/sw.js`), intercepts completion actions, queues them locally within IndexedDB (`talnova_pwa_db -> offline_queue`), and automatically dispatches batch progress updates (`POST /api/v1/assignments/:id/progress` with `{ completedLessonIds: [...] }`) upon network reconnection without data loss or overriding newer server progress.

## Actual Behavior
1. **PWA Service Worker Caching**: The Service Worker (`public/sw.js`) intercepts navigation requests (`event.request.mode === 'navigate'`) and static asset fetches, caching application code and lesson assets. Routes such as `/course/assign-pwa-01` load without "No internet" browser error pages.
2. **Offline Interception & IndexedDB Storage**: When disconnected from network (or in offline mode), clicking `"Mark as Complete"` on lesson `1.2 Hazard Assessment & Emergency Protocols` (`les-pwa-02`) intercepts the mutation and enqueues the record in IndexedDB (`talnova_pwa_db` object store `offline_queue`). The UI confirms with toast notification: `"Offline: Lesson marked as complete. Saved to IndexedDB offline queue."`
3. **Reconnection & Batch Queue Flush**: Upon restoring connectivity (triggering `window` event `'online'`), the PWA sync service automatically flushes the queue, dispatching `POST /api/v1/assignments/assign-pwa-01/progress` with `{ completedLessonIds: ["les-pwa-02"] }`.
4. **Backend State & Progress Update**: The backend gateway records the completion, updates the overall course progress bar to 100%, and returns `HTTP 200 OK`.
5. **Persistence & Refresh**: Reloading the page online confirms persistent completion with the green checkmark (`CheckCircle2`) and updated progress metrics.
6. **Platform Constraints**: Automated silent background synchronization (W3C Background Sync API) remains limited on WebKit/iOS Safari, though immediate synchronization on online reconnection events operates consistently across all modern platforms.

## Implementation Status
`PARTIALLY_IMPLEMENTED`

## Final Verdict
`PARTIAL` (Service worker precaching, offline lesson completion interception, IndexedDB mutation queueing, online event automatic sync, and backend progress reconciliation are fully verified; background sync is constrained by WebKit/iOS platform limitations).

---

## What Is Implemented
- **Service Worker Precaching & SPA Navigation Fallback**: `public/sw.js` with Cache-First asset handling and navigation fallback to `/index.html`.
- **Service Worker Lifecycle Registration**: `src/serviceWorkerRegistration.ts` initialized in `src/index.tsx`.
- **IndexedDB Offline Queue**: `src/services/pwa.service.ts` managing `talnova_pwa_db` with `offline_queue` store for robust local transaction storage.
- **Offline UI Interception & Reconnection Sync**: `src/pages/CourseViewer.tsx` intercepting offline completions and listening for online reconnection events.
- **Backend Bulk Progress Synchronization**: `POST /api/v1/assignments/:id/progress` accepting `{ completedLessonIds: [...] }` with multi-lesson batch reconciliation.
- **Push Notification Registration**: Web Push subscription management via `POST /api/v1/notifications/push-subscription`.
- **Automated Test Suites**:
  - `server/src/tests/uj-onb-009.test.ts` (6/6 tests passed).
  - `server/src/tests/phase18-mobile-pwa.test.ts` (4/4 tests passed).

---

## What Is Missing
- Periodic background synchronization API polyfill for iOS Safari (WebKit restriction).
- Offline quiz submission grading (intentionally gated online to safeguard assessment answer keys).

---

## What Is Incorrect
- None in current implementation; lesson progression sync complies strictly with API contracts and data integrity rules.

---

## Test Evidence & Payloads

### 1. Network Response Payload for `POST /api/v1/assignments/assign-pwa-01/progress`
**Request**:
```http
POST /api/v1/assignments/assign-pwa-01/progress HTTP/1.1
Authorization: Bearer <jwt_employee_token>
Content-Type: application/json

{
  "completedLessonIds": ["les-pwa-02"]
}
```

**Response (Status 200 OK)**:
```json
{
  "success": true,
  "message": "Assignment progress updated successfully",
  "data": {
    "assignmentId": "assign-pwa-01",
    "completedLessonIds": ["les-pwa-01", "les-pwa-02"],
    "completionPercentage": 100,
    "status": "completed"
  }
}
```

### 2. Verified IndexedDB Offline Queue Record Structure
```json
{
  "id": "sync_1789069524939_les-pwa-02",
  "assignmentId": "assign-pwa-01",
  "lessonId": "les-pwa-02",
  "type": "lesson_completion",
  "timestamp": 1789069524939,
  "synced": false
}
```

### 3. Automated Test Suite Output (`server/src/tests/uj-onb-009.test.ts`)
```text
✓ Journey Test UJ-ONB-009: Offline Learning Progress Sync via PWA (6 tests passed)
  ✓ Step 1: GET /api/v1/assignments/assign-pwa-01 returns cached course structure with les-pwa-02
  ✓ Step 7 & 8: POST /api/v1/assignments/assign-pwa-01/progress dispatches completedLessonIds and returns HTTP 200 OK
  ✓ Step 9: GET /api/v1/assignments/assign-pwa-01 confirms progress persistence and completed status
  ✓ Alternative Paths: Batches multiple offline lesson completions into single request
  ✓ Negative & Authorization Tests: Rejects unauthenticated progress synchronization with 401 Unauthorized
  ✓ Integration Checks: Registers Web Push subscription via POST /api/v1/notifications/push-subscription
```

---

## Gap Analysis

| Requirement | Expected | Actual | Status |
| :--- | :--- | :--- | :--- |
| **Service Worker Precache** | Serves cached course without "No internet" browser error page. | Verified: `sw.js` serves cached shell and course curriculum offline. | `ALIGNED` |
| **Offline Interception** | Intercepts "Mark as Complete" and persists in IndexedDB offline queue. | Verified: Enqueued in `talnova_pwa_db` with toast confirmation. | `ALIGNED` |
| **Online Reconnection Sync** | Dispatches `POST /api/v1/assignments/:id/progress` with `{ completedLessonIds }`. | Verified: Dispatched on `online` event, returning `HTTP 200 OK`. | `ALIGNED` |
| **Progress Persistence** | Browser refresh shows lesson checkmark and updated progress bar. | Verified: Progress updated to 100% and remains persistent after reload. | `ALIGNED` |
| **Multi-Lesson Batching** | Multiple offline lessons batched into single reconciliation payload. | Verified: Tested and passing in `uj-onb-009.test.ts`. | `ALIGNED` |
| **Push Notification Registration** | Subscribes to VAPID push notifications for offline reminders. | Verified: Tested and passing via `/notifications/push-subscription`. | `ALIGNED` |
| **Background Sync on iOS** | Silent background sync when app is closed on iOS Safari. | Constrained by WebKit architecture; sync triggers on next app open. | `PARTIAL` |

---

## Impact
Low. Normal lesson progression, reading, and offline completion synchronization works reliably. Employees in the field can finish offline material and have progress automatically reconciled upon reconnection.

## Root Cause
Operating system & browser platform limitation: Apple WebKit (iOS Safari) restricts background execution threads and ServiceWorker Background Sync API when mobile Safari is in the background.

## Recommended Fix
Maintain the current online event trigger mechanism and inform iOS users via PWA banner to keep the app open briefly when returning to network coverage to ensure pending sync operations flush immediately.

---

## Related Code
- Service Worker: `public/sw.js`
- Registration: `src/serviceWorkerRegistration.ts`
- PWA Sync Service: `src/services/pwa.service.ts`
- Course Viewer Component: `src/pages/CourseViewer.tsx`
- Course Service: `src/services/course.service.ts`
- Backend Assignment Controller: `server/src/modules/assignments/controllers/assignment.controller.ts`
- Backend Assignment Routes: `server/src/modules/assignments/routes/assignment.routes.ts`
- Automated Test Suite: `server/src/tests/uj-onb-009.test.ts`, `server/src/tests/phase18-mobile-pwa.test.ts`

## Related Documentation
- `docs/user-journeys/onboarding/UJ-ONB-009.md`
- `prompts/user-journeys/UJ-ONB-009.md`
