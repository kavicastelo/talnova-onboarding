# IT Hardware Provisioning Workflow

## Journey ID
UJ-IT-001

## Primary Role
IT Administrator / Operations Task Assignee (`it_admin` persona)

## Business Goal
Fulfill operational IT setup tasks dispatched during new hire onboarding (ordering laptops, configuring corporate emails, granting SSO tool access, issuing security badges), attach hardware serial numbers or asset tags, and verify stage completion.

## Preconditions
1. Employee onboarding trigger has dispatched IT operational tasks (`category: "it_setup"`).
2. User assigned to the IT task is authenticated.

## Trigger
IT operator accesses `/tasks` or clicks on task assignment link.

## Expected Outcome
1. IT task displays target employee name, hire date, hardware requirements, and category `it_setup`.
2. IT operator provisions laptop, records serial number in task comment or description, and marks status `completed` or `verified`.
3. System updates task status and unblocks onboarding lifecycle progression.

## Journey Steps
1. User navigates to `/tasks` (`src/pages/Tasks.tsx`).
2. Filters by Category: `it_setup`.
3. Selects task: "Order Corporate Laptop & Provision Email Account" for new hire.
4. Adds comment: "MacBook Pro M3 Max ordered. Asset Tag #TAL-9941. Serial #C02G..."
5. Toggles status to `completed` or `verified`.
6. Client dispatches `PATCH /api/v1/tasks/:id/status` with `{ status: "completed" }`.
7. Backend verifies `assignedToUserId == req.user.id` or user is admin.
8. Status history updates and task completes.

## Alternative Paths
- If hardware is delayed, operator sets priority to `high` and posts a comment alerting the hiring manager.

## Validation Rules
- Only assigned IT user or administrator can update the task status.

## Permissions
Assigned user (`assignedToUserId == req.user.id`) or `admin`.

## APIs / Backend Dependencies
- `GET /api/v1/tasks`
- `PATCH /api/v1/tasks/:id/status` (`server/src/modules/tasks/routes/task.routes.ts`)

## Data Dependencies
- `Task` with `category: "it_setup"`.

## Notifications / Integrations
- Dispatches hardware dispatch confirmation notification to new hire.

## Failure Scenarios
- Regular employee attempting to complete IT task: Rejected with HTTP 403.

## Current Implementation

### Status
`PARTIALLY_IMPLEMENTED`

### Evidence
- `src/pages/Tasks.tsx`
- `server/src/modules/tasks/services/task.service.ts`
- Discrepancy documented in `docs/product/02-actors-and-roles.md` vs `server/src/modules/auth/models/user.model.ts`

### Missing Pieces
- `it_admin` is documented as a distinct system persona in `docs/product/02-actors-and-roles.md` §1.7 and `docs/product/05-user-journeys.md` §UJ-04 with dedicated queue views and attachment verification flows. In code, IT setup is implemented as a general task category (`category: "it_setup"`) inside `/tasks` rather than a dedicated IT portal or dedicated RBAC role enum.

### Known Issues
- Lacks a dedicated `/it-ops` portal view and specialized hardware asset management tables.

## Test Coverage
Automated in `server/src/tests/phase6-tasks.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-IT-001.md`
