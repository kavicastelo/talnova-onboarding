# MongoDB Collection Inventory & Storage Catalog

**Database:** `Talnova-Onboarding`  
**Generated At:** `2026-10-16T08:05:00.000Z`  
**Total Collections Discovered:** `68`  
**Inventory Scope:** Comprehensive production discovery across all live collections, schemas, indexes, and code models.

---

## Executive Summary

| Metric | Measured Value | Notes |
| :--- | :--- | :--- |
| **Total Collections** | **68** | Reconciled 1:1 against live MongoDB Atlas database. |
| **Total Documents** | **~713,500** | Dominated by 2 operational collections (98.9% of all documents). |
| **Total Logical Data Size** | **~316.5 MB** | `system_jobs` (233.6 MB) + `notifications` (77.6 MB) = 98.3% of total data. |
| **Total Storage Size (WiredTiger)** | **~57.2 MB** | Compressed on-disk storage size. |
| **Total Index Size** | **~67.8 MB** | Index footprint exceeds compressed collection storage due to compound indexes. |
| **Active TTL Indexes** | **6 collections** | `auditLogs`, `kiosk_device_telemetry`, `feature_usage_records`, `kioskanalytics`, `sessions`, `kiosk_pairing_codes`. Note: `notifications` has a TTL on `expiresAt`, but 96.4% of records have null values. |

---

## Top 10 Collections by Storage Footprint

| Rank | Collection Name | Owning Module | Documents | Data Size (MB) | Storage Size (MB) | Index Size (MB) | Current Strategy |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| 1 | **system_jobs** | `infrastructure/queue` | 622,103 | 233.60 MB | 42.73 MB | 51.69 MB | Strategy C (TTL + Purge) |
| 2 | **notifications** | `modules/notifications` | 83,394 | 77.58 MB | 8.91 MB | 7.11 MB | Strategy C (TTL + Purge) |
| 3 | **auditLogs** | `modules/audit-logs` | 3,458 | 1.90 MB | 0.42 MB | 1.20 MB | Strategy B (Backup & Purge) |
| 4 | **outbox_events** | `modules/onboarding` | 1,402 | 0.67 MB | 0.23 MB | 0.36 MB | Strategy A (Automatic TTL) |
| 5 | **notificationpreferences** | `modules/notifications` | 1,338 | 0.53 MB | 0.13 MB | 0.21 MB | Strategy D (Retain) |
| 6 | **kiosk_device_telemetry** | `modules/kiosk` | 1,304 | 0.47 MB | 0.11 MB | 0.41 MB | Strategy A (Automatic TTL) |
| 7 | **tasks** | `modules/tasks` | 371 | 0.37 MB | 0.11 MB | 0.60 MB | Strategy D (Retain) |
| 8 | **employeemilestones** | `modules/milestones` | 466 | 0.28 MB | 0.09 MB | 0.20 MB | Strategy D (Retain) |
| 9 | **onboarding_health** | `modules/analytics` | 604 | 0.21 MB | 0.13 MB | 0.30 MB | Strategy B (Backup & Purge) |
| 10 | **knowledgeChunks** | `modules/knowledge-base` | 132 | 0.21 MB | 0.08 MB | 0.30 MB | Strategy D (Retain) |

---

## Complete 68-Collection Structured Inventory

### 1. `system_jobs`

- **Business Purpose:** Background task queue and job processing state machine for distributed schedulers, outbox publishers, and telemetry sweeps
- **Owning Module / Service:** `infrastructure/queue`
- **Code Model / Schema Reference:** `SystemJob` in `server\src\infrastructure\queue\system-job.model.ts`
- **Metrics:**
  - **Document Count:** 622,103
  - **Logical Data Size:** 233.6 MB (244,944,722 bytes)
  - **WiredTiger Storage Size:** 42.73 MB (44,810,240 bytes)
  - **Total Index Size:** 51.69 MB (54,202,368 bytes across 5 indexes)
  - **Average Document Size:** 393 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `completedAt / availableAt / createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Internal operational (may contain payload entity IDs and task parameters)
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **C (Both automatic expiration and Super Admin backup-and-purge)**
  - **Recommended Retention Period:** Completed jobs: 7 days after completion; Failed jobs: 30 days after last failure. Historical backlog (621k+): Super Admin backup-and-purge.
  - **Risk of Deletion:** Medium: Pending or processing jobs must NEVER be purged. Purge must filter exclusively on status in ['completed', 'failed'] where completedAt < cutoff.
  - **Implementation Complexity:** Medium: Requires TTL index on completedAt + backfill of completedAt on historical completed docs lacking it, plus Super Admin batch purge.
- **Operational Findings & Evidence:** Top storage consumer in database: 622,103 documents, 233.6 MB data, 51.7 MB index storage.

---

### 2. `notifications`

- **Business Purpose:** In-app and multi-channel notification records delivered to employees, managers, and admins
- **Owning Module / Service:** `modules/notifications`
- **Code Model / Schema Reference:** `Notification` in `server\src\modules\notifications\models\notification.model.ts`
- **Metrics:**
  - **Document Count:** 83,394
  - **Logical Data Size:** 77.58 MB (81,346,305 bytes)
  - **WiredTiger Storage Size:** 8.91 MB (9,338,880 bytes)
  - **Total Index Size:** 7.11 MB (7,454,720 bytes across 12 indexes)
  - **Average Document Size:** 975 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `expiresAt / createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Confidential employee data (names, onboarding steps, manager reminders)
  - **Existing TTL Index:** **Yes** (`expiresAt_1`, 0s on `{"expiresAt":1}`)
- **Retention & Governance Strategy:**
  - **Classification:** **C (Both automatic expiration and Super Admin backup-and-purge)**
  - **Recommended Retention Period:** Read notifications: 30 days; Unread automated alerts: 90 days; High/critical priority: 180 days with archive option.
  - **Risk of Deletion:** Medium: Unread notifications affect user notification badges. Must ensure users do not lose active pending action items.
  - **Implementation Complexity:** Medium: Existing TTL index on expiresAt (0s) is currently ineffective because 96.4% of docs have expiresAt: null. Requires automated expiresAt computation.
- **Operational Findings & Evidence:** Second largest collection: 83,394 documents, 77.6 MB data, 7.1 MB index storage.

---

### 3. `auditLogs`

- **Business Purpose:** Immutable audit trail of all security, authentication, CRUD, and administrative events for compliance
- **Owning Module / Service:** `modules/audit-logs`
- **Code Model / Schema Reference:** `AuditLog` in `server\src\modules\audit-logs\models\audit-log.model.ts`
- **Metrics:**
  - **Document Count:** 3,458
  - **Logical Data Size:** 1.9 MB (1,989,056 bytes)
  - **WiredTiger Storage Size:** 0.42 MB (442,368 bytes)
  - **Total Index Size:** 1.2 MB (1,261,568 bytes across 15 indexes)
  - **Average Document Size:** 575 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** High (IP addresses, user IDs, security actions, administrative mutations)
  - **Existing TTL Index:** **Yes** (`createdAt_1`, 220752000s on `{"createdAt":1}`)
- **Retention & Governance Strategy:**
  - **Classification:** **B (Super Admin backup-and-purge workflow with long-term retention)**
  - **Recommended Retention Period:** Active database: 365 days; Cold encrypted archive: 7 years (SOC2/HIPAA/GDPR compliance)
  - **Risk of Deletion:** High: Compliance violation if deleted without verified recoverable archive.
  - **Implementation Complexity:** High: Already has 7-year TTL index (220,752,000s). Requires verified encrypted S3/R2 backup before any purge.
- **Operational Findings & Evidence:** 3,458 records, 1.9 MB data, 1.2 MB index storage across 15 compound indexes.

---

### 4. `outbox_events`

