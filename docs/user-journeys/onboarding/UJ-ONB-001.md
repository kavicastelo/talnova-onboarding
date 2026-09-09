# View Personal Onboarding Roadmap & Active Phase

## Journey ID
UJ-ONB-001

## Primary Role
Employee / New Hire (`employee`)

## Business Goal
Provide new hires with an intuitive, linear, stage-gated roadmap visualizing their entire onboarding journey, current progression percentage, active phase, and upcoming milestones.

## Preconditions
1. Employee account exists and user is authenticated.
2. An active `JourneyInstance` or assigned onboarding resources exist.

## Trigger
User logs in or navigates to `/employee`.

## Expected Outcome
1. Dashboard loads assigned tasks, documents, LMS assignments, and milestones.
2. Correct onboarding phase is highlighted:
   - Phase 0: Curriculum Setup in Progress (if unassigned)
   - Phase 1: Compliance E-Signatures (if pending mandatory documents exist)
   - Phase 2: Operational & IT Setup Tasks (if personal checklist tasks remain open)
   - Phase 3: LMS Learning Modules (active course progression)
   - Phase 4: Buddy & 30-Day Check-in Handover
   - Phase 5: Active Employee Workspace (fully completed)
3. Progress bar accurately reflects real weighted completion.

## Journey Steps
1. Navigate to `/employee`.
2. Frontend queries:
   - `GET /api/v1/assignments/me`
   - `GET /api/v1/documents/pending`
   - `GET /api/v1/tasks?assignedToMe=true`
   - `GET /api/v1/milestones/me`
   - `GET /api/v1/buddy/my-buddy`
3. Client evaluates prerequisite stage states and displays active roadmap phase card.
4. User reviews timeline and selects next available action card.

## Alternative Paths
- Brand new hire with zero assignments renders Phase 0 ("Curriculum Setup in Progress") with 0% complete, preventing false 100% bugs.

## Validation Rules
- `useTasks` must strictly include `{ assignedToMe: true }` so employees only see personal tasks, not organization-wide IT tickets.

## Permissions
`Role: employee`

## APIs / Backend Dependencies
- `GET /api/v1/assignments/me`
- `GET /api/v1/documents/pending`
- `GET /api/v1/tasks`
- `GET /api/v1/milestones/me`
- `GET /api/v1/buddy/my-buddy`

## Data Dependencies
- `JourneyInstance`, `Assignment`, `DocumentSignature`, `Task`, `MilestonePlan`.

## Notifications / Integrations
None.

## Failure Scenarios
- Network failure: Error boundary with retry button.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/EmployeeDashboard.tsx`
- Forensic validation in `docs/audits/current/v2-journey-final-validation.md`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Verified in `server/src/tests/phase4-journey-automation.test.ts` and `v2-journey-final-validation.md`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ONB-001.md`
