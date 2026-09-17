# Role Navigation Matrix & Persona Specifications

> **System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Document:** Role-Specific Navigation Architectures, Starting Experiences & Task Profiles  
> **Governance:** Strict access preservation with zero capability stripping  

---

## 1. Role Taxonomy Overview

Talnova Onboarding serves 7 authenticated user personas and 1 unauthenticated frontline device profile:
1. **HR Administrator (`admin` / `hr_admin`)**
2. **Organization Owner (`owner`)**
3. **Department / Team Manager (`manager`)**
4. **Employee / New Hire (`employee`)**
5. **IT / Operations Administrator (`it_admin`)**
6. **SuperAdmin / Platform Operator (`super_admin`)**
7. **Onboarding Peer Mentor (`buddy` - Employee/Manager capability)**
8. **Frontline Kiosk Device (`kiosk_operator` / `kiosk_device`)**

---

## 2. Granular Role Navigation Specifications

### 2.1 HR Administrator (`admin` / `hr_admin`)

* **Starting Experience (`/`):**
  - High-priority onboarding status banner (e.g. pending handovers, stalled hires).
  - Quick action launcher: "Invite New Hire", "Create Journey Template", "Review Handovers", "Exceptions Workbench".
  - Core velocity and completion metrics with active pipeline filter.
* **Navigation Architecture:**
  - **Overview & Operations:**
    - `Dashboard` (`/`) — High-level organization onboarding pulse & quick-actions.
    - `HR Operations` (`/hr-ops`) — Handover verification, graduations, bulk status changes.
    - `Exceptions Workbench` (`/hr-ops/exceptions`) — Quarantined cases, drop-off risk, outbox sync, legal holds.
  - **People & Teams:**
    - `Employee Directory` (`/directory`) — Staff roster, employee profiles, invite modal, bulk CSV import.
    - `Team Operations` (`/manager`) — Supervisory oversight of manager sign-offs and direct report progression.
    - `Buddy Program` (`/buddy`) — Mentor pairings, buddy availability directory, matching engine.
    - `30/60/90 Milestones` (`/milestones`) — Milestone template authoring, review escalation ladder.
  - **Learning & Content:**
    - `Journey Templates` (`/journeys`) — Interactive curriculum authoring and step dependency editor.
    - `AI Course Builder` (`/ai-course-builder`) — PDF/Docx syllabus ingestion and automated quiz generation.
    - `Knowledge Base` (`/kb`) — Company policies, handbooks, quick links, slideshow launcher.
  - **Compliance & Logistics:**
    - `Digital Documents` (`/documents`) — Mandatory legal templates (NDAs, policies) and signature tracking.
    - `Tasks & Checklists` (`/tasks`) — Operational task template definitions, assignment, IT provisioning queue.
    - `Calendar & Meetings` (`/calendar`) — Orientation sessions, check-ins, calendar synchronization.
    - `Kiosk Terminals` (`/kiosks`) — SOP video terminals, hardware pairing, frontline device health.
  - **Insights & System:**
    - `Analytics & Reporting` (`/analytics`) — Milestone velocity, cohort drop-offs, bottleneck diagnostics.
    - `Workflows & Automation` (`/workflows`) — Reactive event rules, conditions, action triggers, execution logs.
    - `Office Map` (`/office-map`) — Interactive floorplan, amenity location, desk assignments.
    - `AI Assistant` (`/ai-assistant`) — Conversational policy bot and onboarding assistant.
    - `Settings` (`/settings`) — Org profile, branding color themes, departments, SSO, HRIS integrations.

---

### 2.2 Organization Owner (`owner`)

* **Starting Experience (`/`):**
  - Enterprise tenant health overview, compliance posture, security status.
  - Quick access to Identity & SSO configuration, HRIS sync status, and billing.
* **Navigation Architecture:**
  - Mirrors HR Administrator with elevated prominence for:
    - `Settings > SSO & Identity` (`/settings/sso`)
    - `Settings > HRIS Integrations` (`/settings/integrations`)
    - `Settings > Security & Compliance` (`/settings`)
    - `System Analytics` (`/analytics`)

---

### 2.3 Department / Team Manager (`manager`)

* **Starting Experience (`/manager`):**
  - Immediate direct-report status: "3 New Hires Need Milestone Reviews", "2 Tasks Awaiting Verification".
  - One-click Nudge and One-click Sign-Off dialogs.
  - 1-on-1 meeting readiness cards.
