# Recovery plan

1. Freeze additional feature changes and decide lifecycle/gate/plan precedence rules.
2. Establish one committed, tested onboarding-case and durable outbox design; do not rely on current in-memory bus for critical work.
3. Route every intake source through one idempotent case creation path.
4. Make assignment/resource materialisation a single service; retire direct assignment creation paths after migration.
5. Link resource facts to case aggregation and persist handover evidence.
6. Restore a runnable DB-backed test environment; add the tenured end-to-end scenarios before feature expansion.
7. Only then wire branches, dependency semantics, delayed actions and a defined KPI domain.
