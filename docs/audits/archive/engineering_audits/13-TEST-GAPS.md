# Test coverage versus product flow

## FACT

Tests are phase-named endpoint/module suites (`server/src/tests/phase*.test.ts`) with `app.inject` and Mongo setup. `integration.test.ts` verifies explicit learning progression and invitation acceptance; phase3/4 cover workflows/smart assignment in isolation.

## Gaps

* No test traces Invite/SSO/HRIS/bulk import through `USER_CREATED` to all automatic resource assignments; this would expose the absent publication.
* No end-to-end rule precedence, auto-enrol deduplication, workflow action failure, restart/retry, or delayed action test.
* No test asserts pause prevents progression or that completion aggregates documents/tasks/milestones/buddy.
* No test asserts manager sign-off eligibility or persistent handover evidence.
* No test validates prerequisites/branches/dueDateRules as behavioural gates.
* Most tests validate endpoint response/schema and implementation-local state, not the business lifecycle.

## UNKNOWN

No test execution was performed in this audit, so historical green status and environmental/integration reliability are unverified.
