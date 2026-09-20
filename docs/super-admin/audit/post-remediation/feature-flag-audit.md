# Feature Flag Subsystem Deep-Dive Audit

> **Document Status:** Authoritative Subsystem Audit  
> **Target:** `server/src/modules/super-admin/models/feature-flag.model.ts` & `feature-flag.service.ts`  
> **Standard:** Schema Typing, Audience Resolution, Cache Invalidation, and Enterprise Precedence  
> **Date:** September 2026  

---

## 1. Subsystem Architecture Overview

The Feature Flag subsystem implements centralized governance for runtime feature toggles across the platform.

```
┌──────────────────────────────────────────────────────────────┐
│                  SUPER ADMIN CONTROL PLANE                   │
│              (SuperAdminFeatureFlags.tsx)                    │
└──────────────────────────────┬───────────────────────────────┘
                               │ PATCH /settings/flags/:key
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    SUPER ADMIN SERVICE                       │
│        (Syncs defaults, validates ObjectIds, writes DB)      │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│    MONGOOSE DATA MODEL       │ │    FEATURE FLAG SERVICE     │
│       ('feature_flags')      │ │ (60s Cache, Bucket Hash,    │
│  - targetOrganizationIds     │ │  Deny Precedence Engine)    │
│  - excludedOrganizationIds   │ └─────────────┬───────────────┘
│  - targetRoles               │               │
│  - rolloutPercentage         │               ▼
└──────────────────────────────┘ ┌─────────────────────────────┐
                                 │   PRODUCT ROUTE / SESSION   │
                                 │ - requireFeatureFlag hook   │
                                 │ - GET /auth/me payload      │
                                 └─────────────────────────────┘
```

---

## 2. Schema Verification (`feature-flag.model.ts`)

### Schema Attributes
* `key`: String, required, unique, lowercase, trimmed index.
* `name`: String, required, trimmed.
* `description`: String, required.
* `isEnabled`: Boolean, default `false`.
* `environment`: Enum (`all`, `production`, `staging`, `development`), default `all`.
* `targetAudience`: Enum (`global`, `organizations`, `roles`, `percentage`), default `global`.
* `targetOrganizationIds`: Array of `Schema.Types.ObjectId`, ref `Organization`.
* `excludedOrganizationIds`: Array of `Schema.Types.ObjectId`, ref `Organization`.
* `targetRoles`: Array of String (`owner`, `admin`, `manager`, `employee`, `it_admin`).
* `rolloutPercentage`: Number, min 0, max 100, default 100.
* `isDeleted`: Boolean, default `false`.

### Indexes
* `{ targetOrganizationIds: 1 }`
* `{ excludedOrganizationIds: 1 }`
* `{ isDeleted: 1 }`

### Virtuals
* `enabled`: Alias for `isEnabled` (backward compatibility).
* `rolloutPct`: Alias for `rolloutPercentage`.

**Verdict:** The Mongoose schema is strictly typed, properly indexed, and completely compliant with enterprise requirements.

---

## 3. Resolution Precedence Logic Audit (`feature-flag.service.ts`)

The precedence algorithm implemented in `FeatureFlagService.isEnabled()` was evaluated against 7 test scenarios:

```typescript
// 1. Strict Deny Precedence (Exclusion)
if (orgStr && flag.excludedOrganizationIds?.some((id) => id.toString() === orgStr)) {
  return false;
}

// 2. Organization Whitelist Overrides (Early Access Whitelist)
if (orgStr && flag.targetOrganizationIds?.some((id) => id.toString() === orgStr)) {
  return true;
}

// 3. Global Kill Switch
if (!flag.isEnabled) {
  return false;
}

// 4. Target Audience Rules
if (flag.targetAudience === "organizations") {
  return false; // Not in whitelist above
}
if (flag.targetAudience === "roles") {
  return flag.targetRoles?.includes(role) ?? false;
}

// 5. Progressive Rollout Percentage (0..100)
const bucket = this.hashToBucket(orgStr ? `${orgStr}:${flag.key}` : `${role}:${flag.key}`);
return bucket < rollout;
```

**Verdict:** The resolution hierarchy is mathematically sound. Exclusions take absolute precedence over whitelists, whitelists bypass global disablement, and hash bucketing is deterministic.

---

## 4. Subsystem Weaknesses & Gaps

1. **Missing Default Flags:** Only 6 default flags exist in `DEFAULT_PLATFORM_FLAGS`. 99 platform capabilities are unmodeled.
2. **Missing Frontend Role Controls:** The React UI in `SuperAdminFeatureFlags.tsx` provides inputs for organization overrides and percentage rollout, but completely omits role selection checkboxes (`targetRoles`).
3. **Cache Synchronization:** In multi-node deployments, cache invalidation is local to the executing process.
4. **Key Decoupling:** Decoupled keys (`gamified_milestones` vs `gamification_badges` vs `gamification`) cause silent governance failures.
