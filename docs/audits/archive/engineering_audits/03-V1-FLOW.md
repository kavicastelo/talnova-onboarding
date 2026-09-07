# Most likely V1 flow

## INFERENCE

The original delivered core was journey authoring → manual/bulk assignment → learner lesson completion → journey completion/certificate/analytics. Commit history identifies phase 1/2 before phase 3/4 (`git log -- server/src/modules/...`); `journey`, `assignment`, user and initial integration tests support this more strongly than legacy prose.

```text
admin creates/publishes Journey
→ admin manually assigns Journey (or bulk assigns)
→ EmployeeAssignment materialises lesson progress
→ employee starts/completes lessons
→ assignment becomes completed, analytics/statistics update
→ optional certificate; manager can sign off separately
```

## FACT

`AssignmentService.assignJourney` requires a published journey and builds the module/lesson progress tree. `completeLesson` calculates completion and publishes `JOURNEY_COMPLETED`. `integration.test.ts` exercises explicit start and lesson completion. Manager sign-off in `manager.service.ts` only changes `employment.status` to `active`.

## UNKNOWN

No v1 tag exists (`git tag --list` returned none). Exact v1 releases, original handover semantics, and whether tasks/KPIs were part of v1 cannot be proven from current history alone.
