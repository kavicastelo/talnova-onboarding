# 01 — Product Scope & Boundaries

> **Document Status:** Authoritative System Specification  
> **Target System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Scope Definition:** Comprehensive Functional Domains, Non-Functional Standards & Non-Goals

---

## 1. Executive Product Scope

Talnova Onboarding is an enterprise B2B SaaS application providing end-to-end employee onboarding, compliance management, continuous learning, and operational enablement. 

The platform supports hybrid corporate enterprises, multi-location organizations, and frontline operational environments (warehouses, retail, manufacturing) by combining visual web workflows, mobile PWA field access, and frontline kiosk modes.

---

## 2. In-Scope Functional Domains

The platform encompasses 14 core business capability domains:

```
+------------------------------------------------------------------------------------+
|                             IN-SCOPE CAPABILITY DOMAINS                            |
|                                                                                    |
|  1. Employee & Onboarding Lifecycle       8. Milestone & Assessment Engine         |
|  2. Visual Journey & Template Builder     9. Multi-Channel Notification Matrix    |
|  3. Workflow & Rule Automation           10. Journey Completion & Handover         |
|  4. LMS & Course Delivery Engine         11. HR Operations & Administration        |
|  5. Interactive Content & AI RAG Assistant 12. Enterprise RBAC & Multi-Tenancy    |
|  6. Standalone Multi-Stage Task Engine   13. Operational Analytics & Reporting     |
|  7. Employee KPI & Outcome Tracking      14. Enterprise HRIS & SSO Integrations    |
+------------------------------------------------------------------------------------+
```

### 2.1 Employee & Workspace Management
* Multi-tenant organization isolation (`organizationId`).
* Employee profile lifecycle (Invited, Active, Onboarding, Offboarding, Archived).
* Role, department, location, employment type (`full_time`, `contractor`, `part_time`), and manager linkage.

### 2.2 Journey Management & Blueprinting
* Drag-and-drop visual journey builder for journey templates.
* Multi-step journey structure with prerequisite gating and stage locks.
* Dynamic rule-based journey targeting by employee metadata (e.g. `department == 'Engineering' AND location == 'NYC'`).

### 2.3 Workflow Automation Engine
* Event-driven rule evaluation on triggers (`ON_USER_CREATED`, `ON_JOURNEY_ASSIGNED`, `ON_STEP_COMPLETED`, `ON_DATE_MILESTONE`).
* Condition engine supporting logical AND/OR combinations over employee attributes.
* Automated actions: Journey assignment, task dispatch, meeting creation, notification delivery, webhook execution.

### 2.4 LMS & Learning Engine
* Reusable course catalog and module builder.
* Content block types: Rich text, video stream, audio player, PDF viewer, knowledge check.
* Course completion enforcement: Minimum video view duration, mandatory quiz pass mark.

### 2.5 AI Assistance & Knowledge Base
* RAG (Retrieval-Augmented Generation) vector Q&A assistant over uploaded company policies and KB articles.
* AI Course Builder: Automated conversion of raw PDF/DOCX policy documents into structured LMS curricula.

### 2.6 Standalone Multi-Stage Task Engine
* Multi-stage task checklists supporting relative due-date scheduling (`hire_date - 7 days`, `hire_date + 3 days`).
* Cross-person assignee support: New Hire, Team Manager, IT Admin, HR Ops, Buddy.
* Mandatory task verification, file attachment uploads, and overdue escalation tracking.

### 2.7 Digital Documents & Cryptographic E-Signatures
* PDF document template creation with field markers (signature, date, text).
* HTML5 canvas signature capture on desktop and mobile.
* Cryptographic signature audit log recording timestamp, IP address, user ID, and document SHA-256 hash.

### 2.8 30-60-90 Day Milestone Success Plans
* Structured milestone check-in schedules at Day 30, Day 60, and Day 90.
* Dual-rating evaluation: New hire self-confidence score and manager performance evaluation.
* Manager sign-off requirements for milestone advancement.

### 2.9 Smart Buddy Matching & Cultural Onboarding
* Automated or manual buddy pairing based on skills, department, and language compatibility.
* Structured 1-on-1 meeting agenda templates and check-in logging.

### 2.10 Calendar & Scheduling Integration
* Personal iCal calendar feed subscriptions for new hires and managers.
* OAuth 2.0 integration with Google Workspace Calendar and Microsoft Outlook 365.
* Automated scheduling for required onboarding orientation meetings.

### 2.11 Public Kiosk Sub-System
* Touch-first, high-contrast, unauthenticated kiosk player mode.
* Cryptographically signed kiosk URLs (`sig`, expiry timestamp, IP restriction) and 6-digit device pairing codes.
* Audio-first SOP instruction playback and PPE safety compliance confirmations.

### 2.12 Mobile PWA & Offline Field Mode
* Web App Manifest and Service Worker caching for mobile web browsers.
* IndexedDB offline storage for task checklists and content consumption.
* Background sync queue for offline task completions.

### 2.13 Interactive Office Map & Wayfinding
* Interactive floorplan visualizer for organization office locations.
* Desk assignment pins, meeting room locations, amenity markers, and interactive pathfinding wayfinding.

### 2.14 Enterprise SSO & HRIS Marketplace
* SAML 2.0 and OIDC Enterprise Single Sign-On.
* Bi-directional HRIS synchronization connectors (BambooHR, Workday, Gusto, ADP).
* Webhook receiver gateway with Dead Letter Queue (DLQ) retry policies.

---

## 3. Non-Functional Requirements & Performance SLAs

The platform shall adhere to strict enterprise non-functional performance benchmarks:

| Category | Requirement Standard | Target Benchmark / SLA |
| :--- | :--- | :--- |
| **API Response Time** | 95th percentile latency for REST endpoints. | `< 200 ms` |
| **Page Load Time** | First Contentful Paint (FCP) on desktop and mobile. | `< 1.2 s` |
| **System Availability** | Multi-tenant uptime SLA excluding maintenance windows. | `99.9% Uptime` |
| **Data Isolation** | Multi-tenant isolation enforced at database query level. | `100% Query Filtering (organizationId)` |
| **Accessibility** | Web Content Accessibility Guidelines compliance level. | `WCAG 2.1 Level AA` (Kiosk: Level AAA touch targets) |
| **Offline Synchronization**| PWA background queue sync recovery upon network connection. | `< 5 s` post-reconnection |
| **E-Signature Integrity** | Cryptographic verification of signed document PDF checksum. | SHA-256 hash validation |

---

## 4. Out-of-Scope Non-Goals

To maintain focus on enterprise employee onboarding and corporate enablement, the following capabilities are explicitly **OUT OF SCOPE**:

* **Public Course Marketplace:** The system shall **not** host a public marketplace or support selling third-party consumer courses.
* **Direct Consumer (B2C) Accounts:** Registration requires an invitation to an organizational tenant workspace; individual B2C user sign-ups are not supported.
* **Public Course Ratings & Instructor Reviews:** No public rating or instructor review mechanisms exist.
* **Payroll Processing & Salary Disbursal:** The platform integrates with HRIS for employee metadata but does **not** process payroll or financial transactions directly.
* **Public Search Engine Indexing:** Workspace content, employee profiles, and journey materials are protected behind authentication or signed tenant URLs and shall **not** be indexed by search engines.
