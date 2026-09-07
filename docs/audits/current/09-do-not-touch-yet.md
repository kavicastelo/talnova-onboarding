# 09 — "Do Not Touch Yet" Register

> **Document Purpose:** Register of High-Risk Architectural Boundaries and Components Protected from Premature Modification

---

## 1. High-Risk Architectural Boundaries Register

The following components and code modules represent high-risk architectural boundaries. They **MUST NOT** be modified, refactored, or deleted until explicit architectural decisions are finalized during the repair phase:

```
+------------------------------------------------------------------------------------+
|                         DO NOT TOUCH YET ARCHITECTURAL REGISTER                    |
|                                                                                    |
|  1. OnboardingCase Service & Outbox Model (modules/onboarding/)                   |
|  2. EmployeeAssignment Progress Schema (modules/assignments/models/)               |
|  3. EventBus Core Mechanics (infrastructure/events/event-bus.ts)                  |
|  4. Database Migration Schemas & Mongoose Index Definitions                       |
|  5. Enterprise SAML/OIDC SSO Handler (modules/auth/services/sso.service.ts)        |
+------------------------------------------------------------------------------------+
```

---

## 2. Component Risk Profiles & Preservation Rules

### Boundary 1: `OnboardingCase` & Outbox Sub-System (`modules/onboarding/`)
* **Risk Profile:** High. `OnboardingCase` and `OutboxEvent` represent transactional outbox pattern code designed for HRIS marketplace events (`onboarding.case.created`).
* **Preservation Rule:** **DO NOT DELETE OR REFACTOR** `OnboardingCaseService` or `OutboxPublisherService`. They should be preserved as an outbox adapter layer and bridged to `EmployeeAssignment` via event subscribers.

### Boundary 2: `EmployeeAssignment` Schema (`modules/assignments/models/assignment.model.ts`)
* **Risk Profile:** High. The `IEmployeeAssignment` schema is referenced across LMS controllers, quiz evaluators, and reporting dashboards.
* **Preservation Rule:** **DO NOT RESTRUCTURE** the `modules` / `lessons` array format in MongoDB. Add top-level fields (e.g. `taskIds`, `documentIds`) without breaking existing lesson progress structures.

### Boundary 3: EventBus Infrastructure (`infrastructure/events/event-bus.ts`)
* **Risk Profile:** Critical. `EventBus` provides in-memory event distribution across all modules.
* **Preservation Rule:** **DO NOT ALTER** `EventEnvelope` interface or in-memory pub/sub dispatch logic. Fixes must be confined to adding missing `eventBus.publish()` calls and subscriber handlers.

### Boundary 4: Database Schemas & Mongoose Indexes
* **Risk Profile:** Critical. Database collections contain tenant isolation indexes (`organizationId`).
* **Preservation Rule:** **DO NOT DROP** collections, remove `organizationId` foreign keys, or alter existing compound indexes.

### Boundary 5: Enterprise SSO & HRIS Marketplace Connectors (`modules/auth/`, `modules/integrations/`)
* **Risk Profile:** High. SAML/OIDC handlers and HRIS webhooks process external enterprise payloads.
* **Preservation Rule:** **DO NOT MUTATE** external webhook payload schemas or SSO assertion token parsing logic.
