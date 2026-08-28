# 02 — Features Map

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative Product Feature Hierarchy  
> **Module Namespace:** System Core

---

## 1. System Feature Hierarchy Overview

```text
Talnova Onboarding Platform
├── Domain 01: Core Platform & Security
│   ├── Auth & Identity Module (`auth`, `sso`)
│   └── Multi-Tenant Workspace Module (`organizations`, `employees`)
├── Domain 02: Journeys & Learning Content
│   ├── Curriculum & Journey Builder Module (`journeys`, `courses`)
│   ├── Knowledge Base & Policies Module (`knowledge-base`)
│   └── Certificate Engine Module (`certificates`)
├── Domain 03: Task & Workflow Automation
│   ├── Standalone Task Engine Module (`tasks`)
│   └── Event-Driven Workflow Automation Module (`workflows`)
├── Domain 04: Manager & HR Operations
│   ├── Manager Operations Module (`manager`)
│   ├── 30-60-90 Day Success Plans Module (`milestones`)
│   ├── HR Operations & Administration Module (`hr`)
│   └── Operational Analytics & Reporting Module (`analytics`)
├── Domain 05: Employee Enablement & Culture
│   ├── Onboarding Buddy Program Module (`buddy`)
│   ├── Gamification & Engagement Engine Module (`gamification`)
│   └── Digital Documents & E-Signatures Module (`documents`)
├── Domain 06: Integrations & AI Platform
│   ├── Enterprise Integration Marketplace Module (`integrations`)
│   ├── Calendar & Meeting Sync Module (`calendar`)
│   ├── AI Onboarding Assistant Module (`ai`)
│   └── AI Course & Journey Builder Module (`ai`)
└── Domain 07: Mobile, Location & Frontline Systems
    ├── Mobile PWA & Field Access Module (`pwa`)
    ├── Office Map & Location Visualizer Module (`locations`)
    └── Public Kiosk Sub-System Module (`kiosk`)
```

---

## 2. Comprehensive Feature Inventory Table

