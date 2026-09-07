# Flow-level failures

## P0 — lifecycle blockers

1. **Automatic new-hire flow cannot begin.** `USER_CREATED` subscriber has no publisher; invite/import/SSO/HRIS paths create users directly.
2. **No authoritative onboarding aggregate.** Completion/handover can be declared from unrelated User, assignment, or manager actions.
3. **Non-durable orchestration.** Event bus and queue are in-memory; subscriber failures are swallowed and cannot be reconciled.

## P1 — core process failures

1. Workflow and smart auto-enrol both resolve journeys without precedence or one-plan rule.
2. Smart/workflow criteria read fields not reliably written by employee ingestion.
3. HR bulk journey creation bypasses normal materialisation and can create malformed progress records.
4. Manager sign-off does not require learning, task, document, milestone, or buddy completion.
5. Pause does not suspend learner progression/workflow execution; it only changes user state and optionally dates.

## P2 — integration failures

1. `delay` and `trigger_buddy` workflow actions are semantic placeholders.
2. Task prerequisites are not used as progression gates.
3. Journey `prerequisites`, `conditionalBranches`, and `dueDateRules` are stored but not enforced by assignment flow.
4. Assignment analytics update precedes assignment insert.

## P3

Department/location/job-title representations are inconsistent across matching, UI, imports and reporting.
