# Super Admin Command Center — Granular Functional Audit

> **Document Status:** Authoritative Functional Analysis  
> **System:** Talnova Onboarding Enterprise Control Plane  
> **Scope:** End-to-end functional audit across all 17 administrative views and operational components.  

---

## 1. Command Center (`SuperAdminDashboard.tsx`)

### Implemented Functionality
* **8 Metric KPI Cards:** Displays Total Tenants (with active/suspended split), Platform Users, Active Onboardings, Cash Collected, Operating Expenses, Net Operating Result, Open Alerts, and System Health.
* **Filter Context Integration:** Automatically responds to universal filter bar changes (`SuperAdminFilterBar.tsx`), filtering telemetry by `organizationId`.
* **Growth Visualization:** Recharts Area chart renders 6-month historical trends toggling between "Users & Organizations" and "Revenue & Onboardings".
* **Tenant Provisioning Modal:** Fully functional modal allowing creation of new organizations with domain, admin email, and initial subscription plan. Correctly calls `POST /api/v1/super-admin/organizations`, provision initial owner user, and seeds default onboarding journeys.

### Functional Gaps & Defects
1. **Operating Expenses Hardcoded to $0:** In `super-admin.routes.ts:195`, `const operatingExpenses = 0`. The Net Operating Result calculation simply mirrors Cash Collected minus zero, falsely reporting 100% operating margin.
2. **Recent Logs Sub-Table Pagination:** The sub-table displays recent system logs, but filtering by log category relies on client-side slicing rather than server-side queries.

---

## 2. Cross-Domain Global Search (`GET /search`)

### Implemented Functionality
* **Unified Search Endpoint:** Handles queries across 4 distinct entity collections: `organizations`, `users`, `journeys`, and `invoices`.
* **Case-Insensitive Regex Matching:** Searches across organization names, slugs, domains, user full names, emails, employee IDs, journey titles, and invoice numbers.
* **Fast Return Limits:** Bounds search results per entity type to 10-25 items, returning in <50ms.

### Functional Gaps & Defects
* **Alerts and Tasks Excluded:** The search endpoint does not search `alerts` or `tasks`, requiring administrators to navigate to dedicated queues to find specific incident tickets.

---

## 3. Organizations Directory (`SuperAdminOrganizations.tsx`)

### Implemented Functionality
* **Tenant Directory Roster:** Paginated table listing all customer organizations with domain, plan badge, user seat count, created date, and status.
* **Filter Controls:** Server-side search by name/domain and filtering by status (`Active` vs `Suspended`).
* **Quick Actions:** Direct navigation to Organization 360° profile, seat quota editing modal, and inline status toggling.

### Functional Gaps & Defects
* None in core directory view.

---

## 4. Organization 360° Profile (`SuperAdminOrganization360.tsx`)

### Implemented Functionality
* **Comprehensive Multi-Vector Dossier:** Consolidates organization metadata, subscription details, user counts, storage quota consumption, top users, journeys, invoices, and recent audit logs into a single view.
* **Quota Management:** Allows live editing of subscription tier (`Starter`, `Growth`, `Pro`, `Enterprise`) and user seat limits (`Organization.limits.maxUsers`).
* **Emergency Quarantine Workflow:** "Quarantine Tenant" button triggers a confirmation modal requiring an audit reason. Calls `POST /organizations/:id/quarantine`, sets `status = "Suspended"`, and creates a critical audit event (`TENANT_QUARANTINED`).

### Functional Gaps & Defects
1. **AI Token Quota Display is Static:** The 360 view renders AI token utilization as `0 / 1,000,000 (0%)` hardcoded in `super-admin.routes.ts:806-810`.
2. **Quarantine Does Not Invalidate Active Sessions:** When an organization is quarantined, existing user JWT tokens remain valid until expiration; users can continue issuing authenticated requests until their session terminates.

---

## 5. Users Directory & Active Sessions (`SuperAdminUsers.tsx`, `SuperAdminSessions.tsx`)

### Implemented Functionality
* **Cross-Tenant User Directory:** Paginated list of all platform users with role badge, employment status, department, and last login timestamp.
* **Global Force Logout:** "Force Logout" button on user rows dispatches `POST /users/:id/force-logout`, invalidating all active sessions for that user across all devices.
* **Active Sessions Workbench:** Real-time table in `SuperAdminSessions.tsx` inspecting all valid JWT session records (`Session` model), including client User-Agent device info, remote IP address, and session expiration timestamps. Individual sessions can be revoked via `POST /sessions/:sessionId/revoke`.

