# Talnova Onboarding — Remaining Feature Execution Order

> **Document Type:** Agentic Implementation Roadmap  
> **Version:** 1.0.0  
> **Source:** `Talnova Onboarding — Feature & Requirements Audit` v1.0.0  
> **Audit Date:** August 18, 2026  
> **Target:** Existing Talnova Onboarding repository  
> **Backend:** Node.js / Fastify / TypeScript / MongoDB / Mongoose  
> **Frontend:** React 18 / Vite / Tailwind  
> **Execution Mode:** Sequential, dependency-aware, evidence-driven

## 1. Mission

This document is the authoritative execution order for the remaining requirements identified by the engineering audit.

The current application has a production-ready Phase 1 learning/onboarding foundation. The audit identified **96 atomic requirements**: 17 fully implemented, 7 partial, 2 backend-only, 2 placeholder, and 68 missing. The implementation objective is to extend the existing system without rebuilding its verified core.

The implementation program must:

1. Preserve existing production-ready functionality.
2. Implement incomplete requirements in dependency order.
3. Build reusable platform primitives before feature-specific functionality.
4. Maintain multi-tenant isolation and RBAC.
5. Avoid duplicated business logic.
6. Keep existing behavior backward-compatible unless migration is explicitly required.
7. Verify every completed requirement with appropriate tests.
8. Re-run the complete feature audit at the end.

## 2. Scope

Primary scope:

- `MISSING`
- `PARTIAL`

Completion scope also includes incomplete:

- `BACKEND_ONLY`
- `PLACEHOLDER`

These must not remain as incomplete states when their parent business requirements are declared complete.

## 3. Non-Negotiable Agent Rules

### Rule 1 — Read Before Coding

Before modifying code, read:

- this document
- `TALNOVA_ONBOARDING_FEATURE_AUDIT.md`
- repository structure
- relevant models
- services
- controllers
- routes
- middleware
- workers
- frontend components
- API clients
- tests

### Rule 2 — Do Not Rebuild Existing Features

Reuse the verified existing:

- authentication
- organization management
- RBAC
- journeys
- curriculum
- lessons
- content blocks
- assignments
- progress tracking
- quiz scoring
- certificates
- knowledge base
- storage
- analytics foundations

### Rule 3 — Dependency Order Is Mandatory

Do not implement downstream functionality before its platform dependencies.

Example:

```text
Event Bus
  ↓
Workflow Engine
  ↓
Automatic Journey Assignment
  ↓
30/60/90 Automation
```

### Rule 4 — No Fake Completion

A model, route, UI screen, SDK, database field, button, mock response, or documentation entry is not proof of implementation.

A requirement is complete only when its required behavior works end-to-end.

### Rule 5 — Multi-Tenant Isolation

Every new organization-owned feature must enforce `organizationId` isolation at:

- API authorization
- service layer
- database queries
- aggregation
- background jobs
- integrations
- AI/vector search
- WebSockets
- file storage
- analytics

### Rule 6 — Existing Architecture First

Follow existing project conventions. Do not introduce a new framework, ORM, database, queue, state library, or external service without checking the existing architecture and documenting the reason.

### Rule 7 — Tests Are Required

Each phase must include appropriate unit, integration/API, authorization, tenant-isolation, frontend, worker, and end-to-end tests as applicable.

---

# 4. Dependency-First Architecture

```text
FOUNDATION
├── User / Organization Hierarchy
├── Employee Lifecycle Events
├── Event Bus
├── Background Queue / Scheduler
├── Notification Delivery
└── Standalone Task Engine
        │
        ├───────────────┐
        ▼               ▼
Workflow Engine      Manager Layer
        │               │
        ├──────┐        ├── Team Progress
        │      │        ├── Overdue Actions
        ▼      ▼        └── Check-ins
Journey   Tasks
Auto-Assign
        │
        ├──────────────┬──────────────┐
        ▼              ▼              ▼
30/60/90          Buddy           Calendar
        │              │              │
        └──────────────┴──────────────┘
                       │
                       ▼
                 HR Analytics

Digital Documents / E-Signing
        ↓
Audit Trail + PDF Storage

AI Foundation
        ↓
Document Parsing
        ↓
Vector / RAG Infrastructure
        ↓
AI Assistant + AI Course Builder

Integration Foundation
        ↓
SSO / HRIS / Google / Microsoft / Slack

Later:
Gamification → Mobile PWA → Office Map
```

