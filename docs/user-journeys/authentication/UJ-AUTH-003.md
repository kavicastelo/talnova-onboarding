# User Self-Registration

## Journey ID
UJ-AUTH-003

## Primary Role
Public / Unauthenticated User

## Business Goal
Allow new organization owners or invited users to self-register an organization workspace and initial administrator account.

## Preconditions
User is unauthenticated on `/register`.

## Trigger
User fills out organization name, admin name, email, and password on `/register` and submits.

## Expected Outcome
1. Backend creates new `Organization` tenant record.
2. Backend creates root `User` record with role `owner`.
3. System emits `ON_ORGANIZATION_CREATED` event.
4. Auto-authenticates and issues JWT token, landing on Admin Dashboard.

## Journey Steps
1. User navigates to `/register`.
2. User submits registration form (`Register.tsx`).
3. Frontend calls `POST /api/v1/auth/register`.
4. Backend creates Organization and User with `owner` permissions.
5. Returns `{ user, token }`.
6. Redirects to `/`.

## Alternative Paths
- If email is already registered, returns HTTP 409 (`EMAIL_ALREADY_EXISTS`).

## Validation Rules
- Strong password enforcement (min 8 chars, numbers, uppercase).
- Valid email format and unique email check.

## Permissions
Public.

## APIs / Backend Dependencies
- `POST /api/v1/auth/register` (`server/src/modules/auth/routes/auth.routes.ts`)

## Data Dependencies
- Creates: `Organization`, `User`.

## Notifications / Integrations
- Audit log: `ORGANIZATION_REGISTERED`.

## Failure Scenarios
- Duplicate email: Returns HTTP 409.
- Invalid input: Returns HTTP 400 with field errors.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- Frontend: `src/pages/Register.tsx`, `src/services/auth.service.ts`
- Backend: `server/src/modules/auth/controllers/auth.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/auth.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-AUTH-003.md`
