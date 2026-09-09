# Journey Audit — Enterprise SSO Discovery & Initiation

## Journey ID
UJ-AUTH-005

## Date
September 2026

## Role
Organization Owner / Corporate Employee

## Intended Behavior
Corporate users entering their email address on `/login` automatically trigger domain discovery, identify the configured enterprise SAML 2.0 / OIDC Identity Provider (e.g. Okta, Azure AD), redirect to the IdP, validate cryptographically signed SAML assertions or OIDC tokens, and just-in-time (JIT) provision or authenticate the user into their workspace.

## Actual Behavior
The frontend domain discovery (`POST /api/v1/auth/sso/discover`) and configuration forms (`/settings/sso`) are implemented and connect to backend controller routes. However, in test and local development environments, full external SAML redirect handshakes and IdP token verifications rely on mock connector fixtures. Live enterprise SAML metadata auto-fetching and live cryptographic signature verification requires external production customer IdP credentials.

## Implementation Status
`PARTIALLY_IMPLEMENTED`

## What Is Implemented
- Frontend SSO settings management UI (`src/pages/SSOSettings.tsx`).
- Frontend domain discovery trigger in `src/services/sso.service.ts`.
- Backend endpoints: `POST /api/v1/auth/sso/discover`, `POST /api/v1/auth/sso/initiate`, `POST /api/v1/auth/sso/callback`, `PUT /api/v1/auth/sso/config`.
- Organization schema storage for SAML configuration (`Organization.ssoConfig`).
- Automated tests verifying discovery and configuration (`server/src/tests/phase16-sso-hris.test.ts`).

## What Is Missing
- Live SAML 2.0 metadata XML auto-synchronization endpoint.
- Production integration testing against active Okta or Azure AD tenants.

## What Is Incorrect
- None in current code; the implementation is structured correctly but constrained by external IdP dependencies in non-production environments.

## Evidence
- File: `server/src/modules/auth/routes/sso.routes.ts`
- Route: `POST /api/v1/auth/sso/discover`, `POST /api/v1/auth/sso/initiate`
- Component: `src/pages/SSOSettings.tsx`, `src/services/sso.service.ts`
- Service: `server/src/modules/auth/services/sso.service.ts`
- Test: `server/src/tests/phase16-sso-hris.test.ts`

## Gap Analysis

| Requirement | Expected | Actual | Status |
| :--- | :--- | :--- | :--- |
| **Domain Auto-Discovery** | Detects corporate domain from email and returns IdP entry point. | Fully implemented via `POST /api/v1/auth/sso/discover`. | `ALIGNED` |
| **SSO Form Configuration** | Allows uploading X.509 cert, entry point, and toggling enforcement. | Fully implemented on `/settings/sso`. | `ALIGNED` |
| **Live SAML Assertion** | Live SAML cryptographic validation against third-party IdP. | Verified via simulated assertion payloads; live IdP required. | `PARTIAL` |

## Impact
Medium. Enterprise customers can configure and test their SSO setup, but deploying live SAML requires customer-specific IdP credentials.

## Root Cause
External SaaS dependency boundary: Live SAML IdP servers cannot be hosted inside local offline test runners without enterprise mock IdPs.

## Recommended Fix
Add an optional local SAML mock IdP container (e.g. `saml-idp` Docker container) into the local development stack to enable end-to-end cryptographic testing without external Okta credentials.

## Verification Plan
1. Run `vitest run src/tests/phase16-sso-hris.test.ts` to confirm simulated discovery and assertion verification pass.
2. Test `/settings/sso` UI for form validation on invalid URLs and PEM certificates.

## Related Code
- `server/src/modules/auth/services/sso.service.ts`
- `src/pages/SSOSettings.tsx`

## Related Documentation
- `docs/product/requirements/14-integrations.md` §REQ-INT-001
- `docs/user-journeys/authentication/UJ-AUTH-005.md`

## Related Test Prompt
`prompts/user-journeys/UJ-AUTH-005.md`
