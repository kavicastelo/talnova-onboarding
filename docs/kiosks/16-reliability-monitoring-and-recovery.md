# Kiosk Domain Chunk 16: Reliability, Monitoring & Recovery

## 1. Domain Scope

This domain defines the crash recovery watchdog, uncaught exception boundaries, synthetic health probes, power failure recovery, and fault tolerance architecture.

---

## 2. Runtime Error Boundary & Watchdog Recovery

Unattended physical terminals must never remain frozen on a white error screen:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   React Error Boundary (Top Level)                     │
│  - Traps uncaught component exceptions or rendering crashes            │
│  - Captures stack trace, terminal ID, and journey step index           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Watchdog Recovery Action                         │
│  1. Log error to local IndexedDB diagnostic table                      │
│  2. Display friendly error overlay:                                    │
│     "Briefing encountered an issue. Automatically restarting in 5s..." │
│  3. Execute automated soft reload:                                     │
│     - If mid-session: restore step checkpoint from IndexedDB           │
│     - If repeated crash (>2 in 1 minute): return to Home Launcher      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Power Failure Recovery

When power is abruptly lost and restored on a physical terminal:
1. Terminal operating system auto-boots into browser kiosk mode.
2. Terminal loads `/kiosk/terminal`.
3. Validates persisted device token in browser storage.
4. Checks IndexedDB for any interrupted in-progress session:
   - If found and timestamp < 15 minutes ago: Displays: *"Resume prior briefing?"* with 10-second countdown.
   - If expired or abandoned: Wipes temporary session data and displays the Multi-Journey Launcher.

---

## 4. Synthetic Health Probes

The backend runs an autonomous health sentinel:
- **Heartbeat Synthetic Probe**: Validates that all active terminals transmit heartbeats within expected intervals.
- **Alert Dispatch**: Emits real-time webhook and in-app notifications if a critical entrance or turnstile terminal goes silent during shift change windows.
