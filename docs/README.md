# Talnova Onboarding — Master Documentation Index

> **Master Repository Index:** Single Source of Truth Navigation Hub for Product Requirements & Engineering Audits

---

> [!IMPORTANT]
> **NON-NEGOTIABLE PRODUCT MODEL RULE**  
> V1.0.0 is a historical release boundary, **not** a separate product.  
> V1-originated capabilities (LMS, Tasks, Content, Documents, Kiosk) remain core parts of the current product.  
> V2.0.0 features (Workflow Engine, Rules, Triggers, AI Assistant, SSO) extend and orchestrate those capabilities.  
> AI agents and developers **must** reason about the unified V1+V2 product lifecycle.  
> **Do not assume V1 capabilities are completed, obsolete, or irrelevant merely because they originated in the V1 release.**

---

## 1. Strict AI Agent & Developer Reading Order

When exploring or working on this repository, you **must** read the documentation in this strict order:

```
1. docs/product/00-product-model.md            <-- Unified Product Vision & Core Architecture
2. docs/product/09-unified-product-contract.md <-- Master Authoritative System Contract
3. docs/product/04-unified-onboarding-lifecycle.md <-- Canonical 10-Stage Lifecycle Contracts
4. docs/product/03-domain-model.md             <-- Entities, ERD Schemas & State Machines
5. docs/product/06-business-rules.md           <-- Formal Business Rules Catalog (BR-001+)
6. docs/product/05-user-journeys.md            <-- Persona Operational Flow Scenarios
7. docs/product/requirements/00-requirements-index.md <-- Master Requirements Index
8. docs/product/requirements/*                 <-- Atomic Capability Requirements (01 to 14)
9. docs/product/08-unresolved-questions.md     <-- Inventory of Open Decisions & Conflicts
10. docs/product/v1-v2-evolution.md            <-- Capability Evolution & Traceability Matrix
11. docs/product/release-history.md            <-- Historical Context Only (Not Architecture)
12. docs/audits/*                             <-- Historical Audits (NOT Authoritative Specs)
```

> **Note on Audits:** Historical documents in `docs/audits/` represent historical implementation investigations and are **NOT** authoritative product specifications.  
> **Note on Release History:** `release-history.md` records past scope timelines and does **NOT** define current system architecture.

---

## 2. Master Repository Map

```
docs/
│
├── README.md                      <-- (Current File) Master Documentation Index
│
├── product/                       <-- AUTHORITATIVE UNIFIED PRODUCT SPECIFICATION
│   ├── 00-product-model.md            Unified Product Vision, Core Actors & Architecture Concept
│   ├── 01-product-scope.md            In-Scope Capabilities, Performance SLAs & Non-Goals
│   ├── 02-actors-and-roles.md          Personas, RBAC Matrix & Tenant Isolation Rules
│   ├── 03-domain-model.md             Entities, ERD Schema & State Machine Lifecycles
│   ├── 04-unified-onboarding-lifecycle.md Canonical End-to-End Onboarding Lifecycle
│   ├── 05-user-journeys.md            Operational Flow Scenarios for All 8 Personas
│   ├── 06-business-rules.md           Business Rules Catalog (BR-001+), Triggers & Precedence Rules
│   ├── 07-terminology.md              Product Glossary & Term Normalization Standard
│   ├── 08-unresolved-questions.md     Inventory of Open Decisions, Conflicts & Uncertainties
│   ├── 09-unified-product-contract.md MASTER AUTHORITATIVE SYSTEM CONTRACT
│   ├── release-history.md             Historical Context (V1.0.0 Baseline & V2.0.0 Scope)
│   ├── v1-v2-evolution.md             Capability Traceability Matrix
│   └── requirements/                  Normative Requirements by Business Capability
│       ├── 00-requirements-index.md   Master Normalized Requirements Index
│       ├── 01-employee-and-onboarding.md
│       ├── 02-journey-management.md
│       ├── 03-automation-and-workflows.md
│       ├── 04-lms-and-learning.md
│       ├── 05-content.md
│       ├── 06-tasks.md
│       ├── 07-kpis.md
│       ├── 08-assessments.md
│       ├── 09-notifications.md
│       ├── 10-completion-and-handover.md
│       ├── 11-administration.md
│       ├── 12-permissions.md
│       ├── 13-reporting.md
│       └── 14-integrations.md
│
└── audits/                        <-- ENGINEERING INVESTIGATIONS & HISTORICAL AUDITS
    ├── README.md                      Index of Historical Engineering Audits
    ├── current/                       Active Runtime Audit Traces
    └── archive/                       Archived Investigation Logs
        ├── legacy_v1/                 Historical V1.0.0 Architecture & Database Specs
        ├── legacy_v2/                 Historical Phase Contracts, Status & Evidence Reports
        └── engineering_audits/        Ground-truth forensic traces & codebase audits
```

---

## 3. Authority & Document Usage Guidelines

| Directory | Authority Scope | Target Audience | Primary Content |
| :--- | :--- | :--- | :--- |
| [`docs/product/`](./product/README.md) | **Authoritative Ground Truth** | Product Managers, Engineers, AI Coding Agents | Product Vision, Master System Contract, Domain Architecture, Lifecycle, Business Rules. |
| [`docs/product/requirements/`](./product/requirements/README.md) | **Normative System Specifications** | Software Engineers, QA Engineers, AI Agents | Atomic functional and system requirements written as IEEE 830 normative standards. |
| [`docs/audits/`](./audits/README.md) | **Historical Engineering Logs** | Systems Auditors, Technical Leads | Phase completion reports, test evidence, browser forensic traces, codebase ground-truth audits. |
