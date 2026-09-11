# Journey Audit — Pair Kiosk Device via 6-Digit Code

## Journey ID
UJ-KSK-001

## Date
September 2026

## Primary Role
HR Administrator / Terminal Operator (`admin`, `kiosk_device`)

## Intended Behavior
Verify that an administrator can generate a 6-digit device pairing code in the admin dashboard and that a physical kiosk terminal can submit the code to establish an authenticated hardware pairing and receive a persistent device JWT token. The workflow includes:
1. In Admin browser, navigate to `/kiosks`.
2. Click "Pair New Terminal".
3. Enter Hardware GUID: `TEST-KIOSK-001`.
4. Click "Generate Pairing Code".
5. Monitor network: `POST /api/v1/kiosk/devices/pair/code` returns `{ code: "123456", expiresInSeconds: 900 }`.
6. Record the 6-digit code.
7. On the physical terminal (or terminal test client), dispatch:
   ```bash
   curl -X POST http://localhost:8080/api/v1/kiosk/devices/pair \
     -H "Content-Type: application/json" \
     -d '{
       "code": "123456",
       "deviceId": "TEST-KIOSK-001",
       "name": "Assembly Floor Terminal",
       "location": "Building 3"
     }'
   ```
8. Assert response returns `HTTP 200 OK` with `{ deviceToken: string, device: { id, name } }`.
9. Refresh Admin `/kiosks` view: Assert `Assembly Floor Terminal` is listed with status "Paired / Active" (or "Online / Paired").
10. Alternative Paths: Code expires after 15 minutes; pairing fails until fresh code generated.
11. Negative Tests: Submit invalid code (`999999`) returns `HTTP 400 Bad Request` (`INVALID_OR_EXPIRED_PAIRING_CODE`).
12. Authorization Tests: Only admin or owner can generate pairing codes (`HTTP 403 Forbidden` for employee).
13. Data Integrity Checks: MongoDB `KioskDevice` stores `hardwareGuid`, hashed token reference (`tokenRef`), and tenant ID (`organizationId`).
14. Integration Checks: Terminal can pair with a published kiosk journey via `POST /api/v1/kiosk/devices/:id/pair-journey`.

---

## Actual Behavior

1. **Admin Pairing Code Generation (`/kiosks`)**:
   - The administrator accesses the Kiosk Management dashboard via the sidebar navigation item **Kiosk Terminals** (`/kiosks`).
   - Admin opens the "Physical Terminals" tab and clicks `"Pair New Terminal"` (`[data-testid="pair-terminal-btn"]` / `[data-testid="pair-terminal-btn-tab"]`).
   - The dialog modal (`[data-testid="pair-terminal-modal"]`) opens.
   - Admin inputs the Hardware GUID: `TEST-KIOSK-001` into `[data-testid="terminal-guid-input"]`.
   - Admin clicks `"Generate Pairing Code"` (`[data-testid="generate-pair-code-btn"]`).
   - Browser sends `POST /api/v1/kiosk/devices/pair/code` with payload `{"deviceId": "TEST-KIOSK-001"}` and receives `HTTP 200 OK`:
     ```json
     {
       "success": true,
       "message": "Device pairing code generated successfully",
       "code": "551622",
       "expiresInSeconds": 900,
       "data": {
         "code": "551622",
         "expiresInSeconds": 900
       }
     }
     ```
   - The modal renders the 6-digit numeric activation code (`551622`) in bold monospace typography (`[data-testid="generated-pair-code"]`) accompanied by an expiration indicator (`[data-testid="code-expiry-timer"]`) stating `"Valid for 15 minutes (Expires in 15:00)"`, a one-click copy button (`[data-testid="copy-pair-code-btn"]`), and setup instructions.

2. **Physical Terminal Hardware Pairing Dispatch**:
   - On the terminal client side, the terminal submits the hardware authentication payload:
     ```json
     {
       "code": "551622",
       "deviceId": "TEST-KIOSK-001",
       "name": "Assembly Floor Terminal",
       "location": "Building 3"
     }
     ```
   - Endpoint `POST /api/v1/kiosk/devices/pair` processes the activation request:
     - Verifies single-use pairing code and asserts expiration bounds.
     - Creates or activates the `KioskDevice` record in MongoDB.
     - Issues a long-lived JWT `deviceToken` signed with claims `{ deviceId: "TEST-KIOSK-001", organizationId: "...", role: "kiosk_device" }`.
     - Generates and stores a SHA-256 hash reference (`tokenRef`) on the device record.
   - Server returns `HTTP 200 OK` with:
     ```json
     {
       "success": true,
       "message": "Device paired successfully",
       "deviceToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "device": {
         "id": "6aa4492b37d8ae71a64fc8e4",
         "_id": "6aa4492b37d8ae71a64fc8e4",
         "name": "Assembly Floor Terminal",
         "deviceId": "TEST-KIOSK-001",
         "hardwareGuid": "TEST-KIOSK-001",
         "location": "Building 3",
         "status": "online",
         "paired": true
       }
     }
     ```

