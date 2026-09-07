# Actual V2 mechanisms

`USER_CREATED` subscriber would sequentially call workflow engine, smart auto-enrolment, documents, milestones, buddy and calendar services. This is **IMPLEMENTED but unreachable**: there is no committed producer (`rg eventBus.publish`), and invite/import/SSO/HRIS write Users directly.

Workflow triggers actually consumed: user_created, journey_completed, task_completed. Workflow action types: assign journey, create task, send notification, nominal buddy trigger, nominal delay. `trigger_buddy` produces no buddy mutation; `delay` returns a delayed result but schedules no future job.

Advanced Journey functions are exposed for prerequisite check/reminder and branching test/service use. Adaptive branching directly inserts `EmployeeAssignment` with partial progress, bypassing `AssignmentService`; no call from quiz submission was found.
