# User Login (Credentials)

## Journey ID
UJ-AUTH-001

## Primary Role
All Roles (`super_admin`, `owner`, `admin`, `manager`, `employee`)

## Business Goal
Authenticate valid corporate users into their multi-tenant workspace via email and password, establishing an isolated session context.

## Preconditions
1. Active user account exists in MongoDB `users` collection (`status != 'inactive'`, `isDeleted == false`).
2. User's parent organization exists and is active.
3. User possesses valid password credentials.

## Trigger
User visits `/login`, inputs registered email and password, and clicks "Sign in".

## Expected Outcome
1. Backend validates credentials via Argon2 hashing.
2. Fastify issues a signed JWT access token (`app.jwt.sign`) encoding `userId`, `organizationId`, and `role`, plus an HTTP-only refresh cookie.
3. User is redirected to their role-appropriate home view (`/` dashboard redirect):
   - `super_admin` → `/super-admin`
   - `admin` / `owner` → `/` (Admin Dashboard)
   - `manager` → `/manager`
   - `employee` → `/employee`

## Journey Steps
1. User enters email and password into `LoginForm` in `src/pages/Login.tsx`.
2. Form executes client-side schema validation (`zod`).
3. Frontend dispatches `POST /api/v1/auth/login`.
4. Backend `AuthController.login` checks user existence, compares Argon2 hash, and checks lock status.
5. Backend updates `lastLoginAt`, resets `failedLoginAttempts`, generates JWT token.
6. Frontend receives `{ user, token }`, saves token to `localStorage`, updates `RoleContext`, and redirects to target route.

## Alternative Paths
- **Account Locked**: If `failedLoginAttempts >= 5`, backend returns HTTP 423 with lock duration.
- **Organization Inactive**: If tenant is suspended, returns HTTP 403.

## Validation Rules
- Email must be a valid email format.
- Password cannot be empty.
- Multi-tenancy isolation: User must belong to an active `organizationId`.

## Permissions
Public endpoint (`/api/v1/auth/login`).

## APIs / Backend Dependencies
- `POST /api/v1/auth/login` (`server/src/modules/auth/routes/auth.routes.ts`)
- `AuthService.login` (`server/src/modules/auth/services/auth.service.ts`)
- `User` repository / model (`server/src/modules/auth/models/user.model.ts`)

## Data Dependencies
- Entity: `User` in `users` collection.
- Entity: `Organization` in `organizations` collection.

## Notifications / Integrations
- Emits audit log entry (`event: "USER_LOGIN_SUCCESS"`).

## Failure Scenarios
- Invalid credentials: returns HTTP 401 (`INVALID_CREDENTIALS`).
- Locked user: returns HTTP 423 (`ACCOUNT_LOCKED`).
- Network disconnect: client displays error toast.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- Frontend: `src/pages/Login.tsx`, `src/services/auth.service.ts`.
- Backend: `server/src/modules/auth/controllers/auth.controller.ts`, `server/src/modules/auth/routes/auth.routes.ts`.
- Tests: `server/src/tests/auth.test.ts`.

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/auth.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-AUTH-001.md`