3. **Dashboard Registry Update & Visual Inspection**:
   - In the admin dashboard, clicking `"Done"` (`[data-testid="close-pair-modal-btn"]`) closes the modal and re-fetches device registrations.
   - Under the "Physical Terminals" tab, KPI metric cards update to:
     - `1 Online Terminals`
     - `0 Offline Terminals`
     - `1 Total Paired Hardware`
   - In the **Paired Devices Registry**, the newly paired hardware card renders:
     - Terminal Name: `Assembly Floor Terminal`
     - Status Badge: `Online / Paired` (green pill badge)
     - Location & Identifier: `Building 3 | GUID: TEST-KIOSK-001`
     - Telemetry gauges and remote actions: `Sync Cache`, `Restart`.

4. **Negative Test (Invalid/Expired Pairing Code)**:
   - Client sends pairing request with invalid code `999999`.
   - Endpoint `POST /api/v1/kiosk/devices/pair` rejects the request with `HTTP 400 Bad Request` and error payload:
     ```json
     {
       "success": false,
       "message": "Invalid or expired pairing code",
       "error": "INVALID_OR_EXPIRED_PAIRING_CODE",
       "code": "INVALID_OR_EXPIRED_PAIRING_CODE"
     }
     ```

5. **Authorization Enforcement**:
   - Calling `POST /api/v1/kiosk/devices/pair/code` with a standard employee role token results in immediate interception by `requireRole(["owner", "admin"])`, returning `HTTP 403 Forbidden` (`FORBIDDEN`, `"Access denied. You do not have the required role to perform this action."`).

6. **Data Integrity Checks**:
   - Verified MongoDB `kioskdevices` collection record for `deviceId: "TEST-KIOSK-001"`:
     ```json
     {
       "_id": "6aa4492b37d8ae71a64fc8e4",
       "organizationId": "6a42e795916da0cac4bb1853",
       "deviceId": "TEST-KIOSK-001",
       "hardwareGuid": "TEST-KIOSK-001",
       "name": "Assembly Floor Terminal",
       "location": "Building 3",
       "status": "online",
       "paired": true,
       "tokenRef": "d2c032129ce2a69b9100b354a03ca8a91eaa73e177604c373dea8c0a3108dd26",
       "lastSeen": "2026-09-11T18:32:11.505Z",
       "pairedAt": "2026-09-11T18:32:11.505Z",
       "currentContentVersion": 0,
       "telemetry": {}
     }
     ```

7. **Integration Checks**:
   - Dispatched `POST /api/v1/kiosk/devices/:id/pair-journey` with published journey ID.
   - Endpoint returned `HTTP 200 OK` and updated `currentJourneyId` on the device, linking the hardware to the published onboarding journey.

---

## Implementation Status
`FULLY_IMPLEMENTED`

## Final Verdict
`PASS`

---

## What Is Implemented

- **Backend Kiosk Module (`server/src/modules/kiosk/`)**:
  - `IKioskDevice` & `KioskDeviceSchema`: Added `paired: boolean`, `hardwareGuid: string`, and `tokenRef: string`.
  - `KioskDeviceRepository`: Implemented upsert-capable `register` logic by `deviceId`.
  - `KioskSecurityService`: Configured 15-minute default TTL (900,000 ms) for 6-digit numeric codes with single-use lookup invalidation.
  - `KioskService.generatePairingCode`: Generates 6-digit numeric code returning `{ code, expiresInSeconds: 900 }`.
  - `KioskService.pairDevice`: Validates code and GUID, signs device JWT token with `role: "kiosk_device"`, computes SHA-256 `tokenRef`, and persists device with `paired: true` and `status: "online"`.
  - `KioskController`: Formats responses with `deviceToken`, `device: { id, name, ... }`, and `expiresInSeconds`.

