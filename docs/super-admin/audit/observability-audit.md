# Super Admin Technical Observability & Telemetry Audit

> **Document Status:** Authoritative Observability Audit  
> **System:** Talnova Onboarding Enterprise Control Plane  
> **Telemetry Vectors:** HTTP Traffic, System Logs, Host/Process Infrastructure, Database Cluster, Gemini AI Tokens, and Cloud Storage.  

---

## 1. Executive Summary of Observability Suite

The Observability Suite (`SuperAdminObservability.tsx`) provides 5 dedicated telemetry vectors:
1. **API Observability:** Latency distribution, requests per minute, error rates, and top routes.
2. **System Logs:** Live audit and system log viewer.
3. **Infrastructure & DB:** Node.js runtime process health and MongoDB collection volumes.
4. **AI Observability:** Gemini AI token consumption and estimated costs.
5. **Storage & Media:** Cloudflare R2 object storage volumes by media category.

### Summary Verdict:
* **Infrastructure and Storage vectors** are **functional and accurate**, querying live process metrics and real `Upload` records.
* **API and AI vectors** are **mock placeholders returning static hardcoded constants**.

---

## 2. Granular Vector Analysis

### 2.1 API Request Observability (`GET /observability/api`)
* **Documented Requirement:** `docs/super-admin/observability-model.md` specifies an in-memory telemetry ring buffer capturing HTTP request latencies to compute rolling P50, P95, and P99 percentiles, throughput RPM, and route-by-route health.
* **Current Implementation:**
  * Fastify logs requests to `stdout` via Pino (`logging.middleware.ts`), but does NOT buffer metrics in memory or database.
  * In `super-admin.routes.ts:1704-1730`, the endpoint returns static mock constants:
    ```typescript
    latency: { p50: 28, p95: 64, p99: 118, unit: "ms" },
    throughput: { rpm: 342, successRate: 99.84, errorRate: 0.16 },
    endpoints: [
      { route: "GET /api/v1/super-admin/telemetry", p95: 42, count24h: 1820, status: "healthy" }, ...
    ]
    ```
* **Remediation:** Implement a circular ring buffer (`TelemetryBuffer`) holding the last 5,000 requests to compute real percentiles on demand.

### 2.2 System Logs (`GET /activity` with category="system")
* **Current Implementation:** Correctly queries `AuditLog` collection filtered by `eventCategory = "system"`, supporting severity filtering and pagination.
* **Verdict: FULLY IMPLEMENTED.**

### 2.3 Infrastructure & Database Health (`GET /observability/infrastructure`)
* **Current Implementation:**
  * Process memory: Queries `process.memoryUsage()` to return live RSS, Heap Total, Heap Used, and External MB.
  * Uptime: Queries `process.uptime()` to return uptime in seconds and formatted hours/minutes.
  * Database: Evaluates `mongoose.connection.readyState` and queries document counts across primary collections (`organizations`, `users`, `journeys`, `tasks`, `uploads`, `audit_logs`).
* **Verdict: FULLY IMPLEMENTED.**

### 2.4 AI Observability & Cost Tracking (`GET /observability/ai`)
* **Documented Requirement:** Real-time tracking of Gemini 1.5 Flash/Pro multimodal tokens, prompt/completion ratios, estimated USD costs, and per-tenant attribution.
* **Current Implementation:**
  * In `super-admin.routes.ts:1781-1799`, returns static mock constants (`tokensConsumed: 482000, costEstimateUSD: 1.45`).
  * **Root Cause in `ai-provider.service.ts`:** When calling LLM providers, the service extracts only `content` and discards provider response token metadata (`promptTokenCount`, `candidatesTokenCount`, etc.).
  * No `AIUsageRecord` Mongoose model exists.
* **Remediation:** Instrument `AIProviderService` to capture token usage and latency, and persist them into an `AIUsageRecord` collection.

### 2.5 Storage & Media Operations (`GET /observability/storage`)
* **Current Implementation:**
  * Executes a live MongoDB aggregation pipeline over `Upload` collection (`lifecycle.status != "deleted"`), grouping by `type` and summing `fileSizeBytes`.
  * Computes total bytes, total files, and breakdowns for video, document, and image assets.
* **Verdict: FULLY IMPLEMENTED.** (Missing only orphaned file scanning).