- **Business Purpose:** Transactional outbox pattern events for reliable asynchronous event bus publishing
- **Owning Module / Service:** `modules/onboarding`
- **Code Model / Schema Reference:** `OutboxEvent` in `server\src\modules\onboarding\models\outbox-event.model.ts`
- **Metrics:**
  - **Document Count:** 1,402
  - **Logical Data Size:** 0.67 MB (700,518 bytes)
  - **WiredTiger Storage Size:** 0.23 MB (237,568 bytes)
  - **Total Index Size:** 0.36 MB (380,928 bytes across 5 indexes)
  - **Average Document Size:** 499 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt / publishedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Internal operational
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** Published events: 7 days after publishedAt or createdAt. Failed events: 30 days.
  - **Risk of Deletion:** Low: Once published, outbox events have already been delivered to the bus/subscribers.
  - **Implementation Complexity:** Low: Add TTL index on publishedAt or cleanup job for status='published'.
- **Operational Findings & Evidence:** 1,402 records, 1,401 are published and obsolete.

---

### 5. `notificationpreferences`

- **Business Purpose:** User notification delivery settings per channel (email, in-app, push)
- **Owning Module / Service:** `modules/notifications`
- **Code Model / Schema Reference:** `NotificationPreference` in `server\src\modules\notifications\models\notification-preference.model.ts`
- **Metrics:**
  - **Document Count:** 1,338
  - **Logical Data Size:** 0.53 MB (553,932 bytes)
  - **WiredTiger Storage Size:** 0.13 MB (131,072 bytes)
  - **Total Index Size:** 0.21 MB (217,088 bytes across 3 indexes)
  - **Average Document Size:** 414 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** User personal preferences
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while user account is active. Cascade deletion when user is hard-deleted.
  - **Risk of Deletion:** High: Deleting preferences resets user notification settings to defaults.
  - **Implementation Complexity:** Low: Retained under controlled policy.
- **Operational Findings & Evidence:** 1,338 records, 0.53 MB.

---

### 6. `kiosk_device_telemetry`

- **Business Purpose:** High-frequency hardware telemetry heartbeats, battery state, network latency, and memory metrics from on-premise kiosks
- **Owning Module / Service:** `modules/kiosk`
- **Code Model / Schema Reference:** `KioskDeviceTelemetry` in `server\src\modules\kiosk\models\kiosk-device-telemetry.model.ts`
- **Metrics:**
  - **Document Count:** 1,304
  - **Logical Data Size:** 0.47 MB (490,648 bytes)
  - **WiredTiger Storage Size:** 0.11 MB (118,784 bytes)
  - **Total Index Size:** 0.41 MB (434,176 bytes across 8 indexes)
  - **Average Document Size:** 376 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Hardware operational telemetry
  - **Existing TTL Index:** **Yes** (`createdAt_1`, 2592000s on `{"createdAt":1}`)
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** 30 days (already configured with TTL index on createdAt: 2592000s).
  - **Risk of Deletion:** Low: Telemetry is summarized in hourly/daily device health rollups.
  - **Implementation Complexity:** Low: Currently working as expected via existing TTL index.
- **Operational Findings & Evidence:** 1,304 records, 0.47 MB, 8 indexes.

---

### 7. `onboarding_health`

- **Business Purpose:** Daily velocity sentinel health score snapshots and drop-off analytics for onboarding cohorts
- **Owning Module / Service:** `modules/analytics`
- **Code Model / Schema Reference:** `OnboardingHealth` in `server\src\modules\analytics\models\onboarding-health.model.ts`
- **Metrics:**
  - **Document Count:** 604
  - **Logical Data Size:** 0.21 MB (222,143 bytes)
  - **WiredTiger Storage Size:** 0.13 MB (131,072 bytes)
  - **Total Index Size:** 0.3 MB (311,296 bytes across 6 indexes)
  - **Average Document Size:** 367 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `date / createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Internal organizational analytics
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **B (Super Admin backup-and-purge workflow)**
  - **Recommended Retention Period:** Active database: 180 days. Archive older historical snapshots for long-term year-over-year reporting.
  - **Risk of Deletion:** Low: Historical aggregate scores can be backed up to parquet/JSON in cold storage.
  - **Implementation Complexity:** Medium: Provide yearly archival.
- **Operational Findings & Evidence:** 604 records, 0.21 MB.

---

### 8. `employeemilestones`

- **Business Purpose:** Employee onboarding milestones, recognition awards, manager sign-offs, and target dates
- **Owning Module / Service:** `modules/milestones`
- **Code Model / Schema Reference:** `EmployeeMilestone` in `server\src\modules\milestones\models\employee-milestone.model.ts`
- **Metrics:**
  - **Document Count:** 466
  - **Logical Data Size:** 0.28 MB (297,867 bytes)
  - **WiredTiger Storage Size:** 0.09 MB (98,304 bytes)
  - **Total Index Size:** 0.2 MB (204,800 bytes across 5 indexes)
  - **Average Document Size:** 639 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Confidential HR employment records
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain for duration of employee employment + statutory HR retention (typically 3-7 years post-termination).
  - **Risk of Deletion:** High: Legal and contractual HR record.
  - **Implementation Complexity:** Low: Controlled retention.
- **Operational Findings & Evidence:** 466 records, 0.28 MB.

---

### 9. `tasks`

- **Business Purpose:** Core actionable onboarding and verification tasks assigned to employees and managers
- **Owning Module / Service:** `modules/tasks`
- **Code Model / Schema Reference:** `Task` in `server\src\modules\tasks\models\task.model.ts`
- **Metrics:**
  - **Document Count:** 371
  - **Logical Data Size:** 0.37 MB (383,300 bytes)
  - **WiredTiger Storage Size:** 0.11 MB (118,784 bytes)
  - **Total Index Size:** 0.6 MB (630,784 bytes across 16 indexes)
  - **Average Document Size:** 1033 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt / completedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Confidential workflow data
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain active and completed tasks as core workflow history. Soft-deleted tasks purgeable after 90 days via trash workflow.
  - **Risk of Deletion:** Critical: Deleting tasks destroys employee journey completion proof.
  - **Implementation Complexity:** Low: Controlled retention.
- **Operational Findings & Evidence:** 371 records, 16 indexes (0.60 MB index storage).

---

### 10. `feature_usage_records`

- **Business Purpose:** Granular telemetry logs of feature usage by user and organization
- **Owning Module / Service:** `modules/super-admin`
- **Code Model / Schema Reference:** `FeatureUsageRecord` in `server\src\modules\super-admin\models\feature-usage-record.model.ts`
- **Metrics:**
  - **Document Count:** 350
  - **Logical Data Size:** 0.08 MB (86,244 bytes)
  - **WiredTiger Storage Size:** 0.07 MB (69,632 bytes)
  - **Total Index Size:** 0.3 MB (319,488 bytes across 8 indexes)
  - **Average Document Size:** 246 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `timestamp`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Internal product analytics
  - **Existing TTL Index:** **Yes** (`timestamp_1`, 7776000s on `{"timestamp":1}`)
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** 90 days (already configured with TTL index on timestamp: 7776000s).
  - **Risk of Deletion:** Low: Raw events are rolled up into feature_adoption_rollups.
  - **Implementation Complexity:** Low: Already governed by active TTL index.
- **Operational Findings & Evidence:** 350 records, 0.08 MB.

---

### 11. `milestonetemplates`

- **Business Purpose:** Reusable milestone definitions and company milestone catalogs
- **Owning Module / Service:** `modules/milestones`
- **Code Model / Schema Reference:** `MilestoneTemplate` in `server\src\modules\milestones\models\milestone-template.model.ts`
- **Metrics:**
  - **Document Count:** 269
  - **Logical Data Size:** 0.19 MB (196,539 bytes)
  - **WiredTiger Storage Size:** 0.08 MB (86,016 bytes)
  - **Total Index Size:** 0.07 MB (73,728 bytes across 2 indexes)
  - **Average Document Size:** 730 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Company operational templates
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Tenant configuration asset.
  - **Risk of Deletion:** High: Referenced by active onboarding journeys.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 269 records.

---

### 12. `onboarding_cases`

- **Business Purpose:** High-level employee onboarding lifecycle instances tracking state from pre-boarding to completion
- **Owning Module / Service:** `modules/onboarding`
- **Code Model / Schema Reference:** `OnboardingCase` in `server\src\modules\onboarding\models\onboarding-case.model.ts`
- **Metrics:**
  - **Document Count:** 257
  - **Logical Data Size:** 0.21 MB (217,643 bytes)
  - **WiredTiger Storage Size:** 0.08 MB (86,016 bytes)
  - **Total Index Size:** 0.12 MB (126,976 bytes across 3 indexes)
  - **Average Document Size:** 846 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Confidential HR records
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain for active employment + HR compliance retention window.
  - **Risk of Deletion:** Critical: Primary onboarding state container.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 257 records.

---

### 13. `meetingevents`

- **Business Purpose:** Scheduled calendar meetings, 1-on-1 check-ins, and buddy meetings
- **Owning Module / Service:** `modules/calendar`
- **Code Model / Schema Reference:** `MeetingEvent` in `server\src\modules\calendar\models\meeting-event.model.ts`
- **Metrics:**
  - **Document Count:** 246
  - **Logical Data Size:** 0.13 MB (139,110 bytes)
  - **WiredTiger Storage Size:** 0.1 MB (106,496 bytes)
  - **Total Index Size:** 0.17 MB (176,128 bytes across 4 indexes)
  - **Average Document Size:** 565 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `startTime / createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Employee calendar meeting metadata
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Active database: 365 days past meeting date; older meetings purgeable or archivable.
  - **Risk of Deletion:** Medium: Required for manager reviews and journey audit trails.
  - **Implementation Complexity:** Medium: Optional archival after 1 year.
