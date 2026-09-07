# Requirement Specification 12 — Permissions & Authorization

> **Capability Namespace:** `permissions_rbac`  
> **Requirement Standard:** IEEE 830 / ISO 29148 Standard Specification Language  
> **Target Application:** Talnova Onboarding Platform

---

## 1. Functional Requirements

### REQ-PRM-001: RBAC Permission Evaluation
* **Description:** The system shall enforce role-based access control across all API endpoints and UI routes.
* **Specification:**
  * Endpoint permissions shall be checked against the user's assigned system role (`super_admin`, `owner`, `admin`, `manager`, `employee`, `buddy`, `it_admin`, `kiosk_operator`).
  * Unauthorized requests shall return `401 Unauthorized` or `403 Forbidden`.

### REQ-PRM-002: Scoped Resource Permissions
* **Description:** The system shall restrict manager and employee access to scoped resource boundaries.
* **Specification:**
  * Team Managers shall access data only for users where `managerId == current_user.id` or assigned department teams.
  * Employees shall access only their assigned journey instances, tasks, courses, and profile records.
