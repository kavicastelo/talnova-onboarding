# State-machine audit

## FACT — competing state machines

| Owner | States / transition owner | Defect |
|---|---|---|
| User employment | invited/active/onboarding/inactive; HR state not_started/active/paused/completed/archived | Invite acceptance sets `employment.status=active`; no normal mechanism derives onboardingState from work. |
| Assignment | assigned→in_progress→completed; scheduler may set overdue; HR extension can overdue→in_progress | `AssignmentService`, scheduler and HR all mutate it. |
| Task | pending/in_progress/completed/overdue/cancelled | `TaskService` and scheduler; not linked to assignment. |
| Workflow execution | success/partial_failure/failed/pending_delay | Engine persists a log only; `delay` never actually enters/resumes pending work. |
| Document/milestone/buddy | own state enums | No aggregator consumes them for onboarding completion. |

## INFERENCE — canonical case states

`DRAFT → RESOLVING → PROVISIONING → READY → ACTIVE → READY_FOR_HANDOVER → COMPLETED → ARCHIVED`, with `PROVISIONING_FAILED`, `PAUSED`, and `CANCELLED` as controlled branches. Only an orchestration service should transition the case; resource services report events, never independently complete it.

## CONFLICT

HR can set User `onboardingState=completed` at any time (`hr-operations.service.ts`), while an assignment can remain in progress and tasks/documents can remain outstanding. Manager sign-off sets employment status active but not onboardingState. These are invalid competing completion authorities.
