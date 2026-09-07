# Source-of-truth analysis

| State | Current owner(s) | Assessment |
|---|---|---|
| Employee identity/employment | `User` | FACT: authoritative identity, but `status` and onboardingState have unclear relation. |
| Journey definition | `Journey` | FACT: template source; assignment only copies title/version, then reads live Journey for rules. |
| Learning progress/completion | `EmployeeAssignment` | FACT: authoritative learning progress. |
| Workflow definition/execution log | WorkflowRule/WorkflowExecution | FACT: records rule/execution outcome, not lifecycle state. |
| Task/document/milestone/buddy state | their respective models | FACT: independent; no aggregate owner. |
| Onboarding completion | User onboardingState, assignment status, manager sign-off inference | CONFLICT: no canonical owner. |
| Handover | none persisted | FACT: manager method returns timestamp but no sign-off model. |
| Scheduler job status | process memory | CONFLICT: disappears on restart. |

## Recommendation

Introduce one future case aggregate as source of truth, retain specialist records as resource truth, and derive dashboards rather than independently setting lifecycle fields.
