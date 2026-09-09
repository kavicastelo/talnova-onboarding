# Complete Mandatory Compliance Document E-Signature

## Journey ID
UJ-ONB-002

## Primary Role
Employee / New Hire (`employee`)

## Business Goal
Ensure employees review and sign mandatory legal and compliance documents (NDAs, security policies) using an HTML5 canvas signature with cryptographic hashing before unlocking downstream learning stages.

## Preconditions
1. Employee is authenticated.
2. At least one unsigned mandatory document template exists assigned to the employee.

## Trigger
Employee clicks "Sign Document" on `/employee` or navigates to `/documents/:id/sign`.

## Expected Outcome
1. Renders document title, legal text body, and signature canvas.
2. Employee draws signature and clicks "Submit Signature".
3. Canvas serializes SVG/vector data and computes SHA-256 hash.
4. Backend creates `DocumentSignature` record, records IP address and timestamp.
5. System unlocks downstream operational and LMS stages.

## Journey Steps
1. Navigate to `/documents/:id/sign`.
2. Frontend loads document metadata via `GET /api/v1/documents/:id`.
3. User reviews document terms and draws signature in HTML5 canvas.
4. User clicks "Confirm & Sign".
5. Client computes SHA-256 signature hash and calls `POST /api/v1/documents/:id/sign`.
6. Backend verifies employee identity, saves signature record, emits `ON_DOCUMENT_SIGNED`.
7. Frontend displays success toast and redirects back to `/employee`.

## Alternative Paths
- If canvas is empty, client displays validation alert "Signature cannot be blank".

## Validation Rules
- Mandatory compliance documents lock LMS course progression (`BR-SIG-001`).
- Signature must capture vector path, timestamp, and SHA-256 hash.

## Permissions
Assigned employee (`employeeId == req.user.id`).

## APIs / Backend Dependencies
- `GET /api/v1/documents/:id`
- `POST /api/v1/documents/:id/sign` (`server/src/modules/documents/routes/document.routes.ts`)

## Data Dependencies
- `DocumentTemplate`, `DocumentSignature`.

## Notifications / Integrations
- In-app notification and email confirmation.

## Failure Scenarios
- Attempting to bypass: Direct POST to course completion returns HTTP 400 (`COMPLIANCE_DOCUMENTS_PENDING`).

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/DocumentSigner.tsx`
- `server/src/modules/documents/services/document.service.ts`
- Verification in `docs/audits/current/v2-journey-final-validation.md`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase10-documents.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ONB-002.md`
