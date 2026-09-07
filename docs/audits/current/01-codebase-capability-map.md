# 01 — Codebase Capability Map

> **Document Purpose:** Forensic Code-Level Mapping of Unified Product Capabilities to Source Code  
> **Note:** This document maps product requirements to actual codebase artifacts (controllers, services, repositories, DB models, events, tests). It does **NOT** report implementation completion percentages.

---

## 1. Codebase Capability Inventory

| Business Capability | Primary Backend Modules | Primary Database Models | API Controllers & Routes | Event Bus Triggers | Frontend UI Pages | Unit / Integration Tests |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Employee & Directory** | `modules/employees` | `User` (`auth/models/user.model.ts`) | `employee.controller.ts`, `routes/employee.routes.ts` | `USER_CREATED`, `USER_UPDATED` (Types defined, publish call missing in service) | `pages/admin/EmployeeDirectory.tsx` | `tests/phase1-foundation.test.ts` |
| **2. Journey Management** | `modules/journeys`, `modules/assignments` | `Journey` (`journey.model.ts`), `IEmployeeAssignment` (`assignment.model.ts`) | `journey.controller.ts`, `assignment.controller.ts` | `JOURNEY_ASSIGNED`, `JOURNEY_STARTED`, `JOURNEY_COMPLETED` | `pages/admin/JourneyBuilder.tsx`, `pages/employee/MyJourney.tsx` | `tests/phase4-smart-assignment.test.ts` |
| **3. Workflow & Automation** | `modules/workflows` | `WorkflowRule`, `WorkflowExecutionLog` | `workflow.controller.ts`, `routes/workflow.routes.ts` | Listens to `USER_CREATED`, `JOURNEY_COMPLETED`, `TASK_COMPLETED` | `pages/admin/WorkflowBuilder.tsx` | `tests/phase3-workflows.test.ts` |
| **4. LMS & Learning** | `modules/journeys`, `modules/assignments` | `Journey` (modules/lessons/quizzes), `IEmployeeAssignment` | `journey.controller.ts`, `assignment.controller.ts` | `LESSON_COMPLETED` (Audit log only) | `pages/employee/LessonViewer.tsx`, `pages/employee/QuizPlayer.tsx` | `tests/phase10-advanced-learning.test.ts` |
| **5. Content & AI Assistant** | `modules/knowledge-base`, `modules/ai` | `KBArticle`, `EmbeddingVector` | `kb.controller.ts`, `ai.controller.ts` | None | `components/ai/RAGAssistantModal.tsx`, `pages/admin/AICourseCreator.tsx` | `tests/phase14-ai-assistant.test.ts` |
| **6. Standalone Tasks** | `modules/tasks` | `Task` (`task.model.ts`) | `task.controller.ts`, `routes/task.routes.ts` | `TASK_CREATED`, `TASK_COMPLETED`, `TASK_OVERDUE` | `pages/tasks/TaskListPage.tsx`, `components/tasks/TaskDetailModal.tsx` | `tests/phase2-tasks.test.ts` |
| **7. KPIs & Outcomes** | `modules/analytics` | `UserStatistics`, `Analytics` | `analytics.controller.ts` | `METRIC_UPDATED` | `pages/admin/HRAnalyticsDashboard.tsx` | `tests/phase12-analytics.test.ts` |
| **8. E-Signatures & Compliance**| `modules/documents` | `DocumentTemplate`, `DocumentSignature` | `document.controller.ts` | `DOCUMENT_ASSIGNED`, `DOCUMENT_SIGNED` | `pages/employee/DocumentSigner.tsx` | `tests/phase6-e-signatures.test.ts` |
| **9. 30-60-90 Day Milestones**| `modules/milestones` | `MilestonePlan` | `milestone.controller.ts` | `MILESTONE_REACHED`, `MILESTONE_COMPLETED` | `pages/employee/MilestonePlanView.tsx`, `pages/manager/MilestoneRatingModal.tsx` | `tests/phase7-milestones.test.ts` |
| **10. Smart Buddy Matching** | `modules/buddy` | `BuddyPairing` | `buddy.controller.ts` | `BUDDY_ASSIGNED` | `pages/buddy/BuddyPortal.tsx` | `tests/phase8-buddy.test.ts` |
| **11. Calendar & Meetings** | `modules/calendar` | `CalendarEvent`, `OAuthToken` | `calendar.controller.ts` | `MEETING_CREATED` | `pages/calendar/CalendarView.tsx` | `tests/phase9-calendar.test.ts` |
| **12. Public Kiosk Sub-System** | `modules/kiosk` | `KioskDevice` | `kiosk.controller.ts` | None | `pages/kiosk/KioskPlayerPage.tsx` | `tests/phase19-kiosk.test.ts` |
| **13. Enterprise Identity & SSO**| `modules/auth` | `User`, `SSOConfig` | `auth.controller.ts`, `sso.controller.ts` | None | `pages/auth/SSOLoginPage.tsx` | `tests/phase16-sso.test.ts` |
| **14. HRIS Marketplace** | `modules/integrations`, `modules/onboarding` | `HRISConnector`, `OnboardingCase`, `OutboxEvent` | `integration.controller.ts`, `onboarding-case.controller.ts` | `onboarding.case.created`, `onboarding.case.completed` | `pages/admin/HRISMarketplace.tsx` | `tests/phase17-hris.test.ts` |

---

## 2. Potential Integration Gaps & Observations

1. **Employee Service vs Event Bus:** `EmployeeService.inviteEmployee` (`modules/employees/services/employee.service.ts`) creates users without publishing `USER_CREATED` on `eventBus`.
2. **Onboarding Case vs Employee Assignment:** `modules/onboarding/services/onboarding-case.service.ts` tracks `OnboardingCase` state transitions via `OutboxEvent`, while `modules/assignments/services/assignment.service.ts` tracks `EmployeeAssignment` via `eventBus`. They operate as disconnected parallel state engines.
3. **Workflow Action Handling:** `WorkflowEngine` (`modules/workflows/services/workflow.engine.ts`) handles `assign_journey`, `create_task`, `send_notification`, but contains a NO-OP stub for `trigger_buddy` and omits `assign_document` and `trigger_webhook`.
4. **Completion Evaluation Scope:** `EmployeeAssignmentService.checkOverallCompletion` (`modules/assignments/services/assignment.service.ts`) evaluates only LMS modules (`allModulesCompleted`), ignoring `Task` items, `DocumentSignature` forms, and `MilestonePlan` check-ins.
