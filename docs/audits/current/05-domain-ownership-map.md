# 05 — Unified Domain Ownership Map

> **Document Purpose:** Forensic Mapping of Domain Entities, Service Contracts, State Owners, and Event Owners across the Codebase

---

## 1. Domain Ownership Matrix

| Domain | Primary Model | Primary Service | Runtime Owner | State Owner | Event Owner | Architectural Defect / Problem |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Employee & Identity** | `User` (`auth/models/user.model.ts`) | `EmployeeService` (`employees/services/employee.service.ts`) | `EmployeeService` | `User.employment.status` | Emits none (`USER_CREATED` publisher missing) | `inviteEmployee` fails to publish `USER_CREATED` on `eventBus`. |
| **Onboarding Case** | `OnboardingCase` (`onboarding/models/onboarding-case.model.ts`) | `OnboardingCaseService` (`onboarding/services/onboarding-case.service.ts`) | `OnboardingCaseService` | `OnboardingCase.state` | Emits `onboarding.case.created` to `OutboxEvent` | Unexposed via HTTP API and unintegrated with `EmployeeAssignment`. |
| **Journey Template** | `Journey` (`journeys/models/journey.model.ts`) | `JourneyService` (`journeys/services/journey.service.ts`) | `JourneyService` | `Journey.publishing.status` | Emits none | Reusable template model; correctly managed by Journey Service. |
| **Journey Instance** | `IEmployeeAssignment` (`assignments/models/assignment.model.ts`) | `EmployeeAssignmentService` (`assignments/services/assignment.service.ts`) | `EmployeeAssignmentService` | `IEmployeeAssignment.status` | Emits `JOURNEY_ASSIGNED`, `JOURNEY_COMPLETED` | Named `EmployeeAssignment` instead of `JourneyInstance`; evaluates progress for LMS only. |
| **Workflow & Automation** | `WorkflowRule`, `WorkflowExecutionLog` | `WorkflowEngine` (`workflows/services/workflow.engine.ts`) | `WorkflowEngine` | `WorkflowExecutionLog.status` | Subscribes to `USER_CREATED`, `JOURNEY_COMPLETED` | `USER_CREATED` trigger is never emitted; `trigger_buddy` is NO-OP stub; `assign_document` missing. |
| **Standalone Tasks** | `Task` (`tasks/models/task.model.ts`) | `TaskService` (`tasks/services/task.service.ts`) | `TaskService` | `Task.status` | Emits `TASK_CREATED`, `TASK_COMPLETED`, `TASK_OVERDUE` | Task completions do not update journey assignment progress. |
| **LMS & Courses** | `Journey` (modules/lessons), `IEmployeeAssignment` | `EmployeeAssignmentService` | `EmployeeAssignmentService` | `ILessonProgress.status` | Emits `JOURNEY_COMPLETED` | LMS progress is isolated from tasks, documents, and milestones. |
| **Content & KB** | `KBArticle`, `EmbeddingVector` | `KBService`, `AIService` | `AIService` | None | Emits none | Correctly operates vector search RAG Q&A and AI course generator drafts. |
| **E-Signatures** | `DocumentTemplate`, `DocumentSignature` | `DocumentService` (`documents/services/document.service.ts`) | `DocumentService` | `DocumentSignature.status` | Emits `DOCUMENT_ASSIGNED`, `DOCUMENT_SIGNED` | Document signatures generate valid SHA-256 PDF hashes, but do not update journey progress. |
| **KPIs & Outcomes** | `UserStatistics`, `Analytics` | `AnalyticsService` | `AnalyticsService` | None | Emits none | Aggregates lesson metrics; missing direct workflow action handler in `WorkflowEngine`. |
| **Assessments & Quizzes** | `IQuiz`, `IQuizAttempt` | `EmployeeAssignmentService` | `EmployeeAssignmentService` | `IQuizAttempt.passed` | Emits none (`quiz.submitted` audit log only) | Quizzes do not enforce max attempt limits or emit `QUIZ_FAILED` escalation events. |
| **30-60-90 Milestones** | `MilestonePlan` (`milestones/models/milestone.model.ts`) | `MilestoneService` (`milestones/services/milestone.service.ts`) | `MilestoneService` | `MilestonePlan.status` | Emits `MILESTONE_REACHED`, `MILESTONE_COMPLETED` | Milestone check-in evaluations do not participate in overall journey completion verification. |
| **Smart Buddy Matching** | `BuddyPairing` (`buddy/models/buddy.model.ts`) | `BuddyService` (`buddy/services/buddy.service.ts`) | `BuddyService` | `BuddyPairing.status` | Emits `BUDDY_ASSIGNED` | `WorkflowEngine` contains dummy stub for `trigger_buddy` returning fake success. |
| **Calendar & Meetings** | `CalendarEvent` (`calendar/models/calendar.model.ts`) | `CalendarService` (`calendar/services/calendar.service.ts`) | `CalendarService` | `CalendarEvent.status` | Emits `MEETING_CREATED` | Meetings scheduled via `event-subscribers.ts` when `USER_CREATED` is received (currently unreachable). |
| **Notifications** | `Notification` (`notifications/models/notification.model.ts`) | `NotificationService` | `NotificationService` | `Notification.status` | Subscribes to `JOURNEY_ASSIGNED`, `JOURNEY_COMPLETED`, etc. | Notification Service correctly dispatches in-app notifications upon event receipt. |
| **Handover** | `User`, `IEmployeeAssignment` | `EmployeeAssignmentService` | None | `User.employment.status` | Emits none | Handover process is absent; journey completion does not update user status to `ACTIVE`. |
