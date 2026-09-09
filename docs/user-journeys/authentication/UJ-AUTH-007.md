# Unauthorized Access & RBAC Route Guard Rejection

## Journey ID
UJ-AUTH-007

## Primary Role
All Roles (Negative Security Boundary Verification)

## Business Goal
Verify that unauthorized users (e.g. standard employees or managers) attempting to access privileged routes or execute restricted API mutations are strictly rejected at both frontend and backend boundaries.

## Preconditions
User is authenticated with a low-privilege role (e.g. `employee` or `manager`).

## Trigger
1. User directly navigates to a privileged URL (e.g. `/super-admin`, `/workflows`, `/settings/sso`).
2. Or user directly dispatches a privileged API request via `curl` or Postman (e.g. `POST /api/v1/journeys` or `POST /api/v1/employees/invite`).

## Expected Outcome
1. Frontend `ProtectedRoute` evaluates `hasCapability(role, capability)`. If false, renders access denied banner or redirects to user's authorized home.
2. Backend Fastify middleware `requireRole(...)` evaluates `req.user.role`. If not in allowed list, immediately returns `HTTP 403 Forbidden` (`FORBIDDEN_ACCESS`).

## Journey Steps
1. Authenticate as `role: "employee"`.
2. Attempt direct URL navigation to `/super-admin`.
3. `ProtectedRoute` intercepts request, detects lack of `view_super_admin` capability, and displays "Access Denied" or redirects.
4. Issue direct `POST /api/v1/super-admin/organizations` with employee JWT.
5. Backend hook `requireRole(["super_admin"])` executes.
6. Returns HTTP 403 JSON: `{ "statusCode": 403, "error": "FORBIDDEN", "message": "Insufficient permissions" }`.

## Alternative Paths
- Unauthenticated request: Returns HTTP 401 Unauthorized.

## Validation Rules
- Zero trust: Frontend hiding of navigation elements is never treated as a security boundary. Backend must enforce all capabilities.

## Permissions
Restricted.

## APIs / Backend Dependencies
- `server/src/middleware/auth.middleware.ts` (`requireRole`)
- `src/components/ProtectedRoute.tsx`

## Data Dependencies
- Authenticated JWT payload with `role`.

## Notifications / Integrations
- Security audit log entry: `UNAUTHORIZED_ACCESS_ATTEMPT`.

## Failure Scenarios
- Privilege escalation: Any route that returns 200 to an unauthorized role is a critical security vulnerability.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/components/ProtectedRoute.tsx`, `src/utils/rbac.ts`
- `server/src/middleware/auth.middleware.ts`
- Tests: `server/src/tests/canonical-model-integrity.test.ts`, `server/src/tests/auth.test.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated across unit and integration tests.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-AUTH-007.md`
