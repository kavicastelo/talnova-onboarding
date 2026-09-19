# Super Admin Data Availability Matrix & Gap Assessment

> **Document Status:** Authoritative Data Availability Assessment  
> **System:** Talnova Onboarding Enterprise Platform  
> **Scope:** Comprehensive audit of all 14 Super Admin domains against existing MongoDB schemas, runtime telemetry, and external providers.

---

## 1. Classification Methodology

Each proposed Super Admin capability is classified into one of six availability states:
1. **`AVAILABLE`**: Required fields exist directly in active MongoDB models and can be retrieved via simple queries.
2. **`REQUIRES AGGREGATION`**: Data exists across one or more collections but requires multi-stage MongoDB aggregation pipelines (`$group`, `$facet`, `$lookup`, `$unwind`) or time-bucket rollups.
3. **`PARTIALLY AVAILABLE`**: Foundational entity exists, but key operational attributes, timestamps, or state transitions are missing.
4. **`REQUIRES NEW MODEL`**: The product domain currently lacks database persistence for this capability (e.g. manual payment ledger, expense records, AI token records, platform alerts).
5. **`REQUIRES INFRASTRUCTURE INTEGRATION`**: Data originates from runtime processes, OS/Node.js internals, or network gateways rather than persistent collections (e.g. CPU, RAM, Event Loop lag, P95 API latency).
6. **`NOT APPLICABLE`**: Out of scope for enterprise B2B platform.

---

## 2. Master Data Availability Matrix

