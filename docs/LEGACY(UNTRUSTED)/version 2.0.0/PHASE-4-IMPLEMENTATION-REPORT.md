# Phase 4 Implementation Report: Journey Automation & Smart Assignment

**Phase:** Phase 4 — Journey Automation & Smart Assignment  
**Status:** `COMPLETED`  
**Date:** 2026-08-19  
**Exit Criteria Gate:** `PASS`  

---

## 1. Executive Summary

Phase 4 extends Talnova Onboarding journeys from manually assigned static learning paths into rules-driven, smart auto-assigned onboarding programs (`JRN-001`, `JRN-002`, `JRN-003`, `JRN-004`, `JRN-007`). Admin users can configure multi-dimensional targeting rules (departments, job titles, locations, relative hire date offsets, auto-enrollment toggles, and reassignment policies), perform dry-run assignment previews, bulk execute smart auto-assignments across the organization, and automatically enroll new hires upon registration.

---

## 2. Technical Architecture & Architecture Implementation

### Backend Primitive Extensions
- **Journey Model Targeting Schema (`server/src/modules/journeys/models/journey.model.ts`):**
  - Extended `IAudience` interface and schema with `departmentNames`, `jobTitleNames`, `locations`, `employmentTypes`, `startDateOffsetDays`, `autoEnrollNewHires`, and `reassignmentPolicy` (`keep_progress` | `reset_progress` | `archive_previous`).
  - Extended `IUser.employment` interface in `server/src/modules/auth/models/user.model.ts` with `department` and `jobTitle`.
- **Smart Assignment Engine (`server/src/modules/journeys/services/smart-assignment.service.ts`):**
  - `findMatchingEmployees`: Dynamic evaluation engine matching active tenant users against journey audience targeting rules using case-insensitive regex pattern queries.
  - `previewSmartAssignment`: Dry-run statistics generator producing total matching count, already assigned count, net new count, and full employee breakdown.
  - `executeSmartAssignment`: Bulk executes smart journey auto-assignment to all unassigned matching employees in the organization.
  - `autoEnrollNewHire`: Event subscriber listener matching new hires against published auto-enrollment journeys upon `USER_CREATED` events.
- **REST Endpoints (`server/src/modules/journeys/routes/journey.routes.ts` & `journey.controller.ts`):**
  - `POST /api/v1/journeys/:id/assignment-preview`: Dry-run assignment preview.
  - `POST /api/v1/journeys/:id/smart-assign`: Bulk smart assignment execution.
  - `PATCH /api/v1/journeys/:id/targeting`: Target rule updates.
- **Event Bus Wiring (`server/src/infrastructure/events/event-subscribers.ts`):**
  - Connected `smartAssignmentService.autoEnrollNewHire` to `USER_CREATED` events.

### Frontend API Client & State Hooks
- **Services & Hooks (`src/services/journey.service.ts` & `src/hooks/useJourneys.ts`):**
  - Added `previewSmartAssignment`, `executeSmartAssignment`, `updateTargeting` service functions.
  - Added `useSmartAssignmentPreview`, `useExecuteSmartAssignment`, `useUpdateTargeting` React Query hooks.

---

## 3. Inventory of Changed Files

- `server/src/modules/journeys/models/journey.model.ts`: Extended `IAudience` interface and schema.
- `server/src/modules/auth/models/user.model.ts`: Extended `IUser.employment` interface with `department` and `jobTitle`.
- `server/src/modules/journeys/services/smart-assignment.service.ts`: Created `SmartAssignmentService`.
- `server/src/modules/journeys/schemas/journey.schema.ts`: Added Zod schemas for targeting & smart assignment.
- `server/src/modules/journeys/controllers/journey.controller.ts`: Added controller handlers for preview, bulk assign, and targeting.
- `server/src/modules/journeys/routes/journey.routes.ts`: Registered routes under `/api/v1/journeys`.
- `server/src/infrastructure/events/event-subscribers.ts`: Subscribed `autoEnrollNewHire` to `USER_CREATED`.
- `src/services/journey.service.ts`: Added smart assignment client methods.
- `src/hooks/useJourneys.ts`: Added React Query hooks.
- `server/src/tests/phase4-smart-assignment.test.ts`: Created Phase 4 test suite.

---

## 4. Verification Evidence

- **Phase 4 Smart Assignment Test Suite:** 6/6 tests PASSED.
- **Core Integration Test Suite:** 27/27 tests PASSED.
- **Backend Typecheck (`npx tsc --noEmit`):** 0 errors.
- **Frontend Typecheck (`npx tsc --noEmit`):** 0 errors.
- **Vite Production Build (`npm run build`):** Production bundle built in 5.00s.
