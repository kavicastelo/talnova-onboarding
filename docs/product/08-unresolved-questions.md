# 08 — Unresolved Questions & Decision Log

> **Document Status:** Authoritative Requirements Register  
> **Target System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Purpose:** Inventory of Identified Requirement Conflicts, Underspecified Behaviors & Open Decisions

---

## 1. Conflict & Open Decision Register Overview

This document captures requirement ambiguities, historical contradictions between specification documents, and unresolved business logic decisions. 

To preserve requirement integrity, open items are recorded with their explicit context rather than silently resolving them through guesswork:

```
+------------------------------------------------------------------------------------+
|                         UNRESOLVED DECISIONS & CONFLICTS                           |
|                                                                                    |
|  - UQ-01: Frontline Kiosk Pre-Boarding Document Execution                         |
|  - UQ-02: LMS Quiz Failure Lockout vs Journey Progression                          |
|  - UQ-03: HRIS Employee Termination & E-Signature Audit Retention                  |
|  - UQ-04: Multi-Tenant SSO IdP Metadata Auto-Provisioning Priority                 |
|  - UQ-05: AI Course Builder Parsing Fallback Limits                                |
|  - UQ-06: Simultaneous Workflow Rule Conflict Precedence                           |
|  - UQ-07: Mid-Journey Template Version Update Migration Behavior                  |
+------------------------------------------------------------------------------------+
```

---

## 2. Inventory of Unresolved Questions & Conflicts

### UQ-01: Frontline Kiosk Pre-Boarding Document Execution
* **Category:** Operational Access & Security
* **Source Conflict:** V1 Kiosk Specs vs V2 Enterprise SSO & Compliance Rules
* **Conflict Statement:** V1 kiosk specifications permit unauthenticated workers to view safety briefs and sign compliance forms via signed URLs prior to their official `hireDate`. However, V2 compliance rules state that digital signatures must be associated with an authenticated employee account (`userId`).
* **Impact:** Affects factory and warehouse frontline hires who do not possess corporate SSO accounts prior to Day 1.
* **Status:** `UNRESOLVED` — Awaiting Product Owner decision on whether signed kiosk sessions should create a temporary pending user profile or require manager PIN authorization.

---

### UQ-02: LMS Quiz Failure Lockout vs Journey Step Progression
* **Category:** LMS & Journey Progression
* **Source Conflict:** V1 Course Delivery Rules vs V2 Workflow Engine Prerequisite Locks
* **Conflict Statement:** V1 rules specify that failing a quiz max retry limit (e.g. 3 attempts) sets the quiz state to `FAILED`. V2 workflow rules require all step items to be `COMPLETED` to unlock downstream steps. It is underspecified whether a failed quiz locks the entire journey (`PAUSED`) or permits parallel non-dependent tasks to proceed.
* **Impact:** Affects Journey Engine prerequisite lock evaluation.
* **Status:** `UNRESOLVED` — Awaiting Product Owner decision on fallback behavior for failed quizzes (e.g., auto-notify manager vs pause journey).

---

### UQ-03: HRIS Employee Termination & E-Signature Audit Retention
* **Category:** Data Governance & HRIS Sync
* **Source Conflict:** V1 Data Retention Policies vs V2 HRIS Integration Webhooks
* **Conflict Statement:** When an HRIS webhook sends an `EMPLOYEE_TERMINATED` payload mid-onboarding, V1 data retention rules mandate archiving user data. It is underspecified whether incomplete e-signature document requests assigned to the terminated user should be immediately revoked or preserved in `PENDING` state for legal compliance audits.
* **Impact:** Affects E-Signature engine and HRIS sync handler.
* **Status:** `UNRESOLVED` — Awaiting Legal/HR Ops clarification.

---

### UQ-04: Multi-Tenant SSO IdP Metadata Auto-Provisioning Priority
* **Category:** Security & Identity
* **Source Conflict:** V1 User Provisioning vs V2 Enterprise SAML/OIDC SSO
* **Conflict Statement:** When an unprovisioned user logs in via Enterprise SAML SSO, V2 specs require Just-In-Time (JIT) user provisioning. If the incoming SAML assertion contains a department that does not match any active Journey Template targeting rule, it is underspecified whether the user receives the default journey (`isDefault == true`) or triggers an admin exception alert.
* **Impact:** Affects SAML SSO assertion handler and workflow rule resolution.
* **Status:** `UNRESOLVED` — Awaiting Architecture decision.

---

### UQ-05: AI Course Builder Parsing Fallback Limits
* **Category:** AI Assistant & Content Generation
* **Source Conflict:** V2 Phase 15 AI Builder Spec
* **Conflict Statement:** When parsing legacy PDF/DOCX policy documents into LMS courses, corrupted or image-only scanned PDFs may yield zero extractable text. It is underspecified whether the system should invoke an OCR fallback pipeline or return an explicit user error prompt.
* **Impact:** Affects AI Course Creator file upload pipeline.
* **Status:** `UNRESOLVED` — Awaiting Product decision on OCR dependency requirements.

---

### UQ-06: Simultaneous Workflow Rule Conflict Precedence
* **Category:** Workflow Automation Engine
* **Source Conflict:** V2 Phase 03 Workflow Rule Specs
* **Conflict Statement:** If two active workflow rules have identical `priorityIndex` values and both match an incoming `ON_USER_CREATED` event with contradictory actions (e.g., Rule A assigns Journey Template 1, Rule B assigns Journey Template 2), it is underspecified whether the engine evaluates alphabetical rule name order, creation timestamp, or raises a conflict exception.
* **Impact:** Affects Workflow Engine rule resolution logic.
* **Status:** `UNRESOLVED` — Awaiting Product Owner decision on deterministic conflict resolution.

---

### UQ-07: Mid-Journey Template Version Update Migration Behavior
* **Category:** Journey Management & Versioning
* **Source Conflict:** V1 Journey Builder vs V2 Dynamic Journey Assignment
* **Conflict Statement:** When an HR Administrator publishes a new version of a Journey Template (`v1.0` -> `v2.0`), it is underspecified whether active `JourneyInstance` records currently in `IN_PROGRESS` state should migrate to `v2.0` dynamically or remain locked to their instantiated `v1.0` step snapshot.
* **Impact:** Affects Journey Engine template migration policy.
* **Status:** `UNRESOLVED` — Awaiting Product decision on version migration scope.
