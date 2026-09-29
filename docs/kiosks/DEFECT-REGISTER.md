# Kiosk Subsystem Defect Register

This register catalogues all confirmed defects, architectural deficiencies, and security vulnerabilities identified during deep forensic analysis of the existing codebase. Every defect is substantiated by direct file and line evidence.

---

## DEF-001: Hardcoded Journey URL & Monolithic Kiosk Route

- **ID**: DEF-001
- **Severity**: CRITICAL
- **Area**: Frontend Routing & Player Lifecycle
- **Current Behavior**: The kiosk player is mounted at `/kiosk/play/:id` in `src/App.tsx`, where `:id` is a specific journey ID. Physical terminals bookmark this exact route. If the journey changes, is updated, or if an organization has multiple journeys, the device cannot display anything else without URL modification.
- **Expected Behavior**: Kiosk terminals must have a permanent, journey-independent URL (e.g., `/kiosk/terminal` or `/kiosk/device/:deviceId`). The terminal loads its assigned journey manifest from the backend and presents a multi-journey home screen launcher.
- **Evidence**:
  - `src/App.tsx` line 211: `<Route path="/kiosk/play/:id" element={<KioskPlayerPage />} />`
  - `src/features/kiosk/pages/KioskPlayerPage.tsx` lines 9-39: extracts `useParams<{ id: string }>()` and passes `journeyId={id}` directly to `KioskPlayer`.
  - `server/src/modules/kiosk/routes/kiosk.routes.ts` lines 39-46: `GET /journeys/play/:id` routes strictly by journey ID.
- **Root Cause**: Early prototype design assumed a kiosk was synonymous with a single training reel.
- **Related Requirement**: Spec Sections 1, 19, 70, 71, 126, 127, 161, 162.
- **Related Prompt**: `K-DEV-001`, `K-RUN-001`, `K-RUN-002`
- **Regression Risk**: HIGH. Modifying routes requires updating admin share links, test harnesses, and player entry points.

---

## DEF-002: In-Memory Pairing Code Storage & Non-Cryptographic Random Generation

- **ID**: DEF-002
- **Severity**: HIGH
- **Area**: Backend Security & Device Pairing
- **Current Behavior**: `KioskSecurityService` generates 6-digit numeric pairing codes using `Math.floor(100000 + Math.random() * 900000)` and stores them in an in-memory `Map<string, PairingData>()`. Any server restart, process recycle, or horizontal multi-instance scaling wipes all pairing codes, immediately breaking in-flight physical device setups. Furthermore, `Math.random()` is not a cryptographically secure pseudorandom number generator (CSPRNG).
- **Expected Behavior**: Pairing codes must be generated using `crypto.randomInt(100000, 1000000)` and stored in a durable datastore (MongoDB collection `KioskPairingCode` with TTL index or Redis) scoped by `organizationId`, with single-use atomic consumption and rate-limiting against brute force.
- **Evidence**:
  - `server/src/modules/kiosk/services/kiosk-security.service.ts` line 11: `private pairingCodes = new Map<string, PairingData>();`
  - `server/src/modules/kiosk/services/kiosk-security.service.ts` lines 54-56: `code = Math.floor(100000 + Math.random() * 900000).toString();`
  - `server/src/modules/kiosk/services/kiosk-security.service.ts` lines 59-63: `this.pairingCodes.set(...)`
- **Root Cause**: Temporary mock implementation left in production service.
- **Related Requirement**: Spec Sections 10, 52, 128.
- **Related Prompt**: `K-DEV-002`, `K-SEC-002`
- **Regression Risk**: LOW to MEDIUM. Refactoring to a Mongoose model or TTL collection requires a schema addition and database migration.

---

## DEF-003: 1:1 Monolithic Device-to-Journey Database Schema

