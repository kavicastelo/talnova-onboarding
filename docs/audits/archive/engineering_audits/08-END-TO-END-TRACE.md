# End-to-end trace: invited employee

| Stage | Actual initiating code | Mutation/downstream | Expected V2 result / observed gap |
|---|---|---|---|
| Invite | `POST /employees/invite` → `EmployeeService.inviteEmployee` | Creates `User` invited + token; sends mail | No `USER_CREATED`; automation chain does not run. |
| Accept invitation | `auth.service` invitation endpoint tested in `integration.test.ts` | User becomes `employment.status=active` | No event, case, journey or resource provisioning. |
| Workflow | `event-subscribers.ts` subscriber | Would execute rules if event existed | Unreachable through this scenario. |
| Journey resolution | `SmartAssignmentService.autoEnrollNewHire` | Finds all published auto-enrol journeys; `assignJourney` creates assignment | Unreachable; matching relies on often-empty name fields. |
| Task/content/KPI | Workflow action / assignment service | Workflow creates task; assignment snapshots lesson tree | No KPI; task not linked to journey/case. |
| Notifications | assignment/task subscribers | Notification Mongo record | Happens only after manual/workflow assignment. |
| Learner progress | `/assignments/:id/start`, `/complete-lesson` | Assignment progress/status; `JOURNEY_COMPLETED` | Verified as isolated endpoint behaviour in `integration.test.ts`. |
| Completion | `completeLesson` | Assignment complete and event | Does not advance User onboarding state or verify task/document/milestone/buddy. |
| Handover | manager sign-off endpoint | employment.status=active, notification | Does not require aggregate completion and is not a terminal transition. |

## Potential failure points

FACT: email delivery occurs after User persistence and is not transactional (`employee.service.ts`). FACT: event handlers are synchronous and failures are swallowed (`event-bus.ts`). FACT: assignment increments journey analytics before inserting assignment (`assignment.service.ts`), so failed insertion can inflate totals. FACT: HR bulk assignment bypasses `AssignmentService`, creates fabricated title/progress, and emits neither audit/event/notification (`hr-operations.service.ts`).
