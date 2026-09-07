# Next implementation phase backlog — gated order

## Gate 0: product decisions (no code)

Approve every question in `15-CANONICAL-V2-CONTRACT.md`, especially plan precedence, mandatory gates, no-plan handling, handover and waiver authority.

## Gate 1: foundations

1. Add `OnboardingCase`, resources/gates, transition history, handover and durable outbox schema.
2. Define canonical employee facts (department/job title/location references plus immutable snapshot) and migrate matching to them.
3. Add case service with transition guards and append-only audit events.
4. Add worker/outbox deployment and observability/alerts.

**Exit criteria:** restart-safe event replay, duplicate delivery and concurrent creation tests pass.

## Gate 2: intake and resolution

1. Route invite, import, SSO and HRIS creation through one employee-intake adapter.
2. Create one case idempotently; resolve manual override/default/rule plans deterministically.
3. Convert workflow rules to produce resolution decisions or scheduled commands; prohibit independent journey materialisation.

**Exit criteria:** one scenario per intake source creates exactly one case and yields the identical plan for identical employee facts.

## Gate 3: materialisation and migration

1. Use a single case materialiser for journey, task, document, milestone, buddy and meeting provisioning.
2. Replace HR bulk assignment’s direct `EmployeeAssignment.create` path.
3. Persist case-resource links and explicit mandatory/optional gate policy.
4. Backfill/reconcile existing active assignments under an approved migration strategy.

**Exit criteria:** injected failure after each resource creates a recoverable failed case and retry cannot duplicate artifacts.

## Gate 4: execution/handover

1. Resource adapters report facts to aggregator.
2. Implement pause/waiver/override semantics through case commands.
3. Persist/validate manager handover; move employment state only if approved policy requires it.

**Exit criteria:** no user/assignment/task/doc state can falsely mark a case completed; required gates are demonstrated end-to-end.

## Gate 5: advanced capabilities

Implement task dependencies, journey branches/prerequisites/due-date gates, durable delays, actual buddy actions, KPI only after their approved domain definitions exist.

## Explicitly defer

UI polish, report wording, ad-hoc endpoint fixes, and feature-completion claims. They risk preserving the wrong process model.
