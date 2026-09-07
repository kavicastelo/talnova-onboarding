# 06 — Business Rules Catalog

> **Document Status:** Authoritative System Specification  
> **Target System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Rule Scope:** Formal System Constraints, Evaluation Triggers, Precedence & Exception Policies

---

## 1. Business Rule Architecture & Schema

Every business rule governs system behavior and is specified using a formal structured schema:

```
Rule ID: BR-XXX-000
Rule Name: Descriptive Name
Trigger Event: Domain trigger emitting event
Conditions: Logical boolean evaluation criteria
Action: Executable system action upon match
Priority Index: Integer priority value (higher evaluates first)
Precedence: Execution ordering relative to competing rules
Exceptions: System behavior when evaluation or execution fails
Affected Entities: System entities mutated by rule execution
Affected Lifecycle Stage: Onboarding lifecycle stage where rule applies
```

---

## 2. Security & Multi-Tenancy Rules

### BR-SEC-001: Strict Organization Data Isolation
* **Rule ID:** `BR-SEC-001`
* **Rule Name:** Multi-Tenant Database Query Isolation
* **Trigger Event:** Every incoming HTTP/API request.
* **Conditions:** Session contains authenticated `organizationId`.
* **Action:** Automatically append `WHERE organizationId = context.user.organizationId` to all database queries.
* **Priority Index:** `100` (Highest System Priority)
* **Precedence:** Evaluates before any domain business logic execution.
* **Exceptions:** If `organizationId` is missing or mismatched, reject with `403 Forbidden` and log security alert.
* **Affected Entities:** All database entities containing `organizationId`.
* **Affected Lifecycle Stage:** All Lifecycle Stages (Stages 1–10).

### BR-SEC-002: Role-Based Authorization Enforcement
* **Rule ID:** `BR-SEC-002`
* **Rule Name:** RBAC Endpoint Privilege Check
* **Trigger Event:** API Gateway route dispatch.
* **Conditions:** User role checked against RBAC Authority Matrix ([02-actors-and-roles.md](./02-actors-and-roles.md)).
* **Action:** Grant or deny route execution.
* **Priority Index:** `90`
* **Precedence:** Evaluates immediately following tenant isolation check.
* **Exceptions:** Public kiosk endpoints authenticated via signed URLs (`sig`) bypass user session checks.
* **Affected Entities:** `User`, API Session.
* **Affected Lifecycle Stage:** All Lifecycle Stages.

---

## 3. Workflow & Automation Engine Rules

### BR-WFK-001: Trigger Event Emission
* **Rule ID:** `BR-WFK-001`
* **Rule Name:** Asynchronous Domain Event Dispatch
* **Trigger Event:** Entity state transitions (`User` created, step completed, date milestone reached).
* **Conditions:** System domain action succeeds.
* **Action:** Emit structured event payload to Event Bus.
* **Priority Index:** `80`
* **Precedence:** Dispatched asynchronously following database transaction commit.
* **Exceptions:** Queue failure logs event payload to error queue for retry.
* **Affected Entities:** `WorkflowRule`, Event Bus.
* **Affected Lifecycle Stage:** Stage 2 (Trigger Emission).

### BR-WFK-002: Rule Condition Evaluation & Precedence
* **Rule ID:** `BR-WFK-002`
* **Rule Name:** Priority-Based Boolean Rule Matching
* **Trigger Event:** Receipt of domain trigger event.
* **Conditions:** Compare employee profile metadata (`department`, `role`, `location`, `employmentType`) using boolean AND/OR logic.
* **Action:** Select matching `WorkflowRule` with highest `priorityIndex`.
* **Priority Index:** `75`
* **Precedence:** Higher `priorityIndex` rules evaluate before lower priority rules.
* **Exceptions:** If multiple rules match with identical priority, select the most recently updated rule.
* **Affected Entities:** `WorkflowRule`, `JourneyInstance`.
* **Affected Lifecycle Stage:** Stage 3 (Rule Engine Evaluation).

