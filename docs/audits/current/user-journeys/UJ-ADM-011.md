# Journey Audit — HRIS Marketplace Integration Sync

## Journey ID
UJ-ADM-011

## Date
September 2026

## Primary Role
Organization Owner / HR Administrator (`owner`, `admin`)

## Intended Behavior
An organization administrator or owner with the `manage_integrations` capability can browse an HRIS marketplace on `/settings/integrations`, configure third-party HRIS connectors (e.g. BambooHR), input subdomain and API credentials, and initiate workforce synchronization. The administrator can:
1. Navigate to `/settings/integrations`.
2. Locate the BambooHR marketplace connector card.
3. Click "Connect".
4. Enter Subdomain: `acmetest` and API Key: `test_api_key_123`.
5. Click "Save & Test Connection".
6. Monitor network: `POST /api/v1/integrations/bamboohr/connect` returns `200 OK`.
7. Click "Sync Now".
8. Monitor network: `POST /api/v1/integrations/bamboohr/sync` returns `{ status: "queued", syncId: string }`.
9. The connector card reflects status "Connected" with the last sync timestamp.
10. Test alternative paths: Disconnect connector or pause webhook listeners.
11. Test negative validation: Submitting an empty API key triggers validation flagging missing credentials.
12. Test authorization: Employees attempting `POST /api/v1/integrations/*` receive `HTTP 403 Forbidden`.
13. Test data integrity: MongoDB `Integration` document stores credentials and tenant ID (`organizationId`).
14. Test integration checks: Inbound webhook endpoint `POST /api/v1/integrations/webhooks/bamboohr` processes payload.

---

## Actual Behavior
1. **Marketplace Navigation & Catalog Rendering**:
   - Organization administrators navigate to `/settings/integrations` and view the Marketplace Connectors Catalog featuring BambooHR, Workday, Rippling, and Personio.
   - Initial connector state for BambooHR renders as `"Available"` with a `+ Connect` action button (`[data-testid="bamboohr-connect-btn"]`).

2. **Negative Validation (Missing API Key)**:
   - Clicking "Connect" opens the connection modal (`[data-testid="connect-modal-title"]`).
   - Clicking "Save & Test Connection" (`[data-testid="bamboohr-save-connect-btn"]`) with an empty API key triggers real-time client validation:
     - Form displays error message: `"API Key is required to connect to BambooHR"` (`[data-testid="bamboohr-apikey-error"]`).
     - Input border is highlighted in red.
     - Toast notification warns: `"API Key is required to connect"`.
   - Backend validation in `HRISIntegrationService.connectProvider` enforces presence of `apiKey`; direct API requests with empty credentials return `HTTP 400 Bad Request` (`message: "API Key is required to connect to bamboohr"`).

3. **Happy Path Connection (BambooHR Setup)**:
   - Administrator inputs Subdomain: `acmetest` (`[data-testid="bamboohr-subdomain-input"]`) and API Key: `test_api_key_123` (`[data-testid="bamboohr-apikey-input"]`).
   - Clicking "Save & Test Connection" dispatches `POST /api/v1/integrations/bamboohr/connect` with `{ subdomain: "acmetest", apiKey: "test_api_key_123" }`.
   - Network response returns `HTTP 200 OK` with `{ success: true, message: "bamboohr connected successfully", data: integration }`.
   - UI closes modal, displays toast `"Connected BambooHR successfully!"`, and updates the BambooHR connector card:
     - Status badge renders **"Connected"** in emerald (`[data-testid="bamboohr-status-badge"]`).
     - Tenant subdomain displays `acmetest.bamboohr.com`.
     - Action buttons update to `"Sync Now"`, `"Test API"`, `"Logs"`, and `"Disconnect"`.

