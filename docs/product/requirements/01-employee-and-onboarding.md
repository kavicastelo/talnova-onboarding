# Requirement Specification 01 — Employee & Onboarding Profile

> **Capability Namespace:** `employee_onboarding`  
> **Requirement Standard:** IEEE 830 / ISO 29148 Standard Specification Language  
> **Target Application:** Talnova Onboarding Platform

---

## 1. Functional Requirements

### REQ-EMP-001: Employee Directory Record Creation
* **Description:** The system shall create an employee record containing mandatory attributes: `id`, `organizationId`, `email`, `fullName`, `role`, `department`, `location`, `employmentType`, `hireDate`, `managerId`, and `status`.
* **Specification:**
  * When an employee record is created via UI, CSV import, or HRIS integration, the platform shall validate that `organizationId` matches the active workspace.
  * The system shall default `status` to `INVITED` if an invitation email is dispatched, or `ONBOARDING` if an onboarding journey is assigned upon creation.

### REQ-EMP-002: Employee Profile Lifecycle Transitions
* **Description:** The system shall manage employee profile lifecycle states: `INVITED`, `ACTIVE`, `ONBOARDING`, `OFFBOARDING`, `ARCHIVED`.
* **Specification:**
  * Upon first user authentication, the system shall transition status from `INVITED` to `ONBOARDING`.
  * Upon completion of all assigned onboarding journeys and manager sign-off, the system shall transition status from `ONBOARDING` to `ACTIVE`.

### REQ-EMP-003: Dynamic Targeting Metadata
* **Description:** The system shall maintain employee metadata attributes used by the Workflow Automation Engine for dynamic journey resolution.
* **Specification:**
  * Supported attributes shall include: `department`, `role`, `location`, `employmentType` (`full_time`, `contractor`, `part_time`), `hireDate`, and `managerId`.
  * Any update to an employee's department or role shall emit an `ON_USER_UPDATED` event to re-evaluate journey assignment rules.
