# Verification, Validation & Rollback Runbook

## 1. Pre-Flight Verification Checklist

Before applying any index changes or executing purge operations in production:

- [ ] **Atlas Replica Set Health**: Confirm all primary and secondary nodes are `HEALTHY` and replication lag is `< 1 second`.
- [ ] **Oplog Window**: Verify Atlas oplog window is `>= 24 hours` before running batch purges.
- [ ] **WiredTiger Cache**: Confirm cache dirty percentage is `< 5%`.
- [ ] **Cold Storage Target Access**: Confirm write and read permissions on Cloudflare R2 / S3 backup bucket.
- [ ] **Dry-Run Validation**: Always execute the dry-run count and size estimation prior to launching a destructive batch purge.

---

## 2. Dry-Run Verification Queries

Run these read-only inspection commands to preview purge scope:

### Preview Purgeable `system_jobs`
```javascript
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const purgeableJobs = await db.collection("system_jobs").countDocuments({
  status: "completed",
  completedAt: { $lt: sevenDaysAgo }
});
console.log(`Purgeable completed jobs (>7d): ${purgeableJobs}`);
```

### Preview Purgeable `notifications`
```javascript
const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
const purgeableNotifs = await db.collection("notifications").countDocuments({
  $or: [
    { isRead: true, readAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    { isRead: false, createdAt: { $lt: ninetyDaysAgo } }
  ]
});
console.log(`Purgeable notifications (>90d): ${purgeableNotifs}`);
```

### Preview Purgeable `outbox_events`
```javascript
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const purgeableOutbox = await db.collection("outbox_events").countDocuments({
  status: "published",
  publishedAt: { $lt: sevenDaysAgo }
});
console.log(`Purgeable published outbox events (>7d): ${purgeableOutbox}`);
```

---

## 3. Rollback Procedures

### Procedure A: Rollback TTL Index Creation
If a TTL index causes unexpected deletion or database load, drop it immediately:

```javascript
// Drop TTL on system_jobs
await db.collection("system_jobs").dropIndex("system_jobs_completedAt_ttl");

// Drop TTL on outbox_events
await db.collection("outbox_events").dropIndex("outbox_events_published_ttl");
```
*Note: Dropping a TTL index in MongoDB is instantaneous and non-blocking.*

### Procedure B: Restore Records from Verified Archive
If documents were purged and need to be restored:

1. Identify the manifest ID from `AuditLog` (e.g., `man_98f12c3e`).
2. Run the restoration tool:
   ```bash
   npm run retention:restore -- --manifestId=man_98f12c3e
   ```
3. The restore service downloads the encrypted archive, validates the SHA-256 hash, and performs idempotent `bulkWrite` upserts.
4. Verify document recovery count in MongoDB.

---

## 4. Operational Monitoring Dashboard & Alerts

Monitor the following metrics in MongoDB Atlas during and after retention operations:
1. **Oplog Headroom**: Ensure replication lag remains under 2 seconds during batch purges.
2. **Disk IOPS**: Verify read/write IOPS do not throttle below baseline burst capacity.
3. **WiredTiger Cache Eviction**: Ensure clean cache percentage stays above 80%.
4. **Application API Latency**: Verify p95 and p99 Fastify endpoint response times remain unaffected.