- **ID**: DEF-003
- **Severity**: HIGH
- **Area**: Database Architecture & Fleet Management
- **Current Behavior**: `KioskDeviceSchema` defines a single reference field `currentJourneyId: { type: Schema.Types.ObjectId, ref: "KioskJourney" }`. The pairing API endpoint `POST /api/v1/kiosk/devices/:id/pair-journey` accepts only a single `journeyId`. It is structurally impossible to assign multiple journeys, journey categories, or scheduling rules to a device.
- **Expected Behavior**: A dedicated `KioskDeviceAssignment` collection must model M:N relationships between devices and journeys, supporting assignment types (direct, group, department, site), priority ordering, and scheduling windows.
- **Evidence**:
  - `server/src/modules/kiosk/models/kiosk-device.model.ts` line 51: `currentJourneyId: { type: Schema.Types.ObjectId, ref: "KioskJourney" }`
  - `server/src/modules/kiosk/repositories/kiosk-device.repository.ts` lines 107-120: `pairJourney(id, journeyId)` sets single `currentJourneyId`.
  - `src/pages/KioskDashboard.tsx` line 76: `const [pairJourneyId, setPairJourneyId] = useState<string>('')` links only one journey.
- **Root Cause**: Premature architectural simplification ignoring multi-journey enterprise requirements.
- **Related Requirement**: Spec Sections 1, 12, 13, 72, 73, 100, 161.
- **Related Prompt**: `K-FND-002`, `K-ASN-001`, `K-ASN-002`
- **Regression Risk**: HIGH. Schema migration needed to preserve existing single-journey pairings as initial records in the new assignment collection.

---

## DEF-004: Missing KioskSession Model & Anonymous Unverified Completion

- **ID**: DEF-004
- **Severity**: CRITICAL
- **Area**: Core Domain, Employee Identity & Compliance Integrity
- **Current Behavior**: There is NO `KioskSession` entity in the backend database. `completeSession` in `KioskPlayerContext.tsx` simply dispatches an anonymous analytics record to `/api/v1/kiosk/analytics/sync` containing `completedCount: 1`. An employee's training record in the enterprise LMS/HRIS is never updated, no tamper-proof cryptographic audit trail is stored, and the controller endpoint `GET /api/v1/kiosk/sessions/:id` returns a mock stub `{ sessionId: params.id, status: "active" }`.
- **Expected Behavior**: A dedicated `KioskSession` model must track each journey attempt with states (`active`, `awaiting_supervisor`, `completed`, `aborted`, `timed_out`). When completed, the server must validate step progression, verify mandatory holds/quizzes, record the employee's `userId`, compute a SHA-256 integrity hash, issue a verifiable completion certificate, and update employee onboarding records.
- **Evidence**:
  - `server/src/modules/kiosk/models/` contains only `kiosk-device`, `kiosk-journey`, and `kiosk-analytics`.
  - `server/src/modules/kiosk/controllers/kiosk.controller.ts` lines 59-99: `getSession` returns hardcoded `{ sessionId: params.id, status: "active" }`.
  - `src/features/kiosk/context/KioskPlayerContext.tsx` lines 182-205: `completeSession` only buffers anonymous metrics in localStorage or sends them to analytics sync.
- **Root Cause**: Incomplete implementation of enterprise compliance tracking.
- **Related Requirement**: Spec Sections 1, 17, 18, 41, 91, 99, 107, 156.
- **Related Prompt**: `K-FND-003`, `K-EMP-002`, `K-CMP-001`, `K-CMP-002`
- **Regression Risk**: HIGH. Fundamental domain expansion affecting session lifecycle, player frontend, and compliance analytics.

---

## DEF-005: Flawed Device Token Revocation Check in Authentication Plugin

- **ID**: DEF-005
- **Severity**: HIGH
- **Area**: Backend Security & Zero Trust Architecture
- **Current Behavior**: `verifyDeviceToken` middleware validates the JWT bearer token and executes `KioskDeviceModel.findOne({ deviceId: payload.deviceId, organizationId: payload.organizationId })`. If the device record is found in the database, access is granted. The middleware DOES NOT check if `device.status === 'decommissioned'`, `device.status === 'suspended'`, `device.paired === false`, or if `tokenRef` matches the current active token.
- **Expected Behavior**: The middleware must assert that `device.status === 'online' || device.status === 'maintenance'`, `device.paired === true`, `device.isRevoked === false`, and that the token hash matches `device.tokenRef`. Decommissioned or stolen devices must be immediately rejected with `401 UNAUTHORIZED / DEVICE_REVOKED`.
- **Evidence**:
  - `server/src/modules/kiosk/plugins/kiosk-auth.plugin.ts` lines 78-86:
    ```typescript
    const device = await KioskDeviceModel.findOne({
      deviceId: payload.deviceId,
      organizationId: payload.organizationId
    });
    if (!device) {
      throw new AppError(401, "UNAUTHORIZED", "Device registration has been revoked or suspended.");
    }
    ```
