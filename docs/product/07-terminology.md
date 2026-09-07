# 07 — Terminology & Product Glossary

> **Document Status:** Authoritative Product Specification  
> **Target System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Purpose:** Canonical Dictionary Resolving Synonymous Terms & Domain Concepts

---

## 1. Domain Term Normalization

Historical document versions utilized inconsistent terminology. The table below defines the **canonical canonical term** for all product concepts:

| Legacy / Synonymous Term | Canonical Product Term | Definition & Standard Context |
| :--- | :--- | :--- |
| Onboarding Plan, Onboarding Program, Learning Path | **Onboarding Journey** | The structured sequence of steps, courses, tasks, documents, and milestones assigned to an employee. |
| Blueprint, Journey Definition, Journey Schema | **Journey Template** | The reusable authoring model used to instantiate individual onboarding journeys. |
| Stage, Phase, Module (in journey context) | **Journey Step** | A container within a journey containing tasks, courses, documents, or milestones. |
| Checklist Item, Work Item, Action Item | **Task Item** | A discrete operational task assigned to an employee, manager, IT admin, HR admin, or buddy. |
| Course Unit, Training Module, Class | **LMS Course** | An educational unit composed of modules, lessons, content blocks, and quizzes. |
| E-Form, Signature Document, Agreement | **Digital Document** | A PDF document template populated for HTML5 canvas e-signature capture. |
| Automation Trigger, Event Listener, Hook | **Workflow Trigger** | A system domain event (`ON_USER_CREATED`, `ON_STEP_COMPLETED`) that initiates rule evaluation. |
| Condition Group, Criteria, Rule Filter | **Workflow Rule** | A configurable rule containing conditions and automated actions evaluated by the workflow engine. |
| Peer Mentor, Onboarding Guide, Peer | **Onboarding Buddy** | An experienced employee paired with a new hire for cultural onboarding and 1-on-1 check-ins. |
| Terminal Mode, Kiosk Player, Audio Player | **Public Kiosk** | Touch-first visual display player for unauthenticated frontline, factory, or warehouse terminal access. |

---

## 2. Comprehensive Product Glossary

### A
* **Active Employee:** An employee record whose onboarding journey is in progress or completed and has active system access.
* **Assignee Role:** The targeted role (`EMPLOYEE`, `MANAGER`, `IT_ADMIN`, `HR_ADMIN`, `BUDDY`) responsible for completing a task item.

### B
* **Buddy Pairing:** The active association between a new hire and an onboarding buddy.

### C
* **Canvas Signature:** HTML5 touch/mouse signature drawing interface used for e-signatures.
* **Content Block:** A modular component within a lesson (Rich Text, Video, Audio, PDF, Quiz).

### D
* **Dead Letter Queue (DLQ):** Error handling queue for failed HRIS sync payloads or webhook dispatches requiring retry.

### E
* **E-Signature Audit Trail:** Metadata record capturing timestamp, user ID, IP address, and SHA-256 PDF hash for signed documents.

### J
* **Journey Instance:** The instantiated roadmap assigned to a specific employee, tracking step progress and completion status.

### K
* **Knowledge Base (KB):** Organizational document repository searched by the AI RAG assistant.

### M
* **Milestone Plan:** A structured evaluation framework for day 30, 60, and 90 onboarding check-ins.

### R
* **Relative Due Date:** A due date calculated relative to an employee's hire date (`hire_date + N days`).
* **Retrieval-Augmented Generation (RAG):** AI vector search over Knowledge Base articles providing policy Q&A.

### T
* **Tenant Isolation:** Architectural pattern guaranteeing that database queries enforce `WHERE organizationId = context.organizationId`.
