# 16 — Server Endpoint Inventory

Document Purpose: Code-grounded inventory of HTTP API endpoints exposed by the Talnova backend.  
Audit Scope: Server source code (`server/src/`) only.  
Frontend comparison: NOT PERFORMED in this phase.  
Code modification: NONE.

---

## 1. Registered Endpoint Inventory

| Module | HTTP Method | Endpoint | Controller / Handler | Registration Location |
| :--- | :--- | :--- | :--- | :--- |
| **System & Health** | GET | `/live` | `buildApp inline` | `server/src/app.ts:106` |
| **System & Health** | GET | `/ready` | `buildApp inline` | `server/src/app.ts:110` |
| **System & Health** | GET | `/health` | `buildApp inline` | `server/src/app.ts:132` |
| **Authentication** | POST | `/api/v1/auth/login` | `AuthController.login` | `server/src/modules/auth/routes/auth.routes.ts:33` |
| **Authentication** | POST | `/api/v1/auth/register` | `authRoutes inline` | `server/src/modules/auth/routes/auth.routes.ts:44` |
| **Authentication** | POST | `/api/v1/auth/refresh` | `AuthController.refresh` | `server/src/modules/auth/routes/auth.routes.ts:170` |
| **Authentication** | POST | `/api/v1/auth/logout` | `AuthController.logout` | `server/src/modules/auth/routes/auth.routes.ts:173` |
| **Authentication** | POST | `/api/v1/auth/forgot-password` | `AuthController.forgotPassword` | `server/src/modules/auth/routes/auth.routes.ts:191` |
| **Authentication** | POST | `/api/v1/auth/reset-password` | `AuthController.resetPassword` | `server/src/modules/auth/routes/auth.routes.ts:202` |
| **Authentication** | POST | `/api/v1/auth/invitations/accept` | `authRoutes inline` | `server/src/modules/auth/routes/auth.routes.ts:213` |
| **Authentication (SSO)** | POST | `/api/v1/auth/sso/discover` | `SSOController.discoverDomain` | `server/src/modules/auth/routes/sso.routes.ts:11` |
| **Authentication (SSO)** | POST | `/api/v1/auth/sso/initiate` | `SSOController.initiateSSO` | `server/src/modules/auth/routes/sso.routes.ts:12` |
| **Authentication (SSO)** | POST | `/api/v1/auth/sso/callback` | `SSOController.handleCallback` | `server/src/modules/auth/routes/sso.routes.ts:13` |
| **Authentication (SSO)** | GET | `/api/v1/auth/sso/config` | `SSOController.getSSOConfig` | `server/src/modules/auth/routes/sso.routes.ts:16` |
| **Authentication (SSO)** | PUT | `/api/v1/auth/sso/config` | `SSOController.saveSSOConfig` | `server/src/modules/auth/routes/sso.routes.ts:21` |
| **Organizations & Departments** | GET | `/api/v1/organizations/current` | `OrganizationController.getCurrent` | `server/src/modules/organizations/routes/organization.routes.ts:23` |
| **Organizations & Departments** | PATCH | `/api/v1/organizations/current` | `OrganizationController.updateCurrent` | `server/src/modules/organizations/routes/organization.routes.ts:26` |
| **Organizations & Departments** | PATCH | `/api/v1/organizations/branding` | `OrganizationController.updateBranding` | `server/src/modules/organizations/routes/organization.routes.ts:35` |
| **Organizations & Departments** | PATCH | `/api/v1/organizations/security` | `OrganizationController.updateSecurity` | `server/src/modules/organizations/routes/organization.routes.ts:45` |
| **Organizations & Departments** | GET | `/api/v1/organizations/departments` | `OrganizationController.listDepartments` | `server/src/modules/organizations/routes/organization.routes.ts:56` |
| **Organizations & Departments** | POST | `/api/v1/organizations/departments` | `OrganizationController.createDepartment` | `server/src/modules/organizations/routes/organization.routes.ts:58` |
| **Organizations & Departments** | PATCH | `/api/v1/organizations/departments/:id` | `OrganizationController.updateDepartment` | `server/src/modules/organizations/routes/organization.routes.ts:67` |
| **Organizations & Departments** | DELETE | `/api/v1/organizations/departments/:id` | `OrganizationController.deleteDepartment` | `server/src/modules/organizations/routes/organization.routes.ts:76` |
| **Organizations & Departments** | GET | `/api/v1/organizations/teams` | `OrganizationController.listTeams` | `server/src/modules/organizations/routes/organization.routes.ts:83` |
| **Organizations & Departments** | POST | `/api/v1/organizations/teams` | `OrganizationController.createTeam` | `server/src/modules/organizations/routes/organization.routes.ts:85` |
| **Organizations & Departments** | PATCH | `/api/v1/organizations/teams/:id` | `OrganizationController.updateTeam` | `server/src/modules/organizations/routes/organization.routes.ts:94` |
| **Organizations & Departments** | DELETE | `/api/v1/organizations/teams/:id` | `OrganizationController.deleteTeam` | `server/src/modules/organizations/routes/organization.routes.ts:103` |
| **Employees** | GET | `/api/v1/employees/me` | `EmployeeController.getMe` | `server/src/modules/employees/routes/employee.routes.ts:24` |
| **Employees** | PATCH | `/api/v1/employees/me` | `EmployeeController.updateMe` | `server/src/modules/employees/routes/employee.routes.ts:25` |
| **Employees** | PATCH | `/api/v1/employees/preferences` | `EmployeeController.updatePreferences` | `server/src/modules/employees/routes/employee.routes.ts:26` |
| **Employees** | PATCH | `/api/v1/employees/me/preferences` | `EmployeeController.updatePreferences` | `server/src/modules/employees/routes/employee.routes.ts:27` |
| **Employees** | PATCH | `/api/v1/employees/me/password` | `EmployeeController.changePassword` | `server/src/modules/employees/routes/employee.routes.ts:28` |
| **Employees** | GET | `/api/v1/employees` | `EmployeeController.listEmployees` | `server/src/modules/employees/routes/employee.routes.ts:31` |
| **Employees** | POST | `/api/v1/employees/invite` | `EmployeeController.inviteEmployee` | `server/src/modules/employees/routes/employee.routes.ts:37` |
| **Employees** | POST | `/api/v1/employees/import` | `EmployeeController.importEmployees` | `server/src/modules/employees/routes/employee.routes.ts:46` |
| **Employees** | GET | `/api/v1/employees/:id` | `EmployeeController.getEmployee` | `server/src/modules/employees/routes/employee.routes.ts:55` |
| **Employees** | PATCH | `/api/v1/employees/:id` | `EmployeeController.updateEmployee` | `server/src/modules/employees/routes/employee.routes.ts:61` |
| **Employees** | DELETE | `/api/v1/employees/:id` | `EmployeeController.deleteEmployee` | `server/src/modules/employees/routes/employee.routes.ts:70` |
| **Employees (Users Alias)** | GET | `/api/v1/users/me` | `EmployeeController.getMe` | `server/src/modules/employees/routes/employee.routes.ts:24` |
| **Employees (Users Alias)** | PATCH | `/api/v1/users/me` | `EmployeeController.updateMe` | `server/src/modules/employees/routes/employee.routes.ts:25` |
| **Employees (Users Alias)** | PATCH | `/api/v1/users/preferences` | `EmployeeController.updatePreferences` | `server/src/modules/employees/routes/employee.routes.ts:26` |
| **Employees (Users Alias)** | PATCH | `/api/v1/users/me/preferences` | `EmployeeController.updatePreferences` | `server/src/modules/employees/routes/employee.routes.ts:27` |
| **Employees (Users Alias)** | PATCH | `/api/v1/users/me/password` | `EmployeeController.changePassword` | `server/src/modules/employees/routes/employee.routes.ts:28` |
| **Employees (Users Alias)** | GET | `/api/v1/users` | `EmployeeController.listEmployees` | `server/src/modules/employees/routes/employee.routes.ts:31` |
| **Employees (Users Alias)** | POST | `/api/v1/users/invite` | `EmployeeController.inviteEmployee` | `server/src/modules/employees/routes/employee.routes.ts:37` |
| **Employees (Users Alias)** | POST | `/api/v1/users/import` | `EmployeeController.importEmployees` | `server/src/modules/employees/routes/employee.routes.ts:46` |
| **Employees (Users Alias)** | GET | `/api/v1/users/:id` | `EmployeeController.getEmployee` | `server/src/modules/employees/routes/employee.routes.ts:55` |
| **Employees (Users Alias)** | PATCH | `/api/v1/users/:id` | `EmployeeController.updateEmployee` | `server/src/modules/employees/routes/employee.routes.ts:61` |
| **Employees (Users Alias)** | DELETE | `/api/v1/users/:id` | `EmployeeController.deleteEmployee` | `server/src/modules/employees/routes/employee.routes.ts:70` |
| **Assignments & Journeys** | GET | `/api/v1/journeys` | `JourneyController.listJourneys` | `server/src/modules/journeys/routes/journey.routes.ts:22` |
| **Assignments & Journeys** | GET | `/api/v1/journeys/:id` | `JourneyController.getJourney` | `server/src/modules/journeys/routes/journey.routes.ts:25` |
| **Assignments & Journeys** | POST | `/api/v1/journeys` | `JourneyController.createJourney` | `server/src/modules/journeys/routes/journey.routes.ts:28` |
| **Assignments & Journeys** | PATCH | `/api/v1/journeys/:id` | `JourneyController.updateJourney` | `server/src/modules/journeys/routes/journey.routes.ts:38` |
| **Assignments & Journeys** | DELETE | `/api/v1/journeys/:id` | `JourneyController.deleteJourney` | `server/src/modules/journeys/routes/journey.routes.ts:48` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:id/publish` | `JourneyController.publishJourney` | `server/src/modules/journeys/routes/journey.routes.ts:55` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:id/archive` | `JourneyController.archiveJourney` | `server/src/modules/journeys/routes/journey.routes.ts:62` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:id/duplicate` | `JourneyController.duplicateJourney` | `server/src/modules/journeys/routes/journey.routes.ts:69` |
| **Assignments & Journeys** | GET | `/api/v1/journeys/:id/analytics` | `JourneyController.getJourneyAnalytics` | `server/src/modules/journeys/routes/journey.routes.ts:79` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:id/assignment-preview` | `JourneyController.previewSmartAssignment` | `server/src/modules/journeys/routes/journey.routes.ts:86` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:id/smart-assign` | `JourneyController.executeSmartAssignment` | `server/src/modules/journeys/routes/journey.routes.ts:93` |
| **Assignments & Journeys** | PATCH | `/api/v1/journeys/:id/targeting` | `JourneyController.updateTargeting` | `server/src/modules/journeys/routes/journey.routes.ts:100` |
| **Assignments & Journeys** | GET | `/api/v1/journeys/:id/prerequisites-check` | `JourneyController.checkPrerequisites` | `server/src/modules/journeys/routes/journey.routes.ts:107` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/:id/clone` | `JourneyController.cloneJourney` | `server/src/modules/journeys/routes/journey.routes.ts:110` |
| **Assignments & Journeys** | PUT | `/api/v1/journeys/:id/reorder` | `JourneyController.reorderCurriculum` | `server/src/modules/journeys/routes/journey.routes.ts:117` |
| **Assignments & Journeys** | POST | `/api/v1/journeys/reminders/dispatch` | `JourneyController.dispatchReminders` | `server/src/modules/journeys/routes/journey.routes.ts:124` |
| **Assignments & Journeys** | GET | `/api/v1/assignments/public/verify/:id` | `EmployeeAssignmentController.verifyCertificatePublic` | `server/src/modules/assignments/routes/assignment.routes.ts:18` |
| **Assignments & Journeys** | GET | `/api/v1/assignments/me` | `EmployeeAssignmentController.getMyAssignments` | `server/src/modules/assignments/routes/assignment.routes.ts:24` |
| **Assignments & Journeys** | GET | `/api/v1/assignments/me/active` | `EmployeeAssignmentController.getMyActiveAssignments` | `server/src/modules/assignments/routes/assignment.routes.ts:27` |
| **Assignments & Journeys** | GET | `/api/v1/assignments/me/completed` | `EmployeeAssignmentController.getMyCompletedAssignments` | `server/src/modules/assignments/routes/assignment.routes.ts:30` |
| **Assignments & Journeys** | GET | `/api/v1/assignments` | `EmployeeAssignmentController.listAssignments` | `server/src/modules/assignments/routes/assignment.routes.ts:33` |
| **Assignments & Journeys** | GET | `/api/v1/assignments/:id` | `EmployeeAssignmentController.getAssignment` | `server/src/modules/assignments/routes/assignment.routes.ts:36` |
| **Assignments & Journeys** | POST | `/api/v1/assignments` | `EmployeeAssignmentController.assignJourney` | `server/src/modules/assignments/routes/assignment.routes.ts:39` |
| **Assignments & Journeys** | POST | `/api/v1/assignments/bulk` | `EmployeeAssignmentController.bulkAssignJourneys` | `server/src/modules/assignments/routes/assignment.routes.ts:49` |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:id/start` | `EmployeeAssignmentController.startAssignment` | `server/src/modules/assignments/routes/assignment.routes.ts:57` |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:id/complete-lesson` | `EmployeeAssignmentController.completeLesson` | `server/src/modules/assignments/routes/assignment.routes.ts:59` |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:id/submit-quiz` | `EmployeeAssignmentController.submitQuiz` | `server/src/modules/assignments/routes/assignment.routes.ts:67` |
| **Assignments & Journeys** | POST | `/api/v1/assignments/:id/issue-certificate` | `EmployeeAssignmentController.issueCertificate` | `server/src/modules/assignments/routes/assignment.routes.ts:74` |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/chat` | `AIAssistantController.chat` | `server/src/modules/ai/routes/ai-assistant.routes.ts:14` |
| **AI Assistant & Course Builder** | GET | `/api/v1/ai/conversations` | `AIAssistantController.getConversations` | `server/src/modules/ai/routes/ai-assistant.routes.ts:17` |
| **AI Assistant & Course Builder** | GET | `/api/v1/ai/conversations/:id` | `AIAssistantController.getConversationById` | `server/src/modules/ai/routes/ai-assistant.routes.ts:20` |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/feedback` | `AIAssistantController.logFeedback` | `server/src/modules/ai/routes/ai-assistant.routes.ts:23` |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/course-builder/generate` | `AIAssistantController.generateCourseDraft` | `server/src/modules/ai/routes/ai-assistant.routes.ts:26` |
| **AI Assistant & Course Builder** | GET | `/api/v1/ai/course-builder/drafts` | `AIAssistantController.getCourseDrafts` | `server/src/modules/ai/routes/ai-assistant.routes.ts:27` |
| **AI Assistant & Course Builder** | GET | `/api/v1/ai/course-builder/drafts/:id` | `AIAssistantController.getCourseDraftById` | `server/src/modules/ai/routes/ai-assistant.routes.ts:28` |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/course-builder/drafts/:id/regenerate-module` | `AIAssistantController.regenerateModule` | `server/src/modules/ai/routes/ai-assistant.routes.ts:29` |
| **AI Assistant & Course Builder** | POST | `/api/v1/ai/course-builder/drafts/:id/publish` | `AIAssistantController.publishCourseDraft` | `server/src/modules/ai/routes/ai-assistant.routes.ts:30` |
| **AI Assistant & Course Builder** | DELETE | `/api/v1/ai/course-builder/drafts/:id` | `AIAssistantController.deleteCourseDraft` | `server/src/modules/ai/routes/ai-assistant.routes.ts:31` |
| **Tasks** | GET | `/api/v1/tasks` | `TaskController.listTasks` | `server/src/modules/tasks/routes/task.routes.ts:22` |
| **Tasks** | POST | `/api/v1/tasks` | `TaskController.createTask` | `server/src/modules/tasks/routes/task.routes.ts:25` |
| **Tasks** | GET | `/api/v1/tasks/:id` | `TaskController.getTask` | `server/src/modules/tasks/routes/task.routes.ts:28` |
| **Tasks** | PATCH | `/api/v1/tasks/:id/status` | `TaskController.updateStatus` | `server/src/modules/tasks/routes/task.routes.ts:31` |
| **Tasks** | POST | `/api/v1/tasks/:id/comments` | `TaskController.addComment` | `server/src/modules/tasks/routes/task.routes.ts:34` |
| **Tasks** | DELETE | `/api/v1/tasks/:id` | `TaskController.deleteTask` | `server/src/modules/tasks/routes/task.routes.ts:37` |
| **Documents & E-Signatures** | POST | `/api/v1/documents/templates` | `DocumentController.createTemplate` | `server/src/modules/documents/routes/document.routes.ts:20` |
| **Documents & E-Signatures** | GET | `/api/v1/documents/templates` | `DocumentController.listTemplates` | `server/src/modules/documents/routes/document.routes.ts:29` |
| **Documents & E-Signatures** | PUT | `/api/v1/documents/templates/:id` | `DocumentController.updateTemplate` | `server/src/modules/documents/routes/document.routes.ts:35` |
| **Documents & E-Signatures** | DELETE | `/api/v1/documents/templates/:id` | `DocumentController.deleteTemplate` | `server/src/modules/documents/routes/document.routes.ts:44` |
| **Documents & E-Signatures** | POST | `/api/v1/documents/assign` | `DocumentController.assignDocument` | `server/src/modules/documents/routes/document.routes.ts:51` |
| **Documents & E-Signatures** | GET | `/api/v1/documents/inbox` | `DocumentController.getEmployeeInbox` | `server/src/modules/documents/routes/document.routes.ts:61` |
| **Documents & E-Signatures** | GET | `/api/v1/documents/:id` | `DocumentController.getDocumentAssignment` | `server/src/modules/documents/routes/document.routes.ts:62` |
| **Documents & E-Signatures** | POST | `/api/v1/documents/:id/sign` | `DocumentController.signDocument` | `server/src/modules/documents/routes/document.routes.ts:63` |
| **Workflows & Automation** | GET | `/api/v1/workflows` | `WorkflowController.listRules` | `server/src/modules/workflows/routes/workflow.routes.ts:23` |
| **Workflows & Automation** | POST | `/api/v1/workflows` | `WorkflowController.createRule` | `server/src/modules/workflows/routes/workflow.routes.ts:26` |
| **Workflows & Automation** | GET | `/api/v1/workflows/executions` | `WorkflowController.getExecutionLogs` | `server/src/modules/workflows/routes/workflow.routes.ts:29` |
| **Workflows & Automation** | GET | `/api/v1/workflows/:id` | `WorkflowController.getRule` | `server/src/modules/workflows/routes/workflow.routes.ts:36` |
| **Workflows & Automation** | PATCH | `/api/v1/workflows/:id` | `WorkflowController.updateRule` | `server/src/modules/workflows/routes/workflow.routes.ts:39` |
| **Workflows & Automation** | PATCH | `/api/v1/workflows/:id/toggle` | `WorkflowController.toggleActive` | `server/src/modules/workflows/routes/workflow.routes.ts:42` |
| **Workflows & Automation** | DELETE | `/api/v1/workflows/:id` | `WorkflowController.deleteRule` | `server/src/modules/workflows/routes/workflow.routes.ts:45` |
| **Workflows & Automation** | POST | `/api/v1/workflows/:id/test-run` | `WorkflowController.testRun` | `server/src/modules/workflows/routes/workflow.routes.ts:48` |
| **Buddy & Support** | POST | `/api/v1/buddy/profiles` | `BuddyController.registerProfile` | `server/src/modules/buddy/routes/buddy.routes.ts:20` |
| **Buddy & Support** | GET | `/api/v1/buddy/available` | `BuddyController.listAvailableBuddies` | `server/src/modules/buddy/routes/buddy.routes.ts:26` |
| **Buddy & Support** | POST | `/api/v1/buddy/assign` | `BuddyController.assignBuddy` | `server/src/modules/buddy/routes/buddy.routes.ts:29` |
| **Buddy & Support** | GET | `/api/v1/buddy/my-buddy` | `BuddyController.getEmployeeBuddy` | `server/src/modules/buddy/routes/buddy.routes.ts:39` |
| **Buddy & Support** | GET | `/api/v1/buddy/my-mentees` | `BuddyController.getBuddyMentees` | `server/src/modules/buddy/routes/buddy.routes.ts:40` |
| **Buddy & Support** | PUT | `/api/v1/buddy/assignment/:id/checklist` | `BuddyController.updateChecklistTask` | `server/src/modules/buddy/routes/buddy.routes.ts:43` |
| **Buddy & Support** | POST | `/api/v1/buddy/assignment/:id/checkin` | `BuddyController.logBuddyCheckin` | `server/src/modules/buddy/routes/buddy.routes.ts:49` |
| **Milestones & Check-ins** | POST | `/api/v1/milestones/templates` | `MilestoneController.createTemplate` | `server/src/modules/milestones/routes/milestone.routes.ts:20` |
| **Milestones & Check-ins** | GET | `/api/v1/milestones/templates` | `MilestoneController.listTemplates` | `server/src/modules/milestones/routes/milestone.routes.ts:29` |
| **Milestones & Check-ins** | POST | `/api/v1/milestones/assign` | `MilestoneController.assignMilestone` | `server/src/modules/milestones/routes/milestone.routes.ts:32` |
| **Milestones & Check-ins** | GET | `/api/v1/milestones/my-milestones` | `MilestoneController.getMyMilestones` | `server/src/modules/milestones/routes/milestone.routes.ts:42` |
| **Milestones & Check-ins** | POST | `/api/v1/milestones/:id/self-checkin` | `MilestoneController.submitEmployeeSelfCheck` | `server/src/modules/milestones/routes/milestone.routes.ts:43` |
| **Milestones & Check-ins** | GET | `/api/v1/milestones/team-milestones` | `MilestoneController.getTeamMilestones` | `server/src/modules/milestones/routes/milestone.routes.ts:50` |
| **Milestones & Check-ins** | POST | `/api/v1/milestones/:id/manager-review` | `MilestoneController.submitManagerReview` | `server/src/modules/milestones/routes/milestone.routes.ts:56` |
| **Calendar & Meetings** | GET | `/api/v1/calendar/feed/:token` | `CalendarController.getICalFeed` | `server/src/modules/calendar/routes/calendar.routes.ts:16` |
| **Calendar & Meetings** | POST | `/api/v1/calendar/connection` | `CalendarController.connectProvider` | `server/src/modules/calendar/routes/calendar.routes.ts:22` |
| **Calendar & Meetings** | GET | `/api/v1/calendar/connection` | `CalendarController.getConnection` | `server/src/modules/calendar/routes/calendar.routes.ts:23` |
| **Calendar & Meetings** | POST | `/api/v1/calendar/events` | `CalendarController.createMeetingEvent` | `server/src/modules/calendar/routes/calendar.routes.ts:25` |
| **Calendar & Meetings** | GET | `/api/v1/calendar/events` | `CalendarController.listMeetingEvents` | `server/src/modules/calendar/routes/calendar.routes.ts:26` |
| **Calendar & Meetings** | PUT | `/api/v1/calendar/events/:id` | `CalendarController.updateMeetingEvent` | `server/src/modules/calendar/routes/calendar.routes.ts:27` |
| **Calendar & Meetings** | DELETE | `/api/v1/calendar/events/:id` | `CalendarController.cancelMeetingEvent` | `server/src/modules/calendar/routes/calendar.routes.ts:28` |
| **HR Operations** | GET | `/api/v1/hr/dashboard` | `HROperationsController.getDashboardMetrics` | `server/src/modules/hr/routes/hr-operations.routes.ts:18` |
| **HR Operations** | GET | `/api/v1/hr/exceptions` | `HROperationsController.getExceptionQueue` | `server/src/modules/hr/routes/hr-operations.routes.ts:19` |
| **HR Operations** | POST | `/api/v1/hr/handover/:userId/complete` | `HROperationsController.completeHandover` | `server/src/modules/hr/routes/hr-operations.routes.ts:20` |
| **HR Operations** | PUT | `/api/v1/hr/lifecycle/:userId/state` | `HROperationsController.updateLifecycleState` | `server/src/modules/hr/routes/hr-operations.routes.ts:21` |
| **HR Operations** | POST | `/api/v1/hr/bulk-action` | `HROperationsController.executeBulkAction` | `server/src/modules/hr/routes/hr-operations.routes.ts:26` |
| **HR Operations** | GET | `/api/v1/hr/compliance-report` | `HROperationsController.generateComplianceReport` | `server/src/modules/hr/routes/hr-operations.routes.ts:31` |
| **Manager Operations** | GET | `/api/v1/manager/dashboard` | `ManagerController.getManagerDashboard` | `server/src/modules/manager/routes/manager.routes.ts:16` |
| **Manager Operations** | GET | `/api/v1/manager/team` | `ManagerController.getTeamDirectReports` | `server/src/modules/manager/routes/manager.routes.ts:19` |
| **Manager Operations** | GET | `/api/v1/manager/team/:employeeId` | `ManagerController.getDirectReportDetails` | `server/src/modules/manager/routes/manager.routes.ts:22` |
| **Manager Operations** | POST | `/api/v1/manager/team/:employeeId/nudge` | `ManagerController.nudgeDirectReport` | `server/src/modules/manager/routes/manager.routes.ts:25` |
| **Manager Operations** | POST | `/api/v1/manager/team/:employeeId/sign-off` | `ManagerController.signOffDirectReport` | `server/src/modules/manager/routes/manager.routes.ts:32` |
| **Analytics & Reporting** | GET | `/api/v1/analytics/summary` | `AnalyticsController.getSummary` | `server/src/modules/analytics/routes/analytics.routes.ts:15` |
| **Analytics & Reporting** | GET | `/api/v1/analytics/time-to-completion` | `AnalyticsController.getTimeToCompletion` | `server/src/modules/analytics/routes/analytics.routes.ts:18` |
| **Analytics & Reporting** | GET | `/api/v1/analytics/bottlenecks` | `AnalyticsController.getBottlenecks` | `server/src/modules/analytics/routes/analytics.routes.ts:21` |
| **Analytics & Reporting** | GET | `/api/v1/analytics/export` | `AnalyticsController.exportCSV` | `server/src/modules/analytics/routes/analytics.routes.ts:24` |
| **Analytics & Reporting** | POST | `/api/v1/analytics/scheduled-reports` | `AnalyticsController.createScheduledReport` | `server/src/modules/analytics/routes/analytics.routes.ts:27` |
| **Analytics & Reporting** | GET | `/api/v1/analytics/scheduled-reports` | `AnalyticsController.listScheduledReports` | `server/src/modules/analytics/routes/analytics.routes.ts:28` |
| **Analytics & Reporting** | DELETE | `/api/v1/analytics/scheduled-reports/:id` | `AnalyticsController.deleteScheduledReport` | `server/src/modules/analytics/routes/analytics.routes.ts:29` |
| **Analytics & Reporting** | GET | `/api/v1/audit-logs/export` | `AuditLogController.exportLogs` | `server/src/modules/audit-logs/routes/audit-log.routes.ts:17` |
| **Analytics & Reporting** | GET | `/api/v1/audit-logs/security` | `AuditLogController.getSecurityLogs` | `server/src/modules/audit-logs/routes/audit-log.routes.ts:20` |
| **Analytics & Reporting** | GET | `/api/v1/audit-logs/user/:userId` | `AuditLogController.getUserLogs` | `server/src/modules/audit-logs/routes/audit-log.routes.ts:23` |
| **Analytics & Reporting** | GET | `/api/v1/audit-logs/resource/:resourceType/:resourceId` | `AuditLogController.getResourceLogs` | `server/src/modules/audit-logs/routes/audit-log.routes.ts:26` |
| **Analytics & Reporting** | GET | `/api/v1/audit-logs/:id` | `AuditLogController.getLogDetails` | `server/src/modules/audit-logs/routes/audit-log.routes.ts:29` |
| **Analytics & Reporting** | GET | `/api/v1/audit-logs` | `AuditLogController.listLogs` | `server/src/modules/audit-logs/routes/audit-log.routes.ts:32` |
| **Gamification** | GET | `/api/v1/gamification/profile` | `GamificationController.getProfile` | `server/src/modules/gamification/routes/gamification.routes.ts:14` |
| **Gamification** | POST | `/api/v1/gamification/award-points` | `GamificationController.awardPoints` | `server/src/modules/gamification/routes/gamification.routes.ts:17` |
| **Gamification** | POST | `/api/v1/gamification/streak` | `GamificationController.recordStreak` | `server/src/modules/gamification/routes/gamification.routes.ts:20` |
| **Gamification** | GET | `/api/v1/gamification/leaderboard` | `GamificationController.getLeaderboard` | `server/src/modules/gamification/routes/gamification.routes.ts:23` |
| **Knowledge Base** | GET | `/api/v1/knowledge-base/quick-links` | `QuickLinkController.getQuickLinks` | `server/src/modules/knowledge-base/routes/article.routes.ts:22` |
| **Knowledge Base** | POST | `/api/v1/knowledge-base/quick-links` | `QuickLinkController.createQuickLink` | `server/src/modules/knowledge-base/routes/article.routes.ts:28` |
| **Knowledge Base** | PATCH | `/api/v1/knowledge-base/quick-links/:id` | `QuickLinkController.updateQuickLink` | `server/src/modules/knowledge-base/routes/article.routes.ts:34` |
| **Knowledge Base** | DELETE | `/api/v1/knowledge-base/quick-links/:id` | `QuickLinkController.deleteQuickLink` | `server/src/modules/knowledge-base/routes/article.routes.ts:40` |
| **Knowledge Base** | GET | `/api/v1/knowledge-base/popular` | `KnowledgeBaseController.getPopularArticles` | `server/src/modules/knowledge-base/routes/article.routes.ts:47` |
| **Knowledge Base** | GET | `/api/v1/knowledge-base` | `KnowledgeBaseController.listArticles` | `server/src/modules/knowledge-base/routes/article.routes.ts:54` |
| **Knowledge Base** | GET | `/api/v1/knowledge-base/:id` | `KnowledgeBaseController.getArticle` | `server/src/modules/knowledge-base/routes/article.routes.ts:61` |
| **Knowledge Base** | POST | `/api/v1/knowledge-base` | `KnowledgeBaseController.createArticle` | `server/src/modules/knowledge-base/routes/article.routes.ts:68` |
| **Knowledge Base** | PATCH | `/api/v1/knowledge-base/:id` | `KnowledgeBaseController.updateArticle` | `server/src/modules/knowledge-base/routes/article.routes.ts:78` |
| **Knowledge Base** | DELETE | `/api/v1/knowledge-base/:id` | `KnowledgeBaseController.deleteArticle` | `server/src/modules/knowledge-base/routes/article.routes.ts:88` |
| **Knowledge Base** | POST | `/api/v1/knowledge-base/:id/publish` | `KnowledgeBaseController.publishArticle` | `server/src/modules/knowledge-base/routes/article.routes.ts:95` |
| **Knowledge Base** | POST | `/api/v1/knowledge-base/:id/archive` | `KnowledgeBaseController.archiveArticle` | `server/src/modules/knowledge-base/routes/article.routes.ts:102` |
| **Office Location & Maps** | GET | `/api/v1/locations/my-location` | `OfficeLocationController.getEmployeeGuidance` | `server/src/modules/locations/routes/office-location.routes.ts:13` |
| **Office Location & Maps** | GET | `/api/v1/locations` | `OfficeLocationController.getLocations` | `server/src/modules/locations/routes/office-location.routes.ts:16` |
| **Office Location & Maps** | GET | `/api/v1/locations/:id` | `OfficeLocationController.getLocationById` | `server/src/modules/locations/routes/office-location.routes.ts:17` |
| **Office Location & Maps** | POST | `/api/v1/locations` | `OfficeLocationController.createLocation` | `server/src/modules/locations/routes/office-location.routes.ts:18` |
| **Office Location & Maps** | PUT | `/api/v1/locations/:id` | `OfficeLocationController.updateLocation` | `server/src/modules/locations/routes/office-location.routes.ts:23` |
| **Office Location & Maps** | DELETE | `/api/v1/locations/:id` | `OfficeLocationController.deleteLocation` | `server/src/modules/locations/routes/office-location.routes.ts:28` |
| **Office Location & Maps** | POST | `/api/v1/locations/:id/assign-desk` | `OfficeLocationController.assignDesk` | `server/src/modules/locations/routes/office-location.routes.ts:33` |
| **Integrations & HRIS** | POST | `/api/v1/integrations/webhooks/:provider` | `HRISIntegrationController.handleWebhook` | `server/src/modules/integrations/routes/hris-integration.routes.ts:11` |
| **Integrations & HRIS** | GET | `/api/v1/integrations` | `HRISIntegrationController.getIntegrations` | `server/src/modules/integrations/routes/hris-integration.routes.ts:14` |
| **Integrations & HRIS** | POST | `/api/v1/integrations` | `HRISIntegrationController.createIntegration` | `server/src/modules/integrations/routes/hris-integration.routes.ts:19` |
| **Integrations & HRIS** | PUT | `/api/v1/integrations/:id` | `HRISIntegrationController.updateIntegration` | `server/src/modules/integrations/routes/hris-integration.routes.ts:24` |
| **Integrations & HRIS** | DELETE | `/api/v1/integrations/:id` | `HRISIntegrationController.deleteIntegration` | `server/src/modules/integrations/routes/hris-integration.routes.ts:29` |
| **Integrations & HRIS** | POST | `/api/v1/integrations/:id/test` | `HRISIntegrationController.testConnection` | `server/src/modules/integrations/routes/hris-integration.routes.ts:34` |
| **Integrations & HRIS** | POST | `/api/v1/integrations/:id/sync` | `HRISIntegrationController.triggerSync` | `server/src/modules/integrations/routes/hris-integration.routes.ts:39` |
| **Integrations & HRIS** | GET | `/api/v1/integrations/:id/logs` | `HRISIntegrationController.getSyncLogs` | `server/src/modules/integrations/routes/hris-integration.routes.ts:44` |
| **Notifications & Push** | GET | `/api/v1/notifications/preferences` | `NotificationController.getPreferences` | `server/src/modules/notifications/routes/notification.routes.ts:17` |
| **Notifications & Push** | PUT | `/api/v1/notifications/preferences` | `NotificationController.updatePreferences` | `server/src/modules/notifications/routes/notification.routes.ts:20` |
| **Notifications & Push** | GET | `/api/v1/notifications/unread` | `NotificationController.getUnreadNotifications` | `server/src/modules/notifications/routes/notification.routes.ts:23` |
| **Notifications & Push** | GET | `/api/v1/notifications/count` | `NotificationController.getUnreadCount` | `server/src/modules/notifications/routes/notification.routes.ts:26` |
| **Notifications & Push** | PATCH | `/api/v1/notifications/read-all` | `NotificationController.markAllRead` | `server/src/modules/notifications/routes/notification.routes.ts:29` |
| **Notifications & Push** | GET | `/api/v1/notifications` | `NotificationController.listNotifications` | `server/src/modules/notifications/routes/notification.routes.ts:32` |
| **Notifications & Push** | PATCH | `/api/v1/notifications/:id/read` | `NotificationController.markRead` | `server/src/modules/notifications/routes/notification.routes.ts:35` |
| **Notifications & Push** | DELETE | `/api/v1/notifications/:id` | `NotificationController.deleteNotification` | `server/src/modules/notifications/routes/notification.routes.ts:38` |
| **Notifications & Push** | POST | `/api/v1/notifications/push-subscription` | `NotificationController.registerPushSubscription` | `server/src/modules/notifications/routes/notification.routes.ts:41` |
| **Notifications & Push** | DELETE | `/api/v1/notifications/push-subscription` | `NotificationController.unregisterPushSubscription` | `server/src/modules/notifications/routes/notification.routes.ts:42` |
| **Uploads & Storage** | POST | `/api/v1/uploads/request-url` | `UploadController.requestUploadUrl` | `server/src/modules/uploads/routes/upload.routes.ts:17` |
| **Uploads & Storage** | POST | `/api/v1/uploads/presigned` | `UploadController.requestUploadUrl` | `server/src/modules/uploads/routes/upload.routes.ts:24` |
| **Uploads & Storage** | POST | `/api/v1/uploads/complete` | `UploadController.confirmUpload` | `server/src/modules/uploads/routes/upload.routes.ts:31` |
| **Uploads & Storage** | GET | `/api/v1/uploads/:id` | `UploadController.getUpload` | `server/src/modules/uploads/routes/upload.routes.ts:38` |
| **Uploads & Storage** | GET | `/api/v1/uploads` | `UploadController.listUploads` | `server/src/modules/uploads/routes/upload.routes.ts:41` |
| **Uploads & Storage** | DELETE | `/api/v1/uploads/:id` | `UploadController.deleteUpload` | `server/src/modules/uploads/routes/upload.routes.ts:44` |
| **Super Admin** | GET | `/api/v1/super-admin/telemetry` | `superAdminRoutes inline` | `server/src/modules/super-admin/routes/super-admin.routes.ts:16` |
| **Super Admin** | GET | `/api/v1/super-admin/activity-logs` | `superAdminRoutes inline` | `server/src/modules/super-admin/routes/super-admin.routes.ts:130` |
| **Super Admin** | GET | `/api/v1/super-admin/organizations` | `superAdminRoutes inline` | `server/src/modules/super-admin/routes/super-admin.routes.ts:159` |
| **Super Admin** | POST | `/api/v1/super-admin/organizations` | `superAdminRoutes inline` | `server/src/modules/super-admin/routes/super-admin.routes.ts:205` |
| **Super Admin** | PATCH | `/api/v1/super-admin/organizations/:id/status` | `superAdminRoutes inline` | `server/src/modules/super-admin/routes/super-admin.routes.ts:269` |
| **Super Admin** | GET | `/api/v1/super-admin/invoices` | `superAdminRoutes inline` | `server/src/modules/super-admin/routes/super-admin.routes.ts:318` |
| **Super Admin** | POST | `/api/v1/super-admin/invoices` | `superAdminRoutes inline` | `server/src/modules/super-admin/routes/super-admin.routes.ts:377` |
| **Super Admin** | GET | `/api/v1/super-admin/invoices/export` | `superAdminRoutes inline` | `server/src/modules/super-admin/routes/super-admin.routes.ts:412` |
| **Kiosk & Field Operations** | GET | `/api/v1/kiosk/journeys/play/:id` | `KioskController.getJourney` | `server/src/modules/kiosk/routes/kiosk.routes.ts:40` |
| **Kiosk & Field Operations** | GET | `/api/v1/kiosk/uploads/:id` | `kioskRoutes inline` | `server/src/modules/kiosk/routes/kiosk.routes.ts:49` |
| **Kiosk & Field Operations** | POST | `/api/v1/kiosk/journeys/:id/auth/pin` | `KioskController.validatePIN` | `server/src/modules/kiosk/routes/kiosk.routes.ts:93` |
| **Kiosk & Field Operations** | POST | `/api/v1/kiosk/devices/pair` | `KioskController.pairDevice` | `server/src/modules/kiosk/routes/kiosk.routes.ts:106` |
| **Kiosk & Field Operations** | POST | `/api/v1/kiosk/devices/heartbeat` | `KioskController.heartbeat` | `server/src/modules/kiosk/routes/kiosk.routes.ts:124` |
| **Kiosk & Field Operations** | POST | `/api/v1/kiosk/analytics/sync` | `KioskController.syncAnalytics` | `server/src/modules/kiosk/routes/kiosk.routes.ts:136` |
| **Kiosk & Field Operations** | GET | `/api/v1/kiosk/journeys` | `KioskController.listJourneys` | `server/src/modules/kiosk/routes/kiosk.routes.ts:170` |
| **Kiosk & Field Operations** | GET | `/api/v1/kiosk/journeys/:id` | `KioskController.getJourney` | `server/src/modules/kiosk/routes/kiosk.routes.ts:173` |
| **Kiosk & Field Operations** | POST | `/api/v1/kiosk/journeys` | `KioskController.createJourney` | `server/src/modules/kiosk/routes/kiosk.routes.ts:176` |
| **Kiosk & Field Operations** | PUT | `/api/v1/kiosk/journeys/:id` | `KioskController.updateJourney` | `server/src/modules/kiosk/routes/kiosk.routes.ts:187` |
| **Kiosk & Field Operations** | DELETE | `/api/v1/kiosk/journeys/:id` | `KioskController.deleteJourney` | `server/src/modules/kiosk/routes/kiosk.routes.ts:198` |
| **Kiosk & Field Operations** | POST | `/api/v1/kiosk/journeys/:id/publish` | `KioskController.publishJourney` | `server/src/modules/kiosk/routes/kiosk.routes.ts:201` |
| **Kiosk & Field Operations** | POST | `/api/v1/kiosk/devices/pair/code` | `KioskController.generatePairingCode` | `server/src/modules/kiosk/routes/kiosk.routes.ts:204` |
| **Kiosk & Field Operations** | GET | `/api/v1/kiosk/devices` | `KioskController.listDevices` | `server/src/modules/kiosk/routes/kiosk.routes.ts:217` |
| **Kiosk & Field Operations** | POST | `/api/v1/kiosk/devices/:id/pair-journey` | `KioskController.pairJourneyToDevice` | `server/src/modules/kiosk/routes/kiosk.routes.ts:220` |
| **Kiosk & Field Operations** | GET | `/api/v1/kiosk/journeys/:id/analytics` | `KioskController.getJourneyAnalyticsSummary` | `server/src/modules/kiosk/routes/kiosk.routes.ts:233` |
| **Localization** | GET | `/api/v1/localization/supported-locales` | `LocalizationController.getSupportedLocales` | `server/src/modules/localization/routes/localization.routes.ts:12` |
| **Localization** | POST | `/api/v1/localization/translate-realtime` | `LocalizationController.translateRealtime` | `server/src/modules/localization/routes/localization.routes.ts:15` |
| **Localization** | GET | `/api/v1/localization/:entityType/:entityId` | `LocalizationController.getEntityTranslations` | `server/src/modules/localization/routes/localization.routes.ts:18` |
| **Localization** | GET | `/api/v1/localization/admin/:entityType/:entityId/translations` | `LocalizationController.listTranslations` | `server/src/modules/localization/routes/localization.routes.ts:29` |
| **Localization** | PUT | `/api/v1/localization/admin/:entityType/:entityId/:field/:lang` | `LocalizationController.upsertTranslation` | `server/src/modules/localization/routes/localization.routes.ts:36` |
| **Localization** | POST | `/api/v1/localization/admin/:entityType/:entityId/:field/:lang/approve` | `LocalizationController.approveTranslation` | `server/src/modules/localization/routes/localization.routes.ts:43` |
| **Localization** | GET | `/api/v1/localization/admin/missing` | `LocalizationController.listMissingTranslations` | `server/src/modules/localization/routes/localization.routes.ts:52` |
| **Localization** | GET | `/api/v1/localization/admin/outdated` | `LocalizationController.listOutdatedTranslations` | `server/src/modules/localization/routes/localization.routes.ts:55` |
| **Localization** | GET | `/api/v1/localization/admin/coverage` | `LocalizationController.translationCoverage` | `server/src/modules/localization/routes/localization.routes.ts:58` |

---

## 2. Module Summary

### System & Health
- GET `/live`
- GET `/ready`
- GET `/health`

### Authentication & Identity
- GET `/api/v1/auth/sso/config`
- POST `/api/v1/auth/login`
- POST `/api/v1/auth/register`
- POST `/api/v1/auth/refresh`
- POST `/api/v1/auth/logout`
- POST `/api/v1/auth/forgot-password`
- POST `/api/v1/auth/reset-password`
- POST `/api/v1/auth/invitations/accept`
- POST `/api/v1/auth/sso/discover`
- POST `/api/v1/auth/sso/initiate`
- POST `/api/v1/auth/sso/callback`
- PUT `/api/v1/auth/sso/config`

### Organizations & Departments
- GET `/api/v1/organizations/current`
- GET `/api/v1/organizations/departments`
- GET `/api/v1/organizations/teams`
- POST `/api/v1/organizations/departments`
- POST `/api/v1/organizations/teams`
- PATCH `/api/v1/organizations/current`
- PATCH `/api/v1/organizations/branding`
- PATCH `/api/v1/organizations/security`
- PATCH `/api/v1/organizations/departments/:id`
- PATCH `/api/v1/organizations/teams/:id`
- DELETE `/api/v1/organizations/departments/:id`
- DELETE `/api/v1/organizations/teams/:id`

### Employees & User Management (Dual Prefix: `/employees` and `/users`)
- GET `/api/v1/employees/me` & `/api/v1/users/me`
- GET `/api/v1/employees` & `/api/v1/users`
- GET `/api/v1/employees/:id` & `/api/v1/users/:id`
- POST `/api/v1/employees/invite` & `/api/v1/users/invite`
- POST `/api/v1/employees/import` & `/api/v1/users/import`
- PATCH `/api/v1/employees/me` & `/api/v1/users/me`
- PATCH `/api/v1/employees/preferences` & `/api/v1/users/preferences`
- PATCH `/api/v1/employees/me/preferences` & `/api/v1/users/me/preferences`
- PATCH `/api/v1/employees/me/password` & `/api/v1/users/me/password`
- PATCH `/api/v1/employees/:id` & `/api/v1/users/:id`
- DELETE `/api/v1/employees/:id` & `/api/v1/users/:id`

### Assignments & Journeys
- GET `/api/v1/journeys`
- GET `/api/v1/journeys/:id`
- GET `/api/v1/journeys/:id/analytics`
- GET `/api/v1/journeys/:id/prerequisites-check`
- GET `/api/v1/assignments/public/verify/:id`
- GET `/api/v1/assignments/me`
- GET `/api/v1/assignments/me/active`
- GET `/api/v1/assignments/me/completed`
- GET `/api/v1/assignments`
- GET `/api/v1/assignments/:id`
- POST `/api/v1/journeys`
- POST `/api/v1/journeys/:id/publish`
- POST `/api/v1/journeys/:id/archive`
- POST `/api/v1/journeys/:id/duplicate`
- POST `/api/v1/journeys/:id/assignment-preview`
- POST `/api/v1/journeys/:id/smart-assign`
- POST `/api/v1/journeys/:id/clone`
- POST `/api/v1/journeys/reminders/dispatch`
- POST `/api/v1/assignments`
- POST `/api/v1/assignments/bulk`
- POST `/api/v1/assignments/:id/start`
- POST `/api/v1/assignments/:id/complete-lesson`
- POST `/api/v1/assignments/:id/submit-quiz`
- POST `/api/v1/assignments/:id/issue-certificate`
- PATCH `/api/v1/journeys/:id`
- PATCH `/api/v1/journeys/:id/targeting`
- PUT `/api/v1/journeys/:id/reorder`
- DELETE `/api/v1/journeys/:id`

### AI Assistant & Course Builder
- GET `/api/v1/ai/conversations`
- GET `/api/v1/ai/conversations/:id`
- GET `/api/v1/ai/course-builder/drafts`
- GET `/api/v1/ai/course-builder/drafts/:id`
- POST `/api/v1/ai/chat`
- POST `/api/v1/ai/feedback`
- POST `/api/v1/ai/course-builder/generate`
- POST `/api/v1/ai/course-builder/drafts/:id/regenerate-module`
- POST `/api/v1/ai/course-builder/drafts/:id/publish`
- DELETE `/api/v1/ai/course-builder/drafts/:id`

### Tasks
- GET `/api/v1/tasks`
- GET `/api/v1/tasks/:id`
- POST `/api/v1/tasks`
- POST `/api/v1/tasks/:id/comments`
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
- GET `/api/v1/workflows/executions`
- GET `/api/v1/workflows/:id`
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
- POST `/api/v1/buddy/assignment/:id/checkin`
- PUT `/api/v1/buddy/assignment/:id/checklist`

### Milestones & Check-ins
- GET `/api/v1/milestones/templates`
- GET `/api/v1/milestones/my-milestones`
- GET `/api/v1/milestones/team-milestones`
- POST `/api/v1/milestones/templates`
- POST `/api/v1/milestones/assign`
- POST `/api/v1/milestones/:id/self-checkin`
- POST `/api/v1/milestones/:id/manager-review`

### Calendar & Meetings
- GET `/api/v1/calendar/feed/:token`
- GET `/api/v1/calendar/connection`
- GET `/api/v1/calendar/events`
- POST `/api/v1/calendar/connection`
- POST `/api/v1/calendar/events`
- PUT `/api/v1/calendar/events/:id`
- DELETE `/api/v1/calendar/events/:id`

### HR Operations & Compliance
- GET `/api/v1/hr/dashboard`
- GET `/api/v1/hr/exceptions`
- GET `/api/v1/hr/compliance-report`
- POST `/api/v1/hr/handover/:userId/complete`
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
- GET `/api/v1/audit-logs/export`
- GET `/api/v1/audit-logs/security`
- GET `/api/v1/audit-logs/user/:userId`
- GET `/api/v1/audit-logs/resource/:resourceType/:resourceId`
- GET `/api/v1/audit-logs/:id`
- GET `/api/v1/audit-logs`
- POST `/api/v1/analytics/scheduled-reports`
- DELETE `/api/v1/analytics/scheduled-reports/:id`

### Gamification & Engagement
- GET `/api/v1/gamification/profile`
- GET `/api/v1/gamification/leaderboard`
- POST `/api/v1/gamification/award-points`
- POST `/api/v1/gamification/streak`

### Knowledge Base
- GET `/api/v1/knowledge-base/quick-links`
- GET `/api/v1/knowledge-base/popular`
- GET `/api/v1/knowledge-base`
- GET `/api/v1/knowledge-base/:id`
- POST `/api/v1/knowledge-base/quick-links`
- POST `/api/v1/knowledge-base`
- POST `/api/v1/knowledge-base/:id/publish`
- POST `/api/v1/knowledge-base/:id/archive`
- PATCH `/api/v1/knowledge-base/quick-links/:id`
- PATCH `/api/v1/knowledge-base/:id`
- DELETE `/api/v1/knowledge-base/quick-links/:id`
- DELETE `/api/v1/knowledge-base/:id`

### Office Location & Maps
- GET `/api/v1/locations/my-location`
- GET `/api/v1/locations`
- GET `/api/v1/locations/:id`
- POST `/api/v1/locations`
- POST `/api/v1/locations/:id/assign-desk`
- PUT `/api/v1/locations/:id`
- DELETE `/api/v1/locations/:id`

### Integrations & HRIS
- GET `/api/v1/integrations`
- GET `/api/v1/integrations/:id/logs`
- POST `/api/v1/integrations/webhooks/:provider`
- POST `/api/v1/integrations`
- POST `/api/v1/integrations/:id/test`
- POST `/api/v1/integrations/:id/sync`
- PUT `/api/v1/integrations/:id`
- DELETE `/api/v1/integrations/:id`

### Notifications & Push
- GET `/api/v1/notifications/preferences`
- GET `/api/v1/notifications/unread`
- GET `/api/v1/notifications/count`
- GET `/api/v1/notifications`
- POST `/api/v1/notifications/push-subscription`
- PUT `/api/v1/notifications/preferences`
- PATCH `/api/v1/notifications/read-all`
- PATCH `/api/v1/notifications/:id/read`
- DELETE `/api/v1/notifications/:id`
- DELETE `/api/v1/notifications/push-subscription`

### Uploads & Storage
- GET `/api/v1/uploads/:id`
- GET `/api/v1/uploads`
- POST `/api/v1/uploads/request-url`
- POST `/api/v1/uploads/presigned`
- POST `/api/v1/uploads/complete`
- DELETE `/api/v1/uploads/:id`

### Super Admin Operations
- GET `/api/v1/super-admin/telemetry`
- GET `/api/v1/super-admin/activity-logs`
- GET `/api/v1/super-admin/organizations`
- GET `/api/v1/super-admin/invoices`
- GET `/api/v1/super-admin/invoices/export`
- POST `/api/v1/super-admin/organizations`
- POST `/api/v1/super-admin/invoices`
- PATCH `/api/v1/super-admin/organizations/:id/status`

### Kiosk & Field Operations
- GET `/api/v1/kiosk/journeys/play/:id`
- GET `/api/v1/kiosk/uploads/:id`
- GET `/api/v1/kiosk/journeys`
- GET `/api/v1/kiosk/journeys/:id`
- GET `/api/v1/kiosk/devices`
- GET `/api/v1/kiosk/journeys/:id/analytics`
- POST `/api/v1/kiosk/journeys/:id/auth/pin`
- POST `/api/v1/kiosk/devices/pair`
- POST `/api/v1/kiosk/devices/heartbeat`
- POST `/api/v1/kiosk/analytics/sync`
- POST `/api/v1/kiosk/journeys`
- POST `/api/v1/kiosk/journeys/:id/publish`
- POST `/api/v1/kiosk/devices/pair/code`
- POST `/api/v1/kiosk/devices/:id/pair-journey`
- PUT `/api/v1/kiosk/journeys/:id`
- DELETE `/api/v1/kiosk/journeys/:id`

### Localization
- GET `/api/v1/localization/supported-locales`
- GET `/api/v1/localization/:entityType/:entityId`
- GET `/api/v1/localization/admin/:entityType/:entityId/translations`
- GET `/api/v1/localization/admin/missing`
- GET `/api/v1/localization/admin/outdated`
- GET `/api/v1/localization/admin/coverage`
- POST `/api/v1/localization/translate-realtime`
- POST `/api/v1/localization/admin/:entityType/:entityId/:field/:lang/approve`
- PUT `/api/v1/localization/admin/:entityType/:entityId/:field/:lang`

---

## 3. Dynamic Route Patterns

The following routes contain dynamic parameters and are registered at runtime by the server application:

| Server Route Pattern | Source Registration File | Handler Method |
| :--- | :--- | :--- |
| `/api/v1/organizations/departments/:id` | `server/src/modules/organizations/routes/organization.routes.ts` | `OrganizationController.updateDepartment` / `deleteDepartment` |
| `/api/v1/organizations/teams/:id` | `server/src/modules/organizations/routes/organization.routes.ts` | `OrganizationController.updateTeam` / `deleteTeam` |
| `/api/v1/employees/:id` | `server/src/modules/employees/routes/employee.routes.ts` | `EmployeeController.getEmployee` / `updateEmployee` / `deleteEmployee` |
| `/api/v1/users/:id` | `server/src/modules/employees/routes/employee.routes.ts` | `EmployeeController.getEmployee` / `updateEmployee` / `deleteEmployee` |
| `/api/v1/journeys/:id` | `server/src/modules/journeys/routes/journey.routes.ts` | `JourneyController.getJourney` / `updateJourney` / `deleteJourney` |
| `/api/v1/journeys/:id/publish` | `server/src/modules/journeys/routes/journey.routes.ts` | `JourneyController.publishJourney` |
| `/api/v1/journeys/:id/archive` | `server/src/modules/journeys/routes/journey.routes.ts` | `JourneyController.archiveJourney` |
| `/api/v1/journeys/:id/duplicate` | `server/src/modules/journeys/routes/journey.routes.ts` | `JourneyController.duplicateJourney` |
| `/api/v1/journeys/:id/analytics` | `server/src/modules/journeys/routes/journey.routes.ts` | `JourneyController.getJourneyAnalytics` |
| `/api/v1/journeys/:id/assignment-preview` | `server/src/modules/journeys/routes/journey.routes.ts` | `JourneyController.previewSmartAssignment` |
| `/api/v1/journeys/:id/smart-assign` | `server/src/modules/journeys/routes/journey.routes.ts` | `JourneyController.executeSmartAssignment` |
| `/api/v1/journeys/:id/targeting` | `server/src/modules/journeys/routes/journey.routes.ts` | `JourneyController.updateTargeting` |
| `/api/v1/journeys/:id/prerequisites-check` | `server/src/modules/journeys/routes/journey.routes.ts` | `JourneyController.checkPrerequisites` |
| `/api/v1/journeys/:id/clone` | `server/src/modules/journeys/routes/journey.routes.ts` | `JourneyController.cloneJourney` |
| `/api/v1/journeys/:id/reorder` | `server/src/modules/journeys/routes/journey.routes.ts` | `JourneyController.reorderCurriculum` |
| `/api/v1/assignments/public/verify/:id` | `server/src/modules/assignments/routes/assignment.routes.ts` | `EmployeeAssignmentController.verifyCertificatePublic` |
| `/api/v1/assignments/:id` | `server/src/modules/assignments/routes/assignment.routes.ts` | `EmployeeAssignmentController.getAssignment` |
| `/api/v1/assignments/:id/start` | `server/src/modules/assignments/routes/assignment.routes.ts` | `EmployeeAssignmentController.startAssignment` |
| `/api/v1/assignments/:id/complete-lesson` | `server/src/modules/assignments/routes/assignment.routes.ts` | `EmployeeAssignmentController.completeLesson` |
| `/api/v1/assignments/:id/submit-quiz` | `server/src/modules/assignments/routes/assignment.routes.ts` | `EmployeeAssignmentController.submitQuiz` |
| `/api/v1/assignments/:id/issue-certificate` | `server/src/modules/assignments/routes/assignment.routes.ts` | `EmployeeAssignmentController.issueCertificate` |
| `/api/v1/ai/conversations/:id` | `server/src/modules/ai/routes/ai-assistant.routes.ts` | `AIAssistantController.getConversationById` |
| `/api/v1/ai/course-builder/drafts/:id` | `server/src/modules/ai/routes/ai-assistant.routes.ts` | `AIAssistantController.getCourseDraftById` / `deleteCourseDraft` |
| `/api/v1/ai/course-builder/drafts/:id/regenerate-module` | `server/src/modules/ai/routes/ai-assistant.routes.ts` | `AIAssistantController.regenerateModule` |
| `/api/v1/ai/course-builder/drafts/:id/publish` | `server/src/modules/ai/routes/ai-assistant.routes.ts` | `AIAssistantController.publishCourseDraft` |
| `/api/v1/tasks/:id` | `server/src/modules/tasks/routes/task.routes.ts` | `TaskController.getTask` / `deleteTask` |
| `/api/v1/tasks/:id/status` | `server/src/modules/tasks/routes/task.routes.ts` | `TaskController.updateStatus` |
| `/api/v1/tasks/:id/comments` | `server/src/modules/tasks/routes/task.routes.ts` | `TaskController.addComment` |
| `/api/v1/documents/templates/:id` | `server/src/modules/documents/routes/document.routes.ts` | `DocumentController.updateTemplate` / `deleteTemplate` |
| `/api/v1/documents/:id` | `server/src/modules/documents/routes/document.routes.ts` | `DocumentController.getDocumentAssignment` |
| `/api/v1/documents/:id/sign` | `server/src/modules/documents/routes/document.routes.ts` | `DocumentController.signDocument` |
| `/api/v1/workflows/:id` | `server/src/modules/workflows/routes/workflow.routes.ts` | `WorkflowController.getRule` / `updateRule` / `deleteRule` |
| `/api/v1/workflows/:id/toggle` | `server/src/modules/workflows/routes/workflow.routes.ts` | `WorkflowController.toggleActive` |
| `/api/v1/workflows/:id/test-run` | `server/src/modules/workflows/routes/workflow.routes.ts` | `WorkflowController.testRun` |
| `/api/v1/buddy/assignment/:id/checklist` | `server/src/modules/buddy/routes/buddy.routes.ts` | `BuddyController.updateChecklistTask` |
| `/api/v1/buddy/assignment/:id/checkin` | `server/src/modules/buddy/routes/buddy.routes.ts` | `BuddyController.logBuddyCheckin` |
| `/api/v1/milestones/:id/self-checkin` | `server/src/modules/milestones/routes/milestone.routes.ts` | `MilestoneController.submitEmployeeSelfCheck` |
| `/api/v1/milestones/:id/manager-review` | `server/src/modules/milestones/routes/milestone.routes.ts` | `MilestoneController.submitManagerReview` |
| `/api/v1/calendar/feed/:token` | `server/src/modules/calendar/routes/calendar.routes.ts` | `CalendarController.getICalFeed` |
| `/api/v1/calendar/events/:id` | `server/src/modules/calendar/routes/calendar.routes.ts` | `CalendarController.updateMeetingEvent` / `cancelMeetingEvent` |
| `/api/v1/hr/handover/:userId/complete` | `server/src/modules/hr/routes/hr-operations.routes.ts` | `HROperationsController.completeHandover` |
| `/api/v1/hr/lifecycle/:userId/state` | `server/src/modules/hr/routes/hr-operations.routes.ts` | `HROperationsController.updateLifecycleState` |
| `/api/v1/manager/team/:employeeId` | `server/src/modules/manager/routes/manager.routes.ts` | `ManagerController.getDirectReportDetails` |
| `/api/v1/manager/team/:employeeId/nudge` | `server/src/modules/manager/routes/manager.routes.ts` | `ManagerController.nudgeDirectReport` |
| `/api/v1/manager/team/:employeeId/sign-off` | `server/src/modules/manager/routes/manager.routes.ts` | `ManagerController.signOffDirectReport` |
| `/api/v1/analytics/scheduled-reports/:id` | `server/src/modules/analytics/routes/analytics.routes.ts` | `AnalyticsController.deleteScheduledReport` |
| `/api/v1/audit-logs/user/:userId` | `server/src/modules/audit-logs/routes/audit-log.routes.ts` | `AuditLogController.getUserLogs` |
| `/api/v1/audit-logs/resource/:resourceType/:resourceId` | `server/src/modules/audit-logs/routes/audit-log.routes.ts` | `AuditLogController.getResourceLogs` |
| `/api/v1/audit-logs/:id` | `server/src/modules/audit-logs/routes/audit-log.routes.ts` | `AuditLogController.getLogDetails` |
| `/api/v1/knowledge-base/:id` | `server/src/modules/knowledge-base/routes/article.routes.ts` | `KnowledgeBaseController.getArticle` / `updateArticle` / `deleteArticle` |
| `/api/v1/knowledge-base/:id/publish` | `server/src/modules/knowledge-base/routes/article.routes.ts` | `KnowledgeBaseController.publishArticle` |
| `/api/v1/knowledge-base/:id/archive` | `server/src/modules/knowledge-base/routes/article.routes.ts` | `KnowledgeBaseController.archiveArticle` |
| `/api/v1/knowledge-base/quick-links/:id` | `server/src/modules/knowledge-base/routes/article.routes.ts` | `QuickLinkController.updateQuickLink` / `deleteQuickLink` |
| `/api/v1/locations/:id` | `server/src/modules/locations/routes/office-location.routes.ts` | `OfficeLocationController.getLocationById` / `updateLocation` / `deleteLocation` |
| `/api/v1/locations/:id/assign-desk` | `server/src/modules/locations/routes/office-location.routes.ts` | `OfficeLocationController.assignDesk` |
| `/api/v1/integrations/webhooks/:provider` | `server/src/modules/integrations/routes/hris-integration.routes.ts` | `HRISIntegrationController.handleWebhook` |
| `/api/v1/integrations/:id` | `server/src/modules/integrations/routes/hris-integration.routes.ts` | `HRISIntegrationController.updateIntegration` / `deleteIntegration` |
| `/api/v1/integrations/:id/test` | `server/src/modules/integrations/routes/hris-integration.routes.ts` | `HRISIntegrationController.testConnection` |
| `/api/v1/integrations/:id/sync` | `server/src/modules/integrations/routes/hris-integration.routes.ts` | `HRISIntegrationController.triggerSync` |
| `/api/v1/integrations/:id/logs` | `server/src/modules/integrations/routes/hris-integration.routes.ts` | `HRISIntegrationController.getSyncLogs` |
| `/api/v1/notifications/:id/read` | `server/src/modules/notifications/routes/notification.routes.ts` | `NotificationController.markRead` |
| `/api/v1/notifications/:id` | `server/src/modules/notifications/routes/notification.routes.ts` | `NotificationController.deleteNotification` |
| `/api/v1/uploads/:id` | `server/src/modules/uploads/routes/upload.routes.ts` | `UploadController.getUpload` / `deleteUpload` |
| `/api/v1/super-admin/organizations/:id/status` | `server/src/modules/super-admin/routes/super-admin.routes.ts` | `superAdminRoutes inline` |
| `/api/v1/kiosk/journeys/play/:id` | `server/src/modules/kiosk/routes/kiosk.routes.ts` | `KioskController.getJourney` |
| `/api/v1/kiosk/uploads/:id` | `server/src/modules/kiosk/routes/kiosk.routes.ts` | `kioskRoutes inline` |
| `/api/v1/kiosk/journeys/:id/auth/pin` | `server/src/modules/kiosk/routes/kiosk.routes.ts` | `KioskController.validatePIN` |
| `/api/v1/kiosk/journeys/:id` | `server/src/modules/kiosk/routes/kiosk.routes.ts` | `KioskController.getJourney` / `updateJourney` / `deleteJourney` |
| `/api/v1/kiosk/journeys/:id/publish` | `server/src/modules/kiosk/routes/kiosk.routes.ts` | `KioskController.publishJourney` |
| `/api/v1/kiosk/devices/:id/pair-journey` | `server/src/modules/kiosk/routes/kiosk.routes.ts` | `KioskController.pairJourneyToDevice` |
| `/api/v1/kiosk/journeys/:id/analytics` | `server/src/modules/kiosk/routes/kiosk.routes.ts` | `KioskController.getJourneyAnalyticsSummary` |
| `/api/v1/localization/:entityType/:entityId` | `server/src/modules/localization/routes/localization.routes.ts` | `LocalizationController.getEntityTranslations` |
| `/api/v1/localization/admin/:entityType/:entityId/translations` | `server/src/modules/localization/routes/localization.routes.ts` | `LocalizationController.listTranslations` |
| `/api/v1/localization/admin/:entityType/:entityId/:field/:lang` | `server/src/modules/localization/routes/localization.routes.ts` | `LocalizationController.upsertTranslation` |
| `/api/v1/localization/admin/:entityType/:entityId/:field/:lang/approve` | `server/src/modules/localization/routes/localization.routes.ts` | `LocalizationController.approveTranslation` |

---

## 4. Defined but Not Registered Routes

| Module | Method | Endpoint | Source Location | Status |
| :--- | :--- | :--- | :--- | :--- |
| *None* | *None* | *None* | *None* | `REGISTERED` |

*Audit Verification*: Every route file defined across `server/src/modules/` is imported and registered in the Fastify bootstrap entrypoint (`server/src/app.ts`). The `onboarding` directory contains internal event sub-models and services (`onboarding-case.model`, `outbox-event.model`, `outbox-publisher.service`) but defines no HTTP route handlers.

---

## 5. Unresolved / Dynamically Constructed Routes

| Source Location | HTTP Method | Known Path | Unresolved Element |
| :--- | :--- | :--- | :--- |
| *None* | *None* | *None* | *All static and dynamic route prefixes are 100% resolved* |

*Audit Verification*: All module prefixes (`/api/v1/auth`, `/api/v1/organizations`, `/api/v1/employees`, `/api/v1/users`, etc.) are declared as literal strings in `server/src/app.ts` during Fastify plugin registration. No dynamic route factories or runtime unresolved parent prefixes exist.

---

## 6. Server Endpoint Count

Registered endpoint patterns: 229

By method:
GET: 95
POST: 80
PUT: 10
PATCH: 25
DELETE: 19

Defined but not registered: 0
Unresolved: 0

---

## 7. Runtime Registration Map

The diagram below documents the exact runtime registration chain from application bootstrap through Fastify plugin registration to route handlers:

```
server/src/server.ts
    ↓ (invokes)
