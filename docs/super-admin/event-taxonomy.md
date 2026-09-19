# Super Admin Platform Event Taxonomy & Event Bus Specification

> **Document Status:** Authoritative Event Specification  
> **System:** Talnova Onboarding Enterprise Platform  
> **Scope:** Standardized Platform Event Taxonomy, Event Schemas, Categories, Emitters, and Subscribers.

---

## 1. Unified Platform Event Schema

All business, operational, and system domain events emitted across the Talnova Onboarding platform follow a standardized envelope:

```typescript
export interface PlatformEventEnvelope<T = Record<string, any>> {
  eventId: string;                  // Unique UUID v4 identifying the event
  eventType: string;                // Canonical event identifier (e.g., "ONBOARDING_CASE_CREATED")
  eventCategory: EventCategory;     // Broad category cluster (AUTH, ONBOARDING, etc.)
  eventVersion: number;             // Schema version (default: 1)
  timestamp: Date;                  // UTC ISO-8601 timestamp
  organizationId?: string;          // Target tenant workspace (null for global platform events)
  actorId?: string;                 // User ID or service initiating the event
  actorRole?: string;               // Role of the actor at time of action
  targetId?: string;                // Target resource entity ID (User, Case, Task, Invoice, etc.)
  targetType?: string;              // Model name of target entity ("User", "Task", "Invoice")
  correlationId: string;            // Trace correlation ID across async steps
  causationId?: string;             // ID of the event that caused this event (if reactive)
  reqId?: string;                   // Fastify HTTP request ID
  ipAddress?: string;               // Source IP address (where legitimately collected)
  userAgent?: string;               // Source user agent
  payload: T;                       // Domain-specific event payload
}
```

---

## 2. Canonical Event Taxonomy by Category