- **Operational Findings & Evidence:** 246 records.

---

### 14. `alerts`

- **Business Purpose:** System and operational health alerts displayed on Super Admin and Manager dashboards
- **Owning Module / Service:** `modules/super-admin`
- **Code Model / Schema Reference:** `Alert` in `server\src\modules\super-admin\models\alert.model.ts`
- **Metrics:**
  - **Document Count:** 215
  - **Logical Data Size:** 0.09 MB (94,065 bytes)
  - **WiredTiger Storage Size:** 0.07 MB (69,632 bytes)
  - **Total Index Size:** 0.37 MB (385,024 bytes across 10 indexes)
  - **Average Document Size:** 437 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `resolvedAt / createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** System operational alerts
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** Resolved alerts: 30 days; Dismissed alerts: 14 days; Open alerts: retain until resolved.
  - **Risk of Deletion:** Low: Resolved alerts have already been acted upon.
  - **Implementation Complexity:** Low: Add TTL index on resolvedAt or scheduled cleanup.
- **Operational Findings & Evidence:** 215 records, 10 indexes.

---

### 15. `gamificationprofiles`

- **Business Purpose:** Employee points, badges, levels, and onboarding achievement streaks
- **Owning Module / Service:** `modules/gamification`
- **Code Model / Schema Reference:** `GamificationProfile` in `server\src\modules\gamification\models\gamification-profile.model.ts`
- **Metrics:**
  - **Document Count:** 192
  - **Logical Data Size:** 0.16 MB (172,021 bytes)
  - **WiredTiger Storage Size:** 0.08 MB (81,920 bytes)
  - **Total Index Size:** 0.11 MB (118,784 bytes across 3 indexes)
  - **Average Document Size:** 895 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Employee engagement data
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while user account is active.
  - **Risk of Deletion:** Medium: Resetting gamification destroys user earned rewards.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 192 records.

---

### 16. `knowledgeChunks`

- **Business Purpose:** Vector-ready parsed text chunks of knowledge base articles for semantic search and AI assistant
- **Owning Module / Service:** `modules/knowledge-base`
- **Code Model / Schema Reference:** `KnowledgeChunk` in `server\src\modules\knowledge-base\models\knowledge-chunk.model.ts`
- **Metrics:**
  - **Document Count:** 132
  - **Logical Data Size:** 0.21 MB (218,088 bytes)
  - **WiredTiger Storage Size:** 0.08 MB (86,016 bytes)
  - **Total Index Size:** 0.3 MB (319,488 bytes across 8 indexes)
  - **Average Document Size:** 1652 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Internal organizational knowledge
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Regenerated on article publish. Delete orphaned chunks when parent article is deleted.
  - **Risk of Deletion:** Medium: Regenerated automatically from articles.
  - **Implementation Complexity:** Low: Cascade with Article lifecycle.
- **Operational Findings & Evidence:** 132 records.

---

### 17. `kiosksessions`

- **Business Purpose:** Physical kiosk check-in sessions, badges, journey launches, and interactions
- **Owning Module / Service:** `modules/kiosk`
- **Code Model / Schema Reference:** `Session` in `server\src\modules\auth\models\session.model.ts`
- **Metrics:**
  - **Document Count:** 130
  - **Logical Data Size:** 0.06 MB (59,994 bytes)
  - **WiredTiger Storage Size:** 0.08 MB (86,016 bytes)
  - **Total Index Size:** 0.41 MB (434,176 bytes across 12 indexes)
  - **Average Document Size:** 461 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `endedAt / startedAt / createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Hardware check-in metadata, session tokens
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** Completed/aborted sessions: 90 days. Active sessions expire after 24 hours.
  - **Risk of Deletion:** Low: Aggregated into KioskAnalytics.
  - **Implementation Complexity:** Low: Add TTL index on endedAt (7,776,000s = 90 days).
- **Operational Findings & Evidence:** 130 records, 12 indexes.

---

### 18. `kioskanalytics`

- **Business Purpose:** Daily and weekly kiosk usage rollups, funnel drop-off stats, and touch screen interaction metrics
- **Owning Module / Service:** `modules/kiosk`
- **Code Model / Schema Reference:** `KioskAnalytics` in `server\src\modules\kiosk\models\kiosk-analytics.model.ts`
- **Metrics:**
  - **Document Count:** 122
  - **Logical Data Size:** 0.06 MB (65,663 bytes)
  - **WiredTiger Storage Size:** 0.05 MB (53,248 bytes)
  - **Total Index Size:** 0.36 MB (376,832 bytes across 10 indexes)
  - **Average Document Size:** 538 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Kiosk performance analytics
  - **Existing TTL Index:** **Yes** (`createdAt_1`, 31536000s on `{"createdAt":1}`)
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** 365 days (already configured with TTL index on createdAt: 31536000s).
  - **Risk of Deletion:** Low: Long-term trends can be archived before eviction.
  - **Implementation Complexity:** Low: Active TTL index.
- **Operational Findings & Evidence:** 122 records, 10 indexes.

---

### 19. `hriswebhooklogs`

- **Business Purpose:** Inbound webhook delivery payloads and synchronization logs from HRIS systems (Workday, BambooHR, etc.)
- **Owning Module / Service:** `modules/integrations`
- **Code Model / Schema Reference:** `HRISWebhookLog` in `server\src\modules\integrations\models\hris-webhook-log.model.ts`
- **Metrics:**
  - **Document Count:** 107
  - **Logical Data Size:** 0.06 MB (60,154 bytes)
  - **WiredTiger Storage Size:** 0.07 MB (69,632 bytes)
  - **Total Index Size:** 0.11 MB (110,592 bytes across 3 indexes)
  - **Average Document Size:** 562 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** May contain transient employee PII in webhook raw payloads
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** 30 days for processed/failed webhook payloads.
  - **Risk of Deletion:** Low: Payload is already ingested into core employee model.
  - **Implementation Complexity:** Low: Add TTL index on createdAt (2,592,000s = 30 days).
- **Operational Findings & Evidence:** 107 records.

---

### 20. `feature_flags`

- **Business Purpose:** Tenant and platform feature toggles, percentage rollouts, and entitlement controls
- **Owning Module / Service:** `modules/super-admin`
- **Code Model / Schema Reference:** `FeatureFlag` in `server\src\modules\super-admin\models\feature-flag.model.ts`
- **Metrics:**
  - **Document Count:** 105
  - **Logical Data Size:** 0.04 MB (41,859 bytes)
  - **WiredTiger Storage Size:** 0.05 MB (57,344 bytes)
  - **Total Index Size:** 0.19 MB (196,608 bytes across 5 indexes)
  - **Average Document Size:** 398 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Platform configuration
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Core platform configuration.
  - **Risk of Deletion:** Critical: Deleting flags breaks application feature gating.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 105 records.

