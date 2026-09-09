# Enterprise SSO Discovery & Initiation

## Journey ID
UJ-AUTH-005

## Primary Role
Owner / Organization Employee

## Business Goal
Allow enterprise employees to log in using their corporate Identity Provider (SAML 2.0 / OIDC) via email domain auto-discovery.

## Preconditions
1. Organization Owner has configured SAML 2.0 / OIDC settings in `/settings/sso`.
2. Corporate domain is verified and mapped to the organization.

## Trigger
User enters their corporate email address on `/login` and clicks "Sign in with SSO", or enters email triggering domain discovery.

## Expected Outcome
1. Frontend detects corporate domain and calls `POST /api/v1/auth/sso/discover`.
2. If SSO is enforced/enabled, initiates SAML redirect to corporate IdP.
3. Upon successful SAML assertion response, backend verifies assertion and issues platform JWT token.

## Journey Steps
1. User enters corporate email in login view.
2. Client queries `POST /api/v1/auth/sso/discover` with domain.
3. Backend returns SSO provider configuration (IdP Entrypoint URL).
4. Client redirects to IdP or opens SAML initiation flow (`POST /api/v1/auth/sso/initiate`).
5. IdP authenticates user and returns SAML response.
6. Server processes assertion, provisions user if JIT is enabled, and returns session token.

## Alternative Paths
- If SSO domain is not configured or disabled, client prompts for standard password login.

## Validation Rules
- Domain must match configured organization SSO domain.
- Valid SAML assertion signature using tenant certificate.

## Permissions
Public discovery / Authenticated SAML assertion.

## APIs / Backend Dependencies
- `POST /api/v1/auth/sso/discover`
- `POST /api/v1/auth/sso/initiate`
- `POST /api/v1/auth/sso/callback`
- `SSOService` (`server/src/modules/auth/services/sso.service.ts`)

## Data Dependencies
- `Organization.ssoConfig` (provider, domain, entrypoint, certificate, enabled).

## Notifications / Integrations
- Enterprise IdP (Okta, Azure AD, Ping Identity).

## Failure Scenarios
- Invalid SAML signature.
- Unmatched domain.
- Missing JIT mapping attributes.

## Current Implementation

### Status
`PARTIALLY_IMPLEMENTED`

### Evidence
- Frontend: `src/services/sso.service.ts`, `src/pages/SSOSettings.tsx`.
- Backend: `server/src/modules/auth/routes/sso.routes.ts`, `server/src/modules/auth/controllers/sso.controller.ts`.
- Tests: `server/src/tests/phase16-sso-hris.test.ts`.

### Missing Pieces
- In development/test environments, real external IdP redirect and cryptographic SAML assertion verification is simulated via mock connector fixtures; live enterprise SAML metadata XML auto-sync requires production IdP credentials.

### Known Issues
- Requires external IdP configuration to test end-to-end against live Okta/Azure AD infrastructure.

## Test Coverage
Verified with simulated SAML payloads in `server/src/tests/phase16-sso-hris.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-AUTH-005.md`
