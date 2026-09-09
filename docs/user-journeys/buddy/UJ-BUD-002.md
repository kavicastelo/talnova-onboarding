# Review Mentee Progress & Cultural Checklist Tasks

## Journey ID
UJ-BUD-002

## Primary Role
Onboarding Buddy (`buddy`)

## Business Goal
Allow peer buddies to track their assigned mentees' progress, review shared cultural onboarding checklists (e.g. "Take mentee for coffee", "Introduce to team slack channels", "Explain sprint ritual acronyms"), and mark completed buddy actions.

## Preconditions
1. User has an active `BuddyAssignment` as buddy.
2. User is authenticated.

## Trigger
Buddy navigates to `/buddy` and opens the "My Mentees" tab.

## Expected Outcome
1. Displays active mentees list with progress indicators.
2. Selecting a mentee displays mutual checklist items.
3. Toggling a task updates the shared checklist in real-time.

## Journey Steps
1. Navigate to `/buddy` (`src/pages/BuddyProgram.tsx`).
2. Select "My Mentees" tab.
3. Client dispatches `GET /api/v1/buddy/my-mentees`.
4. Renders mentee card showing name, role, department, and checklist completion %.
5. Buddy checks item: "Conduct informal Week 1 tea/coffee chat".
6. Frontend calls `PUT /api/v1/buddy/assignment/:id/checklist` with `{ taskId, completed: true }`.
7. Backend updates `BuddyAssignment.checklist` and recalculates percentage.
8. Checklist progress updates immediately on screen.

## Alternative Paths
- Buddy can add a custom ad-hoc checklist task specific to their team's culture.

## Validation Rules
- Only assigned buddy or mentee can update checklist tasks.

## Permissions
Assigned buddy or admin.

## APIs / Backend Dependencies
- `GET /api/v1/buddy/my-mentees`
- `PUT /api/v1/buddy/assignment/:id/checklist` (`server/src/modules/buddy/routes/buddy.routes.ts`)

## Data Dependencies
- `BuddyAssignment` in `buddyassignments` collection.

## Notifications / Integrations
None.

## Failure Scenarios
- Attempting to modify non-assigned mentee: HTTP 403.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/BuddyProgram.tsx`
- `server/src/modules/buddy/controllers/buddy.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase11-buddy.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-BUD-002.md`
