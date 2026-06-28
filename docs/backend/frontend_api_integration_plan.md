# Frontend-Backend API Integration Plan

This document outlines the detailed mapping, alignment, and integration strategy for connecting the Talnova Onboarding React frontend with the Fastify Node.js backend. 

---

## 1. Backend API Endpoint Inventory

The Talnova Backend runs on Fastify, listening at `/api/v1`. It secures all domain routes using JWT cookie-based or bearer-based authentication via the `authenticate` middleware.

| Module | Route / Endpoint | HTTP Method | Auth Required | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `/auth/login` | `POST` | No | Authenticate user, set session cookie |
| | `/auth/logout` | `POST` | Yes | Clear session cookie, invalidate token |
| | `/auth/refresh` | `POST` | No | Refresh expired access tokens |
| | `/auth/me` | `GET` | Yes | Get session summary (JWT payload) |
| **Employees** | `/users/me` or `/employees/me` | `GET` | Yes | Get current user's profile details |
| | `/employees` | `GET` | Yes (Admin/Owner) | List employees with filtering / search |
| | `/employees/:id` | `GET` | Yes | Retrieve single employee profile details |
| | `/employees/invite` | `POST` | Yes (Admin/Owner) | Invite a new employee to the workspace |
| | `/employees/:id` | `PATCH` | Yes (Admin/Owner) | Update employee profile/role |
| | `/employees/:id` | `DELETE` | Yes (Admin/Owner) | Soft-delete an employee |
| **Organizations**| `/organizations/current` | `GET` | Yes | Get current organization settings |
| | `/organizations/current` | `PATCH` | Yes (Owner) | Update workspace details (name, etc.) |
| | `/organizations/branding` | `PATCH` | Yes (Owner/Admin) | Update logo, theme colors, etc. |
| | `/organizations/security` | `PATCH` | Yes (Owner) | Update MFA/session configuration |
| | `/organizations/departments` | `GET`/`POST` | Yes | List/Create organization departments |
| | `/organizations/teams` | `GET`/`POST` | Yes | List/Create organization teams |
| **Journeys** | `/journeys` | `GET` | Yes | List onboarding journeys (Draft/Published) |
| | `/journeys/:id` | `GET` | Yes | Retrieve full journey details |
| | `/journeys` | `POST` | Yes (Admin/Owner) | Create a new onboarding journey |
| | `/journeys/:id` | `PATCH` | Yes (Admin/Owner) | Update journey details/curriculum |
| | `/journeys/:id` | `DELETE` | Yes (Admin/Owner) | Soft-delete a journey |
| | `/journeys/:id/publish` | `POST` | Yes (Admin/Owner) | Publish a journey |
| | `/journeys/:id/archive` | `POST` | Yes (Admin/Owner) | Archive a journey |
| | `/journeys/:id/duplicate`| `POST` | Yes (Admin/Owner) | Duplicate an existing journey |
| | `/journeys/:id/analytics`| `GET` | Yes (Admin/Owner) | Get statistics for a specific journey |
| **Assignments** | `/assignments` | `GET` | Yes | List employee onboarding assignments |
| | `/assignments/assign` | `POST` | Yes (Admin/Owner) | Assign journey to employee |
| | `/assignments/:id` | `GET` | Yes | Retrieve assignment details & progress |
| | `/assignments/:id/start`| `POST` | Yes | Start journey progress |
| | `/assignments/:id/complete-lesson`| `POST` | Yes | Complete content block / lesson |
| | `/assignments/:id/submit-quiz`| `POST` | Yes | Submit a quiz attempt |
| **Knowledge Base**| `/knowledge-base` | `GET` | Yes | List articles with category/search filters |
| | `/knowledge-base/:id` | `GET` | Yes | Fetch full article content |
| | `/knowledge-base` | `POST` | Yes (Admin/Owner) | Create new KB article |
| | `/knowledge-base/:id` | `PATCH`/`DELETE`| Yes (Admin/Owner) | Edit or remove KB articles |
| **Notifications** | `/notifications` | `GET` | Yes | List current user notifications |
| | `/notifications/unread`| `GET` | Yes | List unread notifications |
| | `/notifications/:id/read`| `PATCH` | Yes | Mark a notification as read |
| **Uploads** | `/uploads/presigned` | `POST` | Yes | Get presigned S3/R2 upload URL |

