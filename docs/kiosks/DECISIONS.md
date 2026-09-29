# Kiosk Architectural Decision Records (ADRs)

This document formalizes the architectural decisions governing the Talnova Enterprise Kiosk subsystem. Every decision establishes a binding design principle that future coding agents and engineering teams must follow.

---

## ADR-001: Independent Entity Separation (Device ≠ Journey ≠ Session ≠ Employee)

### Context
The existing implementation coupled the kiosk player directly to a specific journey via URL (`/kiosk/play/:id`) and stored a single `currentJourneyId` inside the `KioskDevice` schema. Furthermore, completions were recorded anonymously without binding an employee identity to a discrete session entity.

### Decision
The enterprise kiosk architecture must strictly separate four independent first-class entities:
1. **Kiosk Device**: The physical computer, tablet, or terminal hardware asset registered with the organization.
2. **Kiosk Journey**: The versioned instructional or compliance curriculum authored by administrators.
3. **Kiosk Session**: An ephemeral execution record tracking a single journey attempt on a specific device, with explicit lifecycle states.
4. **Employee Identity**: The authenticated or identified workforce member executing the journey.

A device can run many journeys; a journey can be deployed to many devices; a session belongs to one journey and one device (and optionally one employee); an employee can execute many journeys across multiple sessions and devices.

### Status
ACCEPTED

### Consequences
- Requires decoupling the player URL from journey IDs.
- Requires removing `currentJourneyId` from `KioskDeviceModel` in favor of a dedicated `KioskDeviceAssignment` collection.
- Requires introducing a dedicated `KioskSession` model.

---

## ADR-002: Cryptographic Device Trust vs. Employee Identification

### Context
Physical kiosk terminals are unattended or shared hardware placed in factory floors, lobbies, or training centers. They cannot require an administrator web login to boot, nor can they treat the physical device's trust state as identical to an employee's session.

### Decision
We establish a two-tier authentication architecture:
1. **Tier 1 (Device Trust)**: The hardware establishes a long-lived, cryptographic device identity via a one-time activation handshake. The device holds a signed device JWT/tokenRef representing trusted hardware status. This token permits fetching assigned journeys, sending telemetry heartbeats, and logging sync events. It DOES NOT permit administrative operations or auto-complete employee records.
2. **Tier 2 (Employee Identity)**: Frontline workers identify themselves at runtime via badge ID, employee ID, QR code, or national ID to initiate an ephemeral (1-hour max) session. This issues a short-lived employee session token scoped strictly to `kiosk_preboarding_execution`.

### Status
ACCEPTED

### Consequences
- Device authentication and employee authentication have completely distinct lifecycles, scopes, and token formats.
- If a device is stolen, its credential can be instantly revoked without invalidating employee credentials.
- An employee session timeout clears employee identity from memory immediately while leaving the device in its trusted, paired state.

---

## ADR-003: Cryptographic Hardware Identity (Elimination of MAC Address Reliance)

### Context
`KioskDeviceSchema` currently defines `macAddress: { type: String }`. Modern web browsers running in standard or sandbox kiosk modes cannot access layer-2 MAC addresses due to security sandboxing. Furthermore, MAC addresses can be easily spoofed on local networks.

### Decision
The security anchor of a kiosk device must NEVER be a MAC address. Device identity is established through:
1. A unique, immutable device fingerprint / hardware GUID generated and stored in secure browser storage (or TPM/MDM-provisioned certificate where available).
2. A single-use 6-digit activation code exchange administered via authenticated portal.
3. A server-signed HMAC/JWT device token whose SHA-256 hash (`tokenRef`) is stored in MongoDB.
4. Device requests are authenticated using Bearer tokens verified against active, non-decommissioned device records.

`macAddress` is deprecated and relegated to an optional diagnostic metadata field only if provided by an external MDM agent.

### Status
ACCEPTED

### Consequences
- Prevents spoofed MAC attacks.
- Enables consistent operation across standard web browsers, Electron, Android WebView, and iPadOS WebKit.

