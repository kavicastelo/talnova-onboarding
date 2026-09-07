# Domain model reconstruction

## FACT — principal implemented entities

| Concept | Implementation / ownership | Lifecycle and relationships |
|---|---|---|
| Organization | `organizations/models/organization.model.ts` | Tenant root; embeds departments, teams, job titles and locations. |
| User / employee | `auth/models/user.model.ts`; created by `employees/services/employee.service.ts` | User embeds profile/employment/role and carries `employment.status` plus a separate `onboardingState`. |
| Journey template | `journeys/models/journey.model.ts` | Tenant curriculum with modules → lessons → content blocks/quizzes; `publishing.status` is draft/published/archived and audience targeting is embedded. |
| Journey assignment (actual enrolment) | `assignments/models/assignment.model.ts`; created through `AssignmentService.assignJourney` | Links employee to a snapshot-like title/version and contains the only lesson/module progress tree. States: assigned/in_progress/completed/overdue/expired. |
| Task | `tasks/models/task.model.ts`; `TaskService` | Separate employee-targeted / cross-person work. Has prerequisites but is not linked to assignment/journey. |
| Workflow rule/execution | `workflows/models/workflow-rule.model.ts`, `workflow-execution.model.ts` | Rule has trigger, AND conditions and action list. Execution log has success/failure details; no durable work continuation. |
| Documents | `documents/*assignment*` and template models | Separate signature assignment, with pending/viewed/signed/declined/expired. |
| Milestone | `milestones/employee-milestone.model.ts` | Separate 30/60/90/180 day review object. |
| Buddy | `buddy/buddy-assignment.model.ts` | Separate active/completed/reassigned relationship/checklist. |
| Notification | `notifications/models/notification.model.ts` | Derived alert record; subscribers create it. |
| Calendar meeting | `calendar/meeting-event.model.ts` | Separate scheduled/completed/cancelled event. |

## FACT — key relationships

```text
Organization 1—* User
Organization 1—* Journey 1—* modules/lessons
User(employee) 1—* EmployeeAssignment *—1 Journey
User(employee) 1—* Task / DocumentAssignment / EmployeeMilestone / BuddyAssignment
Organization 1—* WorkflowRule 1—* WorkflowExecution
```

## CONFLICT

“KPI” is not a first-class onboarding model, route, or service. Analytics aggregates assignments (`analytics.service.ts`); milestones hold goals/reviews. Any requirement claiming automatic KPI assignment has no matching persistence implementation.

## CONFLICT

Workflow conditions use string fields `employment.department`, `employment.jobTitle`, and `employment.location` (`workflow.engine.ts`), while employee invite/import chiefly write `departmentId`, `jobTitleId`, and `profile.location` (`employee.service.ts`). Smart assignment likewise uses name fields. Target matching therefore commonly has no source data.
