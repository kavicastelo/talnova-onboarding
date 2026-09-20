# Cache & State Synchronization Forensic Audit

> **Document Status:** Authoritative Caching & Synchronization Specification  
> **System:** Talnova Onboarding Enterprise Control Plane  
> **Evaluation Scope:** In-Memory TTL, React Context State, Browser Cache & Stale States  
> **Date:** September 2026  

---

## 1. Executive Summary

Feature toggles must propagate reliably to avoid **state synchronization bugs** where:
* The backend considers a feature disabled, but the frontend still believes it is enabled (triggering 403 errors on user clicks).
* The backend considers a feature enabled, but the frontend still hides the feature due to stale cached tokens or local storage.

This audit evaluates the caching layers across the backend, API gateway, and client application.

---

## 2. Caching Layer Inventory

```
┌──────────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER SESSION                    │
│  - localStorage ('user_role', 'auth_token')                  │
│  - React useState in RoleContext ('features' dictionary)     │
│  - React Query in-memory cache (default: 5-minute staleTime) │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP Request (Bearer JWT)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                  FASTIFY SERVER MEMORY                       │
│  - FeatureFlagService.cache: Map<string, CacheEntry>         │
│  - Cache TTL: 60,000 ms (60 seconds)                         │
│  - Invalidation: Synchronous on PATCH /settings/flags/:key   │
└──────────────────────────────┬───────────────────────────────┘
                               │ Mongoose Query
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     MONGODB ATLAS                            │
│  - Authoritative Collection: 'feature_flags'                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Forensic Cache Synchronization Audit

### 3.1 Backend In-Memory Cache (`FeatureFlagService.ts`)
* **TTL:** 60 seconds (`CACHE_TTL_MS = 60 * 1000`).
* **Cache Key:** Normalized lower-case flag key string.
* **Invalidation Trigger:** `FeatureFlagService.invalidateCache(normalizedKey)` is called inside `super-admin.service.ts` whenever a flag is toggled or tenant overrides are updated.
* **Audit Finding:** Within a single server instance, cache invalidation is immediate. Tests verify that requests made 10ms after mutation reflect the new state.
* **Vulnerability in Multi-Cluster Deployments:** Because the cache is an in-memory Node.js `Map`, if the platform is deployed with multiple Fastify replicas behind a load balancer, only the worker receiving the PATCH request invalidates its cache. Other workers will serve stale flag states for up to 60 seconds.

### 3.2 Client State Invalidation (`RoleContext.tsx`)
* **State Location:** `const [features, setFeatures] = useState<Record<string, boolean>>({});`
* **Bootstrap Mechanism:** Fetches `/auth/me` on component mount or when `role` state changes.
* **Audit Finding (Critical Synchronization Flaw):**
  There is **no push mechanism** (WebSockets or Server-Sent Events) informing the browser that a feature flag was modified by Super Admin.
  * *Scenario:* User Alice is working in the app. Super Admin disables `kiosk_mode`. Alice's React state continues holding `{ kiosk_mode: true }`. Alice clicks on the Kiosk navigation link. The route allows access. When Alice makes an API call, the backend rejects with 403. Alice only sees the updated state if she manually reloads the browser window.

### 3.3 React Query Cache Gaps
* Queries using `@tanstack/react-query` across the application default to a 5-minute `staleTime`.
* Mutations performed in Super Admin do not invalidate user-facing tenant queries in active browser sessions.

---

## 4. Remediation Standard for Real-Time Synchronization

1. **Server-Sent Events (SSE) or WebSocket Invalidation:**
   Expose an authenticated SSE stream (`GET /api/v1/auth/events`) where the frontend listens for `FEATURE_FLAGS_UPDATED` events and calls `refreshFeatures()`.
2. **Distributed Cache Invalidation:**
   Integrate Redis Pub/Sub in `FeatureFlagService` to broadcast `INVALIDATE_FLAG_CACHE` to all server replicas upon flag mutation.
3. **Optimistic Pre-Flight Token Checks:**
   Include a short-lived feature configuration hash (`etag`) in API responses. If the client hash mismatches the server hash, trigger a background `refreshFeatures()` automatically.