---

## 2. Frontend Services & Query Hook Architecture

The frontend consumes the API layer through service files in `src/services/` wrapped with React Query hooks in `src/hooks/`.

```
src/services/
├── auth.service.ts         -> useCurrentUser
├── dashboard.service.ts    -> useDashboardSummary
├── analytics.service.ts    -> useAnalytics
├── employee.service.ts     -> useEmployees, useEmployee
├── journey.service.ts      -> useJourneys, useJourney
├── course.service.ts       -> useCourse, useUpdateLessonCompletion
├── knowledgeBase.service.ts -> useKbCategories, useKbArticles, useKbArticle
└── settings.service.ts     -> useWorkspaceSettings, useNotifications
```

---

## 3. Integration Alignments & Mappings

### 3.1 Authentication Mappings
The backend user profiles (`IUser`) are structure-rich. We map them to the frontend profile format:

* **Backend User Profile schema (`IUser`):**
  * `profile.firstName` + `profile.lastName` -> Frontend `name`
  * `auth.email` -> Frontend `email`
  * `permissions.role` -> Frontend `role` (`'admin' | 'employee'`)
  * `profile.avatar.publicUrl` -> Frontend `avatar`
  * Organization Name -> Frontend `company`

### 3.2 Workspace & Settings Mappings
The frontend edits general details and branding separately. We split these operations:
* Details: `PATCH /organizations/current` (for name, supportEmail)
* Branding: `PATCH /organizations/branding` (for primaryColor, logo)

### 3.3 Learning Engine Integration (Assignments & Journeys)
The frontend `CourseViewer` reads course curriculums using `/courses/:id` which doesn't exist on the backend.
* **Solution**:
  1. Fetch the assignment by ID (`/assignments/:id`) to check employee progress.
  2. Fetch the corresponding journey content (`/journeys/:journeyId`) to get description, content blocks, and quizzes.
  3. Merge progress and curriculum details on the client-side to output a compliant `Course` object.
* **Lesson Completion**:
  1. Look up the lesson inside the journey modules to find its parent `moduleId` and nested `contentBlocks` IDs.
  2. If the assignment status is `"assigned"`, first transition it by calling `/assignments/:id/start`.
  3. Dispatch the progress completion call `/assignments/:id/complete-lesson` containing `{ moduleId, lessonId, timeSpentSeconds, completedBlockIds }`.

### 3.4 Employees & Directory Mappings
* **Invitation Flow**: When adding a new employee, the UI takes `name` and `department`. The adapter will:
  1. Parse the name into `firstName` and `lastName`.
  2. Lookup existing departments to resolve the `departmentId`. If missing, automatically create the department under `/organizations/departments`.
  3. Send an invitation request to `/employees/invite`.

### 3.5 Knowledge Base Mappings
* **Categories**: Since there is no standalone `Category` table, the frontend `getCategories` will load published articles and dynamically aggregate counts grouped by the predefined category names.

---

## 4. Discovered Integration Gaps & Recommendation

1. **Dashboard & Analytics Endpoints**:
   * The frontend calls `/dashboard/summary` and `/analytics`. These are missing in the backend.
   * *Recommendation*: Compute statistics (total employees, completion rates) on the client side using current employee and assignment data, or implement lightweight mock endpoints on the backend if preferred.

2. **Forgot Password, Reset Password, Acceptance Stubs**:
   * These routes on the backend authentication controller are currently stubbed. They must be connected to service logic once email workflows are introduced.

---

### Next Steps & Feedback
I am ready to implement these service adaptions and data transformers. Let me know if you would like me to:
1. Implement the client-side mappings & course merging logic.
2. Stub or implement mock endpoints for `/dashboard/summary` and `/analytics` in Fastify.
