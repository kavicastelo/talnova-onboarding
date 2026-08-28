# 03 — Consolidated Requirements Specification

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative Functional & System Requirement Catalog  
> **Module Namespace:** System Core

---

## 1. Requirement Taxonomy & Classification Standards

Every requirement in this specification is assigned a unique identifier (`CON-REQ-xxx`) and classified according to type, priority, and implementation status:

- **Types:** `Functional`, `Business`, `User`, `System`, `Security`, `Data`, `Integration`, `Non-Functional`, `Compliance`.
- **Priorities:** `Core`, `P0` (Blocker/Critical), `P1` (High Value), `P2` (Enhancement).
- **Statuses:** `BASELINE`, `EXTENDED`, `MODIFIED`, `NEW`, `CLARIFIED`, `REPLACED`, `DEPRECATED`, `CONFLICT`, `DERIVED`.

---

## 2. Canonical Requirements Catalog

### 2.1 Core Platform, Multi-Tenancy & Security Requirements

#### CON-REQ-001: Multi-Tenant Workspace Data Isolation
- **Title:** Organization Workspace Isolation
- **Type:** Security / Data
- **Priority:** Core
- **Status:** BASELINE
- **Source Version:** v1.0.0 (`01-system-overview.md`, `10-security.md`)
- **Dependencies:** None
- **Description:** The system must strictly isolate organization workspace data at the service layer by enforcing `organizationId` scoping on all database queries, cache entries, and API requests. Cross-tenant access attempts must immediately throw `403 Forbidden` errors.
- **Acceptance Criteria:**
  1. Every database query includes `organizationId` matching the authenticated JWT token payload.
  2. Users cannot view, modify, or list resources belonging to another tenant workspace.
  3. Tenant isolation is verified by automated integration test suites.

#### CON-REQ-002: Enterprise SAML 2.0 & OIDC Single Sign-On (SSO)
- **Title:** Enterprise SSO Authentication
- **Type:** Security / Functional
- **Priority:** P0
- **Status:** NEW
- **Source Version:** v2.0.0 (`PHASE-16-API-CONTRACT.md`, `sso.service.ts`)
- **Dependencies:** CON-REQ-001
- **Description:** Organizations can configure SAML 2.0 or OpenID Connect (OIDC) Identity Providers (IdPs) for centralized employee login, domain restriction enforcement, and Just-In-Time (JIT) user account provisioning.
- **Acceptance Criteria:**
  1. Admin can configure SSO settings (entity ID, SSO URL, X.509 certificate).
  2. SP-initiated and IdP-initiated SAML login flows authenticate users cleanly.
  3. New users with valid domain claims are automatically created with default `employee` role.

#### CON-REQ-003: Multi-Role Authorization Framework (RBAC)
- **Title:** Role-Based Access Control
- **Type:** Security
- **Priority:** Core
- **Status:** BASELINE
- **Source Version:** v1.0.0 (`01-system-overview.md`, `07-authentication.md`), v2.0.0 (`PHASE-1-API-CONTRACT.md`)
- **Dependencies:** CON-REQ-001
- **Description:** The system must enforce role-based access control across all API routes supporting `super_admin`, `owner`, `admin`, `manager`, and `employee` roles.
- **Acceptance Criteria:**
  1. Administrative endpoints reject `employee` role JWTs with `403 Forbidden`.
  2. Managers can only view data for employees assigned to their team via `managerId`.
  3. SuperAdmins can manage cross-tenant global configurations.

---

### 2.2 Journeys & Learning Content Requirements

#### CON-REQ-005: Visual Journey Builder & Curriculum Engine
- **Title:** Onboarding Curriculum Authoring
- **Type:** Functional
- **Priority:** Core
- **Status:** BASELINE
- **Source Version:** v1.0.0 (`01-system-overview.md`), v2.0.0 (`PHASE-4-API-CONTRACT.md`)
- **Dependencies:** CON-REQ-001
- **Description:** HR Administrators must be able to create, edit, reorder, and publish onboarding journeys containing multiple modules, lessons, and interactive content blocks.
- **Acceptance Criteria:**
  1. Admin can drag-and-drop modules and content blocks within a journey builder interface.
  2. Journeys support draft, published, and archived status states.
  3. Published journeys are immediately available for user assignment.

