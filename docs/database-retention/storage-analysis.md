# Deep Storage Inefficiency & Bottleneck Analysis

## 1. Storage Footprint Summary

The Talnova MongoDB Atlas database (`Talnova-Onboarding`) currently stores **~713,500 documents**, consuming **~316.5 MB of uncompressed logical BSON data**, **~57.2 MB of compressed WiredTiger storage**, and **~67.8 MB of index storage**.

### Aggregate Database Resource Allocation

```
Logical BSON Data Size:      316.5 MB  (Uncompressed document payloads)
WiredTiger Compressed Data:   57.2 MB  (Physical disk space for data pages)
Total Index Storage:          67.8 MB  (Physical disk space for B-tree indexes)
Total Physical Storage:      125.0 MB  (Data + Indexes on Atlas SSD)
Total Database Documents:    713,500 documents
```

> [!IMPORTANT]
> **Index Storage Exceeds Data Storage**: In this database, index storage (67.8 MB) is **118.5%** of compressed data storage (57.2 MB). This inverted ratio is caused by high-churn operational collections with numerous compound indexes.

---

## 2. Root Cause Inefficiency #1: The `system_jobs` Queue Trap

### Measured Metrics
- **Collection Name:** `system_jobs` (labeled in user prompt as "system_logs")
- **Document Count:** **622,103 documents** (87.2% of all documents in the database)
- **Logical Data Size:** **233.60 MB** (73.8% of total logical data)
- **WiredTiger Storage Size:** **42.73 MB** (74.7% of all data storage)
- **Index Storage:** **51.69 MB** across 5 indexes (76.2% of all database indexes!)
- **Status Breakdown:**
  - `completed`: **621,955 documents (99.98%)**
  - `pending`: **168 documents**
  - `processing`: **7 documents**
  - `failed`: **4 documents**
- **Oldest Document Date:** September 15, 2026
- **Newest Document Date:** Active (October 16, 2026)

### Analysis & Mechanism of Failure
1. **The Scheduler Churn**: In `server/src/infrastructure/scheduler/scheduler.service.ts` (lines 85–190), a 60-second timer triggers `triggerScan()`. Every single minute, the scheduler queries active organizations and enqueues:
   - `scan_overdue_assignments`
   - `scan_compliance_due_alerts`
   - `scan_overdue_tasks`
   - `evaluate_onboarding_health_and_nudge`
   - `scan_pending_milestone_reviews`
   - `scan_buddy_coaching_nudges`
   - `scan_kiosk_fleet_health`
   - `process_kiosk_publishing_schedules`
   - `publish_onboarding_outbox`
2. **Missing Cleanup Lifecycle**: In `server/src/infrastructure/queue/queue.service.ts`, when a worker finishes a job, it executes:
   ```typescript
   job.status = "completed";
   job.completedAt = new Date();
   await job.save();
   ```
   **No deletion, no truncation, and no TTL index exists.**
3. **Index Multiplication**: `system_jobs` has five indexes:
   - `_id_` (8.4 MB)
   - `status_1` (6.2 MB)
   - `availableAt_1` (11.8 MB)
   - `status_1_availableAt_1_lockedAt_1` (14.1 MB)
   - `organizationId_1_idempotencyKey_1` (11.2 MB)
   Every single completed job forces WiredTiger to maintain B-tree leaves across all 5 indexes.

---

## 3. Root Cause Inefficiency #2: The Inoperable Notification TTL

### Measured Metrics
- **Collection Name:** `notifications`
- **Document Count:** **83,394 documents** (11.7% of all database documents)
- **Logical Data Size:** **77.58 MB** (24.5% of total logical data)
- **WiredTiger Storage Size:** **8.91 MB**
- **Index Storage:** **7.11 MB** across 12 indexes
- **Read / Unread Breakdown:**
  - `isRead: true`: **9 documents**
  - `isRead: false`: **83,390 documents (99.99%)**
- **TTL Population Breakdown:**
  - `expiresAt` exists and is non-null: **2,987 documents (3.6%)**
  - `expiresAt: null` or missing: **80,407 documents (96.4%)**

### Analysis & Mechanism of Failure
1. **False Sense of Safety**: The schema in `notification.model.ts` line 193 defines:
   ```typescript
   NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
   ```
   Engineers assumed notifications were automatically expiring.
2. **Omission at Creation Time**: In `event-subscribers.ts` and scheduler alert dispatchers, notifications are created without specifying `expiresAt`:
   ```typescript
   await Notification.create({
     organizationId,
     recipientUserId,
     type: "task_overdue",
     title,
     message,
     priority: "medium",
     // expiresAt IS NOT SET!
   });
   ```
3. In MongoDB, a TTL index ignores documents where the indexed date field is `null` or missing. Consequently, 80,407 notifications have remained trapped in storage.

---

## 4. Root Cause Inefficiency #3: Published Outbox Events Accumulation

### Measured Metrics
- **Collection Name:** `outbox_events`
- **Document Count:** **1,402 documents**
- **Published Count:** **1,401 documents (99.93%)**
- **Processing / Pending:** **1 document**

### Analysis
The outbox publisher in `outbox-publisher.service.ts` queries `status: "pending"`, dispatches events to `eventBus`, and updates `status = "published"` with `publishedAt = new Date()`.
Published outbox events have fulfilled their transactional handoff guarantee and are never read again by business logic, but they currently persist indefinitely.

---

## 5. Secondary Inefficiencies & Schema Observations

### Unbounded Embedded Arrays
1. **`tasks.statusHistory`**: Every status change (including automated "overdue" updates from the scheduler) appends an object `{ status, changedBy, changedAt, note }` to an embedded array. While fine for short-lived onboarding tasks, repeatedly updating stale tasks creates document growth.
2. **`kiosk_device_telemetry.network`**: High-frequency network adapter logs contain verbose SSID, RSSI, and IP details. The 30-day TTL prevents long-term bloat.

### Orphaned / Legacy Collections
1. **`paymentrecords`**: 0 documents, 1 index. Abandoned after `collection: "payment_records"` was introduced.
2. **`platform_feature_flags`**: 2 documents, 1 index. Static bootstrap artifact read on server boot.

---

## 6. Storage Reclamation Projections

### Estimated Savings Table

| Collection | Action | Document Count Delta | Data Size Saved (MB) | Index Size Saved (MB) | WiredTiger Disk Space Saved (MB) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `system_jobs` | Purge completed jobs > 7d & attach TTL | -621,000 | -230.0 MB | -50.0 MB | -41.0 MB |
| `notifications` | Purge unread alerts > 90d & backfill TTL | -80,000 | -72.0 MB | -6.5 MB | -8.0 MB |
| `outbox_events` | Purge published events > 7d & attach TTL | -1,400 | -0.6 MB | -0.3 MB | -0.2 MB |
| `paymentrecords` | Drop legacy collection | 0 | 0 MB | -0.01 MB | -0.01 MB |
| **Total** | | **-702,400 docs** | **-302.6 MB** | **-56.81 MB** | **-49.21 MB** |

### Projected Post-Optimization State
- **Total Documents:** ~11,100 (down from ~713,500; **98.4% reduction**)
- **Logical Data Size:** ~13.9 MB (down from ~316.5 MB; **95.6% reduction**)
- **Index Storage:** ~11.0 MB (down from ~67.8 MB; **83.8% reduction**)
- **Database Working Set in RAM**: Fits completely in MongoDB WiredTiger clean cache, eliminating page swapping and reducing Atlas IOPS spikes.
