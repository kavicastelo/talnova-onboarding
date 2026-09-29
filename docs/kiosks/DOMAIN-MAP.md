# Kiosk Subsystem Domain Map

This document establishes the official bounded contexts, domain models, entity relationships, workflows, lifecycles, cross-cutting concerns, and dependency sequencing for the Talnova Enterprise Kiosk platform.

---

## 1. Bounded Contexts Overview

The Kiosk subsystem is partitioned into 17 coherent, bounded architectural domains:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Kiosk Bounded Contexts                          │
├────────────────────────────────┬───────────────────────────────────────┤
│ 00-meta / foundation           │ Domain entities, schemas, migrations  │
│ 01-device-identity             │ Pairing, hardware GUID, token auth    │
│ 02-device-fleet                │ Health telemetry, remote commands     │
│ 03-journey-model               │ Immutable versioning, publishing      │
│ 04-journey-builder             │ Content authoring, validation, QA     │
│ 05-device-assignment           │ Multi-journey M:N rules, fallback     │
│ 06-runtime-launcher            │ Permanent URL, home screen, player    │
│ 07-employee-identity           │ Badge lookup, ephemeral session token │
│ 08-supervisor-witness          │ 4-digit PIN verification, attestation │
│ 09-security-lockdown           │ Fullscreen, idle timeout, memory wipe │
│ 10-accessibility               │ WCAG 2.2 Level AA, touch targets, TTS │
│ 11-localization                │ Language selector, RTL, audio sync    │
│ 12-offline-sync                │ Service worker, IndexedDB, bulk sync  │
│ 13-compliance-integrity        │ Server-authoritative certs, verify QR │
│ 14-analytics-audit             │ Telemetry vs product vs audit trail   │
│ 15-enterprise-governance       │ RBAC, SCIM directory, MDM AppConfig   │
│ 16-reliability-recovery        │ Watchdog recovery, power-loss resume  │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 2. Core Entity Relationship Diagram (ERD)

```text
┌───────────────────────────┐                    ┌───────────────────────────┐
│       Organization        │                    │           User            │
│  - _id                    │◄─── Belongs To ───┤  - _id                    │
│  - name, slug, status     │                    │  - profile, employment    │
│  - limits.maxKiosks       │                    │  - security.pinHash       │
└─────────────┬─────────────┘                    └─────────────┬─────────────┘
              │                                                │
       1      │ Has Many                                       │ Identifies Worker /
              ▼                                                │ Supervisor Witness
┌───────────────────────────┐                                  │
│        KioskDevice        │                                  │
│  - deviceId (HW GUID)     │                                  │
│  - tokenRef (SHA-256)     │                                  │
│  - status, telemetry      │                                  │
└─────────────┬─────────────┘                                  │
              │                                                │
       1      │ Has Many                                       │
              ▼                                                │
┌───────────────────────────┐      Assigned To   ┌─────────────┴─────────────┐
│   KioskDeviceAssignment   │◄───────────────────┤       KioskJourney        │
│  - deviceId, journeyId    │                    │  - title, languages       │
│  - priority, scheduling   │                    │  - status (draft/pub)     │
└───────────────────────────┘                    └─────────────┬─────────────┘
                                                               │ Mints Snapshot
                                                               ▼
                                                 ┌───────────────────────────┐
                                                 │    KioskJourneyVersion    │
                                                 │  - version (1, 2, 3...)   │
                                                 │  - steps, contentChecksum │
                                                 └─────────────┬─────────────┘
                                                               │ Bound To
                                                               ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                                KioskSession                                │
│  - _id, organizationId, deviceId, journeyId, journeyVersionId              │
│  - userId (Worker), sessionToken (1hr), status                             │
│  - startedAt, completedAt, durationSeconds                                 │
│  - completedStepIds, quizScore, supervisorWitness                          │
│  - verificationChecksum (Tamper-evident HMAC)                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Major Operational Workflows

### 3.1 Terminal Enrollment & Pairing
1. Administrator accesses Web Portal -> Kiosks Dashboard -> Clicks "Pair Terminal".
2. System generates CSPRNG 6-digit code with 15-minute TTL stored in MongoDB `KioskPairingCode`.
3. Physical terminal navigates to `/kiosk/pair`, captures persistent hardware GUID.
4. Admin types 6-digit code into terminal keypad.
5. Server validates code atomically, creates `KioskDevice`, issues long-lived device JWT.
6. Terminal stores device token and navigates to permanent `/kiosk/terminal` URL.

### 3.2 Workforce Training Execution
1. Terminal renders Multi-Journey Home Launcher with assigned curriculum.
2. Frontline worker approaches, selects a journey, and scans physical badge (or types employee ID).
3. Backend validates badge, returns masked identity, and issues 1-hour ephemeral session token.
4. Worker completes instructional slides, interactive confirmations, and PPE checklists.
5. If step requires supervisor witnessing, terminal presents Supervisor Witness PIN overlay; supervisor enters 4-digit PIN.
6. Worker reaches completion gate; backend validates server-authoritative step progress, marks session `completed`, and mints tamper-evident verification checksum.
7. Terminal displays completion badge, generates verifiable certificate with QR, and initiates 10-second countdown to automatic privacy reset.

---

## 4. Cross-Cutting Concerns Matrix

| Cross-Cutting Concern | Impacted Domains | Architectural Enforcement Mechanism |
| :--- | :--- | :--- |
| **Tenant Isolation** | All 17 Domains | Every query and mutation strictly asserts `organizationId`. Cross-tenant leakage impossible. |
| **Device Trust Boundary** | `01-device`, `02-fleet`, `05-assignment`, `06-runtime` | Device token validated via `verifyDeviceToken`; checks active non-revoked device status. |
| **Employee Privacy (GDPR)** | `06-runtime`, `07-employee`, `09-security`, `14-analytics` | Zero PII in browser permanent storage. Session memory completely wiped upon idle timeout or exit. |
| **Immutable Versioning** | `03-journey`, `06-runtime`, `07-session`, `13-compliance` | Sessions pinned to immutable version snapshot ID. Published versions never mutate. |
| **Accessibility (WCAG 2.2)** | `04-builder`, `06-runtime`, `07-employee`, `10-accessibility` | 48x48px touch targets, high-contrast mode, synchronized audio speech, keyboard navigation. |
| **Offline Resilience** | `06-runtime`, `11-offline`, `13-compliance`, `14-analytics` | IndexedDB cache, Service Worker offline routing, encrypted offline sessions, idempotent sync. |

---

## 5. Architectural Implementation Phasing

```text
Phase 1: Foundation & Data Architecture
└── K-FND-001 (Audit & Align) -> K-FND-002 (M:N Assignment Schema) -> K-FND-003 (Session Entity)

