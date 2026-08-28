# 15 — Feature Dependency Map

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative Feature & Domain Dependency Specification  
> **Module Namespace:** System Core

---

## 1. High-Level Domain Dependency Graph

```mermaid
graph TD
    D1["Domain 01: Core Platform & Auth"] --> D2["Domain 02: Journeys & Content"]
    D1 --> D3["Domain 03: Task & Workflows"]
    D1 --> D5["Domain 05: Enablement & E-Sign"]
    
    D2 --> D4["Domain 04: Manager & HR Ops"]
    D3 --> D4
    D5 --> D4
    
    D1 & D2 --> D6["Domain 06: Integrations & AI"]
    D1 & D2 & D3 --> D7["Domain 07: Mobile, Map & Kiosk"]
```

---

## 2. Feature-Level Dependency Graph

```mermaid
graph TD
    FEAT_AUTH["FEAT-AUTH-01: Multi-Tenant Auth"] --> FEAT_ORG["FEAT-ORG-01: Workspace Management"]
    FEAT_ORG --> FEAT_EMP["FEAT-EMP-01: Employee Directory"]
    
    FEAT_ORG --> FEAT_JRN["FEAT-JRN-01: Journey Builder"]
    FEAT_JRN --> FEAT_JRN_BLOCKS["FEAT-JRN-02: Content Blocks"]
    FEAT_JRN_BLOCKS --> FEAT_JRN_GATE["FEAT-JRN-03: Prerequisite Gating"]
    FEAT_JRN_GATE --> FEAT_CER["FEAT-CER-01: Certificates"]
    FEAT_JRN_GATE --> FEAT_GAM["FEAT-GAM-01: Gamification XP"]
    
    FEAT_EMP --> FEAT_TASK["FEAT-TASK-01: Multi-Stage Tasks"]
    FEAT_TASK --> FEAT_TASK_CROSS["FEAT-TASK-02: Cross-Person Tasks"]
    FEAT_TASK --> FEAT_WF["FEAT-WF-01: Workflow Engine"]
    
    FEAT_EMP --> FEAT_MGR["FEAT-MGR-01: Manager Dashboard"]
    FEAT_EMP --> FEAT_S90["FEAT-S90-01: 30-60-90 Milestones"]
    FEAT_EMP --> FEAT_BUD["FEAT-BUD-01: Smart Buddy Matching"]
    
    FEAT_ORG --> FEAT_DOC["FEAT-DOC-01: E-Signature Templates"]
    FEAT_DOC --> FEAT_DOC_SIGN["FEAT-DOC-02: Canvas Signing"]
    
    FEAT_ORG --> FEAT_INT["FEAT-INT-01: Integration Marketplace"]
    FEAT_INT --> FEAT_HRIS["FEAT-INT-02: HRIS Sync"]
    
    FEAT_ORG --> FEAT_KSK["FEAT-KSK-01: Public Kiosk Player"]
    FEAT_KSK --> FEAT_KSK_PIN["FEAT-KSK-02: Device Telemetry"]
```

---

## 3. Comprehensive Feature Dependency Catalog

| Feature ID | Feature Name | Immediate Prerequisites | Downstream Dependent Features |
| :--- | :--- | :--- | :--- |
| **FEAT-AUTH-01** | Multi-Tenant JWT & Auth | Base Infrastructure | All System Features |
| **FEAT-ORG-01** | Workspace & Dept Management | `FEAT-AUTH-01` | All Domain Features |
| **FEAT-EMP-01** | Employee Directory & Hierarchy | `FEAT-ORG-01` | `FEAT-TASK-01`, `FEAT-MGR-01`, `FEAT-S90-01`, `FEAT-BUD-01` |
| **FEAT-JRN-01** | Visual Journey Builder | `FEAT-ORG-01` | `FEAT-JRN-02`, `FEAT-JRN-04`, `FEAT-AI-02` |
| **FEAT-JRN-03** | Prerequisite & Quiz Gating | `FEAT-JRN-02` | `FEAT-CER-01`, `FEAT-GAM-01`, `FEAT-ANL-01` |
| **FEAT-TASK-01** | Multi-Stage Checklist Engine | `FEAT-EMP-01` | `FEAT-TASK-02`, `FEAT-TASK-03`, `FEAT-WF-01` |
| **FEAT-WF-01** | Trigger-Action Automation | `FEAT-TASK-01` | Automated assignments, provisionings, alerts |
| **FEAT-DOC-01** | E-Signature Template Authoring | `FEAT-ORG-01` | `FEAT-DOC-02` (Canvas Signing & Signed PDF) |
| **FEAT-S90-01** | 30-60-90 Day Milestone Plans | `FEAT-EMP-01` | `FEAT-S90-02` (Milestone Evaluation & Sign-off) |
| **FEAT-BUD-01** | Smart Buddy Matching Engine | `FEAT-EMP-01` | `FEAT-BUD-02` (Buddy Agendas & 1-on-1 Logger) |
| **FEAT-INT-01** | Integration Marketplace | `FEAT-ORG-01` | `FEAT-INT-02` (HRIS Sync), `FEAT-INT-03` (Webhooks) |
| **FEAT-AI-01** | RAG Conversational AI | `FEAT-KB-01` | Policy Q&A, smart action suggestions |
| **FEAT-KSK-01** | Public Kiosk Visual Player | `FEAT-ORG-01` | `FEAT-KSK-02` (Device Telemetry & PIN Pairing) |
