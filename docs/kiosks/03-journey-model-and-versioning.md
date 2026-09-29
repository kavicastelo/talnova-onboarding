# Kiosk Domain Chunk 03: Journey Model & Immutable Versioning

## 1. Domain Scope

This domain governs journey definitions, lifecycle progression, publishing controls, and immutable version snapshotting to resolve **DEF-006** and satisfy legal compliance auditing.

---

## 2. Journey Lifecycle State Machine

```text
  ┌──────────────┐       Author edits content
  │    DRAFT     │ <─────────────────────────────────┐
  └──────┬───────┘                                   │
         │ Submit for approval                       │
         ▼                                           │
  ┌──────────────┐       Rejected                    │
  │  IN REVIEW   │ ──────────────────────────────────┤
  └──────┬───────┘                                   │
         │ Approved by safety/compliance manager     │
         ▼                                           │
  ┌──────────────┐       Unpublish / Revert          │
  │  PUBLISHED   │ ──────────────────────────────────┘
  └──────┬───────┘
         │ Scheduled expiration OR Replaced by new version
         ▼
  ┌──────────────┐
  │   ARCHIVED   │ (Retained indefinitely for historical completion verification)
  └──────────────┘
```

---

## 3. Data Schema: Draft vs. Immutable Version Snapshots

### 3.1 Draft Workspace (`KioskJourneyModel`)

Serves as the working document in `KioskBuilder`. Administrators can continuously edit, save drafts, reorder steps, and preview changes without affecting live production kiosks.

### 3.2 Immutable Version Snapshot (`KioskJourneyVersionModel`)

When an administrator triggers `POST /api/v1/kiosk/journeys/:id/publish`:
1. The server runs strict schema and business rule validation (linting steps, verifying media existence, checking passing thresholds).
2. The current version number increments: `newVersion = currentVersion + 1`.
3. A frozen, deep-cloned snapshot is inserted into `KioskJourneyVersionModel`:

```typescript
export interface IKioskJourneyVersion extends Document {
  journeyId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  version: number;                // Monotonically increasing version (1, 2, 3...)
  title: string;
  description?: string;
  languages: string[];
  steps: IKioskStep[];            // Complete frozen array of steps & interaction rules
  settings: IKioskJourneySettings;// Frozen timeout, security, and accessibility settings
  contentChecksum: string;        // SHA-256 hash of canonicalized JSON steps
  publishedBy: mongoose.Types.ObjectId;
  publishedAt: Date;
  status: "published" | "superseded" | "revoked";
  changelog?: string;
}
```

---

## 4. Session Version Pinning

- When a frontline worker or public visitor initiates a journey session, the backend binds the session strictly to `journeyVersionId`.
- **Zero Mid-Session Disruption**: If an administrator publishes version 3 while an employee is on Step 4 of version 2, the employee's active session remains locked to version 2 until completion.
- Subsequent new sessions automatically instantiate against version 3.
- Historical completions reference `journeyVersionId`, allowing enterprise auditors to inspect the EXACT slides, warning text, and media seen by a worker on the day of certification.