# 5. Execution Phases

## PHASE 0 — Safety Baseline & Guardrails

**Priority:** P0

Before feature work:

- establish clean baseline
- run existing tests
- verify authentication/RBAC
- verify tenant isolation
- verify journeys
- verify assignments
- verify certificates
- record API/database baseline
- establish migration strategy

### Exit Criteria

```text
[ ] Existing tests pass
[ ] Existing core flows pass
[ ] Auth/RBAC verified
[ ] Tenant isolation verified
[ ] No known regression in journeys/assignments/certificates
```

---

## PHASE 1 — Platform Foundation

**Priority:** P0

### 1.1 User / Organization Hierarchy

Supports:

- `MGR-001`
- `MGR-002`
- `MGR-003`
- `MGR-006`
- `JRN-002`
- `BUD-001`
- `HR-001`
- `HR-003`

Ensure reliable:

- manager relationship
- department
- job title/role
- employee lifecycle status
- hire/start date
- offboarding state

Required queries:

```text
Who manages this employee?
Which employees report to this manager?
Which department/role does this employee belong to?
Which journey should they receive?
Is the employee active?
When did they start?
```

### 1.2 Event Bus

Supports:

- `WF-001`
- `JRN-002`
- `WF-002`
- `WF-004`
- `WF-005`
- `GAM-001`
- `S90-004`
- `REM-001`
- `REM-002`
- `REM-004`

Initial events:

```text
USER_CREATED
USER_UPDATED
USER_ACTIVATED
USER_DEACTIVATED
USER_ROLE_CHANGED
USER_DEPARTMENT_CHANGED
JOURNEY_ASSIGNED
JOURNEY_STARTED
JOURNEY_COMPLETED
JOURNEY_OVERDUE
TASK_CREATED
TASK_COMPLETED
TASK_OVERDUE
DOCUMENT_ASSIGNED
DOCUMENT_SIGNED
MILESTONE_REACHED
MILESTONE_COMPLETED
BUDDY_ASSIGNED
CHECKIN_DUE
CHECKIN_COMPLETED
MEETING_CREATED
MEETING_UPDATED
```

### 1.3 Background Queue / Scheduler

Requirement:

- `REM-004`

Required for:

- reminders
- overdue scanning
- delayed workflow actions
- recurring check-ins
- milestone notifications
- calendar jobs
- integration retries
- future AI jobs
- streak calculations

Prefer a dedicated worker architecture such as Redis + BullMQ if consistent with the approved architecture.

Do not perform long-running/retryable work inside HTTP request handlers.

### 1.4 Production Notification Delivery

Requirements:

- `REM-001`
- `REM-002`
- `REM-003`
- `REM-005`

Complete:

- automatic triggers
- real email delivery
- in-app notifications
- preferences
- retries
- duplicate prevention
- escalation/frequency rules

Remove production `console.log` delivery behavior.

### Phase 1 Exit Criteria

```text
[ ] Event bus works
[ ] Worker process works
[ ] Scheduled jobs work
[ ] Retry/failure handling works
[ ] Production notification delivery works
[ ] Tenant isolation is tested
```

---

# PHASE 2 — Standalone Task & Checklist Engine

**Priority:** P0

Requirements:

- `CHK-001`
- `CHK-002`
- `CHK-003`
- `CHK-004`
- `CHK-005`

The current checklist is only a lesson content block. Replace this limitation with a reusable operational task domain.

## Required Task Model

Conceptually:

```text
organizationId
employeeId
assignedToUserId
createdBy
title
description
stage
priority
dueDate
status
source
completedAt
completedBy
```

Support stages such as:

```text
preboarding
day_1
week_1
month_1
custom
```

Tasks must be assignable to:

- employee
- HR
- manager
- IT
- other authorized users

Create:

```text
/tasks
```

with:

- my tasks
- assigned tasks
- overdue
- upcoming
- completed
- filtering
- sorting
- status changes
- details

Support:

- absolute due dates
- relative due dates
- employee-start-date offsets
- milestone offsets
- recurring tasks where required

Connect tasks to notifications:

```text
due soon
due tomorrow
overdue
escalated
```

### Exit Criteria

