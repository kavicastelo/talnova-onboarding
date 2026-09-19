# Super Admin REST API Specification & Endpoint Contracts

> **Document Status:** Authoritative API Specification  
> **System:** Talnova Onboarding Enterprise Platform  
> **Prefix:** `/api/v1/super-admin`  
> **Authentication:** Mandatory Bearer JWT (`requireRole(["super_admin"])`)

---

## 1. Executive Summary of API Surface

The Super Admin API surface is structured into 13 cohesive domain resource namespaces:

```text
/api/v1/super-admin
├── /dashboard               (Command Center KPIs, Telemetry, System Health)
├── /search                  (Cross-Domain Global Entity Search)
├── /organizations           (Tenant Workspace Directory & 360° Profile)
├── /users                   (Platform User Directory, 360° Profile & Sessions)
├── /onboarding              (Onboarding Cases, Journey Progress & Bottlenecks)
├── /activity                (Global Activity & Behavior Event Stream)
├── /observability           (API Traffic, System Logs, Infrastructure, Database)
├── /ai                      (AI Invocations, Token Usage, Latency & Costs)
├── /storage                 (Cloudflare R2 Storage Quotas & Media Distribution)
├── /finance                 (Accounts, Invoices, Payment Ledger, Expenses & P&L)
├── /alerts                  (Unified Incident & Alert Workbench)
├── /reports                 (Centralized Multi-Domain Report Exporters)
└── /settings                (Feature Flags & Global Platform Configuration)
```

---

## 2. Granular API Contracts

### 2.1 Command Center & Global Search
* `GET /api/v1/super-admin/dashboard/telemetry`
  * **Query:** `range` (default: "30d"), `orgId` (optional).
  * **Response:** `{ stats: { totalTenants, activeTenants, platformUsers, activeOnboardings, revenueCash, expensesTotal, netOperatingResult, openAlerts, errorRatePct, p95LatencyMs, systemHealthStatus }, growthData: [...] }`
* `GET /api/v1/super-admin/search`
  * **Query:** `q` (min 2 chars), `limit` (default: 15).
  * **Response:** `{ organizations: [...], users: [...], journeys: [...], invoices: [...], alerts: [...] }`

### 2.2 Organizations Management
* `GET /api/v1/super-admin/organizations`
  * **Query:** `search`, `status` ("Active" | "Suspended"), `plan`, `page` (default: 1), `limit` (default: 10).
  * **Response:** `{ data: [{ id, name, domain, slug, plan, status, usersCount, seatLimit, storageGb, createdAt }], total, page, totalPages }`
* `GET /api/v1/super-admin/organizations/:id/360`
  * **Params:** `id` (ObjectId or slug).
  * **Response:** `{ organization, usersSummary, onboardingSummary, storageSummary, financeSummary, recentActivity, openAlerts }`
* `POST /api/v1/super-admin/organizations`
  * **Body:** `{ name, domain, slug, plan, adminEmail, supportEmail }`
  * **Response:** `201 Created` with provisioned organization and initial Owner account.
* `PATCH /api/v1/super-admin/organizations/:id`
  * **Body:** `{ name?, plan?, status?, seatLimit?, maxStorageGb?, notes? }`
* `PATCH /api/v1/super-admin/organizations/:id/status`
  * **Body:** `{ status: "Active" | "Suspended", reason: string }`

### 2.3 Users & Access Management
* `GET /api/v1/super-admin/users`
  * **Query:** `search`, `role`, `status`, `organizationId`, `page`, `limit`.
  * **Response:** `{ data: [{ id, fullName, email, role, organizationName, status, lastLoginAt, createdAt }], total, page }`
* `GET /api/v1/super-admin/users/:id/360`
  * **Params:** `id` (ObjectId).
  * **Response:** `{ user, organization, activeSessions, assignments, tasks, signedDocuments, aiUsage, auditHistory }`
* `PATCH /api/v1/super-admin/users/:id/status`
  * **Body:** `{ status: "active" | "inactive" | "on_leave" | "terminated", reason: string }`
* `PATCH /api/v1/super-admin/users/:id/role`
  * **Body:** `{ role: "owner" | "admin" | "manager" | "employee" | "it_admin" | "super_admin", reason: string }`
* `GET /api/v1/super-admin/users/sessions`
  * **Query:** `userId?`, `organizationId?`, `page`, `limit`.
  * **Response:** `{ data: [{ id, userId, userEmail, orgName, ipAddress, deviceInfo, lastActivityAt, expiresAt, isValid }] }`
* `POST /api/v1/super-admin/users/sessions/:id/revoke`
  * **Response:** `{ success: true, message: "Session terminated" }`

### 2.4 Onboarding & Journey Observability
* `GET /api/v1/super-admin/onboarding/overview`
  * **Response:** `{ activeCases, averageDurationDays, completionRate, dropOffRiskCount, provisioningFailedCount }`
* `GET /api/v1/super-admin/onboarding/cases`
  * **Query:** `state`, `organizationId`, `search`, `page`, `limit`.
  * **Response:** `{ data: [{ id, employeeName, orgName, state, source, transitions, failure, createdAt }], total }`
* `GET /api/v1/super-admin/onboarding/bottlenecks`
  * **Response:** `{ stalledStages: [...], highFailureQuizzes: [...], overdueTaskCategories: [...] }`
