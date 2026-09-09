# Employee Directory Management & Invite New Hire

## Journey ID
UJ-ADM-002

## Primary Role
HR Administrator / Organization Owner (`admin`, `owner`)

## Business Goal
Manage the centralized employee directory, invite incoming hires with rich onboarding metadata (department, role, location, hire date, manager ID), and initiate automated onboarding workflow rules.

## Preconditions
1. Authenticated as `admin` or `owner`.
2. Target manager and department exist in the workspace.

## Trigger
Admin navigates to `/directory` and clicks "Invite Employee".

## Expected Outcome
1. Opens invitation modal with metadata inputs.
2. Submitting creates a canonical `User` record (`status: "invited"`, `onboardingState: "not_started"`).
3. System emits `ON_USER_CREATED` trigger event.
4. Workflow automation engine evaluates matching rules and assigns the appropriate `JourneyTemplate`.
5. Invitation email with activation token is dispatched to the new hire.

## Journey Steps
1. Navigate to `/directory`.
2. Click "Invite Employee" button (`src/pages/EmployeeDirectory.tsx`).
3. Enter Full Name, Email, Department, Job Title, Hire Date, Employment Type, and select Manager.
4. Click "Send Invitation".
5. Client calls `POST /api/v1/employees/invite`.
6. Backend `EmployeeService.inviteEmployee` creates `User` in `users` collection.
7. Backend emits `ON_USER_CREATED` event into event bus.
8. Background workflow engine resolves matching `WorkflowRule` and instantiates `JourneyInstance`.
9. Directory updates with newly invited employee row.

## Alternative Paths
- If invited email already exists in organization, returns HTTP 409 (`USER_ALREADY_EXISTS`).

## Validation Rules
- Email format valid, hireDate in valid date format.
- Multi-tenancy isolation: User created strictly inside `context.organizationId`.

## Permissions
`requireRole(["owner", "admin"])`.

## APIs / Backend Dependencies
- `POST /api/v1/employees/invite` (`server/src/modules/employees/routes/employee.routes.ts`)
- `GET /api/v1/employees`

## Data Dependencies
- `User` in `users` collection (Canonical model; zero duplicate collections).

## Notifications / Integrations
- Sends welcome invitation email with activation link.

## Failure Scenarios
- Missing required fields: Zod schema validation error (HTTP 400).

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/EmployeeDirectory.tsx`, `src/services/employee.service.ts`
- `server/src/modules/employees/services/employee.service.ts`
- Verified in `server/src/tests/canonical-model-integrity.test.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/canonical-model-integrity.test.ts` and `phase1-core-onboarding.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ADM-002.md`