An HR manager can assign a task to another responsible user; that user sees it, completes it, and the system persists the result and status history.

---

# PHASE 3 — Workflow Automation Engine

**Priority:** P0

Requirements:

- `WF-001`
- `WF-002`
- `WF-004`
- `WF-005`
- `JRN-002`

`WF-003` is deferred until external provisioning integrations exist.

## Workflow Model

```text
WHEN event occurs
IF conditions match
THEN execute actions
```

Create rule/execution concepts:

```text
WorkflowRule
WorkflowExecution
```

Conditions:

```text
department
role/jobTitle
organization
employment status
```

Initial internal actions:

```text
assign_journey
assign_task
send_notification
send_email
assign_buddy
schedule_meeting
create_milestone_plan
```

Track execution:

```text
event
matched rule
action
status
retry count
error
startedAt
completedAt
```

Workflow execution must survive:

- worker restart
- API restart
- provider failure
- retry
- partial action failure

### Automatic Journey Assignment

Complete `JRN-002`:

```text
USER_CREATED
  ↓
department/role matched
  ↓
journey selected
  ↓
assignment created
  ↓
JOURNEY_ASSIGNED
```

### Exit Criteria

A new employee automatically receives the correct journey and tasks according to organization rules.

---

# PHASE 4 — Manager Operations

**Priority:** P0/P1

Requirements:

- `MGR-001`
- `MGR-002`
- `MGR-003`
- `MGR-005`
- `MGR-006`

Create:

```text
/manager
```

Show only authorized direct reports.

Include:

- completion %
- journey
- overdue tasks
- overdue training
- quiz scores
- learning time
- confidence
- check-in status

Implement backend direct-report authorization. Frontend filtering is not sufficient.

Add confidence input and persistence.

Implement manager check-ins:

```text
scheduled
due
completed
notes
manager action
employee response
```

### Exit Criteria

A manager can log in and see only their own team with actionable onboarding status.

---

# PHASE 5 — Digital Document & E-Signing

**Priority:** P0

Requirements:

- `DOC-001`
- `DOC-002`
- `DOC-003`
- `DOC-004`
- `DOC-005`

Create `DocumentTemplate`.

Support:

- NDA
- policy
- code of conduct
- safety
- privacy
- custom documents

Assignment rules:

- role
- department
- employee
- organization

Create:

```text
/documents
```

Support:

- review
- signature capture
- confirmation
- completion

Audit data:

```text
signer
userId
organizationId
document version
document hash
timestamp
IP
signature metadata
```

Generate immutable signed PDF and store it in the existing storage architecture.

Do not treat browser print output as the final signed artifact.

### Exit Criteria

A document can be assigned, reviewed, signed, audited, rendered as an immutable PDF, stored, and retrieved.

---

# PHASE 6 — 30/60/90 Success Plans

**Priority:** P1

Requirements:

- `S90-001`
- `S90-002`
- `S90-003`
- `S90-004`
- `S90-005`

Create:

```text
MilestonePlan
MilestoneCheckpoint
```

Support 30/60/90 stages.

Templates should support:

- organization
- department
- role
- custom milestones

Track:

- completion
- evidence
- manager review
- employee response
- status
- due date

Use events/scheduler for:

- milestone reminders
- manager reviews
- surveys
- automatic progression

### Exit Criteria

A new employee receives a configurable 30/60/90 plan and progresses through it with manager involvement.

---

# PHASE 7 — Buddy System + Calendar Core

**Priority:** P1

Buddy:

- `BUD-001`
- `BUD-003`
- `BUD-004`
- `BUD-005`

Calendar:

- `CAL-001`
- `CAL-003`

Create `BuddyPairing`.

Support:

- employee
- buddy
- assignment history
- status
- weekly check-ins
- feedback

Create provider-independent `Meeting` domain.

Support:

- participants
- organizer
- start/end
- meeting type
- status
- related employee
- workflow relation
- buddy/check-in relation

Implement `.ics` generation.

### Exit Criteria

Buddy assignment and internal meeting scheduling work without requiring Google/Microsoft integration.

---

# PHASE 8 — External Calendar Integrations

**Priority:** P1

Requirements:

- `CAL-002`
- `CAL-004`

Integrate:

- Google Calendar
- Microsoft/Outlook Calendar

Support:

