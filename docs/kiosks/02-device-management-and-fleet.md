# Kiosk Domain Chunk 02: Device Management & Fleet Operations

## 1. Domain Scope

This domain covers fleet-wide administration, device health monitoring, telemetry heartbeats, remote device commands, status lifecycles, and maintenance operations.

---

## 2. Device Status Lifecycle State Machine

A kiosk terminal transitions through distinct operational states:

```text
  ┌──────────────┐
  │    STAGED    │ ─── Administrator registered terminal record prior to pairing
  └──────┬───────┘
         │ Paired with 6-digit code
         ▼
  ┌──────────────┐      Missed heartbeats (>30 min)      ┌──────────────┐
  │    ONLINE    │ ────────────────────────────────────> │   OFFLINE    │
  └──────┬───────┘ <──────────────────────────────────── └──────────────┘
         │               Heartbeat received
         │
         ├─── Admin initiates maintenance ───> ┌──────────────┐
         │                                     │ MAINTENANCE  │
         │ <── Admin resumes normal operation ─ └──────────────┘
         │
         ├─── Tamper / Security alert ───────> ┌──────────────┐
         │                                     │  SUSPENDED   │
         │                                     └──────────────┘
         │
         └─── Permanent decommission ────────> ┌────────────────┐
                                               │ DECOMMISSIONED │
                                               └────────────────┘
```

---

## 3. Heartbeat & Health Telemetry Protocol

Terminals transmit heartbeats every 60 seconds (with randomized jitter ±5s) via:
`POST /api/v1/kiosk/devices/heartbeat`

### Telemetry Payload Structure

```typescript
export interface IKioskHeartbeatPayload {
  contentVersion: number;         // Current local content manifest version
  telemetry: {
    batteryLevel?: number;        // 0.0 to 1.0 (null if AC mains powered)
    isCharging?: boolean;
    storageUsedBytes: number;     // IndexedDB + cache footprint
    storageFreeBytes: number;     // Available disk space
    appVersion: string;           // Kiosk frontend release tag
    networkLatencyMs: number;     // Ping response time to API server
    screenOrientation: "landscape" | "portrait";
    displayResolution: string;    // e.g. "1920x1080"
    currentJourneyId?: string;    // Active running journey if session is in progress
    activeSessionId?: string;
  };
}
```

### Sentinel Offline Scanner

A scheduled background job scans for terminals whose `lastHeartbeatAt` exceeds 30 minutes:
1. Marks `device.status = "offline"`.
2. Emits an in-app and webhook alert to facility administrators: *"Kiosk Terminal [Name] in [Location] has been offline for 30 minutes. Shift briefings may be impacted."*

---

## 4. Remote Operations & Device Commands

Authorized administrators can dispatch commands to online terminals via heartbeat response or server-sent events (SSE):

| Remote Command | Payload | Effect on Terminal |
| :--- | :--- | :--- |
| `RELOAD_MANIFEST` | `{ force: boolean }` | Flushes local journey manifest and re-fetches assigned journeys immediately. |
| `ENTER_MAINTENANCE` | `{ message?: string }` | Displays full-screen maintenance overlay; blocks user interaction. |
| `EXIT_MAINTENANCE` | None | Restores multi-journey launcher; resumes normal operation. |
| `CLEAR_CACHE` | None | Purges IndexedDB media cache and re-downloads fresh assets. |
| `FORCE_RESET` | None | Aborts any active session, wipes memory, and returns to home screen. |
| `REMOTE_WIPE` | `{ confirm: string }` | Invalidates device token, erases all local storage, returns to pairing screen. |

---

## 5. Fleet Dashboard & Geographic Grouping

The administrator portal provides:
- **Status Summary Cards**: Total fleet count, Online, Offline, In Maintenance, Battery Low (<20%).
- **Site & Department Filtering**: Group terminals by physical campus, warehouse, or floor.
- **Terminal Detail View**: Real-time telemetry graphs (battery, network latency, storage), assigned journeys, command log, and pairing credential history.
