# Talnova Onboarding — Product Documentation Suite

> **Document Status:** Authoritative Single Source of Truth Product Specification  
> **Product Architecture:** Unified Onboarding Platform (V1 Foundation + V2 Evolution & Orchestration)

---

## Executive Overview

This directory contains the **authoritative product specification** for **Talnova Onboarding**, an enterprise B2B SaaS platform for employee onboarding, operational enablement, digital document compliance, and frontline training.

The specification models the system as **one unified product**, where foundational capabilities (LMS, content delivery, tasks, e-signatures, handovers) are orchestrated dynamically by real-time workflow automation engines.

---

## Product Documentation Map

```
docs/product/
│
├── 00-product-model.md            Unified Product Vision, Core Actors, Domain Concepts & Architecture
├── 01-product-scope.md            In-Scope Functional Domains, Non-Functional SLAs & Non-Goals
├── 02-actors-and-roles.md          Personas Taxonomy, RBAC Authority Matrix & Multi-Tenant Isolation
├── 03-domain-model.md             Unified Entities, ERD, Data Schema & State Machine Lifecycles
├── 04-unified-onboarding-lifecycle.md Canonical End-to-End Onboarding Lifecycle (Trigger to Handover)
├── 05-user-journeys.md            Operational Flow Scenarios for all 8 System Personas
├── 06-business-rules.md           Formal Business Rules Catalog (BR-001+), Triggers & Precedence Rules
├── 07-terminology.md              Product Glossary & Terminology Normalization Standard
├── 08-unresolved-questions.md     Inventory of Requirement Conflicts, Open Decisions & Uncertainties
├── release-history.md             Historical Context (V1.0.0 Baseline & V2.0.0 Feature Expansion)
├── v1-v2-evolution.md             Capability Traceability Matrix (V1 Foundation -> V2 Extension -> Unified Role)
│
└── requirements/                  Normative Business Capability Specifications ("The system shall...")
    ├── 01-employee-and-onboarding.md
    ├── 02-journey-management.md
    ├── 03-automation-and-workflows.md
    ├── 04-lms-and-learning.md
    ├── 05-content.md
    ├── 06-tasks.md
    ├── 07-kpis.md
    ├── 08-assessments.md
    ├── 09-notifications.md
    ├── 10-completion-and-handover.md
    ├── 11-administration.md
    ├── 12-permissions.md
    ├── 13-reporting.md
    └── 14-integrations.md
```

---

## Authority & Governance

1. **Authoritative Location:** `docs/product/` is the single source of truth for all product requirements.
2. **Implementation Status Removed:** Product documentation defines desired behavior only. Implementation status, test results, and audit completion percentages are strictly excluded from product specifications and archived under [`docs/audits/`](../audits/README.md).
3. **Unified V1 + V2 Model:** V1 capabilities and V2 automation features operate as one integrated system.
