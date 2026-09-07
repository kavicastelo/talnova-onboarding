# Requirement Specification 06 — Standalone Task Engine

> **Capability Namespace:** `task_engine`  
> **Requirement Standard:** IEEE 830 / ISO 29148 Standard Specification Language  
> **Target Application:** Talnova Onboarding Platform

---

## 1. Functional Requirements

### REQ-TSK-001: Multi-Stage Task Checklist Management
* **Description:** The system shall manage standalone operational tasks with multi-stage approval workflows.
* **Specification:**
  * Tasks shall support fields: `title`, `description`, `assigneeRole`, `assigneeUserId`, `dueDate`, `status`, `attachmentUrl`.
  * Supported status states: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED`, `OVERDUE`.

### REQ-TSK-002: Cross-Person Assignee Routing
* **Description:** The system shall route tasks to specific target roles (`EMPLOYEE`, `MANAGER`, `IT_ADMIN`, `HR_ADMIN`, `BUDDY`).
* **Specification:**
  * IT provisioning tasks shall appear in the IT Admin portal queue.
  * Manager verification tasks shall appear in the Manager Operations portal.

### REQ-TSK-003: Relative Due Date Scheduling
* **Description:** The system shall calculate task due dates relative to employee hire dates (`hire_date + N days`).
* **Specification:**
  * Overdue tasks (`current_date > dueDate`) shall emit escalation notifications to assignees and managers.
