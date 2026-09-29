# Kiosk Subsystem: Overview & Target Architecture

## 1. Executive Summary

The Talnova Enterprise Kiosk subsystem delivers an enterprise-grade, frontline-first digital onboarding, safety instruction, and compliance certification platform. It empowers industrial facilities, logistics hubs, healthcare providers, construction sites, and corporate campuses to deliver standardized, verifiable training on shared, unattended, or ruggedized physical terminals without administrative overhead.

---

## 2. Four First-Class Entities

The subsystem is architected around four independent, decoupled primitives:

```text
┌───────────────────────┐             ┌─────────────────────────┐
│     Kiosk Device      │             │      Kiosk Journey      │
│  (Physical Hardware)  │             │ (Curriculum Definition) │
└───────────┬───────────┘             └────────────┬────────────┘
            │                                      │
            │               Assigned To            │
            └───────────────────┬──────────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │      Kiosk Session     │
                    │   (Execution Runtime)  │
                    └───────────▲────────────┘
                                │
                        Executed By (or Anonymous)
                                │
                    ┌───────────┴────────────┐
                    │    Employee Identity   │
                    │   (Workforce Member)   │
                    └────────────────────────┘
```

1. **Kiosk Device**: The registered physical terminal, tablet, or PC asset. Possesses its own hardware identity, trust token, telemetry history, and assigned journey manifest.
2. **Kiosk Journey**: An immutable, versioned instructional or compliance workflow composed of rich content steps, interactive confirmations, PPE checklists, and completion gates.
3. **Kiosk Session**: An ephemeral execution instance tracking a single user's progression through a specific journey version on a specific device, bound to an explicit lifecycle state machine.
4. **Employee Identity**: The verified enterprise workforce member or contractor completing the journey, authenticated via badge, employee ID, or national ID.

---

## 3. Supported Operating Modes

The kiosk runtime supports five operating modes configured per device or journey:

| Operating Mode | User Authentication | Supervisor Witness | Device Trust | Primary Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Public / Anonymous** | None required | Not required | Registered hardware | Visitor safety briefing, public announcements, emergency evacuation maps. |
| **Employee-Identified** | Badge ID / Employee ID / QR | Not required | Registered hardware | Standard pre-shift training, digital document signing, LMS onboarding. |
| **Supervisor-Witnessed** | Badge ID / Employee ID / QR | Required (4-digit PIN) | Registered hardware | High-risk industrial safety, chemical handling, heavy machinery authorization. |
| **Assigned Device** | Auto-launches assigned journey | Configurable | Trusted terminal | Single-purpose dedicated safety stations, factory entrance turnstiles. |
| **Mixed Mode** | Dynamic based on journey | Dynamic based on journey | Trusted terminal | Multi-journey lobby or training room kiosk hosting public and restricted training. |

---

## 4. Multi-Tier Security & Trust Boundaries

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Administrative Layer                            │
│  - Web Portal (Owner / Admin / HR / Kiosk Manager)                     │
│  - Session: Standard Fastify Cookie / JWT Bearer                       │
│  - Scope: Full CRUD, Device Pairing Code Generation, Assignment Rules  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Generates 6-digit CSPRNG Pairing Code
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Device Hardware Trust                           │
│  - Unattended physical terminal (Chromium / Electron / Tablet)         │
│  - Identity: Unique Hardware GUID + Cryptographic Device JWT Token     │
│  - Scope: Read Assigned Manifest, Send Heartbeats, Upload Analytics    │
│  - Security: Remote Revocation, Tamper Detection, Hardware Lockdown    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Launches Kiosk Player Runtime
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Employee Session Layer                          │
│  - Frontline Worker (Badge Scan / Employee ID / QR)                   │
│  - Token: Ephemeral 1-Hour Session JWT                                 │
│  - Scope: Step Progression, Interactive Checks, Completion Gate        │
│  - Privacy: Zero persistent PII in browser, Automatic Idle Memory Wipe │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Requires Co-Signature Gate
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Supervisor Witness Layer                        │
│  - Physical Attestation (Authorized Manager / Shift Supervisor)        │
│  - Auth: Supervisor Identifier + Hashed 4-digit PIN                    │
│  - Scope: Unlocks Final Completion Gate; Attestation Audit Record      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Architectural Non-Negotiables

1. **Device ≠ Journey**: A physical terminal is never tied to a single journey URL.
2. **Device Trust ≠ Employee Identity**: Physical hardware credentials never substitute for workforce identification.
3. **MAC ≠ Security Identity**: Hardware security is anchored cryptographically via public key or HMAC tokens, never layer-2 MAC addresses.
4. **Permanent Device URLs**: Kiosks boot to `/kiosk/terminal` or `/kiosk/device/:deviceId`.
5. **Immutable Versioning**: Published journeys mint immutable snapshots in MongoDB; live sessions are pinned to the version they commenced on.
6. **Server-Authoritative Completion**: The client cannot declare completion; completion is verified and minted exclusively by the backend.
7. **Offline-First Resilience**: Journey content is cached via IndexedDB & Service Worker; completions queue securely while offline and sync idempotently on reconnect.
8. **Intrinsic Accessibility**: Built-in WCAG 2.2 Level AA compliance, 48x48px touch targets, multi-modal narration, and assistive navigation.
