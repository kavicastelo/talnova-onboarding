# Code ownership conflicts

| Concept | Current writers | Behavioural difference |
|---|---|---|
| Journey assignment | AssignmentService, WorkflowEngine, SmartAssignment, HR bulk, AdvancedJourney | HR/advanced paths bypass validation/progress tree/events/analytics behaviour. |
| User onboarding | invite/auth, SSO, HRIS, HR lifecycle, manager sign-off | each writes different fields/states; no common intake. |
| Completion | AssignmentService, HR lifecycle, manager sign-off | learning complete, user complete, and employment active are independent. |
| Task creation | Task API and workflow engine | workflow delegates TaskService; okay, but task has no onboarding case link. |
| Automation execution | EventBus subscribers and workflow test-run | test-run directly processes rules; production user-created trigger is absent. |

Race possibility: independent assignment writers check/create differently; absence of a unique `(employee, journey, active)` constraint allows concurrent duplicate paths.
