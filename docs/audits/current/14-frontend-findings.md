# 14 — Frontend Forensic Findings Register

> **Document Purpose:** Complete Register of Identified Frontend Architectural Deficiencies, Contract Mismatches, and Required Repairs.

---

## 1. Summary of Forensic Findings

| Finding ID | Title | Severity | Initial State | Repaired Status | Primary Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FRONTEND-01** | Employee Dashboard Misrepresents Journey Container as LMS Course Only | `HIGH` | `STALE` | `REPAIRED` | [`src/pages/EmployeeDashboard.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/EmployeeDashboard.tsx#L206) |
| **FRONTEND-02** | Workflow Rule Builder Missing Repaired Action Types (`assign_document`, `trigger_buddy`, `trigger_webhook`) | `HIGH` | `MISSING` | `REPAIRED` | [`src/pages/Workflows.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/Workflows.tsx#L568) & [`src/services/workflow.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/workflow.service.ts#L10) |
| **FRONTEND-03** | Standalone Task, Document, Buddy, and Milestone Completions Disconnected from Journey Progress | `MEDIUM` | `DISCONNECTED` | `REPAIRED` | [`src/modules/assignments/subscribers/assignment.subscriber.ts`](file:///d:/talnova/talnova-onboarding/server/src/modules/assignments/subscribers/assignment.subscriber.ts) |
| **FRONTEND-04** | Employee Lifecycle Status Mapping Collapses 5 Backend States into 3 UI Strings | `MEDIUM` | `PARTIAL` | `REPAIRED` | [`src/services/employee.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/employee.service.ts#L13) |
| **FRONTEND-05** | HR Handover Sign-Off Triggers Status Transition Without Unified Completion Guard | `HIGH` | `DISCONNECTED` | `REPAIRED` | [`server/src/modules/hr/services/hr-operations.service.ts`](file:///d:/talnova/talnova-onboarding/server/src/modules/hr/services/hr-operations.service.ts#L248) |

---

## 2. Detailed Findings & Repair Register

### FINDING FRONTEND-01: Employee Dashboard Misrepresents Journey Container as LMS Course Only
* **Severity:** `HIGH`
* **Status:** `REPAIRED`
* **Frontend Location:** [`src/pages/EmployeeDashboard.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/EmployeeDashboard.tsx#L206-L256)
* **Backend Dependency:** `GET /api/v1/assignments/me`, `GET /api/v1/tasks`, `GET /api/v1/documents/inbox`, `GET /api/v1/buddy/me`, `GET /api/v1/milestones/me`
* **Repair Verification:** `EmployeeDashboard.tsx` now renders the Unified Onboarding Container Overview cards for Tasks & IT Setup, E-Signatures, Buddy Mentorship, and 30/60/90-Day Milestones alongside LMS Learning Modules using real backend response data.

---

### FINDING FRONTEND-02: Workflow Rule Builder Missing Repaired Action Types
* **Severity:** `HIGH`
* **Status:** `REPAIRED`
* **Frontend Location:** [`src/pages/Workflows.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/Workflows.tsx#L568-L574) & [`src/services/workflow.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/workflow.service.ts#L10)
* **Backend Dependency:** `POST /api/v1/workflows` (`WorkflowEngine`)
* **Repair Verification:** Workflow service interfaces and Workflow Builder form UI expose `assign_document`, `trigger_buddy`, and `trigger_webhook` configuration dropdowns and input parameters matching backend `WorkflowActionSchema`.

---

### FINDING FRONTEND-03: Standalone Capability Completions Disconnected from Journey Progress
* **Severity:** `MEDIUM`
* **Status:** `REPAIRED`
* **Frontend Location:** [`src/hooks/useTasks.ts`](file:///d:/talnova/talnova-onboarding/src/hooks/useTasks.ts#L48), [`src/hooks/useDocuments.ts`](file:///d:/talnova/talnova-onboarding/src/hooks/useDocuments.ts#L60)
* **Backend Location:** [`server/src/modules/assignments/subscribers/assignment.subscriber.ts`](file:///d:/talnova/talnova-onboarding/server/src/modules/assignments/subscribers/assignment.subscriber.ts)
* **Backend Dependency:** `EmployeeAssignmentService` event subscribers for `TASK_COMPLETED`, `DOCUMENT_SIGNED`, and `MILESTONE_COMPLETED`.
* **Repair Verification:** Event subscriber `assignment.subscriber.ts` listens for `TASK_COMPLETED`, `DOCUMENT_SIGNED`, and `MILESTONE_COMPLETED` events, re-evaluating `checkOverallCompletion()` on active assignments and publishing `JOURNEY_COMPLETED` when all mandatory items are done. Verified in `phase4-smart-assignment.test.ts`.

---

### FINDING FRONTEND-04: Employee Lifecycle Status Mapping Collapses 5 Backend States into 3 UI Strings
* **Severity:** `MEDIUM`
* **Status:** `REPAIRED`
* **Frontend Location:** [`src/services/employee.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/employee.service.ts#L13-L23) & [`src/types/index.ts`](file:///d:/talnova/talnova-onboarding/src/types/index.ts#L55)
* **Backend Dependency:** `User.employment.status` (`"invited"` | `"onboarding"` | `"active"` | `"offboarding"` | `"archived"`)
* **Repair Verification:** `EmployeeStatus` union type and `mapBackendUserToEmployee` mapping preserve all 5 backend employment states (`Invited`, `Onboarding`, `Active`, `Offboarding`, `Archived`).

---

### FINDING FRONTEND-05: HR Handover Sign-Off Triggers Status Transition Without Unified Completion Guard
* **Severity:** `HIGH`
* **Status:** `REPAIRED`
* **Frontend Location:** [`src/pages/HROperations.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/HROperations.tsx#L695-L745)
* **Backend Location:** [`server/src/modules/hr/services/hr-operations.service.ts`](file:///d:/talnova/talnova-onboarding/server/src/modules/hr/services/hr-operations.service.ts#L248)
* **Backend Dependency:** `POST /api/v1/hr/handover/:userId/complete`
* **Repair Verification:** `completeHandover()` in `hr-operations.service.ts` independently evaluates mandatory LMS modules, tasks, e-signatures, and milestones. Handover attempts with incomplete items return HTTP 400 `UNIFIED_ONBOARDING_INCOMPLETE` with a breakdown of remaining items. Handover on fully completed profiles updates state to `ACTIVE` idempotently. Verified in `phase4-smart-assignment.test.ts`.
