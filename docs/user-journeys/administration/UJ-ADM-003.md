# Bulk Import Employees via CSV

## Journey ID
UJ-ADM-003

## Primary Role
HR Administrator / Organization Owner (`admin`, `owner`)

## Business Goal
Accelerate large-scale organizational onboarding by bulk importing new hire records via CSV file upload, validating column mappings, creating user entities, and batch-triggering onboarding workflows.

## Preconditions
1. Authenticated as `admin` or `owner`.
2. Valid CSV file prepared with headers: `fullName,email,department,jobTitle,employmentType,hireDate`.

## Trigger
Admin clicks "Import CSV" on `/directory` and uploads the CSV file.

## Expected Outcome
1. Frontend parses CSV preview and validates columns.
2. Dispatches `POST /api/v1/employees/import`.
3. Backend processes records in a database transaction, reports created count and any skipped duplicates.
4. Emits `ON_USER_CREATED` for each created profile.

## Journey Steps
1. Navigate to `/directory`.
2. Click "Bulk Import" button.
3. Select CSV file.
4. Modal displays preview table with row validation indicators.
5. Click "Execute Import".
6. Frontend calls `POST /api/v1/employees/import` with parsed row data.
7. Backend validates rows against Zod schema, creates valid user records, records duplicate errors.
8. Returns summary `{ imported: N, skipped: M, errors: [] }`.
9. Directory refreshes to display imported employees.

## Alternative Paths
- Malformed rows are reported in an error summary modal while valid rows are successfully imported.

## Validation Rules
- Required headers must be present; invalid email formats are rejected.

## Permissions
`requireRole(["owner", "admin"])`.

## APIs / Backend Dependencies
- `POST /api/v1/employees/import` (`server/src/modules/employees/routes/employee.routes.ts`)

## Data Dependencies
- Batch inserts to `users` collection.

## Notifications / Integrations
- Batch invitation emails dispatched.

## Failure Scenarios
- File exceeds upload size limit: HTTP 413.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/EmployeeDirectory.tsx`
- `server/src/modules/employees/controllers/employee.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/uj-adm-003.test.ts`.
Audit report in `docs/audits/current/user-journeys/UJ-ADM-003.md`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ADM-003.md`
