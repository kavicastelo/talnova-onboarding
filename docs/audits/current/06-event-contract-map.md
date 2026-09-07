# 06 — Event Contract Map

> **Document Purpose:** Forensic Audit of Event Bus Producers, Payloads, Subscribers, Side Effects, and Runtime Reachability

---

## 1. Event Bus Contract Table

| Event Name | Producer | Event Payload Structure | Consumer / Subscriber | Triggered Side Effect | Runtime Reachability | Architectural Problem |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **`USER_CREATED`** | Defined in `event-types.ts`; published in test files only. | `{ userId, email, role, department }` | `event-subscribers.ts` (lines 148–177) | Invokes `workflowEngine`, `smartAssignmentService`, `documentService`, `milestoneService`, `buddyService`, `calendarService`. | **UNREACHABLE IN RUNTIME** | `EmployeeService.inviteEmployee` creates users but **fails to call** `eventBus.publish("USER_CREATED")`. |
| **`JOURNEY_ASSIGNED`** | `EmployeeAssignmentService.assignJourney` | `{ journeyId, assignmentId, journeyTitle, assignedBy }` | `event-subscribers.ts` (line 15) | Calls `notificationService.notifyJourneyAssignment` (dispatches in-app notification). | **REACHABLE** (When manually assigned) | Correctly publishes and notifies user. |
| **`JOURNEY_COMPLETED`** | `EmployeeAssignmentService.checkOverallCompletion` | `{ journeyId, assignmentId, journeyTitle, employeeName, managerUserId }` | `event-subscribers.ts` (line 29), `workflowEngine` (line 180) | Calls `notificationService.notifyJourneyCompletion` and `workflowEngine.processEvent("journey_completed")`. | **REACHABLE** (When LMS modules complete) | Notification sent, but does **not** update `User.employment.status` to `"active"` or trigger handover. |
| **`JOURNEY_OVERDUE`** | `SchedulerService.scanOverdueAssignments` | `{ journeyId, assignmentId, journeyTitle }` | `event-subscribers.ts` (line 45) | Creates `journey_overdue` in-app notification. | **REACHABLE** | Scheduled cron job correctly publishes overdue alerts. |
| **`TASK_CREATED`** | `TaskService.createTask` | `{ taskId, title, assignedToUserId, employeeId, dueDate }` | `event-subscribers.ts` (line 87) | Creates `task_assigned` in-app notification for assigned user. | **REACHABLE** | Correctly notifies assignee. |
| **`TASK_COMPLETED`** | `TaskService.updateTaskStatus` | `{ taskId, title, assignedToUserId, employeeId }` | `event-subscribers.ts` (line 107), `workflowEngine` (line 191) | Creates in-app notification and invokes `workflowEngine.processEvent("task_completed")`. | **REACHABLE** | Does **not** update `EmployeeAssignment` step progress. |
| **`TASK_OVERDUE`** | `SchedulerService.scanOverdueTasks` | `{ taskId, title, assignedToUserId }` | `event-subscribers.ts` (line 127) | Creates `task_overdue` critical notification. | **REACHABLE** | Scheduled cron job correctly publishes task overdue alerts. |
| **`DOCUMENT_ASSIGNED`** | `DocumentService.assignDocument` | `{ documentTemplateId, userId }` | None (Defined in `event-types.ts`) | None | **DEAD EVENT** | Event published but has zero subscribers on `eventBus`. |
| **`DOCUMENT_SIGNED`** | `DocumentService.signDocument` | `{ signatureId, documentTemplateId, userId }` | None | Audit log created only. | **DEAD EVENT** | Event published but has zero subscribers on `eventBus`; does not update journey step progress. |
| **`MILESTONE_COMPLETED`**| `MilestoneService.submitRating` | `{ planId, userId, period }` | None | Audit log created only. | **DEAD EVENT** | Event published but has zero subscribers on `eventBus`. |
| **`BUDDY_ASSIGNED`** | `BuddyService.assignBuddy` | `{ pairingId, employeeUserId, buddyUserId }` | None | Audit log created only. | **DEAD EVENT** | Event published but has zero subscribers on `eventBus`. |
| **`ONBOARDING_CASE_CREATED`**| `OutboxPublisherService` | `{ caseId, employeeId, source }` | None (Defined in `event-types.ts`) | None | **DEAD EVENT** | Outbox publisher reads `OutboxEvent` and emits `ONBOARDING_CASE_CREATED`, but `event-subscribers.ts` has zero listeners for it. |
| **`ONBOARDING_CASE_STATE_CHANGED`**| `OutboxPublisherService` | `{ caseId, from, to, reason }` | None | None | **DEAD EVENT** | Outbox publisher emits event, but zero subscribers exist. |
