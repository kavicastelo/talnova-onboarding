# Super Admin Action Effectiveness Matrix

> **Document Status:** Authoritative Administrative Effectiveness Matrix  
> **System:** Talnova Onboarding Enterprise Control Plane  
> **Standard:** Complete Multi-Layer Propagation Verification  
> **Date:** September 2026  

---

## 1. Concept & Evaluation Standard

A Super Admin action is defined as **Administratively Effective** only when its operational decision propagates deterministically through every relevant product layer:

$$\text{Super Admin Action} \to \text{Persistence} \to \text{Backend Resolution} \to \text{Tenant Isolation} \to \text{Navigation} \to \text{Dashboard} \to \text{Route Guard} \to \text{Component/Action} \to \text{API Boundary} \to \text{Audit}$$

A control that persists in MongoDB and blocks an API call but leaves menus, dashboards, and action buttons visible and clickable is classified as **PARTIAL** or **BACKEND ONLY**.

---

## 2. Master Action Effectiveness Matrix

| Super Admin Action | Persists | Backend | Tenant Isolation | Org Nav | Dashboard Cards | Route Guard | Button / Action | API Guard | Audit Log | Effectiveness Classification |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Disable AI Course Builder** | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | **PARTIAL (UI Unaware)** |
| **Disable Kiosk Terminals** | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | **PARTIAL (UI Unaware)** |
| **Disable Gamification & Leaderboard** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗* | ✗ | ✗ | ✓ | **KEY MISMATCH / UNGUARDED** |
| **Disable SSO Identity Enforcement** | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | **PARTIAL (API Unguarded)** |
| **Disable HRIS Marketplace Sync** | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | **PARTIAL (API Unguarded)** |
| **Disable Multi-Org Switcher** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | **CONFIGURATION ONLY** |
| **Disable Onboarding AI Copilot** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | **CONFIGURATION ONLY** |
| **Disable SCIM Directory Sync** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | **CONFIGURATION ONLY** |
| **Quarantine Tenant (Suspend Org)** | ✓ | ✓ | ✓ | N/A | N/A | N/A | N/A | ✗** | ✓ | **PARTIAL (Active Session Leak)** |
| **Activate Tenant (Restore Org)** | ✓ | ✓ | ✓ | N/A | N/A | N/A | N/A | ✓ | ✓ | **FULLY EFFECTIVE** |
| **Revoke Specific User Session** | ✓ | ✓ | ✓ | N/A | N/A | ✓ | ✓ | ✓ | ✓ | **FULLY EFFECTIVE** |
| **Force Logout All User Sessions** | ✓ | ✓ | ✓ | N/A | N/A | ✓ | ✓ | ✓ | ✓ | **FULLY EFFECTIVE** |
| **Unlock Locked User Account** | ✓ | ✓ | ✓ | N/A | N/A | ✓ | ✓ | ✓ | ✓ | **FULLY EFFECTIVE** |
| **Update Organization Plan / Tier** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | **DATA ONLY** |
| **Set Customer Credit Hold** | ✓ | ✓ | ✓ | N/A | N/A | ✗ | ✗ | ✗ | ✓ | **DATA ONLY** |
| **Record Invoice Payment** | ✓ | ✓ | ✓ | N/A | N/A | N/A | N/A | ✓ | ✓ | **FULLY EFFECTIVE** |
| **Record Operating Expense** | ✓ | ✓ | ✓ | N/A | N/A | N/A | N/A | ✓ | ✓ | **FULLY EFFECTIVE** |
| **Enable Maintenance Mode** | ✓ | ✓ | ✓ | ✓*** | ✓*** | ✓*** | ✓*** | ✓ | ✓ | **FULLY EFFECTIVE** |
| **Disable Maintenance Mode** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **FULLY EFFECTIVE** |
| **Update Session Timeout Minutes** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | **DATA ONLY** |
| **Acknowledge Platform Alert** | ✓ | ✓ | ✓ | N/A | N/A | N/A | N/A | ✓ | ✓ | **FULLY EFFECTIVE** |
| **Resolve Platform Alert** | ✓ | ✓ | ✓ | N/A | N/A | N/A | N/A | ✓ | ✓ | **FULLY EFFECTIVE** |
| **Export Streaming ARR Report** | ✓ | ✓ | ✓ | N/A | N/A | N/A | N/A | ✓ | ✓ | **FULLY EFFECTIVE** |
| **Export User Licenses Report** | ✓ | ✓ | ✓ | N/A | N/A | N/A | N/A | ✓ | ✓ | **FULLY EFFECTIVE** |

