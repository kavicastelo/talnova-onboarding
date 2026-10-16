# Enterprise Database Retention & Archival Policy

## 1. Governance & Regulatory Framework

The Talnova Enterprise Onboarding platform stores operational data, employee onboarding workflows, digital legal documents, integration telemetry, and financial records. Data retention is governed by five mandatory pillars:

1. **Storage Optimization**: Ephemeral background queues, raw telemetry, and operational messages must not consume unbounded primary database capacity.
2. **Auditability & Compliance (SOC2 / HIPAA / ISO 27001)**: Administrative changes, security events, authentication attempts, and authorization mutations must be retained for at least 7 years in immutable or tamper-evident cold archives.
3. **Statutory Financial Retention (IRS / HMRC / GAAP)**: Invoices, payment records, billing events, and expense entries must be preserved for a minimum of 7 years (84 months).
4. **Data Privacy & GDPR (Art 5(1)(e) Storage Limitation & Art 17 Right to Erasure)**: Personal data must not be stored longer than necessary for the purposes for which it is processed. User-generated content must support tenant-scoped offboarding and anonymization.
5. **Employment & Labor Law**: Onboarding sign-offs, signed NDAs, compliance training certificates, and milestone verifications must be retained throughout active employment plus 3 to 7 years post-termination.

---

## 2. Policy Classification Categories

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA RETENTION TIERS                            │
├────────────────────────────────┬───────────────────────────────────────┤
│ Tier 1: Ephemeral / Queues     │ TTL: 7 - 30 days (Auto-eviction)      │
│ Tier 2: Diagnostic & Telemetry │ TTL: 30 - 90 days (Auto-eviction)     │
│ Tier 3: Inactive Notifications │ Purge / TTL: 30 - 90 days             │
│ Tier 4: Operational History    │ Active: 1 yr -> Cold Archive: 3 - 7 yr│
│ Tier 5: Financial & Legal Docs │ Active: 7 yr -> Cold Archive          │
│ Tier 6: Core Domain Master     │ Indefinite (Controlled lifecycle)     │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 3. Detailed Collection Retention Policies

### Tier 1: Ephemeral Operational & Queue Data (Strategy A & C)

#### 1. `system_jobs` (Queue State Machine)
- **Policy**:
  - `status: "completed"`: Expire **7 days** after `completedAt`.
  - `status: "failed"`: Expire **30 days** after `completedAt` or `updatedAt` to permit engineering troubleshooting.
  - `status: "pending"` or `"processing"`: **NEVER EXPIRE**. Must be protected by strict query filters.
- **Timestamp Field**: `completedAt` (Date).
- **TTL Index Specification**:
  ```javascript
  db.system_jobs.createIndex(
    { completedAt: 1 },
    {
      name: "system_jobs_completedAt_ttl",
      expireAfterSeconds: 7 * 24 * 60 * 60, // 604800 seconds (7 days)
      partialFilterExpression: { status: "completed" }
    }
  );
  ```
- **Historical Backlog Remediation**: Historical completed jobs lacking `completedAt` must have `completedAt` backfilled using `updatedAt` prior to index activation, or be purged via the Super Admin batch purge tool.

#### 2. `outbox_events` (Transactional Outbox)
- **Policy**:
  - `status: "published"`: Expire **7 days** after `publishedAt`.
  - `status: "failed"`: Expire **30 days** after last retry.
  - `status: "pending"` or `"processing"`: **NEVER EXPIRE**.
- **Timestamp Field**: `publishedAt` (Date).
- **TTL Index Specification**:
  ```javascript
  db.outbox_events.createIndex(
    { publishedAt: 1 },
    {
      name: "outbox_events_published_ttl",
      expireAfterSeconds: 7 * 24 * 60 * 60,
      partialFilterExpression: { status: "published" }
    }
  );
  ```

#### 3. `sessions` (Authentication Refresh Tokens)
- **Policy**: Expire immediately upon token validity expiration (`expiresAt`).
- **Existing TTL Index**: `{ expiresAt: 1 }` with `expireAfterSeconds: 0` (Active and functioning).

#### 4. `kiosk_pairing_codes` (Hardware Pairing PINs)
- **Policy**: Expire immediately upon expiry timestamp (typically 15 minutes).
- **Existing TTL Index**: `{ expiresAt: 1 }` with `expireAfterSeconds: 0` (Active and functioning).

---

### Tier 2: Diagnostic Logs & Hardware Telemetry (Strategy A)

#### 1. `kiosk_device_telemetry` (Kiosk Heartbeats)
- **Policy**: Retain raw ping records for **30 days** in the primary database. Hourly health statistics are aggregated into `kioskanalytics`.
- **Existing TTL Index**: `{ createdAt: 1 }` with `expireAfterSeconds: 2592000` (30 days).

#### 2. `feature_usage_records` (Raw Feature Telemetry)
- **Policy**: Retain raw feature invocations for **90 days**. Aggregated rolls are stored in `feature_adoption_rollups`.
- **Existing TTL Index**: `{ timestamp: 1 }` with `expireAfterSeconds: 7776000` (90 days).

#### 3. `kioskanalytics` (Daily/Weekly Kiosk Rollups)
- **Policy**: Retain aggregated kiosk analytics for **365 days** (1 year).
- **Existing TTL Index**: `{ createdAt: 1 }` with `expireAfterSeconds: 31536000` (365 days).

#### 4. `hriswebhooklogs` (External HRIS Inbound Logs)
- **Policy**: Retain raw payloads for **30 days**. Essential employee data is already persisted in `users` and `employees`.
- **Proposed TTL Index**:
  ```javascript
  db.hriswebhooklogs.createIndex(
    { createdAt: 1 },
    { name: "hriswebhooklogs_createdAt_ttl", expireAfterSeconds: 30 * 24 * 60 * 60 }
  );
  ```

