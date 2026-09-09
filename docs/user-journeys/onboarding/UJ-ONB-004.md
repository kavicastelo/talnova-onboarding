# Complete LMS Course Lessons & Video Verification

## Journey ID
UJ-ONB-004

## Primary Role
Employee / New Hire (`employee`)

## Business Goal
Deliver interactive training modules (rich text, video, audio, PDFs), enforcing mandatory video watch thresholds (>=90%) before granting lesson completion.

## Preconditions
1. Employee has signed all mandatory compliance documents (Phase 1).
2. Course assignment exists (`Assignment` record with `status != 'completed'`).

## Trigger
Employee clicks "Continue Course" or selects a lesson from `/course/:id`.

## Expected Outcome
1. Course viewer loads lesson content blocks.
2. If video lesson, tracks playback time and prevents marking complete until >=90% duration viewed.
3. Upon completion, dispatches `POST /api/v1/assignments/:id/complete-lesson`.
4. Unlocks next lesson or assessment quiz.

## Journey Steps
1. Navigate to `/course/:id`.
2. Frontend loads assignment and course structure via `GET /api/v1/assignments/:id`.
3. Client verifies compliance status: If mandatory unsigned documents exist, redirects to `/employee` with warning banner.
4. User consumes lesson content (e.g. watches training video).
5. Player reaches >=90% playback. "Mark as Complete" button activates.
6. User clicks "Complete Lesson".
7. Client calls `POST /api/v1/assignments/:id/complete-lesson` with `{ lessonId }`.
8. Backend updates `Assignment.completedLessonIds` and advances progress percentage.

## Alternative Paths
- Direct URL access to `/course/:id` with unsigned compliance documents immediately blocks playback and redirects to `/employee`.

## Validation Rules
- Video duration >= 90% required.
- Zero pending compliance documents.

## Permissions
Assigned employee (`employeeId == req.user.id`).

## APIs / Backend Dependencies
- `GET /api/v1/assignments/:id`
- `POST /api/v1/assignments/:id/complete-lesson` (`server/src/modules/assignments/routes/assignment.routes.ts`)

## Data Dependencies
- `Assignment`, `Course`, `Lesson`.

## Notifications / Integrations
- Progress update event emitted.

## Failure Scenarios
- Attempting to complete lesson before signing NDA: Returns HTTP 400 (`COMPLIANCE_DOCUMENTS_PENDING`).

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
`prompts/user-journeys/UJ-ONB-004.md`
