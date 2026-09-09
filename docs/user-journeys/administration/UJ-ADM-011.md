# HRIS Marketplace Integration Sync & Webhook Management

## Journey ID
UJ-ADM-011

## Primary Role
Organization Owner / HR Administrator (`owner`, `admin`)

## Business Goal
Connect external HRIS platforms (BambooHR, Workday, HiBob) to automatically synchronize newly hired employees, map job titles and departments, and receive real-time webhook updates.

## Preconditions
Authenticated with `manage_integrations` capability.

## Trigger
Admin navigates to `/settings/integrations` and clicks "Connect" on an HRIS marketplace card.

## Expected Outcome
1. Opens connector credentials modal (API Key, Subdomain / Tenant URL).
2. Admin submits credentials and clicks "Test & Connect".
3. System establishes connection and triggers initial sync.
4. Newly discovered employees are ingested and queued for automated journey assignment.

## Journey Steps
1. Navigate to `/settings/integrations` (`src/pages/HRISIntegrations.tsx`).
2. Frontend loads available connectors via `GET /api/v1/integrations`.
3. Select "BambooHR" and click "Configure".
4. Enter API Key and Subdomain (`acme.bamboohr.com`).
5. Click "Save & Sync Now".
6. Client dispatches `POST /api/v1/integrations/bamboohr/connect`.
7. Backend validates connector credentials, saves integration config, triggers background sync worker (`POST /api/v1/integrations/bamboohr/sync`).
8. Ingested employees emit `ON_USER_CREATED`.
9. UI displays connector status as "Active" with last sync timestamp.

## Alternative Paths
- Incoming webhook event from HRIS: `POST /api/v1/integrations/webhooks/:provider` processes employee status change or termination.

## Validation Rules
- Required API keys and valid subdomain.

## Permissions
`requireRole(["owner", "admin"])`.

## APIs / Backend Dependencies
- `GET /api/v1/integrations`
- `POST /api/v1/integrations/:provider/connect`
- `POST /api/v1/integrations/:provider/sync`
- `POST /api/v1/integrations/webhooks/:provider`

## Data Dependencies
- `Integration` model in `integrations` collection.

## Notifications / Integrations
- BambooHR, Workday, HiBob REST APIs.

## Failure Scenarios
- Invalid API key: Connector returns HTTP 401.
- Ingestion failure: Routed to DLQ retry queue.

## Current Implementation

### Status
`PARTIALLY_IMPLEMENTED`

### Evidence
- Frontend: `src/pages/HRISIntegrations.tsx`, `src/services/integration.service.ts`
- Backend: `server/src/modules/integrations/routes/integration.routes.ts`, `server/src/tests/phase16-sso-hris.test.ts`

### Missing Pieces
- In test and staging environments, live external HRIS SaaS platforms (BambooHR production API, Workday enterprise OAuth2 gateway) are simulated with mock fixture responses. Full end-to-end sync with production customer HRIS requires enterprise production tenant credentials.

### Known Issues
- Real HRIS sync depends on customer-specific production third-party environments.

## Test Coverage
Automated in `server/src/tests/phase16-sso-hris.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ADM-011.md`