---

### 21. `users`

- **Business Purpose:** Core user accounts, credentials, profile, authentication, roles, and tenant associations
- **Owning Module / Service:** `modules/auth`
- **Code Model / Schema Reference:** `User` in `server\src\modules\auth\models\user.model.ts`
- **Metrics:**
  - **Document Count:** 102
  - **Logical Data Size:** 0.08 MB (88,147 bytes)
  - **WiredTiger Storage Size:** 0.06 MB (61,440 bytes)
  - **Total Index Size:** 0.68 MB (712,704 bytes across 19 indexes)
  - **Average Document Size:** 864 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt / updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** High PII (names, emails, password hashes, phone numbers)
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain for lifetime of tenant contract. GDPR right-to-be-forgotten supported via anonymization.
  - **Risk of Deletion:** Critical: System authentication source of truth.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 102 records, 19 indexes.

---

### 22. `sessions`

- **Business Purpose:** Active user JWT refresh sessions and browser device identifiers
- **Owning Module / Service:** `modules/auth`
- **Code Model / Schema Reference:** `Session` in `server\src\modules\auth\models\session.model.ts`
- **Metrics:**
  - **Document Count:** 102
  - **Logical Data Size:** 0.03 MB (27,028 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (45,056 bytes)
  - **Total Index Size:** 0.18 MB (184,320 bytes across 5 indexes)
  - **Average Document Size:** 264 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `expiresAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Security tokens
  - **Existing TTL Index:** **Yes** (`expiresAt_1`, 0s on `{"expiresAt":1}`)
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** Expires automatically on expiresAt (already configured with TTL index: expireAfterSeconds: 0).
  - **Risk of Deletion:** Low: Expired sessions are unusable.
  - **Implementation Complexity:** Low: Active TTL index functioning properly.
- **Operational Findings & Evidence:** 102 records.

---

### 23. `payment_records`

- **Business Purpose:** Enterprise customer invoices payments, wire references, and reconciliation proofs
- **Owning Module / Service:** `modules/super-admin`
- **Code Model / Schema Reference:** `PaymentRecord` in `server\src\modules\super-admin\models\payment-record.model.ts`
- **Metrics:**
  - **Document Count:** 100
  - **Logical Data Size:** 0.04 MB (45,800 bytes)
  - **WiredTiger Storage Size:** 0.05 MB (53,248 bytes)
  - **Total Index Size:** 0.35 MB (368,640 bytes across 10 indexes)
  - **Average Document Size:** 458 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `paymentDate / createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Financial records
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **B (Super Admin backup-and-purge workflow with legal retention)**
  - **Recommended Retention Period:** Active database: 7 years minimum (statutory tax and accounting requirement). Super Admin export/backup before any archival.
  - **Risk of Deletion:** Critical: Tax and audit compliance violation if purged prematurely.
  - **Implementation Complexity:** High: Require 7-year lock.
- **Operational Findings & Evidence:** 100 records, 10 indexes.

---

### 24. `synclogs`

- **Business Purpose:** Detailed logs of external integration sync executions (SCIM, HRIS, Calendar)
- **Owning Module / Service:** `modules/integrations`
- **Code Model / Schema Reference:** `SyncLog` in `server\src\modules\integrations\models\sync-log.model.ts`
- **Metrics:**
  - **Document Count:** 98
  - **Logical Data Size:** 0.04 MB (42,140 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (45,056 bytes)
  - **Total Index Size:** 0.07 MB (73,728 bytes across 2 indexes)
  - **Average Document Size:** 430 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Integration diagnostic logs
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** 60 days for integration sync logs.
  - **Risk of Deletion:** Low: Diagnostic info only.
  - **Implementation Complexity:** Low: Add TTL index on createdAt (5,184,000s = 60 days).
- **Operational Findings & Evidence:** 98 records.

---

### 25. `kioskdevices`

- **Business Purpose:** Physical kiosk hardware registration, certificates, status, and pairing state
- **Owning Module / Service:** `modules/kiosk`
- **Code Model / Schema Reference:** `KioskDevice` in `server\src\modules\kiosk\models\kiosk-device.model.ts`
- **Metrics:**
  - **Document Count:** 98
  - **Logical Data Size:** 0.04 MB (46,621 bytes)
  - **WiredTiger Storage Size:** 0.05 MB (53,248 bytes)
  - **Total Index Size:** 0.32 MB (331,776 bytes across 9 indexes)
  - **Average Document Size:** 475 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Device security keys & pairing data
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while hardware device is provisioned. Soft-delete when decommissioned.
  - **Risk of Deletion:** Critical: Hardware stops functioning if record is deleted.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 98 records, 9 indexes.

---

### 26. `customer_accounts`

- **Business Purpose:** B2B enterprise customer organization metadata, account managers, and contract tiers
- **Owning Module / Service:** `modules/super-admin`
- **Code Model / Schema Reference:** `CustomerAccount` in `server\src\modules\super-admin\models\customer-account.model.ts`
- **Metrics:**
  - **Document Count:** 94
  - **Logical Data Size:** 0.03 MB (33,054 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (45,056 bytes)
  - **Total Index Size:** 0.14 MB (147,456 bytes across 4 indexes)
  - **Average Document Size:** 351 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt / updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Commercial customer data
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain for lifetime of customer relationship + legal retention window.
  - **Risk of Deletion:** Critical: Customer billing relationship record.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 94 records.

---

### 27. `employeeAssignments`

- **Business Purpose:** Mapping of onboarding journeys to specific employees, tracking overall progress and milestones
- **Owning Module / Service:** `modules/assignments`
- **Code Model / Schema Reference:** `EmployeeAssignment` in `server\src\modules\assignments\models\assignment.model.ts`
- **Metrics:**
  - **Document Count:** 91
  - **Logical Data Size:** 0.06 MB (63,509 bytes)
  - **WiredTiger Storage Size:** 0.05 MB (53,248 bytes)
  - **Total Index Size:** 0.39 MB (405,504 bytes across 11 indexes)
  - **Average Document Size:** 697 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt / completedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Confidential employee performance & compliance
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain for duration of employment + HR audit window (3-7 years).
  - **Risk of Deletion:** Critical: Employee onboarding completion record.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 91 records, 11 indexes.

---

### 28. `workflow_execution_logs`

- **Business Purpose:** Step-by-step evaluation logs and outcomes of automated onboarding workflow triggers
- **Owning Module / Service:** `modules/workflows`
- **Code Model / Schema Reference:** `WorkflowExecutionLog` in `server\src\modules\workflows\models\workflow-execution.model.ts`
- **Metrics:**
  - **Document Count:** 85
  - **Logical Data Size:** 0.09 MB (93,086 bytes)
  - **WiredTiger Storage Size:** 0.06 MB (61,440 bytes)
  - **Total Index Size:** 0.14 MB (147,456 bytes across 4 indexes)
  - **Average Document Size:** 1095 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Internal workflow diagnostics
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** 90 days for workflow execution logs.
  - **Risk of Deletion:** Low: Audit logs retain permanent summary; execution logs are transient diagnostics.
  - **Implementation Complexity:** Low: Add TTL index on createdAt (7,776,000s = 90 days).
- **Operational Findings & Evidence:** 85 records.

---

### 29. `kioskjourneys`

- **Business Purpose:** Kiosk-specific adapted onboarding journeys and step sequences
- **Owning Module / Service:** `modules/kiosk`
- **Code Model / Schema Reference:** `Journey` in `server\src\modules\journeys\models\journey.model.ts`
- **Metrics:**
  - **Document Count:** 81
  - **Logical Data Size:** 0.09 MB (98,868 bytes)
  - **WiredTiger Storage Size:** 0.07 MB (69,632 bytes)
  - **Total Index Size:** 0.32 MB (331,776 bytes across 9 indexes)
  - **Average Document Size:** 1220 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Organizational training content
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Tenant journey configuration.
  - **Risk of Deletion:** High: Referenced by kiosk fleet.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 81 records, 9 indexes.

---

### 30. `kioskjourneyversions`

- **Business Purpose:** Version snapshots of kiosk journeys for deterministic kiosk execution and rollback
- **Owning Module / Service:** `modules/kiosk`
- **Code Model / Schema Reference:** `Journey` in `server\src\modules\journeys\models\journey.model.ts`
- **Metrics:**
  - **Document Count:** 79
  - **Logical Data Size:** 0.11 MB (110,513 bytes)
  - **WiredTiger Storage Size:** 0.06 MB (61,440 bytes)
  - **Total Index Size:** 0.18 MB (184,320 bytes across 5 indexes)
  - **Average Document Size:** 1398 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Journey version content
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain active versions + last 3 historical versions per journey.
  - **Risk of Deletion:** Medium: Historical versions allow journey audit.
  - **Implementation Complexity:** Low: Controlled retention.
- **Operational Findings & Evidence:** 79 records.

---

### 31. `journeys`

- **Business Purpose:** Core onboarding journey roadmaps, templates, and learning modules
- **Owning Module / Service:** `modules/journeys`
- **Code Model / Schema Reference:** `Journey` in `server\src\modules\journeys\models\journey.model.ts`
- **Metrics:**
  - **Document Count:** 66
  - **Logical Data Size:** 0.08 MB (85,226 bytes)
  - **WiredTiger Storage Size:** 0.06 MB (61,440 bytes)
  - **Total Index Size:** 0.42 MB (442,368 bytes across 12 indexes)
  - **Average Document Size:** 1291 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Internal training and onboarding IP
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Core organizational asset.
  - **Risk of Deletion:** Critical: Primary curriculum definitions.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 66 records, 12 indexes.

---

### 32. `organizations`

- **Business Purpose:** Top-level tenant records, company names, settings, domain whitelist, and branding
- **Owning Module / Service:** `modules/organizations`
- **Code Model / Schema Reference:** `Organization` in `server\src\modules\organizations\models\organization.model.ts`
- **Metrics:**
  - **Document Count:** 55
  - **Logical Data Size:** 0.07 MB (73,756 bytes)
  - **WiredTiger Storage Size:** 0.05 MB (53,248 bytes)
  - **Total Index Size:** 0.14 MB (147,456 bytes across 4 indexes)
  - **Average Document Size:** 1341 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt / updatedAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Tenant configuration and identity
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely while organization is a customer. Hard delete only on tenant offboarding after export.
  - **Risk of Deletion:** Critical: Tenant root entity.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 55 records.

---

### 33. `expense_records`

- **Business Purpose:** Operational expense entries, software licensing, and cloud infrastructure costs per tenant
- **Owning Module / Service:** `modules/super-admin`
- **Code Model / Schema Reference:** `ExpenseRecord` in `server\src\modules\super-admin\models\expense-record.model.ts`
- **Metrics:**
  - **Document Count:** 41
  - **Logical Data Size:** 0.01 MB (12,089 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.21 MB (221,184 bytes across 6 indexes)
  - **Average Document Size:** 294 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `incurredAt / createdAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Internal company financials
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **B (Super Admin backup-and-purge workflow with legal retention)**
  - **Recommended Retention Period:** 7 years (statutory accounting compliance).
  - **Risk of Deletion:** High: Financial audit trail.
  - **Implementation Complexity:** High: Retain with archival.
- **Operational Findings & Evidence:** 41 records.

---

### 34. `documentassignments`

- **Business Purpose:** Legal and compliance document sign-off assignments (NDA, handbooks, tax forms)
- **Owning Module / Service:** `modules/documents`
- **Code Model / Schema Reference:** `DocumentAssignment` in `server\src\modules\documents\models\document-assignment.model.ts`
- **Metrics:**
  - **Document Count:** 31
  - **Logical Data Size:** 0.03 MB (27,777 bytes)
  - **WiredTiger Storage Size:** 0.05 MB (53,248 bytes)
  - **Total Index Size:** 0.11 MB (110,592 bytes across 3 indexes)
  - **Average Document Size:** 896 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt / signedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** High: Signed legal agreements, e-signatures
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely or minimum 7 years post-employment (contract law compliance).
  - **Risk of Deletion:** Critical: Legal compliance documentation.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 31 records.

---

### 35. `documenttemplates`

- **Business Purpose:** Templates for legal agreements, digital signatures, and onboarding questionnaires
- **Owning Module / Service:** `modules/documents`
- **Code Model / Schema Reference:** `DocumentTemplate` in `server\src\modules\documents\models\document-template.model.ts`
- **Metrics:**
  - **Document Count:** 30
  - **Logical Data Size:** 0.01 MB (11,757 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.11 MB (110,592 bytes across 3 indexes)
  - **Average Document Size:** 391 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Company legal contracts
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Core template catalog.
  - **Risk of Deletion:** Critical: Required by active document assignments.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 30 records.

---

### 36. `certificates`

- **Business Purpose:** Issued course and milestone certificates with digital verification QR codes and hashes
- **Owning Module / Service:** `modules/certificates`
- **Code Model / Schema Reference:** `Certificate` in `server\src\modules\certificates\models\certificate.model.ts`
- **Metrics:**
  - **Document Count:** 24
  - **Logical Data Size:** 0.02 MB (17,403 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (45,056 bytes)
  - **Total Index Size:** 0.25 MB (258,048 bytes across 7 indexes)
  - **Average Document Size:** 725 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `issuedAt / createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Public/Confidential credential proofs
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Publicly verifiable credentials.
  - **Risk of Deletion:** High: Deletion invalidates employee digital certificates.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 24 records, 7 indexes.

---

### 37. `knowledgeGaps`

- **Business Purpose:** AI-identified queries where employees searched knowledge base without finding answers
- **Owning Module / Service:** `modules/knowledge-base`
- **Code Model / Schema Reference:** `KnowledgeGap` in `server\src\modules\knowledge-base\models\knowledge-gap.model.ts`
- **Metrics:**
  - **Document Count:** 15
  - **Logical Data Size:** 0.01 MB (5,321 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.21 MB (221,184 bytes across 6 indexes)
  - **Average Document Size:** 354 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt / resolvedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Employee search inquiries
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Active database: retain until addressed/closed. Closed gaps purgeable after 180 days.
  - **Risk of Deletion:** Low: Product improvement feedback.
  - **Implementation Complexity:** Low: Controlled retention.
- **Operational Findings & Evidence:** 15 records.

---

### 38. `scheduledreports`

- **Business Purpose:** Automated recurring report delivery schedules (weekly executive summaries, CSV exports)
- **Owning Module / Service:** `modules/analytics`
- **Code Model / Schema Reference:** `ScheduledReport` in `server\src\modules\analytics\models\scheduled-report.model.ts`
- **Metrics:**
  - **Document Count:** 14
  - **Logical Data Size:** 0 MB (4,144 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.07 MB (73,728 bytes across 2 indexes)
  - **Average Document Size:** 296 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Report definitions
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while report schedule is enabled.
  - **Risk of Deletion:** Medium: Active cron definitions.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 14 records.

---

### 39. `buddyprofiles`

- **Business Purpose:** Employee onboarding buddy mentor profiles, capacities, languages, and skills
- **Owning Module / Service:** `modules/buddy`
- **Code Model / Schema Reference:** `BuddyProfile` in `server\src\modules\buddy\models\buddy-profile.model.ts`
- **Metrics:**
  - **Document Count:** 14
  - **Logical Data Size:** 0 MB (2,800 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.11 MB (110,592 bytes across 3 indexes)
  - **Average Document Size:** 200 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Employee profile preferences
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while employee is registered as an active buddy mentor.
  - **Risk of Deletion:** Medium: Buddy matching system data.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 14 records.

---

### 40. `rolechecklisttemplates`

- **Business Purpose:** Department and role-specific checklists (IT hardware, engineering setup, sales access)
- **Owning Module / Service:** `modules/tasks`
- **Code Model / Schema Reference:** `RoleChecklistTemplate` in `server\src\modules\tasks\models\role-checklist-template.model.ts`
- **Metrics:**
  - **Document Count:** 14
  - **Logical Data Size:** 0.01 MB (12,586 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.18 MB (184,320 bytes across 5 indexes)
  - **Average Document Size:** 899 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Company operational setup procedures
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Configuration asset.
  - **Risk of Deletion:** High: Referenced by onboarding cases.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 14 records.

---

### 41. `buddyassignments`

- **Business Purpose:** Active pairings between new hires and seasoned team buddies
- **Owning Module / Service:** `modules/buddy`
- **Code Model / Schema Reference:** `BuddyAssignment` in `server\src\modules\buddy\models\buddy-assignment.model.ts`
- **Metrics:**
  - **Document Count:** 14
  - **Logical Data Size:** 0.01 MB (13,706 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.11 MB (110,592 bytes across 3 indexes)
  - **Average Document Size:** 979 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt / completedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Employee mentorship pairing
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain for onboarding duration + 1 year for cohort review.
  - **Risk of Deletion:** Medium: Coaching history.
  - **Implementation Complexity:** Low: Controlled retention.
- **Operational Findings & Evidence:** 14 records.

---

### 42. `kioskdeviceassignments`

- **Business Purpose:** Assignments of kiosk hardware units to physical locations, offices, or lobbies
- **Owning Module / Service:** `modules/kiosk`
- **Code Model / Schema Reference:** `KioskDeviceAssignment` in `server\src\modules\kiosk\models\kiosk-assignment.model.ts`
- **Metrics:**
  - **Document Count:** 8
  - **Logical Data Size:** 0 MB (2,176 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.21 MB (221,184 bytes across 6 indexes)
  - **Average Document Size:** 272 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `assignedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Hardware asset tracking
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while device is assigned to location.
  - **Risk of Deletion:** High: Physical kiosk routing.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 8 records.

---

### 43. `packages`

- **Business Purpose:** Subscription packages, tier entitlements, feature limits, and modular pricing definitions
- **Owning Module / Service:** `modules/super-admin`
- **Code Model / Schema Reference:** `Package` in `server\src\modules\super-admin\models\package.model.ts`
- **Metrics:**
  - **Document Count:** 5
  - **Logical Data Size:** 0.03 MB (29,852 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (45,056 bytes)
  - **Total Index Size:** 0.21 MB (221,184 bytes across 6 indexes)
  - **Average Document Size:** 5970 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Commercial pricing strategy
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. System pricing definitions.
  - **Risk of Deletion:** Critical: Governs tenant feature access and billing.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 5 records.

---

### 44. `uploads`

- **Business Purpose:** Metadata, MIME types, file sizes, R2/S3 object keys, and hashes for all user-uploaded media
- **Owning Module / Service:** `modules/uploads`
- **Code Model / Schema Reference:** `Upload` in `server\src\modules\uploads\models\upload.model.ts`
- **Metrics:**
  - **Document Count:** 5
  - **Logical Data Size:** 0 MB (3,844 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.32 MB (331,776 bytes across 9 indexes)
  - **Average Document Size:** 768 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt / deletedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Upload metadata, storage keys
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while referencing document/article/avatar exists. Soft-deleted uploads purgeable after 30 days with S3 object deletion cascade.
  - **Risk of Deletion:** Critical: Deleting metadata orphans objects in cloud storage.
  - **Implementation Complexity:** Medium: Cascade with R2 storage deletion.
- **Operational Findings & Evidence:** 5 records, 9 indexes.

---

### 45. `ssoconfigs`

- **Business Purpose:** SAML 2.0 / OIDC identity provider configurations, certificates, and metadata URLs
- **Owning Module / Service:** `modules/auth`
- **Code Model / Schema Reference:** `SSOConfig` in `server\src\modules\auth\models\sso-config.model.ts`
- **Metrics:**
  - **Document Count:** 4
  - **Logical Data Size:** 0 MB (1,092 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.11 MB (110,592 bytes across 3 indexes)
  - **Average Document Size:** 273 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** High: Identity provider certificates and endpoints
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while SSO is configured for organization.
  - **Risk of Deletion:** Critical: Deletion locks out enterprise SSO users.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 4 records.

---

### 46. `calendarconnections`

- **Business Purpose:** OAuth tokens and sync configurations for Google Calendar and Microsoft 365
- **Owning Module / Service:** `modules/calendar`
- **Code Model / Schema Reference:** `CalendarConnection` in `server\src\modules\calendar\models\calendar-connection.model.ts`
- **Metrics:**
  - **Document Count:** 3
  - **Logical Data Size:** 0 MB (798 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.14 MB (147,456 bytes across 4 indexes)
  - **Average Document Size:** 266 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** High: OAuth refresh tokens (encrypted)
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while user/organization has active calendar integration. Invalidate on revocation.
  - **Risk of Deletion:** High: Calendar sync failure if removed.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 3 records.

---

### 47. `platform_feature_flags`

- **Business Purpose:** Legacy bootstrap collection containing raw initial platform flag definitions seeded during startup
- **Owning Module / Service:** `modules/super-admin`
- **Code Model / Schema Reference:** *N/A* in *No direct code model (system/legacy)*
- **Metrics:**
  - **Document Count:** 2
  - **Logical Data Size:** 0 MB (190 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.04 MB (36,864 bytes across 1 indexes)
  - **Average Document Size:** 95 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `none (raw document)`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Platform configuration
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **E (Investigate before deciding)**
  - **Recommended Retention Period:** Investigate: If all flags are present in feature_flags, this collection can be marked deprecated and archived.
  - **Risk of Deletion:** Low: SuperAdminService.syncDefaultFeatureFlags() checks this collection on startup.
  - **Implementation Complexity:** Low: Document and investigate deprecation.
- **Operational Findings & Evidence:** 2 records, 1 index (_id_).

---

### 48. `aiconversations`

- **Business Purpose:** Conversations and chat history between employees and the AI onboarding assistant
- **Owning Module / Service:** `modules/ai`
- **Code Model / Schema Reference:** `AIConversation` in `server\src\modules\ai\models\ai-conversation.model.ts`
- **Metrics:**
  - **Document Count:** 2
  - **Logical Data Size:** 0 MB (1,764 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.07 MB (73,728 bytes across 2 indexes)
  - **Average Document Size:** 882 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt / createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** High: May contain employee questions and personal onboarding inquiries
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Active database: 90 days. User can clear chat history on demand.
  - **Risk of Deletion:** Medium: AI assistant context continuity.
  - **Implementation Complexity:** Low: Retained under controlled policy.
- **Operational Findings & Evidence:** 2 records.

---

### 49. `hrisintegrations`

- **Business Purpose:** Integration connection credentials and mappings for external HRIS systems
- **Owning Module / Service:** `modules/integrations`
- **Code Model / Schema Reference:** `HRISIntegration` in `server\src\modules\integrations\models\hris-integration.model.ts`
- **Metrics:**
  - **Document Count:** 2
  - **Logical Data Size:** 0 MB (1,532 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.07 MB (73,728 bytes across 2 indexes)
  - **Average Document Size:** 766 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** High: Encrypted API credentials
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while integration is connected.
  - **Risk of Deletion:** Critical: Breaks automated employee provisioning if deleted.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 2 records.

---

### 50. `organization_integrations`

- **Business Purpose:** Tenant third-party webhooks, Slack, Teams, and Zapier endpoint configurations
- **Owning Module / Service:** `modules/integrations`
- **Code Model / Schema Reference:** `OrganizationIntegration` in `server\src\modules\integrations\models\organization-integration.model.ts`
- **Metrics:**
  - **Document Count:** 2
  - **Logical Data Size:** 0 MB (1,100 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.11 MB (110,592 bytes across 3 indexes)
  - **Average Document Size:** 550 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Webhook signing secrets, URLs
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while integration is active.
  - **Risk of Deletion:** High: Disables organizational notifications.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 2 records.

---

### 51. `kioskdevicegroups`

- **Business Purpose:** Logical clustering of kiosks by building, campus, or department
- **Owning Module / Service:** `modules/kiosk`
- **Code Model / Schema Reference:** `KioskDeviceGroup` in `server\src\modules\kiosk\models\kiosk-device-group.model.ts`
- **Metrics:**
  - **Document Count:** 1
  - **Logical Data Size:** 0 MB (249 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.25 MB (258,048 bytes across 7 indexes)
  - **Average Document Size:** 249 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Device organizational layout
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while group exists.
  - **Risk of Deletion:** Medium: Group policy routing.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 1 record.

---

### 52. `invoices`

- **Business Purpose:** Platform billing invoices generated for customer subscription packages
- **Owning Module / Service:** `modules/super-admin`
- **Code Model / Schema Reference:** `Invoice` in `server\src\modules\super-admin\models\invoice.model.ts`
- **Metrics:**
  - **Document Count:** 1
  - **Logical Data Size:** 0 MB (572 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.42 MB (442,368 bytes across 12 indexes)
  - **Average Document Size:** 572 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `issueDate / createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Financial customer invoices
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **B (Super Admin backup-and-purge workflow with legal retention)**
  - **Recommended Retention Period:** 7 years (statutory tax and accounting requirement).
  - **Risk of Deletion:** Critical: Tax compliance document.
  - **Implementation Complexity:** High: Super Admin backup before archive.
- **Operational Findings & Evidence:** 1 record, 12 indexes.

---

### 53. `demotenants`

- **Business Purpose:** Sandbox and interactive demo tenant configurations for sales prospect walkthroughs
- **Owning Module / Service:** `modules/demo`
- **Code Model / Schema Reference:** *N/A* in *No direct code model (system/legacy)*
- **Metrics:**
  - **Document Count:** 1
  - **Logical Data Size:** 0 MB (369 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.04 MB (36,864 bytes across 1 indexes)
  - **Average Document Size:** 369 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `expiresAt / createdAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Demo prospect email and temporary sandbox state
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** Expires on expiresAt (typically 24 hours to 7 days).
  - **Risk of Deletion:** Low: Designed for automated reset.
  - **Implementation Complexity:** Low: Add TTL index on expiresAt (expireAfterSeconds: 0).
- **Operational Findings & Evidence:** 1 record.

---

### 54. `platform_settings`

- **Business Purpose:** Global platform configuration (maintenance mode, rate limits, SMTP, telemetry toggles)
- **Owning Module / Service:** `modules/super-admin`
- **Code Model / Schema Reference:** `PlatformSetting` in `server\src\modules\super-admin\models\platform-setting.model.ts`
- **Metrics:**
  - **Document Count:** 1
  - **Logical Data Size:** 0 MB (254 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.07 MB (73,728 bytes across 2 indexes)
  - **Average Document Size:** 254 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Platform operational settings
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Singleton platform configuration.
  - **Risk of Deletion:** Critical: System operational settings.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 1 record.

---

### 55. `ai_usage_records`

- **Business Purpose:** Token usage and cost metering for LLM calls executed on behalf of organizations
- **Owning Module / Service:** `modules/super-admin`
- **Code Model / Schema Reference:** `AIUsageRecord` in `server\src\modules\super-admin\models\ai-usage-record.model.ts`
- **Metrics:**
  - **Document Count:** 1
  - **Logical Data Size:** 0 MB (308 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.28 MB (294,912 bytes across 8 indexes)
  - **Average Document Size:** 308 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `timestamp / createdAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Cost and usage telemetry
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **B (Super Admin backup-and-purge workflow)**
  - **Recommended Retention Period:** Active database: 365 days. Archive historical records to cold storage for yearly billing audits.
  - **Risk of Deletion:** Low: Billing reconciliation requires 1 year active.
  - **Implementation Complexity:** Medium: Super Admin backup/archival.
- **Operational Findings & Evidence:** 1 record, 8 indexes.

---

### 56. `aicoursedrafts`

- **Business Purpose:** In-progress AI-generated curriculum and quiz drafts before administrative approval
- **Owning Module / Service:** `modules/ai`
- **Code Model / Schema Reference:** `AICourseDraft` in `server\src\modules\ai\models\ai-course-draft.model.ts`
- **Metrics:**
  - **Document Count:** 1
  - **Logical Data Size:** 0 MB (3,732 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.07 MB (73,728 bytes across 2 indexes)
  - **Average Document Size:** 3732 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** `organizationId` present (Tenant-Isolated)
  - **Data Sensitivity:** Draft course material
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain drafts until approved or explicitly deleted by author. Abandoned drafts purgeable after 180 days.
  - **Risk of Deletion:** Low: User work in progress.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 1 record.

---

### 57. `workflow_rules`

- **Business Purpose:** Configured conditional automation triggers (e.g., 'When journey complete -> Assign IT checklist')
- **Owning Module / Service:** `modules/workflows`
- **Code Model / Schema Reference:** `WorkflowRule` in `server\src\modules\workflows\models\workflow-rule.model.ts`
- **Metrics:**
  - **Document Count:** 0
  - **Logical Data Size:** 0 MB (0 bytes)
  - **WiredTiger Storage Size:** 0.02 MB (24,576 bytes)
  - **Total Index Size:** 0.09 MB (98,304 bytes across 4 indexes)
  - **Average Document Size:** 0 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Business automation logic
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Core automation configuration.
  - **Risk of Deletion:** Critical: Core workflow automation stops if deleted.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 0 records currently in active collection.

---

### 58. `officelocations`

- **Business Purpose:** Physical company office locations, floor plans, and geographical zones
- **Owning Module / Service:** `modules/locations`
- **Code Model / Schema Reference:** `OfficeLocation` in `server\src\modules\locations\models\office-location.model.ts`
- **Metrics:**
  - **Document Count:** 0
  - **Logical Data Size:** 0 MB (0 bytes)
  - **WiredTiger Storage Size:** 0.03 MB (32,768 bytes)
  - **Total Index Size:** 0.06 MB (65,536 bytes across 2 indexes)
  - **Average Document Size:** 0 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Company office addresses
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Company asset.
  - **Risk of Deletion:** Medium: Used for on-site onboarding and kiosk placement.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 0 records.

---

### 59. `kiosk_pairing_codes`

- **Business Purpose:** One-time 6-digit cryptographic pairing codes for enrolling physical kiosks
- **Owning Module / Service:** `modules/kiosk`
- **Code Model / Schema Reference:** `KioskPairingCode` in `server\src\modules\kiosk\models\kiosk-pairing-code.model.ts`
- **Metrics:**
  - **Document Count:** 0
  - **Logical Data Size:** 0 MB (0 bytes)
  - **WiredTiger Storage Size:** 0.04 MB (36,864 bytes)
  - **Total Index Size:** 0.3 MB (319,488 bytes across 9 indexes)
  - **Average Document Size:** 0 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `expiresAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** High: Temporary device enrollment secret
  - **Existing TTL Index:** **Yes** (`expiresAt_1`, 0s on `{"expiresAt":1}`)
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** Expires on expiresAt (already configured with TTL index: expireAfterSeconds: 0, 15 min expiry).
  - **Risk of Deletion:** Low: Short-lived pairing token.
  - **Implementation Complexity:** Low: Active TTL index functioning properly.
- **Operational Findings & Evidence:** 0 records.

---

### 60. `paymentrecords`

- **Business Purpose:** Legacy collection created by early Mongoose default naming prior to explicit payment_records collection specification
- **Owning Module / Service:** `modules/super-admin`
- **Code Model / Schema Reference:** `PaymentRecord` in `server\src\modules\super-admin\models\payment-record.model.ts`
- **Metrics:**
  - **Document Count:** 0
  - **Logical Data Size:** 0 MB (0 bytes)
  - **WiredTiger Storage Size:** 0 MB (4,096 bytes)
  - **Total Index Size:** 0 MB (4,096 bytes across 1 indexes)
  - **Average Document Size:** 0 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `none`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** None (empty collection)
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **E (Investigate before deciding)**
  - **Recommended Retention Period:** Investigate and drop after verifying active model points to payment_records. Empty (0 documents).
  - **Risk of Deletion:** None: 0 records, verified obsolete legacy collection.
  - **Implementation Complexity:** Low: Safe candidate for cleanup.
- **Operational Findings & Evidence:** 0 records, 1 index (_id_).

---

### 61. `knowledgeBase`

- **Business Purpose:** Company knowledge base articles, onboarding wikis, policies, and rich text guides
- **Owning Module / Service:** `modules/knowledge-base`
- **Code Model / Schema Reference:** `Article` in `server\src\modules\knowledge-base\models\article.model.ts`
- **Metrics:**
  - **Document Count:** 0
  - **Logical Data Size:** 0 MB (0 bytes)
  - **WiredTiger Storage Size:** 0.03 MB (32,768 bytes)
  - **Total Index Size:** 0.38 MB (393,216 bytes across 12 indexes)
  - **Average Document Size:** 0 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt / updatedAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Internal organizational documents
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Core institutional knowledge base.
  - **Risk of Deletion:** Critical: Company learning and knowledge repository.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 0 records in current DB snapshot, 12 indexes.

---

### 62. `pushsubscriptions`

- **Business Purpose:** Web Push API subscription endpoints and browser encryption keys (VAPID)
- **Owning Module / Service:** `modules/notifications`
- **Code Model / Schema Reference:** `PushSubscription` in `server\src\modules\notifications\models\push-subscription.model.ts`
- **Metrics:**
  - **Document Count:** 0
  - **Logical Data Size:** 0 MB (0 bytes)
  - **WiredTiger Storage Size:** 0.02 MB (24,576 bytes)
  - **Total Index Size:** 0.07 MB (73,728 bytes across 3 indexes)
  - **Average Document Size:** 0 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Browser push endpoints
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while browser subscription is active. Invalidate on 410 Gone / 404 response.
  - **Risk of Deletion:** Low: Re-created when user grants browser permission.
  - **Implementation Complexity:** Low: Retained under controlled policy.
- **Operational Findings & Evidence:** 0 records.

---

### 63. `kioskemergencies`

- **Business Purpose:** Kiosk physical distress, tamper alarm, and SOS emergency beacon event log
- **Owning Module / Service:** `modules/kiosk`
- **Code Model / Schema Reference:** `KioskEmergency` in `server\src\modules\kiosk\models\kiosk-emergency.model.ts`
- **Metrics:**
  - **Document Count:** 0
  - **Logical Data Size:** 0 MB (0 bytes)
  - **WiredTiger Storage Size:** 0.02 MB (24,576 bytes)
  - **Total Index Size:** 0.12 MB (122,880 bytes across 4 indexes)
  - **Average Document Size:** 0 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Facility safety and emergency events
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **B (Super Admin backup-and-purge workflow with safety compliance)**
  - **Recommended Retention Period:** Active database: 365 days. Archive to cold storage (occupational safety / building audit compliance).
  - **Risk of Deletion:** High: Safety incident documentation.
  - **Implementation Complexity:** Medium: Backup before purge.
- **Operational Findings & Evidence:** 0 records.

---

### 64. `demousers`

- **Business Purpose:** Ephemeral user accounts generated for interactive prospect sandbox sessions
- **Owning Module / Service:** `modules/demo`
- **Code Model / Schema Reference:** `User` in `server\src\modules\auth\models\user.model.ts`
- **Metrics:**
  - **Document Count:** 0
  - **Logical Data Size:** 0 MB (0 bytes)
  - **WiredTiger Storage Size:** 0 MB (4,096 bytes)
  - **Total Index Size:** 0 MB (4,096 bytes across 1 indexes)
  - **Average Document Size:** 0 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Temporary credentials
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** Purge when demo tenant expires or resets.
  - **Risk of Deletion:** Low: Ephemeral demo accounts.
  - **Implementation Complexity:** Low: Cascade with demo tenant reset.
- **Operational Findings & Evidence:** 0 records.

---

### 65. `kiosk_webhook_deliveries`

- **Business Purpose:** Outbound webhook dispatch logs to client physical security or badge printing systems
- **Owning Module / Service:** `modules/kiosk`
- **Code Model / Schema Reference:** `KioskWebhookDelivery` in `server\src\modules\kiosk\models\kiosk-webhook-delivery.model.ts`
- **Metrics:**
  - **Document Count:** 0
  - **Logical Data Size:** 0 MB (0 bytes)
  - **WiredTiger Storage Size:** 0.03 MB (32,768 bytes)
  - **Total Index Size:** 0.22 MB (229,376 bytes across 7 indexes)
  - **Average Document Size:** 0 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `createdAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** External dispatch log
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **A (Automatic expiration)**
  - **Recommended Retention Period:** 30 days for delivered/failed webhook traces.
  - **Risk of Deletion:** Low: Diagnostic traces.
  - **Implementation Complexity:** Low: Add TTL index on createdAt (2,592,000s = 30 days).
- **Operational Findings & Evidence:** 0 records.

---

### 66. `quickLinks`

- **Business Purpose:** Curated shortcut links to internal tools, IT helpdesk, payroll portals, and benefits
- **Owning Module / Service:** `modules/knowledge-base`
- **Code Model / Schema Reference:** `QuickLink` in `server\src\modules\knowledge-base\models\quick-link.model.ts`
- **Metrics:**
  - **Document Count:** 0
  - **Logical Data Size:** 0 MB (0 bytes)
  - **WiredTiger Storage Size:** 0 MB (4,096 bytes)
  - **Total Index Size:** 0.01 MB (12,288 bytes across 3 indexes)
  - **Average Document Size:** 0 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Internal links
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Tenant configuration asset.
  - **Risk of Deletion:** Medium: New hire navigation shortcuts.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 0 records.

---

### 67. `kiosk_webhook_subscriptions`

- **Business Purpose:** Registered client HTTP callback endpoints for kiosk hardware events
- **Owning Module / Service:** `modules/kiosk`
- **Code Model / Schema Reference:** `KioskWebhookSubscription` in `server\src\modules\kiosk\models\kiosk-webhook-subscription.model.ts`
- **Metrics:**
  - **Document Count:** 0
  - **Logical Data Size:** 0 MB (0 bytes)
  - **WiredTiger Storage Size:** 0.03 MB (32,768 bytes)
  - **Total Index Size:** 0.13 MB (131,072 bytes across 4 indexes)
  - **Average Document Size:** 0 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Client endpoint URLs and signing secrets
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain while webhook subscription is active.
  - **Risk of Deletion:** High: Disables customer kiosk integrations if deleted.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 0 records.

---

### 68. `i18nTranslations`

- **Business Purpose:** Polymorphic multilingual translations for articles, journeys, tasks, and system UI strings
- **Owning Module / Service:** `modules/localization`
- **Code Model / Schema Reference:** `Translation` in `server\src\modules\localization\models\translation.model.ts`
- **Metrics:**
  - **Document Count:** 0
  - **Logical Data Size:** 0 MB (0 bytes)
  - **WiredTiger Storage Size:** 0 MB (4,096 bytes)
  - **Total Index Size:** 0.02 MB (24,576 bytes across 6 indexes)
  - **Average Document Size:** 0 bytes
- **Schema & Identification:**
  - **Timestamp Field(s):** `updatedAt`
  - **Tenant Ownership:** Global / Multi-tenant / System
  - **Data Sensitivity:** Multilingual content translations
  - **Existing TTL Index:** **No**
- **Retention & Governance Strategy:**
  - **Classification:** **D (Retain indefinitely / controlled policy)**
  - **Recommended Retention Period:** Retain indefinitely. Translation history preserved via OUTDATED status (explicitly documented: do NOT delete outdated records).
  - **Risk of Deletion:** Critical: Deleting translations removes internationalization for global employees.
  - **Implementation Complexity:** Low: Retain.
- **Operational Findings & Evidence:** 0 records.

---

