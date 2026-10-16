# Super Admin Backup-and-Purge Architecture & Workflow Specification

## 1. Architecture Overview

Production data retention requires a strict separation of concerns:
1. **Automated Expiration (TTL)** handles verified ephemeral records where long-term recovery is explicitly not required.
2. **Super Admin Backup-and-Purge Workflow** handles high-volume operational backlogs, audit history, and financial archives where data **must remain recoverable** in external cold storage before removal from the active MongoDB Atlas cluster.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   BACKUP-AND-PURGE STATE MACHINE                       │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                     1. PREVIEW PURGE SCOPE
                     (Dry-run count & byte estimate)
                                 │
                                 ▼
                     2. STREAMING ENCRYPTED EXPORT
                     (AES-256-GCM / SHA-256 manifest to R2)
                                 │
                                 ▼
                     3. INTEGRITY & RESTORE VERIFICATION
                     (Decompress, verify record count & checksum)
                                 │
                                 ▼
                     4. SUPER ADMIN EXPLICIT APPROVAL
                     (2FA / Double-confirmation & Audit Log)
                                 │
                                 ▼
                     5. BOUNDED BATCH PURGE
                     (Iterative 1,000-doc chunks with pacing)
                                 │
                                 ▼
                     6. RECONCILIATION & POST-PURGE AUDIT
                     (Verify final count, index health & storage)
```

---

## 2. Cryptographic Manifest & Backup Artifact

All backup archives are stored in Cloudflare R2 / S3 under a dedicated prefix:
`s3://talnova-backups/database-archives/{collectionName}/{timestamp}_{manifestId}.json.gz`

### Manifest Schema Specification (`manifest.json`)
```json
{
  "manifestId": "man_98f12c3e-89a1-4321",
  "collectionName": "system_jobs",
  "databaseName": "Talnova-Onboarding",
  "environment": "production",
  "initiatedBy": "admin_64b281f9812",
  "initiatedByEmail": "superadmin@talnova.com",
  "exportStartedAt": "2026-10-16T08:15:00.000Z",
  "exportCompletedAt": "2026-10-16T08:15:42.000Z",
  "filterCriteria": {
    "status": { "$in": ["completed", "failed"] },
    "completedAt": { "$lt": "2026-10-09T00:00:00.000Z" }
  },
  "metrics": {
    "documentCount": 621000,
    "uncompressedBytes": 241029480,
    "compressedBytes": 41920194,
    "averageDocumentSizeBytes": 388
  },
  "cryptography": {
    "algorithm": "AES-256-GCM",
    "sha256Checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "encryptionKeyId": "kms-key-prod-archive-01"
  },
  "storage": {
    "bucket": "talnova-backups",
    "key": "database-archives/system_jobs/20261016_system_jobs_archive.json.gz",
    "storageClass": "STANDARD"
  },
  "verification": {
    "verifiedAt": "2026-10-16T08:15:48.000Z",
    "verifiedRecordCount": 621000,
    "checksumMatch": true,
    "status": "VERIFIED"
  }
}
```

---

## 3. Strict Safety Gates

> [!CAUTION]
> **Purge Operation Safety Rule**: The purge execution engine MUST assert that `manifest.verification.status === "VERIFIED"` and `manifest.verification.checksumMatch === true` before running any `deleteMany` command. Unverified or failed exports will automatically block the purge phase.

### Safety Invariants
1. **Server-Side Allowlist**: Dashboards and API endpoints only permit operations against an approved collection allowlist:
   - `system_jobs`
   - `notifications`
   - `outbox_events`
   - `onboarding_health`
   - `auditLogs`
   - `feature_usage_records`
   - `kiosk_device_telemetry`
2. **No Arbitrary Filters**: Super Admins cannot execute arbitrary MongoDB queries. Purge criteria are hardcoded business policies parameterized only by a safe retention cutoff date (e.g. `olderThanDays: 30`).
3. **Bounded Chunk Pacing**: Purges are executed in bounded batches of **1,000 documents** per chunk:
   ```typescript
   while (remainingToDelete > 0) {
     const ids = await db.collection(target).find(filter).limit(1000).project({ _id: 1 }).toArray();
     if (ids.length === 0) break;
     await db.collection(target).deleteMany({ _id: { $in: ids.map(d => d._id) } });
     remainingToDelete -= ids.length;
     // Yield thread to avoid blocking MongoDB replication oplog
     await new Promise(resolve => setTimeout(resolve, 50));
   }
   ```
4. **Tenant Boundary Preservation**: Where operations target tenant-specific records (e.g. notifications), `organizationId` is strictly enforced as a filter parameter.

---

## 4. End-to-End Restoration Protocol

In the event of an audit inquiry, customer investigation, or accidental operational requirement:

1. **Locate Manifest**: Lookup manifest by `manifestId` or collection name in the backup registry.
2. **Integrity Validation**: Download archive from R2 and verify SHA-256 checksum against manifest.
3. **Deterministic Unpack**: Stream decompress `.json.gz` using Node.js `zlib` stream pipeline.
4. **Idempotent Upsert**:
   ```typescript
   await db.collection(targetCollection).bulkWrite(
     documents.map(doc => ({
       updateOne: {
         filter: { _id: doc._id },
         update: { $setOnInsert: doc },
         upsert: true
       }
     }))
   );
   ```
5. **Reconciliation**: Compare restored count against `manifest.metrics.documentCount`.
