# Blockers

## P0

* No committed producer for automatic new-hire trigger.
* No single onboarding lifecycle aggregate/owner.
* Event and queue state are in memory; subscriber failures are not durable/retriable.

## P1

* Duplicate assignment creators bypass shared rules.
* Completion/handover has competing state writers.
* Matching fields do not align with ingestion fields.
* Workflow delay/buddy semantics do not execute claimed outcomes.

## P2

* DB-dependent tests skipped locally; duplicate-index warnings.
* Advanced journey actions are not wired to the normal quiz path.
* KPI domain is absent.