#### CON-REQ-006: Multi-Format Interactive Content Blocks
- **Title:** Rich Multimedia Learning Content
- **Type:** Functional
- **Priority:** Core
- **Status:** EXTENDED
- **Source Version:** v1.0.0 (`01-system-overview.md`), v2.0.0 (`journey.model.ts`)
- **Dependencies:** CON-REQ-005
- **Description:** Journeys must support interactive content blocks including video streams, audio narrations, downloadable PDFs, rich text, quizzes, and embedded external URLs.
- **Acceptance Criteria:**
  1. Video/Audio blocks support media playback state tracking.
  2. PDF blocks render in-browser with page progress tracking.
  3. Quiz blocks enforce passing score thresholds before marking completion.

#### CON-REQ-008: Dynamic Smart Journey Auto-Assignment Engine
- **Title:** Rule-Based Journey Targeting
- **Type:** Functional
- **Priority:** P0
- **Status:** NEW
- **Source Version:** v2.0.0 (`PHASE-4-REQUIREMENT-STATUS.md`, `smart-assignment.service.ts`)
- **Dependencies:** CON-REQ-005
- **Description:** Journeys can specify dynamic auto-assignment rules targeting specific roles, departments, or office locations. Newly invited or synced employees matching rule criteria are automatically assigned the journey upon user creation.
- **Acceptance Criteria:**
  1. Target rules evaluate role, department, and location tags automatically.
  2. Journey assignments trigger notifications and initialize progress records.
  3. Bulk reassignment re-evaluates active employees against updated rules.

---

### 2.3 Standalone Task & Workflow Automation Requirements

#### CON-REQ-012: Multi-Stage Standalone Task Engine
- **Title:** Onboarding Checklist Task Engine
- **Type:** Functional
- **Priority:** P0
- **Status:** MODIFIED
- **Source Version:** v1.0.0 (`01-system-overview.md`), v2.0.0 (`PHASE-2-IMPLEMENTATION-REPORT.md`)
- **Dependencies:** CON-REQ-001
- **Description:** Standalone onboarding checklists must support multi-stage organization (Pre-boarding, Day 1, Week 1, Month 1) with individual task completion tracking independent of learning journeys.
- **Acceptance Criteria:**
  1. Tasks can be categorized under predefined or custom onboarding stages.
  2. Task completion updates real-time progress indicators.
  3. Task list templates can be cloned and assigned to new hires.

#### CON-REQ-013: Cross-Person Task Assignment Engine
- **Title:** Multi-Persona Task Execution
- **Type:** Functional
- **Priority:** P0
- **Status:** MODIFIED
- **Source Version:** v2.0.0 (`PHASE-2-API-CONTRACT.md`, `task.service.ts`)
- **Dependencies:** CON-REQ-012
- **Description:** Tasks can be assigned to actors other than the new hire, including IT Administrators (laptop setup), HR Administrators (background checks), and Managers (equipment approval).
- **Acceptance Criteria:**
  1. `assignedRole` / `responsiblePersonId` field specifies task execution responsibility.
  2. IT Admins view and complete IT tasks in their dedicated task view.
  3. New hire progress reflects dependency on cross-person task completion.

#### CON-REQ-015: Event-Driven Workflow Automation Engine
- **Title:** Event-Driven System Workflows
- **Type:** System / Functional
- **Priority:** P0
- **Status:** NEW
- **Source Version:** v2.0.0 (`PHASE-3-IMPLEMENTATION-REPORT.md`, `workflow.engine.ts`)
- **Dependencies:** CON-REQ-012
- **Description:** An event-driven workflow engine triggers automated actions (assign journey, create task, schedule meeting, dispatch notification, simulate external provisioning) when system events occur (`ON_USER_CREATED`, `ON_TASK_OVERDUE`, `ON_JOURNEY_COMPLETED`).
- **Acceptance Criteria:**
  1. Admins can create trigger-condition-action workflow rules.
  2. Events execute asynchronously without blocking main REST requests.
  3. Failed workflow executions are logged in an audit history with retry capabilities.

