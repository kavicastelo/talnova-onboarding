# Pair Physical Kiosk Display Terminal with 6-Digit Device Code

## Journey ID
UJ-KSK-001

## Primary Role
HR Administrator / IT Terminal Operator (`admin`, `owner`)

## Business Goal
Securely connect a physical touch display terminal (factory floor, warehouse lobby, retail branch) to the enterprise tenant by generating a time-limited 6-digit numeric pairing code in the admin dashboard and entering it on the physical terminal.

## Preconditions
1. Admin is authenticated with `manage_organization` capability.
2. Unpaired physical kiosk terminal display is powered on showing device ID.

## Trigger
Admin navigates to `/kiosks` and clicks "Generate Device Pairing Code".

## Expected Outcome
1. Admin enters terminal hardware GUID/identifier and requests code.
2. Backend generates a 6-digit cryptographic pairing code valid for 15 minutes.
3. Terminal displays input or submits code via `POST /api/v1/kiosk/devices/pair`.
4. Terminal receives a persistent device JWT token (`role: "kiosk_device"`).
5. Terminal status on admin dashboard changes from "Unpaired" to "Online".

## Journey Steps
1. Admin navigates to `/kiosks` (`src/pages/KioskDashboard.tsx`).
2. Admin clicks "Pair New Terminal".
3. Inputs Hardware GUID: `KIOSK-BLDG-B-01`.
4. Client calls `POST /api/v1/kiosk/devices/pair/code`.
5. Backend returns 6-digit pairing code (e.g. `842915`).
6. Terminal operator inputs code on the physical touch terminal.
7. Terminal software dispatches `POST /api/v1/kiosk/devices/pair` with `{ code: "842915", deviceId: "KIOSK-BLDG-B-01", name: "Plant Floor Kiosk", location: "Warehouse A" }`.
8. Backend verifies code, stores device record, returns `{ deviceToken }`.
9. Terminal saves token and transitions to Active Player view.

## Alternative Paths
- Code expires after 15 minutes; admin generates a new code.

## Validation Rules
- Code must be exactly 6 numeric digits.
- Code can only be used once.

## Permissions
Admin for code generation; Public for physical device pairing.

## APIs / Backend Dependencies
- `POST /api/v1/kiosk/devices/pair/code`
- `POST /api/v1/kiosk/devices/pair` (`server/src/modules/kiosk/routes/kiosk.routes.ts`)

## Data Dependencies
- `KioskDevice` in `kioskdevices` collection.

## Notifications / Integrations
None.

## Failure Scenarios
- Invalid or expired pairing code: HTTP 400 (`INVALID_PAIRING_CODE`).

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/KioskDashboard.tsx`
- `server/src/modules/kiosk/controllers/kiosk.controller.ts`
- Tests in `server/src/tests/phase14-kiosk.test.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase14-kiosk.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-KSK-001.md`
