# Talnova Onboarding — User Journeys & Verification Architecture

> **Document Status:** Authoritative Journey & Role Verification Framework  
> **Target System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Source-of-Truth Hierarchy:** `docs/product/` → Code Implementation → Existing Audits (`docs/audits/current/`)

---

## 1. Purpose & Objectives

This directory constitutes the canonical catalog of all user roles, cross-role capability matrices, end-to-end user journeys, cross-journey dependency maps, and implementation audit verifications for the Talnova Onboarding platform.

The primary objective of this documentation and prompt library is to allow any AI software engineer, QA architect, or human auditor to deterministically answer:

> *"Who uses this application, what can each user do, what journeys can each user perform, and does the current application correctly support every journey?"*

---

## 2. Role Discovery Methodology

Roles and user personas within Talnova Onboarding were discovered and reconciled across two layers:

1. **Documented Roles (`docs/product/02-actors-and-roles.md`)**:
   - 8 canonical system personas: `SuperAdmin`, `Organization Owner`, `HR Administrator`, `Department / Team Manager`, `Employee / New Hire`, `Onboarding Buddy`, `IT / Ops Administrator`, and `Frontline Kiosk Operator`.
2. **Implemented System Roles (`server/src/modules/auth/models/user.model.ts` & `src/utils/rbac.ts`)**:
   - 5 core database roles: `super_admin`, `owner`, `admin`, `manager`, `employee`.
   - 1 frontend alias: `hr_admin` (maps to `admin` capabilities).
   - 2 specialized capability models:
     - **Buddy Mentorship**: Implemented as modular user pairing (`BuddyProfile`, `BuddyAssignment`) across existing user records.
     - **Kiosk Operator**: Implemented via unauthenticated touch displays, hardware pairing codes (`POST /api/v1/kiosk/devices/pair`), and HMAC-SHA256 signed URLs (`/api/v1/kiosk/journeys/play/:id?sig=...`).
     - **IT Administrator**: Handled via task classification (`category: "it_setup"`) and individual user assignment rather than a dedicated RBAC role.

Detailed classifications and gap analyses are documented in [roles.md](file:///d:/talnova/talnova-onboarding/docs/user-journeys/roles.md).

---

## 3. Journey Taxonomy & Prioritization

Every user journey represents an end-to-end user goal spanning multiple UI steps, network requests, authorization barriers, and state transitions.

Journeys are prioritized into four tiers:
* **`P0 — Critical Business / Security Journey`**: Core revenue, authentication, data isolation, and primary onboarding blockers (e.g. Login, Mandatory NDA E-Signature, Direct Report Sign-off).
* **`P1 — Core Business Journey`**: Essential day-to-day administrative and employee workflows (e.g. Journey Authoring, Quiz Submission, Milestone Evaluations, Buddy Check-ins).
* **`P2 — Important Supporting Journey`**: Platform configuration, compliance tracking, and operational automation (e.g. SSO Configuration, Bulk CSV Import, Kiosk Pairing, Handover Verification).
* **`P3 — Secondary / Edge Journey`**: Value-add and auxiliary features (e.g. Interactive Office Map, Gamification Leaderboards, Slideshow presentation mode).

---

## 4. Implementation Status Definitions

Every journey is categorized according to strict evidence standards:

| Status | Definition |
| :--- | :--- |
| **`IMPLEMENTED`** | Verified end-to-end across UI, API routes, controller logic, database mutations, and automated tests. |
| **`PARTIALLY_IMPLEMENTED`** | Core workflow exists, but specific features (e.g. third-party connectors, offline queue replay, or dedicated role guards) are mocked, simplified, or incomplete. |
| **`NOT_IMPLEMENTED`** | The capability is documented in `docs/product/` but possesses zero corresponding UI or API implementations. |
| **`BROKEN`** | The capability is present in code but fails during normal execution due to runtime exceptions, schema mismatches, or logic flaws. |
| **`BLOCKED`** | The journey cannot be tested due to external third-party infrastructure unavailability (e.g. real Okta SAML IdP or BambooHR production servers). |

---

## 5. Evidence Standards

Every claim regarding implementation status is backed by:
- Concrete repository file paths (e.g. `src/pages/...`, `server/src/modules/...`).
- Fastify route declarations and schema validations.
- React components, context hooks, and route guards.
- Automated Vitest test suite outcomes (27 test files, 252 tests passed).
- Existing forensic audit records (`docs/audits/current/`).

---

## 6. Directory Structure & Cross-References

```
docs/user-journeys/
├── README.md                     # This framework guide
├── roles.md                      # Role taxonomy & gap analysis
├── role-permission-matrix.md     # Granular RBAC matrix
├── dependency-map.md             # Cross-journey workflows & sequence triggers
├── journeys-index.md             # Master inventory of all journeys
├── authentication/               # UJ-AUTH-001 to UJ-AUTH-007
├── onboarding/                   # UJ-ONB-001 to UJ-ONB-009
├── administration/               # UJ-ADM-001 to UJ-ADM-012
├── manager/                      # UJ-MGR-001 to UJ-MGR-005
├── buddy/                        # UJ-BUD-001 to UJ-BUD-003
├── kiosk/                        # UJ-KSK-001 to UJ-KSK-004
├── super-admin/                  # UJ-SUP-001 to UJ-SUP-003
└── operations/                   # UJ-OPS-001 to UJ-OPS-003, UJ-KB-*, UJ-IT-001

prompts/user-journeys/
├── README.md                     # Prompt execution & verification guide
└── UJ-*.md                       # Deterministic test prompts for each journey

docs/audits/current/user-journeys/
└── UJ-*.md                       # Defect & gap audit reports
```