| Domain | Dashboard Capability | Required Data Fields | Availability Status | Source Model / Service | Gap Description & Engineering Remediation |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Executive Overview** | Total Organizations & Growth | `Organization.createdAt`, `status`, `isDeleted` | `REQUIRES AGGREGATION` | `Organization` | Aggregate counts and 30d/60d deltas via MongoDB pipeline. |
| **Executive Overview** | Platform User Count & DAU/WAU | `User.createdAt`, `auth.lastLoginAt`, `status` | `REQUIRES AGGREGATION` | `User`, `Session` | Calculate DAU/WAU/MAU using `lastLoginAt` and `Session.lastActivityAt`. |
| **Executive Overview** | Active Onboardings | `OnboardingCase.state`, `Assignment.status` | `REQUIRES AGGREGATION` | `OnboardingCase`, `EmployeeAssignment` | Filter `state: { $in: ['active', 'provisioning'] }`. |
| **Executive Overview** | Revenue & Cash Collected | Invoices, itemized amounts, payments | `REQUIRES NEW MODEL` | `Invoice`, `PaymentRecord` (New) | Current `Invoice` lacks payment records. Introduce `PaymentRecord` model. |
| **Executive Overview** | Operating Result & Expenses | Cash collected minus recorded expenses | `REQUIRES NEW MODEL` | `ExpenseRecord` (New) | No expense model exists. Introduce `ExpenseRecord` to calculate net operating result. |
| **Executive Overview** | System Reliability & Error Rate | HTTP 5xx errors / total requests | `REQUIRES INFRASTRUCTURE INTEGRATION` | In-Memory Metrics Buffer | Pino logs only write to stdout. Add in-memory rolling metrics buffer in Fastify. |
| **Executive Overview** | AI Token Usage & Costs | Prompt/completion tokens, model, cost | `REQUIRES NEW MODEL` | `AIUsageRecord` (New) | `AIProviderService` discards token metadata. Add `AIUsageRecord` collection. |
| **Executive Overview** | Open Incidents & Alerts | Severity, title, status, timestamp | `REQUIRES NEW MODEL` | `Alert` (New) | Alerts are scattered in ad-hoc logs. Introduce unified `Alert` collection. |
| **Organizations** | Organization Directory | Name, slug, domain, plan, status, seats | `AVAILABLE` | `Organization`, `User` | Paginated query with user count `$lookup`. |
| **Organizations** | Organization 360° Profile | Multi-tab dossier across all 14 domains | `REQUIRES AGGREGATION` | Multi-collection pipeline | Aggregate user roster, journeys, storage, billing, and audit for single org ID. |
| **Organizations** | Seat Quota vs Utilization | `limits.maxUsers`, count of active users | `AVAILABLE` | `Organization`, `User` | Compare `limits.maxUsers` with `User.countDocuments({ organizationId })`. |
| **Organizations** | Tenant Storage Consumption | Total bytes uploaded by organization | `REQUIRES AGGREGATION` | `Upload` | Aggregation pipeline: `$match: { organizationId }`, `$group: { _id: null, totalBytes: { $sum: '$fileSizeBytes' } }`. |
| **Organizations** | Tenant AI Cost Attribution | Tokens & estimated cost by organization | `REQUIRES NEW MODEL` | `AIUsageRecord` (New) | Record `organizationId` with each AI completion to calculate tenant billing. |
| **Organizations** | Tenant Commercial Notes | Billing contact, contract terms, notes | `REQUIRES NEW MODEL` | `CustomerAccount` (New) | Move commercial settings from generic JSON into dedicated `CustomerAccount`. |
| **Users** | Platform User Directory | Name, email, role, org, department, status | `AVAILABLE` | `User`, `Organization` | Paginated query with text search across name, email, department. |
| **Users** | User 360° Profile | Profile, journeys, tasks, docs, AI, audit | `REQUIRES AGGREGATION` | Multi-collection pipeline | Aggregate assignments, tasks, document signatures, and audit for target user ID. |
| **Users** | Active Sessions Workbench | Active tokens, IP address, user agent | `AVAILABLE` | `Session` | `Session` model contains `userId`, `ipAddress`, `deviceInfo`, `isValid`, `expiresAt`. |
| **Users** | User Role & Access Controls | Role mutation, deactivation, password reset | `AVAILABLE` | `User`, `super-admin.routes.ts` | Backend mutation with mandatory audit logging. |
| **Onboarding** | Onboarding Global Monitor | Cases by state (`active`, `paused`, etc.) | `AVAILABLE` | `OnboardingCase` | Group cases by state with `$group`. |
| **Onboarding** | Onboarding Bottlenecks & Risk | Drop-off risk scores, inactive days | `AVAILABLE` | `OnboardingHealth` | Sort by `dropOffRiskScore: -1` and `riskLevel: 'critical'`. |
| **Onboarding** | Provisioning Failure Workbench | Failed resource allocations, retries | `AVAILABLE` | `OnboardingCase`, `OutboxEvent` | Query `state: 'provisioning_failed'` or `status: 'dead_letter'`. |
| **Journeys & LMS** | Journey Catalog & Assignments | Blueprint title, assigned count, completed | `REQUIRES AGGREGATION` | `Journey`, `EmployeeAssignment` | Aggregation pipeline over `EmployeeAssignment` grouped by `journey.journeyId`. |
| **Journeys & LMS** | LMS Assessment Failure Analysis | Quiz attempts, failure rates by question | `REQUIRES AGGREGATION` | `EmployeeAssignment` | Aggregate `quizAttempts` answers to isolate high-failure questions. |
| **Journeys & LMS** | Certificate Verification Registry | Certificate numbers, SHA-256 signatures | `AVAILABLE` | `Certificate` | Query `Certificate` collection with public signature validation. |
| **Tasks & Ops** | Operational Tasks Overview | Task counts by status, priority, stage | `AVAILABLE` | `Task` | Group tasks by `status` and `priority`. |
| **Tasks & Ops** | IT Hardware Queue | Asset tags, serial numbers, MDM status | `AVAILABLE` | `Task.hardwareMetadata` | Filter `category: 'it_setup'` and inspect `hardwareMetadata`. |
| **Tasks & Ops** | Task Verification Anomalies | Quarantined tasks, signature discrepancies | `AVAILABLE` | `Task` | Filter `status: 'needs_review'` or `quarantineReason: { $exists: true }`. |
| **Compliance** | E-Signature Document Monitor | Signed vs pending compliance documents | `AVAILABLE` | `DocumentAssignment` | Aggregate `status: 'signed'` vs `'pending'`. |
| **Compliance** | Cryptographic Signature Audit | SHA-256 digest, signer IP, timestamp | `AVAILABLE` | `DocumentAssignment.signature` | Checksum and IP stored in `DocumentAssignment`. |
| **Milestones** | 30-60-90 Day Milestone Radar | Scheduled, completed, self-rating scores | `AVAILABLE` | `EmployeeMilestone` | Aggregate milestone ratings and sign-off status. |
| **Buddy Program** | Mentorship Analytics | Paired new hires, active mentors, logs | `AVAILABLE` | `BuddyAssignment`, `BuddyProfile`| Join assignments and check-in logs. |
| **Workflows** | Rule Execution Observability | Success/failure rate of automation rules | `AVAILABLE` | `WorkflowExecutionLog` | Query `workflow_execution_logs` by `status` and `workflowRuleId`. |
| **Workflows** | Delayed Workflow Queue | Scheduled resumptions, pending executions | `AVAILABLE` | `WorkflowExecutionLog` | Filter `status: 'pending_delay'`, `resumeAt: { $gte: now }`. |
| **Knowledge Base** | Unanswered Policy Gaps | Questions without grounding articles | `AVAILABLE` | `KnowledgeGap` | Query `KnowledgeGap` collection grouped by frequency. |
| **AI Observability** | AI Request Volume & Latency | Calls, P95 latency, provider status | `REQUIRES NEW MODEL` | `AIUsageRecord` (New) | Instrument `AIProviderService` to record latency and provider metadata. |
| **AI Observability** | Token Consumption & Cost | Input tokens, output tokens, cost ($) | `REQUIRES NEW MODEL` | `AIUsageRecord` (New) | Calculate cost based on provider pricing tables ($/1k tokens). |
| **Kiosks** | Kiosk Fleet Telemetry | Device status, online/offline, pairings | `AVAILABLE` | `KioskDevice`, `KioskAnalytics` | Heartbeat timestamp check (`lastHeartbeatAt > 15m ago`). |
| **Storage** | Media Asset Distribution | Bytes by type (`video`, `pdf`, `image`) | `REQUIRES AGGREGATION` | `Upload` | Group by `type` and sum `fileSizeBytes`. |
| **Storage** | Orphaned File Detection | Uploads with `usage.usageCount == 0` | `AVAILABLE` | `Upload` | Filter `lifecycle.status: 'active'`, `usage.usageCount: 0`. |
| **Finance** | Invoicing Directory | Invoices, amounts, statuses, due dates | `PARTIALLY AVAILABLE` | `Invoice` | Extend existing `Invoice` with line items, tax, discounts, currency, and multi-state lifecycle. |
| **Finance** | Manual Payment Ledger | Payment date, amount, bank reference | `REQUIRES NEW MODEL` | `PaymentRecord` (New) | Create `PaymentRecord` model linked to `Invoice`. |
| **Finance** | Manual Expense Management | Expense ID, category, vendor, amount | `REQUIRES NEW MODEL` | `ExpenseRecord` (New) | Create `ExpenseRecord` model. |
| **Finance** | Customer Billing Account | Account status, billing cycle, currency | `REQUIRES NEW MODEL` | `CustomerAccount` (New) | Create `CustomerAccount` model for commercial terms. |
| **Finance** | Traceable Financial Formulas | Reconciliation of invoices to cash collected | `REQUIRES AGGREGATION` | Multi-collection pipeline | Sum verified payments, subtract from invoices for receivables, subtract expenses for operating result. |
| **Technical Health** | Process Health & Memory | Node.js RSS, heap, uptime, event loop | `REQUIRES INFRASTRUCTURE INTEGRATION` | Node.js `process` & `os` | Expose `/api/v1/super-admin/infrastructure/process`. |
| **Technical Health** | Database Performance & Latency | Ping latency, pool stats, storage size | `REQUIRES INFRASTRUCTURE INTEGRATION` | Mongoose Connection | Expose `/api/v1/super-admin/infrastructure/database` via `db.stats()` and `db.admin().ping()`. |
| **Technical Health** | API Latency Percentiles (P50/P95) | Latency distribution by endpoint | `REQUIRES INFRASTRUCTURE INTEGRATION` | Fastify Response Hook | In-memory circular buffer tracking endpoint durations and status codes. |
| **System Logs** | Application Log Explorer | Pino logs queryable by level, reqId, err | `REQUIRES NEW MODEL` | `PlatformEvent` / Log Ring Buffer | Buffer recent application logs into queryable ring buffer or `platform_events` collection. |
| **Audit & Security** | Privileged Action Audit Trail | Actor, target, diffs, reason, severity | `PARTIALLY AVAILABLE` | `AuditLog` | `AuditLog` requires `organizationId`. Support platform-level audit events (`organizationId: null`). |
| **Alerts** | Unified Incident Workbench | Incidents, severity, status, root cause | `REQUIRES NEW MODEL` | `Alert` (New) | Create dedicated `Alert` collection with status workflow (`Open`, `Acknowledged`, `Resolved`). |
| **Reporting** | Centralized Reporting Center | CSV/XLSX generation across all domains | `REQUIRES AGGREGATION` | Multi-collection exporters | Build unified export engine with streaming CSV generation and audit logging. |
| **Configuration** | Feature Flags & Rollouts | Flags, targeted orgs, % rollouts | `REQUIRES NEW MODEL` | `FeatureFlag` (New) | Create `FeatureFlag` collection and evaluation service. |
