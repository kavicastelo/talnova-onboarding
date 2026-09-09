# Kiosk Device Heartbeat & Offline Analytics Bulk Sync

## Journey ID
UJ-KSK-004

## Primary Role
Kiosk Device Terminal / System (`kiosk_device`)

## Business Goal
Maintain terminal health telemetry via periodic background heartbeats, report hardware battery and online status, and batch-upload queued offline worker engagement analytics to the server gateway.

## Preconditions
1. Terminal paired with valid `deviceToken`.
2. Telemetry events buffered locally during offline or continuous operation.

## Trigger
Automated background timer fires on physical terminal (every 60 seconds).

## Expected Outcome
1. Terminal sends heartbeat ping with battery level, app version, and IP.
2. Server updates `KioskDevice.lastHeartbeatAt` and marks device online.
3. Terminal uploads array of buffered analytics events via `POST /api/v1/kiosk/analytics/sync`.
4. Server ingests events in bulk, updates journey completion metrics, and returns HTTP 200.

## Journey Steps
1. Terminal timer triggers heartbeat service.
2. Terminal calls `POST /api/v1/kiosk/devices/heartbeat` with Bearer device token and `{ batteryLevel: 94, appVersion: "1.4.2" }`.
3. Backend `verifyDeviceToken` validates token, updates `KioskDevice` record.
4. Terminal checks local analytics queue. If events exist, dispatches `POST /api/v1/kiosk/analytics/sync` with batch payload `[{ eventType: "STEP_VIEWED", durationSeconds: 45 }, { eventType: "PPE_COMPLETED" }]`.
5. Backend parses events, stores them in `kioskanalytics`, and acknowledges receipt.
6. Terminal purges synchronized events from local queue.

## Alternative Paths
- If network connection is unavailable, terminal retries on next cycle without data loss.

## Validation Rules
- Device token must belong to a paired, non-revoked device.

## Permissions
`verifyDeviceToken` (`role: "kiosk_device"`).

## APIs / Backend Dependencies
- `POST /api/v1/kiosk/devices/heartbeat`
- `POST /api/v1/kiosk/analytics/sync` (`server/src/modules/kiosk/routes/kiosk.routes.ts`)

## Data Dependencies
- `KioskDevice`, `KioskAnalytics`.

## Notifications / Integrations
- Alerts admin if device goes offline for > 15 minutes.

## Failure Scenarios
- Revoked device token: Terminal displays "Device unlinked" message and resets.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `server/src/modules/kiosk/plugins/kiosk-auth.plugin.ts`
- `server/src/modules/kiosk/services/kiosk.service.ts`
- Tests in `server/src/tests/phase14-kiosk.test.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase14-kiosk.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-KSK-004.md`