---

### 2.4 Manager & HR Operations Requirements

#### CON-REQ-016: Manager Direct Report Dashboard
- **Title:** Team Progress Single-Pane Dashboard
- **Type:** Functional
- **Priority:** P0
- **Status:** NEW
- **Source Version:** v2.0.0 (`PHASE-5-API-CONTRACT.md`, `manager.service.ts`)
- **Dependencies:** CON-REQ-004
- **Description:** Managers receive a dedicated operational dashboard displaying onboarding progress, overdue tasks, quiz attempt scores, and milestone status for all direct reports.
- **Acceptance Criteria:**
  1. Dashboard automatically filters to employees where `managerId` equals the logged-in manager.
  2. Overdue training items generate visual action alerts for manager intervention.
  3. Managers can trigger automated reminder notifications to direct reports.

#### CON-REQ-019: 30-60-90 Day Milestone Success Plans
- **Title:** Structured Goal Milestone Plans
- **Type:** Functional
- **Priority:** P0
- **Status:** NEW
- **Source Version:** v2.0.0 (`PHASE-7-IMPLEMENTATION-REPORT.md`, `milestone.service.ts`)
- **Dependencies:** CON-REQ-004
- **Description:** New hires participate in structured 30-day, 60-day, and 90-day milestone success plans with predefined goals, employee self check-ins, and manager ratings.
- **Acceptance Criteria:**
  1. Milestones automatically align due dates based on hire-date relative offsets.
  2. New hire submits self-rating and qualitative check-in notes.
  3. Manager reviews self-rating, inputs manager evaluation, and signs off transition.

#### CON-REQ-021: HR Operations Central Hub & Exception Queue
- **Title:** Enterprise HR Command Center
- **Type:** Functional
- **Priority:** P0
- **Status:** NEW
- **Source Version:** v2.0.0 (`PHASE-11-IMPLEMENTATION-REPORT.md`, `hr-operations.service.ts`)
- **Dependencies:** CON-REQ-001
- **Description:** HR Administrators have a central command center providing organization-wide onboarding metrics, bulk journey assignments, eNPS survey results, and an exception queue for stuck or overdue onboarding plans.
- **Acceptance Criteria:**
  1. Displays average time-to-productivity metrics across departments.
  2. Exception queue flags employees stuck at specific modules for > 7 days.
  3. Supports bulk re-assignment and batch reminder dispatching.

---

### 2.5 Digital Documents & E-Signatures

#### CON-REQ-027: Digital Document Template Management & E-Signing
- **Title:** Legally Compliant E-Signature Capture
- **Type:** Compliance / Functional
- **Priority:** P0
- **Status:** MODIFIED
- **Source Version:** v2.0.0 (`PHASE-6-IMPLEMENTATION-REPORT.md`, `document.service.ts`)
- **Dependencies:** CON-REQ-001
- **Description:** HR Administrators create digital document templates (NDAs, tax forms, policy acknowledgments) assigned to roles/departments. New hires complete in-app signature capture, producing a cryptographically verified signed PDF with audit trail.
- **Acceptance Criteria:**
  1. Signature Canvas captures mouse/touch signature strokes cleanly.
  2. Signed PDF generates with SHA-256 hash, IP address, timestamp, and signee UUID.
  3. Completed documents are securely stored in Cloudflare R2 / S3 storage.

---

### 2.6 AI Platform Requirements

