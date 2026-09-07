# 02 — Actual State Model Analysis

> **Document Purpose:** Forensic Analysis of Codebase Database Enums, State Machines & State Guards vs Product Contract

---

## 1. Actual Codebase State Machine Inventory

The codebase contains three distinct state models representing onboarding lifecycle states across different modules:

```
               CODEBASE STATE MACHINE MODELS
               
  1. USER / EMPLOYEE STATUS MODEL (server/src/modules/auth/models/user.model.ts)
     - "invited" | "active" | "onboarding" | "offboarding" | "archived"
     
  2. EMPLOYEE ASSIGNMENT MODEL (server/src/modules/assignments/models/assignment.model.ts)
     - "assigned" | "in_progress" | "completed" | "overdue" | "expired"
     
  3. ONBOARDING CASE MODEL (server/src/modules/onboarding/models/onboarding-case.model.ts)
     - "created" | "resolving" | "provisioning" | "provisioning_failed" | "ready" | 
       "active" | "paused" | "ready_for_handover" | "handover_pending" | "completed" | "archived" | "cancelled"
```

---

## 2. Detailed State Model Analysis & Contradictions

### A. Employee User Status Model (`User`)
* **Source:** `server/src/modules/auth/models/user.model.ts`
* **Defined States:** `"invited"`, `"active"`, `"onboarding"`, `"offboarding"`, `"archived"`.
* **State Transition Behavior:**
  * Initial state upon `inviteEmployee`: `"invited"`.
  * Login / invite accept transition: Status updated to `"active"` or `"onboarding"`.
* **Contradiction with Product Contract:**
  * The Product Contract requires `User.employment.status` to transition from `"onboarding"` to `"active"` upon formal manager handover sign-off.
  * In actual code, `EmployeeAssignmentService.checkOverallCompletion` does **NOT** mutate `User.employment.status`. The status remains unchanged when journey completion occurs.

---

### B. Employee Assignment Model (`IEmployeeAssignment`)
* **Source:** `server/src/modules/assignments/models/assignment.model.ts`
* **Defined States:** `"assigned"`, `"in_progress"`, `"completed"`, `"overdue"`, `"expired"`.
* **State Transition Behavior:**
  * Creation: Set to `"assigned"`.
  * First lesson view / activity: Set to `"in_progress"`.
  * All LMS modules completed: Set to `"completed"`.
* **Contradiction with Product Contract:**
  * Product Contract specifies states: `NOT_STARTED`, `IN_PROGRESS`, `OVERDUE`, `PAUSED`, `COMPLETED`.
  * Code uses `"assigned"` instead of `NOT_STARTED`, lacks a `"paused"` state in the assignment schema, and bases completion solely on LMS module iteration (`allModulesCompleted`).

---

### C. Onboarding Case Model (`IOnboardingCase`)
* **Source:** `server/src/modules/onboarding/models/onboarding-case.model.ts` & `onboarding-case.service.ts`
* **Defined States:** `"created"`, `"resolving"`, `"provisioning"`, `"provisioning_failed"`, `"ready"`, `"active"`, `"paused"`, `"ready_for_handover"`, `"handover_pending"`, `"completed"`, `"archived"`, `"cancelled"`.
* **State Transition Matrix:**
  * Enforced via explicit `transitions` lookup table in `onboarding-case.service.ts`.
  * Publishes `OutboxEvent` records for state transitions (`onboarding.case.created`, `onboarding.case.completed`).
* **Contradiction with Product Contract:**
  * This state machine is implemented as a standalone micro-workflow, but is **NOT WRITTEN TO** by `EmployeeAssignmentService` or `WorkflowEngine`.
  * It operates as a parallel, unintegrated state engine alongside `EmployeeAssignment`.

---

## 3. Child Resource State Models

### D. Standalone Task Model (`Task`)
* **Source:** `server/src/modules/tasks/models/task.model.ts`
* **Defined States:** `"pending"`, `"in_progress"`, `"completed"`, `"overdue"`, `"cancelled"`.
* **Behavior:** Managed by `TaskService.updateTaskStatus`. Publishes `TASK_COMPLETED` and `TASK_OVERDUE` events. Correctly enforced.

### E. E-Signature Document Model (`DocumentSignature`)
* **Source:** `server/src/modules/documents/models/`
* **Defined States:** `"pending"`, `"viewed"`, `"signed"`, `"declined"`.
* **Behavior:** Captures signature vectors, timestamp, IP address, and SHA-256 PDF hash. Publishes `DOCUMENT_SIGNED` event. Correctly enforced.

---

## 4. State Machine Contradiction Summary

| Product Contract Expectation | Actual Codebase Behavior | Severity | Root Cause |
| :--- | :--- | :---: | :--- |
| **Journey Completion transitions User status to `ACTIVE`** | User status remains unchanged (`"onboarding"` or `"active"`) upon journey completion. | **CRITICAL** | `AssignmentService` does not update `User.employment.status`. |
| **Journey Completion evaluates Tasks, Documents, and Milestones** | Completion evaluates ONLY LMS modules (`assignment.modules.every(m => m.completed)`). | **CRITICAL** | `AssignmentService.checkOverallCompletion` lacks cross-module state checks. |
| **Unified Onboarding State Machine** | Three competing state machines exist (`User`, `EmployeeAssignment`, `OnboardingCase`). | **HIGH** | Parallel evolution of V1 assignments and V2 onboarding cases. |