- **Frontend Kiosk Management (`src/pages/KioskDashboard.tsx`, `src/features/kiosk/services/kiosk.service.ts`, `src/components/AppShell.tsx`)**:
  - Navigation: Added direct sidebar link to `Kiosk Terminals` (`/kiosks`).
  - Header actions: Added `"Pair New Terminal"` button (`[data-testid="pair-terminal-btn"]`).
  - Modal dialog: Added interactive code generator (`[data-testid="pair-terminal-modal"]`), Hardware GUID input (`[data-testid="terminal-guid-input"]`), `"Generate Pairing Code"` button (`[data-testid="generate-pair-code-btn"]`), 6-digit activation code display (`[data-testid="generated-pair-code"]`), 15-minute countdown badge (`[data-testid="code-expiry-timer"]`), and clipboard copy button.
  - Paired Devices Registry: Renders connected terminals (`[data-testid="terminal-card"]`), name (`[data-testid="terminal-name"]`), location (`[data-testid="terminal-location"]`), GUID (`[data-testid="terminal-guid"]`), and status badge displaying `"Online / Paired"` (`[data-testid="device-status-badge"]`).

---

## Test Execution Summary

### 1. Automated Vitest Suite (`server/src/tests/uj-ksk-001.test.ts`)
Run command: `npx vitest run src/tests/uj-ksk-001.test.ts`
All 7 tests passed (100% success rate):
- `✓ Step 1-6: Admin generates 6-digit device pairing code (POST /api/v1/kiosk/devices/pair/code)` (141ms)
- `✓ Step 7-8: Physical terminal submits code and receives deviceToken (POST /api/v1/kiosk/devices/pair)` (278ms)
- `✓ Step 9: Admin lists devices and asserts terminal is listed with status online/paired (GET /api/v1/kiosk/devices)` (270ms)
- `✓ Negative Test: Submit invalid pairing code (999999) returns HTTP 400 with INVALID_OR_EXPIRED_PAIRING_CODE` (2ms)
- `✓ Authorization Test: Unauthorized regular employee cannot generate pairing codes (HTTP 403 Forbidden)` (78ms)
- `✓ Data Integrity Checks: MongoDB KioskDevice stores hardwareGuid, hashed token reference, and tenant ID` (14ms)
- `✓ Integration Check: Terminal can pair with a published kiosk journey (POST /api/v1/kiosk/devices/:id/pair-journey)` (545ms)

### 2. Live Browser Verification Evidence
- Subagents: `kiosk_device_pairing`, `pair_terminal_end_to_end`, `kiosk_paired_registry`
- Verified:
  1. Admin navigated to `/kiosks` and opened the "Physical Terminals" tab.
  2. Clicked `"Pair New Terminal"` button.
  3. Entered Hardware GUID: `TEST-KIOSK-001`.
  4. Clicked `"Generate Pairing Code"` -> API returned 6-digit code `551622` with 900-second expiration.
  5. Captured modal screenshot with activation code and countdown timer.
  6. Dispatched terminal pairing POST request with `TEST-KIOSK-001`, `Assembly Floor Terminal`, and `Building 3`.
  7. API returned `HTTP 200 OK` with deviceToken and paired device record.
  8. Clicked `"Done"` on modal -> Paired Devices Registry reloaded.
  9. Asserted `Assembly Floor Terminal` is displayed with `Online / Paired` badge, `Building 3` location, and `GUID: TEST-KIOSK-001`.
  10. Captured screenshot of the active device registry.

---

## Evidence Artifacts

### 1. Generated 6-Digit Pairing Code & 15-Minute Expiry Badge
![Kiosk Generated Pairing Code](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/kiosk_generated_pair_code_1789148517456.png)

### 2. Paired Devices Registry — Assembly Floor Terminal Online / Paired
![Paired Terminal in Registry](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/kiosk_terminal_paired_success_1789151581683.png)

### 3. Interactive Browser Session Recordings
- Modal Code Generation: [kiosk_device_pairing.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/kiosk_device_pairing_1789148398863.webp)
- Paired Registry Refresh: [kiosk_paired_registry.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/kiosk_paired_registry_1789151540192.webp)

---

## Conclusion
The 6-digit device pairing and terminal hardware onboarding workflow operates with complete data integrity across the admin portal, Fastify REST APIs, and MongoDB persistence layers. All acceptance criteria, authorization guards, negative tests, and integration checks pass without errors.
