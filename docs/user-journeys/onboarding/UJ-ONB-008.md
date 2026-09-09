# Complete Onboarding Handover & View Completion Certificate

## Journey ID
UJ-ONB-008

## Primary Role
Employee / New Hire (`employee`)

## Business Goal
Finalize the onboarding lifecycle upon completion of all journey prerequisites and manager/HR approvals, issue a tamper-evident digital Completion Certificate with QR code verification, and transition employee status to `ACTIVE`.

## Preconditions
1. All journey tasks, courses, and compliance documents are completed.
2. Manager has approved Day 30 milestone evaluation.
3. HR Administrator has verified handover (`UJ-ADM-005`).

## Trigger
Employee visits `/employee` upon achieving 100% roadmap completion, or navigates to `/certificates`.

## Expected Outcome
1. Dashboard transitions from Onboarding Mode to Phase 5: "Active Employee Workspace".
2. Certificate card renders congratulations banner with options to "View Certificate" and "Download PDF".
3. Employee certificate displays unique Certificate ID, issue date, issuer signature, and QR code linking to public verification page (`/public/certificate/:id`).

## Journey Steps
1. Navigate to `/employee`.
2. System evaluates `isOnboardingFullyCompleted == true`.
3. UI renders congratulations banner: "Onboarding Completed! Welcome to Talnova."
4. Employee clicks "View My Certificate" or navigates to `/certificates`.
5. Frontend requests `GET /api/v1/certificates/me`.
6. Renders high-fidelity certificate preview with printable stylesheet and public verification link.
7. Employee copies link or prints certificate.

## Alternative Paths
- If handover has not been validated by HR, dashboard remains in Phase 4 awaiting HR final sign-off.

## Validation Rules
- Handover cannot complete if any mandatory tasks or compliance documents are open (`BR-HND-001`).

## Permissions
Assigned employee.

## APIs / Backend Dependencies
- `GET /api/v1/certificates/me`
- `GET /api/v1/assignments/public/verify/:id` (`server/src/modules/assignments/routes/assignment.routes.ts`)

## Data Dependencies
- `Certificate`, `Assignment`, `User.status`.

## Notifications / Integrations
- Organization-wide celebration event emitted.

## Failure Scenarios
- Attempting to issue certificate before completing all items: Returns HTTP 400.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/Certificates.tsx`, `src/pages/EmployeeDashboard.tsx`
- `server/src/modules/hr/services/hr-operations.service.ts`
- Verification in `docs/audits/current/v2-journey-final-validation.md`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase4-journey-automation.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ONB-008.md`