- OAuth
- event creation
- update
- cancellation
- synchronization
- webhooks
- retries
- rate-limit handling

Use background jobs for API operations where appropriate.

---

# PHASE 9 — Learning & HR Analytics Expansion

**Priority:** P1

Requirements:

- `LAN-001`
- `LAN-002`
- `LAN-003`
- `HR-001`
- `HR-003`
- `HR-005`
- `HR-006`

Complete:

- average onboarding duration
- highest-failure modules
- difficult quiz questions
- engagement metrics
- time-to-productivity
- first 90-day retention
- manager effectiveness
- eNPS/new-hire satisfaction

Do not fabricate metrics when source data is absent.

Create required source data first.

Create `OnboardingSurvey` for 30/90-day feedback where required.

### Exit Criteria

HR can distinguish learning metrics from employee-success/retention metrics.

---

# PHASE 10 — AI Foundation + AI Assistant

**Priority:** P1

Requirements:

- `AI-001` through `AI-007`

Build document ingestion:

```text
Document
 ↓
Text extraction
 ↓
Chunking
 ↓
Embedding
 ↓
Vector storage
 ↓
organizationId metadata
 ↓
Semantic retrieval
```

Support PDF/Word/PPT/policy sources as required by the product specification.

Create:

```text
/ai-assistant
```

Support:

- conversational Q&A
- company knowledge
- policy retrieval
- role-aware context
- source citations
- chat history
- safe fallback

Mandatory AI controls:

- tenant filtering
- retrieval thresholds
- source attribution
- insufficient-context fallback
- prompt boundaries
- usage/cost controls where required

### Exit Criteria

AI answers company questions using authorized company knowledge without cross-tenant retrieval or unsupported confident answers.

---

# PHASE 11 — AI Course Builder

**Priority:** P1

Requirements:

- `AIC-001`
- `AIC-002`
- `AIC-003`
- `AIC-004`
- `AIC-005`
- `AIC-006`

Create:

```text
/admin/course-builder/ai
```

Flow:

```text
Upload
 ↓
Parse
 ↓
Generate curriculum
 ↓
Generate objectives
 ↓
Generate lessons/slides
 ↓
Generate quizzes
 ↓
Generate summaries/flashcards
 ↓
Human review
 ↓
Edit
 ↓
Publish
```

AI-generated content must remain draft content until authorized publication.

---

# PHASE 12 — Enterprise SSO + HRIS

**Priority:** P0 for SSO; P1 for HRIS

Requirements:

- `INT-006`
- `INT-004`

SSO:

- SAML 2.0
- OIDC/OAuth2 where applicable
- organization-specific identity configuration
- account linking
- role mapping
- secure callbacks

HRIS:

- new-hire sync
- department changes
- role changes
- offboarding
- webhooks
- retries
- idempotency

HRIS events must feed the existing employee lifecycle/event system.

---

# PHASE 13 — Google / Microsoft / Slack Integrations

**Priority:** P2 after integration foundation

Requirements:

- `INT-001`
- `INT-002`
- `INT-003`

Implement only after a generic integration registry/token/security architecture exists.

External actions must be:

- asynchronous
- retryable
- idempotent
- observable
- permission-aware

---

# PHASE 14 — Gamification

**Priority:** P2

Requirements:

- `GAM-001`
- `GAM-002`
- `GAM-003`
- `GAM-004`
- `GAM-005`

Build over existing learning events.

Implement:

- XP
- levels
- badges
- leaderboards
- daily streaks

Rules must be deterministic and centralized.

Leaderboards must enforce organization boundaries.

---

# PHASE 15 — Mobile PWA

**Priority:** P2

Requirements:

- `MOB-002`
- `MOB-003`
- `MOB-004`

Keep existing responsive web UI.

Implement:

- web app manifest
- installability
- service worker
- offline caching
- synchronization
- push notifications

Do not introduce React Native unless the product requirement explicitly requires native applications.

---

# PHASE 16 — Buddy Real-Time Chat

**Priority:** P2

Requirement:

- `BUD-002`

Implement after Buddy Pairing.

Support:

- authenticated WebSocket connection
- organization isolation
- employee/buddy authorization
- message persistence
- delivery state
- reconnect handling

---

# PHASE 17 — Advanced Workflow Integrations

**Priority:** P2

Requirement:

