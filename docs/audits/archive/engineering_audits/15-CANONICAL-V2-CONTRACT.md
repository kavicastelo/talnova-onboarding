# Canonical V2 onboarding contract — proposed for approval

**Status:** Proposed architecture contract. This document does not change current implementation.

## 1. Aggregate and ownership

Introduce one tenant-scoped `OnboardingCase` per onboarding occurrence. It is the authoritative lifecycle record, distinct from the User and from each learning assignment.

| Field | Purpose |
|---|---|
| `id`, `organizationId`, `employeeId` | Tenant and employee identity. |
| `source` | `invite`, `bulk_import`, `sso`, `hris`, `manual`, `rehire`. |
| `idempotencyKey` | Prevent duplicate creation per source event/employee/start date. |
| `state`, `stateReason`, timestamps | Authoritative lifecycle/audit history. |
| `resolvedPlanId/version`, `resolution` | Explain why the selected journey/resources apply. |
| `resourceRequirements` | Required/optional gates and generated resource IDs. |
| `handover` | Persisted request, decision, actor, time and notes. |
| `failure` | Failed materialisation item, attempt count, error and reconciliation status. |

**Invariant:** User `employment.status` remains account/employment status. It must not represent onboarding completion. `EmployeeAssignment` remains learning truth. No resource service may directly set a case terminal state.

## 2. State machine

```text
CREATED → RESOLVING → PROVISIONING → READY → ACTIVE
ACTIVE → PAUSED → ACTIVE
ACTIVE → READY_FOR_HANDOVER → HANDOVER_PENDING → COMPLETED → ARCHIVED
RESOLVING/PROVISIONING → PROVISIONING_FAILED → PROVISIONING (retry)
CREATED/RESOLVING/PROVISIONING/ACTIVE/PAUSED → CANCELLED
```

| Transition | Owner / precondition |
|---|---|
| `CREATED → RESOLVING` | Orchestrator accepts one durable employee-created/started command. |
| `RESOLVING → PROVISIONING` | Resolver yields exactly one valid plan or explicit no-plan policy result. |
| `PROVISIONING → READY` | Every mandatory resource materialised idempotently; optional failures recorded. |
| `READY → ACTIVE` | Employee activation/start policy met and first notification dispatched. |
| `ACTIVE → READY_FOR_HANDOVER` | Aggregator observes every required gate satisfied. |
| `READY_FOR_HANDOVER → HANDOVER_PENDING/COMPLETED` | Policy decides whether manager approval is required. |
| any → `PROVISIONING_FAILED` | Materialisation fails with durable cause; no implicit activation. |

## 3. Resource/gate contract

| Resource | Current source | Proposed case role |
|---|---|---|
| Journey assignment | `AssignmentService.assignJourney` | Required when plan declares learning; emits progress/completion facts. |
| Task | `TaskService` | Required only when a plan declares it; prerequisite graph gates task availability, not case mutation. |
| Document | Document assignment service | Required iff template policy says so; signed/waived states satisfy gate. |
| Milestone | Milestone service | Usually post-onboarding/optional; cannot indefinitely block initial handover without explicit policy. |
| Buddy / meeting | Buddy/calendar services | Provisioning requirement or optional support; no fake completion. |
| KPI | absent | Cannot be a gate until product defines an entity and evaluator. |

## 4. Journey resolver precedence — proposed

1. Explicit approved HR/manual override; record actor/reason.
2. Highest-priority active onboarding plan matching canonical employee facts.
3. Organisation default plan.
4. `NO_PLAN` outcome, which enters `PROVISIONING_FAILED` or a declared manual-review queue — never silently active.

Tie-breaker must be deterministic (priority, then version/date/id). A plan may contain multiple journeys only if it declares their gate semantics. Existing workflow `assign_journey` becomes a plan-selection contribution, not an independent materialiser.

## Decisions required before implementation

1. Is one concurrent onboarding case allowed per employee, and what is rehire behaviour?
2. Which resource classes block activation, handover, or neither?
3. Are manager approvals mandatory, optional by plan, or removed?
4. Is no matching journey an error, a default-plan assignment, or manual review?
5. What is a KPI and can it gate completion?
6. Which roles may override a plan or waive a resource, and what audit reason is required?
