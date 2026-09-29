# Kiosk Domain Chunk 05: Device-to-Journey Assignment

## 1. Domain Scope

This domain governs the multi-journey assignment engine (M:N), device grouping, site hierarchy rules, scheduling windows, and the dynamic fallback resolution algorithm to fix **DEF-003**.

---

## 2. Assignment Entity Data Model (`KioskDeviceAssignmentModel`)

```typescript
export interface IKioskDeviceAssignment extends Document {
  organizationId: mongoose.Types.ObjectId;
  targetType: "device" | "device_group" | "site";
  targetId: mongoose.Types.ObjectId;      // ID of KioskDevice, KioskDeviceGroup, or Site
  journeyId: mongoose.Types.ObjectId;     // Assigned KioskJourney
  priority: number;                       // Display order in launcher (0 = highest)
  isMandatory: boolean;                   // Flagged as required training
  scheduling: {
    enabled: boolean;
    startDate?: Date;
    endDate?: Date;
    daysOfWeek?: number[];                // 0 = Sunday, 1 = Monday...
    startTimeUtc?: string;                // e.g. "06:00" (shift start)
    endTimeUtc?: string;                  // e.g. "18:00" (shift end)
  };
  isActive: boolean;
  assignedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3. Dynamic Assignment Resolution Algorithm (ADR-005)

When a physical terminal boots up or synchronizes via `GET /api/v1/kiosk/devices/:deviceId/manifest`:

```text
                               Terminal Requests Manifest
                                           │
                                           ▼
                       Query explicit assignments for:
                       1. deviceId = terminal._id
                       2. deviceGroupId = terminal.deviceGroupId
                       3. siteId = terminal.siteId
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     │                                           │
             Assignments Found?                          No Assignments Found?
                     │                                           │
                     ▼                                           ▼
        Filter assignments by:                      Query ALL published journeys
        - isActive === true                         belonging to organizationId
        - Current time within schedule              (optionally matching terminal site)
        - Target journey is published                            │
                     │                                           │
                     └─────────────────────┬─────────────────────┘
                                           │
                                           ▼
                             Apply Eligibility Filtering:
                             - Hardware capability check
                             - Language match
                             - Non-expired status
                                           │
                                           ▼
                              Return Canonical Manifest:
                              - Array of eligible journeys
                              - Display metadata & priority
                              - Launch mode: LAUNCHER (multiple)
                                          or AUTOPLAY (single)
```

---

## 4. Single vs. Multi-Journey Execution Semantics

- **If Manifest Contains > 1 Journey**: Terminal renders the **Multi-Journey Home Screen Launcher**, allowing users to search, filter by category, and select their desired journey.
- **If Manifest Contains Exactly 1 Journey & AutoPlay is True**: Terminal skips the home screen and immediately launches the player for that journey. If the session times out, it restarts the assigned journey.
