# Execute Assigned Personal Operational Checklist Tasks

## Journey ID
UJ-ONB-003

## Primary Role
Employee / New Hire (`employee`)

## Business Goal
Enable new hires to view, track, and complete personal onboarding checklist tasks (e.g. "Upload ID photo", "Complete benefits enrollment", "Meet your team").

## Preconditions
1. Employee is authenticated.
2. Tasks assigned to `assignedToUserId == employee.id` exist.

## Trigger
Employee views checklist on `/employee` or navigates to `/tasks`.

## Expected Outcome
1. Renders task items filtered strictly to those assigned to the current employee.
2. Clicking checkbox updates task status to `completed`.
3. Backend updates `statusHistory` and timestamp.
4. If all Phase 2 tasks complete, advances roadmap to Phase 3 (LMS Learning).

## Journey Steps
1. Navigate to `/employee` or `/tasks`.
2. Frontend requests `GET /api/v1/tasks?assignedToMe=true`.
3. Employee reviews pending checklist items.
4. Employee toggles checkbox on a task item.
5. Client sends `PATCH /api/v1/tasks/:id/status` with `{ status: "completed" }`.
6. Backend verifies `assignedToUserId == req.user.id` and updates task.
7. Dashboard updates progress bar and checklist count.

## Alternative Paths
- If an employee attempts to mutate a task assigned to IT or HR, backend returns HTTP 403.

## Validation Rules
- Employees can only update their own personal tasks.

## Permissions
Assigned user (`assignedToUserId == req.user.id`).

## APIs / Backend Dependencies
- `GET /api/v1/tasks`
- `PATCH /api/v1/tasks/:id/status` (`server/src/modules/tasks/routes/task.routes.ts`)

## Data Dependencies
- `Task` model in `tasks` collection.

## Notifications / Integrations
- Emits `TASK_COMPLETED` trigger event.

## Failure Scenarios
- Mutating non-owned task: HTTP 403 Forbidden.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/Tasks.tsx`, `src/pages/EmployeeDashboard.tsx`
- `server/src/modules/tasks/services/task.service.ts`
- Verification in `docs/audits/current/v2-journey-final-validation.md`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase6-tasks.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ONB-003.md`
