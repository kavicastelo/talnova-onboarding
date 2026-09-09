# System Roles & Persona Taxonomy

> **Document Status:** Authoritative Role Specification & Gap Analysis  
> **Target System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Source Documents:** `docs/product/02-actors-and-roles.md`, `server/src/modules/auth/models/user.model.ts`, `src/utils/rbac.ts`

---

## 1. Executive Summary of Roles

A comprehensive audit of `docs/product/` versus the source code reveals:
* **Product Specifications (`docs/product/02-actors-and-roles.md`)** define **8 canonical system personas**.
* **MongoDB User Aggregate (`user.model.ts`)** implements **5 core database roles**: `["owner", "admin", "manager", "employee", "super_admin"]`.
* **Frontend UI (`RoleContext.tsx` / `rbac.ts`)** supports an additional alias: `'hr_admin'`.
* **Specialized Capability Roles**:
  - `buddy`: Implemented as a modular functional capability (`BuddyProfile`, `BuddyAssignment`) attached to employee/manager accounts rather than a distinct DB role enum.
  - `kiosk_operator`: Implemented as physical terminal authentication (`kiosk_device` tokens and signed URLs) rather than user identity records.
  - `it_admin`: Documented as a persona, but implemented via task categorization (`category: "it_setup"`) assigned to generic users.

---

## 2. Granular Role Classifications

### 2.1 SuperAdmin (`super_admin`)
* **Role ID:** `ROLE-SUP-01`
* **Role Name:** SuperAdmin / Platform Operator
* **Business Description:** Cross-tenant platform administrator responsible for provisioning new organization workspaces, monitoring global system health, managing subscription tiers, and viewing system-wide security logs.
* **Source:** `docs/product/02-actors-and-roles.md` §1.1, `server/src/modules/super-admin/`
* **Documented?:** Yes
* **Implemented?:** Yes (`IMPLEMENTED`)
* **Permission Model:** Root bypass for tenant boundaries (`WHERE organizationId` bypassed for platform management endpoints).
* **Authentication Method:** Email/password JWT with `role: "super_admin"`.
* **Primary Goals:** Ensure platform availability, provision customer tenants, manage enterprise subscriptions.
* **Accessible Areas:** `/super-admin`, `/super-admin/organizations`, `/super-admin/finance`.
* **Known Restrictions:** Cannot perform direct day-to-day employee actions inside customer tenants without tenant context.
* **Related Journeys:** `UJ-SUP-001`, `UJ-SUP-002`, `UJ-SUP-003`.

---

### 2.2 Organization Owner (`owner`)
* **Role ID:** `ROLE-OWN-01`
* **Role Name:** Organization Owner
* **Business Description:** Highest authority within an enterprise tenant workspace. Controls enterprise billing, custom domain branding, SAML 2.0 / OIDC Single Sign-On (SSO), and HRIS integrations.
* **Source:** `docs/product/02-actors-and-roles.md` §1.2, `server/src/modules/organizations/`
* **Documented?:** Yes
* **Implemented?:** Yes (`IMPLEMENTED`)
* **Permission Model:** Full administrative write control scoped strictly by `organizationId`.
* **Authentication Method:** JWT / Enterprise SAML SSO.
* **Primary Goals:** Configure tenant security, integrate corporate identity providers, oversee company onboarding.
* **Accessible Areas:** All organization pages (`/settings`, `/settings/sso`, `/settings/integrations`, `/directory`, `/journeys`, `/analytics`, `/hr-ops`).
* **Known Restrictions:** Scoped strictly to their own tenant (`organizationId`); cross-tenant access rejected with HTTP 403.
* **Related Journeys:** `UJ-ADM-009`, `UJ-ADM-010`, `UJ-ADM-011`, `UJ-AUTH-005`.

---

