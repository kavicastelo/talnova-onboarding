# Workflow Automation Rule Configuration

## Journey ID
UJ-ADM-004

## Primary Role
HR Administrator / Organization Owner (`admin`, `owner`)

## Business Goal
Empower HR administrators to configure intelligent event-driven workflow rules that automatically evaluate triggers (`ON_USER_CREATED`, `ON_STEP_COMPLETED`, `ON_DATE_MILESTONE`) against employee metadata to dynamically assign journey templates, dispatch tasks, or schedule calendar meetings.

## Preconditions
1. Authenticated as `admin` or `owner`.
2. Target `JourneyTemplate` exists to assign.

## Trigger
Admin navigates to `/workflows` and clicks "New Workflow Rule".

## Expected Outcome
1. Visual rule editor opens.
2. Admin configures Rule Title (e.g. "Assign Engineering Journey"), Trigger (`ON_USER_CREATED`), Conditions (`department == 'Engineering'`), and Action (`ASSIGN_JOURNEY: Engineering Onboarding v2`).
3. Rule is activated (`isActive: true`).
4. Future matching employee creations automatically receive the assigned journey template without manual HR intervention.

## Journey Steps
1. Navigate to `/workflows`.
2. Click "Create Rule" (`src/pages/Workflows.tsx`).
3. Set Title: "Assign Sales Onboarding".
4. Select Trigger: `ON_USER_CREATED`.
5. Add Condition: Field: `department`, Operator: `equals`, Value: `Sales`.
6. Add Action: Type: `ASSIGN_JOURNEY`, Target Template: `Sales Onboarding 2026`.
7. Set Priority Index: `10`.
8. Click "Save & Activate".
9. Frontend sends `POST /api/v1/workflows/rules`.
10. Backend saves `WorkflowRule` in `workflowrules` collection.

## Alternative Paths
- Admin toggles active switch off to temporarily pause an automated rule (`PATCH /api/v1/workflows/rules/:id`).
- Fallback default: If no rule matches a new hire, the system automatically assigns the workspace default template (`isDefault == true`).

## Validation Rules
- Condition must have valid field, operator, and value.
- Target template ID must exist and be published.

## Permissions
`requireRole(["owner", "admin"])`.

## APIs / Backend Dependencies
- `GET /api/v1/workflows/rules`
- `POST /api/v1/workflows/rules`
- `PATCH /api/v1/workflows/rules/:id`
- `WorkflowEngine` (`server/src/modules/workflows/services/workflow.service.ts`)

## Data Dependencies
- `WorkflowRule`, `JourneyTemplate`.

## Notifications / Integrations
- Execution audit logs.

## Failure Scenarios
- Missing action target: HTTP 400 error.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/Workflows.tsx`
- `server/src/modules/workflows/controllers/workflow.controller.ts`
- Tests in `server/src/tests/phase4-journey-automation.test.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase4-journey-automation.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ADM-004.md`