#### 5. `synclogs` (SCIM / Calendar Sync Logs)
- **Policy**: Retain sync diagnostic runs for **60 days**.
- **Proposed TTL Index**:
  ```javascript
  db.synclogs.createIndex(
    { createdAt: 1 },
    { name: "synclogs_createdAt_ttl", expireAfterSeconds: 60 * 24 * 60 * 60 }
  );
  ```

#### 6. `workflow_execution_logs` (Workflow Engine Step Traces)
- **Policy**: Retain granular rule evaluation traces for **90 days**. Permanent business milestone outcomes are logged in `auditLogs` and `tasks`.
- **Proposed TTL Index**:
  ```javascript
  db.workflow_execution_logs.createIndex(
    { createdAt: 1 },
    { name: "workflow_execution_logs_createdAt_ttl", expireAfterSeconds: 90 * 24 * 60 * 60 }
  );
  ```

#### 7. `alerts` (Super Admin & Manager Operational Alerts)
- **Policy**:
  - `status: "resolved"` or `"dismissed"`: Expire **30 days** after resolution (`resolvedAt`).
  - `status: "open"` or `"in_progress"`: Retain until explicitly acted upon.
- **Proposed TTL Index**:
  ```javascript
  db.alerts.createIndex(
    { resolvedAt: 1 },
    {
      name: "alerts_resolvedAt_ttl",
      expireAfterSeconds: 30 * 24 * 60 * 60,
      partialFilterExpression: { status: { $in: ["resolved", "dismissed"] } }
    }
  );
  ```

---

### Tier 3: Communication & In-App Notifications (Strategy C)

#### `notifications` (User Alerts & Reminders)
- **Current Defect**: Schema has `{ expiresAt: 1 }` with `expireAfterSeconds: 0`, but 96.4% of existing records have `expiresAt: null`.
- **Policy**:
  1. **Read Notifications (`isRead: true`)**: Expire **30 days** after `readAt`.
  2. **Unread Automated Nudges / Due Soon Reminders**: Expire **90 days** after `createdAt`.
  3. **Critical Security / Compliance Alerts**: Expire **180 days** after `createdAt`, with Super Admin export/backup option prior to deletion.
  4. **Active Notification Creation Hook**: All notification publishers must populate `expiresAt` automatically based on `priority` and `type`.

---

### Tier 4: Regulatory Compliance & Financial Audit (Strategy B)

#### 1. `auditLogs` (Compliance Audit Trail)
- **Policy**:
  - **Active Production Database**: Retain **365 days** (1 year) for rapid operational lookup and incident response.
  - **Cold Storage Archive (Cloudflare R2 / AWS S3 Glacier)**: Encrypted JSON/Parquet archives retained for **7 years** (SOC2 / HIPAA requirement).
  - Purge from active MongoDB only following verified backup creation and SHA-256 manifest validation.
- **Existing Primary Database Index**: `{ createdAt: 1 }` with `expireAfterSeconds: 220752000` (7 years).

#### 2. `payment_records`, `invoices`, `expense_records` (Financial Ledgers)
- **Policy**:
  - Retain for **7 years** minimum.
  - Immutable ledgers. Hard deletes strictly prohibited. Soft deletes permitted only with Super Admin audit attribution.
  - Purge from active DB allowed only after 7-year statutory lock expires and full encrypted fiscal year archives are verified.

---

### Tier 5: Core Master Business Domain (Strategy D)

The following 45 collections contain the foundational organizational knowledge, employee identities, learning curricula, and legal compliance contracts. They are **never subject to automated TTL eviction**:

- **Organizations & Tenancy**: `organizations`, `customer_accounts`, `packages`, `platform_settings`, `feature_flags`.
- **Identity & Access**: `users`, `ssoconfigs`, `notificationpreferences`, `pushsubscriptions`.
- **Onboarding Curricula**: `journeys`, `kioskjourneys`, `kioskjourneyversions`, `milestonetemplates`, `rolechecklisttemplates`, `workflow_rules`, `officelocations`.
- **Active Workflow State**: `onboarding_cases`, `employeeAssignments`, `employeemilestones`, `tasks`, `buddyassignments`, `buddyprofiles`, `meetingevents`, `calendarconnections`, `gamificationprofiles`.
- **Legal & Compliance Artifacts**: `documenttemplates`, `documentassignments` (e-signatures), `certificates`, `uploads` (metadata for files stored in R2).
- **Knowledge & Content**: `knowledgeBase`, `knowledgeChunks`, `knowledgeGaps`, `quickLinks`, `i18nTranslations` (explicitly preserves translation history).
- **Hardware Fleet Assets**: `kioskdevices`, `kioskdevicegroups`, `kioskdeviceassignments`, `kiosk_webhook_subscriptions`.
- **AI Assist State**: `aiconversations`, `aicoursedrafts`.

---

### Tier 6: Legacy & Deprecated Collections (Strategy E)

#### 1. `paymentrecords`
- **Current State**: 0 documents, 1 index (`_id_`). Created by legacy Mongoose naming prior to explicit collection declaration (`collection: "payment_records"`).
- **Recommendation**: Safe candidate for drop during Milestone 3 maintenance migration after verifying no third-party scripts reference it.

#### 2. `platform_feature_flags`
- **Current State**: 2 documents, 1 index (`_id_`). Read once on startup by `syncDefaultFeatureFlags()` to seed `feature_flags`.
- **Recommendation**: Retain in read-only state until platform seed script is refactored to read directly from a JSON/TypeScript migration asset.
