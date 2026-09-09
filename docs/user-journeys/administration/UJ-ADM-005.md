# HR Operations Handover Verification & Analytics

## Journey ID
UJ-ADM-005

## Primary Role
HR Administrator / Organization Owner (`admin`, `owner`)

## Business Goal
Provide HR leadership with a command-center view of all ongoing onboarding cohorts, bottlenecks, overdue tasks, and compliance items, and provide authoritative execution of final employee handover to active status.

## Preconditions
1. Authenticated as `admin` or `owner`.
2. Direct report has completed journey requirements, or HR is auditing cohort health.

## Trigger
Admin navigates to `/hr-ops`.

## Expected Outcome
1. Dashboard loads metrics: Total in Onboarding, Overdue Tasks, Incomplete Compliance Documents, Pending Handover Requests.
2. Under "Ready for Handover", admin selects eligible employee and clicks "Verify & Finalize Handover".
3. Backend authoritatively checks that 0 tasks, 0 unsigned compliance documents, 0 incomplete modules, and 0 pending milestones remain.
4. If verified, updates employee status to `ACTIVE`, issues completion certificate, and removes from active onboarding queue.

## Journey Steps
1. Navigate to `/hr-ops` (`src/pages/HROperations.tsx`).
2. Frontend requests `GET /api/v1/hr/dashboard-metrics`.
3. Admin reviews cohort progress and drilldown table.
4. Admin clicks "Complete Handover" on an employee with 100% roadmap completion.
5. Client calls `POST /api/v1/hr/handover/:employeeId`.
6. Backend `HROperationsService.completeHandover` runs authoritative validation:
   - Queries `Task.countDocuments({ employeeId, status: { $ne: 'completed' } })`
   - Queries `DocumentSignature.countDocuments({ employeeId, status: 'pending' })`
   - Queries `Assignment.find({ employeeId })` for incomplete courses
   - Queries `MilestonePlan` for pending manager reviews
7. If any check fails, returns HTTP 400 with exact blocking items.
8. If all pass, sets `User.status = 'active'`, `onboardingState = 'completed'`, issues Certificate.
9. UI renders success confirmation toast.

## Alternative Paths
- If tasks or documents remain incomplete, UI displays warning modal detailing the unfulfilled requirements.

## Validation Rules
- Zero open mandatory onboarding items permitted at handover (`BR-HND-001`).

## Permissions
`requireRole(["owner", "admin"])`.

## APIs / Backend Dependencies
- `GET /api/v1/hr/dashboard-metrics`
- `POST /api/v1/hr/handover/:employeeId` (`server/src/modules/hr/routes/hr.routes.ts`)

## Data Dependencies
- `User`, `Task`, `Assignment`, `DocumentSignature`, `MilestonePlan`, `Certificate`.

## Notifications / Integrations
- Sends Handover Confirmation email and issues digital certificate.

## Failure Scenarios
- Attempting handover while items remain incomplete: Rejected with HTTP 400.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/HROperations.tsx`
- `server/src/modules/hr/services/hr-operations.service.ts`
- Verified in `server/src/tests/phase4-journey-automation.test.ts` and `v2-journey-final-validation.md`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase4-journey-automation.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ADM-005.md`
