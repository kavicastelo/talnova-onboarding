# View Onboarding Leaderboard & Badge Recognition

## Journey ID
UJ-OPS-001

## Primary Role
All Roles (Employees, Managers, Admins)

## Business Goal
Motivate new hires and team members through gamification elements, displaying earned points, completion streaks, badge milestones (e.g. "Fast Learner", "Compliance Champion"), and cohort leaderboards.

## Preconditions
User is authenticated.

## Trigger
User clicks "Leaderboard" in the sidebar navigation or navigates to `/leaderboard`.

## Expected Outcome
1. Renders employee's current points, active learning streak (in days), and badge showcase.
2. Displays cohort leaderboard table ranked by points and onboarding velocity.
3. Highlights top performers and recent achievements.

## Journey Steps
1. Navigate to `/leaderboard` (`src/pages/Leaderboard.tsx`).
2. Frontend dispatches:
   - `GET /api/v1/gamification/profile`
   - `GET /api/v1/gamification/leaderboard`
3. Backend retrieves user's points and streak from `GamificationProfile`.
4. Renders user's badge collection with unlocked dates.
5. Leaderboard table displays top 10 cohort members with rank, avatar, and total score.

## Alternative Paths
- Users can view team-specific leaderboards or all-time rankings.

## Validation Rules
- Points and badges cannot be awarded by client; all gamification awards are generated server-side upon verified actions.

## Permissions
All authenticated tenant users.

## APIs / Backend Dependencies
- `GET /api/v1/gamification/profile`
- `GET /api/v1/gamification/leaderboard` (`server/src/modules/gamification/routes/gamification.routes.ts`)

## Data Dependencies
- `GamificationProfile` in `gamificationprofiles` collection.

## Notifications / Integrations
- Confetti toast on unlocking new badges.

## Failure Scenarios
- Uninitialized profile: Auto-created with 0 points on first access.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/Leaderboard.tsx`
- `server/src/modules/gamification/controllers/gamification.controller.ts`
- Tests in `server/src/tests/phase13-gamification.test.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase13-gamification.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-OPS-001.md`