* `GET /api/v1/super-admin/onboarding/cases/:id`
  * **Response:** Detailed case timeline, step-by-step progress, and transition logs.

### 2.5 Technical Observability & System Logs
* `GET /api/v1/super-admin/observability/api-traffic`
  * **Query:** `window` ("15m", "1h", "24h").
  * **Response:** `{ rpm, totalRequests, errorRatePct, p50LatencyMs, p95LatencyMs, p99LatencyMs, topEndpoints: [...], trafficByOrg: [...] }`
* `GET /api/v1/super-admin/observability/logs`
  * **Query:** `severity`, `search`, `reqId`, `service`, `page`, `limit`.
  * **Response:** `{ data: [{ timestamp, severity, message, reqId, correlationId, service, metadata }], total }`
* `GET /api/v1/super-admin/observability/infrastructure`
  * **Response:** `{ process: { rssMb, heapUsedMb, heapTotalMb, uptimeSeconds, eventLoopLagMs }, os: { cpus, loadAvg, freeMemMb, totalMemMb }, database: { status, pingMs, totalCollections, dataSizeMb, indexSizeMb, connections } }`

### 2.6 AI Observability & Cost Tracking
* `GET /api/v1/super-admin/ai/overview`
  * **Query:** `range`, `orgId`.
  * **Response:** `{ totalCalls, inputTokens, outputTokens, totalTokens, estimatedCostUsd, avgLatencyMs, errorRatePct, providerDistribution: [...], topFeatures: [...] }`
* `GET /api/v1/super-admin/ai/usage`
  * **Query:** `organizationId`, `provider`, `model`, `page`, `limit`.
  * **Response:** Paginated list of granular `AIUsageRecord` documents.

### 2.7 Storage & Media Operations
* `GET /api/v1/super-admin/storage/overview`
  * **Response:** `{ totalStorageBytes, totalFiles, mediaDistribution: { videoBytes, pdfBytes, imageBytes, otherBytes }, topOrganizations: [...] }`
* `GET /api/v1/super-admin/storage/orphaned`
  * **Response:** `{ orphanedFiles: [{ id, fileName, fileSizeBytes, uploadedAt, orgName }] }`

### 2.8 Internal B2B Finance & Invoicing
* `GET /api/v1/super-admin/finance/overview`
  * **Query:** `range` (default: "30d").
  * **Response:** `{ grossInvoiced, cashCollected, outstandingReceivables, overdueAmount, recordedExpenses, netOperatingResult, collectionEfficiencyPct }`
* `GET /api/v1/super-admin/finance/accounts`
  * **Query:** `search`, `status`, `page`, `limit`.
  * **Response:** `{ data: [{ id, organizationName, accountStatus, billingCycle, preferredCurrency, balanceDue }], total }`
* `GET /api/v1/super-admin/finance/invoices`
  * **Query:** `search`, `status`, `organizationId`, `page`, `limit`.
  * **Response:** `{ data: [{ id, invoiceNo, orgName, totalAmount, amountPaid, balanceDue, status, issueDate, dueDate }], total }`
* `POST /api/v1/super-admin/finance/invoices`
  * **Body:** `{ organizationId, lineItems: [{ description, quantity, unitPrice }], discountAmount?, taxAmount?, dueDate, notes? }`
* `GET /api/v1/super-admin/finance/invoices/:id`
  * **Response:** Full invoice dossier with itemized line items, payment history, and printable view data.
* `PATCH /api/v1/super-admin/finance/invoices/:id/status`
  * **Body:** `{ status, reason }`
* `POST /api/v1/super-admin/finance/payments`
  * **Body:** `{ invoiceId, amount, currency, paymentDate, paymentMethod, referenceNumber, notes? }`
* `GET /api/v1/super-admin/finance/expenses`
  * **Query:** `category`, `search`, `page`, `limit`.
  * **Response:** Paginated list of operational expenses.
* `POST /api/v1/super-admin/finance/expenses`
  * **Body:** `{ category, vendor, amount, currency, expenseDate, description, isRecurring? }`
* `GET /api/v1/super-admin/finance/export`
  * **Query:** `type` ("invoices" | "payments" | "expenses" | "pnl"), `format` ("csv").
  * **Response:** Direct streaming CSV download with `DATA_EXPORTED` audit log.

### 2.9 Unified Alert & Incident Workbench
* `GET /api/v1/super-admin/alerts`
  * **Query:** `status` ("open" | "acknowledged" | "resolved"), `severity`, `category`, `page`, `limit`.
  * **Response:** `{ data: [{ id, alertNo, severity, category, title, description, status, createdAt }], total }`
* `PATCH /api/v1/super-admin/alerts/:id/status`
  * **Body:** `{ status: "acknowledged" | "investigating" | "resolved" | "ignored", resolutionNotes? }`

### 2.10 Configuration & Feature Flags
* `GET /api/v1/super-admin/settings/flags`
  * **Response:** `{ flags: [{ id, key, name, description, isEnabled, environment, targetAudience, rolloutPercentage }] }`
* `POST /api/v1/super-admin/settings/flags`
  * **Body:** `{ key, name, description, isEnabled, targetAudience, targetOrganizationIds?, rolloutPercentage? }`
* `PATCH /api/v1/super-admin/settings/flags/:id`
  * **Body:** `{ isEnabled?, rolloutPercentage?, targetOrganizationIds?, reason }`