### 2.3 HR Administrator (`admin` / `hr_admin`)
* **Role ID:** `ROLE-ADM-01`
* **Role Name:** HR Administrator
* **Business Description:** HR operations lead responsible for creating and maintaining employee directories, authoring journey templates, creating LMS courses, configuring workflow automation rules, and validating completion handovers.
* **Source:** `docs/product/02-actors-and-roles.md` §1.3, `server/src/modules/hr/`, `src/pages/AdminDashboard.tsx`
* **Documented?:** Yes
* **Implemented?:** Yes (`IMPLEMENTED`)
* **Permission Model:** Administrative access across all employee, journey, task, course, document, and workflow domains within the tenant.
* **Authentication Method:** JWT with `role: "admin"` (or `'hr_admin'` on frontend).
* **Primary Goals:** Build high-quality onboarding experiences, automate new hire routing, monitor compliance.
* **Accessible Areas:** `/`, `/journeys`, `/journeys/:id`, `/directory`, `/tasks`, `/workflows`, `/documents`, `/hr-ops`, `/analytics`, `/ai-course-builder`.
* **Known Restrictions:** Cannot modify root tenant billing or cross-tenant platform configurations.
* **Related Journeys:** `UJ-ADM-001` through `UJ-ADM-008`, `UJ-ADM-012`.

---

### 2.4 Department / Team Manager (`manager`)
* **Role ID:** `ROLE-MGR-01`
* **Role Name:** Department / Team Manager
* **Business Description:** People manager responsible for direct reports. Conducts 30-60-90 day milestone evaluations, approves manager checklist tasks, conducts 1-on-1 check-ins, and tracks employee onboarding progress.
* **Source:** `docs/product/02-actors-and-roles.md` §1.4, `server/src/modules/manager/`, `src/pages/ManagerDashboard.tsx`
* **Documented?:** Yes
* **Implemented?:** Yes (`IMPLEMENTED`)
* **Permission Model:** Scoped visibility over direct reports (`managerId == current_user.id`) and assigned department teams.
* **Authentication Method:** JWT with `role: "manager"`.
* **Primary Goals:** Support new hire ramp-up, assess confidence and performance, conduct milestone evaluations.
* **Accessible Areas:** `/manager`, `/milestones`, `/tasks`, `/calendar`, `/buddy`, `/directory`.
* **Known Restrictions:** Cannot view non-direct reports' confidential HR records or author global journey templates.
* **Related Journeys:** `UJ-MGR-001`, `UJ-MGR-002`, `UJ-MGR-003`, `UJ-MGR-004`, `UJ-MGR-005`.

---

### 2.5 Employee / New Hire (`employee`)
* **Role ID:** `ROLE-EMP-01`
* **Role Name:** Employee / New Hire
* **Business Description:** The primary consumer of the onboarding platform. Executes assigned journey steps, signs digital compliance documents (NDAs, policies), completes LMS courses and quizzes, executes personal checklist items, and submits milestone self-ratings.
* **Source:** `docs/product/02-actors-and-roles.md` §1.5, `src/pages/EmployeeDashboard.tsx`
* **Documented?:** Yes
* **Implemented?:** Yes (`IMPLEMENTED`)
* **Permission Model:** Scoped read/write access strictly over self-assigned journeys, tasks, profile data, and public tenant resources (KB, Leaderboard, Office Map).
* **Authentication Method:** JWT / SSO.
* **Primary Goals:** Successfully complete onboarding, achieve role readiness, integrate culturally.
* **Accessible Areas:** `/employee`, `/course/:id`, `/documents/:id/sign`, `/tasks` (personal), `/kb`, `/leaderboard`, `/office-map`, `/buddy`, `/certificates`.
* **Known Restrictions:** Strictly barred from administrative mutations, manager sign-offs, and viewing peer journey roadmaps.
* **Related Journeys:** `UJ-ONB-001` through `UJ-ONB-009`, `UJ-OPS-001`, `UJ-OPS-002`.

---

### 2.6 Onboarding Buddy (`buddy`)
* **Role ID:** `ROLE-BUD-01`
* **Role Name:** Onboarding Buddy (Peer Mentor)
* **Business Description:** Experienced team member paired with a new hire to guide cultural integration, answer informal questions, and conduct weekly check-ins.
* **Source:** `docs/product/02-actors-and-roles.md` §1.6, `server/src/modules/buddy/`
* **Documented?:** Yes
* **Implemented?:** Functional Capability (`PARTIALLY_IMPLEMENTED as a distinct Role; FULLY_IMPLEMENTED as a Feature`)
* **Permission Model:** In MongoDB, buddies hold `role: "employee"` or `"manager"` and register a `BuddyProfile`. The `/api/v1/buddy/*` routes grant them access to mentees via `BuddyAssignment`.
* **Authentication Method:** Standard JWT credentials.
* **Primary Goals:** Guide new hire through company culture, log informal check-ins and sentiment.
* **Accessible Areas:** `/buddy` (Buddy Program portal), `/calendar`.
* **Known Restrictions:** Does not possess administrative control; access is limited to assigned mentees.
* **Related Journeys:** `UJ-BUD-001`, `UJ-BUD-002`, `UJ-BUD-003`.

