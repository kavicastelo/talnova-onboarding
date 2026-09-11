# Journey Audit — Kiosk Device Heartbeat & Analytics Sync

## Journey ID
UJ-KSK-004

## Date
September 2026

## Primary Role
Kiosk Device Terminal / System (`kiosk_device`)

## Intended Behavior
Verify that a paired physical kiosk terminal periodically transmits background telemetry heartbeats and bulk-synchronizes buffered offline analytics events to the server gateway:
1. Terminal transmits background telemetry heartbeat:
   ```bash
   curl -X POST http://localhost:8080/api/v1/kiosk/devices/heartbeat \
     -H "Authorization: Bearer $DEVICE_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"batteryLevel":88,"appVersion":"1.4.2"}'
   ```
2. Assert response is `HTTP 200 OK` with `{ status: "ok" }`.
3. Terminal uploads buffered offline analytics events:
   ```bash
   curl -X POST http://localhost:8080/api/v1/kiosk/analytics/sync \
     -H "Authorization: Bearer $DEVICE_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "events": [
         { "journeyId": "kiosk-jrn-01", "stepId": "step-01", "eventType": "STEP_VIEWED", "durationSeconds": 30 },
         { "journeyId": "kiosk-jrn-01", "stepId": "step-01", "eventType": "PPE_COMPLETED" }
       ]
     }'
   ```
4. Assert response is `HTTP 200 OK` with `{ syncedCount: 2 }`.
5. Check Admin `/kiosks` dashboard: Terminal status displays green "Online / Paired" status with active telemetry (88% battery, app version 1.4.2) and Usage Analytics charts reflect synced completion events.
6. Alternative Paths: If device token is missing, request is rejected with `HTTP 401 Unauthorized`.
7. Negative Tests: Send malformed event structure (e.g. missing `eventType`): Schema rejects with `HTTP 400 Bad Request` or `HTTP 422 Unprocessable Entity`.
8. Authorization Tests: Expired device token rejected with `HTTP 401 Unauthorized`; standard employee token rejected with `HTTP 403 Forbidden`.
9. Data Integrity Checks: MongoDB `KioskDevice.lastHeartbeatAt` reflects current timestamp; `kioskanalytics` collection contains 2 new records with aggregated metrics.
10. Integration Checks: Analytics summary in Admin dashboard reflects updated completion counts.

---

## Actual Behavior

1. **Terminal Heartbeat Transmission (`POST /api/v1/kiosk/devices/heartbeat`)**:
   - The paired physical terminal software dispatches its periodic telemetry ping using its persistent device bearer JWT:
     ```json
     {
       "batteryLevel": 88,
       "appVersion": "1.4.2"
     }
     ```
   - The gateway plugin `kioskAuthPlugin.verifyDeviceToken` validates the cryptographic signature and extracts `{ deviceId, organizationId, role: "kiosk_device" }`.
   - The server controller normalizes the battery percentage (`88%` -> `0.88`), updates the device's `status` to `"online"`, updates `lastSeen` and `lastHeartbeatAt` to the current timestamp (`new Date()`), and merges telemetry into MongoDB collection `kioskdevices`.
   - The endpoint returns `HTTP 200 OK`:
     ```json
     {
       "success": true,
       "status": "ok",
       "message": "Heartbeat logged successfully",
       "data": {
         "_id": "6aa44da20f6f63e0e16300db",
         "organizationId": "6a42e795916da0cac4bb1853",
         "deviceId": "TEST-KIOSK-001",
         "hardwareGuid": "TEST-KIOSK-001",
         "name": "Assembly Floor Terminal",
         "location": "Building 3",
         "status": "online",
         "paired": true,
         "lastSeen": "2026-09-11T18:51:14.407Z",
         "lastHeartbeatAt": "2026-09-11T18:51:14.407Z",
         "currentContentVersion": 0,
         "telemetry": {
           "batteryLevel": 0.88,
           "appVersion": "1.4.2"
         }
       }
     }
     ```

