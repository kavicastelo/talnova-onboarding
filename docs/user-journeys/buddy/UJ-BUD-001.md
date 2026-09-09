# Register Onboarding Buddy Profile & Availability

## Journey ID
UJ-BUD-001

## Primary Role
Onboarding Buddy / Employee (`buddy`, `employee`, `manager`)

## Business Goal
Enable experienced team members to volunteer as peer onboarding buddies, submit their bio, languages, specializations, and set their maximum concurrent mentee capacity.

## Preconditions
1. User is authenticated as an employee or manager in the organization.
2. User wishes to participate in the Buddy Program.

## Trigger
User navigates to `/buddy` and clicks "Register as Buddy" or "Update Buddy Profile".

## Expected Outcome
1. Opens registration form with inputs for Bio, Skills/Specializations, Spoken Languages, and Max Mentees (default: 2).
2. Submitting creates or updates a `BuddyProfile` record in MongoDB.
3. User becomes discoverable in the available buddies list for managers and HR admins.

## Journey Steps
1. Navigate to `/buddy` (`src/pages/BuddyProgram.tsx`).
2. Click "Join Buddy Program".
3. Enter Bio: "Senior frontend engineer passionate about React, accessibility, and coffee."
4. Add Skills: `React`, `TypeScript`, `Team Culture`.
5. Set Capacity: `2`.
6. Click "Save Profile".
7. Client calls `POST /api/v1/buddy/profiles`.
8. Backend saves `BuddyProfile` associated with `userId: req.user.id`.
9. UI shows confirmation banner and active buddy badge.

## Alternative Paths
- Buddy toggles availability off during busy periods (`isActive: false`).

## Validation Rules
- Max mentees must be a positive integer (1–5).

## Permissions
Any authenticated tenant user.

## APIs / Backend Dependencies
- `POST /api/v1/buddy/profiles` (`server/src/modules/buddy/routes/buddy.routes.ts`)

## Data Dependencies
- `BuddyProfile` in `buddyprofiles` collection.

## Notifications / Integrations
None.

## Failure Scenarios
- Invalid capacity number: HTTP 400.

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
`prompts/user-journeys/UJ-BUD-001.md`
