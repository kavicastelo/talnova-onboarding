# 00 — Normalized Requirements Traceability Index

> **Document Status:** Authoritative Requirements Register  
> **Requirement Standard:** IEEE 830 / ISO 29148 Standard Specification Language  
> **Classification Key:**  
> - `EXPLICIT`: Directly specified in core product documentation.  
> - `DERIVED`: Logical requirement implied by business rules and workflow interactions.  
> - `ASSUMPTION`: System assumption required for architectural coherence (subject to review).  
> - `UNRESOLVED`: Requirement ambiguity or conflict requiring product owner decision.

---

## 1. Master Requirements Traceability Table

| ID | Capability Domain | Normalized Requirement | Source Document | Type | System Dependencies | Open Question |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **REQ-EMP-001** | Employee Directory | System shall instantiate employee profile with metadata (`department`, `role`, `location`, `employmentType`, `hireDate`, `managerId`). | `req/01-employee.md` | `EXPLICIT` | Workspace Tenant | None |
| **REQ-EMP-002** | Employee Directory | System shall manage profile state transitions (`INVITED` -> `ONBOARDING` -> `ACTIVE` -> `ARCHIVED`). | `req/01-employee.md` | `EXPLICIT` | Journey Engine | None |
| **REQ-EMP-003** | Employee Directory | System shall emit `ON_USER_CREATED` and `ON_USER_UPDATED` events upon profile mutations. | `req/01-employee.md` | `DERIVED` | Workflow Engine | None |
| **REQ-JRN-001** | Journey Builder | System shall support visual authoring of reusable journey templates with ordered steps. | `req/02-journey.md` | `EXPLICIT` | Template Repository| None |
| **REQ-JRN-002** | Journey Builder | System shall enforce prerequisite step locking (`prerequisiteStepId`) until dependent steps complete. | `req/02-journey.md` | `EXPLICIT` | Step Progress | UQ-02 |
| **REQ-JRN-003** | Journey Builder | System shall maintain journey instance state (`NOT_STARTED`, `IN_PROGRESS`, `OVERDUE`, `PAUSED`, `COMPLETED`). | `req/02-journey.md` | `EXPLICIT` | Journey Engine | None |
| **REQ-WFK-001** | Workflow Engine | System shall process triggers (`ON_USER_CREATED`, `ON_JOURNEY_ASSIGNED`, `ON_STEP_COMPLETED`, `ON_DATE_MILESTONE`). | `req/03-workflows.md`| `EXPLICIT` | Event Bus | None |
| **REQ-WFK-002** | Workflow Engine | System shall evaluate boolean AND/OR rule condition groups against employee metadata. | `req/03-workflows.md`| `EXPLICIT` | Profile Metadata | None |
| **REQ-WFK-003** | Workflow Engine | System shall execute automated actions (`ASSIGN_JOURNEY`, `CREATE_TASK`, `SCHEDULE_MEETING`, `SEND_NOTIFICATION`). | `req/03-workflows.md`| `EXPLICIT` | Action Dispatcher | None |
| **REQ-WFK-004** | Workflow Engine | System shall fall back to default journey (`isDefault == true`) when no rule condition matches. | `06-business-rules.md`| `DERIVED` | Workflow Engine | UQ-04 |
| **REQ-LMS-001** | LMS Engine | System shall support reusable course creation with modules, lessons, and content blocks. | `req/04-lms.md` | `EXPLICIT` | Course Repository | None |
| **REQ-LMS-002** | LMS Engine | System shall validate mandatory video view duration (>= 90%) before lesson completion. | `req/04-lms.md` | `EXPLICIT` | Video Player | None |
| **REQ-LMS-003** | LMS Engine | System shall evaluate quiz attempts against passing score thresholds (default: 80%). | `req/04-lms.md` | `EXPLICIT` | Quiz Evaluator | UQ-02 |
| **REQ-CNT-001** | Content & AI | System shall maintain Knowledge Base policy articles with tags and department scoping. | `req/05-content.md` | `EXPLICIT` | KB Repository | None |
| **REQ-CNT-002** | Content & AI | System shall provide a RAG vector search assistant returning policy answers with source citations. | `req/05-content.md` | `EXPLICIT` | Vector Database | None |
| **REQ-CNT-003** | Content & AI | System shall parse PDF/DOCX policy documents to generate draft LMS courses and quizzes. | `req/05-content.md` | `EXPLICIT` | Document Parser | UQ-05 |
| **REQ-TSK-001** | Task Engine | System shall dispatch multi-stage tasks with status states (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED`, `OVERDUE`). | `req/06-tasks.md` | `EXPLICIT` | Task Engine | None |
| **REQ-TSK-002** | Task Engine | System shall route tasks to target assignee roles (`EMPLOYEE`, `MANAGER`, `IT_ADMIN`, `HR_ADMIN`, `BUDDY`). | `req/06-tasks.md` | `EXPLICIT` | RBAC Router | None |
| **REQ-TSK-003** | Task Engine | System shall calculate relative due dates (`hire_date + N days`) and trigger overdue escalations. | `req/06-tasks.md` | `EXPLICIT` | Scheduler | None |
| **REQ-KPI-001** | KPIs & Outcomes | System shall track role-based KPI targets and aggregate time-to-productivity metrics. | `req/07-kpis.md` | `EXPLICIT` | Analytics Engine | None |
| **REQ-ASM-001** | Compliance | System shall capture HTML5 canvas signatures and generate cryptographically hashed PDFs (SHA-256). | `req/08-assessments.md`| `EXPLICIT` | E-Signature Service| UQ-01 |
| **REQ-ASM-002** | Milestones | System shall manage 30-60-90 day milestone plans requiring employee self-ratings and manager sign-off. | `req/08-assessments.md`| `EXPLICIT` | Milestone Service | None |
| **REQ-NOT-001** | Notifications | System shall dispatch multi-channel notifications (In-App, Email, Webhooks, iCal sync). | `req/09-notifications.md`| `EXPLICIT` | Notification Router| None |
| **REQ-CMP-001** | Handover | System shall verify completion of mandatory steps and issue PDF Completion Certificates. | `req/10-completion.md` | `EXPLICIT` | Handover Service | None |
| **REQ-ADM-001** | Administration | System shall support custom workspace tenant branding, custom domains, and SSO settings. | `req/11-admin.md` | `EXPLICIT` | Tenant Service | None |
| **REQ-ADM-002** | Kiosk Mode | System shall render touch-first unauthenticated public kiosk displays using signed URLs (`sig`). | `req/11-admin.md` | `EXPLICIT` | Kiosk Sub-System | UQ-01 |
| **REQ-PRM-001** | Security | System shall enforce DB query isolation (`WHERE organizationId = context.organizationId`) and RBAC permissions. | `req/12-permissions.md`| `EXPLICIT` | API Gateway | None |
| **REQ-REP-001** | Reporting | System shall display real-time HR operational dashboards, drop-off analytics, and eNPS survey scores. | `req/13-reporting.md` | `EXPLICIT` | Reporting Service | None |
| **REQ-INT-001** | Integrations | System shall support SAML 2.0 / OIDC Enterprise SSO and HRIS marketplace sync with DLQ retries. | `req/14-integrations.md`| `EXPLICIT` | HRIS Connectors | UQ-03 |
