# V2 feature inventory

| Feature | Evidence | Behaviour/status | Confidence / problem |
|---|---|---|---|
| Workflow rules | `workflows/*`, `phase3-workflows.test.ts` | IMPLEMENTED_NOT_VERIFIED | High: only five action types; no durable delay/retry. |
| User-created trigger | `event-subscribers.ts` | BROKEN | High: no producer in repository. |
| Smart bulk targeting | `smart-assignment.service.ts`, `phase4-smart-assignment.test.ts` | IMPLEMENTED_NOT_VERIFIED | High: name-vs-ID field mismatch and swallowed errors. |
| New-hire auto-enrol | same | BROKEN | High: dependent on absent event. |
| Journey learning/progression | assignments service, `integration.test.ts` | INTEGRATED | Medium: isolated assignment flow test; not V2 process. |
| Cross-person tasks | tasks service/model | PARTIALLY_IMPLEMENTED | High: prerequisite IDs exist but no case/journey binding. |
| Documents auto-assign | document service + subscriber | PARTIALLY_IMPLEMENTED | High: unreachable automatically. |
| Milestone auto-assign | milestone service + subscriber | PARTIALLY_IMPLEMENTED | High: unreachable automatically. |
| Buddy automation | buddy service + subscriber | PARTIALLY_IMPLEMENTED | High: unreachable; workflow trigger_buddy is no-op. |
| Calendar automation | calendar service + subscriber | PARTIALLY_IMPLEMENTED | High: unreachable automatically. |
| Delayed workflow action | `workflow.engine.ts` | BROKEN | Certain: reports delayed; does not queue. |
| Scheduler/overdue alerts | scheduler + in-memory queue | IMPLEMENTED_NOT_VERIFIED | High: persistence/restart/idempotency limitations. |
| HR lifecycle controls | `hr-operations.service.ts`, phase11 tests | CONFLICTING | High: mutable independent user state. |
| Manager handover | `manager.service.ts`, phase5 test | PARTIALLY_IMPLEMENTED | High: sign-off ignores requirements. |
| KPI assignment | no model/service/route | DEAD_CODE / UNCLEAR_REQUIREMENT | High: only analytics/milestones adjacent. |

Statuses are code-evidence ratings, not production verification.
