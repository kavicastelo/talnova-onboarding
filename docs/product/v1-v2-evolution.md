# Capability Evolution & Traceability Matrix

> **Document Status:** Authoritative Product Specification  
> **Purpose:** Traceability Mapping Showing How V1 Foundations Evolved into V2 Unified Capabilities

---

## 1. Unified Capability Evolution Matrix

The table below illustrates how foundational V1 capabilities were expanded by V2 automation and orchestration into the unified platform:

| Business Capability | V1 Baseline Foundation | V2 Automation & Orchestration | Unified Product Role |
| :--- | :--- | :--- | :--- |
| **Journey Management** | Manual assignment of static journey templates to new hires. | Trigger-driven automated journey resolution by employee metadata. | **Central Onboarding Roadmap Engine** orchestrating tasks, courses, documents, and milestones. |
| **LMS & Course Delivery** | Static course module consumption and basic video/quiz playback. | Automated course assignment, video view time validation, and prerequisite step locks. | **Integrated Enablement Substrate** embedded within journey steps. |
| **Task Management** | Basic single-user checklist items. | Standalone multi-stage task engine supporting relative due dates and cross-role assignees. | **Cross-Departmental Operational Task Dispatcher** (IT, HR, Manager, Employee, Buddy). |
| **Compliance & Documents** | Basic PDF viewing and manual confirmation checkmarks. | HTML5 canvas e-signatures with cryptographic timestamp, IP, and SHA-256 audit trails. | **Auditable Digital Compliance Engine**. |
| **Knowledge & AI Support** | Static Knowledge Base article repository. | Vector search RAG Q&A assistant and AI Course Builder parsing PDF/DOCX files. | **Intelligent Knowledge Delivery & Authoring Suite**. |
| **Milestones & Feedback** | Single completion checkbox upon onboarding exit. | 30-60-90 day milestone plans with dual employee/manager ratings and sign-off gating. | **Continuous Employee Ramping & Outcome Tracker**. |
| **Buddy Program** | Unstructured manual peer assignment. | Smart buddy matching (skills, department, language) with weekly check-in agendas. | **Social & Cultural Onboarding Sub-System**. |
| **Enterprise Identity** | Local JWT username/password login. | Enterprise SAML 2.0 / OIDC SSO and HRIS marketplace sync (BambooHR, Workday, Gusto, ADP). | **Enterprise Identity & Directory Synchronization**. |
| **Frontline Kiosk** | Basic unauthenticated web page. | Touch-first, high-contrast kiosk mode with signed URLs (`sig`), device codes, and audio SOPs. | **Frontline & Field Access Sub-System**. |

---

## 2. Requirements Lineage Principles

1. **V1 is Foundational:** Baseline capabilities (LMS, Tasks, Documents) provide the core data structures and functional services.
2. **V2 Orchestrates V1:** V2 engines (Workflow Automation, Rule Engine, AI Assistant) do not replace V1 capabilities; they orchestrate when and how V1 resources are assigned and evaluated.
3. **Unified Execution:** Every user interaction operates seamlessly across both layers without distinction.
