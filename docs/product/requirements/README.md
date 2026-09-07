# Business Capability Requirements Index

> **Directory Scope:** Canonical Functional & System Requirements Organized by Business Capability  
> **Requirement Standard:** IEEE 830 / ISO 29148 Normative Specifications ("The system shall...")

---

## Capabilities Requirement Specification Library

| Document | Business Capability | Namespace | Scope Summary |
| :--- | :--- | :--- | :--- |
| [01-employee-and-onboarding.md](./01-employee-and-onboarding.md) | **Employee & Onboarding** | `employee_onboarding` | Profile directory, lifecycle state transitions (`INVITED` -> `ONBOARDING` -> `ACTIVE`), metadata targeting. |
| [02-journey-management.md](./02-journey-management.md) | **Journey Management** | `journey_management` | Visual journey builder, step ordering, prerequisite locks, journey instance status transitions. |
| [03-automation-and-workflows.md](./03-automation-and-workflows.md) | **Automation & Workflows** | `automation_workflows` | Trigger event processing, boolean rule condition engine, automated action dispatches. |
| [04-lms-and-learning.md](./04-lms-and-learning.md) | **LMS & Learning** | `lms_learning` | Course module authoring, video view completion enforcement, quiz attempts & passing thresholds. |
| [05-content.md](./05-content.md) | **Content & AI Assistant** | `content_ai` | Knowledge Base articles, RAG vector Q&A policy assistant, AI course generator from PDF/DOCX files. |
| [06-tasks.md](./06-tasks.md) | **Standalone Task Engine** | `task_engine` | Multi-stage checklists, cross-role assignees (IT, HR, Manager, Employee, Buddy), relative due dates. |
| [07-kpis.md](./07-kpis.md) | **KPIs & Outcomes** | `kpi_outcomes` | Role-based KPI target definitions, time-to-productivity ramp index calculations. |
| [08-assessments.md](./08-assessments.md) | **Assessments & Compliance** | `assessments_compliance` | HTML5 canvas e-signatures, cryptographic audit trails (SHA-256), 30-60-90 day milestone plans. |
| [09-notifications.md](./09-notifications.md) | **Notifications & Calendar** | `notifications_calendar` | Multi-channel dispatch (In-App, Email, Webhooks), personal iCal feeds, OAuth Google/Outlook sync. |
| [10-completion-and-handover.md](./10-completion-and-handover.md) | **Completion & Handover** | `completion_handover` | Journey completion criteria verification, PDF completion certificates, manager handover. |
| [11-administration.md](./11-administration.md) | **Administration & Kiosk** | `admin_kiosk` | Workspace settings, tenant branding, signed URL public kiosk player (`sig`), device pairing codes. |
| [12-permissions.md](./12-permissions.md) | **Permissions & Authorization**| `permissions_rbac` | RBAC matrix enforcement, tenant isolation (`organizationId`), scoped resource permissions. |
| [13-reporting.md](./13-reporting.md) | **Reporting & Analytics** | `reporting_analytics` | HR operational dashboards, drop-off analytics, eNPS onboarding survey scoring. |
| [14-integrations.md](./14-integrations.md) | **Integrations & Enterprise SSO**| `integrations_sso` | SAML 2.0 / OIDC SSO, HRIS connectors (BambooHR, Workday, Gusto, ADP), DLQ retry queues. |