---

## ADR-004: Permanent Device URL Model

### Context
The current application mounts the kiosk player at `/kiosk/play/:id` with query parameters `?o=...&exp=...&sig=...`. This couples physical device bookmarks to one journey ID. If that journey is unpublished or replaced, the physical kiosk breaks.

### Decision
Kiosks must boot to a permanent, journey-independent URL:
- `/kiosk/terminal` (resolving paired hardware from local credential storage), or
- `/kiosk/device/:deviceId` (for managed/MDM fixed-kiosk configurations).

Upon loading, the device authenticates with its stored device token, queries the backend for its assigned journey manifest, and renders the **Multi-Journey Kiosk Home Screen** (or auto-launches if exactly one journey is assigned and autoPlay is configured).

### Status
ACCEPTED

### Consequences
- Changing journey assignments in the admin portal immediately updates the kiosk terminal without re-bookmarking or physically accessing the device.
- Eliminates expired signed URL breakage on physical kiosks.

---

## ADR-005: Device Assignment Semantics (Dynamic Fallback Rule)

### Context
Organizations need flexible deployment models: some kiosks are dedicated single-purpose stations (e.g., "Visitor Safety Briefing"), while others are general-purpose training room terminals.

### Decision
Device-to-journey assignment follows the deterministic fallback rule:
1. **Explicit Assignments Exist**: If one or more active journeys are explicitly assigned to the device (or to a device group containing the device), the device MUST display ONLY those assigned journeys.
2. **Zero Explicit Assignments**: If NO explicit assignments exist for the device, the device defaults to displaying ALL published, eligible journeys belonging to the organization (or site).
3. **Filtering & Eligibility**: In both cases, journeys are filtered by device status, site eligibility, language availability, and scheduling rules.

### Status
ACCEPTED

### Consequences
- Default out-of-the-box experience allows newly paired devices to immediately present available organization training without manual mapping.
- Dedicated stations can be locked down to specific journeys by adding explicit assignments.

---

## ADR-006: Immutable Published Journey Version Snapshots

### Context
In the current system, `KioskJourneyModel` updates in-place when edited in `KioskBuilder`. Publishing increments `publishing.version: number`, but draft edits directly modify the canonical document. If an administrator edits safety steps while an employee is on screen 3, or if legal auditors inspect a completion from 6 months ago, the content may have shifted.

### Decision
Published kiosk journeys are strictly immutable:
1. When a journey is published, the server creates an immutable snapshot document in a `KioskJourneyVersion` collection containing the exact step definitions, media references, interaction rules, and hashes.
2. Active employee sessions are PINNED to the specific version snapshot ID active at session commencement.
3. Mid-session updates are prohibited from mutating active sessions. If a new version is published, active sessions finish on their original version; new sessions pick up the new version.
4. Historical completion records link directly to the immutable version snapshot.

### Status
ACCEPTED

### Consequences
- Guarantees non-repudiation and audit integrity for OSHA, ISO 45001, and legal compliance.
- Allows journey authors to safely draft major revisions without affecting live terminal operation.

---

## ADR-007: Server-Authoritative Completion Integrity & Anti-Tampering

### Context
Currently, `completeSession` in `KioskPlayerContext` sends an unvalidated analytics payload containing `completedCount: 1`. The client has full discretion to declare a journey complete.

### Decision
Kiosk completion is strictly server-authoritative:
1. The client sends step progression and interaction telemetry to the session endpoint.
2. The server verifies that:
   - All mandatory steps were visited in permissible sequence.
   - Required dwell times and interactive hold durations were satisfied.
   - Any embedded knowledge checks/PPE checklists achieved required passing thresholds.
   - Required supervisor witness attestations were cryptographically verified.
3. Upon satisfaction, the SERVER marks the `KioskSession` as `completed`, records completion timestamps, computes a tamper-proof SHA-256 verification hash, and generates an official completion record.
4. Client-side attempts to skip directly to completion without server progression verification are rejected with `400 BAD_REQUEST / COMPLETION_GATE_VIOLATION`.

