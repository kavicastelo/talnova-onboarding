# Feature Flag Resolution & Precedence Engine

> **Document Status:** Authoritative Resolution Specification  
> **Target:** `server/src/modules/super-admin/services/feature-flag.service.ts`  
> **Engine:** `FeatureFlagService.isEnabled()`  
> **Date:** September 2026  

---

## 1. Resolution Algorithm Overview

The evaluation of a feature flag must be **deterministic, low-latency, and strictly hierarchical**. The `FeatureFlagService` resolves whether a feature is available for a given execution context:

$$\text{Evaluate}(k, \text{orgId}, \text{role}) \longrightarrow \text{Boolean (true / false)}$$

---

## 2. Precedence Order Hierarchy

The service evaluates rules strictly in the following sequence:

```
Step 1: Check In-Memory Cache (TTL: 60s)
           │ (If hit, use cached model; if miss, query MongoDB)
           ▼
Step 2: Check Flag Existence & Deletion
           │ (If not found or isDeleted == true, return FALSE)
           ▼
Step 3: Organization Exclusion (Strict Deny Precedence)
           │ (If orgId in excludedOrganizationIds, return FALSE immediately)
           ▼
Step 4: Organization Whitelist (Selective Early Access)
           │ (If orgId in targetOrganizationIds, return TRUE immediately)
           ▼
Step 5: Global Master Switch
           │ (If isEnabled == false, return FALSE)
           ▼
Step 6: Target Audience Verification
           ├─ If targetAudience == 'organizations': return FALSE (not in whitelist)
           ├─ If targetAudience == 'roles':
           │     return (role in targetRoles)
           └─ If targetAudience == 'global' or 'percentage':
                 Proceed to Step 7
           ▼
Step 7: Progressive Percentage Rollout Hashing
           │ Hash(orgId:flagKey) % 100 < rolloutPercentage
           ▼
        Return Boolean
```

---

## 3. Mathematical Hashing for Progressive Rollout

To ensure consistent tenant experiences across requests without database lookups on every calculation, the engine uses a 32-bit integer string hash:

```typescript
private static hashToBucket(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100; // Returns 0..99
}
```

* **Deterministic Seed:** `${orgId}:${flag.key}`
* An organization with ID `6aaf11...` evaluating flag `ai_course_builder` consistently hashes to the exact same bucket (e.g. `42`).
* If `rolloutPercentage` is set to `50`, bucket `42` receives access (`42 < 50`). If decreased to `40`, bucket `42` is immediately cut off.

---

## 4. In-Memory Caching & Real-Time Invalidation

```typescript
interface CacheEntry {
  flag: IFeatureFlag | null;
  expiresAt: number;
}
```

* **TTL:** 60,000 ms (60 seconds).
* **Safe Fallback:** On database transient errors, the service returns the cached document if available.
* **Synchronous Invalidation:** When a flag is modified via Super Admin:
  ```typescript
  FeatureFlagService.invalidateCache(normalizedKey);
  ```
  This immediately removes the entry from the in-memory map, forcing the next evaluation to fetch the updated document from MongoDB.
