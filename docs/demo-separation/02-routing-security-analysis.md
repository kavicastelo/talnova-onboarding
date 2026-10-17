# Root-Cause Analysis: Route & Security Failure Investigation

**Document ID:** `TALNOVA-DEMO-RCA-002`  
**Phase:** One (Route & Security Failure Investigation)  
**Status:** Complete  
**Date:** 2026-10-17  
**Author:** Application Security & QA Automation Engineering Team  

---

## 1. Executive Summary

This investigation dissects the root causes behind demo users being improperly redirected to production registration, login, and production-only administrative views. It provides verified reproduction steps, source-code line references, security impact assessments, and concrete architectural remedies.

A strict route behavior matrix is defined to ensure demo error handling remains strictly self-contained within the demo environment under all conditions (401, 403, 404, 500, network loss, and session timeout).

---

## 2. Route Behavior Matrix

| Condition | Observed Flawed Behavior | Required Demo Behavior | Originating Layer |
| :--- | :--- | :--- | :--- |
| **Unknown demo URL** (e.g. `/demo/unknown-route`) | Falls through to root `<AppShell />` which finds no `auth_token` and redirects to `/login` | Render demo-branded 404 page with return to demo dashboard | Frontend Router (`App.tsx`) |
| **Demo API returns 401** (Token expired or revoked) | Axios interceptor attempts production `/auth/refresh`, fails, and executes `window.location.href = '/login'` | Clear demo session and redirect to `/demo/login?reason=expired` | Frontend API Interceptor (`src/api/client.ts`) |
| **Demo API returns 403** (Forbidden / unentitled) | Generic error toast or unhandled rejection, leaving page in broken state | Display demo-specific access-denied state or Guided Sales Upgrade modal | Frontend Interceptor & Guard Components |
| **Demo API returns 404** (Resource not found) | Blank page or unhandled component crash | Render contextual empty state or demo-branded resource 404 with back button | Frontend Component & Error Boundary |
| **Demo API returns 500/503** (Server error or `DEMO_DB_DISCONNECTED`) | Unhandled component crash or console error; user gets stuck | Demo error page with safe recovery options (Retry, Switch Persona, Reset Baseline) | Frontend API Client & Error Boundary |
| **Network failure / Offline** | Silent failure or endless loading spinner | Demo-local banner/modal indicating network disconnect with retry button | Frontend API Client & Network Hook |
| **Demo logout** | Clears demo token, but leaves production session keys untouched | Clear all demo storage keys (`talnova_demo_*`), terminate session on server, navigate to `/demo/login` | Frontend DemoAuthContext (`DemoAuthContext.tsx`) |
| **Direct demo URL refresh** (e.g. F5 on `/demo/journeys/123`) | In production builds without SPA rewrite, returns Nginx/S3 404; if token missing, kicks to `/login` | Authenticate via persisted demo token and restore exact sub-route with state | Frontend Router & SPA Host Configuration |
| **Production route requested from demo** (e.g. `/super-admin`, `/settings/sso`) | Escapes `/demo` boundary and exposes production login or restricted page | Deny access or display demo-local "Feature Unavailable in Demo" page | Route Guards & Navigation Wrapper |

---

## 3. Detailed Root-Cause Analyses

### Issue 1: Demo 401 Interceptor Forces Production Login Redirect

- **Reproduction Steps:**
  1. Log into `/demo/login` as Sarah Connor.
  2. In Developer Tools Application tab, tamper with or invalidate `talnova_demo_token`.
  3. Navigate to `/demo/journeys`.
  4. The request to `/api/v1/demo/journeys` returns HTTP 401 Unauthorized.
  5. The browser abruptly redirects to `http://localhost:5173/login`.
- **Affected Source Files:**
  - `src/api/client.ts` (Lines 177–217)
- **Root Cause Analysis:**
  In `src/api/client.ts`, the response interceptor catches 401 errors. It exempts specific public routes (`/login`, `/register`, `/forgot-password`, `/kb/`, `/public/certificate/`, `/kiosk/`), but does **not** exempt `/demo` routes.
  Because `window.location.pathname.startsWith('/demo')` is not checked:
  1. The interceptor attempts a token refresh at `POST ${API_BASE_URL}/auth/refresh`.
  2. The production refresh fails because the demo user has no production refresh cookie.
  3. The `catch (refreshError)` block executes line 215:
     ```typescript
     window.location.href = '/login';
     ```
- **Security Impact:**
  Prospects and sales engineering staff are ejected from the demo session and shown the production login form, exposing production URLs, SSO discovery, and enterprise registration links.
- **Proposed Fix:**
  Add a dedicated demo check in `src/api/client.ts`:
  ```typescript
  const isDemoRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo');
  if (isDemoRoute) {
    localStorage.removeItem('talnova_demo_token');
    localStorage.removeItem('talnova_demo_user');
    localStorage.removeItem('talnova_demo_tenant');
    localStorage.removeItem('talnova_demo_watermark');
    window.location.href = '/demo/login?reason=session_expired';
    return Promise.reject(error);
  }
  ```
- **Regression Test:**
  Simulate 401 response while on `/demo/tasks`; assert window location transitions to `/demo/login?reason=session_expired` and production keys are unharmed.

---

### Issue 2: Missing Demo Catch-All Route Falls Through to Production AppShell

- **Reproduction Steps:**
  1. Navigate to an unknown demo path such as `http://localhost:5173/demo/non-existent-page`.
  2. Observe that the user is immediately redirected to `http://localhost:5173/login`.
- **Affected Source Files:**
  - `src/App.tsx` (Lines 125–153, 155–221)
  - `src/components/AppShell.tsx` (Lines 601–607)
