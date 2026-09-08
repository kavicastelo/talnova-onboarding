# 17 — Frontend ↔ Server Endpoint Gap Analysis

Document Purpose: Forensic comparison of the frontend API surface against the server's registered HTTP API surface.  
Frontend Source: [15-frontend-endpoint-inventory.md](file:///d:/talnova/talnova-onboarding/docs/audits/current/15-frontend-endpoint-inventory.md)  
Server Source: [16-server-endpoint-inventory.md](file:///d:/talnova/talnova-onboarding/docs/audits/current/16-server-endpoint-inventory.md)  
Code Modification: NONE.

---

## 1. Executive Summary

- **Frontend endpoint patterns:** 188
- **Server endpoint patterns:** 229

| Classification | Count | Description |
| :--- | :---: | :--- |
| **WIRED** | 185 | Frontend calls match server registered routes by method and normalized path. |
| **FRONTEND_ONLY** | 2 | Frontend attempts to call endpoints not registered on the server. |
| **METHOD_MISMATCH** | 0 | Same path exists, but HTTP method differs. |
| **PATH_MISMATCH** | 1 | Same capability, but URL path/extension differs between frontend and server. |
| **PARAMETER_MISMATCH** | 0 | Structurally incompatible dynamic route parameters. |
| **DUPLICATE_OR_ALIAS** | 11 | Server exposes secondary alias routes (`/api/v1/users/*` for `/api/v1/employees/*`). |
| **UNCERTAIN** | 0 | Endpoint alignment cannot be determined statically. |
| **SERVER_ONLY** | 33 | Server endpoints exposed but not referenced by the frontend codebase. |

---

## 2. Frontend → Server Wiring Matrix

| Module | Frontend Method | Frontend Endpoint Pattern | Server Registered Match | Classification | Evidence & Source Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | POST | `/api/v1/auth/login` | POST `/api/v1/auth/login` | **WIRED** | `src/services/auth.service.ts` + `server/src/modules/auth/routes/auth.routes.ts` |
| **Authentication** | POST | `/api/v1/auth/logout` | POST `/api/v1/auth/logout` | **WIRED** | `src/services/auth.service.ts` + `server/src/modules/auth/routes/auth.routes.ts` |
| **Authentication** | POST | `/api/v1/auth/refresh` | POST `/api/v1/auth/refresh` | **WIRED** | `src/api/client.ts` + `server/src/modules/auth/routes/auth.routes.ts` |
| **Authentication** | POST | `/api/v1/auth/forgot-password` | POST `/api/v1/auth/forgot-password` | **WIRED** | `src/services/auth.service.ts` + `server/src/modules/auth/routes/auth.routes.ts` |
| **Authentication** | POST | `/api/v1/auth/register` | POST `/api/v1/auth/register` | **WIRED** | `src/services/auth.service.ts` + `server/src/modules/auth/routes/auth.routes.ts` |
| **Authentication** | GET | `/api/v1/auth/sso/config` | GET `/api/v1/auth/sso/config` | **WIRED** | `src/services/sso.service.ts` + `server/src/modules/auth/routes/sso.routes.ts` |
| **Authentication** | PUT | `/api/v1/auth/sso/config` | PUT `/api/v1/auth/sso/config` | **WIRED** | `src/services/sso.service.ts` + `server/src/modules/auth/routes/sso.routes.ts` |
| **Authentication** | POST | `/api/v1/auth/sso/discover` | POST `/api/v1/auth/sso/discover` | **WIRED** | `src/services/sso.service.ts` + `server/src/modules/auth/routes/sso.routes.ts` |
| **Authentication** | POST | `/api/v1/auth/sso/initiate` | POST `/api/v1/auth/sso/initiate` | **WIRED** | `src/services/sso.service.ts` + `server/src/modules/auth/routes/sso.routes.ts` |
| **Organizations & Departments** | GET | `/api/v1/organizations/current` | GET `/api/v1/organizations/current` | **WIRED** | `src/services/settings.service.ts` + `server/src/modules/organizations/routes/organization.routes.ts` |
| **Organizations & Departments** | PATCH | `/api/v1/organizations/current` | PATCH `/api/v1/organizations/current` | **WIRED** | `src/services/settings.service.ts` + `server/src/modules/organizations/routes/organization.routes.ts` |
| **Organizations & Departments** | PATCH | `/api/v1/organizations/branding` | PATCH `/api/v1/organizations/branding` | **WIRED** | `src/services/settings.service.ts` + `server/src/modules/organizations/routes/organization.routes.ts` |
| **Organizations & Departments** | PATCH | `/api/v1/organizations/security` | PATCH `/api/v1/organizations/security` | **WIRED** | `src/services/settings.service.ts` + `server/src/modules/organizations/routes/organization.routes.ts` |
| **Organizations & Departments** | GET | `/api/v1/organizations/departments` | GET `/api/v1/organizations/departments` | **WIRED** | `src/services/employee.service.ts` + `server/src/modules/organizations/routes/organization.routes.ts` |
| **Organizations & Departments** | POST | `/api/v1/organizations/departments` | POST `/api/v1/organizations/departments` | **WIRED** | `src/services/employee.service.ts` + `server/src/modules/organizations/routes/organization.routes.ts` |
| **Organizations & Departments** | DELETE | `/api/v1/organizations/departments/:id` | DELETE `/api/v1/organizations/departments/:id` | **WIRED** | `src/services/settings.service.ts` + `server/src/modules/organizations/routes/organization.routes.ts` |
| **Employees** | GET | `/api/v1/employees/me` | GET `/api/v1/employees/me` | **WIRED** | `src/services/auth.service.ts` + `server/src/modules/employees/routes/employee.routes.ts` |
| **Employees** | PATCH | `/api/v1/employees/me` | PATCH `/api/v1/employees/me` | **WIRED** | `src/services/employee.service.ts` + `server/src/modules/employees/routes/employee.routes.ts` |
| **Employees** | PATCH | `/api/v1/employees/me/password` | PATCH `/api/v1/employees/me/password` | **WIRED** | `src/services/employee.service.ts` + `server/src/modules/employees/routes/employee.routes.ts` |
| **Employees** | PATCH | `/api/v1/employees/me/preferences` | PATCH `/api/v1/employees/me/preferences` | **WIRED** | `src/context/LanguageContext.tsx` + `server/src/modules/employees/routes/employee.routes.ts` |
| **Employees** | GET | `/api/v1/employees` | GET `/api/v1/employees` | **WIRED** | `src/services/employee.service.ts` + `server/src/modules/employees/routes/employee.routes.ts` |
| **Employees** | GET | `/api/v1/employees/:id` | GET `/api/v1/employees/:id` | **WIRED** | `src/services/employee.service.ts` + `server/src/modules/employees/routes/employee.routes.ts` |
| **Employees** | POST | `/api/v1/employees/invite` | POST `/api/v1/employees/invite` | **WIRED** | `src/services/employee.service.ts` + `server/src/modules/employees/routes/employee.routes.ts` |
| **Employees** | PATCH | `/api/v1/employees/:id` | PATCH `/api/v1/employees/:id` | **WIRED** | `src/services/employee.service.ts` + `server/src/modules/employees/routes/employee.routes.ts` |
| **Employees** | DELETE | `/api/v1/employees/:id` | DELETE `/api/v1/employees/:id` | **WIRED** | `src/services/employee.service.ts` + `server/src/modules/employees/routes/employee.routes.ts` |
| **Employees** | POST | `/api/v1/employees/import` | POST `/api/v1/employees/import` | **WIRED** | `src/services/employee.service.ts` + `server/src/modules/employees/routes/employee.routes.ts` |
| **Assignments & Journeys** | GET | `/api/v1/assignments/me` | GET `/api/v1/assignments/me` | **WIRED** | `src/services/employee.service.ts` + `server/src/modules/assignments/routes/assignment.routes.ts` |
| **Assignments & Journeys** | GET | `/api/v1/assignments` | GET `/api/v1/assignments` | **WIRED** | `src/services/employee.service.ts` + `server/src/modules/assignments/routes/assignment.routes.ts` |
| **Assignments & Journeys** | GET | `/api/v1/assignments/:id` | GET `/api/v1/assignments/:id` | **WIRED** | `src/services/course.service.ts` + `server/src/modules/assignments/routes/assignment.routes.ts` |
| **Assignments & Journeys** | GET | `/api/v1/assignments/public/verify/:id` | GET `/api/v1/assignments/public/verify/:id` | **WIRED** | `src/services/certificate.service.ts` + `server/src/modules/assignments/routes/assignment.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/assignments` | POST `/api/v1/assignments` | **WIRED** | `src/services/course.service.ts` + `server/src/modules/assignments/routes/assignment.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/assignments/bulk` | POST `/api/v1/assignments/bulk` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/assignments/routes/assignment.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:id/start` | POST `/api/v1/assignments/:id/start` | **WIRED** | `src/services/course.service.ts` + `server/src/modules/assignments/routes/assignment.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:id/complete-lesson` | POST `/api/v1/assignments/:id/complete-lesson` | **WIRED** | `src/services/course.service.ts` + `server/src/modules/assignments/routes/assignment.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:id/submit-quiz` | POST `/api/v1/assignments/:id/submit-quiz` | **WIRED** | `src/services/course.service.ts` + `server/src/modules/assignments/routes/assignment.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:assignmentId/progress` | — | **FRONTEND_ONLY** | `src/services/pwa.service.ts:61` (Missing server route) |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:assignmentId/issue-certificate` | POST `/api/v1/assignments/:id/issue-certificate` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/assignments/routes/assignment.routes.ts` |
| **Assignments & Journeys** | GET | `/api/v1/journeys` | GET `/api/v1/journeys` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | GET | `/api/v1/journeys/:id` | GET `/api/v1/journeys/:id` | **WIRED** | `src/services/course.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | GET | `/api/v1/journeys/:journeyId/prerequisites-check` | GET `/api/v1/journeys/:id/prerequisites-check` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/journeys` | POST `/api/v1/journeys` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | PATCH | `/api/v1/journeys/:id` | PATCH `/api/v1/journeys/:id` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | DELETE | `/api/v1/journeys/:id` | DELETE `/api/v1/journeys/:id` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:id/publish` | POST `/api/v1/journeys/:id/publish` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:id/archive` | POST `/api/v1/journeys/:id/archive` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:id/duplicate` | POST `/api/v1/journeys/:id/duplicate` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:journeyId/clone` | POST `/api/v1/journeys/:id/clone` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:journeyId/assignment-preview` | POST `/api/v1/journeys/:id/assignment-preview` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:journeyId/smart-assign` | POST `/api/v1/journeys/:id/smart-assign` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | PATCH | `/api/v1/journeys/:journeyId/targeting` | PATCH `/api/v1/journeys/:id/targeting` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | PUT | `/api/v1/journeys/:journeyId/reorder` | PUT `/api/v1/journeys/:id/reorder` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/reminders/dispatch` | POST `/api/v1/journeys/reminders/dispatch` | **WIRED** | `src/services/journey.service.ts` + `server/src/modules/journeys/routes/journey.routes.ts` |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/chat` | POST `/api/v1/ai/chat` | **WIRED** | `src/services/ai.service.ts` + `server/src/modules/ai/routes/ai-assistant.routes.ts` |
| **AI Assistant & Course Builder** | GET | `/api/v1/ai/conversations` | GET `/api/v1/ai/conversations` | **WIRED** | `src/services/ai.service.ts` + `server/src/modules/ai/routes/ai-assistant.routes.ts` |
| **AI Assistant & Course Builder** | GET | `/api/v1/ai/conversations/:id` | GET `/api/v1/ai/conversations/:id` | **WIRED** | `src/services/ai.service.ts` + `server/src/modules/ai/routes/ai-assistant.routes.ts` |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/feedback` | POST `/api/v1/ai/feedback` | **WIRED** | `src/services/ai.service.ts` + `server/src/modules/ai/routes/ai-assistant.routes.ts` |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/course-builder/generate` | POST `/api/v1/ai/course-builder/generate` | **WIRED** | `src/services/ai-course.service.ts` + `server/src/modules/ai/routes/ai-assistant.routes.ts` |
| **AI Assistant & Course Builder** | GET | `/api/v1/ai/course-builder/drafts` | GET `/api/v1/ai/course-builder/drafts` | **WIRED** | `src/services/ai-course.service.ts` + `server/src/modules/ai/routes/ai-assistant.routes.ts` |
| **AI Assistant & Course Builder** | GET | `/api/v1/ai/course-builder/drafts/:id` | GET `/api/v1/ai/course-builder/drafts/:id` | **WIRED** | `src/services/ai-course.service.ts` + `server/src/modules/ai/routes/ai-assistant.routes.ts` |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/course-builder/drafts/:draftId/regenerate-module` | POST `/api/v1/ai/course-builder/drafts/:id/regenerate-module` | **WIRED** | `src/services/ai-course.service.ts` + `server/src/modules/ai/routes/ai-assistant.routes.ts` |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/course-builder/drafts/:draftId/publish` | POST `/api/v1/ai/course-builder/drafts/:id/publish` | **WIRED** | `src/services/ai-course.service.ts` + `server/src/modules/ai/routes/ai-assistant.routes.ts` |
| **AI Assistant & Course Builder** | DELETE | `/api/v1/ai/course-builder/drafts/:draftId` | DELETE `/api/v1/ai/course-builder/drafts/:id` | **WIRED** | `src/services/ai-course.service.ts` + `server/src/modules/ai/routes/ai-assistant.routes.ts` |
| **Tasks** | GET | `/api/v1/tasks` | GET `/api/v1/tasks` | **WIRED** | `src/services/task.service.ts` + `server/src/modules/tasks/routes/task.routes.ts` |
| **Tasks** | GET | `/api/v1/tasks/:id` | GET `/api/v1/tasks/:id` | **WIRED** | `src/services/task.service.ts` + `server/src/modules/tasks/routes/task.routes.ts` |
| **Tasks** | POST | `/api/v1/tasks` | POST `/api/v1/tasks` | **WIRED** | `src/services/task.service.ts` + `server/src/modules/tasks/routes/task.routes.ts` |
| **Tasks** | PATCH | `/api/v1/tasks/:id/status` | PATCH `/api/v1/tasks/:id/status` | **WIRED** | `src/services/task.service.ts` + `server/src/modules/tasks/routes/task.routes.ts` |
| **Tasks** | POST | `/api/v1/tasks/:id/comments` | POST `/api/v1/tasks/:id/comments` | **WIRED** | `src/services/task.service.ts` + `server/src/modules/tasks/routes/task.routes.ts` |
| **Tasks** | DELETE | `/api/v1/tasks/:id` | DELETE `/api/v1/tasks/:id` | **WIRED** | `src/services/task.service.ts` + `server/src/modules/tasks/routes/task.routes.ts` |
| **Tasks** | POST | `/api/v1/tasks/:taskId/complete` | — | **FRONTEND_ONLY** | `src/services/pwa.service.ts:59` (Missing server route) |
| **Documents & E-Signatures** | POST | `/api/v1/documents/templates` | POST `/api/v1/documents/templates` | **WIRED** | `src/services/document.service.ts` + `server/src/modules/documents/routes/document.routes.ts` |
| **Documents & E-Signatures** | GET | `/api/v1/documents/templates` | GET `/api/v1/documents/templates` | **WIRED** | `src/services/document.service.ts` + `server/src/modules/documents/routes/document.routes.ts` |
| **Documents & E-Signatures** | PUT | `/api/v1/documents/templates/:id` | PUT `/api/v1/documents/templates/:id` | **WIRED** | `src/services/document.service.ts` + `server/src/modules/documents/routes/document.routes.ts` |
| **Documents & E-Signatures** | DELETE | `/api/v1/documents/templates/:id` | DELETE `/api/v1/documents/templates/:id` | **WIRED** | `src/services/document.service.ts` + `server/src/modules/documents/routes/document.routes.ts` |
| **Documents & E-Signatures** | POST | `/api/v1/documents/assign` | POST `/api/v1/documents/assign` | **WIRED** | `src/services/document.service.ts` + `server/src/modules/documents/routes/document.routes.ts` |
| **Documents & E-Signatures** | GET | `/api/v1/documents/inbox` | GET `/api/v1/documents/inbox` | **WIRED** | `src/services/document.service.ts` + `server/src/modules/documents/routes/document.routes.ts` |
| **Documents & E-Signatures** | GET | `/api/v1/documents/:id` | GET `/api/v1/documents/:id` | **WIRED** | `src/services/document.service.ts` + `server/src/modules/documents/routes/document.routes.ts` |
| **Documents & E-Signatures** | POST | `/api/v1/documents/:id/sign` | POST `/api/v1/documents/:id/sign` | **WIRED** | `src/services/document.service.ts` + `server/src/modules/documents/routes/document.routes.ts` |
| **Workflows** | GET | `/api/v1/workflows` | GET `/api/v1/workflows` | **WIRED** | `src/services/workflow.service.ts` + `server/src/modules/workflows/routes/workflow.routes.ts` |
| **Workflows** | GET | `/api/v1/workflows/:id` | GET `/api/v1/workflows/:id` | **WIRED** | `src/services/workflow.service.ts` + `server/src/modules/workflows/routes/workflow.routes.ts` |
| **Workflows** | POST | `/api/v1/workflows` | POST `/api/v1/workflows` | **WIRED** | `src/services/workflow.service.ts` + `server/src/modules/workflows/routes/workflow.routes.ts` |
| **Workflows** | PATCH | `/api/v1/workflows/:id` | PATCH `/api/v1/workflows/:id` | **WIRED** | `src/services/workflow.service.ts` + `server/src/modules/workflows/routes/workflow.routes.ts` |
| **Workflows** | PATCH | `/api/v1/workflows/:id/toggle` | PATCH `/api/v1/workflows/:id/toggle` | **WIRED** | `src/services/workflow.service.ts` + `server/src/modules/workflows/routes/workflow.routes.ts` |
| **Workflows** | DELETE | `/api/v1/workflows/:id` | DELETE `/api/v1/workflows/:id` | **WIRED** | `src/services/workflow.service.ts` + `server/src/modules/workflows/routes/workflow.routes.ts` |
| **Workflows** | GET | `/api/v1/workflows/executions` | GET `/api/v1/workflows/executions` | **WIRED** | `src/services/workflow.service.ts` + `server/src/modules/workflows/routes/workflow.routes.ts` |
| **Workflows** | POST | `/api/v1/workflows/:id/test-run` | POST `/api/v1/workflows/:id/test-run` | **WIRED** | `src/services/workflow.service.ts` + `server/src/modules/workflows/routes/workflow.routes.ts` |
| **Buddy & Support** | POST | `/api/v1/buddy/profiles` | POST `/api/v1/buddy/profiles` | **WIRED** | `src/services/buddy.service.ts` + `server/src/modules/buddy/routes/buddy.routes.ts` |
| **Buddy & Support** | GET | `/api/v1/buddy/available` | GET `/api/v1/buddy/available` | **WIRED** | `src/services/buddy.service.ts` + `server/src/modules/buddy/routes/buddy.routes.ts` |
| **Buddy & Support** | POST | `/api/v1/buddy/assign` | POST `/api/v1/buddy/assign` | **WIRED** | `src/services/buddy.service.ts` + `server/src/modules/buddy/routes/buddy.routes.ts` |
| **Buddy & Support** | GET | `/api/v1/buddy/my-buddy` | GET `/api/v1/buddy/my-buddy` | **WIRED** | `src/services/buddy.service.ts` + `server/src/modules/buddy/routes/buddy.routes.ts` |
| **Buddy & Support** | GET | `/api/v1/buddy/my-mentees` | GET `/api/v1/buddy/my-mentees` | **WIRED** | `src/services/buddy.service.ts` + `server/src/modules/buddy/routes/buddy.routes.ts` |
| **Buddy & Support** | PUT | `/api/v1/buddy/assignment/:assignmentId/checklist` | PUT `/api/v1/buddy/assignment/:id/checklist` | **WIRED** | `src/services/buddy.service.ts` + `server/src/modules/buddy/routes/buddy.routes.ts` |
| **Buddy & Support** | POST | `/api/v1/buddy/assignment/:assignmentId/checkin` | POST `/api/v1/buddy/assignment/:id/checkin` | **WIRED** | `src/services/buddy.service.ts` + `server/src/modules/buddy/routes/buddy.routes.ts` |
| **Milestones & Check-ins** | POST | `/api/v1/milestones/templates` | POST `/api/v1/milestones/templates` | **WIRED** | `src/services/milestone.service.ts` + `server/src/modules/milestones/routes/milestone.routes.ts` |
| **Milestones & Check-ins** | GET | `/api/v1/milestones/templates` | GET `/api/v1/milestones/templates` | **WIRED** | `src/services/milestone.service.ts` + `server/src/modules/milestones/routes/milestone.routes.ts` |
| **Milestones & Check-ins** | POST | `/api/v1/milestones/assign` | POST `/api/v1/milestones/assign` | **WIRED** | `src/services/milestone.service.ts` + `server/src/modules/milestones/routes/milestone.routes.ts` |
| **Milestones & Check-ins** | GET | `/api/v1/milestones/my-milestones` | GET `/api/v1/milestones/my-milestones` | **WIRED** | `src/services/milestone.service.ts` + `server/src/modules/milestones/routes/milestone.routes.ts` |
| **Milestones & Check-ins** | GET | `/api/v1/milestones/team-milestones` | GET `/api/v1/milestones/team-milestones` | **WIRED** | `src/services/milestone.service.ts` + `server/src/modules/milestones/routes/milestone.routes.ts` |
| **Milestones & Check-ins** | POST | `/api/v1/milestones/:id/self-checkin` | POST `/api/v1/milestones/:id/self-checkin` | **WIRED** | `src/services/milestone.service.ts` + `server/src/modules/milestones/routes/milestone.routes.ts` |
| **Milestones & Check-ins** | POST | `/api/v1/milestones/:id/manager-review` | POST `/api/v1/milestones/:id/manager-review` | **WIRED** | `src/services/milestone.service.ts` + `server/src/modules/milestones/routes/milestone.routes.ts` |
| **Calendar & Meetings** | POST | `/api/v1/calendar/connection` | POST `/api/v1/calendar/connection` | **WIRED** | `src/services/calendar.service.ts` + `server/src/modules/calendar/routes/calendar.routes.ts` |
| **Calendar & Meetings** | GET | `/api/v1/calendar/connection` | GET `/api/v1/calendar/connection` | **WIRED** | `src/services/calendar.service.ts` + `server/src/modules/calendar/routes/calendar.routes.ts` |
| **Calendar & Meetings** | POST | `/api/v1/calendar/events` | POST `/api/v1/calendar/events` | **WIRED** | `src/services/calendar.service.ts` + `server/src/modules/calendar/routes/calendar.routes.ts` |
| **Calendar & Meetings** | GET | `/api/v1/calendar/events` | GET `/api/v1/calendar/events` | **WIRED** | `src/services/calendar.service.ts` + `server/src/modules/calendar/routes/calendar.routes.ts` |
| **Calendar & Meetings** | PUT | `/api/v1/calendar/events/:id` | PUT `/api/v1/calendar/events/:id` | **WIRED** | `src/services/calendar.service.ts` + `server/src/modules/calendar/routes/calendar.routes.ts` |
| **Calendar & Meetings** | DELETE | `/api/v1/calendar/events/:id` | DELETE `/api/v1/calendar/events/:id` | **WIRED** | `src/services/calendar.service.ts` + `server/src/modules/calendar/routes/calendar.routes.ts` |
| **Calendar & Meetings** | GET | `/api/v1/calendar/feed/:token.ics` | GET `/api/v1/calendar/feed/:token` | **PATH_MISMATCH** | `src/pages/CalendarIntegration.tsx:63` + `server/src/modules/calendar/routes/calendar.routes.ts:16` |
| **HR Operations** | GET | `/api/v1/hr/dashboard` | GET `/api/v1/hr/dashboard` | **WIRED** | `src/services/hr.service.ts` + `server/src/modules/hr/routes/hr-operations.routes.ts` |
| **HR Operations** | GET | `/api/v1/hr/exceptions` | GET `/api/v1/hr/exceptions` | **WIRED** | `src/services/hr.service.ts` + `server/src/modules/hr/routes/hr-operations.routes.ts` |
| **HR Operations** | PUT | `/api/v1/hr/lifecycle/:userId/state` | PUT `/api/v1/hr/lifecycle/:userId/state` | **WIRED** | `src/services/hr.service.ts` + `server/src/modules/hr/routes/hr-operations.routes.ts` |
| **HR Operations** | POST | `/api/v1/hr/bulk-action` | POST `/api/v1/hr/bulk-action` | **WIRED** | `src/services/hr.service.ts` + `server/src/modules/hr/routes/hr-operations.routes.ts` |
| **HR Operations** | GET | `/api/v1/hr/compliance-report` | GET `/api/v1/hr/compliance-report` | **WIRED** | `src/services/hr.service.ts` + `server/src/modules/hr/routes/hr-operations.routes.ts` |
| **Manager Operations** | GET | `/api/v1/manager/dashboard` | GET `/api/v1/manager/dashboard` | **WIRED** | `src/services/manager.service.ts` + `server/src/modules/manager/routes/manager.routes.ts` |
| **Manager Operations** | GET | `/api/v1/manager/team` | GET `/api/v1/manager/team` | **WIRED** | `src/services/manager.service.ts` + `server/src/modules/manager/routes/manager.routes.ts` |
| **Manager Operations** | GET | `/api/v1/manager/team/:employeeId` | GET `/api/v1/manager/team/:employeeId` | **WIRED** | `src/services/manager.service.ts` + `server/src/modules/manager/routes/manager.routes.ts` |
| **Manager Operations** | POST | `/api/v1/manager/team/:employeeId/nudge` | POST `/api/v1/manager/team/:employeeId/nudge` | **WIRED** | `src/services/manager.service.ts` + `server/src/modules/manager/routes/manager.routes.ts` |
| **Manager Operations** | POST | `/api/v1/manager/team/:employeeId/sign-off` | POST `/api/v1/manager/team/:employeeId/sign-off` | **WIRED** | `src/services/manager.service.ts` + `server/src/modules/manager/routes/manager.routes.ts` |
| **Analytics & Reporting** | GET | `/api/v1/analytics/summary` | GET `/api/v1/analytics/summary` | **WIRED** | `src/services/analytics.service.ts` + `server/src/modules/analytics/routes/analytics.routes.ts` |
| **Analytics & Reporting** | GET | `/api/v1/analytics/time-to-completion` | GET `/api/v1/analytics/time-to-completion` | **WIRED** | `src/services/analytics.service.ts` + `server/src/modules/analytics/routes/analytics.routes.ts` |
| **Analytics & Reporting** | GET | `/api/v1/analytics/bottlenecks` | GET `/api/v1/analytics/bottlenecks` | **WIRED** | `src/services/analytics.service.ts` + `server/src/modules/analytics/routes/analytics.routes.ts` |
| **Analytics & Reporting** | GET | `/api/v1/analytics/export` | GET `/api/v1/analytics/export` | **WIRED** | `src/services/analytics.service.ts` + `server/src/modules/analytics/routes/analytics.routes.ts` |
| **Analytics & Reporting** | GET | `/api/v1/analytics/scheduled-reports` | GET `/api/v1/analytics/scheduled-reports` | **WIRED** | `src/services/analytics.service.ts` + `server/src/modules/analytics/routes/analytics.routes.ts` |
| **Analytics & Reporting** | POST | `/api/v1/analytics/scheduled-reports` | POST `/api/v1/analytics/scheduled-reports` | **WIRED** | `src/services/analytics.service.ts` + `server/src/modules/analytics/routes/analytics.routes.ts` |
| **Analytics & Reporting** | DELETE | `/api/v1/analytics/scheduled-reports/:id` | DELETE `/api/v1/analytics/scheduled-reports/:id` | **WIRED** | `src/services/analytics.service.ts` + `server/src/modules/analytics/routes/analytics.routes.ts` |
| **Analytics & Reporting** | GET | `/api/v1/audit-logs` | GET `/api/v1/audit-logs` | **WIRED** | `src/services/dashboard.service.ts` + `server/src/modules/audit-logs/routes/audit-log.routes.ts` |
| **Gamification** | GET | `/api/v1/gamification/profile` | GET `/api/v1/gamification/profile` | **WIRED** | `src/services/gamification.service.ts` + `server/src/modules/gamification/routes/gamification.routes.ts` |
| **Gamification** | POST | `/api/v1/gamification/award-points` | POST `/api/v1/gamification/award-points` | **WIRED** | `src/services/gamification.service.ts` + `server/src/modules/gamification/routes/gamification.routes.ts` |
| **Gamification** | POST | `/api/v1/gamification/streak` | POST `/api/v1/gamification/streak` | **WIRED** | `src/services/gamification.service.ts` + `server/src/modules/gamification/routes/gamification.routes.ts` |
| **Gamification** | GET | `/api/v1/gamification/leaderboard` | GET `/api/v1/gamification/leaderboard` | **WIRED** | `src/services/gamification.service.ts` + `server/src/modules/gamification/routes/gamification.routes.ts` |
| **Knowledge Base** | GET | `/api/v1/knowledge-base` | GET `/api/v1/knowledge-base` | **WIRED** | `src/services/knowledgeBase.service.ts` + `server/src/modules/knowledge-base/routes/article.routes.ts` |
| **Knowledge Base** | GET | `/api/v1/knowledge-base/:id` | GET `/api/v1/knowledge-base/:id` | **WIRED** | `src/services/knowledgeBase.service.ts` + `server/src/modules/knowledge-base/routes/article.routes.ts` |
| **Knowledge Base** | POST | `/api/v1/knowledge-base` | POST `/api/v1/knowledge-base` | **WIRED** | `src/services/knowledgeBase.service.ts` + `server/src/modules/knowledge-base/routes/article.routes.ts` |
| **Knowledge Base** | PATCH | `/api/v1/knowledge-base/:id` | PATCH `/api/v1/knowledge-base/:id` | **WIRED** | `src/services/knowledgeBase.service.ts` + `server/src/modules/knowledge-base/routes/article.routes.ts` |
| **Knowledge Base** | DELETE | `/api/v1/knowledge-base/:id` | DELETE `/api/v1/knowledge-base/:id` | **WIRED** | `src/services/knowledgeBase.service.ts` + `server/src/modules/knowledge-base/routes/article.routes.ts` |
| **Knowledge Base** | POST | `/api/v1/knowledge-base/:id/publish` | POST `/api/v1/knowledge-base/:id/publish` | **WIRED** | `src/services/knowledgeBase.service.ts` + `server/src/modules/knowledge-base/routes/article.routes.ts` |
| **Knowledge Base** | POST | `/api/v1/knowledge-base/:id/archive` | POST `/api/v1/knowledge-base/:id/archive` | **WIRED** | `src/services/knowledgeBase.service.ts` + `server/src/modules/knowledge-base/routes/article.routes.ts` |
| **Knowledge Base** | GET | `/api/v1/knowledge-base/quick-links` | GET `/api/v1/knowledge-base/quick-links` | **WIRED** | `src/services/knowledgeBase.service.ts` + `server/src/modules/knowledge-base/routes/article.routes.ts` |
| **Knowledge Base** | POST | `/api/v1/knowledge-base/quick-links` | POST `/api/v1/knowledge-base/quick-links` | **WIRED** | `src/services/knowledgeBase.service.ts` + `server/src/modules/knowledge-base/routes/article.routes.ts` |
| **Knowledge Base** | PATCH | `/api/v1/knowledge-base/quick-links/:id` | PATCH `/api/v1/knowledge-base/quick-links/:id` | **WIRED** | `src/services/knowledgeBase.service.ts` + `server/src/modules/knowledge-base/routes/article.routes.ts` |
| **Knowledge Base** | DELETE | `/api/v1/knowledge-base/quick-links/:id` | DELETE `/api/v1/knowledge-base/quick-links/:id` | **WIRED** | `src/services/knowledgeBase.service.ts` + `server/src/modules/knowledge-base/routes/article.routes.ts` |
| **Location & Maps** | GET | `/api/v1/locations` | GET `/api/v1/locations` | **WIRED** | `src/services/location.service.ts` + `server/src/modules/locations/routes/office-location.routes.ts` |
| **Location & Maps** | GET | `/api/v1/locations/:id` | GET `/api/v1/locations/:id` | **WIRED** | `src/services/location.service.ts` + `server/src/modules/locations/routes/office-location.routes.ts` |
| **Location & Maps** | POST | `/api/v1/locations` | POST `/api/v1/locations` | **WIRED** | `src/services/location.service.ts` + `server/src/modules/locations/routes/office-location.routes.ts` |
| **Location & Maps** | POST | `/api/v1/locations/:locationId/assign-desk` | POST `/api/v1/locations/:id/assign-desk` | **WIRED** | `src/services/location.service.ts` + `server/src/modules/locations/routes/office-location.routes.ts` |
| **Location & Maps** | GET | `/api/v1/locations/my-location` | GET `/api/v1/locations/my-location` | **WIRED** | `src/services/location.service.ts` + `server/src/modules/locations/routes/office-location.routes.ts` |
| **Integrations** | GET | `/api/v1/integrations` | GET `/api/v1/integrations` | **WIRED** | `src/services/integration.service.ts` + `server/src/modules/integrations/routes/hris-integration.routes.ts` |
| **Integrations** | POST | `/api/v1/integrations` | POST `/api/v1/integrations` | **WIRED** | `src/services/integration.service.ts` + `server/src/modules/integrations/routes/hris-integration.routes.ts` |
| **Integrations** | PUT | `/api/v1/integrations/:id` | PUT `/api/v1/integrations/:id` | **WIRED** | `src/services/integration.service.ts` + `server/src/modules/integrations/routes/hris-integration.routes.ts` |
| **Integrations** | DELETE | `/api/v1/integrations/:id` | DELETE `/api/v1/integrations/:id` | **WIRED** | `src/services/integration.service.ts` + `server/src/modules/integrations/routes/hris-integration.routes.ts` |
| **Integrations** | POST | `/api/v1/integrations/:id/test` | POST `/api/v1/integrations/:id/test` | **WIRED** | `src/services/integration.service.ts` + `server/src/modules/integrations/routes/hris-integration.routes.ts` |
| **Integrations** | POST | `/api/v1/integrations/:id/sync` | POST `/api/v1/integrations/:id/sync` | **WIRED** | `src/services/integration.service.ts` + `server/src/modules/integrations/routes/hris-integration.routes.ts` |
| **Integrations** | GET | `/api/v1/integrations/:id/logs` | GET `/api/v1/integrations/:id/logs` | **WIRED** | `src/services/integration.service.ts` + `server/src/modules/integrations/routes/hris-integration.routes.ts` |
| **Notifications & Push** | GET | `/api/v1/notifications` | GET `/api/v1/notifications` | **WIRED** | `src/services/notification.service.ts` + `server/src/modules/notifications/routes/notification.routes.ts` |
| **Notifications & Push** | GET | `/api/v1/notifications/count` | GET `/api/v1/notifications/count` | **WIRED** | `src/services/notification.service.ts` + `server/src/modules/notifications/routes/notification.routes.ts` |
| **Notifications & Push** | PATCH | `/api/v1/notifications/:id/read` | PATCH `/api/v1/notifications/:id/read` | **WIRED** | `src/services/notification.service.ts` + `server/src/modules/notifications/routes/notification.routes.ts` |
| **Notifications & Push** | PATCH | `/api/v1/notifications/read-all` | PATCH `/api/v1/notifications/read-all` | **WIRED** | `src/services/notification.service.ts` + `server/src/modules/notifications/routes/notification.routes.ts` |
| **Notifications & Push** | GET | `/api/v1/notifications/preferences` | GET `/api/v1/notifications/preferences` | **WIRED** | `src/services/notification.service.ts` + `server/src/modules/notifications/routes/notification.routes.ts` |
| **Notifications & Push** | PUT | `/api/v1/notifications/preferences` | PUT `/api/v1/notifications/preferences` | **WIRED** | `src/services/notification.service.ts` + `server/src/modules/notifications/routes/notification.routes.ts` |
| **Notifications & Push** | POST | `/api/v1/notifications/push-subscription` | POST `/api/v1/notifications/push-subscription` | **WIRED** | `src/services/pwa.service.ts` + `server/src/modules/notifications/routes/notification.routes.ts` |
| **Notifications & Push** | DELETE | `/api/v1/notifications/push-subscription` | DELETE `/api/v1/notifications/push-subscription` | **WIRED** | `src/services/pwa.service.ts` + `server/src/modules/notifications/routes/notification.routes.ts` |
| **Uploads & Storage** | POST | `/api/v1/uploads/request-url` | POST `/api/v1/uploads/request-url` | **WIRED** | `src/services/upload.service.ts` + `server/src/modules/uploads/routes/upload.routes.ts` |
| **Uploads & Storage** | PUT | `<uploadUrl>` | Direct S3/R2 presigned URL | **WIRED** | `src/services/upload.service.ts` + External Cloud Presigned Storage |
| **Uploads & Storage** | POST | `/api/v1/uploads/complete` | POST `/api/v1/uploads/complete` | **WIRED** | `src/services/upload.service.ts` + `server/src/modules/uploads/routes/upload.routes.ts` |
| **Super Admin** | GET | `/api/v1/super-admin/telemetry` | GET `/api/v1/super-admin/telemetry` | **WIRED** | `src/services/superAdmin.service.ts` + `server/src/modules/super-admin/routes/super-admin.routes.ts` |
| **Super Admin** | GET | `/api/v1/super-admin/activity-logs` | GET `/api/v1/super-admin/activity-logs` | **WIRED** | `src/services/superAdmin.service.ts` + `server/src/modules/super-admin/routes/super-admin.routes.ts` |
| **Super Admin** | GET | `/api/v1/super-admin/organizations` | GET `/api/v1/super-admin/organizations` | **WIRED** | `src/services/superAdmin.service.ts` + `server/src/modules/super-admin/routes/super-admin.routes.ts` |
| **Super Admin** | POST | `/api/v1/super-admin/organizations` | POST `/api/v1/super-admin/organizations` | **WIRED** | `src/services/superAdmin.service.ts` + `server/src/modules/super-admin/routes/super-admin.routes.ts` |
| **Super Admin** | PATCH | `/api/v1/super-admin/organizations/:id/status` | PATCH `/api/v1/super-admin/organizations/:id/status` | **WIRED** | `src/services/superAdmin.service.ts` + `server/src/modules/super-admin/routes/super-admin.routes.ts` |
| **Super Admin** | GET | `/api/v1/super-admin/invoices` | GET `/api/v1/super-admin/invoices` | **WIRED** | `src/services/superAdmin.service.ts` + `server/src/modules/super-admin/routes/super-admin.routes.ts` |
| **Super Admin** | POST | `/api/v1/super-admin/invoices` | POST `/api/v1/super-admin/invoices` | **WIRED** | `src/services/superAdmin.service.ts` + `server/src/modules/super-admin/routes/super-admin.routes.ts` |
| **Super Admin** | GET | `/api/v1/super-admin/invoices/export` | GET `/api/v1/super-admin/invoices/export` | **WIRED** | `src/services/superAdmin.service.ts` + `server/src/modules/super-admin/routes/super-admin.routes.ts` |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/journeys` | POST `/api/v1/kiosk/journeys` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | GET | `/api/v1/kiosk/journeys` | GET `/api/v1/kiosk/journeys` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | GET | `/api/v1/kiosk/journeys/:id` | GET `/api/v1/kiosk/journeys/:id` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | PUT | `/api/v1/kiosk/journeys/:id` | PUT `/api/v1/kiosk/journeys/:id` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | DELETE | `/api/v1/kiosk/journeys/:id` | DELETE `/api/v1/kiosk/journeys/:id` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/journeys/:id/publish` | POST `/api/v1/kiosk/journeys/:id/publish` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/devices/pair` | POST `/api/v1/kiosk/devices/pair` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/devices/pair/code` | POST `/api/v1/kiosk/devices/pair/code` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/devices/heartbeat` | POST `/api/v1/kiosk/devices/heartbeat` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | GET | `/api/v1/kiosk/devices` | GET `/api/v1/kiosk/devices` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | PUT | `/api/v1/kiosk/devices/:id/status` | PUT `/api/v1/kiosk/devices/:id/status` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/devices/:deviceId/pair-journey` | POST `/api/v1/kiosk/devices/:id/pair-journey` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/journeys/:journeyId/auth/pin` | POST `/api/v1/kiosk/journeys/:id/auth/pin` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/analytics/sync` | POST `/api/v1/kiosk/analytics/sync` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | GET | `/api/v1/kiosk/journeys/play/:journeyId` | GET `/api/v1/kiosk/journeys/play/:id` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | GET | `/api/v1/kiosk/journeys/:journeyId/analytics` | GET `/api/v1/kiosk/journeys/:id/analytics` | **WIRED** | `src/features/kiosk/services/kiosk.service.ts` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Kiosk & Field Access** | GET | `/api/v1/kiosk/uploads/:uploadId` | GET `/api/v1/kiosk/uploads/:id` | **WIRED** | `src/features/kiosk/components/KioskPlayer.tsx` + `server/src/modules/kiosk/routes/kiosk.routes.ts` |
| **Localization** | POST | `/api/v1/localization/translate-realtime` | POST `/api/v1/localization/translate-realtime` | **WIRED** | `src/pages/CourseViewer.tsx` + `server/src/modules/localization/routes/localization.routes.ts` |

---

## 3. Critical Frontend-Only Endpoints

### GAP-FE-001
- **Module:** Assignments & Journeys (PWA / Mobile Field Operations)
- **Frontend Endpoint:** `POST /api/v1/assignments/:assignmentId/progress`
- **Method:** `POST`
- **Frontend Location:** `src/services/pwa.service.ts:61` (`flushOfflineQueue`)
- **Why it appears to be missing:** The PWA offline service attempts to flush offline journey progress to `/api/v1/assignments/:assignmentId/progress`. However, the server's `assignment.routes.ts` exposes `/complete-lesson` and `/submit-quiz`, but no generic `/progress` sync route.
- **Severity:** HIGH (Breaks PWA offline background sync for journey progress).

### GAP-FE-002
- **Module:** Tasks & Checklist (PWA / Mobile Field Operations)
- **Frontend Endpoint:** `POST /api/v1/tasks/:taskId/complete`
- **Method:** `POST`
- **Frontend Location:** `src/services/pwa.service.ts:59` (`flushOfflineQueue`)
- **Why it appears to be missing:** The PWA offline service attempts to flush offline task completions to `/api/v1/tasks/:taskId/complete`. However, the server's `task.routes.ts` requires updating task status via `PATCH /api/v1/tasks/:id/status`. No `POST /complete` sub-route exists on the server.
- **Severity:** HIGH (Breaks PWA offline background sync for task completions).

---

## 4. Method Mismatches

*Audit Finding:* No HTTP method mismatches exist between the frontend and server for matching normalized route paths.

---

## 5. Path Mismatches

### GAP-PATH-001
- **Frontend Path:** `GET /api/v1/calendar/feed/:token.ics`
- **Server Path:** `GET /api/v1/calendar/feed/:token`
- **Frontend Source:** `src/pages/CalendarIntegration.tsx:63`
- **Server Source:** `server/src/modules/calendar/routes/calendar.routes.ts:16`
- **Reason they represent the same capability:** Both frontend and server intend to serve the employee's personal iCal calendar feed. The frontend constructs the URL with an explicit `.ics` extension (`/calendar/feed/${token}.ics`), whereas the Fastify server route is declared without an extension (`/feed/:token`). When the frontend requests `/calendar/feed/token123.ics`, Fastify matches `:token` to `"token123.ics"` instead of `"token123"`, causing database lookup failures for the token.
- **Severity:** MEDIUM (Prevents native calendar subscription synchronization in Outlook/Apple Calendar).

---

## 6. Parameter Mismatches

*Audit Finding:* No structural parameter mismatches exist. Dynamic parameters across services (e.g., `:id`, `:journeyId`, `:assignmentId`, `:employeeId`, `:locationId`) map to corresponding URL segment positions on the server.

---

## 7. Backend Aliases / Duplicate Routes

The server registers `employeeRoutes` (`server/src/modules/employees/routes/employee.routes.ts`) under **two distinct route prefixes** in `server/src/app.ts:82-83`:

1. `/api/v1/employees` (Primary API route)
2. `/api/v1/users` (Legacy/compatibility route alias)

### Exposed Alias Routes:
- `GET /api/v1/users/me` (Alias for `GET /api/v1/employees/me`)
- `PATCH /api/v1/users/me` (Alias for `PATCH /api/v1/employees/me`)
- `PATCH /api/v1/users/preferences` (Alias for `PATCH /api/v1/employees/preferences`)
- `PATCH /api/v1/users/me/preferences` (Alias for `PATCH /api/v1/employees/me/preferences`)
- `PATCH /api/v1/users/me/password` (Alias for `PATCH /api/v1/employees/me/password`)
- `GET /api/v1/users` (Alias for `GET /api/v1/employees`)
- `POST /api/v1/users/invite` (Alias for `POST /api/v1/employees/invite`)
- `POST /api/v1/users/import` (Alias for `POST /api/v1/users/import`)
- `GET /api/v1/users/:id` (Alias for `GET /api/v1/users/:id`)
- `PATCH /api/v1/users/:id` (Alias for `PATCH /api/v1/users/:id`)
- `DELETE /api/v1/users/:id` (Alias for `DELETE /api/v1/users/:id`)

*Frontend Usage*: The frontend strictly calls `/api/v1/employees/*`. The `/api/v1/users/*` routes are backward-compatibility aliases present on the server.

---

## 8. Server-Only Endpoint Inventory

The server exposes 33 endpoints that are not directly called by the current frontend codebase:

### Clearly Frontend-Relevant Endpoints (Exposed on Server, UI Not Yet Wired)
- `GET /api/v1/organizations/teams` (`organization.routes.ts:83`)
- `POST /api/v1/organizations/teams` (`organization.routes.ts:85`)
- `PATCH /api/v1/organizations/teams/:id` (`organization.routes.ts:94`)
- `DELETE /api/v1/organizations/teams/:id` (`organization.routes.ts:103`)
- `PATCH /api/v1/organizations/departments/:id` (`organization.routes.ts:67`)
- `GET /api/v1/assignments/me/active` (`assignment.routes.ts:27`)
- `GET /api/v1/assignments/me/completed` (`assignment.routes.ts:30`)
- `GET /api/v1/notifications/unread` (`notification.routes.ts:23`)
- `GET /api/v1/localization/supported-locales` (`localization.routes.ts:12`)
- `GET /api/v1/localization/:entityType/:entityId` (`localization.routes.ts:18`)

### Likely Backend, Operations & Integration Endpoints (Valid Server Functionality)
- `GET /live` (`app.ts:106` — Infrastructure Liveness Probe)
- `GET /ready` (`app.ts:110` — Infrastructure Readiness Probe)
- `GET /health` (`app.ts:132` — Database Health Probe)
- `POST /api/v1/auth/reset-password` (`auth.routes.ts:202` — Email Token Password Reset)
- `POST /api/v1/auth/invitations/accept` (`auth.routes.ts:213` — Invitation Token Acceptance)
- `POST /api/v1/auth/sso/callback` (`sso.routes.ts:13` — Identity Provider OAuth Callback)
- `POST /api/v1/uploads/presigned` (`upload.routes.ts:24` — Presigned Upload Alias)
- `POST /api/v1/hr/handover/:userId/complete` (`hr-operations.routes.ts:20` — Server Handover Engine)
- `POST /api/v1/integrations/webhooks/:provider` (`hris-integration.routes.ts:11` — Inbound HRIS Webhook Listener)
- `GET /api/v1/audit-logs/export` (`audit-log.routes.ts:17` — Audit Log CSV Export)
- `GET /api/v1/audit-logs/security` (`audit-log.routes.ts:20` — Security Audit Stream)
- `GET /api/v1/localization/admin/:entityType/:entityId/translations` (`localization.routes.ts:29`)
- `PUT /api/v1/localization/admin/:entityType/:entityId/:field/:lang` (`localization.routes.ts:36`)
- `POST /api/v1/localization/admin/:entityType/:entityId/:field/:lang/approve` (`localization.routes.ts:43`)
- `GET /api/v1/localization/admin/missing` (`localization.routes.ts:52`)
- `GET /api/v1/localization/admin/outdated` (`localization.routes.ts:55`)
- `GET /api/v1/localization/admin/coverage` (`localization.routes.ts:58`)

### Uncertain / Internal Governance Endpoints
- `GET /api/v1/audit-logs/user/:userId` (`audit-log.routes.ts:23`)
- `GET /api/v1/audit-logs/resource/:resourceType/:resourceId` (`audit-log.routes.ts:26`)
- `GET /api/v1/audit-logs/:id` (`audit-log.routes.ts:29`)

---

## 9. High-Risk Wiring Gaps

| Gap ID | Affected Onboarding Lifecycle Area | Frontend Behavior | Server Behavior | Classification | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-FE-001** | Mobile / Field Progress Sync | PWA service flushes offline progress to `/assignments/:id/progress` | Server lacks `/assignments/:id/progress` route | **FRONTEND_ONLY** | **HIGH** |
| **GAP-FE-002** | Mobile / Field Task Execution | PWA service flushes offline task completions to `/tasks/:id/complete` | Server expects `PATCH /tasks/:id/status` | **FRONTEND_ONLY** | **HIGH** |
| **GAP-PATH-001**| Calendar Integration | Frontend appends `.ics` extension (`/calendar/feed/:token.ics`) | Server registers `/calendar/feed/:token` | **PATH_MISMATCH** | **MEDIUM** |

---

## 10. Unified Onboarding Critical Path Wiring

| Lifecycle Stage | Frontend Endpoint Surface | Server Endpoint Surface | Wiring Status |
| :--- | :--- | :--- | :--- |
| **1. Employee Creation** | `POST /api/v1/employees/invite` & `import` | `POST /api/v1/employees/invite` & `import` | **WIRED** |
| **2. Workflow Evaluation** | `POST /api/v1/workflows` & `GET /executions` | `POST /api/v1/workflows` & `GET /executions` | **WIRED** |
| **3. Journey Assignment** | `POST /api/v1/assignments` & `bulk` | `POST /api/v1/assignments` & `bulk` | **WIRED** |
| **4. Task / Document / Milestone Dispatch** | `POST /tasks`, `/documents/assign`, `/milestones/assign` | `POST /tasks`, `/documents/assign`, `/milestones/assign` | **WIRED** |
| **5. Employee Execution (Online)** | `POST /assignments/:id/complete-lesson` & `submit-quiz` | `POST /assignments/:id/complete-lesson` & `submit-quiz` | **WIRED** |
| **6. Employee Execution (Offline PWA)** | `POST /assignments/:id/progress`, `/tasks/:id/complete` | *Missing `/progress` and `/complete` endpoints* | **FRONTEND_ONLY** |
| **7. E-Signature Execution** | `POST /api/v1/documents/:id/sign` | `POST /api/v1/documents/:id/sign` | **WIRED** |
| **8. Completion Evaluation** | `POST /api/v1/assignments/:id/issue-certificate` | `POST /api/v1/assignments/:id/issue-certificate` | **WIRED** |
| **9. Handover Operations** | `POST /api/v1/manager/team/:id/sign-off` | `POST /api/v1/manager/team/:id/sign-off` | **WIRED** |
| **10. Lifecycle State Update** | `PUT /api/v1/hr/lifecycle/:userId/state` | `PUT /api/v1/hr/lifecycle/:userId/state` | **WIRED** |

---

## 11. Findings That Require a Later Payload/Contract Audit

While the matching endpoints below share normalized route paths and HTTP methods, they require a deep payload/schema compatibility audit in the next phase to verify request body, query parameter, DTO validation, and response data shape alignment:

1. `POST /api/v1/workflows` (Verify `WorkflowRule` triggers, conditions, and actions schema alignment).
2. `POST /api/v1/journeys/:journeyId/smart-assign` (Verify target audience filter parameters and response statistics payload).
3. `POST /api/v1/documents/:id/sign` (Verify signature canvas data format, signer identity DTO, and SHA256 audit hash generation).
4. `PUT /api/v1/hr/lifecycle/:userId/state` (Verify onboarding state enum values and extension days parameters).
5. `POST /api/v1/hr/bulk-action` (Verify bulk payload action types and ID list formats).
6. `POST /api/v1/ai/course-builder/generate` (Verify AI prompt inputs and generated course JSON structure).
7. `POST /api/v1/kiosk/devices/heartbeat` (Verify kiosk telemetry payload schema).

---

## 12. Recommended Next Audit Phase

Proceed to:

**Phase 4D — Frontend ↔ Server API Contract Compatibility Audit**

That phase will evaluate matching endpoints for:
- Request body payload alignment
- Query string parameter alignment
- Response JSON structure and envelope compatibility (`ApiResponse<T>`)
- TypeScript interfaces vs backend Zod validator schemas
- Error status codes and error payload handling
- Authentication/role authorization preHandler expectations
