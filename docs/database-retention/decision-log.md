# Database Retention & Storage Optimization Decision Log (ADRs)

## Architecture Decision Records

### ADR 001: Lifecycle Expiration & Background Purge for `system_jobs`

- **Status:** **APPROVED**
- **Date:** 2026-10-16
- **Context:**
  The `system_jobs` collection accounts for 622,103 documents, 233.6 MB of data, and 51.7 MB of index storage. 99.98% of these documents are in `completed` status, generated automatically every minute by the scheduler engine.
- **Alternatives Considered:**
  1. *Do nothing / Increase cluster storage tier*: Incur recurring cloud infrastructure costs without solving unbounded exponential growth.
  2. *Replace MongoDB queue with Redis/BullMQ*: High engineering effort, architectural complexity, breaks existing transactional guarantees.
  3. *Immediate blind truncate of `system_jobs`*: Danger of deleting pending/in-flight jobs and losing failed job troubleshooting context.
  4. *Two-phase lifecycle (TTL for future + Super Admin batch purge for historical backlog)*: Selected.
- **Decision:**
  Implement a compound TTL index on `completedAt` (7-day expiration) for future jobs, backfill missing `completedAt` timestamps on completed jobs, and provide a verified Super Admin batch purge workflow for historical records.
- **Consequences:**
  Eliminates ~621,000 obsolete documents, freeing ~230 MB of BSON data and ~50 MB of index storage.

---

### ADR 002: Notification Expiration Pipeline & `expiresAt` Backfill

- **Status:** **APPROVED**
- **Date:** 2026-10-16
- **Context:**
  The `notifications` collection has accumulated 83,394 documents. 96.4% of records have `expiresAt: null`, bypassing the existing TTL index (`{ expiresAt: 1 }`).
- **Alternatives Considered:**
  1. *Replace index with TTL on `createdAt`*: Unacceptable. Would purge unread critical notifications after a fixed window regardless of whether the user saw them.
  2. *Automatic calculation at insertion + Safe backfill*: Selected.
- **Decision:**
  1. Enforce automatic `expiresAt` calculation in `Notification.create()` based on priority (low/medium = 30-90 days, critical = 180 days).
  2. Backfill `expiresAt` on historical notifications older than 90 days that are read, or unread automated reminders.
- **Consequences:**
  Reclaims ~72 MB of storage and activates the dormant TTL index safely.

---

### ADR 003: Statutory Retention Locks for Compliance & Financial Records

- **Status:** **APPROVED**
- **Date:** 2026-10-16
- **Context:**
  Collections such as `payment_records`, `invoices`, `expense_records`, `documentassignments`, and `auditLogs` are subject to strict regulatory frameworks (IRS 7-year accounting, SOC2 audit trails, employee contract laws).
- **Decision:**
  Hard deletes are strictly prohibited on these collections. TTL indexes on financial records are banned. Archival to external cold storage is mandatory before any database purging.
- **Consequences:**
  Guarantees 100% compliance during enterprise SOC2, HIPAA, and tax audits.

---

### ADR 004: Bounded Iterative Purges vs. Unbounded `deleteMany()`

- **Status:** **APPROVED**
- **Date:** 2026-10-16
- **Context:**
  Deleting 600,000+ documents in a single unconstrained `deleteMany()` call locks WiredTiger data pages, causes replication lag spikes on Atlas secondary nodes, and risks connection timeouts.
- **Decision:**
  All purge operations must execute in bounded batches of 1,000 documents with an asynchronous yield (50ms sleep) between batches.
- **Consequences:**
  Zero application downtime, zero replication lag, and completely safe production execution.

---

### ADR 005: Preservation of Translation History (`i18nTranslations`)

- **Status:** **APPROVED**
- **Date:** 2026-10-16
- **Context:**
  The `i18nTranslations` schema documentation explicitly notes: *"Do NOT delete OUTDATED records; they preserve translation history."*
- **Decision:**
  Retain all translation records under Strategy D. No automated expiration or pruning will touch `i18nTranslations`.
- **Consequences:**
  Prevents loss of localization history and guarantees multilingual stability.
