# Cross-Journey Workflow Dependency & State Transition Map

> **Document Status:** Authoritative Workflow Interdependency Specification  
> **Target System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Reference Specifications:** `docs/product/04-unified-onboarding-lifecycle.md`, `docs/product/09-unified-product-contract.md`

---

## 1. End-to-End Enterprise Onboarding Flow

The diagram below illustrates the sequential and event-driven dependencies connecting administrative authoring, system triggers, employee execution, manager sign-offs, and final HR handover:

```mermaid
flowchart TD
    subgraph Setup["Phase A: Administrative Blueprint & Rule Configuration"]
        ADM01["UJ-ADM-001: Author Journey Template"]
        ADM04["UJ-ADM-004: Configure Workflow Rules"]
        ADM06["UJ-ADM-006: Create Compliance Doc Template"]
        ADM01 --> ADM04
        ADM06 --> ADM01
    end

    subgraph Trigger["Phase B: Initiation & Automated Assignment"]
        ADM02["UJ-ADM-002: Invite / Create Employee"]
        SYS_TRIG["System Event: ON_USER_CREATED"]
        WFK_EVAL["Workflow Engine: Rule Resolution"]
        JRN_INIT["Instantiate JourneyInstance & Tasks"]
        
        ADM02 --> SYS_TRIG
        ADM04 -.->|Pre-configured| WFK_EVAL
        SYS_TRIG --> WFK_EVAL
        WFK_EVAL --> JRN_INIT
    end

    subgraph Employee_Execution["Phase C: Employee Onboarding Progression"]
        AUTH01["UJ-AUTH-001: Employee Login"]
        ONB01["UJ-ONB-001: View Roadmap (Active Phase)"]
        ONB02["UJ-ONB-002: Sign Mandatory Compliance Docs"]
        ONB03["UJ-ONB-003: Complete Personal Tasks"]
        ONB04["UJ-ONB-004: Watch Course & Video Lessons"]
        ONB05["UJ-ONB-005: Submit & Pass LMS Quizzes"]
        ONB06["UJ-ONB-006: Submit Day 30 Self-Rating"]
        
        JRN_INIT --> AUTH01
        AUTH01 --> ONB01
        ONB01 -->|Prerequisite Gating| ONB02
        ONB02 -->|Unlocks Phase 2| ONB03
        ONB03 -->|Unlocks Phase 3| ONB04
        ONB04 --> ONB05
        ONB05 -->|Unlocks Phase 4| ONB06
    end

    subgraph Operations["Phase D: Manager, Buddy & IT Provisioning"]
        IT01["UJ-IT-001: IT Hardware Setup Task"]
        BUD02["UJ-BUD-002: Buddy Check-in & Notes"]
        MGR02["UJ-MGR-002: Manager 30-Day Sign-off"]
        
        JRN_INIT -.->|Dispatches Tasks| IT01
        ONB01 -.->|Pairs Peer| BUD02
        ONB06 -->|Notifies Manager| MGR02
    end

    subgraph Handover["Phase E: Verification & Status Finalization"]
        ADM05["UJ-ADM-005: HR Ops Handover Verification"]
        ONB08["UJ-ONB-008: Issue Certificate & Transition to ACTIVE"]
        
        ONB02 --> ADM05
        ONB03 --> ADM05
        ONB05 --> ADM05
        MGR02 --> ADM05
        IT01 --> ADM05
        ADM05 --> ONB08
    end
```

---

## 2. Hard Gating & Prerequisite Rules

### Rule 1: Compliance Document Hard Gate (BR-SIG-001)
* **Upstream Journey:** `UJ-ONB-002: Mandatory Compliance Document E-Signature`
* **Downstream Journeys Blocked:**
  - `UJ-ONB-004: Complete LMS Course Lessons`
  - `UJ-ONB-005: Submit LMS Quizzes`
* **Enforcement:**
  - Frontend: `EmployeeDashboard.tsx` locks Phase 3 and renders warning alert if unsigned mandatory documents exist.
  - Backend: `assignment.service.ts` rejects `completeLesson` and `submitQuiz` with HTTP 400 (`COMPLIANCE_DOCUMENTS_PENDING`) if unsigned mandatory documents remain.

### Rule 2: Prerequisite Journey Step Lock (BR-JRN-001)
* **Upstream Journey:** Preceding step in `JourneyTemplate.steps` (`prerequisiteStepId`).
* **Downstream Journey Blocked:** Subsequent steps in `JourneyInstance`.
* **Enforcement:**
  - Frontend: `JourneyViewer` and `EmployeeDashboard` mark locked steps with padlock badges.
  - Backend: Step progression APIs verify `step.prerequisiteStepId.status == 'COMPLETED'`.

### Rule 3: Authoritative HR Handover Gate (BR-HND-001)
* **Upstream Journeys:**
  - `UJ-ONB-002` (All compliance documents signed)
  - `UJ-ONB-003` & `UJ-IT-001` (All tasks marked `COMPLETED` or `VERIFIED`)
  - `UJ-ONB-004` & `UJ-ONB-005` (All course lessons completed and quizzes passed)
  - `UJ-MGR-002` (Day 30 milestone evaluated and approved)
* **Downstream Journey Blocked:**
  - `UJ-ADM-005: HR Operations Handover Verification`
  - `UJ-ONB-008: Certificate Issuance & Profile Transition to ACTIVE`
* **Enforcement:**
  - Backend: `hr-operations.service.ts` queries tasks, document signatures, assignments, and milestones; returns HTTP 400 error listing exact blocking items if any remain open.

---

## 3. Kiosk Sub-System Lifecycle Flow

```mermaid
flowchart LR
    K1["UJ-ADM-001 / UJ-KSK-001: Admin Creates Kiosk Journey & Generates Pair Code"]
    --> K2["UJ-KSK-001: Physical Terminal Submits 6-Digit Code & Pairs Hardware GUID"]
    --> K3["UJ-KSK-004: Terminal Receives Device JWT & Sends Heartbeats"]
    --> K4["UJ-KSK-002: Worker Launches Touch SOP Player via Signed URL"]
    --> K5["UJ-KSK-003: Worker Completes SOP & PPE Confirmation"]
    --> K6["UJ-KSK-004: Terminal Bulk-Syncs Telemetry Analytics to Gateway"]
```
