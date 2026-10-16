# Database Storage Optimization Executable Implementation Plan

## Milestone Structure

```
Milestone 1: Read-Only Discovery, Baseline Inventory & Documentation (Completed)
Milestone 2: Retention Policy Engine, Safeguards & Timestamp Validation
Milestone 3: Automatic Expiration Implementation (TTL Indexes & Backfills)
Milestone 4: Backup, Archival & Resumable Purge Infrastructure
Milestone 5: Super Admin Storage Dashboard & UI Integration
Milestone 6: Verification, Automated Testing & Controlled Production Rollout
```

---

## Milestone 1: Read-Only Discovery, Baseline Inventory & Documentation

### Task ID: `TASK-M1-001`
- **Objective:** Inventory all 68 collections, measure storage/index footprint, and reconcile code models against database reality.
- **Priority:** Critical
- **Target Collections:** All 68 MongoDB collections
- **Exact Repository Files:**
  - `docs/database-retention/README.md`
  - `docs/database-retention/collection-inventory.md`
  - `docs/database-retention/collection-inventory.json`
  - `docs/database-retention/retention-policy.md`
  - `docs/database-retention/storage-analysis.md`
  - `docs/database-retention/backup-and-purge-design.md`
  - `docs/database-retention/decision-log.md`
  - `docs/database-retention/verification-and-rollback.md`
  - `docs/database-retention/agent-learning-log.md`
- **Dependencies:** None
- **Required Approvals:** Database Architect / Security Lead
- **Commands to Run:**
  ```bash
  node scratch/generate_inventory_json.cjs
  node scratch/generate_inventory_md.cjs
  ```
- **Expected Outcome:** Persistent, version-controlled knowledge documents detailing all 68 collections.
- **Completion Status:** **COMPLETED**

---

## Milestone 2: Retention Policy Engine, Safeguards & Timestamp Validation

### Task ID: `TASK-M2-001`
- **Objective:** Create a central database retention configuration service with server-side allowlists, timestamp validators, and dry-run preview capabilities.
- **Priority:** High
- **Target Collections:** `system_jobs`, `notifications`, `outbox_events`, `auditLogs`, `kiosk_device_telemetry`
- **Exact Repository Files to Create/Modify:**
  - `server/src/infrastructure/database/retention.config.ts`
  - `server/src/infrastructure/database/retention.service.ts`
- **Dependencies:** `TASK-M1-001`
- **Required Approvals:** Core Backend Lead
- **Code Changes:**
  - Implement `RetentionPolicyService` exposing:
    - `getRetentionPolicies()`
    - `previewPurgeableRecords(collectionName, options)`
    - `validatePurgeEligibility(collectionName, filters)`
- **Tests to Add:** `server/src/tests/retention-policy.test.ts`
- **Verification Criteria:** Unit tests pass with 100% policy enforcement. Attempting to preview or purge a non-whitelisted collection throws a 403 Forbidden error.
- **Completion Status:** **READY FOR IMPLEMENTATION**

### Task ID: `TASK-M2-002`
- **Objective:** Patch notification publisher to automatically compute and populate `expiresAt` on insertion.
- **Priority:** High
- **Target Collections:** `notifications`
- **Exact Repository Files to Modify:**
  - `server/src/modules/notifications/models/notification.model.ts`
  - `server/src/modules/notifications/services/notification.service.ts`
- **Dependencies:** None
- **Code Changes:**
  - Add Mongoose `pre("save")` hook to `notification.model.ts` ensuring `expiresAt` is set to `now + retentionDays` if omitted.
- **Verification Criteria:** Creating a notification without `expiresAt` populates it automatically.
- **Completion Status:** **READY FOR IMPLEMENTATION**

---

## Milestone 3: Automatic Expiration Implementation (TTL Indexes & Backfills)

### Task ID: `TASK-M3-001`
- **Objective:** Apply TTL index to `outbox_events` for published events.
- **Priority:** High
- **Target Collections:** `outbox_events`
- **Exact Repository Files to Modify:**
  - `server/src/modules/onboarding/models/outbox-event.model.ts`
  - `server/src/scripts/migrations/apply_ttl_indexes.ts`
- **Dependencies:** `TASK-M2-001`
- **Index Definition:**
  ```javascript
  OutboxEventSchema.index(
    { publishedAt: 1 },
    { name: "outbox_events_published_ttl", expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { status: "published" } }
  );
  ```
- **Verification Criteria:** Index is active; documents with `status: "published"` and `publishedAt > 7d` are automatically evicted.
- **Completion Status:** **READY FOR IMPLEMENTATION**

