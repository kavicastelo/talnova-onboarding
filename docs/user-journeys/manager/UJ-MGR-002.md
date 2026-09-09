# Evaluate & Approve 30-60-90 Day Milestone Check-ins

## Journey ID
UJ-MGR-002

## Primary Role
Department / Team Manager (`manager`)

## Business Goal
Enable managers to conduct formal 30, 60, and 90 day milestone reviews, evaluate submitted employee self-confidence ratings, enter manager feedback and development goals, and execute formal milestone sign-off.

## Preconditions
1. Authenticated as `manager`.
2. Direct report has submitted their self-evaluation (`UJ-ONB-006`).

## Trigger
Manager receives milestone notification or navigates to `/milestones` and selects pending direct report review.

## Expected Outcome
1. Review form displays employee's submitted self-confidence rating (1–5) and reflection comments.
2. Manager inputs manager performance score, qualitative feedback, and next 30-day goals.
3. Manager clicks "Approve Milestone".
4. Milestone status transitions to `approved`, unlocking downstream journey steps and updating the employee roadmap.

## Journey Steps
1. Navigate to `/milestones` (`src/pages/Milestones.tsx`).
2. Select "Team Reviews" tab.
3. Click "Review" on pending Day 30 milestone for direct report.
4. Review employee's score (e.g. 4/5) and self-reflection notes.
5. Enter Manager Feedback: "Great progress on engineering setup and first PR."
6. Enter Developmental Objectives for Day 60.
7. Click "Approve & Sign Off".
8. Client dispatches `POST /api/v1/milestones/:id/evaluate` with `{ status: "approved", managerFeedback, managerRating: 5 }`.
9. Backend verifies manager authority, updates `MilestonePlan`, records timestamp.
10. System emits `ON_MILESTONE_EVALUATED` event.

## Alternative Paths
- Manager requests revision: Changes status to `revision_requested` with feedback notes.

## Validation Rules
- Only assigned manager or admin can approve milestone.
- Rating must be between 1 and 5.

## Permissions
`requireRole(["owner", "admin", "manager"])`.

## APIs / Backend Dependencies
- `GET /api/v1/milestones/team`
- `POST /api/v1/milestones/:id/evaluate` (`server/src/modules/milestones/routes/milestone.routes.ts`)

## Data Dependencies
- `MilestonePlan` in `milestones` collection.

## Notifications / Integrations
- Sends notification to employee: "Your Day 30 milestone has been approved."

## Failure Scenarios
- Manager attempting to evaluate an employee they do not manage: HTTP 403.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/Milestones.tsx`
- `server/src/modules/milestones/services/milestone.service.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase12-milestones.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-MGR-002.md`
