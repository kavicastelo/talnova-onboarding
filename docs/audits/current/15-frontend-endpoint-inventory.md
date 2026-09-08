# 15 — Frontend Endpoint Inventory

Document Purpose: Code-grounded inventory of backend API endpoints referenced by the Talnova frontend.
Audit Scope: Frontend source code only.
Backend comparison: NOT performed in this phase.
Code modification: NONE.

---

## 1. Endpoint Inventory

| Module | HTTP Method | Endpoint | Frontend Location | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | POST | `/api/v1/auth/login` | `src/services/auth.service.ts` | User login |
| **Authentication** | POST | `/api/v1/auth/logout` | `src/services/auth.service.ts` | User logout |
| **Authentication** | POST | `/api/v1/auth/refresh` | `src/api/client.ts` | Refresh access token |
| **Authentication** | POST | `/api/v1/auth/forgot-password` | `src/services/auth.service.ts` | Password reset request |
| **Authentication** | POST | `/api/v1/auth/register` | `src/services/auth.service.ts` | User self-registration |
| **Authentication** | GET | `/api/v1/auth/sso/config` | `src/services/sso.service.ts` | Fetch SSO configuration |
| **Authentication** | PUT | `/api/v1/auth/sso/config` | `src/services/sso.service.ts` | Update SSO configuration |
| **Authentication** | POST | `/api/v1/auth/sso/discover` | `src/services/sso.service.ts` | Discover SSO domain configuration |
| **Authentication** | POST | `/api/v1/auth/sso/initiate` | `src/services/sso.service.ts` | Initiate SSO login flow |
| **Organizations & Departments** | GET | `/api/v1/organizations/current` | `src/services/auth.service.ts`, `src/services/dashboard.service.ts`, `src/services/settings.service.ts` | Get current organization details |
| **Organizations & Departments** | PATCH | `/api/v1/organizations/current` | `src/services/settings.service.ts` | Update organization settings |
| **Organizations & Departments** | PATCH | `/api/v1/organizations/branding` | `src/services/settings.service.ts` | Update organization branding |
| **Organizations & Departments** | PATCH | `/api/v1/organizations/security` | `src/services/settings.service.ts` | Update security settings |
| **Organizations & Departments** | GET | `/api/v1/organizations/departments` | `src/services/employee.service.ts`, `src/services/settings.service.ts` | List organization departments |
| **Organizations & Departments** | POST | `/api/v1/organizations/departments` | `src/services/employee.service.ts`, `src/services/settings.service.ts` | Create department |
| **Organizations & Departments** | DELETE | `/api/v1/organizations/departments/:id` | `src/services/settings.service.ts` | Delete department |
| **Employees** | GET | `/api/v1/employees/me` | `src/services/auth.service.ts`, `src/services/employee.service.ts`, `src/services/course.service.ts` | Get current employee profile |
| **Employees** | PATCH | `/api/v1/employees/me` | `src/services/employee.service.ts` | Update current employee profile |
| **Employees** | PATCH | `/api/v1/employees/me/password` | `src/services/employee.service.ts` | Change current employee password |
| **Employees** | PATCH | `/api/v1/employees/me/preferences` | `src/context/LanguageContext.tsx` | Update employee language preferences |
| **Employees** | GET | `/api/v1/employees` | `src/services/employee.service.ts`, `src/services/dashboard.service.ts` | List employees |
| **Employees** | GET | `/api/v1/employees/:id` | `src/services/employee.service.ts` | Get employee profile by ID |
| **Employees** | POST | `/api/v1/employees/invite` | `src/services/employee.service.ts` | Invite new employee |
| **Employees** | PATCH | `/api/v1/employees/:id` | `src/services/employee.service.ts` | Update employee profile by ID |
| **Employees** | DELETE | `/api/v1/employees/:id` | `src/services/employee.service.ts` | Delete employee record |
| **Employees** | POST | `/api/v1/employees/import` | `src/services/employee.service.ts` | Bulk import employees |
| **Assignments & Journeys** | GET | `/api/v1/assignments/me` | `src/services/employee.service.ts` | Get my active onboarding assignments |
| **Assignments & Journeys** | GET | `/api/v1/assignments` | `src/services/employee.service.ts`, `src/services/course.service.ts`, `src/services/journey.service.ts` | List assignments (supports journeyId filter) |
| **Assignments & Journeys** | GET | `/api/v1/assignments/:id` | `src/services/course.service.ts` | Get assignment details by ID |
| **Assignments & Journeys** | GET | `/api/v1/assignments/public/verify/:id` | `src/services/certificate.service.ts` | Public verification of certificate |
| **Assignments & Journeys** | POST | `/api/v1/assignments` | `src/services/course.service.ts`, `src/services/journey.service.ts` | Assign journey to employee |
| **Assignments & Journeys** | POST | `/api/v1/assignments/bulk` | `src/services/journey.service.ts` | Bulk assign journey to employees |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:id/start` | `src/services/course.service.ts` | Start onboarding assignment |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:id/complete-lesson` | `src/services/course.service.ts` | Mark lesson complete in assignment |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:id/submit-quiz` | `src/services/course.service.ts` | Submit quiz attempt in assignment |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:assignmentId/progress` | `src/services/pwa.service.ts` | Sync offline journey progress |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:assignmentId/issue-certificate` | `src/services/journey.service.ts` | Issue completion certificate |
| **Assignments & Journeys** | GET | `/api/v1/journeys` | `src/services/dashboard.service.ts`, `src/services/journey.service.ts` | List all journeys |
| **Assignments & Journeys** | GET | `/api/v1/journeys/:id` | `src/services/course.service.ts`, `src/services/journey.service.ts` | Get journey by ID |
| **Assignments & Journeys** | GET | `/api/v1/journeys/:journeyId/prerequisites-check` | `src/services/journey.service.ts` | Check journey prerequisites |
| **Assignments & Journeys** | POST | `/api/v1/journeys` | `src/services/journey.service.ts` | Create journey |
| **Assignments & Journeys** | PATCH | `/api/v1/journeys/:id` | `src/services/journey.service.ts` | Update journey |
| **Assignments & Journeys** | DELETE | `/api/v1/journeys/:id` | `src/services/journey.service.ts` | Delete journey |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:id/publish` | `src/services/journey.service.ts` | Publish journey |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:id/archive` | `src/services/journey.service.ts` | Archive journey |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:id/duplicate` | `src/services/journey.service.ts` | Duplicate journey |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:journeyId/clone` | `src/services/journey.service.ts` | Clone journey |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:journeyId/assignment-preview` | `src/services/journey.service.ts` | Preview smart assignment target audience |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:journeyId/smart-assign` | `src/services/journey.service.ts` | Execute smart journey assignment |
| **Assignments & Journeys** | PATCH | `/api/v1/journeys/:journeyId/targeting` | `src/services/journey.service.ts` | Update journey targeting rules |
| **Assignments & Journeys** | PUT | `/api/v1/journeys/:journeyId/reorder` | `src/services/journey.service.ts` | Reorder curriculum modules |
| **Assignments & Journeys** | POST | `/api/v1/journeys/reminders/dispatch` | `src/services/journey.service.ts` | Dispatch journey deadline reminders |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/chat` | `src/services/ai.service.ts` | Send message to AI assistant |
| **AI Assistant & Course Builder** | GET | `/api/v1/ai/conversations` | `src/services/ai.service.ts` | List AI chat conversations |
| **AI Assistant & Course Builder** | GET | `/api/v1/ai/conversations/:id` | `src/services/ai.service.ts` | Get AI chat conversation by ID |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/feedback` | `src/services/ai.service.ts` | Log feedback for AI assistant response |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/course-builder/generate` | `src/services/ai-course.service.ts` | Generate AI course draft |
| **AI Assistant & Course Builder** | GET | `/api/v1/ai/course-builder/drafts` | `src/services/ai-course.service.ts` | List AI course drafts |
| **AI Assistant & Course Builder** | GET | `/api/v1/ai/course-builder/drafts/:id` | `src/services/ai-course.service.ts` | Get AI course draft by ID |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/course-builder/drafts/:draftId/regenerate-module` | `src/services/ai-course.service.ts` | Regenerate module in AI draft |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/course-builder/drafts/:draftId/publish` | `src/services/ai-course.service.ts` | Publish AI draft to journey |
| **AI Assistant & Course Builder** | DELETE | `/api/v1/ai/course-builder/drafts/:draftId` | `src/services/ai-course.service.ts` | Delete AI course draft |
| **Tasks** | GET | `/api/v1/tasks` | `src/services/task.service.ts` | List tasks (supports query filtering) |
| **Tasks** | GET | `/api/v1/tasks/:id` | `src/services/task.service.ts` | Get task by ID |
| **Tasks** | POST | `/api/v1/tasks` | `src/services/task.service.ts` | Create task |
| **Tasks** | PATCH | `/api/v1/tasks/:id/status` | `src/services/task.service.ts` | Update task status |
| **Tasks** | POST | `/api/v1/tasks/:id/comments` | `src/services/task.service.ts` | Add comment to task |
| **Tasks** | DELETE | `/api/v1/tasks/:id` | `src/services/task.service.ts` | Delete task |
| **Tasks** | POST | `/api/v1/tasks/:taskId/complete` | `src/services/pwa.service.ts` | Sync offline task completion |
| **Documents & E-Signatures** | POST | `/api/v1/documents/templates` | `src/services/document.service.ts` | Create document template |
| **Documents & E-Signatures** | GET | `/api/v1/documents/templates` | `src/services/document.service.ts` | List document templates |
| **Documents & E-Signatures** | PUT | `/api/v1/documents/templates/:id` | `src/services/document.service.ts` | Update document template |
| **Documents & E-Signatures** | DELETE | `/api/v1/documents/templates/:id` | `src/services/document.service.ts` | Delete document template |
| **Documents & E-Signatures** | POST | `/api/v1/documents/assign` | `src/services/document.service.ts` | Assign document to employee |
| **Documents & E-Signatures** | GET | `/api/v1/documents/inbox` | `src/services/document.service.ts` | List employee document inbox |
| **Documents & E-Signatures** | GET | `/api/v1/documents/:id` | `src/services/document.service.ts` | Get document assignment by ID |
| **Documents & E-Signatures** | POST | `/api/v1/documents/:id/sign` | `src/services/document.service.ts` | Execute document e-signature |
| **Workflows** | GET | `/api/v1/workflows` | `src/services/workflow.service.ts` | List workflow rules |
| **Workflows** | GET | `/api/v1/workflows/:id` | `src/services/workflow.service.ts` | Get workflow rule by ID |
| **Workflows** | POST | `/api/v1/workflows` | `src/services/workflow.service.ts` | Create workflow rule |
| **Workflows** | PATCH | `/api/v1/workflows/:id` | `src/services/workflow.service.ts` | Update workflow rule |
| **Workflows** | PATCH | `/api/v1/workflows/:id/toggle` | `src/services/workflow.service.ts` | Toggle workflow active status |
| **Workflows** | DELETE | `/api/v1/workflows/:id` | `src/services/workflow.service.ts` | Delete workflow rule |
| **Workflows** | GET | `/api/v1/workflows/executions` | `src/services/workflow.service.ts` | List workflow execution logs |
| **Workflows** | POST | `/api/v1/workflows/:id/test-run` | `src/services/workflow.service.ts` | Trigger test run for workflow |
| **Buddy & Support** | POST | `/api/v1/buddy/profiles` | `src/services/buddy.service.ts` | Register buddy profile |
| **Buddy & Support** | GET | `/api/v1/buddy/available` | `src/services/buddy.service.ts` | List available onboarding buddies |
| **Buddy & Support** | POST | `/api/v1/buddy/assign` | `src/services/buddy.service.ts` | Assign buddy to new hire |
| **Buddy & Support** | GET | `/api/v1/buddy/my-buddy` | `src/services/buddy.service.ts` | Get employee assigned buddy |
| **Buddy & Support** | GET | `/api/v1/buddy/my-mentees` | `src/services/buddy.service.ts` | Get buddy assigned mentees |
| **Buddy & Support** | PUT | `/api/v1/buddy/assignment/:assignmentId/checklist` | `src/services/buddy.service.ts` | Update buddy checklist task |
| **Buddy & Support** | POST | `/api/v1/buddy/assignment/:assignmentId/checkin` | `src/services/buddy.service.ts` | Log buddy check-in notes |
| **Milestones & Check-ins** | POST | `/api/v1/milestones/templates` | `src/services/milestone.service.ts` | Create milestone template |
| **Milestones & Check-ins** | GET | `/api/v1/milestones/templates` | `src/services/milestone.service.ts` | List milestone templates |
| **Milestones & Check-ins** | POST | `/api/v1/milestones/assign` | `src/services/milestone.service.ts` | Assign milestone to employee |
| **Milestones & Check-ins** | GET | `/api/v1/milestones/my-milestones` | `src/services/milestone.service.ts` | Get employee milestones |
| **Milestones & Check-ins** | GET | `/api/v1/milestones/team-milestones` | `src/services/milestone.service.ts` | Get team milestones for manager |
| **Milestones & Check-ins** | POST | `/api/v1/milestones/:id/self-checkin` | `src/services/milestone.service.ts` | Submit employee milestone self-checkin |
| **Milestones & Check-ins** | POST | `/api/v1/milestones/:id/manager-review` | `src/services/milestone.service.ts` | Submit manager milestone review |
| **Calendar & Meetings** | POST | `/api/v1/calendar/connection` | `src/services/calendar.service.ts` | Connect calendar integration provider |
| **Calendar & Meetings** | GET | `/api/v1/calendar/connection` | `src/services/calendar.service.ts` | Get calendar connection status |
| **Calendar & Meetings** | POST | `/api/v1/calendar/events` | `src/services/calendar.service.ts` | Create calendar meeting event |
| **Calendar & Meetings** | GET | `/api/v1/calendar/events` | `src/services/calendar.service.ts` | List calendar meeting events |
| **Calendar & Meetings** | PUT | `/api/v1/calendar/events/:id` | `src/services/calendar.service.ts` | Update calendar meeting event |
| **Calendar & Meetings** | DELETE | `/api/v1/calendar/events/:id` | `src/services/calendar.service.ts` | Cancel calendar meeting event |
| **Calendar & Meetings** | GET | `/api/v1/calendar/feed/:token.ics` | `src/pages/CalendarIntegration.tsx` | Access personal iCal feed URL |
| **HR Operations** | GET | `/api/v1/hr/dashboard` | `src/services/hr.service.ts` | Get HR dashboard operational metrics |
| **HR Operations** | GET | `/api/v1/hr/exceptions` | `src/services/hr.service.ts` | Get HR onboarding exception queue |
| **HR Operations** | PUT | `/api/v1/hr/lifecycle/:userId/state` | `src/services/hr.service.ts` | Update onboarding lifecycle state |
| **HR Operations** | POST | `/api/v1/hr/bulk-action` | `src/services/hr.service.ts` | Execute HR bulk operation |
| **HR Operations** | GET | `/api/v1/hr/compliance-report` | `src/services/hr.service.ts` | Get HR compliance report |
| **Manager Operations** | GET | `/api/v1/manager/dashboard` | `src/services/manager.service.ts` | Get manager dashboard metrics |
| **Manager Operations** | GET | `/api/v1/manager/team` | `src/services/manager.service.ts` | List manager direct reports |
| **Manager Operations** | GET | `/api/v1/manager/team/:employeeId` | `src/services/manager.service.ts` | Get direct report onboarding details |
| **Manager Operations** | POST | `/api/v1/manager/team/:employeeId/nudge` | `src/services/manager.service.ts` | Nudge direct report regarding progress |
| **Manager Operations** | POST | `/api/v1/manager/team/:employeeId/sign-off` | `src/services/manager.service.ts` | Sign off direct report onboarding |
| **Analytics & Reporting** | GET | `/api/v1/analytics/summary` | `src/services/analytics.service.ts`, `src/services/dashboard.service.ts` | Get analytics summary metrics |
| **Analytics & Reporting** | GET | `/api/v1/analytics/time-to-completion` | `src/services/analytics.service.ts` | Get time-to-completion metrics |
| **Analytics & Reporting** | GET | `/api/v1/analytics/bottlenecks` | `src/services/analytics.service.ts` | Get onboarding bottleneck analytics |
| **Analytics & Reporting** | GET | `/api/v1/analytics/export` | `src/services/analytics.service.ts` | Export analytics report CSV |
| **Analytics & Reporting** | GET | `/api/v1/analytics/scheduled-reports` | `src/services/analytics.service.ts` | List scheduled analytics reports |
| **Analytics & Reporting** | POST | `/api/v1/analytics/scheduled-reports` | `src/services/analytics.service.ts` | Create scheduled report |
| **Analytics & Reporting** | DELETE | `/api/v1/analytics/scheduled-reports/:id` | `src/services/analytics.service.ts` | Delete scheduled report |
| **Analytics & Reporting** | GET | `/api/v1/audit-logs` | `src/services/dashboard.service.ts` | List recent system audit logs |
| **Gamification** | GET | `/api/v1/gamification/profile` | `src/services/gamification.service.ts` | Get employee gamification profile |
| **Gamification** | POST | `/api/v1/gamification/award-points` | `src/services/gamification.service.ts` | Award points for onboarding activity |
| **Gamification** | POST | `/api/v1/gamification/streak` | `src/services/gamification.service.ts` | Record daily activity streak |
| **Gamification** | GET | `/api/v1/gamification/leaderboard` | `src/services/gamification.service.ts` | Get organization leaderboard |
| **Knowledge Base** | GET | `/api/v1/knowledge-base` | `src/services/knowledgeBase.service.ts` | List KB articles / categories |
| **Knowledge Base** | GET | `/api/v1/knowledge-base/:id` | `src/services/knowledgeBase.service.ts` | Get KB article by ID |
| **Knowledge Base** | POST | `/api/v1/knowledge-base` | `src/services/knowledgeBase.service.ts` | Create KB article |
| **Knowledge Base** | PATCH | `/api/v1/knowledge-base/:id` | `src/services/knowledgeBase.service.ts` | Update KB article |
| **Knowledge Base** | DELETE | `/api/v1/knowledge-base/:id` | `src/services/knowledgeBase.service.ts` | Delete KB article |
| **Knowledge Base** | POST | `/api/v1/knowledge-base/:id/publish` | `src/services/knowledgeBase.service.ts` | Publish KB article |
| **Knowledge Base** | POST | `/api/v1/knowledge-base/:id/archive` | `src/services/knowledgeBase.service.ts` | Archive KB article |
| **Knowledge Base** | GET | `/api/v1/knowledge-base/quick-links` | `src/services/knowledgeBase.service.ts` | List KB quick links |
| **Knowledge Base** | POST | `/api/v1/knowledge-base/quick-links` | `src/services/knowledgeBase.service.ts` | Create KB quick link |
| **Knowledge Base** | PATCH | `/api/v1/knowledge-base/quick-links/:id` | `src/services/knowledgeBase.service.ts` | Update KB quick link |
| **Knowledge Base** | DELETE | `/api/v1/knowledge-base/quick-links/:id` | `src/services/knowledgeBase.service.ts` | Delete KB quick link |
| **Location & Maps** | GET | `/api/v1/locations` | `src/services/location.service.ts` | List office locations |
| **Location & Maps** | GET | `/api/v1/locations/:id` | `src/services/location.service.ts` | Get office location by ID |
| **Location & Maps** | POST | `/api/v1/locations` | `src/services/location.service.ts` | Create office location |
| **Location & Maps** | POST | `/api/v1/locations/:locationId/assign-desk` | `src/services/location.service.ts` | Assign desk to employee |
| **Location & Maps** | GET | `/api/v1/locations/my-location` | `src/services/location.service.ts` | Get employee office location guidance |
| **Integrations** | GET | `/api/v1/integrations` | `src/services/integration.service.ts` | List HRIS integrations |
| **Integrations** | POST | `/api/v1/integrations` | `src/services/integration.service.ts` | Create HRIS integration |
| **Integrations** | PUT | `/api/v1/integrations/:id` | `src/services/integration.service.ts` | Update HRIS integration |
| **Integrations** | DELETE | `/api/v1/integrations/:id` | `src/services/integration.service.ts` | Delete HRIS integration |
| **Integrations** | POST | `/api/v1/integrations/:id/test` | `src/services/integration.service.ts` | Test integration connection |
| **Integrations** | POST | `/api/v1/integrations/:id/sync` | `src/services/integration.service.ts` | Trigger manual HRIS sync |
| **Integrations** | GET | `/api/v1/integrations/:id/logs` | `src/services/integration.service.ts` | Get integration sync execution logs |
| **Notifications & Push** | GET | `/api/v1/notifications` | `src/services/notification.service.ts`, `src/services/settings.service.ts` | Get user notifications |
| **Notifications & Push** | GET | `/api/v1/notifications/count` | `src/services/notification.service.ts` | Get unread notification count |
| **Notifications & Push** | PATCH | `/api/v1/notifications/:id/read` | `src/services/notification.service.ts` | Mark single notification read |
| **Notifications & Push** | PATCH | `/api/v1/notifications/read-all` | `src/services/notification.service.ts` | Mark all notifications read |
| **Notifications & Push** | GET | `/api/v1/notifications/preferences` | `src/services/notification.service.ts` | Get notification preferences |
| **Notifications & Push** | PUT | `/api/v1/notifications/preferences` | `src/services/notification.service.ts` | Update notification preferences |
| **Notifications & Push** | POST | `/api/v1/notifications/push-subscription` | `src/services/pwa.service.ts` | Subscribe to push notifications |
| **Notifications & Push** | DELETE | `/api/v1/notifications/push-subscription` | `src/services/pwa.service.ts` | Unsubscribe from push notifications |
| **Uploads & Storage** | POST | `/api/v1/uploads/request-url` | `src/services/upload.service.ts` | Request presigned upload URL |
| **Uploads & Storage** | PUT | `<uploadUrl>` | `src/services/upload.service.ts` | Direct S3/R2 binary upload via presigned URL |
| **Uploads & Storage** | POST | `/api/v1/uploads/complete` | `src/services/upload.service.ts` | Confirm upload completion |
| **Super Admin** | GET | `/api/v1/super-admin/telemetry` | `src/services/superAdmin.service.ts` | Get super admin platform telemetry |
| **Super Admin** | GET | `/api/v1/super-admin/activity-logs` | `src/services/superAdmin.service.ts` | Get cross-tenant activity logs |
| **Super Admin** | GET | `/api/v1/super-admin/organizations` | `src/services/superAdmin.service.ts` | List platform organizations |
| **Super Admin** | POST | `/api/v1/super-admin/organizations` | `src/services/superAdmin.service.ts` | Create platform organization |
| **Super Admin** | PATCH | `/api/v1/super-admin/organizations/:id/status` | `src/services/superAdmin.service.ts` | Toggle organization active/suspended status |
| **Super Admin** | GET | `/api/v1/super-admin/invoices` | `src/services/superAdmin.service.ts` | List platform invoices |
| **Super Admin** | POST | `/api/v1/super-admin/invoices` | `src/services/superAdmin.service.ts` | Create platform invoice |
| **Super Admin** | GET | `/api/v1/super-admin/invoices/export` | `src/services/superAdmin.service.ts` | Export platform invoices |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/journeys` | `src/features/kiosk/services/kiosk.service.ts` | Create kiosk journey |
| **Kiosk & Field Access** | GET | `/api/v1/kiosk/journeys` | `src/features/kiosk/services/kiosk.service.ts` | List kiosk journeys |
| **Kiosk & Field Access** | GET | `/api/v1/kiosk/journeys/:id` | `src/features/kiosk/services/kiosk.service.ts` | Get kiosk journey by ID |
| **Kiosk & Field Access** | PUT | `/api/v1/kiosk/journeys/:id` | `src/features/kiosk/services/kiosk.service.ts` | Update kiosk journey |
| **Kiosk & Field Access** | DELETE | `/api/v1/kiosk/journeys/:id` | `src/features/kiosk/services/kiosk.service.ts` | Delete kiosk journey |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/journeys/:id/publish` | `src/features/kiosk/services/kiosk.service.ts` | Publish kiosk journey |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/devices/pair` | `src/features/kiosk/services/kiosk.service.ts` | Pair kiosk device |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/devices/pair/code` | `src/features/kiosk/services/kiosk.service.ts` | Generate kiosk pairing code |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/devices/heartbeat` | `src/features/kiosk/services/kiosk.service.ts` | Kiosk device heartbeat check-in |
| **Kiosk & Field Access** | GET | `/api/v1/kiosk/devices` | `src/features/kiosk/services/kiosk.service.ts` | List kiosk devices |
| **Kiosk & Field Access** | PUT | `/api/v1/kiosk/devices/:id/status` | `src/features/kiosk/services/kiosk.service.ts` | Update kiosk device status |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/devices/:deviceId/pair-journey` | `src/features/kiosk/services/kiosk.service.ts` | Pair journey to kiosk device |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/journeys/:journeyId/auth/pin` | `src/features/kiosk/services/kiosk.service.ts` | Verify kiosk security PIN |
| **Kiosk & Field Access** | POST | `/api/v1/kiosk/analytics/sync` | `src/features/kiosk/services/kiosk.service.ts` | Sync offline kiosk analytics sessions |
| **Kiosk & Field Access** | GET | `/api/v1/kiosk/journeys/play/:journeyId` | `src/features/kiosk/services/kiosk.service.ts` | Get public playback kiosk journey |
| **Kiosk & Field Access** | GET | `/api/v1/kiosk/journeys/:journeyId/analytics` | `src/features/kiosk/services/kiosk.service.ts` | Get kiosk journey analytics |
| **Kiosk & Field Access** | GET | `/api/v1/kiosk/uploads/:uploadId` | `src/features/kiosk/components/KioskPlayer.tsx` | Kiosk media resource streaming |
| **Localization** | POST | `/api/v1/localization/translate-realtime` | `src/pages/CourseViewer.tsx` | Real-time AI course translation |

---

## 2. Module Summary

### Authentication & Identity
- GET `/api/v1/auth/sso/config`
- POST `/api/v1/auth/login`
- POST `/api/v1/auth/logout`
- POST `/api/v1/auth/refresh`
- POST `/api/v1/auth/forgot-password`
- POST `/api/v1/auth/register`
- POST `/api/v1/auth/sso/discover`
- POST `/api/v1/auth/sso/initiate`
- PUT `/api/v1/auth/sso/config`

### Organizations & Departments
- GET `/api/v1/organizations/current`
- GET `/api/v1/organizations/departments`
- POST `/api/v1/organizations/departments`
- PATCH `/api/v1/organizations/current`
- PATCH `/api/v1/organizations/branding`
- PATCH `/api/v1/organizations/security`
- DELETE `/api/v1/organizations/departments/:id`

### Employees & User Management
- GET `/api/v1/employees/me`
- GET `/api/v1/employees`
- GET `/api/v1/employees/:id`
- POST `/api/v1/employees/invite`
- POST `/api/v1/employees/import`
- PATCH `/api/v1/employees/me`
- PATCH `/api/v1/employees/me/password`
- PATCH `/api/v1/employees/me/preferences`
- PATCH `/api/v1/employees/:id`
- DELETE `/api/v1/employees/:id`

### Assignments & Journeys
- GET `/api/v1/assignments/me`
- GET `/api/v1/assignments`
- GET `/api/v1/assignments/:id`
- GET `/api/v1/assignments/public/verify/:id`
- GET `/api/v1/journeys`
- GET `/api/v1/journeys/:id`
- GET `/api/v1/journeys/:journeyId/prerequisites-check`
- POST `/api/v1/assignments`
- POST `/api/v1/assignments/bulk`
- POST `/api/v1/assignments/:id/start`
- POST `/api/v1/assignments/:id/complete-lesson`
- POST `/api/v1/assignments/:id/submit-quiz`
- POST `/api/v1/assignments/:assignmentId/progress`
- POST `/api/v1/assignments/:assignmentId/issue-certificate`
- POST `/api/v1/journeys`
- POST `/api/v1/journeys/:id/publish`
- POST `/api/v1/journeys/:id/archive`
- POST `/api/v1/journeys/:id/duplicate`
- POST `/api/v1/journeys/:journeyId/clone`
- POST `/api/v1/journeys/:journeyId/assignment-preview`
- POST `/api/v1/journeys/:journeyId/smart-assign`
- POST `/api/v1/journeys/reminders/dispatch`
- PATCH `/api/v1/journeys/:id`
- PATCH `/api/v1/journeys/:journeyId/targeting`
- PUT `/api/v1/journeys/:journeyId/reorder`
- DELETE `/api/v1/journeys/:id`

### AI Assistant & Course Builder
- GET `/api/v1/ai/conversations`
- GET `/api/v1/ai/conversations/:id`
- GET `/api/v1/ai/course-builder/drafts`
- GET `/api/v1/ai/course-builder/drafts/:id`
- POST `/api/v1/ai/chat`
- POST `/api/v1/ai/feedback`
- POST `/api/v1/ai/course-builder/generate`
- POST `/api/v1/ai/course-builder/drafts/:draftId/regenerate-module`
- POST `/api/v1/ai/course-builder/drafts/:draftId/publish`
- DELETE `/api/v1/ai/course-builder/drafts/:draftId`

### Tasks & Operations
- GET `/api/v1/tasks`
- GET `/api/v1/tasks/:id`
- POST `/api/v1/tasks`
- POST `/api/v1/tasks/:id/comments`
- POST `/api/v1/tasks/:taskId/complete`
- PATCH `/api/v1/tasks/:id/status`
- DELETE `/api/v1/tasks/:id`

### Documents & E-Signatures
- GET `/api/v1/documents/templates`
- GET `/api/v1/documents/inbox`
- GET `/api/v1/documents/:id`
- POST `/api/v1/documents/templates`
- POST `/api/v1/documents/assign`
- POST `/api/v1/documents/:id/sign`
- PUT `/api/v1/documents/templates/:id`
- DELETE `/api/v1/documents/templates/:id`

### Workflows & Automation
- GET `/api/v1/workflows`
- GET `/api/v1/workflows/:id`
- GET `/api/v1/workflows/executions`
- POST `/api/v1/workflows`
- POST `/api/v1/workflows/:id/test-run`
- PATCH `/api/v1/workflows/:id`
- PATCH `/api/v1/workflows/:id/toggle`
- DELETE `/api/v1/workflows/:id`

### Buddy & Support
- GET `/api/v1/buddy/available`
- GET `/api/v1/buddy/my-buddy`
- GET `/api/v1/buddy/my-mentees`
- POST `/api/v1/buddy/profiles`
- POST `/api/v1/buddy/assign`
- POST `/api/v1/buddy/assignment/:assignmentId/checkin`
- PUT `/api/v1/buddy/assignment/:assignmentId/checklist`

### Milestones & Check-ins
- GET `/api/v1/milestones/templates`
- GET `/api/v1/milestones/my-milestones`
- GET `/api/v1/milestones/team-milestones`
- POST `/api/v1/milestones/templates`
- POST `/api/v1/milestones/assign`
- POST `/api/v1/milestones/:id/self-checkin`
- POST `/api/v1/milestones/:id/manager-review`

### Calendar & Meetings
- GET `/api/v1/calendar/connection`
- GET `/api/v1/calendar/events`
- GET `/api/v1/calendar/feed/:token.ics`
- POST `/api/v1/calendar/connection`
- POST `/api/v1/calendar/events`
- PUT `/api/v1/calendar/events/:id`
- DELETE `/api/v1/calendar/events/:id`

### HR Operations & Compliance
- GET `/api/v1/hr/dashboard`
- GET `/api/v1/hr/exceptions`
- GET `/api/v1/hr/compliance-report`
- POST `/api/v1/hr/bulk-action`
- PUT `/api/v1/hr/lifecycle/:userId/state`

### Manager Operations
- GET `/api/v1/manager/dashboard`
- GET `/api/v1/manager/team`
- GET `/api/v1/manager/team/:employeeId`
- POST `/api/v1/manager/team/:employeeId/nudge`
- POST `/api/v1/manager/team/:employeeId/sign-off`

### Analytics & Reporting
- GET `/api/v1/analytics/summary`
- GET `/api/v1/analytics/time-to-completion`
- GET `/api/v1/analytics/bottlenecks`
- GET `/api/v1/analytics/export`
- GET `/api/v1/analytics/scheduled-reports`
- GET `/api/v1/audit-logs`
- POST `/api/v1/analytics/scheduled-reports`
- DELETE `/api/v1/analytics/scheduled-reports/:id`

### Gamification & Engagement
- GET `/api/v1/gamification/profile`
- GET `/api/v1/gamification/leaderboard`
- POST `/api/v1/gamification/award-points`
- POST `/api/v1/gamification/streak`

### Knowledge Base
- GET `/api/v1/knowledge-base`
- GET `/api/v1/knowledge-base/:id`
- GET `/api/v1/knowledge-base/quick-links`
- POST `/api/v1/knowledge-base`
- POST `/api/v1/knowledge-base/:id/publish`
- POST `/api/v1/knowledge-base/:id/archive`
- POST `/api/v1/knowledge-base/quick-links`
- PATCH `/api/v1/knowledge-base/:id`
- PATCH `/api/v1/knowledge-base/quick-links/:id`
- DELETE `/api/v1/knowledge-base/:id`
- DELETE `/api/v1/knowledge-base/quick-links/:id`

### Location & Office Maps
- GET `/api/v1/locations`
- GET `/api/v1/locations/:id`
- GET `/api/v1/locations/my-location`
- POST `/api/v1/locations`
- POST `/api/v1/locations/:locationId/assign-desk`

### Integrations & HRIS
- GET `/api/v1/integrations`
- GET `/api/v1/integrations/:id/logs`
- POST `/api/v1/integrations`
- POST `/api/v1/integrations/:id/test`
- POST `/api/v1/integrations/:id/sync`
- PUT `/api/v1/integrations/:id`
- DELETE `/api/v1/integrations/:id`

### Notifications & Push
- GET `/api/v1/notifications`
- GET `/api/v1/notifications/count`
- GET `/api/v1/notifications/preferences`
- POST `/api/v1/notifications/push-subscription`
- PATCH `/api/v1/notifications/:id/read`
- PATCH `/api/v1/notifications/read-all`
- PUT `/api/v1/notifications/preferences`
- DELETE `/api/v1/notifications/push-subscription`

### Uploads & Storage
- POST `/api/v1/uploads/request-url`
- POST `/api/v1/uploads/complete`
- PUT `<uploadUrl>`

### Super Admin Operations
- GET `/api/v1/super-admin/telemetry`
- GET `/api/v1/super-admin/activity-logs`
- GET `/api/v1/super-admin/organizations`
- GET `/api/v1/super-admin/invoices`
- GET `/api/v1/super-admin/invoices/export`
- POST `/api/v1/super-admin/organizations`
- POST `/api/v1/super-admin/invoices`
- PATCH `/api/v1/super-admin/organizations/:id/status`

### Kiosk & Field Access
- GET `/api/v1/kiosk/journeys`
- GET `/api/v1/kiosk/journeys/:id`
- GET `/api/v1/kiosk/devices`
- GET `/api/v1/kiosk/journeys/play/:journeyId`
- GET `/api/v1/kiosk/journeys/:journeyId/analytics`
- GET `/api/v1/kiosk/uploads/:uploadId`
- POST `/api/v1/kiosk/journeys`
- POST `/api/v1/kiosk/journeys/:id/publish`
- POST `/api/v1/kiosk/devices/pair`
- POST `/api/v1/kiosk/devices/pair/code`
- POST `/api/v1/kiosk/devices/heartbeat`
- POST `/api/v1/kiosk/devices/:deviceId/pair-journey`
- POST `/api/v1/kiosk/journeys/:journeyId/auth/pin`
- POST `/api/v1/kiosk/analytics/sync`
- PUT `/api/v1/kiosk/journeys/:id`
- PUT `/api/v1/kiosk/devices/:id/status`
- DELETE `/api/v1/kiosk/journeys/:id`

### Localization
- POST `/api/v1/localization/translate-realtime`

---

## 3. Endpoint Construction Patterns

The following table documents endpoints that are dynamically constructed using template strings in the frontend source code, along with their normalized parameterized patterns:

| Original Template String Pattern | Normalized Pattern | Frontend Source Location |
| :--- | :--- | :--- |
| `/ai/course-builder/drafts/${id}` | `/api/v1/ai/course-builder/drafts/:id` | `src/services/ai-course.service.ts` |
| `/ai/course-builder/drafts/${draftId}/regenerate-module` | `/api/v1/ai/course-builder/drafts/:draftId/regenerate-module` | `src/services/ai-course.service.ts` |
| `/ai/course-builder/drafts/${draftId}/publish` | `/api/v1/ai/course-builder/drafts/:draftId/publish` | `src/services/ai-course.service.ts` |
| `/ai/course-builder/drafts/${draftId}` | `/api/v1/ai/course-builder/drafts/:draftId` | `src/services/ai-course.service.ts` |
| `/ai/conversations/${id}` | `/api/v1/ai/conversations/:id` | `src/services/ai.service.ts` |
| `/analytics/summary?range=${range}` | `/api/v1/analytics/summary` | `src/services/analytics.service.ts` |
| `/analytics/scheduled-reports/${id}` | `/api/v1/analytics/scheduled-reports/:id` | `src/services/analytics.service.ts` |
| `/buddy/assignment/${assignmentId}/checklist` | `/api/v1/buddy/assignment/:assignmentId/checklist` | `src/services/buddy.service.ts` |
| `/buddy/assignment/${assignmentId}/checkin` | `/api/v1/buddy/assignment/:assignmentId/checkin` | `src/services/buddy.service.ts` |
| `/calendar/events/${id}` | `/api/v1/calendar/events/:id` | `src/services/calendar.service.ts` |
| `/assignments/public/verify/${id}` | `/api/v1/assignments/public/verify/:id` | `src/services/certificate.service.ts` |
| `/assignments/${id}` | `/api/v1/assignments/:id` | `src/services/course.service.ts` |
| `/journeys/${assignment.journey.journeyId}` | `/api/v1/journeys/:journeyId` | `src/services/course.service.ts` |
| `/assignments/${courseId}/start` | `/api/v1/assignments/:id/start` | `src/services/course.service.ts` |
| `/assignments/${courseId}/complete-lesson` | `/api/v1/assignments/:id/complete-lesson` | `src/services/course.service.ts` |
| `/assignments/${courseId}/submit-quiz` | `/api/v1/assignments/:id/submit-quiz` | `src/services/course.service.ts` |
| `/documents/templates/${id}` | `/api/v1/documents/templates/:id` | `src/services/document.service.ts` |
| `/documents/${id}` | `/api/v1/documents/:id` | `src/services/document.service.ts` |
| `/documents/${id}/sign` | `/api/v1/documents/:id/sign` | `src/services/document.service.ts` |
| `/employees/${id}` | `/api/v1/employees/:id` | `src/services/employee.service.ts` |
| `/hr/lifecycle/${userId}/state` | `/api/v1/hr/lifecycle/:userId/state` | `src/services/hr.service.ts` |
| `/integrations/${id}` | `/api/v1/integrations/:id` | `src/services/integration.service.ts` |
| `/integrations/${id}/test` | `/api/v1/integrations/:id/test` | `src/services/integration.service.ts` |
| `/integrations/${id}/sync` | `/api/v1/integrations/:id/sync` | `src/services/integration.service.ts` |
| `/integrations/${id}/logs` | `/api/v1/integrations/:id/logs` | `src/services/integration.service.ts` |
| `/journeys/${id}` | `/api/v1/journeys/:id` | `src/services/journey.service.ts` |
| `/journeys/${id}/publish` | `/api/v1/journeys/:id/publish` | `src/services/journey.service.ts` |
| `/journeys/${id}/archive` | `/api/v1/journeys/:id/archive` | `src/services/journey.service.ts` |
| `/journeys/${id}/duplicate` | `/api/v1/journeys/:id/duplicate` | `src/services/journey.service.ts` |
| `/assignments/${assignmentId}/issue-certificate` | `/api/v1/assignments/:assignmentId/issue-certificate` | `src/services/journey.service.ts` |
| `/journeys/${journeyId}/assignment-preview` | `/api/v1/journeys/:journeyId/assignment-preview` | `src/services/journey.service.ts` |
| `/journeys/${journeyId}/smart-assign` | `/api/v1/journeys/:journeyId/smart-assign` | `src/services/journey.service.ts` |
| `/journeys/${journeyId}/targeting` | `/api/v1/journeys/:journeyId/targeting` | `src/services/journey.service.ts` |
| `/journeys/${journeyId}/prerequisites-check` | `/api/v1/journeys/:journeyId/prerequisites-check` | `src/services/journey.service.ts` |
| `/journeys/${journeyId}/clone` | `/api/v1/journeys/:journeyId/clone` | `src/services/journey.service.ts` |
| `/journeys/${journeyId}/reorder` | `/api/v1/journeys/:journeyId/reorder` | `src/services/journey.service.ts` |
| `/knowledge-base/${id}` | `/api/v1/knowledge-base/:id` | `src/services/knowledgeBase.service.ts` |
| `/knowledge-base/${id}/publish` | `/api/v1/knowledge-base/:id/publish` | `src/services/knowledgeBase.service.ts` |
| `/knowledge-base/${id}/archive` | `/api/v1/knowledge-base/:id/archive` | `src/services/knowledgeBase.service.ts` |
| `/knowledge-base/quick-links/${id}` | `/api/v1/knowledge-base/quick-links/:id` | `src/services/knowledgeBase.service.ts` |
| `/locations/${id}` | `/api/v1/locations/:id` | `src/services/location.service.ts` |
| `/locations/${locationId}/assign-desk` | `/api/v1/locations/:locationId/assign-desk` | `src/services/location.service.ts` |
| `/manager/team/${employeeId}` | `/api/v1/manager/team/:employeeId` | `src/services/manager.service.ts` |
| `/manager/team/${employeeId}/nudge` | `/api/v1/manager/team/:employeeId/nudge` | `src/services/manager.service.ts` |
| `/manager/team/${employeeId}/sign-off` | `/api/v1/manager/team/:employeeId/sign-off` | `src/services/manager.service.ts` |
| `/milestones/${id}/self-checkin` | `/api/v1/milestones/:id/self-checkin` | `src/services/milestone.service.ts` |
| `/milestones/${id}/manager-review` | `/api/v1/milestones/:id/manager-review` | `src/services/milestone.service.ts` |
| `/notifications/${id}/read` | `/api/v1/notifications/:id/read` | `src/services/notification.service.ts` |
| `/tasks/${item.payload.taskId}/complete` | `/api/v1/tasks/:taskId/complete` | `src/services/pwa.service.ts` |
| `/assignments/${item.payload.assignmentId}/progress` | `/api/v1/assignments/:assignmentId/progress` | `src/services/pwa.service.ts` |
| `/organizations/departments/${id}` | `/api/v1/organizations/departments/:id` | `src/services/settings.service.ts` |
| `/super-admin/organizations/${id}/status` | `/api/v1/super-admin/organizations/:id/status` | `src/services/superAdmin.service.ts` |
| `/tasks/${id}` | `/api/v1/tasks/:id` | `src/services/task.service.ts` |
| `/tasks/${id}/status` | `/api/v1/tasks/:id/status` | `src/services/task.service.ts` |
| `/tasks/${id}/comments` | `/api/v1/tasks/:id/comments` | `src/services/task.service.ts` |
| `${apiClient.defaults.baseURL}/uploads/${uploadId}` | `/api/v1/uploads/:uploadId` | `src/services/upload.service.ts` |
| `/workflows/${id}` | `/api/v1/workflows/:id` | `src/services/workflow.service.ts` |
| `/workflows/${id}/toggle` | `/api/v1/workflows/:id/toggle` | `src/services/workflow.service.ts` |
| `/workflows/${id}/test-run` | `/api/v1/workflows/:id/test-run` | `src/services/workflow.service.ts` |
| `/kiosk/journeys/${id}` | `/api/v1/kiosk/journeys/:id` | `src/features/kiosk/services/kiosk.service.ts` |
| `/kiosk/journeys/${id}/publish` | `/api/v1/kiosk/journeys/:id/publish` | `src/features/kiosk/services/kiosk.service.ts` |
| `/kiosk/devices/${id}/status` | `/api/v1/kiosk/devices/:id/status` | `src/features/kiosk/services/kiosk.service.ts` |
| `/kiosk/devices/${deviceId}/pair-journey` | `/api/v1/kiosk/devices/:deviceId/pair-journey` | `src/features/kiosk/services/kiosk.service.ts` |
| `/kiosk/journeys/${journeyId}/auth/pin` | `/api/v1/kiosk/journeys/:journeyId/auth/pin` | `src/features/kiosk/services/kiosk.service.ts` |
| `/kiosk/journeys/play/${journeyId}` | `/api/v1/kiosk/journeys/play/:journeyId` | `src/features/kiosk/services/kiosk.service.ts` |
| `/kiosk/journeys/${journeyId}/analytics` | `/api/v1/kiosk/journeys/:journeyId/analytics` | `src/features/kiosk/services/kiosk.service.ts` |
| `/api/v1/calendar/feed/${connection?.icalToken || 'token'}.ics` | `/api/v1/calendar/feed/:token.ics` | `src/pages/CalendarIntegration.tsx` |
| `/api/v1/kiosk/uploads/${uploadId}` | `/api/v1/kiosk/uploads/:uploadId` | `src/features/kiosk/components/KioskPlayer.tsx` |

---

## 4. Potentially Indirect API Calls

| Frontend Wrapper / Hook | Source Location | Underlying Service Layer Method | Endpoint Determination |
| :--- | :--- | :--- | :--- |
| `useAuth()` | `src/hooks/useAuth.ts` | `authService` | Resolved (`/api/v1/auth/*`, `/api/v1/employees/me`) |
| `useEmployees()` | `src/hooks/useEmployees.ts` | `employeeService` | Resolved (`/api/v1/employees/*`, `/api/v1/assignments/*`) |
| `useJourneys()` | `src/hooks/useJourneys.ts` | `journeyService` | Resolved (`/api/v1/journeys/*`, `/api/v1/assignments/*`) |
| `useCourses()` | `src/hooks/useCourses.ts` | `courseService` | Resolved (`/api/v1/assignments/*`, `/api/v1/journeys/*`) |
| `useTasks()` | `src/hooks/useTasks.ts` | `frontendTaskService` | Resolved (`/api/v1/tasks/*`) |
| `useDocuments()` | `src/hooks/useDocuments.ts` | `documentService` | Resolved (`/api/v1/documents/*`) |
| `useWorkflows()` | `src/hooks/useWorkflows.ts` | `frontendWorkflowService` | Resolved (`/api/v1/workflows/*`) |
| `useBuddy()` | `src/hooks/useBuddy.ts` | `buddyService` | Resolved (`/api/v1/buddy/*`) |
| `useMilestones()` | `src/hooks/useMilestones.ts` | `milestoneService` | Resolved (`/api/v1/milestones/*`) |
| `useCalendar()` | `src/hooks/useCalendar.ts` | `calendarService` | Resolved (`/api/v1/calendar/*`) |
| `useHROperations()` | `src/hooks/useHROperations.ts` | `hrService` | Resolved (`/api/v1/hr/*`) |
| `useManager()` | `src/hooks/useManager.ts` | `managerService` | Resolved (`/api/v1/manager/*`) |
| `useAnalytics()` | `src/hooks/useAnalytics.ts` | `analyticsService` | Resolved (`/api/v1/analytics/*`) |
| `useGamification()` | `src/hooks/useGamification.ts` | `gamificationService` | Resolved (`/api/v1/gamification/*`) |
| `useKnowledgeBase()` | `src/hooks/useKnowledgeBase.ts` | `knowledgeBaseService` | Resolved (`/api/v1/knowledge-base/*`) |
| `useLocations()` | `src/hooks/useLocations.ts` | `locationService` | Resolved (`/api/v1/locations/*`) |
| `useIntegrations()` | `src/hooks/useIntegrations.ts` | `integrationService` | Resolved (`/api/v1/integrations/*`) |
| `useNotifications()` | `src/hooks/useNotifications.ts` | `notificationService` | Resolved (`/api/v1/notifications/*`) |
| `usePWA()` | `src/hooks/usePWA.ts` | `pwaService` | Resolved (`/api/v1/notifications/push-subscription`, `/api/v1/tasks/*`, `/api/v1/assignments/*`) |
| `useSSO()` | `src/hooks/useSSO.ts` | `ssoService` | Resolved (`/api/v1/auth/sso/*`) |
| `useSettings()` | `src/hooks/useSettings.ts` | `settingsService` | Resolved (`/api/v1/organizations/*`, `/api/v1/notifications`) |
| `useSuperAdmin()` | `src/hooks/useSuperAdmin.ts` | `superAdminService` | Resolved (`/api/v1/super-admin/*`) |
| `useAICourseBuilder()` | `src/hooks/useAICourseBuilder.ts` | `aiCourseService` | Resolved (`/api/v1/ai/course-builder/*`) |
| `useAIAssistant()` | `src/hooks/useAIAssistant.ts` | `aiService` | Resolved (`/api/v1/ai/*`) |
| `uploadService.uploadFile()` | `src/services/upload.service.ts` | `apiClient` & `axios.put` | Resolved (`/api/v1/uploads/*` and direct presigned S3/R2 URL) |

---

## 5. Frontend Endpoint Count

Total unique endpoint patterns: 188

By method:
GET: 70
POST: 76
PUT: 11
PATCH: 17
DELETE: 14
UNKNOWN: 0

---

## 6. Audit Boundary

This inventory represents only API endpoints referenced by the frontend codebase. No determination has been made regarding whether these endpoints exist, are correctly registered, correctly implemented, or compatible with the backend. Backend endpoint extraction and frontend-to-server gap analysis are separate subsequent audit phases.