Phase 2: Cryptographic Device Identity & Pairing
└── K-DEV-001 (Device Model) -> K-DEV-002 (CSPRNG Pairing) -> K-DEV-003 (Token Refresh) -> K-DEV-004 (Revocation)

Phase 3: Immutable Journey Model & Publishing
└── K-JRN-001 (Version Snapshots) -> K-JRN-002 (Publishing Pipeline) -> K-JRN-003 (Pre-Publish Lint)

Phase 4: Multi-Journey Assignment Engine
└── K-ASN-001 (Assignment Engine) -> K-ASN-002 (Fallback Algorithm) -> K-ASN-003 (Device Groups)

Phase 5: Runtime Player & Multi-Journey Launcher
└── K-RUN-001 (Permanent URL) -> K-RUN-002 (Home Launcher) -> K-RUN-003 (Responsive Shell)

Phase 6: Employee Identity & Session Lifecycle
└── K-EMP-001 (Worker Lookup) -> K-EMP-002 (Session Lifecycle) -> K-EMP-003 (Privacy Memory Wipe)

Phase 7: Supervisor Witness Verification
└── K-SUP-001 (PIN Verification) -> K-SUP-002 (Witness Gate UI) -> K-SUP-003 (Lockout Rate-Limiter)

Phase 8: Security Lockdown & Anti-Tampering
└── K-SEC-001 (Zero Trust Auth) -> K-SEC-002 (Fullscreen Enforcement) -> K-SEC-003 (Emergency Push)

Phase 9: Built-in Accessibility Engine
└── K-ACC-001 (Touch Targets) -> K-ACC-002 (High Contrast & Zoom) -> K-ACC-003 (Screen Reader ARIA)

Phase 10: Internationalization & RTL
└── K-LOC-001 (Language Switcher) -> K-LOC-002 (RTL Layout) -> K-LOC-003 (Localized Audio Narration)

Phase 11: Offline Storage & Idempotent Sync
└── K-OFF-001 (Service Worker Cache) -> K-OFF-002 (IndexedDB Store) -> K-OFF-003 (Idempotent Sync)

Phase 12: Server-Authoritative Compliance Integrity
└── K-CMP-001 (Completion Verifier) -> K-CMP-002 (Certificates & QR) -> K-CMP-003 (Audit Trail)

Phase 13: Fleet Telemetry & Analytics
└── K-ANA-001 (Telemetry Separation) -> K-ANA-002 (Fleet Health Sentinel) -> K-ANA-003 (Privacy Redaction)

Phase 14: Enterprise Governance & Integrations
└── K-ENT-001 (SCIM Badge Sync) -> K-ENT-002 (MDM AppConfig) -> K-ENT-003 (Webhooks)

Phase 15: Reliability & Watchdog Recovery
└── K-REL-001 (Error Watchdog) -> K-REL-002 (Power-Loss Resume) -> K-REL-003 (Synthetic Probes)

Phase 16: Comprehensive Validation & Hardening
└── K-VAL-001 (E2E Test Suite) -> K-VAL-002 (Security & Pentest Audit) -> K-VAL-003 (Accessibility Audit)
```
