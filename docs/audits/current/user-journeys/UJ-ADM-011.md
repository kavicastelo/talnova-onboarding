# Journey Audit — HRIS Marketplace Integration Sync

## Journey ID
UJ-ADM-011

## Date
September 2026

## Role
Organization Owner / HR Administrator (`owner`, `admin`)

## Intended Behavior
Organization administrators can browse an integrations marketplace on `/settings/integrations`, connect third-party HRIS providers (BambooHR, Workday, HiBob), configure webhook listeners, and trigger bidirectional synchronization to automatically ingest employees, map job titles, and handle automated termination offboarding.

## Actual Behavior
The marketplace UI, connector configuration modals, backend integration storage models (`Integration`), manual sync triggers, and webhook ingestion endpoints (`POST /api/v1/integrations/webhooks/:provider`) are fully implemented and verified via automated test suites (`phase16-sso-hris.test.ts`). However, in development and test environments, third-party vendor APIs (e.g. live BambooHR OAuth2 servers, live Workday SOAP/REST endpoints) are mocked. Full production synchronization requires live customer API credentials.

## Implementation Status
`PARTIALLY_IMPLEMENTED`

## What Is Implemented
- Integrations catalog and configuration UI in `src/pages/HRISIntegrations.tsx`.
- Integration service hooks in `src/services/integration.service.ts`.
- Backend endpoints: `GET /api/v1/integrations`, `POST /api/v1/integrations/:provider/connect`, `POST /api/v1/integrations/:provider/sync`, `POST /api/v1/integrations/webhooks/:provider`.
- Integration data model storing tenant credentials securely.
- Automated tests verifying connector setup, simulated ingestion, and webhook processing (`server/src/tests/phase16-sso-hris.test.ts`).

## What Is Missing
- Live external sandbox connectors for Workday enterprise SOAP interfaces.
- Dead-letter queue (DLQ) administrative replay UI.

## What Is Incorrect
- None; the architecture and contracts are intact, but live vendor dependencies require production deployments.

## Evidence
- File: `server/src/modules/integrations/routes/integration.routes.ts`
- Route: `POST /api/v1/integrations/:provider/connect`, `POST /api/v1/integrations/:provider/sync`
- Component: `src/pages/HRISIntegrations.tsx`
- Service: `server/src/modules/integrations/services/integration.service.ts`
- Test: `server/src/tests/phase16-sso-hris.test.ts`

## Gap Analysis

| Requirement | Expected | Actual | Status |
| :--- | :--- | :--- | :--- |
| **Marketplace Catalog** | Display available connectors (BambooHR, Workday, etc.). | Implemented on `/settings/integrations`. | `ALIGNED` |
| **Credential Storage** | Securely persist API keys and subdomains per tenant. | Implemented in `Integration` model. | `ALIGNED` |
| **Ingestion Pipeline** | Convert incoming HRIS records to canonical `User` profiles. | Implemented and verified in test suite. | `ALIGNED` |
| **Live Third-Party E2E** | Live test against production BambooHR tenant. | Requires customer enterprise credentials. | `PARTIAL` |

## Impact
Medium. Marketplace and webhook ingestion logic is complete and tested; production onboarding of customers requires their real HRIS API tokens.

## Root Cause
Third-party B2B SaaS dependency boundary.

## Recommended Fix
Maintain mock HRIS fixture generators for CI/CD and automated tests; create an administrative DLQ viewer in `/settings/integrations` to inspect failed webhook payloads.

## Verification Plan
1. Run `vitest run src/tests/phase16-sso-hris.test.ts` to confirm connector and webhook tests pass.
2. Verify `/settings/integrations` renders connector cards and test modal.

## Related Code
- `server/src/modules/integrations/services/integration.service.ts`
- `src/pages/HRISIntegrations.tsx`

## Related Documentation
- `docs/product/requirements/14-integrations.md` §REQ-INT-001
- `docs/user-journeys/administration/UJ-ADM-011.md`

## Related Test Prompt
`prompts/user-journeys/UJ-ADM-011.md`
