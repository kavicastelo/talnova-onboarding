# Submit Day 30-60-90 Milestone Self-Confidence Evaluation

## Journey ID
UJ-ONB-006

## Primary Role
Employee / New Hire (`employee`)

## Business Goal
Empower new hires to reflect on their integration, role clarity, and satisfaction by submitting structured self-confidence ratings (1–5) and qualitative reflections at Day 30, 60, and 90 milestones.

## Preconditions
1. Employee is authenticated.
2. Milestone plan exists for employee and target window (e.g. Day 30) is reached.

## Trigger
Employee reaches Phase 4 of onboarding or navigates to `/milestones`.

## Expected Outcome
1. Form presents 30-day reflection questions and 1–5 confidence star rating.
2. Employee submits ratings and comments.
3. Backend records submission, sets employee status to `submitted`, and dispatches notification to Manager.
4. Milestone awaits Manager evaluation and sign-off.

## Journey Steps
1. Navigate to `/milestones`.
2. Frontend loads employee milestone records via `GET /api/v1/milestones/me`.
3. Employee fills in self-confidence score (1–5) and developmental goals.
4. Clicks "Submit Milestone Reflection".
5. Client sends `POST /api/v1/milestones/:id/self-evaluation`.
6. Backend records `employeeRating` and timestamp, changes status to `pending_manager_review`.
7. Dashboard updates status card to "Awaiting Manager Sign-off".

## Alternative Paths
- If milestone is already approved, form is rendered read-only with manager feedback.

## Validation Rules
- Rating must be between 1 and 5.
- Milestone must be in active window.

## Permissions
Assigned employee.

## APIs / Backend Dependencies
- `GET /api/v1/milestones/me`
- `POST /api/v1/milestones/:id/self-evaluation` (`server/src/modules/milestones/routes/milestone.routes.ts`)

## Data Dependencies
- `MilestonePlan` in `milestones` collection.

## Notifications / Integrations
- Emits notification to direct report's `managerId`.

## Failure Scenarios
- Invalid rating value: Schema validation rejection (HTTP 400).

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/Milestones.tsx`, `src/pages/EmployeeDashboard.tsx`
- `server/src/modules/milestones/services/milestone.service.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase12-milestones.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ONB-006.md`