2. **Buffered Analytics Event Bulk Synchronization (`POST /api/v1/kiosk/analytics/sync`)**:
   - The terminal uploads offline buffered session events:
     ```json
     {
       "events": [
         {
           "journeyId": "kiosk-jrn-01",
           "stepId": "step-01",
           "eventType": "STEP_VIEWED",
           "durationSeconds": 30
         },
         {
           "journeyId": "kiosk-jrn-01",
           "stepId": "step-01",
           "eventType": "PPE_COMPLETED"
         }
       ]
     }
     ```
   - The endpoint validates the event schema via `KioskAnalyticsBulkSyncSchema`, verifying that `eventType` is present on every item.
   - `KioskService.syncAnalytics` resolves the journey reference by `journeyCode` (`"kiosk-jrn-01"`) or `_id`, maps the physical terminal `deviceId` to the internal device ObjectId, normalizes metrics (`launchesCount: 1`, `completedCount: 1` for completions, `durationSeconds`), and performs bulk persistence in `kioskanalytics`.
   - The endpoint responds with `HTTP 200 OK` and `{ syncedCount: 2 }`:
     ```json
     {
       "success": true,
       "message": "Analytics synced successfully",
       "syncedCount": 2,
       "data": {
         "syncedCount": 2,
         "items": [
           {
             "organizationId": "6a42e795916da0cac4bb1853",
             "deviceId": "6aa44da20f6f63e0e16300db",
             "journeyId": "6aa2ff010000000000000001",
             "journeyVersion": 1,
             "languageUsed": "en",
             "stepId": "step-01",
             "eventType": "STEP_VIEWED",
             "metrics": {
               "launchesCount": 1,
               "completedCount": 0,
               "durationSeconds": 30
             },
             "dateKey": "2026-09-11"
           },
           {
             "organizationId": "6a42e795916da0cac4bb1853",
             "deviceId": "6aa44da20f6f63e0e16300db",
             "journeyId": "6aa2ff010000000000000001",
             "journeyVersion": 1,
             "languageUsed": "en",
             "stepId": "step-01",
             "eventType": "PPE_COMPLETED",
             "metrics": {
               "launchesCount": 1,
               "completedCount": 1,
               "durationSeconds": 0
             },
             "dateKey": "2026-09-11"
           }
         ]
       }
     }
     ```

3. **Admin Dashboard Verification (`/kiosks`)**:
   - In the Admin Dashboard (`http://localhost:5173/kiosks`), under the **Physical Terminals** tab:
     - The terminal card renders `Assembly Floor Terminal` with a green indicator pill badge displaying `Online / Paired`.
     - Telemetry displays Battery: `88%` with green status and App Version: `1.4.2`.
     - Top KPI cards display `1 Online Terminals`, `0 Offline Terminals`, and `1 Total Paired Hardware`.
   - Under the **Usage Analytics** tab:
     - Overview KPI cards reflect ingested metrics: `9 Total Launches`, `5 Completions`, `79s Average Session Time`.
     - The daily interactive engagement bar chart updates with fresh completion metrics.

4. **Alternative Path (Missing Device Token)**:
   - When calling `POST /api/v1/kiosk/devices/heartbeat` or `POST /api/v1/kiosk/analytics/sync` without an `Authorization` header, the request is intercepted immediately by the auth middleware and rejected with `HTTP 401 Unauthorized` (`{"code": "UNAUTHORIZED", "message": "Authentication required"}`).

5. **Negative Test (Malformed Event Structure)**:
   - Sending an analytics sync payload with an event missing required `eventType`:
     ```json
     {
       "events": [
         {
           "journeyId": "kiosk-jrn-01",
           "stepId": "step-01"
         }
       ]
     }
     ```
   - Fastify Zod schema validation intercepts the request and rejects with `HTTP 422 Unprocessable Entity` (code: `FST_ERR_VALIDATION`), specifying that `eventType` is required.

6. **Authorization Enforcement**:
   - Expired device token: When transmitting a heartbeat with an expired JWT (`exp < now`), the device token verification plugin rejects the request with `HTTP 401 Unauthorized` (`Invalid or expired device connection key.`).
   - Role mismatch: When transmitting a heartbeat with a standard employee user JWT token (`role: "employee"` instead of `"kiosk_device"`), the endpoint rejects the request with `HTTP 403 Forbidden` (`Unauthorized. Device token signature required.`).

7. **Data Integrity Checks**:
   - Verified MongoDB `KioskDevice.lastHeartbeatAt` reflects the recent timestamp: `2026-09-11T18:51:14.407Z`.
   - Verified MongoDB `kioskanalytics` collection contains the ingested documents with correct `journeyId`, `deviceId`, and event types (`STEP_VIEWED`, `PPE_COMPLETED`).

8. **Integration Checks**:
   - Calling `GET /api/v1/kiosk/journeys/:id/analytics` returns aggregated telemetry showing completions and launch counts incremented by the synced events.

---

## Implementation Status
`FULLY_IMPLEMENTED`

## Final Verdict
`PASS`

---

## What Is Implemented

