# Enterprise SSO Configuration & Certificate Management

## Journey ID
UJ-ADM-010

## Primary Role
Organization Owner / HR Administrator (`owner`, `admin`)

## Business Goal
Configure enterprise SAML 2.0 or OIDC Single Sign-On parameters, upload Identity Provider (IdP) X.509 public certificates, configure metadata URLs, and enforce SSO login policies for organization members.

## Preconditions
Authenticated with `manage_sso` capability.

## Trigger
Admin navigates to `/settings/sso`.

## Expected Outcome
1. Displays SSO configuration form: Protocol (SAML 2.0 / OIDC), Domain, IdP Entry Point URL, Issuer ID, and X.509 Certificate.
2. Admin inputs configuration, tests connection, and toggles "Enforce SSO for Domain".
3. Backend validates certificate structure and persists configuration to `Organization.ssoConfig`.

## Journey Steps
1. Navigate to `/settings/sso` (`src/pages/SSOSettings.tsx`).
2. Frontend requests `GET /api/v1/auth/sso/config`.
3. Admin selects "SAML 2.0".
4. Inputs Corporate Domain: `acme.corp`.
5. Inputs IdP Entry Point: `https://okta.acme.corp/app/sso`.
6. Pastes X.509 Certificate PEM.
7. Toggles "Enforce SSO".
8. Clicks "Save SSO Configuration".
9. Client sends `PUT /api/v1/auth/sso/config`.
10. Backend verifies certificate format and stores config.
11. UI renders active green status badge.

## Alternative Paths
- Admin toggles "Allow Password Fallback" for external contractors.

## Validation Rules
- Valid URL format for entry point; valid PEM certificate structure.

## Permissions
`requireRole(["owner", "admin", "super_admin"])`.

## APIs / Backend Dependencies
- `GET /api/v1/auth/sso/config`
- `PUT /api/v1/auth/sso/config` (`server/src/modules/auth/routes/sso.routes.ts`)

## Data Dependencies
- `Organization.ssoConfig`.

## Notifications / Integrations
- Security audit log emitted.

## Failure Scenarios
- Malformed X.509 certificate: Rejected with HTTP 400.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/SSOSettings.tsx`
- `server/src/modules/auth/controllers/sso.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase16-sso-hris.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ADM-010.md`