- **Root Cause**: Incomplete authorization boundary validation.
- **Related Requirement**: Spec Sections 11, 53, 54, 153.
- **Related Prompt**: `K-SEC-001`, `K-DEV-004`
- **Regression Risk**: LOW. Tightening authorization checks on existing endpoints without changing payload formats.

---

## DEF-006: In-Place Mutation of Published Journeys (Lack of Immutability)

- **ID**: DEF-006
- **Severity**: HIGH
- **Area**: Journey Versioning & Content Governance
- **Current Behavior**: When an administrator saves draft edits in `KioskBuilder`, changes are written directly to `KioskJourneyModel`. While `publishJourney` increments `publishing.version: number`, the actual steps and settings in the single MongoDB document are overwritten. Any terminal currently running the journey immediately receives mutated content on refresh or step load, breaking live sessions and invalidating historical compliance audits.
- **Expected Behavior**: Published journey versions must be immutable snapshots stored in a `KioskJourneyVersion` collection. The main `KioskJourney` document serves as the draft/staging workspace. When published, an immutable version is minted. Running sessions stay locked to their starting version.
- **Evidence**:
  - `server/src/modules/kiosk/models/kiosk-journey.model.ts` lines 98-109: only stores a scalar `version: Number` on the main journey document.
  - `server/src/modules/kiosk/services/kiosk.service.ts` lines 46-56: `updateJourney` directly updates the document in-place.
- **Root Cause**: Architectural debt from standard CMS pattern not adapted for safety/compliance auditing.
- **Related Requirement**: Spec Sections 3, 37, 98, 155, 161, 162.
- **Related Prompt**: `K-JRN-001`, `K-JRN-002`, `K-CMP-001`
- **Regression Risk**: MEDIUM. Requires version snapshot creation during the publish pipeline and version-pinned read endpoints.

---

## DEF-007: Orphaned KioskPairingScreen Component (Missing Route & Hardware Handshake)

- **ID**: DEF-007
- **Severity**: MEDIUM
- **Area**: Frontend Hardware Setup
- **Current Behavior**: `KioskPairingScreen.tsx` exists in `src/features/kiosk/components/`, has a sleek numeric keypad UI, and generates a random hardware ID in `localStorage`. However, it is never routed in `src/App.tsx` and has no entry point in the application. Furthermore, it creates a random ID in `localStorage` rather than performing a standard device discovery or enrollment workflow.
- **Expected Behavior**: A dedicated route (e.g., `/kiosk/pair` or integrated terminal startup check) must mount the pairing screen whenever a physical terminal is unbonded. Upon successful code verification, the server issues a long-lived device token, which is persisted in secure storage.
- **Evidence**:
  - `src/features/kiosk/index.ts` line 6: exports `KioskPairingScreen`.
  - `src/App.tsx`: contains no `<Route path="/kiosk/pair" ... />` or reference to `KioskPairingScreen`.
- **Root Cause**: Feature component was built but never integrated into the application routing tree.
- **Related Requirement**: Spec Sections 10, 70, 128.
- **Related Prompt**: `K-DEV-002`, `K-RUN-001`
- **Regression Risk**: LOW. Adding a route does not affect existing pages.

---

## DEF-008: Disconnected Frontline Worker Identification Flow

