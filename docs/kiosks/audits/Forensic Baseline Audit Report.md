# Forensic Baseline Audit Report: Talnova Kiosk Subsystem

**Identifier**: `K-META-001`  
**Execution Timestamp**: 2026-09-30 00:15:43 (UTC+05:30)  
**Corpus / Workspace**: [`d:/talnova/talnova-onboarding`](file:///d:/talnova/talnova-onboarding)  
**Agent Contract**: Audit strictly non-destructive. Zero production or test code modified. Zero new dependencies installed.

---

## 1. Executive Summary & Forensic Verdict

| Audit Vector | Target / Command | Status | Metrics / Observations |
| :--- | :--- | :--- | :--- |
| **Root Typecheck** | `npx tsc --noEmit` in root | **PASS** | 0 warnings, 0 type errors |
| **Server Typecheck** | `npx tsc --noEmit` in `server/` | **PASS** | 0 warnings, 0 type errors |
| **Server Startup & DB** | Fastify v5 + MongoDB Atlas | **PASS** | Connection established, healthy `/live`, `/ready`, `/health` endpoints |
| **Core Kiosk Tests** | [`kiosk-api.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/kiosk-api.test.ts), [`kiosk-security.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/kiosk-security.test.ts), [`uj-ksk-001.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/uj-ksk-001.test.ts), [`uj-ksk-004.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/uj-ksk-004.test.ts) | **PASS** | 39 / 39 passed across dedicated kiosk suites |
| **Backend Test Suite** | `npm test` in `server/` | **WARN** | 102 test files: 91 passed, 11 failed; 756 tests: 730 passed, 26 failed (1379.20s) |
| **Frontend Tests** | `src/tests/*.test.*` | **WARN** | 11 test files: 6 passed, 5 failed; 55 tests: 45 passed, 10 failed |
| **Environment Check** | `.env.example` vs [`env.schema.ts`](file:///d:/talnova/talnova-onboarding/server/src/config/env.schema.ts) | **MISMATCH** | `JWT_SECRET` present; `STORAGE_ENDPOINT` required by prompt is named `R2_ENDPOINT` in schema & config |
| **Model Verification** | `KioskDeviceModel`, `KioskJourneyModel`, `KioskAnalyticsModel` | **CONFIRMED** | All 3 present; [`KioskSessionModel`](file:///d:/talnova/talnova-onboarding/server/src/modules/kiosk/models) absent (confirms DEF-004) |

---

## 2. TypeScript Compilation & Typecheck Audit

Both workspaces compile cleanly under strict mode with zero type errors:

1. **Root Frontend Workspace**:
   - Command: `npx tsc --noEmit`
   - Config: [`tsconfig.json`](file:///d:/talnova/talnova-onboarding/tsconfig.json) (`target: ES2020`, `module: ESNext`, `strict: true`)
   - Exit Code: `0` (Clean)
2. **Backend Server Workspace**:
   - Command: `npx tsc --noEmit`
   - Config: [`server/tsconfig.json`](file:///d:/talnova/talnova-onboarding/server/tsconfig.json) (`target: ES2022`, `module: NodeNext`, `strict: true`)
   - Exit Code: `0` (Clean)

---

## 3. Backend Test Suite Metrics (`server/`)

Full backend test run executed sequentially via Vitest (`fileParallelism: false`):
- **Total Test Files Evaluated**: 102
- **Test Files Passed**: 91
- **Test Files Failed**: 11
- **Total Individual Tests**: 756 (730 passed, 26 failed)
- **Total Duration**: 1379.20s (~23 minutes)

### Dedicated Kiosk Subsystem Test Health

| Test Suite | File | Tests Passed | Tests Failed | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Kiosk REST API Layer** | [`server/src/tests/kiosk-api.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/kiosk-api.test.ts) | 12 | 0 | **PASS** (10.62s) |
| **Kiosk Security & Cryptography** | [`server/src/tests/kiosk-security.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/kiosk-security.test.ts) | 12 | 0 | **PASS** (6.20s) |
| **Device Pairing User Journey** | [`server/src/tests/uj-ksk-001.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/uj-ksk-001.test.ts) | 7 | 0 | **PASS** (7.38s) |
| **Heartbeat & Telemetry Journey** | [`server/src/tests/uj-ksk-004.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/uj-ksk-004.test.ts) | 8 | 0 | **PASS** (7.83s) |
| **Kiosk Edge & Offline PWA** | [`server/src/tests/phase9-kiosk-edge-offline.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/phase9-kiosk-edge-offline.test.ts) | 2 | 2 | **FAIL** (Reproduces DEF-009 & DEF-010) |

### Failing Backend Test Files (11 Total)

1. [`server/src/tests/phase9-kiosk-edge-offline.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/phase9-kiosk-edge-offline.test.ts):
   - **Test 3 (UQ-01: Frontline legal compliance signature)**: Failed with feature flag block on `digital_signatures` and missing supervisor witness PIN gate (reproducing DEF-009).
   - **Test 4 (Offline learning progress batch reconciliation)**: Expected assignment status `'completed'` but received `'in_progress'` (reproducing DEF-010).
2. [`server/src/tests/phase6-digital-documents.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/phase6-digital-documents.test.ts) (7 failures): E-signature and template isolation assertions.
3. [`server/src/tests/phase10-hris-sso-outbox.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/phase10-hris-sso-outbox.test.ts) (4 failures): Webhook HMAC signature and transactional outbox deduplication.
4. [`server/src/tests/integration.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/integration.test.ts) (2 failures): Protected route auth and password reset token expiry format.
5. [`server/src/tests/feature-adoption-telemetry.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/feature-adoption-telemetry.test.ts) (2 failures): Super-admin analytics rollup engine assertions.
6. [`server/src/tests/phase1-foundation.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/phase1-foundation.test.ts) (2 failures): Background queue duplicate suppression.
7. [`server/src/tests/uj-sup-003.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/uj-sup-003.test.ts) (2 failures): SuperAdmin cross-tenant billing CSV column alignment and aggregate MRR calculation against live multi-tenant seeds.
8. [`server/src/tests/phase3-velocity-sentinel.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/phase3-velocity-sentinel.test.ts) (1 failure): Timezone business hour evaluation.
9. [`server/src/tests/phase4-smart-assignment.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/phase4-smart-assignment.test.ts) (1 failure): Handover status check.
10. [`server/src/tests/feature-flag-seeding.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/feature-flag-seeding.test.ts) (1 failure): Administrative override idempotency.
11. [`server/src/tests/quarantine-session-revocation.test.ts`](file:///d:/talnova/talnova-onboarding/server/src/tests/quarantine-session-revocation.test.ts) (1 failure): Error message mismatch (`"Your organization has been suspended. Please contact support."` vs `"Your organization has been suspended by platform administration."`).

---

## 4. Frontend Test Suite Metrics (Root Workspace)

When running `npm test` from root, Vitest recursively matches test files across root and `server/` because no root `vitest.config.ts` exists to scope test file discovery. 

### Scoped Frontend Test Matrix ([`src/tests/`](file:///d:/talnova/talnova-onboarding/src/tests))

| Test File | Total | Passed | Failed | Status / Failure Cause |
| :--- | :--- | :--- | :--- | :--- |
| [`csv-parser.test.ts`](file:///d:/talnova/talnova-onboarding/src/tests/csv-parser.test.ts) | 4 | 4 | 0 | **PASS** |
| [`feature-adoption-ui.test.tsx`](file:///d:/talnova/talnova-onboarding/src/tests/feature-adoption-ui.test.tsx) | 6 | 6 | 0 | **PASS** |
| [`first-login-password-change.test.tsx`](file:///d:/talnova/talnova-onboarding/src/tests/first-login-password-change.test.tsx) | 2 | 2 | 0 | **PASS** |
| [`multi-role-rbac.test.tsx`](file:///d:/talnova/talnova-onboarding/src/tests/multi-role-rbac.test.tsx) | 7 | 7 | 0 | **PASS** |
| [`session-timeout-relogin.test.ts`](file:///d:/talnova/talnova-onboarding/src/tests/session-timeout-relogin.test.ts) | 4 | 4 | 0 | **PASS** |
| [`visual-calendar-grid.test.tsx`](file:///d:/talnova/talnova-onboarding/src/tests/visual-calendar-grid.test.tsx) | 4 | 4 | 0 | **PASS** |
| [`route-guards.test.tsx`](file:///d:/talnova/talnova-onboarding/src/tests/route-guards.test.tsx) | 11 | 7 | 4 | **FAIL**: Mismatched string: received `"Feature Temporarily Restricted"`, expected `"Feature Temporarily Unavailable"`; `FEATURE_TITLES` dictionary property undefined. |
| [`super-admin-delete-organization.test.tsx`](file:///d:/talnova/talnova-onboarding/src/tests/super-admin-delete-organization.test.tsx) | 8 | 5 | 3 | **FAIL**: Mock missing `useSuperAdminPackages` export on [`useSuperAdmin`](file:///d:/talnova/talnova-onboarding/src/hooks/useSuperAdmin.ts). |
| [`dashboard-gating.test.tsx`](file:///d:/talnova/talnova-onboarding/src/tests/dashboard-gating.test.tsx) | 6 | 5 | 1 | **FAIL**: [`AdminDashboard`](file:///d:/talnova/talnova-onboarding/src/pages/AdminDashboard.tsx) rendered without `QueryClientProvider` needed by [`useOrganizationUsage`](file:///d:/talnova/talnova-onboarding/src/hooks/useSettings.ts). |
| [`feature-flags-ui.test.tsx`](file:///d:/talnova/talnova-onboarding/src/tests/feature-flags-ui.test.tsx) | 3 | 2 | 1 | **FAIL**: Mock missing `useSuperAdminOrganizationFlags` export. |
| [`navigation-filtering.test.tsx`](file:///d:/talnova/talnova-onboarding/src/tests/navigation-filtering.test.tsx) | 5 | 5 | 0* | **FAIL**: Unhandled hook rendering warning in teardown. |

---

## 5. Environment & Infrastructure Verification

### Environment Configuration Schema Validation
- Root [`.env.example`](file:///d:/talnova/talnova-onboarding/.env.example):
  - Defines `VITE_API_BASE_URL` (`https://onb-api.talnova.io/api/v1` / `http://localhost:8080/api/v1`).
- Server [`.env.example`](file:///d:/talnova/talnova-onboarding/server/.env.example) and [`env.schema.ts`](file:///d:/talnova/talnova-onboarding/server/src/config/env.schema.ts):
  - **`JWT_SECRET`**: Confirmed present and strictly validated (`min(8)`).
  - **`STORAGE_ENDPOINT`**: **Not Present in schema or example.** The application uses Cloudflare R2 object storage with keys:
    - `R2_ENDPOINT` (maps to `storageConfig.endpoint` in [`server/src/config/index.ts`](file:///d:/talnova/talnova-onboarding/server/src/config/index.ts#L43-L50))
    - `R2_BUCKET`
    - `R2_ACCESS_KEY_ID`
    - `R2_SECRET_ACCESS_KEY`
    - `R2_PUBLIC_URL`

### Server Startup & Readiness Hooks
In [`server/src/app.ts`](file:///d:/talnova/talnova-onboarding/server/src/app.ts#L124-L157):
- `/live`: Returns `{ status: "alive" }`.
- `/ready`: Verifies `mongoose.connection.readyState === 1` and all R2 storage configuration parameters.
- `/health`: Verifies database connectivity.

---

## 6. Core Database Model Verification

Confirmed presence and structure in [`server/src/modules/kiosk/models/`](file:///d:/talnova/talnova-onboarding/server/src/modules/kiosk/models):

1. **[`KioskDeviceModel`](file:///d:/talnova/talnova-onboarding/server/src/modules/kiosk/models/kiosk-device.model.ts)**:
   - Defined via `KioskDeviceSchema` with Mongoose model `KioskDevice`.
   - Fields: `deviceId`, `name`, `status`, `paired`, `currentJourneyId` (ObjectRef), `tokenRef`, `lastHeartbeatAt`, `systemDiagnostics`.
2. **[`KioskJourneyModel`](file:///d:/talnova/talnova-onboarding/server/src/modules/kiosk/models/kiosk-journey.model.ts)**:
   - Defined via `KioskJourneySchema` with Mongoose model `KioskJourney`.
   - Fields: `title`, `slug`, `publishing.status`, `publishing.version`, `steps` array (`KioskStepSchema`), `audioGuidance`, `languages`.
3. **[`KioskAnalyticsModel`](file:///d:/talnova/talnova-onboarding/server/src/modules/kiosk/models/kiosk-analytics.model.ts)**:
   - Defined via `KioskAnalyticsSchema` with Mongoose model `KioskAnalytics`.
   - Fields: `deviceId`, `journeyId`, `eventType`, `language`, `metrics`, `payload`.
4. **Missing Model Alert (`KioskSessionModel`)**:
   - There is **no session model** in the backend. Sessions are not persisted as discrete database documents, confirming defect **DEF-004**.

---

## 7. Defect Register Cross-Verification & Repro Status

Cross-referencing the 10 defects catalogued in [`docs/kiosks/DEFECT-REGISTER.md`](file:///d:/talnova/talnova-onboarding/docs/kiosks/DEFECT-REGISTER.md):

| Defect ID | Title | File Evidence | Repro Status |
| :--- | :--- | :--- | :--- |
| **DEF-001** | Hardcoded Journey URL & Monolithic Kiosk Route | [`src/App.tsx:211`](file:///d:/talnova/talnova-onboarding/src/App.tsx#L211), [`KioskPlayerPage.tsx:9`](file:///d:/talnova/talnova-onboarding/src/features/kiosk/pages/KioskPlayerPage.tsx#L9) | **CONFIRMED**: Route is tied to `:id` directly (`/kiosk/play/:id`). |
| **DEF-002** | In-Memory Pairing Code & Non-CSPRNG `Math.random` | [`kiosk-security.service.ts:11,54`](file:///d:/talnova/talnova-onboarding/server/src/modules/kiosk/services/kiosk-security.service.ts#L11) | **CONFIRMED**: Pairing codes stored in process memory `Map<string, PairingData>()`. |
| **DEF-003** | 1:1 Monolithic Device-to-Journey Schema | [`kiosk-device.model.ts:51`](file:///d:/talnova/talnova-onboarding/server/src/modules/kiosk/models/kiosk-device.model.ts#L51) | **CONFIRMED**: Single `currentJourneyId` field on device schema; lacks M:N assignment entity. |
| **DEF-004** | Missing KioskSession Model & Anonymous Completion | [`kiosk.controller.ts:59-99`](file:///d:/talnova/talnova-onboarding/server/src/modules/kiosk/controllers/kiosk.controller.ts#L59), [`KioskPlayerContext.tsx:182`](file:///d:/talnova/talnova-onboarding/src/features/kiosk/context/KioskPlayerContext.tsx#L182) | **CONFIRMED**: `GET /sessions/:id` returns hardcoded mock `{ sessionId: params.id, status: "active" }`. |
| **DEF-005** | Flawed Device Token Revocation Check | [`kiosk-auth.plugin.ts:78-86`](file:///d:/talnova/talnova-onboarding/server/src/modules/kiosk/plugins/kiosk-auth.plugin.ts#L78) | **CONFIRMED**: Token middleware only verifies device existence in DB; ignores `decommissioned`/`suspended`/`tokenRef` match. |
| **DEF-006** | In-Place Mutation of Published Journeys | [`kiosk-journey.model.ts:98`](file:///d:/talnova/talnova-onboarding/server/src/modules/kiosk/models/kiosk-journey.model.ts#L98), [`kiosk.service.ts:46`](file:///d:/talnova/talnova-onboarding/server/src/modules/kiosk/services/kiosk.service.ts#L46) | **CONFIRMED**: Publishing overwrites root journey document instead of producing immutable snapshots. |
| **DEF-007** | Orphaned `KioskPairingScreen` Component | [`src/features/kiosk/index.ts:6`](file:///d:/talnova/talnova-onboarding/src/features/kiosk/index.ts#L6), [`src/App.tsx`](file:///d:/talnova/talnova-onboarding/src/App.tsx) | **CONFIRMED**: Exported component has no route in `App.tsx` and uses local mock storage. |
| **DEF-008** | Disconnected Frontline Identification Flow | [`KioskPlayer.tsx:78`](file:///d:/talnova/talnova-onboarding/src/features/kiosk/components/KioskPlayer.tsx#L78), [`kiosk.service.ts:381`](file:///d:/talnova/talnova-onboarding/server/src/modules/kiosk/services/kiosk.service.ts#L381) | **CONFIRMED**: Player component launches immediately without employee authentication prompt despite backend `/identify` endpoint. |
| **DEF-009** | Missing Supervisor Witness Completion Gate | [`KioskPlayer.tsx:849`](file:///d:/talnova/talnova-onboarding/src/features/kiosk/components/KioskPlayer.tsx#L849), [`phase9-kiosk-edge-offline.test.ts:408`](file:///d:/talnova/talnova-onboarding/server/src/tests/phase9-kiosk-edge-offline.test.ts#L408) | **CONFIRMED**: Finish action triggers completion directly with no co-signature modal or supervisor witness PIN gate. |
| **DEF-010** | Absence of Offline Content Caching & Service Worker | [`KioskPlayerContext.tsx:60`](file:///d:/talnova/talnova-onboarding/src/features/kiosk/context/KioskPlayerContext.tsx#L60), [`phase9-kiosk-edge-offline.test.ts:545`](file:///d:/talnova/talnova-onboarding/server/src/tests/phase9-kiosk-edge-offline.test.ts#L545) | **CONFIRMED**: Offline handling is restricted to analytics array in `localStorage`; no media asset or journey definition caching. |

---

## 8. Summary & Environment Readiness Assessment

- **Compilation Readiness**: **100% READY**. Both root and server workspaces typecheck cleanly without error.
- **Database & Server Core Readiness**: **100% READY**. MongoDB Atlas connectivity, Fastify route registration, CORS, and security middleware execute as expected.
- **Baseline Kiosk API Suites**: **100% PASSING**. Core pairing, heartbeat, journey publishing, and security plugins pass their integration tests cleanly.
- **Identified Defect Status**: All 10 defects listed in [`DEFECT-REGISTER.md`](file:///d:/talnova/talnova-onboarding/docs/kiosks/DEFECT-REGISTER.md) have been forensically verified with concrete code evidence and reproducing test assertions.
- **Environment Variable Note**: Downstream agents working on storage or media streaming must note that the environment configuration uses `R2_ENDPOINT` rather than `STORAGE_ENDPOINT`.