- **Root Cause Analysis:**
  In `src/App.tsx`:
  ```tsx
  <Route path="/demo" element={<DemoAuthProvider><DemoProtectedRoute><DemoAppShell /></DemoProtectedRoute></DemoAuthProvider>}>
    <Route index element={<DemoDashboardRedirect />} />
    <Route path="admin" element={<AdminDashboard />} />
    ...
  </Route>
  ```
  There is no `<Route path="*" element={<DemoNotFound />} />` defined inside the `/demo` tree.
  When an unmatched path like `/demo/non-existent-page` is requested, React Router skips the `/demo` branch and matches the root route:
  ```tsx
  <Route path="/" element={<SidebarProvider><AppShell /></SidebarProvider>}>
  ```
  `AppShell` mounts, executes its authentication check `useEffect` (lines 603–606):
  ```typescript
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (!token && typeof window !== 'undefined') {
    navigate('/login');
  }
  ```
  Since the demo user only possesses `talnova_demo_token` and not `auth_token`, `AppShell` immediately redirects them to `/login`.
- **Security Impact:**
  Any typo or stale demo URL immediately leaks the production login route and interrupts user evaluation.
- **Proposed Fix:**
  Add a nested demo 404 route inside the `/demo` route declaration in `src/App.tsx`:
  ```tsx
  <Route path="*" element={<DemoNotFound />} />
  ```
- **Regression Test:**
  Render route `/demo/invalid-path-12345`; assert that `DemoNotFound` renders with demo branding and no navigation to `/login` occurs.

---

### Issue 3: Hardcoded Root Navigation Inside Reused Production Components

- **Reproduction Steps:**
  1. Navigate to `/demo/journeys/new` (or edit an existing journey).
  2. Click the "Cancel" or "Save & Close" button.
  3. Observe that the URL switches to `http://localhost:5173/journeys` (outside `/demo`).
  4. The page unmounts `DemoAppShell` and mounts production `AppShell`, which redirects to `/login`.
- **Affected Source Files:**
  - `src/pages/JourneyBuilder.tsx` (Lines 589, 592, 641, 1933: `navigate('/journeys')`)
  - `src/pages/DocumentSigner.tsx` (Lines 48, 83: `navigate('/documents')`, Line 69: `navigate('/employee')`)
  - `src/pages/CourseViewer.tsx` (Lines 148, 932: `navigate('/employee')`)
  - `src/pages/EmployeeProfile.tsx` (Line 800: `navigate('/employee')`)
  - `src/pages/Settings.tsx` (Lines 992, 1014: `navigate('/settings/sso')`, `navigate('/settings/integrations')`)
  - `src/components/ProtectedRoute.tsx` (Lines 49–51: `navigate('/')`)
- **Root Cause Analysis:**
  Production components were developed with absolute application routes assuming a single root application context. When reused inside `/demo`, calls to `navigate('/journeys')` navigate to root `/journeys` instead of the contextual path.
- **Security Impact:**
  Normal user interaction with forms, journey builders, or profile pages dumps demo prospects out of the demo environment.
- **Proposed Fix:**
  Introduce a context-aware navigation helper (`useAppNavigate`) or wrap navigation calls inside demo layouts so that when `isDemoMode` is active, root paths are automatically prepended with `/demo`:
  ```typescript
  export function useSmartNavigate() {
    const navigate = useNavigate();
    const isDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo');
    return (to: string | number, options?: any) => {
      if (typeof to === 'string' && isDemo && to.startsWith('/') && !to.startsWith('/demo')) {
        return navigate(`/demo${to}`, options);
      }
      return navigate(to as any, options);
    };
  }
  ```
- **Regression Test:**
  Mount `JourneyBuilder` under demo context; trigger back/cancel; assert target URL is `/demo/journeys`.

---

### Issue 4: Shared LocalStorage Keys Overwrite Production Identity

- **Reproduction Steps:**
  1. Sign into the production application as a platform administrator (`user_role = 'admin'`).
  2. In another tab on the same browser origin, log into `/demo/login` as Bob Vance (`Employee`).
  3. Return to the production tab and refresh.
  4. The production tab now reads `user_role = 'employee'`, degrading permissions or breaking UI state.
- **Affected Source Files:**
  - `demo/src/context/DemoAuthContext.tsx` (Lines 103–104)
- **Root Cause Analysis:**
  In `DemoAuthContext.tsx`:
  ```typescript
  localStorage.setItem('user_role', normalizedRole);
  localStorage.setItem('user_roles', JSON.stringify([normalizedRole]));
  ```
  `DemoAuthContext` writes to the exact same storage keys that `auth.service.ts` uses for production RBAC.
- **Security Impact:**
  Cross-environment session poisoning, confusing admin workflows, and potential false reporting of session state.
- **Proposed Fix:**
  Isolate demo role storage entirely under demo prefixes: `talnova_demo_role` and `talnova_demo_roles`. Ensure `RoleContext` inspects the active route to source the appropriate role tokens without mutual contamination.
- **Regression Test:**
  Set `auth_token` and `user_role = 'admin'`; execute demo login; assert `user_role` remains `'admin'` while `talnova_demo_role` is `'employee'`.

---

## 4. Risk & Dependency Analysis

| Risk | Likelihood | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| Interceptor regression breaks production token refresh | Medium | Critical | Add rigorous unit test verifying that non-demo routes still call `/auth/refresh` and execute production 401 handling. |
| Production components break due to navigation wrapper changes | Low | High | Ensure navigation helper defaults strictly to standard `useNavigate` behavior unless `window.location.pathname.startsWith('/demo')`. |
| Cross-origin deployment CORS rejection | Medium | High | Update `CORS_ALLOWED_ORIGINS` in backend config and deployment manifests to explicitly include the demo domain/subdomain. |