- `WF-003`

External workflow actions may include:

```text
Create Teams channel
Create IT request
Send Slack notification
Create calendar event
Sync HRIS
```

All must be asynchronous, retryable, idempotent, and observable.

---

# PHASE 18 — Interactive Company Map

**Priority:** P3

Requirements:

- `MAP-001`
- `MAP-002`
- `MAP-003`
- `MAP-004`

Implement:

- floorplan viewer
- office locations
- pins
- desk locations
- search
- wayfinding

This remains intentionally late because it does not unlock the core onboarding workflow.

---

# PHASE 19 — Remaining Low-Priority Integrations

**Priority:** P3

Requirement:

- `INT-007` — Document Management / SharePoint

Payroll sync `INT-005` should only be implemented if direct payroll integration remains an approved product requirement.

---

# 6. Atomic Requirement Index

## P0

| ID | Requirement | Phase |
|---|---|---:|
| `MGR-001` | Direct Report Progress Dashboard foundation | 4 |
| `CHK-001` | Multi-Stage Onboarding Checklists | 2 |
| `CHK-002` | Cross-Person Task Assignment | 2 |
| `REM-004` | Background Scheduler / Cron | 1 |
| `WF-001` | Trigger-Based Automation Rules | 3 |
| `WF-002` | Auto-Assign Journey & Checklists | 3 |
| `WF-005` | Asynchronous Step Orchestration | 3 |
| `JRN-002` | Dynamic Auto-Assignment Engine | 3 |
| `DOC-001` | Document Template Config | 5 |
| `DOC-002` | Role/Dept Target Assignment | 5 |
| `DOC-003` | In-App E-Signature Capture | 5 |
| `DOC-004` | Audit Trail & Timestamping | 5 |
| `DOC-005` | Signed Document PDF Storage | 5 |
| `INT-006` | Enterprise SSO | 12 |

## P1

| ID | Requirement | Phase |
|---|---|---:|
| `CHK-003` | Task Deadlines & Scheduling | 2 |
| `CHK-004` | Responsible Person Task Execution | 2 |
| `CHK-005` | Task Overdue Notifications | 2 |
| `MGR-002` | Overdue Task & Training Drill-Down | 4 |
| `MGR-003` | Quiz Score Visibility per Direct Report | 4 |
| `MGR-006` | Actionable Manager Check-ins | 4 |
| `BUD-001` | Buddy Assignment & Profile Pairing | 7 |
| `BUD-003` | Buddy Meeting Scheduling | 7 |
| `BUD-004` | Weekly Buddy Check-in Workflow | 7 |
| `BUD-005` | Buddy Feedback Collection | 7 |
| `REM-001` | Overdue Training Reminders | 1 |
| `REM-002` | Compliance Due Alerts | 1 |
| `REM-003` | Multi-Channel Delivery | 1 |
| `REM-005` | Escalation & Frequency Rules | 1 |
| `LAN-001` | Onboarding Duration Metrics | 9 |
| `LAN-002` | Highest Failure Modules | 9 |
| `CAL-001` | Automated Meeting Scheduler | 7 |
| `CAL-002` | Google / Outlook Calendar API | 8 |
| `CAL-004` | Calendar Event Sync & Updates | 8 |
| `AIC-001` | Document Parsing | 11 |
| `AIC-002` | AI Curriculum Structure Generation | 11 |
| `AIC-003` | AI Learning Objective & Slides | 11 |
| `AIC-004` | AI Quiz & Explanation Generation | 11 |
| `AIC-006` | Content Review & Editor Studio | 11 |
| `AI-001` | Conversational Question Answering | 10 |
| `AI-002` | Knowledge Ingestion & Embeddings | 10 |
| `AI-003` | Policy Search & Retrieval | 10 |
| `S90-001` | 30-Day Milestone Tracker | 6 |
| `S90-002` | 60-Day Milestone Tracker | 6 |
| `S90-003` | 90-Day Milestone Tracker | 6 |
| `S90-004` | Automated Milestone Evaluation | 6 |
| `HR-001` | Average Time-to-Productivity | 9 |
| `HR-006` | New-Hire Satisfaction / eNPS | 9 |
| `INT-004` | HRIS Platforms | 12 |

## P2

