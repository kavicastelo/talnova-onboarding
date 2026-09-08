# 11 — Frontend Runtime Flow Audit

> **Document Purpose:** Trace of Intended Unified Onboarding Execution Flow vs Actual Frontend User Interfaces and Navigation Paths.

---

## 1. Intended Product Runtime Execution Flow

```
EMPLOYEE CREATED (Admin/HR/HRIS)
      │
      ▼
WORKFLOW AUTOMATION TRIGGER (Rules / Smart Target Match)
      │
      ▼
DYNAMIC JOURNEY ASSIGNMENT RESOLUTION
      │
      ▼
UNIFIED JOURNEY CONTAINER (Single View)
┌─────────────────────────────────────────────────────────────┐
│ ├── Compliance Documents & E-Signatures (Prerequisite Block)│
│ ├── IT Setup & Operational Tasks                            │
│ ├── LMS Courses & Modules                                   │
│ ├── Assessments & Quizzes                                   │
│ ├── Buddy Pairing & Check-ins                               │
│ └── 30/60/90-Day Milestones                                 │
└─────────────────────────────────────────────────────────────┘
      │
      ▼
PREREQUISITE-AWARE PROGRESSION EVALUATION
      │
      ▼
UNIFIED OVERALL COMPLETION VERIFICATION (All Mandatory Items)
      │
      ▼
MANAGER HANDOVER & SIGN-OFF
      │
      ▼
EMPLOYEE LIFECYCLE TRANSITION -> ACTIVE
```

---

## 2. Actual Frontend Navigation & Execution Flow

```
[Employee Creation]
EmployeeDirectory.tsx -> employeeService.createEmployee()
      │ (Triggers API POST /employees)
      ▼
[Workflow Engine Execution]
(Backend publishes USER_CREATED -> processEvent -> autoEnrollNewHire)
      │
      ▼
[Employee Login & Dashboard]
EmployeeDashboard.tsx (/employee)
      │
      ├── Active Journey Card -> Navigates to /course/:id (CourseViewer.tsx)
      │    └── Renders ONLY LMS Modules & Lessons (Video, Article, Quiz)
      │
      ├── Standalone Tasks Page (/tasks) -> Tasks.tsx
      │    └── Renders IT & Operational Tasks in separate table/view
      │
      ├── Standalone Documents Page (/documents) -> Documents.tsx & DocumentSigner.tsx
      │    └── Renders NDA / E-Signature templates in separate view
      │
      ├── Standalone Buddy Page (/buddy) -> BuddyProgram.tsx
      │    └── Renders Buddy Pairing and 1-on-1 checkin logs
      │
      └── Standalone Milestones Page (/milestones) -> Milestones.tsx
           └── Renders 30/60/90-Day Milestones
```

---

## 3. Disconnected Runtime Execution Gaps

1. **Fragmented Execution Container:**
   Instead of a unified journey view that aggregates learning modules, compliance documents, IT tasks, buddy activities, and milestones, the employee must navigate across 5 separate top-level routes (`/employee`, `/tasks`, `/documents`, `/buddy`, `/milestones`).

2. **LMS-Only Progress Bar:**
   In [`EmployeeDashboard.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/EmployeeDashboard.tsx#L134-L143), `activeJourney.progress` displays the LMS module completion percentage (`a.progress?.completionPercentage`). It does not account for pending e-signatures, uncompleted IT setup tasks, or unassigned buddy check-ins.

3. **Handover Guard Bypassed:**
   In [`HROperations.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/HROperations.tsx), the HR Handover sign-off button allows transitioning an employee to `ACTIVE` status based on manual HR trigger or raw LMS percentage, without checking whether mandatory compliance documents or operational tasks are completed.

4. **Prerequisite Visibility Missing:**
   [`CourseViewer.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/CourseViewer.tsx) renders lesson prerequisites if specified within a course module, but cannot render cross-capability prerequisites (e.g. blocking LMS Course 2 until Compliance Document NDA is signed).