### Functional Gaps & Defects
1. **Unlock Account Does Not Clear Lockout Timer:** In `PATCH /users/:id`, passing `unlock: true` sets `security.failedLoginAttempts = 0`, but fails to clear `security.lockoutUntil`, leaving locked users unable to log in until the timeout expires naturally.

---

## 6. User 360° Profile (`SuperAdminUser360.tsx`)

### Implemented Functionality
* **Detailed Identity Dossier:** Displays user profile, authentication provider (local/Google/SAML), email verification status, MFA state, and employment details.
* **Subordinate Data Feeds:** Aggregates active user sessions, assigned operational tasks, compliance milestones, and recent audit history.
* **Privileged Actions:** Admin can update user role, change employment status (`active`, `onboarding`, `inactive`, `terminated`), unlock account, and revoke sessions.

### Functional Gaps & Defects
* None in core profile view.

---

## 7. Onboarding Pipeline & Case Inspector (`SuperAdminOnboarding.tsx`)

### Implemented Functionality
* **Cross-Tenant Pipeline Overview:** Displays pipeline state distribution: Total Cases, Active/Provisioning, Pending Handover, Completed, and Failed.
* **Case Explorer:** Paginated table listing candidates, tenant workspace, source channel (HRIS/CSV/Manual), current state, and audit transition counts. Populates employee name and organization name.
* **Failure Details:** Displays provisioning exception messages and failure stack traces for blocked cases.

### Functional Gaps & Defects
1. **Bottleneck Telemetry Missing:** The documented bottleneck analysis view (stalled journey steps, failure rate by quiz) is not implemented in the UI.

---

## 8. Operations & IT Hardware Queue (`SuperAdminTasksOps.tsx`)

### Implemented Functionality
* **Cross-Tenant Task Operations Table:** Aggregates operational tasks across all organizations with priority, type (`it_provisioning`, `hardware`, `general`), due date, and assignee.
* **SLA Breach Detection:** Computes overdue tasks in real time (`dueDate < now && status !== 'completed'`) and highlights SLA breaches with rose badges.
* **Filtering:** Server-side filtering by status and operational task type.

### Functional Gaps & Defects
* None in core task queue view.

---

## 9. Observability Suite (`SuperAdminObservability.tsx`)

### Implemented Functionality
* **Tabbed Telemetry Workspace:** Provides sub-views for API, Logs, Infrastructure, AI, and Storage.
* **Infrastructure & Database Diagnostics:** Fully functional integration returning Node.js process memory (RSS, Heap), uptime, platform architecture, and document counts across all primary MongoDB collections.
* **Cloud Storage Quotas:** Aggregates real `Upload` records by media type (video, document, image) and computes total GB stored in Cloudflare R2.
* **System Logs Feed:** Queries `AuditLog` filtered by `category = 'system'`.

### Functional Gaps & Defects
1. **API Latency & Throughput are Static Mocks:** `GET /observability/api` returns hardcoded numbers (`p50: 28, p95: 64, rpm: 342`). Fastify has no in-memory ring buffer or APM store.
2. **AI Observability is Static Mock:** `GET /observability/ai` returns hardcoded token counts and cost estimates. The AI integration service does not persist usage records.

---

## 10. Feature Flags Flight Control (`SuperAdminFeatureFlags.tsx`)

### Implemented Functionality
* **Global Flight Control Panel:** Lists 5 platform feature flags (`ai_course_builder`, `sso_enforcement`, `kiosk_mode`, `advanced_hris_sync`, `gamification_badges`).
* **Kill Switch & Rollout Dropdown:** Allows toggling flags enabled/disabled and setting rollout percentage (10%, 25%, 50%, 100%).
* **Audit Logging:** Every flag modification creates a `FLAG_TOGGLED` audit log.

### Functional Gaps & Defects
1. **Zero Runtime Enforcement:** Toggling flags does not affect tenant application behavior.
2. **Missing Organization Overrides:** UI and API lack the ability to target or exclude specific tenant organizations.

---

## 11. Feature Adoption Matrix (`SuperAdminFeatures.tsx`)

