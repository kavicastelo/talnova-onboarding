# 08 — Roles & Permissions

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative RBAC Access-Control Specification  
> **Module Namespace:** System Core

---

## 1. Access Control Model Overview

Talnova Onboarding enforces multi-tenant Role-Based Access Control (RBAC) supplemented by resource ownership and team scoping rules.

### Boundary Enforcement Layers
1. **Tenant Isolation Layer:** All requests must include an authenticated JWT containing `organizationId`. Queries are strictly scoped to the tenant ID.
2. **Role Capability Layer:** Route controllers inspect token `role` claims against endpoint authorization decorators (`@Roles(['admin', 'owner'])`).
3. **Resource Ownership & Team Layer:** Service methods enforce `managerId` scoping for managers and `userId` ownership scoping for employees.

---

## 2. Master Role-Permission Matrix

| Capability / Action | SuperAdmin (`super_admin`) | Org Owner (`owner`) | HR Admin (`admin`) | Manager (`manager`) | Employee (`employee`) | IT Admin (`it_admin`) | Buddy (`buddy`) | Kiosk Player (`kiosk`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Manage Global System Tenants** | ✓ | — | — | — | — | — | — | — |
| **Manage Org Settings & Branding** | — | ✓ | ✓ | — | — | — | — | — |
| **Configure SAML / OIDC SSO** | — | ✓ | ✓ | — | — | — | — | — |
| **Manage HR Admins & Managers** | — | ✓ | ✓ | — | — | — | — | — |
| **Manage Employee Directory** | — | ✓ | ✓ | Team Only | Self Only | — | — | — |
| **Create & Publish Journeys** | — | ✓ | ✓ | — | — | — | — | — |
| **View Assigned Journeys** | — | ✓ | ✓ | Team Only | Self Only | — | — | — |
| **Complete Content Blocks & Quizzes**| — | — | — | — | ✓ | — | — | — |
| **Manage Standalone Tasks** | — | ✓ | ✓ | Team Tasks | Self Tasks | IT Tasks | — | — |
| **Configure Workflow Rules** | — | ✓ | ✓ | — | — | — | — | — |
| **Author Document Templates** | — | ✓ | ✓ | — | — | — | — | — |
| **Draw Canvas E-Signature** | — | — | — | — | ✓ | — | — | — |
| **Manage 30-60-90 Milestone Templates**| — | ✓ | ✓ | — | — | — | — | — |
| **Evaluate Direct Report Milestones**| — | — | — | ✓ | Self Rating | — | — | — |
| **View Manager Operations Dashboard**| — | — | — | ✓ | — | — | — | — |
| **View HR Operations Central Hub** | — | ✓ | ✓ | — | — | — | — | — |
| **Configure Smart Buddy Matching** | — | ✓ | ✓ | — | — | — | — | — |
| **Log Buddy 1-on-1 Meetings** | — | — | — | — | ✓ | — | ✓ | — |
| **View iCal Feed / OAuth Calendar** | — | ✓ | ✓ | ✓ | ✓ | — | — | — |
| **Query RAG AI Onboarding Assistant**| — | ✓ | ✓ | ✓ | ✓ | — | — | — |
| **Use AI Course & Journey Builder**| — | ✓ | ✓ | — | — | — | — | — |
| **Manage HRIS Integrations** | — | ✓ | ✓ | — | — | ✓ | — | — |
| **View Interactive Office Map** | — | ✓ | ✓ | ✓ | ✓ | — | — | — |
| **Pair & Manage Kiosk Devices** | — | ✓ | ✓ | — | — | ✓ | — | — |
| **Execute Public Kiosk Safety SOPs**| — | — | — | — | — | — | — | Signed Token |

---

## 3. Scoping & Boundary Rules

### 3.1 SuperAdmin Boundary (`super_admin`)
- Cross-tenant operational access.
- Restricted to multi-tenant platform monitoring, subscription tier management, and tenant provisioning endpoints (`/api/v1/super-admin/*`).

### 3.2 Tenant Owner Boundary (`owner`)
- Workspace-wide administrative scope bounded by `organizationId`.
- Exclusive permission to update billing subscriptions, delete organization workspaces, and alter top-level SSO security rules.

### 3.3 HR Administrator Boundary (`admin`)
- Workspace-wide operational scope bounded by `organizationId`.
- Full authoring privileges for journeys, tasks, document templates, milestone plans, and workflow rules.

### 3.4 Manager Scoping Boundary (`manager`)
- Scoped to direct reports where `user.managerId === loggedInUser._id`.
- Read access to progress metrics, quiz scores, learning hours, and milestone check-ins for assigned direct reports only.
- Managers **cannot** view data belonging to employees outside their reporting hierarchy.

### 3.5 Employee Scoping Boundary (`employee`)
- Scoped strictly to own resource records (`user._id === loggedInUser._id`).
- Read/write access restricted to own assigned journeys, tasks, document sign requests, milestone self-evaluations, and buddy meeting logs.

### 3.6 Frontline Kiosk Session Boundary (`kiosk`)
- Unauthenticated player session constrained to public kiosk paths (`/kiosk/*`).
- Authentication via signed cryptographic token (`sig`, timestamp, tenant ID, device UUID).
- Zero read/write access to administrative endpoints, user directories, or employee PII.
