# User Logout & Session Invalidation

## Journey ID
UJ-AUTH-002

## Primary Role
All Roles

## Business Goal
Securely terminate the active authenticated session, purge client-side tokens, and invalidate refresh credentials on the server.

## Preconditions
User is currently logged in with a valid JWT token.

## Trigger
User clicks the "Log out" button located in the sidebar or user profile menu.

## Expected Outcome
1. Client clears `localStorage` items (`token`, `user_role`, `user_id`).
2. Client issues `POST /api/v1/auth/logout`.
3. Server clears refresh token cookie.
4. User is redirected to `/login`.

## Journey Steps
1. User clicks "Sign Out" in `src/components/Sidebar.tsx` or `UserMenu`.
2. Frontend calls `authService.logout()`.
3. Client dispatches `POST /api/v1/auth/logout`.
4. Server expires the refresh token cookie with maxAge: 0.
5. Frontend clears client state and routes to `/login`.

## Alternative Paths
- If backend request fails or network drops, client still forces local session purge and returns to `/login`.

## Validation Rules
- Must revoke access and refresh mechanisms.

## Permissions
Authenticated user.

## APIs / Backend Dependencies
- `POST /api/v1/auth/logout` (`server/src/modules/auth/routes/auth.routes.ts`)

## Data Dependencies
- Session refresh token in cookie store.

## Notifications / Integrations
- Audit log entry: `USER_LOGOUT`.

## Failure Scenarios
- Server unreachable: Local state purged, redirection proceeds.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/services/auth.service.ts`
- `server/src/modules/auth/controllers/auth.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/auth.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-AUTH-002.md`
