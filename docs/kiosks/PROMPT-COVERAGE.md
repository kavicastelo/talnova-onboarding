# Kiosk Requirements-to-Prompt Coverage Matrix & Gap Analysis

This document provides a 100% comprehensive traceability mapping between the 165 specification sections in `docs/kiosks/Enterprise Kiosk System Features List.md` and the 56 structured prompts in `prompts/kiosks/`, followed by an exhaustive Gap Analysis.

---

## 1. Traceability Matrix (Specification Sections 1 to 165)

| Spec Section | Section Title / Core Requirement | Domain | Target Prompt(s) | Implementation Level | Verification Test |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Product Definition (4 Decoupled Primitives) | `foundation` | `K-FND-001`, `K-FND-002`, `K-FND-003` | Schema & Types Decoupling | `server/src/tests/kiosk-assignment-model.test.ts` |
| **2** | Kiosk Operating Modes (Public, Identified, Witness, etc.) | `runtime` | `K-RUN-002`, `K-EMP-001`, `K-SUP-001` | Multi-Mode Player Engine | `src/tests/e2e/kiosk-lifecycle.e2e.test.ts` |
| **3** | Journey Management Lifecycle & Metadata | `journey` | `K-JRN-001`, `K-JRN-002` | Lifecycle State Machine | `server/src/tests/kiosk-journey-versioning.test.ts` |
| **4** | Kiosk Builder (Step Types & Content Authoring) | `journey` | `K-JRN-003`, `K-RUN-004` | Step Builders & Form Controls | `server/src/tests/kiosk-prepublish-validation.test.ts` |
| **5** | Interaction Mechanisms (Tap, Hold, PPE, Hotspots) | `runtime` | `K-RUN-004` | Modular Interaction Engines | `src/tests/kiosk-interactions.test.tsx` |
| **6** | Content Blocks (Text, Media, Safety, Interactive) | `runtime` | `K-RUN-003`, `K-RUN-004` | Block Renderers & Layouts | `src/tests/kiosk-player-shell.test.tsx` |
| **7** | Journey Settings (Localization, Timeout, Security) | `journey` | `K-JRN-001`, `K-SEC-002`, `K-EMP-003` | Settings Schema & Enforcement | `server/src/tests/kiosk-journey-versioning.test.ts` |
| **8** | Device Management Entity & Hardware Registration | `device` | `K-FND-001`, `K-DEV-001` | Mongoose Schema & Service | `server/src/tests/kiosk-api.test.ts` |
| **9** | Device Types (Wall-mount, Tablet, Totem, Rugged) | `device` | `K-FND-001`, `K-DEV-006` | Device Type Metadata & Filter | `src/tests/kiosk-fleet-dashboard.test.tsx` |
| **10** | Device Pairing Lifecycle (Admin code -> Terminal) | `device` | `K-DEV-002` | Persistent CSPRNG Handshake | `server/src/tests/kiosk-pairing-persistent.test.ts` |
| **11** | Device Credential Management (Bearer Token, Rotation) | `device` | `K-DEV-003`, `K-DEV-004` | Token Rotation & Revocation | `server/src/tests/kiosk-device-refresh.test.ts` |
| **12** | Device-to-Journey Assignment (M:N Relations) | `assignment` | `K-ASN-001`, `K-FND-002` | Multi-Journey M:N Schema | `server/src/tests/kiosk-assignment-engine.test.ts` |
| **13** | Device Groups & Hierarchy | `assignment` | `K-ASN-003` | Group Model & Inheritance | `server/src/tests/kiosk-group-assignments.test.ts` |
| **14** | Employee Identification (Badge, ID, QR, NFC) | `employee` | `K-EMP-001` | Frontline Identification Modal | `src/tests/frontline-identify.test.tsx` |
| **15** | Employee Lookup (Fast, Sub-10ms Indexing) | `employee` | `K-EMP-001`, `K-ENT-001` | Indexed Badge & ID Queries | `server/src/tests/scim-badge-sync.test.ts` |
| **16** | Privacy-Preserving Employee Selection & Masking | `employee` | `K-EMP-001` | Masked Identity Confirmation | `src/tests/frontline-identify.test.tsx` |
| **17** | Employee Session (Ephemeral 1-Hour Token) | `employee` | `K-EMP-002`, `K-FND-003` | Ephemeral Session JWT & Model | `server/src/tests/kiosk-session-lifecycle.test.ts` |
| **18** | Session Lifecycle State Machine | `employee` | `K-EMP-002`, `K-FND-003` | Status State Transitions | `server/src/tests/kiosk-session-lifecycle.test.ts` |
| **19** | Multi-Journey Kiosk Home Screen Launcher | `runtime` | `K-RUN-002` | Catalog Touch Grid Component | `src/tests/kiosk-home-screen.test.tsx` |
| **20** | Kiosk Home Screen UX & Large Touch Targets | `runtime` | `K-RUN-002`, `K-ACC-001` | 48x48px & 64x64px Target Rules | `src/tests/kiosk-touch-targets.test.tsx` |
| **21** | Kiosk Reset (Manual Restart & Clear Data) | `runtime` | `K-RUN-003`, `K-EMP-003` | Restart Action & State Wipe | `src/tests/kiosk-player-context.test.tsx` |
| **22** | Automatic Privacy Reset (Idle Timeout & Memory Wipe)| `employee` | `K-EMP-003` | Inactivity Watcher & Wipe | `src/tests/kiosk-privacy-reset.test.ts` |
| **23** | Kiosk Screen Lock (Exit PIN & Maintenance) | `security` | `K-SEC-002` | Exit PIN Overlay & Lockdown | `src/tests/kiosk-lockdown.test.tsx` |
| **24** | Supervisor Witness PIN & Physical Attestation | `supervisor` | `K-SUP-001`, `K-SUP-002` | Witness PIN & Completion Gate | `src/tests/supervisor-witness-gate.test.tsx` |
| **25** | PIN Security (Timing-Safe Hash & Rate Limit) | `supervisor` | `K-SUP-001`, `K-SUP-003` | SHA-256 + 5-Min Lockout | `server/src/tests/kiosk-supervisor-rate-limit.test.ts` |
| **26** | Accessibility (WCAG 2.2 Level AA Standards) | `accessibility` | `K-ACC-001`, `K-ACC-002` | Touch Targets & Contrast | `src/tests/kiosk-axe-audit.test.tsx` |
| **27** | Responsive Kiosk Player (16:9, 9:16, 4:3) | `runtime` | `K-RUN-003` | Responsive Player Shell | `src/tests/kiosk-player-shell.test.tsx` |
| **28** | Orientation Adaptation (Portrait & Landscape) | `runtime` | `K-RUN-003` | Dynamic Flex/Grid Reflow | `src/tests/kiosk-player-shell.test.tsx` |
| **29** | Media Support (Video, Audio, S3 Streaming) | `runtime` | `K-RUN-003`, `K-LOC-003` | Asset Streaming & Uploads | `src/tests/kiosk-audio-narrator.test.tsx` |
| **30** | Offline Mode (Player Shell & Cached Content) | `offline` | `K-OFF-001`, `K-OFF-002` | Service Worker & IndexedDB | `src/tests/kiosk-service-worker.test.ts` |
| **31** | Offline Security (Encrypted Local Storage) | `offline` | `K-OFF-002` | AES-256-GCM Session Buffer | `src/tests/offline-storage.test.ts` |
| **32** | Device Connectivity & Auto-Reconnect | `device` | `K-DEV-005`, `K-OFF-003` | Ping Monitor & Reconnect Sync | `server/src/tests/kiosk-idempotent-sync.test.ts` |
| **33** | Device Health Monitoring & Sentinel | `analytics` | `K-DEV-005`, `K-ANA-002` | Battery, Latency, Sentinel | `server/src/tests/kiosk-sentinel.test.ts` |
| **34** | Remote Device Operations (Reboot, Maintenance) | `device` | `K-DEV-007` | Remote Command Polling | `server/src/tests/kiosk-remote-commands.test.ts` |
| **35** | Device Update Management (Graceful Manifest Sync)| `device` | `K-DEV-005`, `K-DEV-007` | Content Version Check | `server/src/tests/kiosk-heartbeat-protocol.test.ts` |
| **36** | Journey Deployment (Scheduled, Canary, Phased) | `journey` | `K-JRN-002` | Scheduling & Deployment Rules | `server/src/tests/kiosk-publishing-controls.test.ts` |
| **37** | Version Compatibility (Runtime Schema Checks) | `journey` | `K-JRN-001`, `K-RUN-001` | Version Handshake Validation | `server/src/tests/kiosk-journey-versioning.test.ts` |
| **38** | Content Validation (Pre-Publish Linting) | `journey` | `K-JRN-003` | Automated Validation Linter | `server/src/tests/kiosk-prepublish-validation.test.ts` |
| **39** | Journey Simulation & Hardware Emulation | `journey` | `K-JRN-004` | Simulator Modal in Builder | `src/tests/kiosk-journey-simulator.test.tsx` |
| **40** | Journey QA (Structural, Media, Touch Verification) | `journey` | `K-JRN-003`, `K-JRN-004` | Pre-Publish Linter & Emulation | `src/tests/kiosk-journey-simulator.test.tsx` |
| **41** | Employee Completion Tracking | `compliance` | `K-CMP-001`, `K-EMP-002` | Server-Authoritative Records | `server/src/tests/kiosk-completion-verification.test.ts` |
| **42** | Analytics (Usage, Step Drop-offs, Dwell Times) | `analytics` | `K-ANA-001` | Aggregated Product Analytics | `server/src/tests/kiosk-analytics-refactor.test.ts` |
| **43** | Safety & Compliance Analytics (PPE, Hazmat) | `analytics` | `K-ANA-003` | Compliance Dashboard Views | `src/tests/kiosk-compliance-dashboard.test.tsx` |
| **44** | Analytics Privacy Controls & Anonymization | `analytics` | `K-ANA-001` | PII Stripping & Redaction | `server/src/tests/kiosk-analytics-refactor.test.ts` |
| **45** | Audit Trail (Immutable Event Logging) | `compliance` | `K-CMP-003` | AuditLog Integration | `server/src/tests/kiosk-audit-trail.test.ts` |
| **46** | Enterprise RBAC (Admin, Designer, Publisher, etc.) | `enterprise` | `K-JRN-002`, `K-DEV-006` | Role Assertions on Endpoints | `server/src/tests/kiosk-api.test.ts` |
| **47** | Approval Workflow (Four-Eyes Principle) | `journey` | `K-JRN-002` | Publisher Role Verification | `server/src/tests/kiosk-publishing-controls.test.ts` |
| **48** | Enterprise SSO & WebAuthn Integration | `enterprise` | `K-ENT-001` | SCIM & Portal SSO Mapping | `server/src/tests/scim-badge-sync.test.ts` |
| **49** | Employee Directory Integration (SCIM / HRIS) | `enterprise` | `K-ENT-001` | SCIM Badge Extension | `server/src/tests/scim-badge-sync.test.ts` |
| **50** | Device Directory Integration (MDM Asset Tags) | `device` | `K-DEV-001`, `K-ENT-002` | Hardware GUID & MDM Tagging | `src/tests/mdm-enrollment.test.ts` |
| **51** | Device Provisioning at Scale (Bulk Enrollment) | `enterprise` | `K-ENT-002` | Zero-Touch AppConfig Profiles | `src/tests/mdm-enrollment.test.ts` |
| **52** | Device Enrollment Security (CSPRNG Code Exchange) | `device` | `K-DEV-002` | Single-Use Code Exchange | `server/src/tests/kiosk-pairing-persistent.test.ts` |
| **53** | Device Theft & Compromise Handling (Remote Lock) | `device` | `K-DEV-004` | Instant Revocation & Wipe | `server/src/tests/kiosk-revocation.test.ts` |
| **54** | Security Architecture & Zero Trust Posture | `security` | `K-SEC-001` | Multi-Tenant Authorization | `server/src/tests/kiosk-zero-trust.test.ts` |
| **55** | Separate Session Types (Admin vs Device vs Worker) | `foundation` | `K-FND-001`, `K-EMP-002` | Distinct JWT Formats & Scopes | `server/src/tests/kiosk-security.test.ts` |
| **56** | Device Trust vs Employee Authentication | `security` | `K-DEV-001`, `K-EMP-001` | Decoupled Token Lifecycles | `src/tests/e2e/kiosk-lifecycle.e2e.test.ts` |
| **57** | Kiosk Emergency Mode & Evacuation Protocols | `security` | `K-SEC-004` | Emergency Broadcast Engine | `server/src/tests/kiosk-emergency-broadcast.test.ts` |
| **58** | Safety Content Governance & Legal Holds | `journey` | `K-JRN-001`, `K-CMP-003` | Immutable Versioning & Audit | `server/src/tests/kiosk-audit-trail.test.ts` |
| **59** | Internationalization & Multi-Language Switching | `localization` | `K-LOC-001` | Language Selector Modal | `src/tests/kiosk-language-switcher.test.tsx` |
| **60** | Time Zone Management & Local Time Formatting | `runtime` | `K-RUN-002`, `K-CMP-001` | Locale-Aware Date Formatting | `server/src/tests/kiosk-completion-verification.test.ts` |
| **61** | Multi-Site Enterprise Support & Hierarchy | `assignment` | `K-ASN-003` | Campus & Site Rules | `server/src/tests/kiosk-group-assignments.test.ts` |
| **62** | Multi-Tenant Strict Isolation | `security` | `K-SEC-001` | Tenant Scoping Assertions | `server/src/tests/kiosk-zero-trust.test.ts` |
| **63** | Comprehensive Kiosk REST API | `foundation` | All Prompts | Fastify REST API Contracts | `server/src/tests/kiosk-api.test.ts` |
| **64** | Kiosk Webhooks (Offline, Completion, Emergency) | `enterprise` | `K-ENT-003` | Webhook Event Publisher | `server/src/tests/kiosk-webhooks.test.ts` |
| **65** | Reliability & Crash Fault Tolerance | `reliability` | `K-REL-001` | React Error Boundary & Watchdog| `src/tests/kiosk-error-boundary.test.tsx` |
| **66** | Idempotency & Deduplication Protection | `offline` | `K-OFF-003` | UUIDv4 Client Transaction IDs | `server/src/tests/kiosk-idempotent-sync.test.ts` |
| **67** | Telemetry Architecture (3 Distinct Streams) | `analytics` | `K-ANA-001` | 3 Models & Retention Tiers | `server/src/tests/kiosk-analytics-refactor.test.ts` |
| **68** | Performance & Sub-Second Screen Transitions | `runtime` | `K-RUN-003` | Optimized Bundle & Transitions | `src/tests/kiosk-player-shell.test.tsx` |
| **69** | Media Optimization & Asset Streaming | `runtime` | `K-RUN-003`, `K-LOC-003` | Presigned URLs & Cache API | `src/tests/kiosk-audio-narrator.test.tsx` |
| **70** | Kiosk Startup Flow & State Recovery | `runtime` | `K-RUN-001`, `K-REL-002` | Auto-Discovery Startup Machine | `src/tests/e2e/kiosk-lifecycle.e2e.test.ts` |
| **71** | Employee Journey Flow & Navigation | `runtime` | `K-RUN-002`, `K-RUN-003` | Player Navigation Engine | `src/tests/e2e/kiosk-lifecycle.e2e.test.ts` |
| **72** | Device Assignment Flow (Admin UI Mapping) | `assignment` | `K-ASN-001` | Multi-Select Assignment Modal | `server/src/tests/kiosk-assignment-engine.test.ts` |
| **73** | Device Assignment Semantics (Fallback Algorithm) | `assignment` | `K-ASN-002` | Deterministic Fallback Rule | `server/src/tests/kiosk-manifest-resolution.test.ts` |
| **74** | Search & Filtering on Home Screen | `runtime` | `K-RUN-002` | Debounced Real-Time Search | `src/tests/kiosk-home-screen.test.tsx` |
| **75** | Accessibility-Safe Filtering & ARIA Announcements | `accessibility` | `K-ACC-003` | Live Region Filter Updates | `src/tests/kiosk-screen-reader-aria.test.tsx` |
| **76** | Timeout Design (Idle, Session Max, Journey Limit) | `employee` | `K-EMP-003` | Configurable Multi-Tier Timers | `src/tests/kiosk-privacy-reset.test.ts` |
| **77** | Timeout Warning Modal (15s Countdown) | `employee` | `K-EMP-003` | Visual Countdown & Chime | `src/tests/kiosk-privacy-reset.test.ts` |
| **78** | Kiosk Recovery & Watchdog Reload | `reliability` | `K-REL-001` | Self-Healing 5s Soft Restart | `src/tests/kiosk-error-boundary.test.tsx` |
| **79** | Browser Recovery & State Checkpoints | `reliability` | `K-REL-002` | IndexedDB Step Checkpointing | `src/tests/power-failure-recovery.test.ts` |
| **80** | Fullscreen & Kiosk Lockdown Enforcement | `security` | `K-SEC-002` | Fullscreen API & Shortcut Trap | `src/tests/kiosk-lockdown.test.tsx` |
| **81** | Maintenance Mode (Admin Toggle & Screen Overlay) | `device` | `K-DEV-007` | Full-Screen Maintenance Screen | `server/src/tests/kiosk-remote-commands.test.ts` |
| **82** | Hardware Capability Detection (Touch, Audio, Camera)| `runtime` | `K-DEV-005` | Browser Feature Probes | `server/src/tests/kiosk-heartbeat-protocol.test.ts` |
| **83** | Capability-Based Publishing Gates | `journey` | `K-JRN-003` | Pre-Publish Hardware Warning | `server/src/tests/kiosk-prepublish-validation.test.ts` |
| **84** | Device Compatibility Matrix Verification | `validation` | `K-VAL-001` | Cross-Browser Matrix Testing | `src/tests/e2e/kiosk-lifecycle.e2e.test.ts` |
| **85** | Automated Accessibility Testing | `validation` | `K-VAL-003` | axe-core Automated Test Suite | `src/tests/kiosk-axe-audit.test.tsx` |
| **86** | International Compliance Mapping (OSHA, ISO 45001)| `compliance` | `K-CMP-001`, `K-CMP-003` | Evidence Packets & Hashes | `server/src/tests/kiosk-completion-verification.test.ts` |
| **87** | Enterprise Data Retention & Purging Policies | `analytics` | `K-ANA-001` | TTL Indexes & Retention Tiers | `server/src/tests/kiosk-analytics-refactor.test.ts` |
| **88** | Data Export (CSV, JSON Compliance Packets) | `analytics` | `K-ANA-003` | Export Stream Handlers | `src/tests/kiosk-compliance-dashboard.test.tsx` |
| **89** | Multi-Tier Reporting (Org, Site, Journey, Worker)| `analytics` | `K-ANA-003` | Reporting Dashboard Views | `src/tests/kiosk-compliance-dashboard.test.tsx` |
| **90** | Automated Facility Alerts (Offline, Low Battery) | `analytics` | `K-ANA-002` | Sentinel Multi-Channel Alert | `server/src/tests/kiosk-sentinel.test.ts` |
| **91** | Auditability of Completion & Verification Hashes | `compliance` | `K-CMP-001` | SHA-256 HMAC Checksums | `server/src/tests/kiosk-completion-verification.test.ts` |
| **92** | Evidence Generation & Verification Proof Packets | `compliance` | `K-CMP-002` | Signed Certificate Packets | `server/src/tests/kiosk-certificate-verification.test.ts` |
| **93** | Configuration Profiles (Safety, Training, Emergency)| `assignment`| `K-ASN-001` | Pre-set Profile Templates | `server/src/tests/kiosk-assignment-engine.test.ts` |
| **94** | Device Policy Profiles (Timeouts, Lockdown Rules) | `device` | `K-DEV-006` | Policy Association Controls | `src/tests/kiosk-fleet-dashboard.test.tsx` |
| **95** | Device Fleet Dashboard (Summary Cards & Filtering) | `device` | `K-DEV-006` | Fleet Health Overview UI | `src/tests/kiosk-fleet-dashboard.test.tsx` |
| **96** | Device Detail Page (Telemetry Graphs & Actions) | `device` | `K-DEV-006` | Diagnostic Drawer Component | `src/tests/kiosk-fleet-dashboard.test.tsx` |
| **97** | Device Lifecycle (Staged -> Paired -> Active -> ...) | `device` | `K-FND-001`, `K-DEV-004` | Status Enum & Transitions | `server/src/tests/kiosk-revocation.test.ts` |
| **98** | Journey Lifecycle (Draft -> In Review -> Published)| `journey` | `K-JRN-001`, `K-JRN-002` | Publication State Machine | `server/src/tests/kiosk-publishing-controls.test.ts` |
| **99** | Employee Session Lifecycle (Idle -> Active -> Done)| `employee` | `K-FND-003`, `K-EMP-002` | Session State Machine | `server/src/tests/kiosk-session-lifecycle.test.ts` |
| **100**| Device-Journey Assignment Lifecycle | `assignment` | `K-FND-002`, `K-ASN-001` | Assignment State & Scheduling | `server/src/tests/kiosk-assignment-engine.test.ts` |
| **101**| Large Enterprise Scalability (10,000+ Terminals) | `offline` | `K-OFF-003`, `K-ANA-001` | Distributed Sync & Caching | `server/src/tests/kiosk-idempotent-sync.test.ts` |
| **102**| Caching Strategy (IndexedDB & Service Worker) | `offline` | `K-OFF-001`, `K-OFF-002` | Stale-While-Revalidate Cache | `src/tests/kiosk-service-worker.test.ts` |
| **103**| CDN & Presigned Asset Streaming | `runtime` | `K-RUN-003` | S3 Presigned URL Resolver | `src/tests/kiosk-audio-narrator.test.tsx` |
| **104**| Security Boundaries (Admin vs Device vs Worker) | `security` | `K-SEC-001` | Role Assertions & Token Scopes| `server/src/tests/kiosk-zero-trust.test.ts` |
| **105**| Event Model (Device, Session, Security Events) | `enterprise` | `K-ENT-003`, `K-CMP-003` | Event Publisher Subsystem | `server/src/tests/kiosk-webhooks.test.ts` |
| **106**| Anti-Tampering & Dev Tools Suppression | `security` | `K-SEC-002`, `K-SEC-003` | DOM Observers & Key Traps | `src/tests/anti-tampering-guard.test.ts` |
| **107**| Completion Integrity (Monotonic Progression Checks)| `compliance` | `K-CMP-001` | Server Progression Rules | `server/src/tests/kiosk-completion-verification.test.ts` |
| **108**| Duplicate Completion Protection & Recertification | `compliance` | `K-CMP-001` | Completion Deduplication Rule| `server/src/tests/kiosk-completion-verification.test.ts` |
| **109**| Employee Privacy (Zero Persistent PII in Storage) | `employee` | `K-EMP-003` | Storage Sanitization Watcher | `src/tests/kiosk-privacy-reset.test.ts` |
| **110**| Privacy UX (Masked Names, Explicit Confirmations) | `employee` | `K-EMP-001` | Friendly Confirmation Modal | `src/tests/frontline-identify.test.tsx` |
| **111**| Audio & Video Accessibility (Captions, Waveforms) | `accessibility` | `K-ACC-002`, `K-LOC-003` | WebVTT & Audio Waveform | `src/tests/kiosk-audio-narrator.test.tsx` |
| **112**| Animation & Reduced Motion Compliance | `accessibility` | `K-ACC-002` | `prefers-reduced-motion` CSS | `src/tests/kiosk-axe-audit.test.tsx` |
| **113**| Touch Design System (64px Controls, 8px Spacing) | `accessibility` | `K-ACC-001` | Touch Layout System | `src/tests/kiosk-touch-targets.test.tsx` |
| **114**| Error UX & Graceful Recovery Overlays | `reliability` | `K-REL-001` | Error Boundary Overlays | `src/tests/kiosk-error-boundary.test.tsx` |
| **115**| Network Error UX & Offline Resilient Mode Banner | `offline` | `K-OFF-001`, `K-OFF-003` | Unobtrusive Status Pill | `src/tests/e2e/kiosk-lifecycle.e2e.test.ts` |
| **116**| Language Selection (Header Dropdown & Modal) | `localization` | `K-LOC-001` | Language Selector Modal | `src/tests/kiosk-language-switcher.test.tsx` |
| **117**| Translation Governance & Missing Language Badges | `journey` | `K-JRN-003`, `K-LOC-001` | Linter Badges & Fallbacks | `server/src/tests/kiosk-prepublish-validation.test.ts` |
| **118**| Right-to-Left (RTL) Layout Adaptation | `localization` | `K-LOC-002` | Dynamic `dir="rtl"` Engine | `src/tests/kiosk-rtl-layout.test.tsx` |
| **119**| Global Date/Time & Locale Formatting | `runtime` | `K-RUN-002`, `K-CMP-001` | `Intl.DateTimeFormat` Helpers | `server/src/tests/kiosk-completion-verification.test.ts` |
| **120**| Enterprise Search with Real-Time Debouncing | `runtime` | `K-RUN-002` | Search Index & Filter Hook | `src/tests/kiosk-home-screen.test.tsx` |
| **121**| Bulk Operations (Bulk Pairing, Assignment) | `assignment` | `K-ASN-001`, `K-ENT-002` | Batch Assignment Endpoints | `server/src/tests/kiosk-assignment-engine.test.ts` |
| **122**| Import & Export (JSON / CSV Fleet & Journeys) | `analytics` | `K-ANA-003` | CSV Import/Export Streams | `src/tests/kiosk-compliance-dashboard.test.tsx` |
| **123**| Enterprise API Rate Limits (Differentiated Tiers) | `security` | `K-SEC-001`, `K-SUP-003` | Fastify Rate-Limit Rules | `server/src/tests/kiosk-supervisor-rate-limit.test.ts` |
| **124**| Heartbeat Protocol Architecture (60s + Jitter) | `device` | `K-DEV-005` | Heartbeat Loop Service | `server/src/tests/kiosk-heartbeat-protocol.test.ts` |
| **125**| Remote Configuration Updates Without Re-pairing | `device` | `K-DEV-005`, `K-DEV-007` | Config Synchronization Loop | `server/src/tests/kiosk-remote-commands.test.ts` |
| **126**| Elimination of the Current URL Problem | `runtime` | `K-RUN-001` | Permanent `/kiosk/terminal` | `src/tests/kiosk-terminal-routing.test.tsx` |
| **127**| Permanent Device URL Model | `runtime` | `K-RUN-001` | Terminal Entry Point | `src/tests/kiosk-terminal-routing.test.tsx` |
| **128**| Pairing vs URL Security Handshake | `device` | `K-DEV-002` | Persistent 6-Digit Code Route | `server/src/tests/kiosk-pairing-persistent.test.ts` |
| **129**| QR Code Integration (Pairing QR & Badge QR) | `employee` | `K-EMP-001`, `K-CMP-002` | Webcam QR & Cert QR | `src/tests/frontline-identify.test.tsx` |
| **130**| Future Identity Extensions (NFC, WebAuthn, FIDO2) | `employee` | `K-EMP-001`, `K-ENT-001` | Modular Identity Provider Hook | `src/tests/frontline-identify.test.tsx` |
| **131**| Future Device Extensions (Barcode Wedge, Scanners) | `employee` | `K-EMP-001` | `useBarcodeScanner` Hook | `src/tests/frontline-identify.test.tsx` |
| **132**| Future Dynamic Assignment Rules (Shifts, Roles) | `assignment` | `K-ASN-001`, `K-ASN-003` | Scheduling Window Schema | `server/src/tests/kiosk-assignment-engine.test.ts` |
| **133**| Scheduling Windows & Blackout Periods | `assignment` | `K-ASN-001` | Schedule Evaluation Logic | `server/src/tests/kiosk-assignment-engine.test.ts` |
| **134**| Recertification & Expiration Reminders | `compliance` | `K-CMP-001` | Recertification Interval Logic | `server/src/tests/kiosk-completion-verification.test.ts` |
| **135**| Employee Dashboard Roadmap Synchronization | `compliance` | `K-CMP-001` | Roadmap Task Auto-Completion | `server/src/tests/kiosk-completion-verification.test.ts` |
| **136**| Multi-Channel Notifications (Email, SMS, Webhooks)| `enterprise` | `K-ENT-003`, `K-ANA-002` | Notification Dispatcher | `server/src/tests/kiosk-sentinel.test.ts` |
| **137**| Supervisor Dashboard & Shift Verification Overview | `supervisor` | `K-SUP-001`, `K-ANA-003` | Supervisor Sign-off Filter | `src/tests/kiosk-compliance-dashboard.test.tsx` |
| **138**| Compliance Dashboard (Organization-Wide Overview) | `analytics` | `K-ANA-003` | High-Level Status Gauges | `src/tests/kiosk-compliance-dashboard.test.tsx` |
| **139**| Kiosk Analytics Drop-Off & Dwell Heatmaps | `analytics` | `K-ANA-001` | Funnel Drop-off Aggregations | `server/src/tests/kiosk-analytics-refactor.test.ts` |
| **140**| Feature Flags Rollout Controls (`kiosk_mode`) | `foundation` | `K-META-001`, `K-RUN-001` | Feature Flag Authorization | `server/src/tests/feature-flag-runtime.test.ts` |
| **141**| Canary Deployment & Gradual Fleet Rollout | `journey` | `K-JRN-002`, `K-ASN-003` | Group Assignment Phasing | `server/src/tests/kiosk-publishing-controls.test.ts` |
| **142**| Test Environment & Mock Device Telemetry | `validation` | `K-VAL-001` | Vitest In-Memory Sandbox | `src/tests/e2e/kiosk-lifecycle.e2e.test.ts` |
| **143**| Kiosk Test Mode (Admin Step Skip & Debug Overlay) | `journey` | `K-JRN-004` | Debug Overlay in Simulator | `src/tests/kiosk-journey-simulator.test.tsx` |
| **144**| Synthetic Monitoring & End-to-End Ping Probes | `reliability` | `K-REL-003` | Health Synthetic Endpoint | `server/src/tests/kiosk-synthetic-probe.test.ts` |
| **145**| Browser Compatibility (Chromium, Edge, WebKit) | `validation` | `K-VAL-001` | Cross-Browser E2E Matrix | `src/tests/e2e/kiosk-lifecycle.e2e.test.ts` |
| **146**| Security Penetration Testing & Token Tampering | `validation` | `K-VAL-002` | Automated Security Test Suite | `server/src/tests/kiosk-security-pentest.test.ts` |
| **147**| Privacy Testing (Verification of Zero Stored PII) | `validation` | `K-VAL-002`, `K-EMP-003` | Automated Storage Scraper Test | `src/tests/kiosk-privacy-reset.test.ts` |
| **148**| Accessibility Acceptance (Zero AA Violations) | `validation` | `K-VAL-003` | Automated axe-core Test Suite | `src/tests/kiosk-axe-audit.test.tsx` |
| **149**| Enterprise Deployment Documentation (IT Guide) | `meta` | `docs/kiosks/00-overview...` | Architectural Documentation | Complete in `docs/kiosks/` |
| **150**| Recommended Hardware Guidance (Screen, ADA Mounts)| `meta` | `docs/kiosks/00-overview...` | Hardware Specifications | Complete in `docs/kiosks/` |
| **151**| Power Failure Recovery & Checkpoint Resumption | `reliability` | `K-REL-002` | IndexedDB Checkpoint Service | `src/tests/power-failure-recovery.test.ts` |
| **152**| Network Failure Recovery & Seamless Offline Mode | `offline` | `K-OFF-001`, `K-OFF-003` | Offline-First Player Stack | `src/tests/kiosk-service-worker.test.ts` |
| **153**| Security Emergency (Instant Fleet Lockdown) | `device` | `K-DEV-004`, `K-SEC-004` | Revocation & Remote Lockdown | `server/src/tests/kiosk-revocation.test.ts` |
| **154**| Emergency Journey Propagation | `security` | `K-SEC-004` | Emergency Broadcast Engine | `server/src/tests/kiosk-emergency-broadcast.test.ts` |
| **155**| Content Immutability & Published Version Locking | `journey` | `K-JRN-001` | Frozen Version Snapshots | `server/src/tests/kiosk-journey-versioning.test.ts` |
| **156**| Verifiable Completion Certificates (PDF / QR) | `compliance` | `K-CMP-002` | Certificate Generation Engine | `server/src/tests/kiosk-certificate-verification.test.ts` |
| **157**| Public Certificate Verification Route | `compliance` | `K-CMP-002` | `/verify/cert/:id` Public Page | `server/src/tests/kiosk-certificate-verification.test.ts` |
| **158**| Enterprise Governance & Policy Profiles | `enterprise` | `K-ASN-001`, `K-DEV-006` | Policy Association Controls | `server/src/tests/kiosk-assignment-engine.test.ts` |
| **159**| Change Management Audit Logging | `compliance` | `K-CMP-003` | AuditLog Subsystem Hook | `server/src/tests/kiosk-audit-trail.test.ts` |
| **160**| Final Target Architecture Design | `meta` | `docs/kiosks/00-overview...` | Target Architectural Blueprint | Complete in `docs/kiosks/` |
| **161**| Most Important System Transformations | `foundation` | `K-FND-001`, `K-RUN-001` | Decoupling & Permanent URLs | Complete across Phase 1-5 |
| **162**| Critical Architectural Decisions (ADR 1 to 10) | `foundation` | All Prompts | ADR Enforcement Rules | `docs/kiosks/DECISIONS.md` |
| **163**| Target Enterprise Capability Matrix | `meta` | All Prompts | Comprehensive Capability Set | Complete across all 56 prompts |
| **164**| Priority Phasing Structure (P0, P1, P2, P3) | `meta` | `EXECUTION-ORDER.md` | 16-Phase Execution Roadmap | `prompts/kiosks/EXECUTION-ORDER.md` |
| **165**| Bottom Line Architecture Execution Standard | `meta` | All Prompts | Strict Quality Gate Compliance| `.agents/quality-gates.md` |

