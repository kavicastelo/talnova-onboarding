# Feature Flag Data Model Specification

> **Document Status:** Authoritative Database & Schema Specification  
> **Target:** `server/src/modules/super-admin/models/feature-flag.model.ts`  
> **Mongoose Collection:** `feature_flags`  
> **Date:** September 2026  

---

## 1. Schema Architecture & Field Definitions

The `FeatureFlag` model represents the authoritative persistence layer for runtime feature enablement and audience targeting across the Talnova multi-tenant ecosystem.

```typescript
import mongoose, { Schema, Document } from "mongoose";

export interface IFeatureFlag extends Document {
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  environment: "all" | "production" | "staging" | "development";
  targetAudience: "global" | "organizations" | "roles" | "percentage";
  targetOrganizationIds: mongoose.Types.ObjectId[];
  excludedOrganizationIds: mongoose.Types.ObjectId[];
  targetRoles: ("owner" | "admin" | "manager" | "employee" | "it_admin")[];
  rolloutPercentage: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual Getters / Setters (Backward Compatibility)
  enabled: boolean;
  rolloutPct: number;

  // Instance Methods
  isOrgTargeted(orgId: string | mongoose.Types.ObjectId): boolean;
}
```

### Detailed Field Attributes
* **`key` (String):** Canonical feature key in `snake_case`. Required, unique, trimmed, lowercased. Primary query identifier.
* **`name` (String):** Human-readable name displayed in Super Admin UI and fallback alerts.
* **`description` (String):** Clear explanation of what the feature controls and business impact.
* **`isEnabled` (Boolean):** Global master switch. When `false`, the feature is disabled globally unless targeted by organization whitelist.
* **`environment` (Enum):** Scopes the flag to specific runtime environments (`all`, `production`, `staging`, `development`).
* **`targetAudience` (Enum):**
  * `global`: Evaluated globally based on `isEnabled` and `rolloutPercentage`.
  * `organizations`: Strictly restricted to tenants in `targetOrganizationIds`.
  * `roles`: Restricted to specific user roles in `targetRoles`.
  * `percentage`: Progressive rollout based on deterministic tenant hashing.
* **`targetOrganizationIds` (Array of ObjectId):** Whitelisted tenants granted access.
* **`excludedOrganizationIds` (Array of ObjectId):** Blacklisted tenants denied access (takes precedence over whitelists).
* **`targetRoles` (Array of String):** Specific roles permitted to access the feature.
* **`rolloutPercentage` (Number, 0–100):** Percentage threshold for progressive rollouts.
* **`isDeleted` (Boolean):** Soft-deletion flag for audit preservation.

---

## 2. Database Indexes & Performance Optimization

```typescript
FeatureFlagSchema.index({ key: 1 }, { unique: true });
FeatureFlagSchema.index({ targetOrganizationIds: 1 });
FeatureFlagSchema.index({ excludedOrganizationIds: 1 });
FeatureFlagSchema.index({ isDeleted: 1 });
```

* High-frequency lookups occur on `key` during cache misses.
* Fast array queries for organization membership lookups.

---

## 3. Authoritative Instance Method: `isOrgTargeted`

```typescript
FeatureFlagSchema.methods.isOrgTargeted = function (orgId: string | mongoose.Types.ObjectId): boolean {
  const orgStr = orgId.toString();

  // 1. Strict Deny Precedence
  if (this.excludedOrganizationIds?.some((id: any) => (id._id || id).toString() === orgStr)) {
    return false;
  }

  // 2. Early Access Whitelist Override
  if (this.targetOrganizationIds?.some((id: any) => (id._id || id).toString() === orgStr)) {
    return true;
  }

  // 3. Global Kill Switch
  if (!this.isEnabled) {
    return false;
  }

  // 4. Organization-Only Audience Rule
  if (this.targetAudience === "organizations") {
    return false;
  }

  // 5. Zero Rollout Check
  if (this.rolloutPercentage === 0) {
    return false;
  }

  return true;
};
```