### BR-WFK-003: Default Journey Fallback
* **Rule ID:** `BR-WFK-003`
* **Rule Name:** Default Workspace Template Fallback
* **Trigger Event:** Completion of Stage 3 rule evaluation.
* **Conditions:** Zero active `WorkflowRule` records matched the employee metadata.
* **Action:** Assign the default workspace journey template (`isDefault == true`).
* **Priority Index:** `10`
* **Precedence:** Evaluates only when all higher-priority rules fail to match.
* **Exceptions:** If no default journey exists, log admin alert and set journey status to `PAUSED`.
* **Affected Entities:** `JourneyInstance`, `Organization`.
* **Affected Lifecycle Stage:** Stage 4 (Journey Resolution).

---

## 4. Journey & Step Progression Rules

### BR-JRN-001: Prerequisite Step Locking
* **Rule ID:** `BR-JRN-001`
* **Rule Name:** Prerequisite Dependency Lock
* **Trigger Event:** User attempts step access.
* **Conditions:** Step specifies `prerequisiteStepId != null` AND `PrerequisiteStep.status != COMPLETED`.
* **Action:** Render step status as `LOCKED` and deny access to child items.
* **Priority Index:** `70`
* **Precedence:** Checked prior to rendering step content.
* **Exceptions:** Attempting API access to locked step returns `403 Forbidden`.
* **Affected Entities:** `JourneyStep`, `StepProgress`.
* **Affected Lifecycle Stage:** Stage 7 (LMS & Content Consumption).

### BR-JRN-002: Step Completion Verification
* **Rule ID:** `BR-JRN-002`
* **Rule Name:** Child Item Completion Aggregation
* **Trigger Event:** Child item (task, course, quiz, document) status updated to `COMPLETED` or `VERIFIED`.
* **Conditions:** All mandatory child items within the step achieve completed state.
* **Action:** Update `StepProgress.status` to `COMPLETED`.
* **Priority Index:** `65`
* **Precedence:** Evaluates upon every child item completion.
* **Exceptions:** Optional child items do not block step completion.
* **Affected Entities:** `JourneyStep`, `StepProgress`.
* **Affected Lifecycle Stage:** Stage 7 & Stage 9.

---

## 5. LMS & Content Delivery Rules

### BR-LMS-001: Video Stream Duration Threshold
* **Rule ID:** `BR-LMS-001`
* **Rule Name:** Mandatory 90% Video Watch Threshold
* **Trigger Event:** Video player heartbeats.
* **Conditions:** Streamed playback position >= 90% of total video duration.
* **Action:** Mark video content block state as completed.
* **Priority Index:** `60`
* **Precedence:** Enforced before lesson step completion.
* **Exceptions:** Skipping past 90% via scrub bar without watching does not satisfy threshold.
* **Affected Entities:** `Lesson`, Content Block.
* **Affected Lifecycle Stage:** Stage 7 (LMS Consumption).

### BR-LMS-002: Quiz Passing & Retry Enforcement
* **Rule ID:** `BR-LMS-002`
* **Rule Name:** Quiz Attempt & Passing Score Evaluation
* **Trigger Event:** User submits quiz response payload.
* **Conditions:** Submitted score >= `Quiz.passingScorePercent` (default: 80%).
* **Action:** Mark quiz state as `PASSED` and update step progress.
* **Priority Index:** `60`
* **Precedence:** Enforced upon quiz submission.
* **Exceptions:** If score < passing mark, increment attempt counter. If `maxAttempts` exceeded, transition quiz state to `FAILED` and notify manager.
* **Affected Entities:** `Quiz`, `StepProgress`.
* **Affected Lifecycle Stage:** Stage 7 (LMS Consumption).

---

## 6. Digital E-Signatures & Compliance Rules

### BR-SIG-001: Cryptographic Audit Trail Generation
* **Rule ID:** `BR-SIG-001`
* **Rule Name:** E-Signature Canvas Hash & PDF Audit Trail
* **Trigger Event:** Employee submits canvas signature.
* **Conditions:** Signature image vector provided and form fields valid.
* **Action:** Render signed PDF; embed metadata (user ID, timestamp, IP address); calculate SHA-256 PDF hash; save to read-only storage.
* **Priority Index:** `80`
* **Precedence:** Executed before updating document step status to `COMPLETED`.
* **Exceptions:** Failed PDF rendering flags document request as `FAILED` and prompts retry.
* **Affected Entities:** `DocumentTemplate`, `DocumentSignature`.
* **Affected Lifecycle Stage:** Stage 6 (E-Signature Dispatch).
