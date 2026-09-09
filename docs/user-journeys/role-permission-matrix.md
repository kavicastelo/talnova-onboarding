# Role-Permission & Capability Authority Matrix

> **Document Status:** Authoritative Permission & Security Matrix  
> **Target System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Source Documents:** `docs/product/02-actors-and-roles.md` §2, `src/utils/rbac.ts`, `server/src/middleware/auth.middleware.ts`

---

## 1. Overview of Enforcement Layers

Security in Talnova Onboarding operates across two synchronized enforcement tiers:
1. **Frontend Presentation Layer (`src/components/ProtectedRoute.tsx`, `src/utils/rbac.ts`)**:
   Controls route rendering, navigation links, and action button visibility based on `Capability` claims.
2. **Backend API Gateway Layer (`server/src/middleware/auth.middleware.ts`)**:
   Enforces authoritative authorization via `requireRole(...)`, `authenticate`, and dynamic tenant query scoping (`WHERE organizationId = context.organizationId`).

---

## 2. Capability Matrix Across Roles

| Domain Capability | SuperAdmin | Owner | Admin / HR Admin | Manager | Employee | Buddy (Role/Capability) | IT Admin (Target) | Kiosk Terminal | Backend Middleware Rule |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Manage Tenant & Subscriptions** | `ALLOWED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `requireRole(["super_admin"])` |
| **Manage SSO (SAML 2.0 / OIDC)** | `ALLOWED` | `ALLOWED` | `ALLOWED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `requireRole(["owner", "admin", "super_admin"])` |
| **Manage HRIS Integrations** | `ALLOWED` | `ALLOWED` | `ALLOWED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `requireRole(["owner", "admin"])` |
| **Author Journey Templates** | `ALLOWED` | `ALLOWED` | `ALLOWED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `requireRole(["owner", "admin"])` |
| **Configure Workflow Rules** | `ALLOWED` | `ALLOWED` | `ALLOWED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `requireRole(["owner", "admin"])` |
| **Manage Employee Directory** | `ALLOWED` | `ALLOWED` | `ALLOWED` | `CONDITIONAL` (Read direct reports) | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `requireRole(["owner", "admin"])` for writes |
| **Execute Personal Journey** | `DENIED` | `CONDITIONAL` | `CONDITIONAL` | `CONDITIONAL` | `ALLOWED` | `ALLOWED` | `CONDITIONAL` | `DENIED` | Assignment ownership check (`employeeId == req.user.id`) |
| **Sign Compliance Documents** | `DENIED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | `DENIED` | Signature ownership check (`employeeId == req.user.id`) |
| **Create & Assign Tasks** | `ALLOWED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `requireRole(["owner", "admin", "manager"])` |
| **Complete Assigned Tasks** | `ALLOWED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | `CONDITIONAL` (Own tasks only) | `CONDITIONAL` | `CONDITIONAL` (IT setup tasks) | `DENIED` | Task assignment check (`assignedToUserId == req.user.id`) |
| **Evaluate 30-60-90 Milestones** | `DENIED` | `ALLOWED` | `ALLOWED` | `ALLOWED` (Direct reports) | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `requireRole(["owner", "admin", "manager"])` |
| **Submit Milestone Self-Rating** | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | `DENIED` | Milestone ownership check |
| **Register Buddy Profile** | `DENIED` | `DENIED` | `DENIED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | `DENIED` | Any authenticated employee/manager |
| **Assign Buddy to New Hire** | `ALLOWED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `requireRole(["owner", "admin", "manager"])` |
| **Log Buddy Check-in** | `DENIED` | `DENIED` | `DENIED` | `CONDITIONAL` (If assigned) | `CONDITIONAL` (If assigned) | `ALLOWED` | `DENIED` | `DENIED` | Buddy assignment pair check |
| **AI Course Builder (PDF/DOCX)** | `ALLOWED` | `ALLOWED` | `ALLOWED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `requireRole(["owner", "admin"])` |
| **View Organization Analytics** | `ALLOWED` | `ALLOWED` | `ALLOWED` | `CONDITIONAL` (Department scope) | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `requireRole(["owner", "admin", "manager"])` |
| **Verify Handover & Issue Cert** | `ALLOWED` | `ALLOWED` | `ALLOWED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `requireRole(["owner", "admin"])` |
| **Play Public Kiosk SOPs** | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `ALLOWED` | `verifySignedUrl` / `verifyDeviceToken` |
| **Pair Kiosk Hardware Device** | `ALLOWED` | `ALLOWED` | `ALLOWED` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `PUBLIC` (with 6-digit code) | Public pair route with secret code validation |

---

## 3. Discrepancy & Gap Analysis

1. **IT Administrator Task Gating**:
   - *Intended Behavior (`docs/product/05-user-journeys.md` UJ-04)*: An `it_admin` user logs in to a dedicated IT queue, executes IT setup tasks, and uploads hardware serial receipts.
   - *Actual Implementation*: The backend `TaskService` checks `assignedToUserId == req.user.id` or `["owner", "admin"].includes(req.user.role)`. There is no dedicated `it_admin` RBAC role or separate UI view. Any user assigned the task can mark it complete.
2. **Manager Directory Scope**:
   - *Intended Behavior*: Managers should only be able to view their direct reports in the directory.
   - *Actual Implementation*: Frontend `/directory` renders the full organization directory, though manager dashboard `/manager` restricts metric cards to direct reports (`managerId == req.user.id`).
3. **Frontend vs Backend Alignment**:
   - In `v2-journey-final-validation.md`, backend assignment endpoints (`complete-lesson`, `submit-quiz`) were hardened to reject requests if mandatory compliance documents are unsigned, eliminating earlier UI-only gating flaws.