server/src/app.ts (buildApp)
    ├── Fastify Foundation Plugins (Helmet, CORS, Cookie, Compress, RateLimit, Multipart, JWT, Swagger)
    ├── Health Routes (/live, /ready, /health)
    │
    ├── /api/v1/auth ──> authRoutes (auth.routes.ts) ──> AuthController
    ├── /api/v1/auth/sso ──> ssoRoutes (sso.routes.ts) ──> SSOController
    ├── /api/v1/integrations ──> hrisIntegrationRoutes (hris-integration.routes.ts) ──> HRISIntegrationController
    ├── /api/v1/locations ──> officeLocationRoutes (office-location.routes.ts) ──> OfficeLocationController
    ├── /api/v1/organizations ──> organizationRoutes (organization.routes.ts) ──> OrganizationController
    ├── /api/v1/employees ──> employeeRoutes (employee.routes.ts) ──> EmployeeController
    ├── /api/v1/users ──> employeeRoutes (employee.routes.ts [alias]) ──> EmployeeController
    ├── /api/v1/journeys ──> journeyRoutes (journey.routes.ts) ──> JourneyController
    ├── /api/v1/assignments ──> assignmentRoutes (assignment.routes.ts) ──> EmployeeAssignmentController
    ├── /api/v1/knowledge-base ──> knowledgeBaseRoutes (article.routes.ts) ──> KnowledgeBaseController / QuickLinkController
    ├── /api/v1/uploads ──> uploadRoutes (upload.routes.ts) ──> UploadController
    ├── /api/v1/notifications ──> notificationRoutes (notification.routes.ts) ──> NotificationController
    ├── /api/v1/audit-logs ──> auditLogRoutes (audit-log.routes.ts) ──> AuditLogController
    ├── /api/v1/super-admin ──> superAdminRoutes (super-admin.routes.ts) ──> Inline Route Handlers
    ├── /api/v1/analytics ──> analyticsRoutes (analytics.routes.ts) ──> AnalyticsController
    ├── /api/v1/localization ──> localizationRoutes (localization.routes.ts) ──> LocalizationController
    ├── /api/v1/kiosk ──> kioskRoutes (kiosk.routes.ts) ──> KioskController
    ├── /api/v1/tasks ──> taskRoutes (task.routes.ts) ──> TaskController
    ├── /api/v1/workflows ──> workflowRoutes (workflow.routes.ts) ──> WorkflowController
    ├── /api/v1/manager ──> managerRoutes (manager.routes.ts) ──> ManagerController
    ├── /api/v1/documents ──> documentRoutes (document.routes.ts) ──> DocumentController
    ├── /api/v1/milestones ──> milestoneRoutes (milestone.routes.ts) ──> MilestoneController
    ├── /api/v1/buddy ──> buddyRoutes (buddy.routes.ts) ──> BuddyController
    ├── /api/v1/calendar ──> calendarRoutes (calendar.routes.ts) ──> CalendarController
    ├── /api/v1/hr ──> hrOperationsRoutes (hr-operations.routes.ts) ──> HROperationsController
    ├── /api/v1/gamification ──> gamificationRoutes (gamification.routes.ts) ──> GamificationController
    └── /api/v1/ai ──> aiAssistantRoutes (ai-assistant.routes.ts) ──> AIAssistantController
```

---

## 8. Audit Boundary

This inventory represents only HTTP API endpoints exposed at runtime by the server codebase (`server/src/`). No determination has been made regarding frontend availability, client usage, route compatibility, schema alignment, or authorization correctness. Frontend-to-server endpoint gap analysis is a separate subsequent audit phase.
