# Feature Governance System Forensic Audit

> **Document Status:** Authoritative Feature Governance Audit  
> **System:** Talnova Onboarding Enterprise Control Plane  
> **Target Subsystem:** Feature Flag Service, Audience Targeting & Precedence Engine  
> **Date:** September 2026  

---

## 1. Executive Summary

The feature governance system was introduced during the initial remediation phase (`SA-PF-001` and `SA-PF-002`) to replace an unmodeled MongoDB collection with a schema-backed Mongoose model (`FeatureFlag`) and an in-memory resolution service (`FeatureFlagService`).

This audit evaluates:
1. The mathematical and logical soundness of the resolution model.
2. Audience targeting capabilities (Global, Organizations, Roles, Percentage).
3. The scope of features currently governed vs. the actual 105+ feature platform inventory.
4. Caching and invalidation mechanics.

---

## 2. Evaluation of the Resolution Model

### Precedence Hierarchy
`FeatureFlagService.isEnabled(key, orgId, role)` enforces the following precedence sequence:

```mermaid
graph TD
    Start["Check Request (Flag Key, Org ID, User Role)"] --> Cache["Retrieve Flag Model (Memory Cache / DB)"]
    Cache --> Found{Flag Exists & Not Deleted?}
    Found -- No --> DenyDefault["DENY (false)"]
    Found -- Yes --> Excluded{Org in excludedOrganizationIds?}
    Excluded -- Yes --> DenyExcluded["DENY (Strict Deny Precedence)"]
    Excluded -- No --> Targeted{Org in targetOrganizationIds?}
    Targeted -- Yes --> AllowWhitelisted["ALLOW (Early Access Whitelist)"]
    Targeted -- No --> GlobalKill{isEnabled == true?}
    GlobalKill -- No --> DenyGlobal["DENY (Global Kill Switch)"]
    GlobalKill -- Yes --> Audience{targetAudience}
    Audience -- organizations --> DenyNotTargeted["DENY (Org Not in Whitelist)"]
    Audience -- roles --> RoleCheck{role in targetRoles?}
    RoleCheck -- Yes --> AllowRole["ALLOW"]
    RoleCheck -- No --> DenyRole["DENY"]
    Audience -- global / percentage --> RolloutCheck{Hash(Seed) < Rollout%?}
    RolloutCheck -- Yes --> AllowRollout["ALLOW"]
    RolloutCheck -- No --> DenyRollout["DENY"]
```

### Audit Findings on Resolution Logic
1. **Deny Dominance Verified:** If an organization is listed in `excludedOrganizationIds`, it is rejected immediately, even if it is also listed in `targetOrganizationIds` or if global enablement is true.
2. **Whitelist Bypass Verified:** An organization listed in `targetOrganizationIds` receives access even if `isEnabled == false`. This correctly enables Private Beta testing for select enterprise tenants.
3. **Deterministic Rollout Hashing:** Progressive rollouts (0–100%) use an integer hash bucket over `orgId:flagKey`. An organization with a given ID consistently falls into the same bucket across requests without session stickiness issues.

---

## 3. Critical Governance Deficiencies Discovered

### Defect 1: Governance Scope Disconnect (6 Flags vs. 105 Features)
The `DEFAULT_PLATFORM_FLAGS` array in `super-admin.service.ts` seeds only 6 feature flags:
1. `ai_course_builder` (Intelligence)
2. `multi_org_switch` (Access)
3. `advanced_reporting` (Compliance)
4. `scim_provisioning` (Identity)
5. `onboarding_copilot` (AI Assistant)
6. `gamified_milestones` (Engagement)

**Impact:** Over 94% of the platform's user-facing capabilities cannot be governed, toggled, or observed by Super Admins. Features like E-Signatures, Kiosks, HRIS Integrations, Office Maps, Buddy System, and Tasks operate completely outside the governance system.

### Defect 2: Tri-Layer Key Decoupling
A severe defect exists in key naming across the three platform layers:

| Target Capability | Backend Model Key | Frontend Route Key | Feature Adoption Card ID | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Gamification** | `gamified_milestones` | `gamification_badges` | `gamification` | **COMPLETELY DECOUPLED** |
| **AI Course Builder**| `ai_course_builder` | `ai_course_builder` | `ai-courses` | **ADOPTION MISMATCH** |
| **SSO Gateway** | *(Not Seeded)* | `sso_enforcement` | `sso-enterprise` | **MODEL MISSING** |
| **HRIS Webhooks** | *(Not Seeded)* | `advanced_hris_sync` | `hris-webhooks` | **MODEL MISSING** |
| **Kiosk Terminals** | *(Not Seeded)* | `kiosk_mode` | `kiosk-terminals` | **MODEL MISSING** |

**Impact:** Because the keys do not match, toggling `gamified_milestones` in Super Admin does not affect `/leaderboard` in `App.tsx` (which looks for `gamification_badges`), and neither affects `SuperAdminFeatures.tsx` (which references `gamification`).

### Defect 3: Missing Role-Level Feature Governance UI
While the Mongoose model contains `targetRoles: ['owner', 'admin', 'manager', 'employee', 'it_admin']`, the Super Admin management modal (`SuperAdminFeatureFlags.tsx`) does **not** expose UI controls to select target roles. Administrators can only configure organization whitelists, exclusions, and percentage rollouts.

### Defect 4: In-Memory Cache Invalidation in Distributed Environments
`FeatureFlagService` uses a static in-memory `Map<string, CacheEntry>` with a 60-second TTL. While `invalidateCache()` is called locally when a flag is edited, in a horizontally scaled multi-instance deployment (e.g., Kubernetes or multi-worker Node clusters), instances other than the one handling the mutation will continue serving stale cached flag states for up to 60 seconds.

---

## 4. Feature Coverage Audit Statistics

Based on the canonical registry of 105 product capabilities:

```text
Total Meaningful Product Capabilities:  105 (100.0%)
Capabilities with Feature Flags:           6 (  5.7%)
Capabilities with Org-Level Overrides:     6 (  5.7%)
Capabilities with Role-Level Gating:       0 (  0.0% in UI)
Capabilities with Frontend Route Guards:   5 (  4.8%)
Capabilities with Navigation Filters:      0 (  0.0%)
Capabilities with Backend API Guards:      2 (  1.9%)
Capabilities with Feature Adoption:        0 (  0.0% real; 5 mock)
Capabilities with Authoritative Audit:     6 (  5.7%)
```

---

## 5. Architectural Recommendations

1. **Establish Canonical Feature Key Registry:** Adopt kebab-case or snake-case naming permanently across all layers (e.g., `feat_gamification_milestones`, `feat_ai_course_builder`).
2. **Expand Default Platform Flags:** Migrate all 105+ features into the `DEFAULT_PLATFORM_FLAGS` seed list.
3. **Add Role-Targeting Controls to UI:** Add multi-select role checkboxes in `SuperAdminFeatureFlags.tsx`.
4. **Implement Redis Pub/Sub Cache Invalidation:** When running multiple API nodes, publish flag invalidation events to Redis to immediately bust cache on all workers.
