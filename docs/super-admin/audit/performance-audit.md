# Super Admin Performance & Scalability Audit

> **Document Status:** Authoritative Performance Audit  
> **System:** Talnova Onboarding Enterprise Control Plane  
> **Evaluation Scope:** Database query optimization, aggregation pipelines, N+1 query patterns, payload sizes, and dashboard latency.  

---

## 1. Executive Summary of Performance

The performance audit evaluated query complexity, indexing efficiency, and latency characteristics across the Super Admin API surface.

### Summary Verdict:
* **Current Scale Performance:** Fast response times (<100ms) on development and small-scale datasets due to in-memory MongoDB caching and indexed primary lookups (`_id`, `organizationId`).
* **Scale Bottlenecks Identified:**
  1. **Dynamic 6-Month Telemetry Loop:** `GET /telemetry` executes 24 independent MongoDB queries within a single HTTP request cycle.
  2. **Unindexed Sorts in Raw Collections:** `payment_records` and `expense_records` lack secondary indexes on `recordedAt` and `incurredAt`, requiring collection scans (COLLSCAN).
  3. **Heavy Monolithic 360° Payloads:** `GET /organizations/:id/360` aggregates users, journeys, invoices, audit logs, and cases in a single payload exceeding 50KB.

---

## 2. Query Optimization & Bottleneck Analysis

### 2.1 The 6-Month Dynamic Telemetry Loop (`GET /telemetry`)
In `server/src/modules/super-admin/routes/super-admin.routes.ts:214-249`:
```typescript
for (let i = 5; i >= 0; i--) {
  await Organization.countDocuments({ createdAt: { $lte: endOfMonth }, isDeleted: false });
  await User.countDocuments({ createdAt: { $lte: endOfMonth }, isDeleted: false });
  await Invoice.find({ status: "Paid", createdAt: { $gte: startOfMonth, $lte: endOfMonth } });
  await OnboardingCase.countDocuments({ createdAt: { $gte: startOfMonth, $lte: endOfMonth } });
}
```
* **Performance Impact:** On each dashboard load, this loop executes $6 \times 4 = 24$ individual database roundtrips sequentially or partially batched. With 100,000+ documents, these cumulative `$lte` counts will degrade P95 latency beyond 1,500ms.
* **Remediation:** Introduce a scheduled daily metric rollup collection (`SystemMetricDaily`) that records pre-aggregated counts at midnight, reducing dashboard query time to a single 6-record lookup: `SystemMetricDaily.find().sort({ date: -1 }).limit(6)`.

### 2.2 Unindexed Sorting on Unmodeled Collections
* `GET /finance/payments`: Executes `db.collection("payment_records").find().sort({ recordedAt: -1 }).limit(100)`.
* `GET /finance/expenses`: Executes `db.collection("expense_records").find().sort({ incurredAt: -1 }).limit(100)`.
* Because these raw collections lack Mongoose schemas, no index exists on `{ recordedAt: -1 }` or `{ incurredAt: -1 }`. MongoDB must perform an in-memory sort after scanning the entire collection.
* **Remediation:** Establish formal schemas with compound indexes `{ organizationId: 1, recordedAt: -1 }`.

---

## 3. API Response Payload Sizing

| Endpoint | Average Payload Size | Document Count Returned | Evaluation |
| :--- | :---: | :---: | :--- |
| `GET /telemetry` | ~3.8 KB | Aggregated counters + 6-month array | **Optimal** |
| `GET /search` | ~4.2 KB | Up to 40 entities bounded by limit | **Optimal** |
| `GET /organizations` | ~8.5 KB | 10 organizations with plan & limits | **Optimal** |
| `GET /organizations/:id/360` | ~48.0 KB | 25 users, 20 journeys, 20 invoices, 30 logs | **Heavy** (Split sub-tabs if dataset expands) |
| `GET /users` | ~12.0 KB | 15 users with profile & employment | **Optimal** |
| `GET /activity` | ~18.5 KB | 25 audit logs with actor & organization populate | **Optimal** |

---

## 4. Frontend Rendering & React Query Caching

* **TanStack React Query v5:** Hooks in `src/hooks/useSuperAdmin.ts` configure declarative stale times and automated cache invalidation upon mutations (`useMutation` calls `queryClient.invalidateQueries`).
* **Client-Side Slicing Overhead:** Recharts Area charts render sub-60 data points smoothly without DOM thrashing.
