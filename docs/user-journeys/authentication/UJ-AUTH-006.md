# Token Refresh & Automatic Session Renewal

## Journey ID
UJ-AUTH-006

## Primary Role
All Roles

## Business Goal
Seamlessly renew expiring short-lived JWT access tokens in the background using an HTTP-only secure refresh cookie without interrupting the user's active workflow.

## Preconditions
User is logged in; access token is near expiry or expired; valid refresh token cookie exists.

## Trigger
Client receives HTTP 401 on an API request or token expiration timer fires in Axios interceptor.

## Expected Outcome
1. Client Axios interceptor catches 401 and queues ongoing requests.
2. Interceptor calls `POST /api/v1/auth/refresh`.
3. Backend validates refresh token, generates a new short-lived JWT access token.
4. Client updates memory token and replays the original queued requests without user disruption.

## Journey Steps
1. API request made with expired access token.
2. Axios response interceptor (`src/api/client.ts`) detects 401 error.
3. Client dispatches `POST /api/v1/auth/refresh` sending HTTP-only cookie.
4. Fastify verifies refresh token.
5. Server returns `{ token: newJwt }`.
6. Client updates stored token and retries pending request.

## Alternative Paths
- If refresh token is expired or revoked, client purges session and redirects to `/login`.

## Validation Rules
- Refresh token must not be blacklisted or expired.

## Permissions
Public/Cookie-authenticated.

## APIs / Backend Dependencies
- `POST /api/v1/auth/refresh` (`server/src/modules/auth/routes/auth.routes.ts`)

## Data Dependencies
- Stored refresh token secret / session.

## Notifications / Integrations
None.

## Failure Scenarios
- Expired refresh token: User redirected to `/login`.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/api/client.ts`
- `server/src/modules/auth/controllers/auth.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/auth.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-AUTH-006.md`
