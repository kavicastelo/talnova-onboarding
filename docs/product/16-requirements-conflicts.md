# 16 — Requirements Conflict Register

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative Conflict Register & Resolution Log  
> **Module Namespace:** System Core

---

## 1. Conflict Detection & Management Principles

In accordance with Rule 3 of the Master Consolidation Protocol, contradictory requirements between `v1.0.0` and `v2.0.0` are explicitly registered, analyzed, and resolved without silently discarding historical intent.

### Conflict Status Vocabulary
- `SUPERSEDED`: Explicit v2 specification officially replaces a baseline v1 requirement.
- `RESOLVED`: Contradiction resolved by defining explicit domain scoping boundaries (both behaviors coexist in distinct sub-domains).
- `UNRESOLVED`: Contradiction requires product-owner policy decision.
- `REQUIRES_PRODUCT_DECISION`: Business logic conflict awaiting stakeholder confirmation.

---

## 2. Requirements Conflict Register Table

| Conflict ID | v1 Reference | v2 Reference | Nature of Conflict | Business Impact | Resolution | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **C-001** | `01-system-overview.md` (JWT Auth) | `13-public-kiosk-journey-specification.md`, `PHASE-1` | Baseline v1 requires JWT login for all journeys. Kiosk spec requires unauthenticated access. | Security risk if kiosk URL is unauthenticated vs unusable kiosk if workers must log in. | **RESOLVED:** Kiosk operates as a specialized sub-domain (`kiosk`) using HMAC SHA-256 signed URLs (`sig`, timestamp, IP whitelist) without standard user password prompts. Standard onboarding retains strict JWT auth. | `RESOLVED` |
| **C-002** | `01-system-overview.md` (Checklists) | `PHASE-2-API-CONTRACT.md`, `task.service.ts` | Baseline v1 assumed checklists were completed solely by the new hire employee. v2 Phase 2 introduces cross-person task assignments (IT Admin, HR, Manager). | Workflow blockages if IT tasks appear in employee's task list without completion authority. | **SUPERSEDED:** Task engine expanded to support `assignedRole` and `responsiblePersonId`. Tasks are assigned to IT/HR/Manager actors before/during onboarding. | `SUPERSEDED` |
| **C-003** | `01-system-overview.md` (Architecture) | `PHASE-1-IMPLEMENTATION-REPORT.md`, `scheduler.service.ts` | v1 System Overview lists Redis/BullMQ as optional queue infrastructure. v2 Phase 1-19 implements in-process `node-cron` scheduler with MongoDB locking. | Infrastructure complexity vs background job reliability. | **RESOLVED:** `node-cron` with MongoDB state locking is the primary in-process scheduler for current release. Redis remains an architectural `RECOMMENDATION` for horizontal multi-instance scaling. | `RESOLVED` |
| **C-004** | `01-system-overview.md` (Assignments) | `PHASE-4-REQUIREMENT-STATUS.md`, `smart-assignment.service.ts` | v1 specified manual HR assignment of journeys. v2 introduces dynamic trigger-driven smart auto-assignment rules. | Potential duplicate assignments if dynamic rules collide with manual assignments. | **SUPERSEDED:** Dynamic smart assignment rules automatically assign journeys upon user creation, while retaining manual assignment UI as an administrative fallback. | `SUPERSEDED` |
| **C-005** | `01-system-overview.md` (Uploads) | `PHASE-6-IMPLEMENTATION-REPORT.md`, `document.service.ts` | v1 treated legal documents as static PDF file uploads. v2 introduces template authoring, canvas signing, and cryptographic PDF generation. | Legal compliance gaps if paper forms are uploaded without verifiable e-signatures. | **SUPERSEDED:** Digital Document & E-Signature engine replaces static file uploads with structured template dispatch, HTML5 canvas signature capture, and SHA-256 audit trails. | `SUPERSEDED` |

---

## 3. Conflict Resolution Detail Summaries

### 3.1 Conflict C-001: Kiosk Authentication Model
- **Context:** `01-system-overview.md` section "Security by Default" states that every API endpoint assumes JWT authentication. However, `13-public-kiosk-journey-specification.md` requires zero-auth execution for frontline workers.
- **Resolution Analysis:** Frontline factory workers wearing heavy PPE cannot log in using email/password credentials. Enforcing JWT login renders public kiosk displays unusable.
- **Authoritative Decision:** The system establishes an isolated `kiosk` module namespace (`/kiosk/*`). Access to public kiosk journeys is authorized via HMAC SHA-256 cryptographic URL signatures (`sig`), request expiration timestamps (`t`), and IP range whitelisting, satisfying both usability and security constraints.

### 3.2 Conflict C-002: Task Execution Responsibility
- **Context:** Baseline v1 defined onboarding checklists as learner-facing tasks. Phase 2 audit established that IT laptop provisioning, HR background checks, and manager equipment approvals must be completed by non-employee actors.
- **Resolution Analysis:** Forcing employees to mark IT setup tasks as complete compromises operational integrity.
- **Authoritative Decision:** The `OnboardingTask` model is updated with `assignedRole` and `responsiblePersonId` attributes. IT Administrators, HR Admins, and Managers possess dedicated task execution views.
