# Approve & Verify Direct Report Tasks

## Journey ID
UJ-MGR-003

## Primary Role
Department / Team Manager (`manager`)

## Business Goal
Review tasks executed by incoming direct reports that require manager verification (e.g. "Complete shadow session with senior engineer", "Submit initial development plan"), inspect attachments or notes, and transition task status to `completed` or `verified`.

## Preconditions
1. Authenticated as `manager`.
2. Direct report has completed a task flagged for manager verification.

## Trigger
Manager accesses `/tasks` (filtered to direct reports) or clicks on pending verification alert.

## Expected Outcome
1. Manager reviews task description, completion timestamp, and notes.
2. Manager clicks "Verify & Approve".
3. Backend updates task status to `verified` (or `completed`), unlocking subsequent journey prerequisites.

## Journey Steps
1. Navigate to `/tasks` (`src/pages/Tasks.tsx`).
2. Toggle filter to "Team Tasks / Direct Reports".
3. Select task: "First Week Code Review Shadowing".
4. Review employee's attached notes.
5. Click "Verify Task".
6. Client sends `PATCH /api/v1/tasks/:id/status` with `{ status: "verified" }`.
7. Backend verifies that current user is the target employee's `managerId` or an admin.
8. Status history appends `changedBy: manager.id`, status: `verified`.
9. Table updates to show green verified badge.

## Alternative Paths
- If work is incomplete, manager adds a comment and sets status back to `in_progress`.

## Validation Rules
- Unauthorized employees cannot verify manager tasks.

## Permissions
`requireRole(["owner", "admin", "manager"])`.

## APIs / Backend Dependencies
- `GET /api/v1/tasks`
- `PATCH /api/v1/tasks/:id/status` (`server/src/modules/tasks/routes/task.routes.ts`)

## Data Dependencies
- `Task` model in `tasks` collection.

## Notifications / Integrations
- Emits task verification event to employee.

## Failure Scenarios
- Non-manager attempting verification: HTTP 403.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/Tasks.tsx`
- `server/src/modules/tasks/services/task.service.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase6-tasks.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-MGR-003.md`