4. **Workforce Sync Execution**:
   - Clicking "Sync Now" (`[data-testid="bamboohr-sync-btn"]`) dispatches `POST /api/v1/integrations/bamboohr/sync`.
   - Network response returns `HTTP 200 OK` with payload:
     ```json
     {
       "success": true,
       "status": "queued",
       "syncId": "6aa3220a074cd94137a12fec",
       "message": "HRIS employee lifecycle sync queued successfully"
     }
     ```
   - UI displays toast: `"Workforce sync queued successfully! (ID: 6aa3220a074cd94137a12fec)"`.
   - Last Synchronized timestamp updates in real-time (`[data-testid="bamboohr-last-synced"]`).

5. **Diagnostic API Testing & Sync Logs**:
   - Clicking "Test API" (`[data-testid="bamboohr-test-btn"]`) invokes `POST /api/v1/integrations/:id/test`, returning response latency (`42ms`) and connection health confirmation.
   - Clicking "Logs" (`[data-testid="bamboohr-logs-btn"]`) opens the Sync Telemetry & Dead-Letter Queue (DLQ) viewer, displaying processed record metrics (`Processed 1 records (1 created, 0 updated)`).

6. **Alternative Path (Connector Disconnection)**:
   - Clicking "Disconnect" (`[data-testid="bamboohr-disconnect-btn"]`) dispatches `POST /api/v1/integrations/bamboohr/disconnect`.
   - Connector status updates to `disabled` in MongoDB and reverts the UI badge to `"Available"` with `"Connect"` button restored.

7. **Inbound Webhook Verification**:
   - Dispatched `POST /api/v1/integrations/webhooks/bamboohr` with sample employee lifecycle payload.
   - Ingestion engine verified HMAC secret, processed records, and provisioned new employee profile in `User` collection.

8. **Authorization Tests**:
   - Unauthorized employee token attempting `POST /api/v1/integrations/bamboohr/connect` received `HTTP 403 Forbidden` (`code: "FORBIDDEN"`).

9. **Data Integrity Checks**:
   - Verified MongoDB `Integration` (`HRISIntegration`) document stored `organizationId`, `provider: "bamboohr"`, `subdomain: "acmetest"`, `apiKey: "test_api_key_123"`, and `lastSyncedAt`.

---

## Implementation Status
`PARTIALLY_IMPLEMENTED`
*(All application models, marketplace catalog, connection modals, credential storage, workforce sync queuing, simulated ingestion pipelines, DLQ logs, and inbound webhook receivers are fully implemented and automated in tests. However, live end-to-end sync against actual third-party BambooHR API servers requires production customer OAuth2/API credentials, which is classified as `PARTIALLY_IMPLEMENTED` per journey guidelines).*

## Final Verdict
`PARTIAL`
*(Simulated mock responses in dev/test; live end-to-end sync requires production customer BambooHR API tenant. Form, modal, API contracts, sync queuing, and authorization checks fully passed).*

---

## What Is Implemented
- **Marketplace Catalog & Configuration UI**:
  - `src/pages/HRISIntegrations.tsx`: Marketplace connectors catalog with BambooHR, Workday, Rippling, and Personio cards. Modal for BambooHR subdomain and API key input with validation highlight. Sync trigger, Test API, DLQ telemetry logs, and Disconnect actions.
  - `src/services/integration.service.ts`: Client methods for `connectProvider`, `syncProvider`, `disconnectProvider`, `testConnection`, and `getSyncLogs`.
  - `src/hooks/useIntegrations.ts`: React Query hooks with automatic cache invalidation on connect/sync/disconnect.

- **Backend Integration Endpoints & Pipeline**:
  - `server/src/modules/integrations/routes/hris-integration.routes.ts`: Unified routes `POST /:provider/connect`, `POST /:idOrProvider/sync`, `POST /:provider/disconnect`, `POST /webhooks/:provider`.
  - `server/src/modules/integrations/controllers/hris-integration.controller.ts`: Handles requests, enforces role authorization, and responds with `{ status: "queued", syncId }`.
  - `server/src/modules/integrations/services/hris-integration.service.ts`: Provider connection manager, sync queue dispatcher, field mapping engine, conflict resolution policy, DLQ error logging, and HMAC webhook receiver.
  - `server/src/modules/integrations/models/hris-integration.model.ts`: Exported `HRISIntegration` and `Integration` models mapped to collection `hrisintegrations`.