| ID | Requirement | Phase |
|---|---|---:|
| `MGR-005` | Employee Confidence Score Metrics | 4 |
| `BUD-002` | Buddy Chat & Messaging | 16 |
| `GAM-001` | XP Point Calculation | 14 |
| `GAM-002` | Level Progression | 14 |
| `GAM-003` | Achievement Badges | 14 |
| `GAM-004` | Leaderboards | 14 |
| `GAM-005` | Daily Learning Streaks | 14 |
| `LAN-003` | Difficult Quiz Questions | 9 |
| `MOB-002` | PWA / Native App Capability | 15 |
| `MOB-003` | Offline Content Caching & Sync | 15 |
| `MOB-004` | Native Push Notifications | 15 |
| `CAL-003` | iCal Generation | 7 |
| `WF-003` | Auto-Provisioning | 17 |
| `INT-001` | Microsoft 365 / Teams | 13 |
| `INT-002` | Google Workspace | 13 |
| `INT-003` | Slack | 13 |
| `INT-005` | Payroll Sync | 19 |
| `AIC-005` | AI Summary & Flashcards | 11 |
| `S90-005` | Configurable 30/60/90 Templates | 6 |
| `HR-003` | First 90-Day Retention Tracking | 9 |
| `HR-005` | Manager Effectiveness Score | 9 |
| `AI-004` | Role-Contextualized Answers | 10 |
| `AI-005` | Source Attribution & Citations | 10 |
| `AI-006` | Hallucination Safeguards | 10 |
| `AI-007` | Chat History & Multi-Tenant ACL | 10 |

## P3

| ID | Requirement | Phase |
|---|---|---:|
| `MAP-001` | Interactive Floor Plan Viewer | 18 |
| `MAP-002` | Room & Asset Pins | 18 |
| `MAP-003` | Desk & Buddy Proximity Finder | 18 |
| `MAP-004` | Wayfinding & Directions | 18 |
| `INT-007` | Document Management / SharePoint | 19 |

---

# 7. Agent Execution Protocol

Every coding agent must:

## Step 1 — Identify Scope

Record:

```text
Phase
Requirement IDs
Dependencies
Expected outputs
```

Do not modify unrelated features.

## Step 2 — Inspect Repository

Inspect relevant:

```text
models
controllers
services
routes
middleware
workers
components
hooks
API clients
tests
configuration
```

## Step 3 — Validate Audit Assumptions

The audit is the planning baseline. The current repository is authoritative for actual implementation details.

If repository state differs from the audit:

1. Document the discrepancy.
2. Determine actual state.
3. Preserve correct existing behavior.
4. Implement from actual state.
5. Update the audit afterward.

## Step 4 — Design Before Coding

Before implementation, produce:

```text
Existing architecture
New modules
Modified modules
Database changes
API changes
Frontend changes
Events
Jobs
Security
Tests
Migration requirements
```

## Step 5 — Implement a Coherent Unit

Where required, implement end-to-end:

```text
Model
↓
Service
↓
Controller
↓
Route
↓
Authorization
↓
Frontend API
↓
UI
↓
Tests
```

## Step 6 — Verify

Run appropriate:

```text
typecheck
lint
unit tests
integration tests
build
feature tests
```

## Step 7 — Security Verification

Verify:

```text
tenant isolation
role authorization
direct-report authorization
resource ownership
sensitive-data exposure
```

## Step 8 — Documentation

Update:

- architecture docs
- implementation notes
- tests
- audit status

---

# 8. Definition of Done

An atomic requirement may be marked `IMPLEMENTED` only when:

```text
[ ] Required behavior exists.
[ ] Required backend logic exists.
[ ] Required persistence exists.
[ ] Required frontend exists where applicable.
[ ] Authorization exists.
[ ] Tenant isolation is enforced.
[ ] Error handling exists.
[ ] Loading/empty/error states exist where applicable.
[ ] Tests exist.
[ ] Existing tests still pass.
[ ] No placeholder production behavior remains.
[ ] No hardcoded production behavior remains.
[ ] No blocking TODO/FIXME remains.
[ ] Documentation reflects the implementation.
```

For workers:

```text
[ ] Job executes
[ ] Retry works
[ ] Idempotency exists
[ ] Failure is observable
[ ] Duplicate execution is controlled
```

For integrations:

