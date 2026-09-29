# Kiosk Domain Chunk 09: Security, Lockdown & Anti-Tampering

## 1. Domain Scope

This domain governs browser kiosk lockdown, fullscreen enforcement, context menu suppression, automatic privacy reset, idle timeouts, session memory wiping, and emergency mode overrides.

---

## 2. Kiosk Browser Lockdown Controls

When operating in kiosk mode:
1. **Fullscreen API Enforcement**: Upon initial user interaction, request `document.documentElement.requestFullscreen()`. If the user presses `Esc` or exits fullscreen, display a full-screen prompt: *"Tap screen to resume kiosk mode."*
2. **Context Menu & Shortcut Suppression**:
   - `window.addEventListener('contextmenu', e => e.preventDefault())` disables right-click inspect menus.
   - Suppress destructive key combinations: `F11`, `F12`, `Ctrl+Shift+I`, `Ctrl+R`, `Ctrl+W`, `Alt+F4`.
3. **Exit PIN Gate**: Exiting the player to an administrative dashboard requires entering the organization's or journey's 6-digit Exit PIN.

---

## 3. Privacy Reset & Memory Wiping Engine

Shared physical terminals must never leave employee PII exposed to subsequent workers:

```text
       No User Interaction for `idleTimeoutSeconds` (Default: 60s)
                                   │
                                   ▼
        Display 15-Second Warning Modal:
        "Session timing out. Still here?" [Countdown: 15s] [Continue Session]
                                   │
                                   ▼
                     Countdown Reaches 0 with No Input
                                   │
                                   ▼
                    1. Notify Backend: Session Aborted (Reason: IDLE_TIMEOUT)
                    2. Clear Session Token from React Memory / State
                    3. Wipe employee profile, badge ID, and temporary cache
                    4. Clear all form inputs, checkboxes, and quiz answers
                    5. Navigate back to Home Screen Launcher
```

---

## 4. Emergency Kiosk Mode & Evacuation Override

In the event of a facility hazard (fire alarm, gas leak, natural disaster):
1. Administrators trigger **Emergency Kiosk Mode** via portal or API webhook:
   `POST /api/v1/kiosk/emergency/broadcast`
2. All online terminals receive the emergency push via WebSocket / SSE (or next 60s heartbeat).
3. The active journey is immediately interrupted.
4. The terminal displays the full-screen **Emergency Protocol Screen**:
   - Flashing visual border
   - Facility emergency map and primary/secondary evacuation routes
   - Assembly point instructions
   - Emergency contact numbers
5. Normal kiosk operation is completely disabled until an administrator explicitly cancels the emergency state.
