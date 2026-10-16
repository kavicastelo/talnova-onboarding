# Autonomous Database Agent Learning & Drift Log

## 1. Learning Baseline (2026-10-16 Initial Discovery)

- **Total Collections Discovered in Live Atlas DB:** **68**
- **Total Mongoose Models in Server Source:** **75**
- **Discrepancy Reconciliation:**
  1. `server/src/modules/demo/models/` contains 8 demo models (`demo-tenant`, `demo-user`, `demo-session`, etc.). In single-database environments, these create `demotenants` and `demousers`, while in multi-database mode they connect to `Talnova-Onboarding-Demo`.
  2. `paymentrecords` exists in the database as an empty legacy collection (0 docs) created prior to explicit `collection: "payment_records"` mapping.
  3. `platform_feature_flags` is a bootstrap-only collection (2 docs) read on startup by `syncDefaultFeatureFlags()` to seed `feature_flags`.
  4. Localization models (`i18nContent`, `i18nContentTranslations`, `feature_adoption_rollups`) are declared in TypeScript but have not received records in the production database yet.
- **Top Growth Bottlenecks Discovered:**
  - `system_jobs`: 622,103 documents (99.98% completed queue jobs retained indefinitely).
  - `notifications`: 83,394 documents (96.4% lacking `expiresAt`, rendering TTL index inert).
  - `outbox_events`: 1,402 documents (99.9% published events retained).

---

## 2. Automated Drift Detection Rules for Future Agent Invocations

When an autonomous agent runs in this repository, it must execute the following comparison against `docs/database-retention/collection-inventory.json`:

```
1. Schema & Collection Count Comparison:
   - Query db.listCollections()
   - IF dbCollections.length != inventory.length:
       FLAG DRIFT: New collections added or removed.

2. Unbounded Growth Detection:
   - For each collection:
       growthRate = (currentDocs - baselineDocs) / elapsedDays
       IF growthRate > 10,000 docs/day AND strategy != "A":
           FLAG ALERT: Potential unmanaged queue or log accumulation.

3. Inoperable TTL Index Detection:
   - For collections with TTL indexes on dateField:
       nullCount = countDocuments({ [dateField]: null })
       IF nullCount > 0.5 * totalDocs:
           FLAG DEFECT: TTL index bypassed by null date field (Repeat of Notification Defect).

4. Index Bloat Warning:
   - IF totalIndexSize > 1.5 * storageSize:
       FLAG OPTIMIZATION: Over-indexed collection candidate for index consolidation.
```

---

## 3. Historical Incident & Optimization Record

| Date | Incident / Optimization | Action Taken | Measured Storage Impact |
| :--- | :--- | :--- | :--- |
| **2026-10-16** | **Unbounded `system_jobs` accumulation** | Identified 621k completed jobs. Designed compound TTL + Super Admin batch purge. | Projected 230 MB data + 50 MB index reduction. |
| **2026-10-16** | **Dormant `notifications` TTL index** | Discovered 80.4k docs with `expiresAt: null`. Designed automated calculation hook and safe backfill. | Projected 72 MB data + 6.5 MB index reduction. |
| **2026-10-16** | **Obsolete `outbox_events` retention** | Identified 1,401 published events. Added 7-day TTL index design. | Projected 0.6 MB reduction. |