```text
[ ] Authentication works
[ ] Secrets are protected
[ ] API failure is handled
[ ] Rate limits are handled
[ ] Retry strategy exists
[ ] Webhooks are validated
[ ] Idempotency exists
```

For AI:

```text
[ ] Tenant filtering exists
[ ] Retrieval works
[ ] Citations work where required
[ ] Unsupported answers fall back safely
[ ] Prompt boundaries exist
[ ] Usage/cost controls exist where required
```

---

# 9. Prohibited Implementation Patterns

```text
DO NOT:
AI chatbot → map → gamification → integrations → workflow

DO NOT:
Build UI first and invent backend later.

DO NOT:
Create separate task systems inside individual features.

DO NOT:
Hardcode workflow sequences.

DO NOT:
Use frontend filtering as authorization.

DO NOT:
Store third-party secrets as unprotected database fields.

DO NOT:
Run scheduled work inside HTTP request handlers.

DO NOT:
Treat responsive web as automatically equivalent to native mobile.

DO NOT:
Treat certificate signature functionality as employee e-signing.

DO NOT:
Treat a UI Badge component as gamification.

DO NOT:
Treat a calendar icon/date picker as calendar integration.

DO NOT:
Treat payrollCategory as payroll integration.

DO NOT:
Treat an AI SDK installation as an AI feature.
```

---

# 10. Recommended Agent Sequence

```text
AGENT-01 → Platform Foundation
AGENT-02 → Task / Checklist Engine
AGENT-03 → Workflow Automation
AGENT-04 → Manager Operations
AGENT-05 → Digital Documents / E-Signing
AGENT-06 → 30/60/90 Plans
AGENT-07 → Buddy + Calendar Core
AGENT-08 → External Calendar Integrations
AGENT-09 → Learning + HR Analytics
AGENT-10 → AI Foundation + AI Assistant
AGENT-11 → AI Course Builder
AGENT-12 → Enterprise SSO + HRIS
AGENT-13 → Google / Microsoft / Slack Integrations
AGENT-14 → Gamification
AGENT-15 → Mobile PWA
AGENT-16 → Buddy Chat
AGENT-17 → Advanced Workflow Integrations
AGENT-18 → Interactive Office Map
AGENT-19 → Final QA + Full Re-Audit
```

---

# 11. Final Reconciliation

After implementation:

1. Re-run the complete requirements audit.
2. Compare every atomic requirement.
3. Verify no requirement was skipped.
4. Verify no false completion exists.
5. Recalculate coverage.
6. Run regression tests.
7. Run tenant-isolation tests.
8. Run critical workflow end-to-end tests.
9. Run integration tests.
10. Review security, performance, observability, and reliability.
11. Update the audit.

Target:

```text
MISSING       = 0
PARTIAL       = 0
BACKEND_ONLY  = 0
PLACEHOLDER   = 0
UNCERTAIN     = 0
```

for all approved in-scope requirements.

If a requirement is intentionally removed from the product, mark it explicitly:

```text
OUT_OF_SCOPE
```

with the business decision. Never silently remove requirements.

---

# 12. Source-of-Truth Hierarchy

When sources conflict:

```text
1. Current repository behavior
2. Approved product requirements spreadsheet
3. Feature & Requirements Audit
4. This execution roadmap
5. Agent assumptions
```

Agents must not invent product requirements.

If a requirement is ambiguous and materially affects architecture or behavior, stop and document the ambiguity rather than silently choosing an implementation.

---

# 13. First Coding Agent

The first implementation agent should execute **PHASE 1 — Platform Foundation** only.

Scope:

```text
1. User / organization hierarchy verification
2. Event Bus
3. Background Queue / Scheduler
4. Production Notification Delivery
```

It must NOT implement:

- workflow builder
- AI
- buddy
- calendar
- e-signing
- gamification
- office map

Those belong to later agents.

---

# 14. Final Instruction to Autonomous Agents

You are not being asked to merely "add features."

You are evolving an existing production-ready onboarding platform into the complete system defined by the approved requirements.

Every change must:

- preserve existing behavior
- respect architecture
- respect tenant isolation
- respect RBAC
- reuse existing modules where appropriate
- introduce reusable primitives
- avoid duplicated business logic
- be testable
- be observable
- be recoverable
- be documented

**Build the platform from the foundation upward. Do not skip phases because a later feature appears easier.**