### Task ID: `TASK-M3-002`
- **Objective:** Apply compound TTL index to `system_jobs` on `completedAt`.
- **Priority:** Critical
- **Target Collections:** `system_jobs`
- **Exact Repository Files to Modify:**
  - `server/src/infrastructure/queue/system-job.model.ts`
  - `server/src/scripts/migrations/apply_ttl_indexes.ts`
- **Dependencies:** `TASK-M2-001`
- **Index Definition:**
  ```javascript
  SystemJobSchema.index(
    { completedAt: 1 },
    { name: "system_jobs_completedAt_ttl", expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { status: "completed" } }
  );
  ```
- **Verification Criteria:** New completed jobs expire after 7 days; pending/processing jobs are unaffected.
- **Completion Status:** **READY FOR IMPLEMENTATION**

---

## Milestone 4: Backup, Archival & Resumable Purge Infrastructure

### Task ID: `TASK-M4-001`
- **Objective:** Build the resilient Backup & Purge Engine with encrypted export streaming, SHA-256 manifest verification, and bounded batch deletion.
- **Priority:** Critical
- **Target Collections:** `system_jobs`, `notifications`, `outbox_events`, `auditLogs`
- **Exact Repository Files to Create:**
  - `server/src/infrastructure/database/backup-purge.service.ts`
  - `server/src/scripts/run_verified_purge.ts`
- **Dependencies:** `TASK-M2-001`
- **Required Approvals:** Super Admin & Security Officer
- **Capabilities:**
  1. Stream documents matching policy filters to compressed `.json.gz`.
  2. Compute SHA-256 hash and upload to Cloudflare R2 / S3.
  3. Verify archive integrity and record `status: "VERIFIED"`.
  4. Execute bounded deletions in chunks of 1,000 with 50ms pauses.
  5. Emit audit trail record to `AuditLog`.
- **Tests to Add:** `server/src/tests/backup-purge.test.ts`
- **Verification Criteria:** Mock purge test verifies archive checksum, executes 1,000-doc batches, and validates zero data loss for unselected records.
- **Completion Status:** **READY FOR IMPLEMENTATION**

---

## Milestone 5: Super Admin Storage Dashboard & UI Integration

### Task ID: `TASK-M5-001`
- **Objective:** Implement Database Storage Management backend endpoints in Fastify Super Admin API.
- **Priority:** High
- **Target Collections:** All 68 collections
- **Exact Repository Files to Modify:**
  - `server/src/modules/super-admin/services/super-admin.service.ts`
  - `server/src/modules/super-admin/controllers/super-admin.controller.ts`
  - `server/src/modules/super-admin/routes/super-admin.routes.ts`
- **Endpoints to Add:**
  - `GET /super-admin/observability/database-storage` (Overview, sizes, collections, recommendations)
  - `GET /super-admin/observability/database-storage/preview/:collectionName` (Dry run)
  - `POST /super-admin/observability/database-storage/backup` (Trigger verified export)
  - `POST /super-admin/observability/database-storage/purge` (Trigger verified purge)
- **Verification Criteria:** Endpoints enforce `requireRole(["super_admin"])` and reject non-allowlisted collections.
- **Completion Status:** **READY FOR IMPLEMENTATION**

### Task ID: `TASK-M5-002`
- **Objective:** Implement Database Storage Management UI tab in frontend `SuperAdminObservability.tsx`.
- **Priority:** High
- **Exact Repository Files to Modify:**
  - `src/pages/super-admin/SuperAdminObservability.tsx`
  - `src/hooks/useSuperAdmin.ts`
- **UI Components:**
  - Database overview stats (68 collections, 316 MB data, 67 MB indexes, 702k reclaimable docs).
  - Top collections by footprint with visual progress bars.
  - Interactive collection table with retention status, TTL badges, and safe action modal.
  - Staged Backup-and-Purge wizard (Preview -> Backup -> Verify -> Confirm -> Bounded Purge).
- **Verification Criteria:** UI seamlessly matches existing Tailwind, Lucide, and Sonner design patterns.
- **Completion Status:** **READY FOR IMPLEMENTATION**

---

## Milestone 6: Verification, Testing & Production Rollout

### Task ID: `TASK-M6-001`
- **Objective:** Run end-to-end integration test suite, verify restoration idempotency, and document production runbook.
- **Priority:** Critical
- **Commands to Run:**
  ```bash
  npm test
  ```
- **Verification Criteria:** All tests pass with zero regressions.
- **Completion Status:** **READY FOR EXECUTION**
