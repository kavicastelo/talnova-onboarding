# 20 — Master Product Index & Glossary

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative Master Product Index & Glossary  
> **Module Namespace:** System Core

---

## 1. Master Document Directory

This master index provides unified navigation across the entire 20-document **Full Product Specification & Blueprint Suite** for Talnova Onboarding.

```text
product/
├── README.md                           --> Master Overview & Consolidation Principles
├── 01-product-blueprint.md             --> Executive Overview & System Architecture
├── 02-features-map.md                  --> Hierarchical Feature Tree & Inventory
├── 03-requirements-specification.md    --> Canonical Requirements Catalog (CON-REQ-xxx)
├── 04-requirements-traceability.md     --> Traceability Matrix (v1 + v2 Mapping)
├── 05-users-personas.md                --> Detailed Profiles for 8 System Personas
├── 06-user-journeys-workflows.md       --> 8 End-to-End Workflows & Mermaid Diagrams
├── 07-domain-data-model.md             --> Entity Schemas, Attributes & Mermaid ERD
├── 08-roles-permissions.md             --> Enterprise RBAC Matrix & Scoping Rules
├── 09-business-rules.md                --> Business Rules Catalog (BR-001 to BR-035+)
├── 10-integrations.md                  --> HRIS, SSO, Calendar, Webhooks & DLQ
├── 11-security-compliance.md           --> Security Architecture, HMAC Signed URLs, OWASP
├── 12-notifications.md                 --> Multi-Channel Dispatch Matrix & Schedulers
├── 13-reporting-analytics.md           --> Operational Telemetry, TTP & eNPS Metrics
├── 14-non-functional-requirements.md   --> NFR Performance, WCAG AA/AAA, PWA Resilience
├── 15-feature-dependencies.md          --> Visual Feature Dependency Maps
├── 16-requirements-conflicts.md        --> Conflict Register & Resolutions (C-001 to C-005)
├── 17-assumptions-open-questions.md    --> Assumptions, Derived Reqs & Recommendations
├── 18-product-roadmap.md               --> 4-Phase Capability Trajectory
├── 19-release-scope.md                 --> Capability Tiers (Core, MVP, Extended, Advanced)
└── 20-product-index.md                 --> Master Index & Canonical Terminology Glossary
```

---

## 2. Canonical Product Terminology Glossary

| Canonical Term | v1 Historical Alias | v2 Historical Alias | Consolidation Status | Authoritative Definition |
| :--- | :--- | :--- | :---: | :--- |
| **Employee** | Staff Member, Learner, User | Employee, New Hire | `CONSOLIDATED` | An individual employee within an organization tenant consuming onboarding and training content. |
| **Journey** | Onboarding Path, Learning Flow | Onboarding Journey | `CONSOLIDATED` | A structured curriculum composed of sequential modules, lessons, and interactive content blocks. |
| **Content Block** | Lesson Item, Asset | Interactive Block | `CONSOLIDATED` | Individual learning element (video, audio, PDF, rich text, quiz, document) within a journey module. |
| **Task** | Checklist Item | Onboarding Task | `CONSOLIDATED` | Standalone checklist item assigned to a new hire or cross-person actor (IT, HR, Manager). |
| **Document Template** | File Upload | E-Signature Template | `CONSOLIDATED` | Administrative template defining legal document layout and signature field coordinates. |
| **Milestone Plan** | Review Schedule | 30-60-90 Day Success Plan | `CONSOLIDATED` | Structured 30-, 60-, and 90-day goal evaluation framework with employee self-rating and manager sign-off. |
| **Onboarding Buddy** | Mentor | Buddy | `CONSOLIDATED` | Senior peer mentor matched with a new hire to guide informal cultural integration and 1-on-1 agendas. |
| **Public Kiosk** | Kiosk Mode, Frontline Kiosk | Kiosk Terminal | `CONSOLIDATED` | Unauthenticated, audio-first visual player display operating on signed URLs for factory/warehouse SOPs. |
| **Smart Assignment** | Manual Assignment | Auto-Assignment Rule | `CONSOLIDATED` | Dynamic rule engine assigning journeys, tasks, and milestone plans based on role, department, and location. |
| **HRIS Sync** | Employee Import | HRIS Integration Connector | `CONSOLIDATED` | Automated bidirectional user synchronization with external HR platforms (BambooHR, Workday, Gusto, ADP). |

---

## 3. Quick Reference Requirement Index

- **Core & Auth Requirements:** `CON-REQ-001` (Multi-Tenant Isolation), `CON-REQ-002` (SAML/OIDC SSO), `CON-REQ-003` (RBAC Framework), `CON-REQ-004` (User Directory).
- **Journey Requirements:** `CON-REQ-005` (Journey Builder), `CON-REQ-006` (Content Blocks), `CON-REQ-007` (Quiz Gating), `CON-REQ-008` (Smart Auto-Assignment), `CON-REQ-009` (Adaptive Branching).
- **Task & Workflow Requirements:** `CON-REQ-012` (Standalone Tasks), `CON-REQ-013` (Cross-Person Tasks), `CON-REQ-014` (Relative Schedules), `CON-REQ-015` (Workflow Rule Engine).
- **Manager & HR Ops Requirements:** `CON-REQ-016` (Manager Dashboard), `CON-REQ-019` (30-60-90 Milestones), `CON-REQ-021` (HR Central Hub), `CON-REQ-022` (Time-to-Productivity Analytics).
- **Enablement & Culture Requirements:** `CON-REQ-023` (Smart Buddy Matching), `CON-REQ-025` (Gamification XP), `CON-REQ-027` (E-Signature Templates), `CON-REQ-028` (Canvas Signing & PDF).
- **AI & Integrations Requirements:** `CON-REQ-030` (HRIS Sync), `CON-REQ-032` (Calendar OAuth), `CON-REQ-033` (RAG AI Assistant), `CON-REQ-034` (AI Course Builder).
- **Mobile, Map & Kiosk Requirements:** `CON-REQ-035` (Mobile PWA & Offline Sync), `CON-REQ-036` (Office Map Wayfinding), `CON-REQ-037` (Public Kiosk Visual Player).
