# Talnova Onboarding — Master Documentation Index

> **Master Repository Index:** Single Source of Truth Navigation Hub for Product Requirements & Engineering Audits

---

## Master Architecture & Navigation Hub

```
docs/
│
├── README.md                      <-- (Current File) Master Documentation Index
│
├── product/                       <-- AUTHORITATIVE PRODUCT REQUIREMENTS
│   ├── 00-product-model.md            Unified Product Vision, Core Actors & Architecture Concept
│   ├── 01-product-scope.md            In-Scope Capabilities, Performance SLAs & Non-Goals
│   ├── 02-actors-and-roles.md          Personas, RBAC Matrix & Tenant Isolation Rules
│   ├── 03-domain-model.md             Entities, ERD Schema & State Machine Lifecycles
│   ├── 04-unified-onboarding-lifecycle.md Canonical End-to-End Onboarding Lifecycle
│   ├── 05-user-journeys.md            Operational Flow Scenarios for All 8 Personas
│   ├── 06-business-rules.md           Business Rules Catalog (BR-001+), Triggers & Precedence Rules
│   ├── 07-terminology.md              Product Glossary & Term Normalization Standard
│   ├── 08-unresolved-questions.md     Inventory of Open Decisions, Conflicts & Uncertainties
│   ├── release-history.md             Historical Context (V1.0.0 Baseline & V2.0.0 Scope)
│   ├── v1-v2-evolution.md             Capability Traceability Matrix
│   └── requirements/                  Normative Requirements by Business Capability (01 to 14)
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

## Authority & Document Usage Guidelines

| Directory | Authority Scope | Target Audience | Primary Content |
| :--- | :--- | :--- | :--- |
| [`docs/product/`](./product/README.md) | **Authoritative Ground Truth** | Product Managers, Engineers, AI Coding Agents | Product Vision, Domain Architecture, Lifecycle, Business Rules, Capability Requirements. |
| [`docs/product/requirements/`](./product/requirements/README.md) | **Normative System Specifications** | Software Engineers, QA Engineers, AI Agents | Atomic functional and system requirements written as IEEE 830 normative standards. |
| [`docs/audits/`](./audits/README.md) | **Historical Engineering Logs** | Systems Auditors, Technical Leads | Phase completion reports, test evidence, browser forensic traces, codebase ground-truth audits. |

---

## Core Mental Model for Engineers & AI Agents

When interacting with the repository:

1. **Understand V1 + V2 as ONE Product:** V1 foundational capabilities (LMS, Tasks, Documents, Kiosk) and V2 automation features (Workflow Engine, Triggers, AI Assistant, SSO) operate as one unified product. V2 orchestrates V1.
2. **Product Specs vs Audits:** Product specifications in [`docs/product/`](./product/README.md) describe **desired product behavior**. Engineering audits in [`docs/audits/`](./audits/README.md) describe historical implementation investigations.
3. **No Implementation Status in Product Docs:** Requirements use normative specification language ("The system shall...") and exclude project status claims (percentages, audit scores, pass/fail rates).