### Status
ACCEPTED

### Consequences
- Prevents malicious or accidental bypassing of mandatory safety briefings.
- Provides verifiable compliance evidence for enterprise audits.

---

## ADR-008: Supervisor Witness Dual Attestation

### Context
High-risk industrial and safety environments require a physical supervisor to witness training or verify PPE donning before an employee is permitted onto the worksite.

### Decision
Supervisor verification must be modeled as a distinct, dual-attestation security boundary:
1. Steps marked with `supervisor_witness_required` halt progression with a locked completion gate.
2. The supervisor must authenticate at the terminal via their own identifier and a pre-configured 4-digit PIN (or corporate badge scan).
3. The server validates supervisor credentials against users holding supervisory/managerial roles within the organization, asserting rate limits (max 3 failed attempts before 5-minute lockout).
4. The resulting completion record stores:
   - `employeeUserId`
   - `supervisorUserId`
   - `verifiedAt` timestamp
   - `verificationMethod: "pin" | "badge" | "biometric"`
   - `deviceHardwareId`
5. The supervisor identity is NEVER conflated with the employee session.

### Status
ACCEPTED

### Consequences
- Meets regulatory OSHA/EHS witnessing requirements.
- Full traceability of which supervisor signed off on each worker's physical briefing.

---

## ADR-009: Offline-First Journey Execution & Storage Architecture

### Context
Kiosks deployed at construction gates, underground mines, remote warehouses, and marine vessels experience intermittent or absent internet connectivity. Currently, only analytics are queued in localStorage; journey content fails immediately if offline.

### Decision
The kiosk player must support architectural offline operation:
1. **Content Cache (IndexedDB & Service Worker)**: Paired devices proactively pre-cache assigned journey version manifests, static step JSON, localized text bundles, and optimized media assets (video/audio/images).
2. **Offline Session Execution**: When network connectivity is lost, the device transitions to `offline` mode, allowing employees to start and complete pre-cached journeys.
3. **Encrypted Offline Store**: Offline completion records are stored in browser IndexedDB with AES-GCM encryption using a key derived from the device token.
4. **Idempotent Reconciliation**: Upon network reconnection, the device flushes queued completions and telemetry via `POST /api/v1/kiosk/analytics/sync` using idempotent transaction IDs (`clientEventId`).

### Status
ACCEPTED

### Consequences
- Uninterrupted frontline operations during network dropouts.
- Zero data loss for completions achieved while offline.

---

## ADR-010: Built-in Accessibility & WCAG 2.2 Level AA Engine

### Context
Kiosks serve diverse workforces including frontline workers with varying physical capabilities, visual impairments, literacy levels, and language fluencies. Kiosks are public accommodation or workplace equipment subject to ADA, Section 508, and EN 301 549.

### Decision
Accessibility must be an intrinsic architectural capability of the kiosk runtime, not an afterthought:
1. **Touch Target Sizing**: All interactive touch targets must meet minimum 48x48 CSS px with at least 8px separation (exceeding WCAG 2.5.5 / 2.5.8).
2. **Accessible Authentication (WCAG 2.2 SC 3.3.8)**: Frontline authentication must not require cognitive function tests or memorized passwords; badge scanning, QR codes, and numeric keypad IDs are prioritized.
3. **Multi-Modal Output**: Every step supports synchronized audio narration, closed captions for video, high-contrast mode, and dynamic text sizing (100% to 200%).
4. **Screen Reader Architecture**: Step transitions announce screen titles and critical warnings via ARIA live regions (`aria-live="polite"` and `aria-live="assertive"` for emergency steps).
5. **Keyboard / Assistive Switch Device Support**: Full tab-order navigation and shortcut support for external USB assistive switches and numpads.

### Status
ACCEPTED

### Consequences
- Full legal compliance with global accessibility mandates.
- Highly inclusive user experience for all workers regardless of ability.