```text
PLATFORM EVENT TAXONOMY
├── AUTH & ACCESS
│   ├── USER_LOGGED_IN                  (User successful credential or SSO login)
│   ├── USER_LOGGED_OUT                 (User active session termination)
│   ├── USER_LOGIN_FAILED               (Failed password attempt or invalid token)
│   ├── PASSWORD_RESET_REQUESTED        (User requested recovery link)
│   ├── PASSWORD_RESET_COMPLETED        (Password successfully changed)
│   └── SESSION_REVOKED                 (Administrative termination of active session)
│
├── TENANTS & ORGANIZATIONS
│   ├── TENANT_PROVISIONED              (SuperAdmin provisioned new workspace)
│   ├── TENANT_SETTINGS_UPDATED         (Branding, timezone, or quotas modified)
│   ├── TENANT_SUSPENDED                (Operational hold applied)
│   ├── TENANT_REACTIVATED              (Operational hold removed)
│   └── TENANT_ARCHIVED                 (Tenant marked for deletion)
│
├── USERS & EMPLOYEES
│   ├── USER_CREATED                    (User entity created via UI, CSV, or HRIS)
│   ├── USER_INVITED                    (Activation email dispatched)
│   ├── USER_PROFILE_UPDATED            (Name, title, or metadata mutated)
│   ├── USER_DEPARTMENT_CHANGED         (Department mutated; triggers journey re-evaluation)
│   ├── USER_ROLE_CHANGED               (Privilege elevation or demotion)
│   └── USER_DEACTIVATED                (Account archived or marked inactive)
│
├── ONBOARDING LIFECYCLE
│   ├── ONBOARDING_CASE_CREATED         (New hire case initialized in 'created' state)
│   ├── ONBOARDING_RESOLVING            (Rules engine resolving journey blueprint)
│   ├── ONBOARDING_PROVISIONING         (Checklists, documents, and milestones generating)
│   ├── ONBOARDING_PROVISIONING_FAILED  (Resource allocation error; requires admin attention)
│   ├── ONBOARDING_READY                (Provisioning complete, awaiting hire date)
│   ├── ONBOARDING_ACTIVATED            (Employee active in roadmap)
│   ├── ONBOARDING_HANDOVER_READY       (All mandatory criteria met, awaiting manager)
│   ├── ONBOARDING_COMPLETED            (Final sign-off completed; certificate issued)
│   └── ONBOARDING_PAUSED               (Administrative or medical hold placed)
│
├── JOURNEYS & LMS
│   ├── JOURNEY_ASSIGNED                (Journey instance assigned to employee)
│   ├── JOURNEY_STARTED                 (First lesson or task accessed)
│   ├── LESSON_COMPLETED                (Content block or reading finished)
│   ├── QUIZ_ATTEMPTED                  (Employee submitted quiz answers)
│   ├── QUIZ_PASSED                     (Score >= passingScorePercent)
│   ├── QUIZ_FAILED                     (Score < passingScorePercent)
│   ├── JOURNEY_OVERDUE                 (Target due date elapsed without completion)
│   ├── JOURNEY_COMPLETED               (All modules and lessons finished)
│   └── CERTIFICATE_ISSUED              (Cryptographically verified PDF generated)
│
├── TASKS & OPERATIONS
│   ├── TASK_CREATED                    (Standalone or journey task created)
│   ├── TASK_ASSIGNED                   (Task routed to employee, manager, or IT)
│   ├── TASK_STARTED                    (Assignee began work)
│   ├── TASK_COMPLETED                  (Assignee submitted task completion)
│   ├── TASK_AUTONOMOUSLY_VERIFIED      (System verified via e-signature or quiz pass)
│   ├── TASK_MANUALLY_VERIFIED          (Manager verified evidence attachment)
│   ├── TASK_OVERDUE                    (Relative offset date elapsed)
│   └── TASK_QUARANTINED                (Verification anomaly flagged with needs_review)
│
├── COMPLIANCE & DOCUMENTS
│   ├── DOCUMENT_ASSIGNED               (Compliance PDF dispatched to user)
│   ├── DOCUMENT_VIEWED                 (User opened document viewer)
│   ├── DOCUMENT_SIGNED                 (Canvas signature captured & SHA-256 hash recorded)
│   └── SIGNATURE_VERIFICATION_ANOMALY  (Digest length or hex mismatch quarantined)
│
├── MILESTONES & GOALS
│   ├── MILESTONE_ASSIGNED              (Day 30, 60, or 90 plan initialized)
│   ├── MILESTONE_SELF_RATED            (Employee submitted confidence score)
│   ├── MILESTONE_MANAGER_EVALUATED     (Manager submitted performance rating)
│   ├── MILESTONE_APPROVED              (Manager sign-off recorded)
│   └── MILESTONE_OVERDUE               (Review date passed without manager sign-off)
│
├── WORKFLOW AUTOMATION
│   ├── WORKFLOW_TRIGGERED              (Rule evaluated against trigger event)
│   ├── WORKFLOW_STEP_EXECUTED          (Single action dispatched)
│   ├── WORKFLOW_DELAYED                (Step placed in persistent delay queue)
│   ├── WORKFLOW_RESUMED                (Delayed worker resumed execution)
│   ├── WORKFLOW_COMPLETED              (All steps finished successfully)
│   └── WORKFLOW_FAILED                 (Step execution raised unhandled exception)
│
├── KNOWLEDGE BASE & AI
│   ├── KNOWLEDGE_ARTICLE_CREATED       (Policy published to KB)
│   ├── KNOWLEDGE_GAP_RECORDED          (AI Assistant encountered unanswered question)
│   ├── AI_PROMPT_EXECUTED              (User invoked AI chat or course generator)
│   ├── AI_RESPONSE_GENERATED           (AI response delivered with token metrics)
│   └── AI_PROVIDER_ERROR               (External AI endpoint returned HTTP error)
│
├── FRONTLINE KIOSK
│   ├── KIOSK_DEVICE_PAIRED             (Terminal enrolled via 6-digit code)
│   ├── KIOSK_HEARTBEAT                 (Device ping recorded)
│   ├── KIOSK_PLAYBACK_STARTED          (Frontline worker launched SOP video)
│   ├── KIOSK_PPE_CONFIRMED             (Touch PPE safety confirmation captured)
│   └── KIOSK_OFFLINE_ALERT             (No heartbeat received for > 15 minutes)
│
├── INTERNAL FINANCE
│   ├── INVOICE_DRAFTED                 (Invoice created in draft state)
│   ├── INVOICE_ISSUED                  (Invoice finalized and issued)
│   ├── INVOICE_SENT                    (Invoice emailed or dispatched to tenant)
│   ├── INVOICE_STATUS_CHANGED          (Status transitioned to Paid, Overdue, Cancelled)
│   ├── PAYMENT_RECORDED                (Manual payment logged with bank reference)
│   ├── PAYMENT_RECONCILED              (Payment verified against bank statement)
│   ├── EXPENSE_RECORDED                (Manual platform operational expense logged)
│   └── FINANCIAL_ADJUSTMENT_APPLIED    (Credit, refund, or tax adjustment logged)
│
└── PLATFORM SECURITY & AUDIT
    ├── SECURITY_ALERT_OPENED           (System anomaly or threshold breach detected)
    ├── SECURITY_ALERT_RESOLVED         (Administrator resolved open alert)
    ├── PRIVILEGED_ACTION_EXECUTED      (Super Admin performed privileged mutation)
    ├── DATA_EXPORTED                   (CSV or data file downloaded by admin)
    └── FEATURE_FLAG_MUTATED            (Feature toggle or rollout percentage updated)
```

---

## 3. Event Bus Subscriptions & Reactive Workflows

Events emitted on the Node.js `eventBus` trigger decoupled reactive handlers:

1. **`USER_CREATED` / `ON_USER_CREATED`:**
   * Invokes `WorkflowEngine.processEvent("user_created")`.
   * Triggers `DocumentService.autoAssignDocumentsToNewHire()`.
   * Triggers `MilestoneService.autoAssignMilestonesToNewHire()`.
   * Triggers `BuddyService.autoAssignBuddyToNewHire()`.
   * Triggers `CalendarService.autoScheduleOnboardingMeetings()`.
   * Triggers `RoleChecklistService.autoAssignRoleChecklistsToNewHire()`.
   * Triggers `ITHardwareService.triggerPreboardingItSetup()`.
2. **`DOCUMENT_SIGNED`:**
   * Triggers Autonomous Compliance Verification Sentinel (`event-subscribers.ts`).
   * Validates 64-character SHA-256 signature hash.
   * Auto-verifies matching checklist tasks or flags task as `needs_review` with quarantine reason if hash is invalid.
   * Awards 50 gamification points to employee profile.
3. **`QUIZ_COMPLETED`:**
   * Triggers Autonomous Assessment Verification Sentinel.
   * Compares final score against task threshold (`minScorePercent`).
   * Auto-verifies matching onboarding tasks.
4. **`PAYMENT_RECORDED`:**
   * Re-evaluates target invoice balance (`balanceDue = totalAmount - sum(payments)`).
   * Automatically transitions invoice status from `issued` to `partially_paid` or `paid`.
   * Dispatches `INVOICE_STATUS_CHANGED` event.
   * Logs immutable audit entry.
