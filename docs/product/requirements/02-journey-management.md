# Requirement Specification 02 — Journey & Template Management

> **Capability Namespace:** `journey_management`  
> **Requirement Standard:** IEEE 830 / ISO 29148 Standard Specification Language  
> **Target Application:** Talnova Onboarding Platform

---

## 1. Functional Requirements

### REQ-JRN-001: Visual Journey Template Authoring
* **Description:** The system shall provide an administrative interface to create, edit, version, and publish journey templates.
* **Specification:**
  * Administrators shall be able to define journey steps containing embedded items: Task Checklists, LMS Courses, Digital E-Signature Documents, 30-60-90 Day Milestones, and Buddy Check-ins.
  * The platform shall support drag-and-drop reordering of steps and maintain an explicit `orderIndex`.

### REQ-JRN-002: Prerequisite Step Locking & Gating
* **Description:** The system shall enforce prerequisite step dependencies within a journey instance.
* **Specification:**
  * If step B specifies step A as a prerequisite (`prerequisiteStepId == stepA.id`), the platform shall render step B as `LOCKED` until step A achieves `COMPLETED` status.
  * Attempting to access items within a `LOCKED` step via API or UI shall return a `403 Forbidden` error.

### REQ-JRN-003: Journey Instance Lifecycle Management
* **Description:** The system shall track individual employee progress through an assigned journey instance.
* **Specification:**
  * Supported journey instance statuses shall include: `NOT_STARTED`, `IN_PROGRESS`, `OVERDUE`, `PAUSED`, `COMPLETED`.
  * The platform shall automatically transition `status` to `IN_PROGRESS` upon first item interaction, and `COMPLETED` when all mandatory steps are finished.
