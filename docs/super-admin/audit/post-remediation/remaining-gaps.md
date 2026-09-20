# Master Inventory of Remaining System Gaps

> **Document Status:** Authoritative Post-Remediation Gap Register  
> **System:** Talnova Onboarding Enterprise Control Plane & Platform  
> **Priority Classification:** P0 (Critical Security/Isolation), P1 (Administrative Ineffectiveness), P2 (Governance & Telemetry Gaps), P3 (UX Improvements)  
> **Date:** September 2026  

---

## 1. Executive Summary

While the 13 backend remediation prompts resolved accounting, reporting, alert lifecycles, and controller coupling, this second-generation audit uncovered **12 significant remaining gaps** centered on administrative propagation, missing UI filters, ungated APIs, and mock telemetry.

---

## 2. Priority P0: Critical Security & Tenant Isolation Gaps

### GAP-SEC-001: Active JWT Session Leak During Organization Quarantine
* **Layer:** Security / Authentication Middleware
* **Severity:** **P0**
* **Problem:** When an organization is quarantined via `POST /organizations/:id/quarantine`, active user JWT sessions are not revoked. Fastify's `authenticate` hook verifies token signature without validating tenant status against the database on each request.
* **Impact:** Compromised or suspended tenants retain active API access for up to 8 hours.
* **Remediation:** Revoke sessions in MongoDB and add a cached `suspendedOrganizations` check in `authenticate`.

---

## 3. Priority P1: Core Administrative Effectiveness Gaps

### GAP-EFF-001: Client Navigation Unaware of Feature Flags (Dead Links)
* **Layer:** Frontend Shell (`AppShell.tsx`, `MobileBottomNav.tsx`)
* **Severity:** **P1**
* **Problem:** Navigation menus render hardcoded static arrays. When Super Admin disables a feature (e.g. `kiosk_mode` or `ai_course_builder`), sidebar menu items remain visible.
* **Impact:** Users click dead links and encounter 403 route errors or empty views.
* **Remediation:** Add `featureFlag` property to `NavItem` and filter sections via `hasFeature()`.

### GAP-EFF-002: Backend API Route Guards Missing on 25 Modules
* **Layer:** Backend Fastify Routes
* **Severity:** **P1**
* **Problem:** Only `kiosk` and `ai` modules call `requireFeatureFlag()`. 25 backend modules execute requests based solely on static RBAC roles, completely bypassing the feature flag control plane.
* **Impact:** API clients can interact with disabled features.
* **Remediation:** Attach `requireFeatureFlag(key)` hooks across all 25 ungoverned modules.

### GAP-EFF-003: 32 Frontend Routes Lack Feature Flag Protection
* **Layer:** Frontend Routing (`App.tsx`)
* **Severity:** **P1**
* **Problem:** Only 5 routes declare `featureFlag` on `<ProtectedRoute>`. 32 routes allow direct URL access even when the underlying capability is disabled.
* **Impact:** Users bookmarking or typing URLs bypass frontend governance.
* **Remediation:** Add `featureFlag` properties to all gated route definitions in `App.tsx`.

### GAP-EFF-004: Dashboard Widgets & Action Buttons Render Ghost State
* **Layer:** Frontend Dashboards (`AdminDashboard.tsx`, `ManagerDashboard.tsx`, `EmployeeDashboard.tsx`)
* **Severity:** **P1**
* **Problem:** Dashboard cards, milestone widgets, and quick-action buttons do not check `hasFeature()`.
* **Impact:** Dashboards display confusing counters and clickable actions for disabled features.
* **Remediation:** Wrap dashboard widgets and action buttons in `hasFeature()` guards.

### GAP-EFF-005: Tri-Layer Key Decoupling Causes Silent Route Guard Failures
* **Layer:** Cross-Platform Configuration
* **Severity:** **P1**
* **Problem:** Keys do not match across layers (e.g., backend: `gamified_milestones`, route: `gamification_badges`, adoption UI: `gamification`).
* **Impact:** Route protection fails silently because `hasFeature` falls back to `true`.
* **Remediation:** Align keys canonically to single naming convention across all layers.

---

## 4. Priority P2: Governance, Telemetry & Caching Gaps

### GAP-GOV-001: 99 Platform Capabilities Missing from Default Flags
* **Layer:** Feature Governance Seed Data
* **Severity:** **P2**
* **Problem:** `DEFAULT_PLATFORM_FLAGS` seeds only 6 flags. 99 product features operating in the application have no governance entry.
* **Impact:** Super Admins cannot configure, toggle, or observe 94% of the platform.
* **Remediation:** Expand `DEFAULT_PLATFORM_FLAGS` to cover all 105 canonical features.

### GAP-GOV-002: Super Admin UI Missing Role-Targeting Controls
* **Layer:** Super Admin Frontend (`SuperAdminFeatureFlags.tsx`)
* **Severity:** **P2**
* **Problem:** While the backend model supports `targetRoles`, the UI modal only provides inputs for organization IDs and percentages.
* **Impact:** Super Admins cannot restrict features to specific roles via the UI.
* **Remediation:** Add multi-select role checkboxes in `SuperAdminFeatureFlags.tsx`.

### GAP-TEL-001: Feature Adoption Dashboard Is a 100% Static Mock
* **Layer:** Observability / Telemetry (`SuperAdminFeatures.tsx`)
* **Severity:** **P2**
* **Problem:** The adoption page renders 5 hardcoded mock cards with static percentages and zero backend API integration.
* **Impact:** Executive leadership has zero visibility into real feature adoption across tenants.
* **Remediation:** Implement `FeatureUsageRecord` collection and build `GET /api/v1/super-admin/adoption` endpoint.

### GAP-TEL-002: Feature Usage Events Not Emitted by Product Workflows
* **Layer:** Domain Event Instrumentation
* **Severity:** **P2**
* **Problem:** Workflows (signing documents, taking quizzes, pairing buddies) do not emit domain events recording feature usage.
* **Impact:** Feature adoption metrics cannot be calculated from real data.
* **Remediation:** Add `recordFeatureUsage()` calls into key domain services.

### GAP-SYN-001: Missing Real-Time Client Flag Synchronization (Push Invalidation)
* **Layer:** Client-Server State Synchronization
* **Severity:** **P2**
* **Problem:** Browser sessions only refresh feature flags on initial login or explicit page reload.
* **Impact:** Super Admin toggle changes do not propagate to active user sessions until reload.
* **Remediation:** Implement Server-Sent Events (SSE) or WebSocket invalidation events.

---

## 5. Priority P3: UX Improvements & Convenience Gaps

### GAP-UX-001: Missing Dependency Warning in Super Admin Flag Toggles
* **Layer:** Super Admin UX
* **Severity:** **P3**
* **Problem:** Administrators can toggle off foundational features without receiving warnings about downstream journey impacts.
* **Impact:** Accidental breakage of dependent workflows.
* **Remediation:** Add an impact warning modal showing affected journeys before toggling flags.

### GAP-UX-002: Internal Flag Key Leaked in Route Fallback UI
* **Layer:** Client Route UX (`ProtectedRoute.tsx`)
* **Severity:** **P3**
* **Problem:** The fallback alert displays raw string code `kiosk_mode` rather than a human-readable title.
* **Impact:** Sub-optimal, technical user experience.
* **Remediation:** Map flag keys to friendly display names in the fallback alert.
