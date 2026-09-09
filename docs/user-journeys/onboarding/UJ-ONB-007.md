# View & Connect with Assigned Onboarding Buddy

## Journey ID
UJ-ONB-007

## Primary Role
Employee / New Hire (`employee`)

## Business Goal
Provide new hires with direct visibility into their assigned peer buddy, display buddy bio and contact details, and show shared cultural checklist progress and scheduled check-ins.

## Preconditions
1. Employee is authenticated.
2. Manager or Admin has created a `BuddyAssignment` pairing the employee with a buddy.

## Trigger
Employee views the "Your Buddy" widget on `/employee` or navigates to `/buddy`.

## Expected Outcome
1. Displays buddy profile card (photo, name, department, email, bio).
2. Shows mutual onboarding check-in checklist.
3. Provides quick action to message buddy or schedule a 1-on-1 meeting.

## Journey Steps
1. Navigate to `/buddy` or view widget on `/employee`.
2. Frontend calls `GET /api/v1/buddy/my-buddy`.
3. Backend retrieves `BuddyAssignment` and populated buddy `User` profile.
4. UI renders buddy card, mutual checklist items, and logged meeting notes.
5. Employee marks completed peer interaction or clicks "Schedule Check-in".

## Alternative Paths
- If no buddy is paired yet, displays friendly prompt: "Your buddy pairing is currently being assigned by your manager."

## Validation Rules
- Only assigned pair can view mutual check-in notes.

## Permissions
Assigned mentee employee.

## APIs / Backend Dependencies
- `GET /api/v1/buddy/my-buddy` (`server/src/modules/buddy/routes/buddy.routes.ts`)

## Data Dependencies
- `BuddyAssignment`, `BuddyProfile`, `User`.

## Notifications / Integrations
- In-app meeting reminder.

## Failure Scenarios
- Unassigned state handled gracefully without UI crash.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/BuddyProgram.tsx`, `src/pages/EmployeeDashboard.tsx`
- `server/src/modules/buddy/controllers/buddy.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase11-buddy.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ONB-007.md`
