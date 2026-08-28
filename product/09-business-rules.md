# 09 — Business Rules Catalog

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative Business Logic Specification  
> **Module Namespace:** System Core

---

## 1. Business Rule Classification

System business rules govern application behavior, validations, state transitions, security boundaries, and automated calculations across all modules.

---

## 2. Canonical Business Rules Catalog

#### BR-001: Strict Workspace Data Isolation
- **Domain:** Core Platform / Multi-Tenancy
- **Description:** Every database query, cache key lookup, and API request payload must be explicitly scoped by `organizationId`. Cross-tenant data leakage is strictly prohibited.
- **Trigger:** Any API request or database query execution.
- **Condition:** `request.tenantContext.organizationId != targetResource.organizationId`.
- **System Behavior:** Reject execution immediately; return `HTTP 403 Forbidden` with audit log warning.
- **Exception Behavior:** SuperAdmin endpoints operating on designated `/api/v1/super-admin/*` routes.

#### BR-002: Dynamic Smart Journey Auto-Assignment
- **Domain:** Journeys & Learning
- **Description:** When a user is created or updated, the system evaluates active smart assignment rules matching the user's `role`, `department`, and `officeLocationId`.
- **Trigger:** Event `ON_USER_CREATED` or `ON_USER_UPDATED`.
- **Condition:** Active journey matching `targetRoles` OR `targetDepartments` OR `targetLocations`.
- **System Behavior:** Instantiates `EmployeeAssignment` record in `NOT_STARTED` state with `dueDate` calculated from journey SLA.
- **Exception Behavior:** If zero rules match, assign organization default fallback journey.

#### BR-003: Prerequisite Block & Quiz Passing Score Enforcement
- **Domain:** Journeys & Learning
- **Description:** Content blocks marked with prerequisite gating require completion of prior blocks before unlocking. Quiz blocks require a score >= `passingScorePercent` (default: 80%) to grant module completion.
- **Trigger:** User submits quiz attempt or attempts to open locked block.
- **Condition:** `submittedScore < quiz.passingScorePercent`.
- **System Behavior:** Mark quiz attempt as `FAILED`; retain block in locked state; increment attempt counter.
- **Exception Behavior:** If attempt limit is reached, trigger manager alert for intervention.

#### BR-004: Standalone Task Cross-Person Execution Authority
- **Domain:** Standalone Task Engine
- **Description:** Only the assigned user or designated role (`responsiblePersonId` / `assignedRole`) has authorization to update a task's status to `COMPLETED`.
- **Trigger:** `PATCH /api/v1/tasks/:id/status`.
- **Condition:** `currentUser._id != task.responsiblePersonId` AND `currentUser.role != task.assignedRole` AND `currentUser.role != 'admin'`.
- **System Behavior:** Reject request with `HTTP 403 Forbidden`.
- **Exception Behavior:** HR Admin (`admin` / `owner`) can force-complete tasks with audit log recording.

#### BR-005: Event-Driven Workflow Rule Execution
- **Domain:** Workflow Automation
- **Description:** Workflow automation rules execute asynchronously when matched system events occur (`ON_USER_CREATED`, `ON_TASK_OVERDUE`, `ON_JOURNEY_COMPLETED`).
- **Trigger:** System event publication on internal Event Bus.
- **Condition:** Rule `isActive == true` AND event payload satisfies rule conditions.
- **System Behavior:** Queue workflow actions (assign journey, create task, dispatch webhook) for background worker execution.
- **Exception Behavior:** Action failures log to `WorkflowExecution` audit table with exponential backoff retry.

#### BR-006: E-Signature Audit Trail Cryptographic Validation
- **Domain:** Digital Documents & E-Signatures
- **Description:** Executed e-signature document submissions must generate a SHA-256 cryptographic hash combining PDF binary payload, user ID, IP address, UTC timestamp, and canvas stroke vector data.
- **Trigger:** `POST /api/v1/documents/:id/sign`.
- **Condition:** `signatureData` base64 image string is non-empty AND user accepted electronic signature disclosure.
- **System Behavior:** Renders signed PDF with audit footer; uploads to Cloudflare R2 / S3; saves `DocumentSignature` status `SIGNED`.
- **Exception Behavior:** Reject invalid canvas payloads with `HTTP 400 Bad Request`.

#### BR-007: 30-60-90 Day Milestone Relative Date Calculation
- **Domain:** Manager Operations / Milestones
- **Description:** Milestone evaluation target dates are calculated strictly relative to the employee's `hireDate` (`hireDate + 30 days`, `hireDate + 60 days`, `hireDate + 90 days`).
- **Trigger:** Instantiation of `MilestonePlan` for new hire.
- **Condition:** User has valid `hireDate`.
- **System Behavior:** Set `day30.dueDate`, `day60.dueDate`, `day90.dueDate` timestamps automatically.
- **Exception Behavior:** If `hireDate` is updated, dynamically recalculate pending milestone due dates.

#### BR-008: Smart Buddy Matching Algorithm
- **Domain:** Buddy Program
- **Description:** Smart buddy pairing calculates match scores based on matching department (30%), matching skills/interests (40%), same office location (20%), and language compatibility (10%).
- **Trigger:** `POST /api/v1/buddy/smart-match`.
- **Condition:** Available buddy candidates with `status: ACTIVE` and active pairing count < max limit.
- **System Behavior:** Returns ranked list of buddy candidates with percentage compatibility scores.
- **Exception Behavior:** If zero candidates score > 50%, suggest manual manager pairing fallback.

#### BR-009: Public Kiosk URL Cryptographic Signature Verification
- **Domain:** Public Kiosk Sub-System
- **Description:** Unauthenticated public kiosk player endpoints must validate URL HMAC SHA-256 signatures (`sig`), expiration timestamps (`t`), and IP range whitelists.
- **Trigger:** GET request to `/kiosk/player/*`.
- **Condition:** `currentTime > timestamp` OR `HMAC_SHA256(urlParams, secret) != sig`.
- **System Behavior:** Reject request immediately; return `HTTP 401 Unauthorized` error screen.
- **Exception Behavior:** None. Unauthenticated access strictly requires valid signature.

#### BR-010: Gamification XP & Streak Progression Calculation
- **Domain:** Gamification & Engagement
- **Description:** Employees earn XP points upon completing content blocks (+10 XP), passing quizzes (+50 XP), and logging daily active learning streaks (+20 XP/day). Level increases occur every 200 XP.
- **Trigger:** Event `ON_BLOCK_COMPLETED` or `ON_QUIZ_PASSED`.
- **Condition:** Block completed for the first time.
- **System Behavior:** Increment user total XP, update level, evaluate achievement badge criteria, update leaderboard.
- **Exception Behavior:** Repeated attempts on completed blocks do not award duplicate XP.
