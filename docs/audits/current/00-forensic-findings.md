# 00 — Master Forensic Findings Register

> **Document Status:** Authoritative Forensic Codebase Audit Report  
> **Target System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Audit Rule:** Identifies exact architectural gaps, integration failures, and contradictions between the Codebase and the Unified Product Contract. Contains **ZERO** completion percentages.

---

## 1. Executive Forensic Summary

This audit evaluated the actual source code (`server/src/`) against the canonical Unified Product Contract ([09-unified-product-contract.md](../../product/09-unified-product-contract.md)).

While discrete feature services (LMS course player, standalone task checklists, e-signature canvas signer, AI RAG modal, public kiosk player) exist in the codebase, the **integration bridges and event signals that unify them into an automated onboarding lifecycle are broken or disconnected**.

---

## 2. Master Forensic Findings

### FINDING-01: Disconnected Employee Creation Event Trigger
* **Severity:** `CRITICAL`
* **Type:** `MISSING` / `DISCONNECTED`
* **Product Requirement:** REQ-EMP-003 & REQ-WFK-001 ([04-unified-onboarding-lifecycle.md](../../product/04-unified-onboarding-lifecycle.md#stage-2-system-trigger-emission))
* **Expected Behavior:** Inviting or creating an employee (`POST /api/v1/employees/invite`) saves the user profile and emits a `USER_CREATED` event on `eventBus`, triggering Stage 3 workflow rule evaluation, dynamic journey resolution, task dispatch, e-signature dispatch, milestone creation, buddy matching, and meeting scheduling.
* **Actual Behavior:** `EmployeeService.inviteEmployee` saves the MongoDB `User` document and sends an invitation email, but **NEVER** calls `eventBus.publish`.
* **Evidence:**
  - `server/src/modules/employees/services/employee.service.ts` (lines 158–168)
  - `server/src/infrastructure/events/event-subscribers.ts` (lines 148–177)
* **Impact:** Automatic onboarding initiation, workflow rule matching, smart journey assignment, and automated task dispatches are completely dead in production runtime when an employee is created.
* **Affected Capabilities:** Employee Directory, Workflow Engine, Journey Management, Standalone Tasks, E-Signatures, Milestones, Buddy Matching, Calendar Sync.
* **Affected Lifecycle Stage:** Stage 1 (Entry) -> Stage 2 (Trigger Emission) -> Stage 3 (Rule Evaluation).
* **V1/V2 Relationship:** Disconnects V1 user creation from V2 automation subscribers.
* **Recommended Direction:** Inject `eventBus.publish({ eventName: "USER_CREATED", ... })` inside `EmployeeService.inviteEmployee` following database save.

---

### FINDING-02: Premature LMS-Only Completion & Disconnected Handover
* **Severity:** `CRITICAL`
* **Type:** `BROKEN` / `CONTRADICTORY`
* **Product Requirement:** REQ-CMP-001 & REQ-CMP-002 ([04-unified-onboarding-lifecycle.md](../../product/04-unified-onboarding-lifecycle.md#stage-9-journey-completion-verification))
* **Expected Behavior:** Journey completion verification requires all mandatory LMS courses, standalone tasks (`ITask`), compliance e-signatures (`DocumentSignature`), and milestone plans (`MilestonePlan`) to be completed/verified, which then triggers handover and transitions `User.employment.status` from `ONBOARDING` to `ACTIVE`.
* **Actual Behavior:** `EmployeeAssignmentService.checkOverallCompletion` evaluates ONLY LMS modules (`assignment.modules.every(m => m.completed)`). It ignores `Task` items, `DocumentSignature` forms, and `MilestonePlan` check-ins. When `JOURNEY_COMPLETED` is emitted, `event-subscribers.ts` only sends an in-app notification; it does **NOT** transition employee status or trigger handover.
* **Evidence:**
  - `server/src/modules/assignments/services/assignment.service.ts` (lines 487–533)
  - `server/src/infrastructure/events/event-subscribers.ts` (lines 29–42)
* **Impact:** Journey completion is granted prematurely based solely on LMS course views, while compliance NDAs, IT task checklists, and milestone evaluations are bypassed. Employee status is never transitioned to `ACTIVE`.
* **Affected Capabilities:** Journey Management, Standalone Tasks, E-Signatures, Milestones, Handover, Employee Directory.
* **Affected Lifecycle Stage:** Stage 9 (Completion Verification) -> Stage 10 (Operational Handover).
* **V1/V2 Relationship:** V1 assignment progress ignores V2 task/signature completion states.
* **Recommended Direction:** Enhance `checkOverallCompletion` to query associated `Task`, `DocumentSignature`, and `MilestonePlan` records before marking assignment as completed, and add user status transition logic to `JOURNEY_COMPLETED` event handler.

---

### FINDING-03: Architectural Collision of Competing Onboarding State Machines
* **Severity:** `CRITICAL`
* **Type:** `DUPLICATED` / `CONTRADICTORY`
* **Product Requirement:** REQ-JRN-003 & REQ-EMP-002 ([03-domain-model.md](../../product/03-domain-model.md#3-core-state-machine-models))
* **Expected Behavior:** The system operates a unified onboarding state model tracking user status (`INVITED` -> `ONBOARDING` -> `ACTIVE`) and journey instance status (`NOT_STARTED` -> `IN_PROGRESS` -> `COMPLETED`).
* **Actual Behavior:** Three competing state machines exist in parallel:
  1. `User.employment.status` (`"invited"`, `"active"`, `"onboarding"`, `"offboarding"`, `"archived"`).
  2. `IEmployeeAssignment.status` (`"assigned"`, `"in_progress"`, `"completed"`, `"overdue"`, `"expired"`).
  3. `IOnboardingCase.state` (`"created"`, `"resolving"`, `"provisioning"`, `"ready"`, `"active"`, `"paused"`, `"ready_for_handover"`, `"completed"`).
* **Evidence:**
  - `server/src/modules/auth/models/user.model.ts`
  - `server/src/modules/assignments/models/assignment.model.ts`
  - `server/src/modules/onboarding/models/onboarding-case.model.ts` & `onboarding-case.service.ts`
* **Impact:** `OnboardingCaseService` manages outbox events for a state machine (`onboarding.case.created`), but `EmployeeAssignment` tracks actual LMS progress. The two models operate in parallel isolation without cross-state updates.
* **Affected Capabilities:** Employee Directory, Journey Management, Onboarding Case Sub-System.
* **Affected Lifecycle Stage:** Stages 1 through 10.
* **V1/V2 Relationship:** Unintegrated coexistence of V1 assignment models and V2 onboarding case models.
* **Recommended Direction:** Establish `IEmployeeAssignment` as the canonical runtime progress model and bridge state updates to `OnboardingCase` via event subscribers.

---

### FINDING-04: Dead Action Handlers in Workflow Engine
* **Severity:** `HIGH`
* **Type:** `PARTIAL` / `DEAD`
* **Product Requirement:** REQ-WFK-003 ([requirements/03-automation-and-workflows.md](../../product/requirements/03-automation-and-workflows.md))
* **Expected Behavior:** Workflow rule actions execute assigned operations (`ASSIGN_JOURNEY`, `CREATE_TASK`, `SEND_NOTIFICATION`, `TRIGGER_BUDDY`, `ASSIGN_DOCUMENT`, `ASSIGN_KPI`, `TRIGGER_WEBHOOK`).
* **Actual Behavior:** `WorkflowEngine.executeAction` implements `assign_journey`, `create_task`, `send_notification`. However:
  - `trigger_buddy` is a dummy stub returning `{ status: "success" }` without calling `buddyService`.
  - `assign_document`, `assign_kpi`, `trigger_webhook` are omitted from the switch statement and fall through to `default: return { status: "skipped" }`.
* **Evidence:**
  - `server/src/modules/workflows/services/workflow.engine.ts` (lines 168–264)
* **Impact:** Workflow rules configured with buddy pairing, document dispatches, or webhooks skip execution or report fake success.
* **Affected Capabilities:** Workflow Engine, Buddy Matching, E-Signatures, KPIs, Webhooks.
* **Affected Lifecycle Stage:** Stage 3 (Rule Engine Evaluation) & Stage 5 (Task/Doc Dispatch).
* **V1/V2 Relationship:** V2 Workflow Engine fails to invoke V1 document/buddy services.
* **Recommended Direction:** Implement case handlers for `trigger_buddy` (calling `buddyService.autoAssignBuddyToNewHire`), `assign_document` (calling `documentService`), and `trigger_webhook`.

---

### FINDING-05: RBAC Authorization & Signed Token Fallbacks on Kiosk Endpoints
* **Severity:** `MEDIUM`
* **Type:** `PARTIAL`
* **Product Requirement:** REQ-ADM-002 & REQ-PRM-001 ([requirements/11-administration.md](../../product/requirements/11-administration.md))
* **Expected Behavior:** Unauthenticated frontline kiosk display endpoints require valid cryptographically signed URL tokens (`sig`, timestamp, IP whitelist) or 6-digit device pairing codes.
* **Actual Behavior:** `server/src/modules/kiosk/` routes inspect optional token parameters, but permit public unauthenticated access if tokens are omitted or expired in certain endpoint handlers.
* **Evidence:** `server/src/modules/kiosk/controllers/kiosk.controller.ts`
* **Impact:** Unauthorized callers could access frontline kiosk content if endpoint URLs are discovered.
* **Affected Capabilities:** Kiosk Sub-System, RBAC Permissions.
* **Affected Lifecycle Stage:** Frontline Kiosk Operations.
* **V1/V2 Relationship:** V1 public kiosk endpoints lack strict V2 security middleware.
* **Recommended Direction:** Enforce mandatory signed URL token verification middleware on all unauthenticated kiosk routes.

---

### FINDING-06: Unlimited Quiz Retries & Missing Manager Escalation
* **Severity:** `MEDIUM`
* **Type:** `PARTIAL`
* **Product Requirement:** REQ-LMS-003 ([requirements/04-lms-and-learning.md](../../product/requirements/04-lms-and-learning.md))
* **Expected Behavior:** Quizzes validate passing scores, enforce `maxAttempts` limits, and escalate to managers upon max retry failures.
* **Actual Behavior:** `EmployeeAssignmentService.submitQuiz` calculates score and passed status, but does not enforce a maximum attempt limit or emit a `QUIZ_FAILED` escalation event.
* **Evidence:** `server/src/modules/assignments/services/assignment.service.ts` (lines 404–430)
* **Impact:** Employees can retry quizzes infinitely without locking the step or alerting managers.
* **Affected Capabilities:** LMS & Learning Engine, Manager Operations.
* **Affected Lifecycle Stage:** Stage 7 (LMS Consumption).
* **V1/V2 Relationship:** LMS quiz evaluator lacks V2 manager notification triggers.
* **Recommended Direction:** Add `maxAttempts` check in `submitQuiz` and emit `QUIZ_FAILED` event to trigger manager escalation notifications when retries are exhausted.

---

## 3. Recommended Sequential Repair Strategy

To recover full operational integrity, repairs must be executed in this strict sequential order:

```
1. REPAIR EVENT EMISSION (FINDING-01)
   Inject eventBus.publish("USER_CREATED") in EmployeeService.inviteEmployee.
   ↓
2. REPAIR WORKFLOW ACTION HANDLERS (FINDING-04)
   Connect WorkflowEngine actions to BuddyService, DocumentService, and Webhooks.
   ↓
3. REPAIR UNIFIED COMPLETION EVALUATION (FINDING-02)
   Update AssignmentService.checkOverallCompletion to check Tasks, Documents, and Milestones.
   ↓
4. REPAIR HANDOVER & USER STATUS TRANSITION (FINDING-02)
   Add User.employment.status transition ("onboarding" -> "active") to JOURNEY_COMPLETED subscriber.
   ↓
5. RECONCILE STATE MACHINES (FINDING-03)
   Bridge EmployeeAssignment progress to OnboardingCase state transitions.
   ↓
6. ENFORCE KIOSK SECURITY (FINDING-05) & QUIZ RETRY LIMITS (FINDING-06)
   Add mandatory signed URL validation to Kiosk endpoints and enforce quiz max attempts.
```
