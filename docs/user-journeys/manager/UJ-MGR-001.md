# Direct Report Onboarding Progress Monitoring

## Journey ID
UJ-MGR-001

## Primary Role
Department / Team Manager (`manager`)

## Business Goal
Provide people managers with a focused team operations dashboard to supervise their incoming direct reports, track roadmap progress percentages, identify blocked or overdue tasks, and review quiz performance.

## Preconditions
1. Authenticated as `manager`.
2. Direct report employees exist where `managerId == manager.id`.

## Trigger
Manager navigates to `/manager`.

## Expected Outcome
1. Dashboard loads direct report roster.
2. For each direct report, displays: Full Name, Job Title, Hire Date, Roadmap Completion %, Current Stage, Overdue Tasks Alert count, and Next Due Milestone.
3. Manager can drill down into any direct report's profile to inspect individual item progress.

## Journey Steps
1. Navigate to `/manager` (`src/pages/ManagerDashboard.tsx`).
2. Frontend calls `GET /api/v1/manager/team-overview`.
3. Backend filters employees where `managerId == req.user.id` within the tenant.
4. UI renders team summary cards (Total Direct Reports, Avg Progress, Tasks Needing Review, Milestones Due).
5. Manager clicks on a direct report row to inspect details.
6. Expanded view shows completed vs open checklist items and quiz scores.

## Alternative Paths
- If manager has 0 direct reports, displays informative empty state: "No active direct reports currently onboarding."

## Validation Rules
- Managers cannot view employees assigned to other managers.

## Permissions
`requireRole(["owner", "admin", "manager"])` with `view_team_ops` capability.

## APIs / Backend Dependencies
- `GET /api/v1/manager/team-overview` (`server/src/modules/manager/routes/manager.routes.ts`)

## Data Dependencies
- `User` (`managerId`), `Assignment`, `Task`.

## Notifications / Integrations
None.

## Failure Scenarios
- Scoping leak: Manager must never receive non-direct report profiles.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/ManagerDashboard.tsx`
- `server/src/modules/manager/controllers/manager.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase7-manager.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-MGR-001.md`
