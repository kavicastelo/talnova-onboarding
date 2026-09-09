# Standalone Task Template Creation & Assignment

## Journey ID
UJ-ADM-007

## Primary Role
HR Administrator / Manager / Owner (`admin`, `manager`, `owner`)

## Business Goal
Create operational checklist tasks across cross-role categories (`it_setup`, `hr_paperwork`, `equipment`, `training`, `general`) with relative offsets (`hire_date + N days`) and assign them to specific employees, managers, or IT operators.

## Preconditions
Authenticated with `create_task_template` capability (`admin`, `owner`, or `manager`).

## Trigger
User navigates to `/tasks` and clicks "New Task".

## Expected Outcome
1. Task creation modal displays fields: Title, Description, Category, Target Employee, Assignee, Stage, Due Date, and Priority.
2. Task is created in MongoDB with initial status `pending`.
3. Dispatches notification to assignee.

## Journey Steps
1. Navigate to `/tasks` (`src/pages/Tasks.tsx`).
2. Click "Add Task" button.
3. Select Category: `it_setup`.
4. Title: "Configure Corporate Laptop & VPN Access".
5. Target Employee: Select new hire.
6. Assign To: Select IT personnel or self.
7. Set Priority: `High`.
8. Click "Create Task".
9. Frontend sends `POST /api/v1/tasks`.
10. Backend verifies tenant isolation, validates schema, persists `Task` document.
11. Tasks table updates with new item.

## Alternative Paths
- Admin sets relative offset days (e.g. `-3` days before hire date for IT provisioning).

## Validation Rules
- `assignedToUserId` must be a valid user in the same tenant.

## Permissions
`requireRole(["owner", "admin", "manager"])`.

## APIs / Backend Dependencies
- `GET /api/v1/tasks`
- `POST /api/v1/tasks` (`server/src/modules/tasks/routes/task.routes.ts`)

## Data Dependencies
- `Task` model in `tasks` collection.

## Notifications / Integrations
- Sends task assignment notification to assignee.

## Failure Scenarios
- Invalid assignee or missing title: HTTP 400.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/Tasks.tsx`
- `server/src/modules/tasks/services/task.service.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase6-tasks.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ADM-007.md`