*\*Note on Gamification:* Backend flag key is `gamified_milestones`, while `App.tsx` checks `gamification_badges`. Because of key mismatch, the route guard fails silently.  
*\*\*Note on Tenant Quarantine:* Updating organization status to `Suspended` persists and marks the organization inactive; however, currently issued active JWT tokens remain valid until expiration because Fastify JWT verification does not perform an in-line DB query on every request.  
*\*\*\*Note on Maintenance Mode:* Global Fastify pre-handler hook rejects all non-super-admin HTTP requests with 503, effectively freezing the UI on the next API interaction.

---

## 3. Deep-Dive Propagation Analysis by Layer

### Layer 1: Database Persistence (Status: PASS)
* All Super Admin mutations persist to dedicated Mongoose collections (`feature_flags`, `invoices`, `payment_records`, `expense_records`, `customer_accounts`, `alerts`, `platform_settings`, `organizations`, `users`).
* No unvalidated raw collection mutations or volatile in-memory state remains.

### Layer 2: Backend Feature Resolution & Caching (Status: PASS)
* `FeatureFlagService.isEnabled(key, orgId, role)` handles hierarchical resolution with in-memory caching (60s TTL).
* Cache invalidation is triggered synchronously on flag mutation (`FeatureFlagService.invalidateCache(normalizedKey)`).

### Layer 3: Tenant Isolation (Status: PASS)
* Targeting overrides (`targetOrganizationIds`, `excludedOrganizationIds`) work strictly per tenant.
* Automated testing proves enabling a feature for Organization A has zero impact on Organization B.

### Layer 4: Client Session Feature Bootstrapping (Status: PARTIAL)
* `GET /api/v1/auth/me` and `GET /api/v1/employees/me` invoke `FeatureFlagService.getAllResolvedFlags()` and return a dictionary of resolved booleans.
* **Failure:** In `src/context/RoleContext.tsx`, `refreshFeatures()` is only invoked on initial mount or when the user manually switches roles in local storage. There is no WebSocket, Server-Sent Event (SSE), or cache-busting push mechanism when a Super Admin toggles a flag.

### Layer 5: Frontend Navigation Sidebar (Status: FAIL)
* `src/components/AppShell.tsx` defines static arrays for `adminNavSections`, `managerNavSections`, and `employeeNavSections`.
* Nav items (e.g., `Kiosk Terminals`, `AI Course Builder`, `Office Map`, `Leaderboard`) are rendered unconditionally for authorized roles.
* **Result:** Disabling a feature leaves dead links in the sidebar navigation.

### Layer 6: Dashboard Widgets & Summary Cards (Status: FAIL)
* `AdminDashboard.tsx`, `ManagerDashboard.tsx`, and `EmployeeDashboard.tsx` render cards, milestone widgets, and quick-action buttons without checking `hasFeature()`.
* **Result:** Users see cards and metrics for disabled features.

### Layer 7: Route Guards (Status: PARTIAL)
* `src/components/ProtectedRoute.tsx` includes feature flag evaluation:
  ```typescript
  if (featureFlag && !hasFeature(featureFlag)) {
    return <FeatureUnavailableAlert />;
  }
  ```
* **Failure:** Only 5 of 37 routes in `App.tsx` supply `featureFlag`. The remaining 32 routes allow direct URL access.

### Layer 8: Component Actions & Buttons (Status: FAIL)
* Within pages (e.g., Journey Builder step adding, Document signing canvas, Milestone submissions), individual action buttons do not check feature flags.
* Clicking a button either succeeds because the API is unguarded, or triggers an unhandled HTTP 403 toast error.

### Layer 9: API Boundary Enforcement (Status: FAIL)
* Only `kiosk` and `ai` modules enforce `requireFeatureFlag`.
* 25 modules accept requests from any authenticated user with the matching role, completely bypassing the feature flag control plane.

### Layer 10: Audit Logging (Status: PASS)
* Authoritative records are written to `audit_logs` with actor ID, IP address, timestamp, and previous/new state payloads.

---

## 4. Remediation Requirement Summary

To achieve full Administrative Effectiveness, the platform must implement:
1. **Nav Items Gating:** Add `featureFlag?: string` to `NavItem` in `AppShell.tsx` and filter via `hasFeature()`.
2. **Dashboard Card Gating:** Wrap dashboard widgets in capability/feature conditional guards.
3. **Route Guarding:** Add `featureFlag` attributes to all gated routes in `App.tsx`.
4. **Backend API Middleware:** Attach `requireFeatureFlag()` hooks across all 25 ungoverned modules.
5. **Session Quarantine Revocation:** Invalidate active JWT sessions upon organization quarantine.
