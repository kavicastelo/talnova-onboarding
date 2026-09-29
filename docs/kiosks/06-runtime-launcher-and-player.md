# Kiosk Domain Chunk 06: Runtime Launcher & Responsive Player

## 1. Domain Scope

This domain governs permanent device URL routing, the Multi-Journey Kiosk Home Screen launcher, the responsive player shell, aspect ratio adaptation, and the touch design system to fix **DEF-001** and **DEF-008**.

---

## 2. Permanent Device URL Routing

Physical terminals navigate to a permanent, journey-independent URL:
- `/kiosk/terminal` (resolves device identity from browser `localStorage.kiosk_device_token`)
- `/kiosk/device/:deviceId` (for fixed MDM or managed hardware deployments)

If the device is un-paired, it automatically redirects to `/kiosk/pair`.
If the device is paired and online, it loads the terminal workspace.

---

## 3. Multi-Journey Kiosk Home Screen Launcher

When multiple journeys are available, the terminal displays an interactive catalog:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Talnova Facility Kiosk             [English ▼]  [♿ Accessibility]   │
│  Plant 4 — North Turnstile          Status: Online ●                   │
├────────────────────────────────────────────────────────────────────────┤
│  🔍 Search briefings...             [All] [Safety] [Compliance] [Ops]  │
├────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────┐              │
│  │ 🦺 General Plant Safety  │  │ ⚡ High-Voltage Protocol │              │
│  │ Est: 8 mins | Mandatory │  │ Est: 15 mins | Witness  │              │
│  │ [Start Briefing ➜]      │  │ [Start Briefing ➜]      │              │
│  └─────────────────────────┘  └─────────────────────────┘              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐              │
│  │ 📦 Forklift Zone Brief  │  │ 🚒 Emergency Map & Drill│              │
│  │ Est: 5 mins | Public    │  │ Est: 3 mins | Public    │              │
│  │ [Start Briefing ➜]      │  │ [Start Briefing ➜]      │              │
│  └─────────────────────────┘  └─────────────────────────┘              │
├────────────────────────────────────────────────────────────────────────┤
│  [🔒 Identify as Employee]              [Emergency Protocol Override]  │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Launcher Capabilities
- **Touch-Friendly Cards**: High-contrast, large touch cards (minimum 280x200px) with clear visual hierarchy.
- **Badge Indicators**: Visual tags for `Mandatory`, `Supervisor Witness Required`, `Public`, and estimated duration.
- **Language Switcher**: Prominently pinned in top header; switches text instantly across all journey cards.
- **Emergency Button**: High-visibility red button at footer to display emergency evacuation maps instantly without identification.

---

## 4. Responsive Player Shell & Touch Design System

- **Resolution Independence**: Fluidly scales from 10-inch tablets (1280x800) to 55-inch commercial totems (3840x2160).
- **Portrait & Landscape Modes**: Step layouts adapt via CSS Grid/Flexbox to both horizontal (16:9) and vertical (9:16) orientations.
- **Touch Target Rules**:
  - All interactive buttons have minimum dimension of **64x64px** for critical navigation (Back, Next, Confirm).
  - Standard buttons meet minimum **48x48px** with at least 8px margin separation.
  - Active touch ripple / visual depression states provide immediate feedback on physical touchscreens.
- **Fixed Action Footer**: Navigation controls ("Back", "Next", "Hold to Confirm", "Finish") are persistently pinned to the bottom 96px of the viewport, ensuring thumb reachability regardless of screen size.