#### CON-REQ-033: Conversational RAG AI Onboarding Assistant
- **Title:** Policy & Knowledge Base AI Chatbot
- **Type:** Functional
- **Priority:** P1
- **Status:** NEW
- **Source Version:** v2.0.0 (`PHASE-14-IMPLEMENTATION-REPORT.md`, `ai-assistant.service.ts`)
- **Dependencies:** CON-REQ-010
- **Description:** Employees can query an AI Assistant regarding company policies (leave, expense, benefits). The assistant uses Retrieval-Augmented Generation (RAG) over Knowledge Base articles to deliver role-contextualized answers with source citations.
- **Acceptance Criteria:**
  1. RAG search respects tenant isolation and user permissions.
  2. Answers cite specific Knowledge Base article titles and URLs.
  3. Includes smart action suggestions (e.g., "View Travel Policy", "Open Task").

#### CON-REQ-034: AI-Powered Course & Journey Builder
- **Title:** Document-to-Curriculum AI Generator
- **Type:** Functional
- **Priority:** P1
- **Status:** NEW
- **Source Version:** v2.0.0 (`PHASE-15-IMPLEMENTATION-REPORT.md`, `ai-course-builder.service.ts`)
- **Dependencies:** CON-REQ-005
- **Description:** HR Administrators can upload PDF or DOCX documents to automatically generate a complete structured course, including modules, lesson summaries, and multiple-choice quizzes.
- **Acceptance Criteria:**
  1. Document parser extracts text sections from uploaded files.
  2. AI generates structured JSON course layout with quizzes and answer keys.
  3. Admin can review, edit, and publish the AI-generated course in the editor studio.

---

### 2.7 Integrations, Mobile PWA & Frontline Systems

#### CON-REQ-030: HRIS & Enterprise Integrations Marketplace
- **Title:** HRIS & Payroll Platform Synchronization
- **Type:** Integration
- **Priority:** P0
- **Status:** NEW
- **Source Version:** v2.0.0 (`PHASE-17-IMPLEMENTATION-REPORT.md`, `hris-integration.service.ts`)
- **Dependencies:** CON-REQ-001
- **Description:** Enterprise integration connectors support automated bidirectional employee synchronization with BambooHR, Workday, Gusto, and ADP, complete with field mapping and Dead-Letter Queue (DLQ) retry logic.
- **Acceptance Criteria:**
  1. Admin can configure API credentials and webhook secrets per HRIS connector.
  2. New hires in HRIS automatically provision into Talnova workspace directory.
  3. Sync failures log to DLQ with manual re-processing capabilities.

#### CON-REQ-035: Mobile PWA & Offline Field Task Sign-Off
- **Title:** Progressive Web App & Offline Execution
- **Type:** Functional / Non-Functional
- **Priority:** P2
- **Status:** EXTENDED
- **Source Version:** v2.0.0 (`PHASE-18-IMPLEMENTATION-REPORT.md`, `pwa.service.ts`)
- **Dependencies:** CON-REQ-012
- **Description:** Mobile web app functions as an installable PWA with Service Worker caching and IndexedDB offline queueing, allowing field employees to complete tasks without an active internet connection.
- **Acceptance Criteria:**
  1. PWA installs on iOS/Android home screens via `manifest.json`.
  2. Tasks completed offline save to IndexedDB and auto-sync when network returns.
  3. Supports native Web Push API alerts for task due dates.

#### CON-REQ-037: Unauthenticated Public Kiosk Visual Player
- **Title:** Frontline Kiosk Safety & SOP Player
- **Type:** Functional / Security
- **Priority:** Core
- **Status:** BASELINE
- **Source Version:** v1.0.0 (`13-public-kiosk-journey-specification.md`)
- **Dependencies:** CON-REQ-001
- **Description:** Frontline workers operate unauthenticated kiosk displays via cryptographically signed URLs (`sig`, timestamp, IP whitelist) to access visual, audio-first safety SOPs with 64px glove-friendly touch targets.
- **Acceptance Criteria:**
  1. Kiosk player executes without standard user password login prompts.
  2. Cryptographic signature validation rejects expired or tampered URL parameters.
  3. Controls occupy minimum 20% screen height with multi-language flag selection.
