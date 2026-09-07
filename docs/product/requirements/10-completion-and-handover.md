# Requirement Specification 10 — Completion & Handover

> **Capability Namespace:** `completion_handover`  
> **Requirement Standard:** IEEE 830 / ISO 29148 Standard Specification Language  
> **Target Application:** Talnova Onboarding Platform

---

## 1. Functional Requirements

### REQ-CMP-001: Journey Completion Verification
* **Description:** The system shall verify completion criteria before transitioning a journey instance state.
* **Specification:**
  * A journey instance shall achieve `COMPLETED` status only when all mandatory step items (courses, documents, tasks, milestones) are finished and verified.
  * Successful completion shall emit an `ON_JOURNEY_COMPLETED` trigger event.

### REQ-CMP-002: Operational Handover & Certificate Generation
* **Description:** Upon journey completion, the system shall conduct operational handover to the manager.
* **Specification:**
  * The system shall generate a PDF Completion Certificate recording employee name, journey title, completion timestamp, and manager sign-off.
  * The employee profile status shall transition from `ONBOARDING` to `ACTIVE`.