---

## Test Execution Summary

### 1. Automated Vitest Suite (`server/src/tests/uj-adm-011.test.ts`)
Run command: `npx vitest run src/tests/uj-adm-011.test.ts`
All 7 tests passed (100% success rate):
- `✓ Step 1-6: Admin connects BambooHR with Subdomain and API Key` (751ms)
- `✓ Step 7-8: Admin triggers workforce sync and receives queued status` (748ms)
- `✓ Data Integrity Check: MongoDB Integration document stores tenant ID and credentials` (103ms)
- `✓ Integration Check: Incoming webhook endpoint processes BambooHR payload` (726ms)
- `✓ Alternative Path: Admin can disconnect BambooHR connector` (491ms)
- `✓ Negative Test: Connecting with empty API key returns 400 Bad Request` (205ms)
- `✓ Authorization Test: Regular employees calling POST /api/v1/integrations/* receive 403 Forbidden` (244ms)

### 2. Live Browser Verification
- Subagent: `uj_adm_011_hris`
- Verified:
  1. Negative validation: Empty API key triggers error message and stops submission.
  2. Happy Path: Subdomain `acmetest` and API key `test_api_key_123` entered and submitted.
  3. Network: `POST /api/v1/integrations/bamboohr/connect` returned `200 OK`.
  4. UI update: BambooHR badge updated to **"Connected"**.
  5. Workforce sync: "Sync Now" triggered `POST /api/v1/integrations/bamboohr/sync`, returned `{ status: "queued", syncId: "6aa3220a074cd94137a12fec" }`, and updated last sync timestamp.
  6. API test: Latency benchmark verified (`42ms`).
  7. Telemetry: Sync logs modal verified with processed employee count.
  8. Disconnect: Connector cleanly reverted to "Available".

### 3. Database State Verification (MongoDB Atlas)
```json
{
  "_id": "6aa3220a074cd94137a12fec",
  "organizationId": "6a42e795916da0cac4bb1853",
  "provider": "bamboohr",
  "name": "BambooHR Production Sync",
  "status": "active",
  "apiKey": "test_api_key_123",
  "subdomain": "acmetest",
  "lastSyncedAt": "2026-09-10T21:32:58.000Z"
}
```

---

## Evidence Artifacts

| Type | Path / URI | Description |
|---|---|---|
| **Video Recording** | [uj_adm_011_hris.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/uj_adm_011_hris_1789075864083.webp) | Full browser recording of connector setup, validation, sync, and disconnection |
| **Negative Validation Screenshot** | [bamboohr_validation_error.png](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/bamboohr_validation_error_1789075893131.png) | Form validation highlighting missing API key |
| **Connected State Screenshot** | [bamboohr_connected_state.png](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/bamboohr_connected_state_1789075959966.png) | Connector card displaying Connected badge and tenant subdomain |
| **Synced State Screenshot** | [bamboohr_synced_state.png](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/bamboohr_synced_state_1789075987660.png) | Connector card displaying updated last synchronized timestamp |
| **Test API Toast Screenshot** | [bamboohr_test_api_toast.png](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/bamboohr_test_api_toast_1789076083817.png) | Toast notification confirming connection verification and latency |
| **Sync Logs Modal Screenshot** | [bamboohr_sync_logs_modal.png](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/bamboohr_sync_logs_modal_1789076112651.png) | Telemetry modal detailing processed records and DLQ events |
| **Disconnected State Screenshot** | [bamboohr_disconnected_state.png](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/bamboohr_disconnected_state_1789076153181.png) | Connector card reverted to Available state after disconnection |
| **Automated Test Suite** | [uj-adm-011.test.ts](file:///d:/talnova/talnova-onboarding/server/src/tests/uj-adm-011.test.ts) | Automated integration test verifying connect, sync, webhooks, and security |

---

## Failure Classification
`PARTIALLY_IMPLEMENTED` — Simulated mock responses in dev/test; live end-to-end sync requires production customer BambooHR API tenant. Final Verdict: **PARTIAL**.
