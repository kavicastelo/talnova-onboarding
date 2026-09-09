# Password Reset & Recovery

## Journey ID
UJ-AUTH-004

## Primary Role
All Roles

## Business Goal
Provide a secure mechanism for users who forgot their credentials to request a time-limited reset token via email and set a new password.

## Preconditions
User has an existing account registered with a valid email.

## Trigger
User clicks "Forgot Password?" on `/login`, enters email, and clicks "Send Reset Link".

## Expected Outcome
1. System generates a secure cryptographic token with expiration (1 hour).
2. Sends reset email containing reset URL.
3. User navigates to reset link, submits new password, and token is consumed.

## Journey Steps
1. User enters email in `src/pages/ForgotPassword.tsx`.
2. Frontend dispatches `POST /api/v1/auth/forgot-password`.
3. Backend checks email; if found, stores hashed reset token and expiration on User record.
4. Returns generic success message (to prevent email enumeration).
5. User enters new password with token; backend updates password hash and clears token.

## Alternative Paths
- If token has expired, returns HTTP 400 (`TOKEN_EXPIRED`).

## Validation Rules
- Never expose whether an email exists or not in response message.

## Permissions
Public.

## APIs / Backend Dependencies
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

## Data Dependencies
- `User.security.passwordResetToken`, `passwordResetExpires`.

## Notifications / Integrations
- Email dispatch via Nodemailer service.

## Failure Scenarios
- Invalid or expired reset token.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/ForgotPassword.tsx`
- `server/src/modules/auth/controllers/auth.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/auth.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-AUTH-004.md`