* **Navigation Architecture:**
  - **Team Oversight (Primary):**
    - `Team Operations` (`/manager`) — Direct reports progress board, overdue task alerts, milestone sign-offs.
    - `30/60/90 Milestones` (`/milestones`) — Day 30, 60, 90 milestone evaluation and qualitative review.
    - `Tasks & Verification` (`/tasks`) — Direct report checklists, task verification, task template assignments.
  - **People & Mentorship:**
    - `Buddy Mentorship` (`/buddy`) — Assign buddies to direct reports, monitor buddy check-in notes.
    - `1-on-1 Calendar` (`/calendar`) — Schedule and record notes for direct report check-ins.
    - `Employee Directory` (`/directory`) — Department team members and contact cards.
  - **Insights & Workplace:**
    - `Team Analytics` (`/analytics`) — Department onboarding velocity and bottleneck metrics.
    - `Knowledge Base` (`/kb`) — Company handbooks and department policies.
    - `Office Map` (`/office-map`) — Locate team member desks and department zones.
    - `AI Assistant` (`/ai-assistant`) — Instant company policy and onboarding guidance.

---

### 2.4 Employee / New Hire (`employee`)

* **Starting Experience (`/employee`):**
  - Stage-Based Adaptive Roadmap:
    - *Stage 0:* Welcome & package setup in progress.
    - *Stage 1 (Blocking Prerequisite):* Mandatory Compliance E-Signatures (`/documents`).
    - *Stage 2:* Operational & IT Setup Checklists (`/tasks`).
    - *Stage 3:* LMS Modules & Quizzes (`/course/:id`).
    - *Stage 4:* Peer Mentorship & 30-Day Check-in (`/milestones`, `/buddy`).
    - *Stage 5:* Active Employee Workspace with earned graduation certificate.
* **Navigation Architecture:**
  - **My Onboarding (Primary):**
    - `Onboarding Roadmap` (`/employee`) — Central step-by-step progress guide.
    - `Required Documents` (`/documents`) — Mandatory legal forms and e-signature status (badge for pending).
    - `Checklist Tasks` (`/tasks`) — Personal day-1 and week-1 checklist items.
    - `Learning Journeys` (`/journeys`) — Assigned training modules and curriculum catalog.
  - **Support & Milestones:**
    - `My Buddy` (`/buddy`) — Paired peer mentor profile, icebreakers, check-in history.
    - `30/60/90 Goals` (`/milestones`) — Personal milestone objectives, self-ratings, reflection journals.
    - `Schedule & Meetings` (`/calendar`) — Orientation schedule, 1-on-1s with manager.
  - **Workplace & Resources:**
    - `Knowledge Base` (`/kb`) — Searchable company handbooks, benefit FAQs, policy slideshows.
    - `AI Assistant` (`/ai-assistant`) — Friendly interactive bot answering onboarding questions.
    - `Certificates` (`/certificates`) — Earned completion credentials and verifiable links.
    - `Office Map` (`/office-map`) — Floor plans, printer locations, coffee spots, restrooms.
    - `Leaderboard` (`/leaderboard`) — Onboarding achievements, points, badges.

---

### 2.5 IT / Operations Administrator (`it_admin`)

* **Starting Experience (`/tasks/it-ops`):**
  - Dedicated IT Hardware Provisioning Queue showing incoming new hires awaiting laptops, asset tags, courier tracking numbers, and MDM profile assignment.
* **Navigation Architecture:**
  - **Hardware & Provisioning:**
    - `IT Hardware Queue` (`/tasks/it-ops`) — Dispatch queue, courier links, serial number registration.
    - `Tasks & Checklists` (`/tasks`) — Full checklist management.
  - **Systems & Directory:**
    - `HRIS Integrations` (`/settings/integrations`) — Sync logs with HRIS providers (BambooHR, Workday).
    - `Employee Directory` (`/directory`) — Staff lookup and department equipment assignments.
    - `Knowledge Base` (`/kb`) — IT setups, VPN configurations, security policies.
    - `Office Map` (`/office-map`) — Server rooms, IT helpdesk, printer stations.

---

### 2.6 SuperAdmin / Platform Operator (`super_admin`)

* **Starting Experience (`/super-admin`):**
  - Platform-wide multi-tenant health, active workspaces, aggregate employee load, license utilization.
* **Navigation Architecture:**
  - **Platform Management:**
    - `Platform Dashboard` (`/super-admin`) — System health, telemetry, database connectivity.
    - `Organizations & Tenants` (`/super-admin/organizations`) — Provision new customer workspaces, manage plans, toggle feature gates.
    - `Cross-Tenant Finance` (`/super-admin/finance`) — Billing, MRR/ARR metrics, invoice audit logs.
  - **Tenant Switcher:**
    - Quick access to inspect any tenant workspace with full owner privileges.