### Implemented Functionality
* **Visual Adoption Dashboard:** Renders cards for 5 product modules with progress bars and tenant adoption percentages.

### Functional Gaps & Defects
1. **100% Hardcoded Mock Data:** The component does not call any API; it renders a static JavaScript array (`adoptionPct: 82, activeTenants: 14`, etc.).

---

## 12. Internal B2B Finance & Invoicing (`SuperAdminFinance.tsx`)

### Implemented Functionality
* **Financial Overview Tab:** Displays Total ARR, MRR, Active Subscriptions, ARPU, Cash Collected, and Pending Receivables. Renders MRR Tier Distribution pie chart.
* **Invoices Tab:** Lists invoices with status badges (`Paid`, `Pending`, `Overdue`), invoice numbers, customer organizations, and amounts. Includes manual invoice creation modal.
* **Payment Ledger Tab:** Lists verified manual payment receipts with reference numbers, amounts, and payment methods. Includes payment recording modal.
* **Expense Tracker Tab:** Lists operational expenses with vendor, category, and amounts. Includes expense recording modal.
* **Accounts Tab:** Displays tenant organization cards with plan tier and account status.

### Functional Gaps & Defects
1. **Synthetic Historical MRR:** `super-admin.routes.ts:1415` uses `scaleFactor = Math.max(0.4, (6 - i) / 6)` to fabricate past revenue.
2. **Unconditional Invoice "Paid" Update:** Recording a payment unconditionally sets `Invoice.status = "Paid"` without partial payment logic or balance verification.
3. **No Line Items:** Invoices lack itemized line items, tax, and discounts.
4. **Missing Customer Accounts API:** Accounts tab relies on raw organization data rather than a dedicated `CustomerAccount` model.

---

## 13. Incident & Alert Center (`SuperAdminAlerts.tsx`)

### Implemented Functionality
* **Multi-Vector Incident Feed:** Synthesizes alerts across 4 collections: suspended organizations, critical security audit logs, onboarding provisioning failures, and overdue tasks.
* **Severity & Category Badges:** Categorizes alerts into `tenant`, `security`, `onboarding`, and `operations`.
* **Investigation Deep Links:** "Investigate" button navigates directly to the relevant entity view (Organization 360, Audit Log, or Onboarding Case).

### Functional Gaps & Defects
1. **No Backend Persistence:** There is no `Alert` database model. Alerts are recalculated dynamically on each request.
2. **Client-Only Acknowledgment:** The "Ack" button updates React component state only; acknowledgments disappear upon page refresh. No resolution workflow exists.

---

## 14. Canonical Enterprise Reports (`SuperAdminReports.tsx`)

### Implemented Functionality
* **Catalog Grid:** Displays 15 canonical enterprise reports categorized by Finance, Onboarding, Operations, Security, and Observability.
* **Search & Category Filtering:** Allows searching reports by title and filtering by category.

### Functional Gaps & Defects
1. **100% Mock Client-Side Downloads:** Clicking "Export" triggers a `setTimeout` downloading a hardcoded 4-line CSV string. No backend report generator exists.

---

## 15. Platform Settings & Policies (`SuperAdminPlatformSettings.tsx`)

### Implemented Functionality
* **Governance Forms:** Provides toggles for Platform Maintenance Mode, Session Inactivity Timeout, and Tenant Admin MFA enforcement.

### Functional Gaps & Defects
1. **100% UI Placeholder:** The form submission executes a dummy `setTimeout` and shows a success toast. No settings are persisted, and maintenance mode is not enforced.

---

## 16. Audit Governance & Activity Explorer (`SuperAdminAudit.tsx`, `SuperAdminActivity.tsx`)

### Implemented Functionality
* **SOC 2 Audit Trail:** Queryable table of all platform and tenant mutations logged in `AuditLog`.
* **Filtering & Search:** Filters by organization, event category, severity, and text search across actions and descriptions.
* **CSV Export:** Fully functional client CSV export of filtered audit logs.
* **Audit Dossier Modal:** Clicking a log row opens a modal showing actor details, IP address, user-agent, and JSON metadata changes.

### Functional Gaps & Defects
1. **No Separate Behavioral Event Stream:** Relies exclusively on `AuditLog`; lacks a high-volume `PlatformEvent` collection for general user navigation and clickstream events.
