# 06 — Business Rules Catalog

> **Document Status:** Authoritative System Specification  
> **Target System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Rule Scope:** Formal System Constraints, Evaluation Triggers & Exception Policies

---

## 1. Business Rule Architecture & Classification

Business rules govern platform logic across security, workflow automation, LMS delivery, task assignment, e-signatures, and multi-tenant isolation. 

Every rule is uniquely identified (BR-001 through BR-040+) and classified into strict constraint categories:

```
+------------------------------------------------------------------------------------+
|                             BUSINESS RULE CATEGORIES                               |
|                                                                                    |
|  - BR-SEC: Security & Multi-Tenancy Rules    - BR-TSK: Task Engine Rules         |
|  - BR-WFK: Workflow & Automation Rules       - BR-SIG: E-Signature Rules         |
|  - BR-JRN: Journey & Step Progression Rules  - BR-MLS: Milestone & Evaluation    |
|  - BR-LMS: Course & Quiz Delivery Rules      - BR-KSK: Kiosk & Field Access      |
+------------------------------------------------------------------------------------+
```

---

## 2. Security & Multi-Tenancy Business Rules

### BR-SEC-001: Strict Organization Data Isolation
* **Rule Statement:** The system shall enforce data isolation by requiring every relational table (excluding system-global lookup tables) to contain an `organizationId` foreign key.
* **Enforcement:** Every API service query shall append `WHERE organizationId = context.user.organizationId`. Frontend filtering shall never be treated as authorization.

### BR-SEC-002: Role-Based Authorization Enforcement
* **Rule Statement:** The API Gateway shall reject any request where the authenticated user's role lacks the required privilege defined in the RBAC Authority Matrix ([02-actors-and-roles.md](./02-actors-and-roles.md)).
* **Exception:** Public kiosk display endpoints authenticated via cryptographically signed URLs (`sig`).

---

## 3. Workflow & Automation Engine Rules

### BR-WFK-001: Trigger Event Emission
* **Rule Statement:** The system shall emit structured trigger events (`ON_USER_CREATED`, `ON_JOURNEY_ASSIGNED`, `ON_STEP_COMPLETED`, `ON_DATE_MILESTONE`) immediately upon domain state transitions.

### BR-WFK-002: Workflow Rule Condition Evaluation
* **Rule Statement:** When evaluating workflow rules, the engine shall test all defined conditions against employee metadata using strict boolean AND logic unless explicit OR groups are defined.
* **Precedence:** In the event that multiple rules match the same trigger event, the rule with the highest `priorityIndex` shall be evaluated first.

### BR-WFK-003: Default Journey Fallback
* **Rule Statement:** If no matching workflow rule is resolved for a new employee upon `ON_USER_CREATED`, the system shall assign the default workspace journey template (`isDefault == true`).

---

## 4. Journey & Step Progression Rules

### BR-JRN-001: Prerequisite Step Locking
* **Rule Statement:** The system shall lock any journey step that has an incomplete prerequisite step (`prerequisiteStepId != null` AND `PrerequisiteStep.status != COMPLETED`).

### BR-JRN-002: Step Completion Criteria
* **Rule Statement:** A journey step shall achieve `COMPLETED` status only when all child items (embedded tasks, courses, documents, quizzes) have achieved `COMPLETED` or `VERIFIED` status.

### BR-JRN-003: Relative Due Date Calculation
* **Rule Statement:** Step and task due dates specified relative to hire date (e.g. `hire_date + 3 days`) shall be calculated using the target employee's `hireDate` timestamp at midnight local workplace time.

---

## 5. LMS, Content & Quiz Delivery Rules

### BR-LMS-001: Video View Completion Threshold
* **Rule Statement:** Video content blocks marked mandatory shall require the user to stream at least 90% of the total video duration before marking the lesson block as completed.

### BR-LMS-002: Quiz Passing Threshold & Retry Enforcement
* **Rule Statement:** A quiz item shall require the employee to achieve a score equal to or greater than `Quiz.passingScorePercent` (default: 80%) to pass.
* **Retry Limit:** If `Quiz.maxAttempts` is exceeded without passing, the quiz state shall transition to `FAILED` and notify the assigned manager.

---

## 6. Standalone Task Engine Rules

### BR-TSK-001: Multi-Stage Assignee Routing
* **Rule Statement:** Tasks created with an `assigneeRole` of `IT_ADMIN`, `HR_ADMIN`, or `MANAGER` shall be routed to the respective queue of users matching that role within the target employee's `organizationId`.

### BR-TSK-002: Overdue Escalation Trigger
* **Rule Statement:** When `current_date > TaskItem.dueDate` and `TaskItem.status != COMPLETED`, the task state shall transition to `OVERDUE` and trigger an automated notification to the task assignee and their manager.

---

## 7. E-Signature & Compliance Rules

### BR-SIG-001: Cryptographic Audit Trail Generation
* **Rule Statement:** Upon canvas signature capture, the system shall record signature image vectors, user ID, timestamp, IP address, and calculate the SHA-256 hash of the generated signed PDF.
* **Immutability:** Signed PDF documents shall be stored in read-only object storage and cannot be modified or deleted.

---

## 8. Milestone & Evaluation Rules

### BR-MLS-001: Dual Sign-off Requirement
* **Rule Statement:** A 30-60-90 day milestone plan period shall achieve `APPROVED` status only after both the employee has submitted self-ratings AND the direct manager has submitted evaluation ratings and clicked sign-off.
