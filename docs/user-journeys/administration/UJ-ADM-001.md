# Author & Manage Journey Templates

## Journey ID
UJ-ADM-001

## Primary Role
HR Administrator / Organization Owner (`admin`, `owner`)

## Business Goal
Create, configure, update, duplicate, and publish reusable journey templates defining structured steps, courses, tasks, and prerequisite dependencies for department-specific onboarding.

## Preconditions
1. Authenticated as `admin` or `owner`.
2. Target department and tenant workspace exist.

## Trigger
Admin navigates to `/journeys` and clicks "Create Journey" or edits an existing template (`/journeys/:id`).

## Expected Outcome
1. Opens interactive visual Journey Builder.
2. Admin configures title, description, department, target role, and estimated duration.
3. Admin adds ordered steps, embeds LMS courses, links compliance documents, and assigns prerequisite step locks.
4. Admin saves and publishes the template (`status: "published"`).

## Journey Steps
1. Navigate to `/journeys`.
2. Admin clicks "Create Template" button.
3. Journey Builder opens (`src/pages/JourneyBuilder.tsx`).
4. Admin inputs basic metadata (Title: "Engineering Onboarding v2", Department: "Engineering").
5. Admin adds Step 1: "Security & Compliance NDA" (Links Document Template).
6. Admin adds Step 2: "Engineering Security 101" (Sets `prerequisiteStepId: Step 1`).
7. Admin clicks "Publish Journey".
8. Client dispatches `POST /api/v1/journeys` then `POST /api/v1/journeys/:id/publish`.
9. Backend creates template in MongoDB and sets `status = "published"`.
10. UI updates status badge to Published.

## Alternative Paths
- Admin clicks "Duplicate" on `/journeys` to clone an existing template for another department (`POST /api/v1/journeys/:id/duplicate`).
- Admin archives outdated template (`POST /api/v1/journeys/:id/archive`).

## Validation Rules
- Title cannot be empty.
- Prerequisite steps cannot create circular dependency loops.

## Permissions
`requireRole(["owner", "admin"])`.

## APIs / Backend Dependencies
- `GET /api/v1/journeys`
- `POST /api/v1/journeys`
- `PATCH /api/v1/journeys/:id`
- `POST /api/v1/journeys/:id/publish`
- `POST /api/v1/journeys/:id/duplicate`

## Data Dependencies
- `JourneyTemplate` in `journeytemplates` collection.

## Notifications / Integrations
- Emits `JOURNEY_TEMPLATE_PUBLISHED` trigger event.

## Failure Scenarios
- Circular prerequisite step IDs: Validation rejection.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/JourneysList.tsx`, `src/pages/JourneyBuilder.tsx`
- `server/src/modules/journeys/controllers/journey.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase4-journey-automation.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ADM-001.md`
