# Domain model — code evidence

| Concept | Model / actual role |
|---|---|
| Employee | `User`: tenant, profile, employment status/onboardingState, role, statistics. |
| Journey | `Journey`: template/curriculum, audience, publish state, optional advanced fields. |
| LMS enrolment | `EmployeeAssignment`: employee + journey snapshot and lesson/module progress. |
| Task | `Task`: separate cross-person work, stages, prerequisite IDs, status history. |
| Automation | `WorkflowRule` and `WorkflowExecutionLog`: rule/actions and logs, not a case. |
| Operations | Separate DocumentAssignment, EmployeeMilestone, BuddyAssignment, MeetingEvent models. |
| Notification | Separate notification record. |
| KPI | **NOT FOUND** as a dedicated model/service/API. Analytics aggregates existing records. |
| Onboarding case | **NOT FOUND in committed application architecture.** An uncommitted worktree model exists but is not registered as a route or intake path. |

There are no relational foreign keys/migrations; ObjectId references and application filtering establish relationships.
