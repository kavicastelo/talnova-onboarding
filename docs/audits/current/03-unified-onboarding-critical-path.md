# 03 — Unified Onboarding Critical Path Analysis

> **Document Purpose:** Forensic Architectural Execution Trace (Intended Product Path vs Actual Code Path)

---

## 1. Critical Path Comparison Diagram

```
INTENDED PRODUCT CONTRACT PATH:
[Employee Created] --(ON_USER_CREATED Event)--> [Workflow Rule Engine] --(Matches Rules)--> [Journey Resolver] 
       --> [Instantiates Journey] --> [Dispatches Tasks/Docs/Milestones/Buddy/Meetings] 
       --> [Employee & Assignees Execute Items] --> [Aggregates Progress] --> [Verifies Completion] 
       --> [PDF Certificate & Handover] --> [User Status -> ACTIVE]

ACTUAL CODEBASE EXECUTION PATH:
[Employee Created] --(No Event Emitted!)--> [STUCK / IDLE]
       (Requires Manual Admin Call: POST /api/v1/assignments/assign)
       --> [EmployeeAssignment Created] --> [LMS Modules Populated]
       --> [Employee Views Videos & Takes Quizzes]
       --> [LMS Modules Finished] --> [Assignment.status -> completed]
       --> [JOURNEY_COMPLETED Event Emitted] --> [In-App Notification Sent] --> [STOP / NO STATUS CHANGE]
```

---

## 2. Step-by-Step Critical Path Audit

### Step 1: Employee Entry & Trigger Emission
* **Intended:** `POST /api/v1/employees/invite` creates employee and emits `ON_USER_CREATED` event on `eventBus`.
* **Actual Code:** `EmployeeService.inviteEmployee` (`server/src/modules/employees/services/employee.service.ts:L158-168`) saves `User` record to MongoDB and dispatches invitation email, but **NEVER** calls `eventBus.publish`.
* **Status:** `BROKEN` (Event publisher missing).

---

### Step 2: Automation Rule Evaluation & Journey Resolution
* **Intended:** `eventBus` subscriber intercepts `USER_CREATED`, invokes `WorkflowEngine.processEvent`, evaluates metadata rules (`department`, `role`, `location`), and resolves target `Journey`.
* **Actual Code:** `event-subscribers.ts:L148-177` defines subscriber for `"USER_CREATED"` calling `workflowEngine.processEvent` and `smartAssignmentService.autoEnrollNewHire`. However, because `USER_CREATED` is never emitted by `EmployeeService`, this entire handler is **NEVER CALLED** in production runtime.
* **Status:** `DISCONNECTED` (Event listener orphaned).

---

### Step 3: Journey & Resource Initialization
* **Intended:** Journey resolution instantiates journey roadmap and dispatches initial operational tasks (IT provisioning, manager welcome), e-signature PDFs, buddy pairings, and orientation calendar meetings.
* **Actual Code:** If an admin manually invokes `POST /api/v1/assignments/assign`, `EmployeeAssignmentService.assignJourney` (`server/src/modules/assignments/services/assignment.service.ts:L14-106`) initializes `IEmployeeAssignment` containing `modules` (LMS lessons). It does **NOT** create `TaskItem` checklists, `DocumentSignature` forms, or `MilestonePlan` records.
* **Status:** `PARTIAL` (Only initializes LMS course tree; ignores tasks, documents, and milestones).

---

### Step 4: Onboarding Execution & Progression
* **Intended:** EmployeeStreams LMS videos, completes quizzes, signs compliance PDFs, executes checklist tasks, and logs buddy meetings. Prerequisite locks release as items complete.
* **Actual Code:** Employee streams videos and takes quizzes via `EmployeeAssignmentService.completeLesson` and `submitQuiz`. Progress percentage is updated (`completionPercentage = completedLessons / totalLessons * 100`). Tasks (`TaskService`) and E-Signatures (`DocumentService`) execute in completely separate databases without updating `IEmployeeAssignment.progress`.
* **Status:** `PARTIAL` (LMS progress tracked, but isolated from tasks and documents).

---

### Step 5: Completion & Handover Verification
* **Intended:** System verifies that all mandatory LMS courses, tasks, documents, and milestones achieve completed/verified status. Emits `ON_JOURNEY_COMPLETED`, generates PDF certificate, conducts manager handover, and transitions user profile status from `ONBOARDING` to `ACTIVE`.
* **Actual Code:** `EmployeeAssignmentService.checkOverallCompletion` (`assignment.service.ts:L487-533`) checks `assignment.modules.every(m => m.completed)`. When true, sets `assignment.status = "completed"` and emits `JOURNEY_COMPLETED`. `event-subscribers.ts:L29` receives `JOURNEY_COMPLETED` and sends an in-app notification to the manager. It does **NOT** update `User.employment.status` or trigger operational handover.
* **Status:** `BROKEN` (Premature LMS-only completion; no user status transition or handover).
