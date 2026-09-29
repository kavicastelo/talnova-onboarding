# Kiosk Domain Chunk 12: Offline Storage & Synchronization

## 1. Domain Scope

This domain governs full offline content caching, Service Worker offline routing, IndexedDB persistence, encrypted offline completion storage, and idempotent synchronization to fix **DEF-010**.

---

## 2. Two-Tier Offline Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Tier 1: Static Asset Caching                    │
│  - Service Worker (Cache API)                                          │
│  - Caches HTML, JS/CSS bundles, fonts, UI icons, and media player      │
│  - Strategy: Stale-While-Revalidate with Network First fallback        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
┌────────────────────────────────────────────────────────────────────────┐
│                        Tier 2: Journey Content Cache                   │
│  - IndexedDB (`kiosk_offline_store`)                                   │
│  - Tables:                                                             │
│    * `assigned_manifest`: Journey metadata & assigned rules            │
│    * `journey_versions`: Immutable JSON steps for each assigned ID     │
│    * `cached_media`: Blobs of essential images and audio clips         │
│    * `pending_sessions`: Encrypted completed sessions awaiting sync     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Offline Execution & Integrity Guarantee

1. **Automatic Network State Detection**: The player monitors `navigator.onLine` and active API ping latencies. When offline, an unobtrusive banner appears: *"Operating in Offline Resilient Mode ●"*.
2. **Offline Journey Playback**: The player renders step slides and plays audio directly from IndexedDB without network requests.
3. **Encrypted Offline Record**: When an employee completes a journey while offline:
   - A `KioskSession` payload is constructed including step completion timestamps, interaction hashes, and supervisor witness details.
   - The payload is encrypted with AES-256-GCM using an ephemeral key derived from the device token.
   - Saved to IndexedDB `pending_sessions`.

---

## 4. Idempotent Synchronization Protocol

Upon network reconnection:
1. The terminal initiates synchronization via `POST /api/v1/kiosk/analytics/sync`.
2. Each queued session payload includes a unique, client-generated UUID (`clientSessionId`).
3. The backend checks `clientSessionId` against existing records:
   - If already recorded: Returns `200 OK` (deduplication / idempotency satisfied).
   - If new: Inserts `KioskSession`, creates completion audit record, and updates employee records.
4. Terminal purges synchronized records from IndexedDB upon receiving HTTP 200/201 confirmation.
