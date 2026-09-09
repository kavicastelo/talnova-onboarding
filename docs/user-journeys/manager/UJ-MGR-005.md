# Assign Onboarding Buddy to New Hire

## Journey ID
UJ-MGR-005

## Primary Role
Department / Team Manager / HR Administrator (`manager`, `admin`, `owner`)

## Business Goal
Match an incoming new hire with an experienced peer buddy based on department, skills, and current mentee capacity, creating a formal mentorship pairing.

## Preconditions
1. Authenticated as `manager` or `admin`.
2. Available registered buddy profiles exist (`GET /api/v1/buddy/available`).

## Trigger
Manager accesses `/buddy` and clicks "Match Buddy" or "Assign Buddy".

## Expected Outcome
1. Displays list of available buddies with current load, department, and bio.
2. Manager selects buddy and direct report mentee, chooses a checklist template, and submits pairing.
3. Backend creates `BuddyAssignment`, notifies buddy and mentee, and links peer widget on both dashboards.

## Journey Steps
1. Navigate to `/buddy` (`src/pages/BuddyProgram.tsx`).
2. Click "Assign New Buddy".
3. Select Mentee (new hire direct report).
4. Select Buddy from available candidates.
5. Select checklist template (e.g. "General Engineering Cultural Onboarding").
6. Click "Confirm Pairing".
7. Client dispatches `POST /api/v1/buddy/assign` with `{ buddyId, employeeId, templateId }`.
8. Backend verifies buddy availability, creates `BuddyAssignment`, seeds checklist items.
9. UI displays active pairing card with 0% peer check-in progress.

## Alternative Paths
- If buddy is already at maximum capacity (3 mentees), system flags a warning but allows manager override if necessary.

## Validation Rules
- Mentee cannot be paired with themselves.
- Both users must belong to the same organization.

## Permissions
`requireRole(["owner", "admin", "manager"])`.

## APIs / Backend Dependencies
- `GET /api/v1/buddy/available`
- `POST /api/v1/buddy/assign` (`server/src/modules/buddy/routes/buddy.routes.ts`)

## Data Dependencies
- `BuddyProfile`, `BuddyAssignment`, `User`.

## Notifications / Integrations
- Informs both buddy and new hire via in-app notification.

## Failure Scenarios
- Invalid user IDs: HTTP 400.

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
`prompts/user-journeys/UJ-MGR-005.md`
