# Feature-to-API Backend Mapping Matrix

> **Document Status:** Authoritative API & Service Traceability Matrix  
> **System:** Talnova Onboarding Enterprise Backend  
> **Scope:** Fastify Routes, Controllers, Domain Services, Mongoose Models & Guard Middleware  
> **Date:** September 2026  

---

## 1. Backend Security Boundary Standard

In an enterprise multi-tenant system, **the API is the ultimate security boundary**. 
A feature is only considered guarded if:
1. `authenticate` verifies a valid JWT session.
2. `requireRole(...)` verifies role eligibility.
3. `requireFeatureFlag(...)` verifies tenant and role feature enablement.
4. Database queries filter by `organizationId`.

---

## 2. Master Feature-to-API Mapping Table

| Feature ID | Feature Flag Key | HTTP Method & Path | Controller & Service Layer | Database Model | Feature Flag Guard Active? |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `FEAT-AUTH-001` | `auth_credentials` | `POST /api/v1/auth/login` | `auth.controller.ts` -> `AuthService.login` | `User` | N/A (Public) |
| `FEAT-AUTH-002` | `auth_session_revocation`| `POST /api/v1/auth/logout` | `auth.controller.ts` -> `SessionService.invalidate` | `Session` | N/A (Public) |
| `FEAT-AUTH-005` | `sso_enforcement` | `GET/POST /api/v1/auth/sso/*`| `sso.routes.ts` -> `SSOService` | `SSOProvider` | **NO (Unguarded)** |
| `FEAT-ONB-001` | `onboarding_roadmap` | `GET /api/v1/onboarding/cases/me` | `onboarding.routes.ts` -> `OnboardingService` | `OnboardingCase` | **NO (Unguarded)** |
| `FEAT-ONB-002` | `digital_signatures` | `POST /api/v1/documents/:id/sign`| `document.routes.ts` -> `DocumentService.sign` | `DocumentRecord` | **NO (Unguarded)** |
| `FEAT-ONB-003` | `checklist_tasks` | `PATCH /api/v1/tasks/:id/status`| `task.routes.ts` -> `TaskService.updateStatus` | `Task` | **NO (Unguarded)** |
| `FEAT-ONB-004` | `lms_course_player` | `GET /api/v1/journeys/courses/:id`| `journey.routes.ts` -> `JourneyService.getCourse`| `Course` | **NO (Unguarded)** |
| `FEAT-ONB-005` | `lms_assessments` | `POST /api/v1/journeys/quiz/submit`| `journey.routes.ts` -> `JourneyService.gradeQuiz`| `QuizSubmission` | **NO (Unguarded)** |
| `FEAT-ONB-006` | `milestone_ratings` | `POST /api/v1/milestones/:id/rating`| `milestone.routes.ts` -> `MilestoneService.rate` | `Milestone` | **NO (Unguarded)** |
| `FEAT-ONB-007` | `buddy_connection` | `GET /api/v1/buddy/my-buddy` | `buddy.routes.ts` -> `BuddyService.getMyBuddy` | `BuddyPairing` | **NO (Unguarded)** |
| `FEAT-ONB-008` | `graduation_handover`| `GET /api/v1/certificates/me`| `certificate.routes.ts` -> `CertificateService` | `Certificate` | **NO (Unguarded)** |
| `FEAT-ADM-001` | `journey_templates` | `POST /api/v1/journeys` | `journey.routes.ts` -> `JourneyService.create` | `JourneyTemplate` | **NO (Unguarded)** |
| `FEAT-ADM-002` | `journey_builder` | `PUT /api/v1/journeys/:id` | `journey.routes.ts` -> `JourneyService.update` | `JourneyTemplate` | **NO (Unguarded)** |
| `FEAT-ADM-004` | `employee_directory`| `GET /api/v1/employees` | `employee.controller.ts` -> `EmployeeService` | `User` | **NO (Unguarded)** |
| `FEAT-ADM-005` | `employee_invite` | `POST /api/v1/employees/invite`| `employee.controller.ts` -> `EmployeeService` | `User` | **NO (Unguarded)** |
| `FEAT-ADM-006` | `bulk_csv_import` | `POST /api/v1/employees/bulk-import`| `employee.controller.ts` -> `EmployeeService` | `User` | **NO (Unguarded)** |
| `FEAT-ADM-007` | `workflow_rules` | `GET/POST /api/v1/workflows`| `workflow.routes.ts` -> `WorkflowService` | `WorkflowRule` | **NO (Unguarded)** |
| `FEAT-ADM-009` | `hr_ops_dashboard` | `GET /api/v1/hr/dashboard` | `hr-operations.routes.ts` -> `HROpsService` | `OnboardingCase` | **NO (Unguarded)** |
| `FEAT-ADM-010` | `hr_exceptions` | `GET /api/v1/hr/exceptions` | `hr-operations.routes.ts` -> `HROpsService` | `OnboardingCase` | **NO (Unguarded)** |
| `FEAT-ADM-011` | `doc_templates` | `POST /api/v1/documents/templates`| `document.routes.ts` -> `DocumentService` | `DocumentTemplate` | **NO (Unguarded)** |
| `FEAT-ADM-013` | `task_templates` | `POST /api/v1/tasks/templates`| `task-template.routes.ts` -> `TaskTemplateService`| `TaskTemplate` | **NO (Unguarded)** |
| `FEAT-ADM-015` | `ai_course_builder` | `POST /api/v1/ai/generate-course`| `ai-assistant.routes.ts` -> `AIProviderService` | `AICourseDraft` | **YES (`requireFeatureFlag`)** |
| `FEAT-ADM-016` | `org_branding` | `PATCH /api/v1/organizations/me`| `organization.routes.ts` -> `OrgService` | `Organization` | **NO (Unguarded)** |
| `FEAT-ADM-017` | `advanced_hris_sync`| `POST /api/v1/integrations/*`| `hris-integration.routes.ts` -> `HRISService` | `HRISIntegration` | **NO (Unguarded)** |
| `FEAT-ADM-018` | `tenant_analytics` | `GET /api/v1/analytics/overview`| `analytics.routes.ts` -> `AnalyticsService` | `AnalyticsSnapshot` | **NO (Unguarded)** |
| `FEAT-MGR-001` | `manager_dashboard`| `GET /api/v1/manager/team` | `manager.routes.ts` -> `ManagerService` | `User` | **NO (Unguarded)** |
| `FEAT-MGR-003` | `milestone_approval`| `POST /api/v1/milestones/:id/eval`| `milestone.routes.ts` -> `MilestoneService.eval` | `Milestone` | **NO (Unguarded)** |
| `FEAT-MGR-004` | `task_verification` | `POST /api/v1/tasks/:id/verify`| `task.routes.ts` -> `TaskService.verify` | `Task` | **NO (Unguarded)** |
| `FEAT-MGR-005` | `checkin_scheduler` | `POST /api/v1/calendar/events`| `calendar.routes.ts` -> `CalendarService` | `CalendarEvent` | **NO (Unguarded)** |
| `FEAT-MGR-006` | `buddy_assignment` | `POST /api/v1/buddy/assign` | `buddy.routes.ts` -> `BuddyService.assign` | `BuddyPairing` | **NO (Unguarded)** |
| `FEAT-KSK-001` | `kiosk_pairing` | `POST /api/v1/kiosk/pair` | `kiosk.routes.ts` -> `KioskService.pair` | `KioskTerminal` | **NO (Public Pair)** |
| `FEAT-KSK-002` | `kiosk_mode` | `GET /api/v1/kiosk/sessions/:id`| `kiosk.routes.ts` -> `KioskService.getSession`| `KioskSession` | **YES (`adminGroup`)** |
| `FEAT-IT-001` | `it_ops_queue` | `GET /api/v1/tasks/it-ops` | `task.routes.ts` -> `TaskService.getITQueue` | `Task` | **NO (Unguarded)** |
| `FEAT-GAM-001` | `gamified_milestones`| `GET /api/v1/gamification/points`| `gamification.routes.ts` -> `GamificationService`| `GamificationProfile`| **NO (Unguarded)** |
| `FEAT-GAM-002` | `gamification_badges`| `GET /api/v1/gamification/badges`| `gamification.routes.ts` -> `GamificationService`| `BadgeRecord` | **NO (Unguarded)** |
| `FEAT-LOC-001` | `office_map` | `GET /api/v1/locations/floors`| `office-location.routes.ts` -> `LocationService` | `OfficeLocation` | **NO (Unguarded)** |
| `FEAT-CAL-001` | `calendar_integration`| `POST /api/v1/calendar/sync` | `calendar.routes.ts` -> `CalendarService` | `CalendarSyncConfig`| **NO (Unguarded)** |
| `FEAT-KB-001` | `knowledge_base` | `GET /api/v1/knowledge-base/articles`| `knowledge-base.routes.ts` -> `KBService` | `Article` | **NO (Unguarded)** |
| `FEAT-AI-001` | `ai_assistant` | `POST /api/v1/ai/assistant/chat`| `ai-assistant.routes.ts` -> `AIProviderService` | `AIUsageRecord` | **NO (Unguarded)** |
| `FEAT-CER-001` | `certificates` | `GET /api/v1/certificates` | `certificate.routes.ts` -> `CertificateService` | `Certificate` | **NO (Unguarded)** |

---

## 3. Forensic Backend Guard Findings

1. **Only 2 Modules Implement Route-Level Feature Gating:**
   * `server/src/modules/kiosk/routes/kiosk.routes.ts` on `adminGroup` for `kiosk_mode`.
   * `server/src/modules/ai/routes/ai-assistant.routes.ts` on 7 endpoints for `ai_course_builder`.
2. **25 Backend Modules Have No Feature Flag Check:**
   Endpoints for journeys, documents, tasks, workflows, milestones, buddy pairings, calendar, gamification, office locations, and analytics execute without verifying whether the feature is enabled for the calling tenant.
3. **Severe Privilege Disparity:**
   If an administrator disables `gamified_milestones` or `digital_signatures` in the Super Admin Command Center, an API client can continue posting to `/api/v1/documents/:id/sign` or querying `/api/v1/gamification/leaderboard` successfully. The backend does not enforce the administrative decision.
