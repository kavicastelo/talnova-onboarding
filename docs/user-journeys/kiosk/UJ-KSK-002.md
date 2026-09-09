# Launch Touch-First Unauthenticated Kiosk Journey Player

## Journey ID
UJ-KSK-002

## Primary Role
Frontline Worker / Kiosk Terminal (`kiosk_operator`)

## Business Goal
Provide factory, warehouse, and field staff with an unauthenticated, touch-optimized visual player interface accessible via HMAC-SHA256 signed URLs or paired terminal displays for rapid SOP playback without requiring personal account logins.

## Preconditions
1. Kiosk journey published by administrator.
2. Valid signed URL with `sig`, `exp`, and `o` (organizationId) query parameters.

## Trigger
Operator opens kiosk signed link or terminal boots to `/kiosk/play/:id?sig=...`.

## Expected Outcome
1. Backend validates HMAC-SHA256 URL signature and expiration.
2. Frontend launches high-contrast touch player with oversized navigation touch targets (>=64px).
3. If PIN protection is enabled, displays 4-digit PIN entry keypad.
4. Player loads video slides, audio walkthroughs, and safety instructions.

## Journey Steps
1. Touch display opens `/kiosk/play/:id?o=...&exp=...&sig=...`.
2. Frontend calls `GET /api/v1/kiosk/journeys/play/:id?o=...&exp=...&sig=...`.
3. Fastify preHandler `verifySignedUrl` computes HMAC-SHA256 hash using tenant kiosk secret key and compares with `sig`.
4. If signature matches and `exp > Date.now()`, returns kiosk journey content.
5. If journey requires PIN, keypad is shown (`src/features/kiosk`).
6. Worker enters 4-digit PIN; frontend calls `POST /api/v1/kiosk/journeys/:id/auth/pin`.
7. Player transitions to Step 1 video instructions.

## Alternative Paths
- Tampered or expired URL signature returns HTTP 403 / 401 with access denied screen.

## Validation Rules
- Signature must be authentic and unexpired.
- Touch UI elements must meet frontline contrast and touch target standards.

## Permissions
Signed URL verification (`verifySignedUrl`).

## APIs / Backend Dependencies
- `GET /api/v1/kiosk/journeys/play/:id`
- `POST /api/v1/kiosk/journeys/:id/auth/pin` (`server/src/modules/kiosk/routes/kiosk.routes.ts`)

## Data Dependencies
- `KioskJourney` in `kioskjourneys` collection.

## Notifications / Integrations
None.

## Failure Scenarios
- Expired signed URL: Displays "Session Expired. Please scan fresh QR code."

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/features/kiosk/` (`KioskPlayerPage.tsx`)
- `server/src/modules/kiosk/plugins/kiosk-auth.plugin.ts`
- Tests in `server/src/tests/phase14-kiosk.test.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase14-kiosk.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-KSK-002.md`
