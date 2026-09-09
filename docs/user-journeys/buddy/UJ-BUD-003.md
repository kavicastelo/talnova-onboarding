# Log Informal Buddy Check-in Feedback & Sentiment

## Journey ID
UJ-BUD-003

## Primary Role
Onboarding Buddy (`buddy`)

## Business Goal
Provide buddies with a confidential and supportive mechanism to record notes from informal 1-on-1 chats, log mentee sentiment ratings (positive, neutral, needs support), and flag early cultural or onboarding risks to managers.

## Preconditions
User has an active `BuddyAssignment` for the selected mentee.

## Trigger
Buddy clicks "Log Check-in" from `/buddy` after holding a peer meeting.

## Expected Outcome
1. Check-in dialog displays Date, Topics Discussed, Mentee Sentiment (Positive, Neutral, Challenged), and Private Notes.
2. Saving appends a check-in record to the assignment.
3. If flagged as "Needs Support", optionally alerts manager or HR.

## Journey Steps
1. Navigate to `/buddy` (`src/pages/BuddyProgram.tsx`).
2. Click "Log Check-in" on mentee card.
3. Enter Meeting Date and Notes: "Mentee feels confident with dev environment; had questions about sprint pointing."
4. Select Sentiment: `positive`.
5. Click "Submit Check-in Log".
6. Client calls `POST /api/v1/buddy/assignment/:id/checkin`.
7. Backend appends check-in entry to `BuddyAssignment.checkins` array.
8. Recent check-in timeline updates on the mentee card.

## Alternative Paths
- If sentiment is "Challenged", buddy checks "Share with Manager" to surface in manager check-in alerts.

## Validation Rules
- Notes cannot be empty; sentiment must be one of allowed enum values.

## Permissions
Assigned buddy or admin.

## APIs / Backend Dependencies
- `POST /api/v1/buddy/assignment/:id/checkin` (`server/src/modules/buddy/routes/buddy.routes.ts`)

## Data Dependencies
- `BuddyAssignment.checkins`.

## Notifications / Integrations
- Dispatches alert if support requested.

## Failure Scenarios
- Invalid assignment ID: HTTP 404.

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
`prompts/user-journeys/UJ-BUD-003.md`