---

### 2.7 IT / Operations Administrator (`it_admin`)
* **Role ID:** `ROLE-ITA-01`
* **Role Name:** IT / Operations Administrator
* **Business Description:** Operational engineer responsible for hardware provisioning, laptop procurement, email setup, and security clearances for incoming hires.
* **Source:** `docs/product/02-actors-and-roles.md` §1.7, `docs/product/05-user-journeys.md` §UJ-04
* **Documented?:** Yes
* **Implemented?:** Discrepancy / Incomplete (`PARTIALLY_IMPLEMENTED / DISCREPANCY`)
* **Permission Model:** Not defined in `user.model.ts` role enum. IT provisioning is handled as a task category (`category: "it_setup"`) assigned to generic users. No dedicated `/it-ops` portal page exists in the frontend.
* **Authentication Method:** Standard JWT with `role: "admin"` or `"employee"`.
* **Primary Goals:** Provision hardware and system accounts, attach serial numbers/receipts, mark setup tasks verified.
* **Accessible Areas:** `/tasks`.
* **Known Restrictions:** Lacks a dedicated portal and RBAC boundary.
* **Related Journeys:** `UJ-IT-001`.

---

### 2.8 Frontline Kiosk Operator / Device (`kiosk_operator`)
* **Role ID:** `ROLE-KSK-01`
* **Role Name:** Frontline Kiosk Terminal / Operator
* **Business Description:** Touch-first terminal or operator in warehouse, manufacturing, or retail facilities executing SOP safety briefings and PPE compliance verification without personal credentials.
* **Source:** `docs/product/02-actors-and-roles.md` §1.8, `server/src/modules/kiosk/`
* **Documented?:** Yes
* **Implemented?:** Device-Based Implementation (`IMPLEMENTED via Device Auth`)
* **Permission Model:** Authenticated via 6-digit hardware pairing codes (`code`), device GUIDs, device JWTs (`role: "kiosk_device"`), or time-limited HMAC-SHA256 signed URLs (`?sig=...`).
* **Authentication Method:** Unauthenticated signed URL / Device token / 6-digit PIN code.
* **Primary Goals:** Stream SOP instructional video, confirm PPE compliance, sync telemetry offline.
* **Accessible Areas:** `/kiosk/play/:id`, `/kiosks` (Admin management).
* **Known Restrictions:** Cannot access any standard web application authenticated views.
* **Related Journeys:** `UJ-KSK-001`, `UJ-KSK-002`, `UJ-KSK-003`, `UJ-KSK-004`.

---

## 3. Discrepancy & Conflict Analysis

| Persona | Documented in `docs/product` | Implemented in DB (`user.model.ts`) | Implemented in UI (`rbac.ts`) | Status Verdict | Conflict Analysis |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **SuperAdmin** | Yes | Yes (`super_admin`) | Yes (`super_admin`) | `ALIGNED` | Fully aligned. |
| **Owner** | Yes | Yes (`owner`) | Yes (`owner`) | `ALIGNED` | Fully aligned. |
| **Admin / HR Admin** | Yes | Yes (`admin`) | Yes (`admin`, `hr_admin`) | `ALIGNED` | Frontend supports `'hr_admin'` alias; backend stores `'admin'`. |
| **Manager** | Yes | Yes (`manager`) | Yes (`manager`) | `ALIGNED` | Fully aligned with direct report filtering. |
| **Employee** | Yes | Yes (`employee`) | Yes (`employee`) | `ALIGNED` | Fully aligned. |
| **Buddy** | Yes | No (uses `User` + `BuddyProfile`) | No (feature toggle) | `FUNCTIONAL_CAPABILITY` | Implemented as a profile pairing mechanism rather than a primary auth role. |
| **IT Admin** | Yes | No (missing from enum) | No (missing from rbac) | `ROLE_DISCREPANCY` | Intended as persona UJ-04; code currently routes tasks via `category: "it_setup"`. |
| **Kiosk Operator** | Yes | Device token (`kiosk_device`) | Public signed route | `DEVICE_ALIGNED` | Implemented as a dedicated terminal authentication flow. |
