# TALNOVA ONBOARDING — ROUTE INVENTORY

Generated: 2026-08-23
Auditor: Master Browser Process-Flow Forensic Validation Agent

---

## Complete Discovered Route Inventory

| Route | Page / Component | Reachable | API Calls | Console Errors | Status / Result |
|---|---|:---:|:---:|:---:|---|
| `/login` | Login | Yes | `POST /api/v1/auth/login` | None | PASS |
| `/register` | Register | Yes | `POST /api/v1/auth/register` | None | PASS |
| `/forgot-password` | ForgotPassword | Yes | `POST /api/v1/auth/forgot-password` | None | PASS |
| `/` | DashboardRedirect / Dashboard | Yes | `GET /api/v1/dashboard/stats`, `GET /api/v1/dashboard/activity` | None | PASS |
| `/super-admin` | SuperAdminDashboard | Protected | `GET /api/v1/super-admin/stats` (403 for Tenant Admin) | None | PASS (RBAC Contained) |
| `/super-admin/organizations` | SuperAdminOrganizations | Protected | `GET /api/v1/super-admin/organizations` (403 for Tenant Admin) | None | PASS (RBAC Contained) |
| `/super-admin/finance` | SuperAdminFinance | Protected | `GET /api/v1/super-admin/finance` (403 for Tenant Admin) | None | PASS (RBAC Contained) |
| `/directory` | EmployeeDirectory | Yes | `GET /api/v1/employees` | None | PASS |
| `/directory/:id` | EmployeeProfile | Yes | `GET /api/v1/employees/:id`, `GET /api/v1/employees/:id/progress` | None | PASS |
| `/employee` | EmployeeDashboard | Yes | `GET /api/v1/employees/me`, `GET /api/v1/assignments/me` | None | PASS |
| `/journeys` | JourneysList | Yes | `GET /api/v1/journeys` | None | PASS |
| `/journeys/:id` | JourneyBuilder | Yes | `GET /api/v1/journeys/:id`, `PUT /api/v1/journeys/:id` | None | PASS |
| `/course/:id` | CourseViewer | Yes | `GET /api/v1/courses/:id`, `POST /api/v1/courses/:id/lessons/:lessonId/complete` | None | PASS |
| `/tasks` | Tasks | Yes | `GET /api/v1/tasks`, `POST /api/v1/tasks`, `PATCH /api/v1/tasks/:id` | None | PASS |
| `/milestones` | Milestones | Yes | `GET /api/v1/milestones/plans`, `GET /api/v1/milestones/templates` | None | PASS |
| `/documents` | Documents | Yes | `GET /api/v1/documents/templates`, `GET /api/v1/documents/assignments` | None | PASS |
| `/documents/:id/sign` | DocumentSigner | Yes | `GET /api/v1/documents/assignments/:id`, `POST /api/v1/documents/:id/sign` | None | PASS |
| `/buddy` | BuddyProgram | Yes | `GET /api/v1/buddy/matches`, `GET /api/v1/buddy/profiles` | None | PASS |
| `/calendar` | CalendarIntegration | Yes | `GET /api/v1/calendar/meetings`, `POST /api/v1/calendar/meetings` | None | PASS |
| `/workflows` | Workflows | Yes | `GET /api/v1/workflows/rules`, `GET /api/v1/workflows/logs` | None | PASS |
| `/manager` | ManagerDashboard | Yes | `GET /api/v1/manager/team`, `GET /api/v1/manager/metrics` | None | PASS |
| `/hr-ops` | HROperations | Yes | `GET /api/v1/hr/overview`, `GET /api/v1/hr/risks` | None | PASS |
| `/analytics` | Analytics | Yes | `GET /api/v1/analytics/overview`, `GET /api/v1/analytics/completion-trends` | None | PASS |
| `/leaderboard` | Leaderboard | Yes | `GET /api/v1/gamification/leaderboard`, `GET /api/v1/gamification/me` | None | PASS |
| `/ai-assistant` | AIAssistant | Yes | `POST /api/v1/ai/chat`, `GET /api/v1/ai/history` | None | PASS |
| `/ai-course-builder` | AICourseBuilder | Yes | `POST /api/v1/ai/generate-course` | None | PASS |
| `/settings` | Settings | Yes | `GET /api/v1/organizations/current`, `PUT /api/v1/organizations/current` | None | PASS |
| `/settings/sso` | SSOSettings | Yes | `GET /api/v1/sso/config`, `POST /api/v1/sso/config` | None | PASS |
| `/settings/integrations` | HRISIntegrations | Yes | `GET /api/v1/integrations`, `POST /api/v1/integrations` | None | PASS |
| `/office-map` | OfficeMap | Yes | `GET /api/v1/locations/offices`, `GET /api/v1/locations/desks` | None | PASS |
| `/kiosks` | KioskDashboard | Yes | `GET /api/v1/kiosks`, `GET /api/v1/kiosks/terminals` | None | PASS |
| `/kiosk/play/:id` | KioskPlayerPage | Yes | `GET /api/v1/kiosks/:id/content` | None | PASS |
| `/certificates` | Certificates | Yes | `GET /api/v1/certificates/me` | None | PASS |
| `/public/certificate/:id` | PublicCertificateViewer | Yes (Public) | `GET /api/v1/certificates/public/:id` | None | PASS |
| `/kb` | KnowledgeBase | Yes | `GET /api/v1/kb/articles`, `POST /api/v1/kb/articles` | None | PASS |
| `/kb/slideshow` | KnowledgeBaseSlideshow | Yes | `GET /api/v1/kb/articles` | None | PASS |

---

## Route Summary Statistics

- Total Routes Discovered: 36
- Total Routes Visited: 36
- Passed: 36
- Failed: 0
- Unreachable / Broken: 0
- Access Containment Rate: 100%
