# Kiosk Subsystem Open Architectural & Product Questions

This document captures high-impact open questions requiring authoritative Product Management, Security Governance, and Enterprise Customer Architecture alignment before proceeding with specific downstream implementation phases.

---

## OQ-001: Frontline Employee Offline Identification Policy

### Context
When a kiosk is completely offline (e.g., remote warehouse or construction site without internet), how should employee identification be verified?
- **Option A (Local Cached Hashes)**: The device securely caches hashed badge IDs / employee IDs of personnel assigned to that facility/site, allowing offline identity lookup and name confirmation.
- **Option B (Blind Acceptance with Server-Side Re-validation)**: The device accepts any scanned badge ID or employee number without local verification, queues the completed session offline, and flags any unresolvable employee IDs as compliance exceptions during the reconnection sync.
- **Option C (Anonymous Only Offline)**: While offline, the device only permits anonymous/public safety briefings; employee-certified journeys are disabled until connectivity returns.

### Impacted Domains
- `06-employee` (Employee Identity)
- `11-offline` (Offline Storage & Sync)
- `12-compliance` (Completion Integrity)

### Recommendation
Adopt **Option A** with fallback to **Option B** if an employee was hired within the last 24 hours and not yet synced to the terminal cache.

---

## OQ-002: Maximum Permissible Offline Window & Clock Skew Policy

### Context
Kiosks that remain offline for extended periods pose compliance risks: employee status changes (e.g., terminations) cannot be synced, revocations cannot be received, and device system clocks can drift, corrupting completion timestamps.
- What is the maximum acceptable offline duration before a terminal locks into `maintenance` or `offline_lockout`? (e.g., 24 hours, 72 hours, or 7 days?)
- Should the kiosk player reject completions if the local hardware clock deviates by more than X minutes from the last known server timestamp?

### Impacted Domains
- `02-device` (Device Trust & Heartbeat)
- `11-offline` (Offline Resilience)
- `12-compliance` (Audit Trail)

### Recommendation
Enforce a 72-hour maximum offline operational window for employee-certified journeys (public journeys remain available indefinitely). Enforce a maximum clock skew threshold of ±15 minutes against monotonic time counters.

---

## OQ-003: Physical Badge & Scanner Hardware Integration Scope

### Context
Frontline workers often hold physical RFID/NFC badges or barcodes. Web browsers have limited native hardware access:
- **Option A (Keyboard Wedge Emulation)**: 2D barcode and RFID USB scanners emulate human keyboard typing terminated by an `Enter` key. This requires zero native drivers or browser plugins and works in standard web browsers.
- **Option B (WebHID / WebUSB API)**: Modern Chromium browsers support direct USB device communication via `navigator.hid` or `navigator.usb`.
- **Option C (Dedicated Electron / Native Shell)**: Wrap the kiosk player in Electron or Android/iOS native containers that communicate with proprietary hardware SDKs.

### Impacted Domains
- `05-runtime` (Runtime Launcher & Player)
- `06-employee` (Employee Identification)

### Recommendation
Standardize on **Option A** (Keyboard Wedge Emulation) for universal browser compatibility as the baseline, with **Option B** (WebHID) as an opt-in progressive enhancement for high-end terminals.

---

## OQ-004: Supervisor Authentication Modality on Shared Hardware

### Context
Supervisor witness verification currently utilizes a 4-digit PIN stored as a SHA-256 hash on the User model.
- Is a 4-digit PIN sufficient for high-consequence compliance (e.g., OSHA, chemical handling, high-voltage equipment certification)?
- Should supervisor witnessing require secondary factors (e.g., scanning the supervisor's physical badge, typing their full corporate password, or receiving a mobile push notification via Duo/Okta)?
- If mobile push is used, how does it operate when the kiosk is in an area with poor cellular connectivity?

### Impacted Domains
- `07-supervisor` (Supervisor Verification)
- `08-security` (Security & Lockdown)

### Recommendation
Allow organization-configurable policy profiles:
- *Standard Profile*: Supervisor Badge Scan OR 4-digit PIN + Supervisor ID with exponential rate-limiting lockout (3 failed attempts = 5 min lock).
- *Strict Profile*: Dual-credential (Supervisor ID + Badge Scan + PIN).

---

## OQ-005: Enterprise MDM (Mobile Device Management) Scope & Boundary

### Context
Large enterprises deploy kiosks across hundreds of iPad, Android, or Windows devices managed via Microsoft Intune, VMware Workspace ONE, or Jamf.
- Does the Talnova Kiosk subsystem attempt to act as an MDM (e.g., pushing OS-level updates, managing Wi-Fi profiles, rebooting operating systems)?
- Or does Talnova strictly define its boundary at the Web Application / Kiosk Player runtime layer, providing configuration hooks (e.g., Managed App Config, AppConfig XML, Deep Links) for enterprise MDM systems?

### Impacted Domains
- `02-device` (Fleet Management & Remote Operations)
- `14-enterprise` (Enterprise Governance & Integrations)

### Recommendation
Talnova should strictly maintain its boundary as an **Application-Layer Kiosk Runtime**. Deep hardware provisioning, Wi-Fi configuration, and OS updates remain the responsibility of customer MDM solutions. Talnova provides AppConfig payloads, health telemetry webhooks, and remote application commands (e.g., reload journey, clear cache, lock screen).

---

## OQ-006: Compliance Certificate Storage & Retention Mandates

### Context
Safety training completions may be subject to legal retention periods ranging from 3 years (standard corporate) to 30 years (OSHA hazardous substance exposure records 29 CFR 1910.1020).
- Where should completion evidence packets (immutable JSON + signed cryptographic hash + optional PDF certificate) be archived?
- Should compliance records be retained in MongoDB indefinitely, or offloaded to immutable cold storage (e.g., AWS S3 Glacier with Object Lock / Compliance Mode)?
- How should data subject deletion requests (GDPR Right to be Forgotten) be handled against legal compliance holds?

### Impacted Domains
- `12-compliance` (Completion Integrity & Certificates)
- `14-enterprise` (Data Retention & Legal Holds)

### Recommendation
Implement a two-tier storage policy:
1. Operational completions stored in MongoDB with indexed queries for 3 years.
2. Long-term compliance evidence packets archived to S3/GCS with SHA-256 checksums and Legal Hold flags. Legal holds override GDPR deletion requests as permitted under GDPR Article 17(3)(b).
