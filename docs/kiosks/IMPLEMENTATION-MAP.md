# Kiosk Subsystem Current Implementation Map

This document presents a comprehensive forensic mapping between the target Enterprise Kiosk requirements and the actual state of the repository code. Implementation status is strictly classified as:

- **EXISTS**: Fully implemented, backed by persistent data models, APIs, and frontend integration.
- **PARTIAL**: Partially implemented; code exists in some layers but is incomplete, un-integrated, or lacking key capabilities.
- **BROKEN**: Code exists but contains architectural defects, security bypasses, or fatal runtime flaws.
- **MISSING**: No implementation exists in the repository.
- **UNKNOWN**: Status cannot be verified without live runtime or external infrastructure.

---

## Forensic Implementation Matrix

| Requirement / Capability | Status | Frontend Location | Backend Location | Database Location | Tests | Known Defects | Target Prompt ID |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Cryptographic Device Identity** | PARTIAL | `src/features/kiosk/components/KioskPairingScreen.tsx` | `server/src/modules/kiosk/services/kiosk.service.ts` | `KioskDeviceModel.hardwareGuid`, `tokenRef` | `server/src/tests/kiosk-security.test.ts` | Stores `macAddress`; random ID in `localStorage` | `K-DEV-001` |
| **One-Time Code Device Pairing** | BROKEN | `src/features/kiosk/components/KioskPairingScreen.tsx` (not routed) | `server/src/modules/kiosk/services/kiosk-security.service.ts` | In-memory `Map` (non-persistent) | `server/src/tests/kiosk-security.test.ts` | `DEF-002`, `DEF-007` (in-memory Map, Math.random) | `K-DEV-002` |
| **Device Credential Rotation & Refresh** | MISSING | None | None | None | None | No rotation endpoint or refresh token mechanism | `K-DEV-003` |
| **Device Revocation & Theft Lockdown** | BROKEN | `src/pages/KioskDashboard.tsx` (device delete button) | `server/src/modules/kiosk/plugins/kiosk-auth.plugin.ts` | `KioskDeviceModel.status` | None | `DEF-005` (`verifyDeviceToken` ignores status) | `K-DEV-004`, `K-SEC-001` |
| **Device Heartbeat & Fleet Telemetry** | EXISTS | `src/features/kiosk/context/KioskPlayerContext.tsx` | `server/src/modules/kiosk/routes/kiosk.routes.ts` | `KioskDeviceModel.telemetry`, `lastHeartbeatAt` | `server/src/tests/kiosk-api.test.ts` | Fixed 30-min threshold, basic payload | `K-DEV-005` |
| **Device Fleet Management Dashboard** | EXISTS | `src/pages/KioskDashboard.tsx` (devices tab) | `server/src/modules/kiosk/controllers/kiosk.controller.ts` | `KioskDeviceModel` | `src/tests/feature-adoption-ui.test.tsx` | Lacks map view, group filtering, command audit | `K-DEV-006` |
| **Remote Device Commands (Reboot/Lock)** | PARTIAL | `src/pages/KioskDashboard.tsx` (maintenance toggle) | `server/src/modules/kiosk/controllers/kiosk.controller.ts` | `KioskDeviceModel.status` | None | Only toggles maintenance mode; no reload/lock/wipe | `K-DEV-007` |
| **Permanent Device URL Model** | BROKEN | `src/App.tsx:211` (`/kiosk/play/:id`) | `server/src/modules/kiosk/routes/kiosk.routes.ts:39` | None | None | `DEF-001` (URL hardcoded to journey ID) | `K-RUN-001` |
| **Multi-Journey Kiosk Launcher (Home)** | MISSING | None (`KioskPlayerPage` opens single journey) | None | None | None | `DEF-008` (no launcher, no catalog grid) | `K-RUN-002` |
| **Multi-Journey Device Assignment (M:N)** | BROKEN | `src/pages/KioskDashboard.tsx:76` (1:1 pair modal) | `server/src/modules/kiosk/repositories/kiosk-device.repository.ts:107` | `KioskDeviceModel.currentJourneyId` (single ID) | `server/src/tests/kiosk-api.test.ts` | `DEF-003` (1:1 schema limitation) | `K-ASN-001`, `K-ASN-002` |
| **Device Assignment Fallback Semantics** | MISSING | None | None | None | None | No rule: 0 assignments = all org eligible | `K-ASN-002` |
| **Device Groups & Site Hierarchy** | MISSING | None | None | None | None | No group collection or site tagging | `K-ASN-003` |
| **Immutable Journey Version Snapshots** | BROKEN | None (edits overwrite in place) | `server/src/modules/kiosk/models/kiosk-journey.model.ts` | Scalar `publishing.version: Number` | `server/src/tests/kiosk-persistence.test.ts` | `DEF-006` (in-place draft mutation) | `K-JRN-001`, `K-JRN-002` |
| **Journey Content Authoring & Builder** | EXISTS | `src/features/kiosk/components/KioskBuilder.tsx` | `server/src/modules/kiosk/controllers/kiosk.controller.ts` | `KioskJourneyModel` | `server/src/tests/kiosk-validation.test.ts` | Pre-publish linting basic; no device preview | `K-JRN-003` |
| **Journey Simulation & Device Preview** | PARTIAL | `src/features/kiosk/components/KioskPlayer.tsx:isAdminPreview` | None | None | None | Only admin preview in browser; no screen bounds | `K-JRN-004` |
| **Frontline Worker Identification** | BROKEN | None (player launches anonymously) | `server/src/modules/kiosk/services/kiosk.service.ts:381` (`identifyFrontlineWorker`) | `UserModel.employment` (badgeId, employeeId) | `server/src/tests/uj-ksk-001.test.ts` | `DEF-008` (backend exists, completely un-wired) | `K-EMP-001` |
| **Privacy-Preserving Employee Lookup** | PARTIAL | None | `server/src/modules/kiosk/services/kiosk.service.ts:431` (returns masked user object) | `UserModel` | None | Backend masks data, but frontend UI missing | `K-EMP-001` |
| **Kiosk Session Model & Ephemeral Token** | BROKEN | None | `server/src/modules/kiosk/controllers/kiosk.controller.ts:59` (`getSession` mock) | Missing `KioskSession` collection | `server/src/tests/uj-ksk-004.test.ts` | `DEF-004` (mock stub, no database model) | `K-FND-003`, `K-EMP-002` |
| **Session Lifecycle State Machine** | MISSING | None | None | None | None | No state transitions (Active -> Witness -> Done) | `K-EMP-002` |
| **Supervisor Witness PIN Verification** | BROKEN | `src/pages/KioskDashboard.tsx` (admin config modal) | `server/src/modules/kiosk/services/kiosk.service.ts:457` (`verifySupervisorPin`) | `UserModel.security.supervisorPinHash` | `server/src/tests/uj-ksk-001.test.ts` | `DEF-009` (player lacks witness gate UI) | `K-SUP-001`, `K-SUP-002` |
| **Supervisor Attestation Audit Record** | MISSING | None | None | None | None | Verification verified in memory; not recorded | `K-SUP-002`, `K-CMP-001` |
| **Session Idle Timeout & Memory Wipe** | PARTIAL | `src/features/kiosk/components/KioskPlayer.tsx:91` (resets step to 0) | None | None | None | Resets step counter; does not wipe tokens or memory | `K-SEC-003` |
| **Kiosk Screen Lockdown (Fullscreen/Exit PIN)** | PARTIAL | `src/features/kiosk/components/KioskPinOverlay.tsx` | `server/src/modules/kiosk/controllers/kiosk.controller.ts:108` (`validatePIN`) | `KioskJourneySettings.security.pinCode` | None | PIN validated; no fullscreen/keyboard trap | `K-SEC-004` |
| **Emergency Kiosk Mode & Evacuation Push** | MISSING | None | None | None | None | No emergency broadcast mechanism | `K-SEC-005` |
| **Accessibility Engine (WCAG 2.2 AA)** | PARTIAL | `src/features/kiosk/components/KioskPlayer.tsx` | None | None | None | Touch targets vary; lacks live region alerts | `K-ACC-001`, `K-ACC-002` |
| **Multi-Language Selector & Content I18n** | EXISTS | `src/features/kiosk/components/KioskPlayer.tsx:32` | `server/src/modules/kiosk/models/kiosk-journey.model.ts:117` | `KioskJourneyModel.languages`, `mediaReferences` | None | Lacks RTL layout support for Arabic/Hebrew | `K-LOC-001`, `K-LOC-002` |
| **Localized Audio Narration & Captions** | EXISTS | `src/features/kiosk/components/KioskPlayer.tsx:136` | `server/src/modules/kiosk/routes/kiosk.routes.ts:54` | S3 upload references per language | None | Streaming only; fails offline | `K-LOC-003` |
| **Offline Content Caching (Service Worker)** | MISSING | None | None | None | None | `DEF-010` (no service worker, no IndexedDB cache) | `K-OFF-001` |
| **Offline Analytics & Event Bulk Sync** | EXISTS | `src/features/kiosk/context/KioskPlayerContext.tsx:60` | `server/src/modules/kiosk/routes/kiosk.routes.ts:170` | `KioskAnalyticsModel` | `server/src/tests/phase9-kiosk-edge-offline.test.ts` | Only queues analytics; lacks session integrity | `K-OFF-002` |
| **Server-Authoritative Completion Integrity** | MISSING | `completeSession` in `KioskPlayerContext.tsx` | None | None | None | Client marks complete; server does not verify | `K-CMP-001` |
| **Verifiable Completion Certificate & QR** | MISSING | None | None | None | None | No PDF/JSON certificate issuance | `K-CMP-002` |
| **Tamper-Evident Audit Trail** | PARTIAL | None | `server/src/modules/audit-logs/` (general platform) | General audit log | None | Kiosk events not recorded in platform audit | `K-CMP-003` |
| **Operational vs Compliance Analytics** | PARTIAL | `src/pages/KioskDashboard.tsx` (analytics tab) | `server/src/modules/kiosk/services/kiosk.service.ts:370` | `KioskAnalyticsModel` | `server/src/tests/kiosk-api.test.ts` | Analytics model conflates telemetry & completion | `K-ANA-001` |
| **Enterprise SCIM / HRIS Directory Sync** | PARTIAL | `src/pages/Settings.tsx` (general platform) | `server/src/modules/integrations/` | General user sync | None | Kiosk does not expose SCIM badge endpoints | `K-ENT-001` |
| **Enterprise MDM AppConfig & Zero-Touch** | MISSING | None | None | None | None | No Managed App Config XML schema | `K-ENT-002` |
| **Kiosk Webhooks (Offline/Completion Alerts)** | MISSING | None | None | None | None | No webhook dispatches for kiosk events | `K-ENT-003` |
| **Runtime Crash Recovery & Watchdog** | MISSING | None | None | None | None | Uncaught errors crash screen permanently | `K-REL-001` |
| **Comprehensive End-to-End Test Suite** | PARTIAL | `src/tests/feature-adoption-ui.test.tsx` | `server/src/tests/kiosk-*.test.ts` | Vitest test DB | 7 backend test suites | No browser E2E test verifying terminal flow | `K-VAL-001`, `K-VAL-002` |
