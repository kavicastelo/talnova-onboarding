# Proposed event and outbox contract

**Status:** Proposed. Evidence for necessity: the current `EventBus` (`server/src/infrastructure/events/event-bus.ts`) is in-process and `QueueService` is RAM-only.

## Commands versus facts

Commands are synchronous API intentions: `CreateOnboardingCase`, `ResolveOnboardingPlan`, `ProvisionCaseResource`, `PauseCase`, `RequestHandover`, `ApproveHandover`, `RetryProvisioning`.

Facts are immutable, persisted events emitted in the same database transaction as their state mutation:

| Fact | Producer | Consumers |
|---|---|---|
| `employee.created` / `employee.activated` | invite/import/SSO/HRIS adapters | case intake only |
| `onboarding.case.created` | case service | resolver |
| `onboarding.plan.resolved` | resolver | materialiser |
| `onboarding.resource.provisioned/failed` | materialiser | aggregator/retry worker |
| `journey.assignment.completed` | assignment adapter | case aggregator |
| `task.completed`, `document.signed`, `milestone.completed` | resource adapters | case aggregator |
| `onboarding.case.ready_for_handover` | aggregator | notification/handover |
| `onboarding.case.completed` | handover service | analytics/HRIS notification |

## Reliability requirements

* Store `outboxEvent` alongside the mutation with event id, aggregate id/version, correlation/causation ids, payload version, state, attempts and timestamps.
* A durable worker publishes events and records consumer idempotency keys. Consumer retries use bounded exponential backoff and a visible dead-letter/reconciliation state.
* Every materialiser call receives `(caseId, resourceType, deterministic resourceKey)` and is idempotent.
* Do not run workflow actions as side effects of HTTP callbacks without persistence. A `delay` schedules a persisted due job; it cannot merely return `delayed`.
* Preserve current notifications as consumers, not lifecycle authorities.

## Compatibility bridge

Initially publish case facts plus legacy notifications/events so existing UI remains usable. Replace direct callers of `AssignmentService`, HR bulk assignment and smart assignment in phases after case materialisation tests pass. Do not dual-write unboundedly: document a cut-over/rollback plan and reconcile legacy assignments to a case.
