# Public Certificate Verification via QR / URL

## Journey ID
UJ-OPS-003

## Primary Role
Public / External Verifier (Recruiters, Auditors, External Partners)

## Business Goal
Allow external third parties (or mobile scanners) to verify the authenticity and validity of an onboarding Completion Certificate by scanning its QR code or visiting its public URL without requiring platform login credentials.

## Preconditions
A valid `Certificate` has been issued to an employee upon onboarding completion (`UJ-ONB-008`).

## Trigger
Third party scans certificate QR code or visits `/public/certificate/:id`.

## Expected Outcome
1. Public page loads without redirecting to `/login`.
2. Backend verifies certificate ID and returns public metadata (Recipient Name, Issue Date, Organization Name, Verification Status, Certificate Hash).
3. Renders high-trust verification badge ("Verified Authentic Certificate").

## Journey Steps
1. User navigates to `/public/certificate/:id` (`src/pages/PublicCertificateViewer.tsx`).
2. Frontend calls `GET /api/v1/assignments/public/verify/:id`.
3. Backend retrieves certificate record, checks revocation status, strips sensitive internal PII.
4. Returns `{ verified: true, recipient: "Jane Doe", issueDate: "2026-09-01", organization: "Acme Corp", credentialId: "CERT-9482-A" }`.
5. UI displays green authenticated seal and verification timestamp.

## Alternative Paths
- If certificate ID is invalid or revoked, renders red alert: "Invalid or Revoked Credential".

## Validation Rules
- Never expose internal database IDs, passwords, or employee compensation/PII on public endpoint.

## Permissions
Public (Unauthenticated).

## APIs / Backend Dependencies
- `GET /api/v1/assignments/public/verify/:id` (`server/src/modules/assignments/routes/assignment.routes.ts`)

## Data Dependencies
- `Certificate` in `certificates` collection.

## Notifications / Integrations
None.

## Failure Scenarios
- Invalid certificate ID: HTTP 404 with friendly error screen.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/PublicCertificateViewer.tsx`
- `server/src/modules/assignments/controllers/assignment.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase4-journey-automation.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-OPS-003.md`