- **ID**: DEF-008
- **Severity**: HIGH
- **Area**: Player UI & Identity Integration
- **Current Behavior**: The backend implements `identifyFrontlineWorker` in `server/src/modules/kiosk/services/kiosk.service.ts` (lines 381-452) and exposes `POST /api/v1/kiosk/identify`. However, `KioskPlayer.tsx` and `KioskPlayerPage.tsx` NEVER invoke this endpoint. The player launches directly into the journey anonymously without prompting the frontline worker for a badge, employee ID, or access code.
- **Expected Behavior**: When a journey requires employee identification (or when in mixed/employee mode), the player must present a high-contrast identification screen (Badge scan, ID entry, QR code). Only after receiving an ephemeral session token does the player proceed to journey content.
- **Evidence**:
  - `src/features/kiosk/components/KioskPlayer.tsx` lines 78-89: directly executes `loadJourney` and `startSession` with zero employee authentication prompts.
  - `src/features/kiosk/context/KioskPlayerContext.tsx` lines 152-161: `startSession` creates a session with no `userId` or `employeeId`.
- **Root Cause**: Backend endpoint was developed under a separate task but was never wired into the player UX.
- **Related Requirement**: Spec Sections 2.2, 14, 15, 16, 17, 71.
- **Related Prompt**: `K-EMP-001`, `K-EMP-002`, `K-RUN-002`
- **Regression Risk**: MEDIUM. Requires conditional display in `KioskPlayer` based on journey settings.

---

## DEF-009: Missing Supervisor Verification Completion Gate in Player

- **ID**: DEF-009
- **Severity**: HIGH
- **Area**: Player UX & Supervisor Witnessing
- **Current Behavior**: The backend exposes `POST /api/v1/kiosk/supervisor/verify-pin` and the admin portal allows configuring supervisor PINs in `src/pages/KioskDashboard.tsx`. However, in `KioskPlayer.tsx`, if a step requires supervisor verification, there is no UI component or modal for the supervisor to enter their credentials. An employee can simply tap "Finish" or proceed through the step.
- **Expected Behavior**: When a step or completion gate requires supervisor verification (`supervisor_witness_required: true`), navigation must be locked. A dedicated supervisor PIN overlay must appear, accept supervisor credentials, call the verification API, record supervisor attestation on the session, and only then unlock completion.
- **Evidence**:
  - `src/features/kiosk/components/KioskPlayer.tsx` lines 849-866: finish button directly calls `completeSession()` without supervisor validation.
  - `src/features/kiosk/components/KioskPinOverlay.tsx`: only validates journey exit/unlock PIN, NOT supervisor witness co-signature.
- **Root Cause**: Partial implementation of the supervisor witness capability.
- **Related Requirement**: Spec Sections 2.4, 24, 25, 137.
- **Related Prompt**: `K-SUP-001`, `K-SUP-002`
- **Regression Risk**: MEDIUM. Affects step progression state machine in `KioskPlayer`.

---

## DEF-010: Absence of Offline Content Caching & Service Worker

- **ID**: DEF-010
- **Severity**: HIGH
- **Area**: Offline Resilience & Field Reliability
- **Current Behavior**: In `KioskPlayerContext.tsx`, offline support is restricted to queuing analytics events in `localStorage`. If the network disconnects, the terminal cannot load journey steps, cannot stream or play media (video/audio/images), and crashes on page refresh or navigation with network errors.
- **Expected Behavior**: A dedicated Kiosk Service Worker and IndexedDB storage subsystem must cache assigned journey definitions, localized text bundles, and media assets. When offline, the player smoothly loads cached assets and queues completed sessions for later synchronization.
- **Evidence**:
  - `src/features/kiosk/context/KioskPlayerContext.tsx` lines 60-80: only manages `kiosk_offline_analytics` in `localStorage`.
  - `src/features/kiosk/components/KioskPlayer.tsx` lines 136-150: fetches audio and video directly over network `/api/v1/kiosk/uploads/:id` with no offline fallback.
- **Root Cause**: Offline requirements were only partially addressed at the analytics telemetry layer.
- **Related Requirement**: Spec Sections 25, 30, 31, 65, 102, 152.
- **Related Prompt**: `K-OFF-001`, `K-OFF-002`
- **Regression Risk**: MEDIUM to HIGH. Service worker caching must be scoped strictly to kiosk assets to avoid stale caching across the main admin portal.
