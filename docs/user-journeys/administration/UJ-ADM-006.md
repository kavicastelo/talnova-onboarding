# Compliance Document Template Authoring & Tracking

## Journey ID
UJ-ADM-006

## Primary Role
HR Administrator / Organization Owner (`admin`, `owner`)

## Business Goal
Author reusable compliance document templates (NDAs, Employee Handbooks, Security Agreements), configure mandatory signature flags, dispatch them to new hire cohorts, and audit signed verification trails.

## Preconditions
Authenticated as `admin` or `owner`.

## Trigger
Admin navigates to `/documents` and clicks "New Document Template".

## Expected Outcome
1. Document editor opens with rich text formatting and placeholder variables (e.g. `{{employee_name}}`).
2. Admin sets title, description, content body, and marks `isMandatory: true`.
3. Admin saves template and dispatches to an onboarding journey step or employee cohort.
4. Document tracking dashboard shows real-time signed vs pending counts.

## Journey Steps
1. Navigate to `/documents` (`src/pages/Documents.tsx`).
2. Click "Create Document Template".
3. Enter title: "Standard Enterprise NDA 2026".
4. Enter legal text body.
5. Check "Require Signature" and "Mandatory Compliance".
6. Click "Save Template".
7. Frontend calls `POST /api/v1/documents`.
8. Backend saves `DocumentTemplate` in `documenttemplates` collection.
9. Table updates to show active templates, total signatures, and audit log links.

## Alternative Paths
- Admin clicks "View Signatures" to inspect individual cryptographic audit trails (SHA-256 hashes, timestamps, IP addresses).

## Validation Rules
- Title and content body are required.

## Permissions
`requireRole(["owner", "admin"])`.

## APIs / Backend Dependencies
- `GET /api/v1/documents`
- `POST /api/v1/documents`
- `GET /api/v1/documents/:id/signatures`

## Data Dependencies
- `DocumentTemplate`, `DocumentSignature`.

## Notifications / Integrations
None.

## Failure Scenarios
- Invalid template payload: HTTP 400.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/Documents.tsx`
- `server/src/modules/documents/controllers/document.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase10-documents.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ADM-006.md`
