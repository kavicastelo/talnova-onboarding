# Documentation contamination report

Documentation was not used to establish implementation behaviour. Compared post-reconstruction:

| Claim category | Code-grounded classification |
|---|---|
| Automation/auto-enrol | DOCUMENTED + IMPLEMENTED + UNVERIFIED; trigger path absent. |
| Durable scheduler/queue | DOCUMENTED + CONTRADICTED_BY_CODE: queue is RAM-only; scheduler is `setInterval`, not Mongo locking. |
| Task dependencies | DOCUMENTED + IMPLEMENTED + UNVERIFIED: TaskService gates task completion, not full case progression. |
| Automated buddy/delay | DOCUMENTED + PARTIALLY_IMPLEMENTED: workflow actions do not perform the operation. |
| KPI assignment | DOCUMENTED + NOT_FOUND. |
| Complete onboarding/handover | DOCUMENTED + CONTRADICTED_BY_CODE: no unified state or handover model. |
| “100% complete” phase reports | DOCUMENTATION_AMBIGUOUS: no current runtime verification follows from them. |
