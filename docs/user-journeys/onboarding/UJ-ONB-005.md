# Take LMS Assessment Quiz & Progress Gating

## Journey ID
UJ-ONB-005

## Primary Role
Employee / New Hire (`employee`)

## Business Goal
Evaluate employee understanding of training materials through interactive quizzes, enforcing passing score thresholds (default: 80%) before advancing journey milestones.

## Preconditions
1. All prerequisite lessons in the course module completed.
2. Unsigned compliance documents == 0.

## Trigger
Employee clicks "Take Quiz" on the final lesson of a module in `/course/:id`.

## Expected Outcome
1. Renders quiz questions with multiple choice / true-false options.
2. Employee selects answers and clicks "Submit Quiz".
3. Backend scores answers against answer key.
4. If score >= passing score: marks quiz passed, updates assignment progress, unlocks next module or Phase 4.
5. If score < passing score: displays score and allows retry if attempts remain.

## Journey Steps
1. Navigate to quiz view in `/course/:id`.
2. Employee answers each question.
3. Employee clicks "Submit Assessment".
4. Client dispatches `POST /api/v1/assignments/:id/submit-quiz` with answers array.
5. Backend verifies compliance documents signed, grades quiz answers, records attempt.
6. Backend returns score, passing status, and updated assignment completion rate.
7. Frontend displays congratulations screen or retry prompt.

## Alternative Paths
- Max attempts exceeded: Notifies manager and locks step until reviewed.

## Validation Rules
- Score >= passing score threshold.
- Compliance hard gate verified on server.

## Permissions
Assigned employee.

## APIs / Backend Dependencies
- `POST /api/v1/assignments/:id/submit-quiz` (`server/src/modules/assignments/routes/assignment.routes.ts`)

## Data Dependencies
- `Assignment`, `Quiz`, `QuizAttempt`.

## Notifications / Integrations
- Manager notification if quiz failed.
- Gamification points awarded on passing.

## Failure Scenarios
- Submitting quiz with pending compliance documents: HTTP 400 error.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/CourseViewer.tsx`
- `server/src/modules/assignments/services/assignment.service.ts`
- Verification in `docs/audits/current/v2-journey-final-validation.md`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase4-journey-automation.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ONB-005.md`