| Feature ID | Feature Name | Domain | Module | Status | Origin | Target Persona | Business Value | Related Reqs | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FEAT-AUTH-01** | Multi-Tenant JWT & Auth | Core Platform | `auth` | BASELINE | v1.0.0 | All Users | Workspace data security, token session management | CON-REQ-001 | None |
| **FEAT-AUTH-02** | Enterprise SAML 2.0 / OIDC SSO | Core Platform | `auth`, `sso` | NEW | v2.0.0 | Org Owner, Admin | Single Sign-On compliance, automated JIT user provisioning | CON-REQ-002 | FEAT-AUTH-01 |
| **FEAT-ORG-01** | Workspace & Dept Management | Core Platform | `organizations` | BASELINE | v1.0.0 | Org Owner, Admin | Organization hierarchy, multi-tenant boundary scoping | CON-REQ-003 | FEAT-AUTH-01 |
| **FEAT-EMP-01** | Employee Directory & Hierarchy | Core Platform | `employees` | BASELINE | v1.0.0 | Admin, Manager | Manager-report relationships, organizational structure | CON-REQ-004 | FEAT-ORG-01 |
| **FEAT-JRN-01** | Visual Journey & Curriculum Builder | Journeys & Learning | `journeys` | BASELINE | v1.0.0 | Admin | Drag-and-drop onboarding path authoring | CON-REQ-005 | FEAT-ORG-01 |
| **FEAT-JRN-02** | Multi-Format Content Blocks | Journeys & Learning | `journeys` | EXTENDED | v2.0.0 | Admin, Employee | Video, Audio, PDF, Rich Text, Quiz content delivery | CON-REQ-006 | FEAT-JRN-01 |
| **FEAT-JRN-03** | Prerequisite & Quiz Gating | Journeys & Learning | `journeys` | EXTENDED | v2.0.0 | Employee | Strict progression verification, mandatory passing scores | CON-REQ-007 | FEAT-JRN-02 |
| **FEAT-JRN-04** | Smart Rule Auto-Assignment | Journeys & Learning | `journeys` | NEW | v2.0.0 | Admin | Dynamic targeting by role, department, location | CON-REQ-008 | FEAT-JRN-01 |
| **FEAT-JRN-05** | Adaptive Versioned Branching | Journeys & Learning | `journeys` | NEW | v2.0.0 | Admin | Curriculum revision control without breaking active learners | CON-REQ-009 | FEAT-JRN-01 |
| **FEAT-KB-01** | Categorized Policy & SOP Articles | Journeys & Learning | `knowledge-base` | BASELINE | v1.0.0 | All Users | Centralized company handbook & SOP documentation | CON-REQ-010 | FEAT-ORG-01 |
| **FEAT-CER-01** | Dynamic Certificate Generation | Journeys & Learning | `certificates` | EXTENDED | v2.0.0 | Employee, Admin | Publicly verifiable PDF completion certificates | CON-REQ-011 | FEAT-JRN-03 |
| **FEAT-TASK-01** | Multi-Stage Checklist Engine | Task & Workflow | `tasks` | MODIFIED | v2.0.0 | All Personas | Onboarding checklist tracking across pre-boarding & Day 1 | CON-REQ-012 | FEAT-EMP-01 |
| **FEAT-TASK-02** | Cross-Person Task Assignment | Task & Workflow | `tasks` | MODIFIED | v2.0.0 | IT, HR, Manager | Multi-persona operational handoffs (laptop, accesses) | CON-REQ-013 | FEAT-TASK-01 |
| **FEAT-TASK-03** | Relative Due-Date Scheduling | Task & Workflow | `tasks` | NEW | v2.0.0 | Admin, Manager | Hire-date offset scheduling (`H-7`, `H+1`, `H+30`) | CON-REQ-014 | FEAT-TASK-01 |
| **FEAT-WF-01** | Trigger-Action Automation Engine | Task & Workflow | `workflows` | NEW | v2.0.0 | Admin | Automated workflow orchestration on system events | CON-REQ-015 | FEAT-TASK-01 |
| **FEAT-MGR-01** | Direct Report Progress Dashboard | Manager & HR Ops | `manager` | NEW | v2.0.0 | Manager | Single-pane visibility into team onboarding status | CON-REQ-016 | FEAT-EMP-01 |
| **FEAT-MGR-02** | Quiz Score & Time Drill-Down | Manager & HR Ops | `manager` | NEW | v2.0.0 | Manager | Detailed score breakdown and learning time telemetry | CON-REQ-017 | FEAT-MGR-01 |
| **FEAT-MGR-03** | Confidence Score & Check-ins | Manager & HR Ops | `manager` | NEW | v2.0.0 | Manager | Employee sentiment tracking and 1-on-1 action logs | CON-REQ-018 | FEAT-MGR-01 |
| **FEAT-S90-01** | 30-60-90 Day Milestone Plans | Manager & HR Ops | `milestones` | NEW | v2.0.0 | Employee, Manager | Structured long-term goal setting and evaluation | CON-REQ-019 | FEAT-EMP-01 |
| **FEAT-S90-02** | Milestone Self & Manager Evaluation | Manager & HR Ops | `milestones` | NEW | v2.0.0 | Employee, Manager | Two-way check-in ratings and formal sign-offs | CON-REQ-020 | FEAT-S90-01 |
| **FEAT-HR-01** | HR Operations Central Hub | Manager & HR Ops | `hr` | NEW | v2.0.0 | HR Admin | Enterprise onboarding queue, exceptions, eNPS metrics | CON-REQ-021 | FEAT-EMP-01 |
| **FEAT-ANL-01** | Time-to-Productivity Analytics | Manager & HR Ops | `analytics` | EXTENDED | v2.0.0 | Admin, Executive | Department performance benchmarking & drop-off metrics | CON-REQ-022 | FEAT-JRN-03 |
| **FEAT-BUD-01** | Smart Buddy Matching Engine | Enablement & Culture | `buddy` | NEW | v2.0.0 | Admin, Buddy | Skill and department based peer-mentor matching | CON-REQ-023 | FEAT-EMP-01 |
| **FEAT-BUD-02** | Buddy Agendas & 1-on-1 Logger | Enablement & Culture | `buddy` | NEW | v2.0.0 | Buddy, Employee | Weekly check-in structured guides and meeting notes | CON-REQ-024 | FEAT-BUD-01 |
| **FEAT-GAM-01** | XP, Levels & Badge Progression | Enablement & Culture | `gamification` | EXTENDED | v2.0.0 | Employee | Gamified learning incentives and unlockable achievements | CON-REQ-025 | FEAT-JRN-03 |
| **FEAT-GAM-02** | Org Leaderboards & Daily Streaks | Enablement & Culture | `gamification` | EXTENDED | v2.0.0 | Employee | Social engagement and daily active learning rewards | CON-REQ-026 | FEAT-GAM-01 |
| **FEAT-DOC-01** | E-Signature Template Authoring | Enablement & Culture | `documents` | MODIFIED | v2.0.0 | HR Admin | Template creation with placeholder fields & target roles | CON-REQ-027 | FEAT-ORG-01 |
| **FEAT-DOC-02** | Canvas Signature & Signed PDF | Enablement & Culture | `documents` | MODIFIED | v2.0.0 | Employee | Canvas mouse/touch signing with SHA-256 audit trail | CON-REQ-028 | FEAT-DOC-01 |
| **FEAT-INT-01** | Integration Marketplace Framework | Integrations & AI | `integrations` | NEW | v2.0.0 | Admin | Modular connector framework for external SaaS apps | CON-REQ-029 | FEAT-ORG-01 |
| **FEAT-INT-02** | HRIS Platform Sync | Integrations & AI | `integrations` | NEW | v2.0.0 | Admin | Automated sync with BambooHR, Workday, Gusto, ADP | CON-REQ-030 | FEAT-INT-01 |
| **FEAT-INT-03** | Webhooks & Communication Sync | Integrations & AI | `integrations` | NEW | v2.0.0 | Admin | Real-time webhooks, MS Teams, Slack notifications | CON-REQ-031 | FEAT-INT-01 |
| **FEAT-CAL-01** | OAuth Calendar & Meeting Scheduler | Integrations & AI | `calendar` | NEW | v2.0.0 | All Personas | iCal export feed, Google / Outlook meeting sync | CON-REQ-032 | FEAT-EMP-01 |
| **FEAT-AI-01** | RAG Conversational AI Assistant | Integrations & AI | `ai` | NEW | v2.0.0 | Employee | Chatbot Q&A over company handbook with citations | CON-REQ-033 | FEAT-KB-01 |
| **FEAT-AI-02** | AI Document-to-Course Builder | Integrations & AI | `ai` | NEW | v2.0.0 | Admin | Automated parsing of PDF/DOCX into structured courses | CON-REQ-034 | FEAT-JRN-01 |
| **FEAT-MOB-01** | Responsive PWA & Field Access | Mobile & Location | `pwa` | EXTENDED | v2.0.0 | Field Employee | Installable mobile web app, push alerts, offline sync | CON-REQ-035 | FEAT-TASK-01 |
| **FEAT-MAP-01** | Floorplan & Wayfinding Visualizer | Mobile & Location | `locations` | NEW | v2.0.0 | Employee | Interactive office map, desk search, room navigation | CON-REQ-036 | FEAT-ORG-01 |
| **FEAT-KSK-01** | Public Kiosk Visual Player | Mobile & Location | `kiosk` | BASELINE | v1.0.0 | Frontline Worker | Unauthenticated, signed URL audio/visual safety player | CON-REQ-037 | FEAT-ORG-01 |
| **FEAT-KSK-02** | Kiosk Fleet & Pairing Telemetry | Mobile & Location | `kiosk` | EXTENDED | v2.0.0 | IT Admin | 6-digit PIN hardware pairing and status monitoring | CON-REQ-038 | FEAT-KSK-01 |