- **Backend Kiosk Module (`server/src/modules/kiosk/`)**:
  - `IKioskDevice` & `KioskDeviceSchema`: Added `lastHeartbeatAt: Date` property with default `Date.now`.
  - `KioskDeviceRepository`: Updated `heartbeat` method to update `lastHeartbeatAt: new Date()` alongside `status: "online"` and `lastSeen: new Date()`.
  - `KioskDeviceHeartbeatSchema`: Enhanced to accept top-level telemetry parameters (`batteryLevel`, `appVersion`) and enabled `.passthrough()`.
  - `KioskAnalyticsBulkSyncSchema` & `KioskAnalyticsEventItemSchema`: Enforced strict `eventType: z.string().min(1)` requirement and support for `events` array synchronization.
  - `KioskService.syncAnalytics`: Implemented dual resolution of journeys (by `_id` or `journeyCode`), hardware GUID mapping, and metric normalizations (`launchesCount`, `completedCount`, `durationSeconds`).
  - `KioskController`: Standardized response formatting to return `{ success: true, status: "ok", data: ... }` for heartbeat and `{ success: true, syncedCount, data: ... }` for analytics sync.

- **Frontend Kiosk Management (`src/pages/KioskDashboard.tsx`)**:
  - Displays real-time device telemetry including battery percentage bar and app version pill.
  - Visual status dot and badge for `Online / Paired` based on active telemetry timestamps.
  - Usage Analytics tab renders aggregated launch and completion metrics with charts.

---

## Test Execution Summary

### 1. Automated Vitest Suite (`server/src/tests/uj-ksk-004.test.ts`)
Run command: `npx vitest run src/tests/uj-ksk-004.test.ts`
All 8 tests passed (100% success rate):
- `✓ Step 1-2: Terminal transmits telemetry heartbeat ping (POST /api/v1/kiosk/devices/heartbeat)` (356ms)
- `✓ Step 3-4: Terminal uploads buffered analytics events (POST /api/v1/kiosk/analytics/sync)` (312ms)
- `✓ Step 5 & Data Integrity: MongoDB kioskanalytics collection contains 2 new records` (11ms)
- `✓ Alternative Path: Missing device token is rejected with HTTP 401 Unauthorized` (4ms)
- `✓ Negative Test: Send malformed event structure (missing eventType) rejects with HTTP 400/422` (4ms)
- `✓ Authorization Test: Expired device token rejected with HTTP 401 Unauthorized` (9ms)
- `✓ Authorization Test: Standard employee token rejected on heartbeat endpoint with HTTP 403 Forbidden` (3ms)
- `✓ Integration Checks: Analytics summary reflects updated completion counts` (298ms)

### 2. Live API Execution & MongoDB Atlas Persistence
- Live script `server/src/tests/run_live_sync.ts` executed against live backend on port 8080:
  - Heartbeat status: `HTTP 200 OK` (`{"status":"ok"}`).
  - Analytics sync status: `HTTP 200 OK` (`{"syncedCount":2}`).
  - MongoDB `kioskdevices.lastHeartbeatAt` updated to `2026-09-11T18:51:14.407Z`.
  - Telemetry persisted: `{ batteryLevel: 0.88, appVersion: "1.4.2" }`.
  - MongoDB `kioskanalytics` collection confirmed storing events.

### 3. Live Browser Subagent Verification
- Subagent: `kiosk_heartbeat_sync` (Session recording: `kiosk_heartbeat_sync_1789152437709.webp`).
- Verified:
  1. Navigated to `/kiosks` on `http://localhost:5173`.
  2. Under the "Physical Terminals" tab, `Assembly Floor Terminal` showed `Online / Paired` green badge, Battery `88%`, and App `1.4.2`.
  3. Captured screenshot: `kiosk_terminal_heartbeat_telemetry_1789152489507.png`.
  4. Switched to "Usage Analytics" tab, verifying KPI metrics cards and interactive engagement chart.
  5. Captured screenshot: `kiosk_analytics_synced_view_1789152519733.png`.

---

## Evidence Artifacts

### 1. Terminal Online Status with 88% Battery and Version 1.4.2
![Kiosk Terminal Telemetry](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/kiosk_terminal_heartbeat_telemetry_1789152489507.png)

### 2. Synced Kiosk Analytics Ingestion View
![Kiosk Synced Analytics View](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/kiosk_analytics_synced_view_1789152519733.png)

### 3. Interactive Browser Session Recording
- Heartbeat & Analytics Sync Dashboard: [kiosk_heartbeat_sync.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/kiosk_heartbeat_sync_1789152437709.webp)

---

## Conclusion
The kiosk device heartbeat telemetry transmission and bulk analytics synchronization flow operates reliably with end-to-end data integrity across physical device endpoints, MongoDB storage, and the admin management portal. All happy path, negative validation, authorization guard, and integration checks pass completely.
