# Unknowns requiring decisions or runtime access

* Production deployment topology: single process vs multi-instance, durable external jobs, actual Mongo data.
* Whether one/many journeys form onboarding; required resource gates; rehire policy.
* Legal/business definition of handover, waiver and KPI.
* Whether input naming mismatches are compensated in frontend/production data.
* Why DB tests cannot connect in this environment and whether production suites pass.
* Whether uncommitted onboarding/outbox changes are intended for this branch; they were excluded from committed-baseline claims.
