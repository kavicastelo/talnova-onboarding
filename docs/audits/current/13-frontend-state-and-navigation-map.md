# 13 — Frontend State and Navigation Map

> **Document Purpose:** Analysis of Frontend State Ownership, React Contexts, Cache/Query Layers, Navigation Routing, and State Duplication Risks.

---

## 1. Frontend State Architecture

The application uses a hybrid state architecture:

1. **React Context Layer (`src/context/`):**
   - [`RoleContext.tsx`](file:///d:/talnova/talnova-onboarding/src/context/RoleContext.tsx) — Manages active user role (`admin` | `manager` | `employee` | `super_admin`) and permission capability checks (`hasCapability`).
   - [`LocalizationProvider.tsx`](file:///d:/talnova/talnova-onboarding/src/context/LocalizationProvider.tsx) — Manages active language (`en` | `si` | `ta`) and i18n translation context.
   - [`SidebarContext.tsx`](file:///d:/talnova/talnova-onboarding/src/components/Sidebar.tsx) — Controls sidebar open/collapsed state.

2. **Custom Hook Data Fetching Layer (`src/hooks/`):**
   - [`useAuth.ts`](file:///d:/talnova/talnova-onboarding/src/hooks/useAuth.ts) — Authenticated user state, login, logout, profile refetching.
   - [`useEmployees.ts`](file:///d:/talnova/talnova-onboarding/src/hooks/useEmployees.ts) — Employee list pagination, profile details, invite mutation.
   - [`useJourneys.ts`](file:///d:/talnova/talnova-onboarding/src/hooks/useJourneys.ts) — Journeys query, assignment mutation, target rule preview.
   - [`useWorkflows.ts`](file:///d:/talnova/talnova-onboarding/src/hooks/useWorkflows.ts) — Workflow rules query, logs query, toggle/create/test-run mutations.
   - [`useTasks.ts`](file:///d:/talnova/talnova-onboarding/src/hooks/useTasks.ts) — Task list query, status toggle mutation.
   - [`useDocuments.ts`](file:///d:/talnova/talnova-onboarding/src/hooks/useDocuments.ts) — Document templates, user document assignments, sign mutation.

3. **API Client & Auth Token Storage (`src/api/client.ts`):**
   - Axios instance with base URL `/api/v1`.
   - Attaches `Bearer <token>` from `localStorage.getItem('token')`.
   - Intercepts 401 Unauthorized errors to clear token and redirect to `/login`.

---

## 2. Navigation & Route Hierarchy

Declared in [`App.tsx`](file:///d:/talnova/talnova-onboarding/src/App.tsx):

```
/login (Public)
/register (Public)
/forgot-password (Public)
/public/certificate/:id (Public)
/kb/slideshow (Public)
/course/:id (Standalone Fullscreen LMS Viewer)
/kiosk/play/:id (Standalone Fullscreen Kiosk Player)

/ (Authenticated AppShell with Sidebar Navigation)
├── Index (Redirects based on RoleContext role)
├── /employee (Employee Dashboard)
├── /journeys (Journeys Catalog & Management)
├── /journeys/:id (Journey Builder)
├── /directory (Employee Directory)
├── /directory/:id (Employee Profile)
├── /tasks (Tasks & Checklists)
├── /documents (Digital Documents & E-Signatures)
├── /documents/:id/sign (Document Signer View)
├── /workflows (Workflow Engine Rules & Logs)
├── /manager (Manager Dashboard)
├── /milestones (30/60/90-Day Milestones)
├── /buddy (Buddy Program & Pairing)
├── /calendar (Calendar & Onboarding Meetings)
├── /hr-ops (HR Operations & Handover Queue)
├── /analytics (Reporting & Analytics)
├── /settings (Workspace Settings)
└── /settings/sso (Enterprise SSO Settings)
```

---

## 3. Identification of State Ownership & Duplication Risks

1. **Role Context vs User Model Role:**
   `RoleContext` maintains a separate `role` state variable that can be manually toggled in the UI for testing roles, which may desynchronize from the actual server-side `user.permissions.role`.

2. **Isolated Task & Document Local States:**
   `Tasks.tsx` and `Documents.tsx` manage local completion states upon mutation success. Because overall journey completion is calculated strictly on the backend from `IEmployeeAssignment.modules`, UI task/document completion does not automatically re-evaluate or update the journey progress state rendered in `EmployeeDashboard.tsx`.
