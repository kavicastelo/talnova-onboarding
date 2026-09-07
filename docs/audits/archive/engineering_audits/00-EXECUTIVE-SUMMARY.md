# V2 Product Reconstruction & Forensic Audit — Executive Summary

## Bottom line

**FACT:** Today this application is a multi-tenant onboarding/LMS platform with an operational learning-assignment core plus separately implemented workflow, HR, task, document, milestone, buddy, calendar and notification features. It is not a coherently orchestrated V2 onboarding system.

**FACT:** The defined V2 new-hire sequence cannot be initiated from normal employee creation because no code publishes `USER_CREATED`. Evidence: `server/src/infrastructure/events/event-subscribers.ts` subscribes to it; repository-wide `rg` identifies no corresponding `eventBus.publish({ eventName: "USER_CREATED" })`; `employees/services/employee.service.ts`, `auth/services/sso.service.ts`, and `integrations/services/hris-integration.service.ts` directly persist Users.

## Answers to the required questions

1. **What is it actually doing?** It reliably has a manual learning-assignment path: published Journey → EmployeeAssignment → lesson progress → assignment completion. Operational objects can also be independently created. Automation is mostly an unreachable or non-durable overlay.
2. **V1 model.** **INFERENCE:** manual/bulk curriculum assignment and learner completion, with optional certificate and independent manager sign-off. See `03-V1-FLOW.md`.
3. **Supposed V2 model.** **INFERENCE from code/requirements:** user creation should trigger rules, auto-enrolment and automatic operational provisioning; the current subscriber expresses that intention.
4. **Canonical V2 process.** Provision/activate employee → durable onboarding case → deterministic plan/journey resolution → atomic/idempotent resource materialisation → active execution → aggregate readiness → governed sign-off/handover. Details: `06-CANONICAL-V2-JOURNEY.md`.
5. **V1/V2 conflict.** V1 manual assignment can occur without V2 resolution; V2 has multiple competing resolvers and state owners. See `11-V1-V2-CONFLICTS.md`.
6. **P0 blockers.** Missing creation event; no onboarding aggregate; in-process non-durable orchestration with swallowed failures.
7. **P1 blockers.** Unspecified journey precedence; broken targeting fields; bypass bulk assignment; ungated handover; ineffective pause; unimplemented delay/buddy semantics.
8. **Genuinely verified features.** Only isolated API-level learning progression/invitation paths have source test evidence (`server/src/tests/integration.test.ts`). No production/runtime verification was performed.
9. **Features that merely appear complete.** Automatic onboarding, durable automation, delayed actions, task dependency gating, advanced journey branching/rules, KPI assignment and aggregate completion lack end-to-end evidence; some are directly contradicted by code.
10. **Architectural problems.** No case/orchestrator, RAM event/queue, duplicate resource creators, distributed states with no coordinator, representation mismatches, and non-transactional side effects.
11. **Business-rule ambiguities.** one vs many journeys; resolver precedence; mandatory resources; pause semantics; completion criteria; sign-off authority; KPI definition; override/reassignment policy.
12. **Fix first (next phase order).** (1) approve canonical state machine/requirements; (2) add durable case/outbox/idempotent materialiser design; (3) wire all creation sources to it; (4) centralise journey resolution; (5) migrate/manual paths; (6) add end-to-end tests; then implement advanced branches/dependencies/KPI only after semantics are approved.
13. **Do not fix yet.** Do not patch individual UI/API symptoms, add more rules, or alter schemas before the case/resolution/handover contract is decided. Do not treat historical reports as proof.
14. **Missing requirement information.** Listed in `14-REQUIREMENT-CONFLICTS.md`.
15. **Next engineering phase.** A design-and-contract phase producing an approved OnboardingCase model, event/outbox contract, resolver precedence matrix, resource-gate matrix, override policy, and acceptance E2E scenarios; implementation should follow only after sign-off.

## Current actual flow versus canonical flow

```text
Actual primary:  invite → User(invited) → accept → User(active) → [stops]
Manual learning: admin assign → EmployeeAssignment → lessons → assignment complete

Canonical: employee → case/resolution → materialise all required resources
           → active execution → aggregate completion → handover → completed
```

## Top ten blockers / highest-risk areas

1. No `USER_CREATED` producer.
2. No onboarding case/source of truth.
3. Event handlers and queue are process-local/RAM-only.
4. Subscriber exceptions are logged/suppressed rather than reconciled.
5. Workflow and smart assignment compete to resolve journeys.
6. Workflow/smart targeting read fields employee ingestion does not consistently populate.
7. HR bulk assignment bypasses the standard materialiser.
8. Assignment completion does not aggregate required operational work.
9. Manager sign-off neither validates nor persists handover state.
10. Advanced workflow/journey fields (`delay`, buddy trigger, prerequisites, branches, due rules) do not have their advertised runtime semantics.

## Audit scope and evidence

Inspected: repository roots/config/manifests; all API registration/runtime infrastructure; core user, journey, assignment, workflow, task, HR, manager, document, milestone, buddy and organization models/services; routes; test suites; git history/tags; and both current and legacy documentation as non-authoritative evidence. The full artefact set is `AUDIT/01` through `AUDIT/14`.

No application code, schemas, APIs, tests, or production configuration were modified. Only these audit documents were created.