---

## 2. Gap Analysis Report

### 2.1 Requirements With No Prompt
- **Zero Requirements Unmapped**: Every single section from Section 1 to Section 165 is explicitly accounted for across the prompt library and chunk documents.

### 2.2 Prompts With No Requirement
- **Zero Orphaned Prompts**: Every prompt maps directly to documented sections in `Enterprise Kiosk System Features List.md` and addresses confirmed defects in `DEFECT-REGISTER.md`.

### 2.3 Requirements with Ambiguous Scope Resolved
1. *Hardware Identification*: Clarified that MAC address cannot be read in standard sandboxed browsers; resolved in favor of RFC 4122 UUIDv4 hardware GUIDs and CSPRNG pairing tokens (ADR-003).
2. *Assignment Fallback*: Clarified exact behavior when zero assignments exist; resolved in favor of falling back to all published organization journeys (ADR-005).
3. *Content Mutation*: Clarified how edits to published journeys behave; resolved in favor of frozen immutable version snapshots (ADR-006).

### 2.4 Documented Open Questions (Product Decisions Required)
Documented in `docs/kiosks/OPEN-QUESTIONS.md`:
- OQ-001: Frontline Employee Offline Identification Policy (Local cached hashes vs blind queueing).
- OQ-002: Maximum Permissible Offline Operational Window (72 hours vs 7 days).
- OQ-003: Physical Barcode/RFID Scanner Integration Scope (USB keyboard wedge vs native WebHID).
- OQ-004: Supervisor Authentication Modality (4-digit PIN vs Badge Scan vs Mobile Push).
- OQ-005: Enterprise MDM Integration Boundary (App-layer runtime vs OS-level MDM).
- OQ-006: Compliance Certificate Storage & Long-Term Retention Mandates (MongoDB vs S3 Glacier).
