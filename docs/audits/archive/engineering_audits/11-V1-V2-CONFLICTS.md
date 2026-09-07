# V1/V2 conflict matrix

| Area | V1 behaviour | V2 intended behaviour | Current implementation | Conflict | Recommended direction |
|---|---|---|---|---|---|
| Onboarding creation | manual learning assignment | automatic case provisioning | User creation separate from assignment | yes | durable case before resources |
| Journey selection | admin selects journey | rules/audience resolve journey | manual, HR, workflow, smart paths coexist | yes | one resolver + override policy |
| LMS/content | assignment creates progress | follows resolved plan | assignment can precede/no plan | yes | materialise after resolution |
| Tasks | standalone | plan-driven and gated | standalone/workflow only | yes | bind to case and gate explicitly |
| KPI | none apparent | requirement mentions it | analytics only | yes | define/implement or remove requirement |
| Automation | none apparent | trigger/rule/retry | inaccessible trigger, RAM events | yes | transactional outbox/worker |
| Completion | assignment complete | aggregate readiness | unrelated states | yes | case aggregation |
| Handover | manager sign-off | terminal governed handover | sign-off blindly sets active | yes | gate by case readiness |
| Notifications | derived alert | process communication | event dependent | yes | emit from durable lifecycle |
| Permissions | role controls APIs | role/action policy | services inconsistently assume author is HR/IT | unknown | define RBAC matrix |
