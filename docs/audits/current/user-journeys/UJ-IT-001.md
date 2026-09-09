# Journey Audit — IT Hardware Provisioning Workflow

## Journey ID
UJ-IT-001

## Date
September 2026

## Role
IT Administrator / Operations Task Assignee (`it_admin` persona)

## Intended Behavior
`docs/product/02-actors-and-roles.md` §1.7 and `docs/product/05-user-journeys.md` §UJ-04 specify a dedicated **IT / Ops Administrator (`it_admin`)** system persona. Intended behavior specifies that an IT administrator logs into a dedicated IT Task Portal, views an operational provisioning queue (e.g. "Order Laptop & Provision Access"), configures corporate accounts, uploads hardware serial receipts, and transitions tasks to verified states.

## Actual Behavior
1. **Missing RBAC Role Enum**: In MongoDB `server/src/modules/auth/models/user.model.ts`, the `permissions.role` enum only allows: `["owner", "admin", "manager", "employee", "super_admin"]`. The role `it_admin` is omitted.
2. **Missing Frontend Portal**: There is no dedicated `/it-ops` route or IT portal page in `src/App.tsx`.
3. **Task-Category Implementation**: Operational provisioning is modeled through task categorization (`category: "it_setup"`) within the general `Task` schema, assigned to individual users (`assignedToUserId`). Any user assigned the task can mark it completed via `/tasks`.

## Implementation Status
`PARTIALLY_IMPLEMENTED` (Role Model Discrepancy)

## What Is Implemented
- Standalone task system supporting `category: "it_setup"`, `equipment`, `hr_paperwork` in `TaskSchema`.
- Relative due date offsets (e.g. `hire_date - 7 days`).
- Task assignment to specific users (`assignedToUserId`) and target employees (`employeeId`).
- Task comments allowing serial numbers and asset tags to be documented.
- Status transitions: `pending` → `in_progress` → `completed` → `verified`.
- Ownership authorization: Only assigned users or admins can mutate task status.

## What Is Missing
- Formal `it_admin` enum in `user.model.ts` permissions.
- Dedicated `/it-ops` portal view and task queue filter in frontend.
- Dedicated file attachment upload field specifically for hardware serial receipts (currently documented via task comments).

## What Is Incorrect
- Product specification `docs/product/02-actors-and-roles.md` §1.7 lists `it_admin` as one of 8 first-class system roles, but implementation handles IT provisioning as a workflow task classification rather than an isolated security persona.

## Evidence
- File: `docs/product/02-actors-and-roles.md` (Line 63: `it_admin`)
- File: `server/src/modules/auth/models/user.model.ts` (Line 43 & 127: role enum lacks `it_admin`)
- File: `server/src/modules/tasks/models/task.model.ts` (Line 24: `category: "it_setup"`)
- File: `src/App.tsx` (No `/it-ops` route exists)
- Test: `server/src/tests/phase6-tasks.test.ts` (Validates `it_setup` category behavior)

## Gap Analysis

| Requirement | Expected | Actual | Status |
| :--- | :--- | :--- | :--- |
| **IT Setup Tasks** | Dispatch hardware and access tasks upon onboarding trigger. | Fully implemented via `category: "it_setup"` in `Task`. | `ALIGNED` |
| **Asset Tagging** | Document hardware serial numbers and delivery notes. | Supported via task comments and descriptions. | `ALIGNED` |
| **Dedicated Persona** | First-class `it_admin` role in RBAC and DB user schema. | Missing in `user.model.ts`; uses generic `admin`/`employee`. | `DISCREPANCY` |
| **Dedicated IT Portal** | Specialized IT task queue view (`/it-ops`). | Managed through general `/tasks` view. | `DISCREPANCY` |

## Impact
Medium. IT provisioning tasks function reliably in practice because they are dispatched and routed to specific users with relative due dates. However, the system lacks an isolated `it_admin` role guard and dedicated portal interface as documented in the product architecture.

## Root Cause
Architectural evolution: IT setup was consolidated into the multi-stage task engine (`TaskItem`) rather than standing up a separate authentication role and portal page.

## Recommended Fix
1. Formally update `docs/product/02-actors-and-roles.md` to clarify that IT operations are executed via task routing and permissions rather than a dedicated tenant role, OR:
2. Add `it_admin` to `user.model.ts` role enum and introduce a dedicated `/tasks/it-ops` route guard in `App.tsx`.

## Verification Plan
1. Run `vitest run src/tests/phase6-tasks.test.ts` to verify IT task categorization and completion flows.
2. Verify task status mutations on `category: "it_setup"` enforce assignee authorization.

## Related Code
- `server/src/modules/tasks/models/task.model.ts`
- `server/src/modules/tasks/services/task.service.ts`
- `src/pages/Tasks.tsx`

## Related Documentation
- `docs/product/02-actors-and-roles.md` §1.7
- `docs/product/05-user-journeys.md` §UJ-04
- `docs/user-journeys/operations/UJ-IT-001.md`

## Related Test Prompt
`prompts/user-journeys/UJ-IT-001.md`
