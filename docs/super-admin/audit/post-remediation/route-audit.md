# Client Route Security & Guard Traceability Audit

> **Document Status:** Authoritative Route Security Audit  
> **Target:** `src/App.tsx` & `src/components/ProtectedRoute.tsx`  
> **Standard:** Complete Route Protection, Guard Interception, and Friendly Degradation  
> **Date:** September 2026  

---

## 1. Executive Summary

A secure multi-tenant SaaS frontend must guard application routes against unauthorized URL access. While hiding navigation elements provides good UX, users who bookmark URLs or enter direct paths must be intercepted before the route component mounts.

Forensic audit of `src/App.tsx` reveals that **only 5 of 37 routes declare a `featureFlag` attribute**. 32 routes are completely unguarded against disabled feature flags.

---

## 2. Route Protection Inventory (`App.tsx`)

| Route Path | Component Mounted | Declared Capability | Declared Feature Flag | Effective Guard Status |
| :--- | :--- | :--- | :--- | :---: |
| `/` | `DashboardRedirect` | None | None | Public / Session |
| `/super-admin/*` | `SuperAdmin*` | `view_super_admin` | None | RBAC Guarded |
| `/journeys` | `JourneysList` | None | None | **UNGUARDED** |
| `/journeys/:id` | `JourneyBuilder` | None | None | **UNGUARDED** |
| `/kiosks` | `KioskDashboard` | `manage_organization` | `kiosk_mode` | **FULLY GUARDED** |
| `/directory` | `EmployeeDirectory` | None | None | **UNGUARDED** |
| `/directory/:id` | `EmployeeProfile` | None | None | **UNGUARDED** |
| `/profile` | `EmployeeProfile` | None | None | **UNGUARDED** |
| `/employee` | `EmployeeDashboard` | None | None | **UNGUARDED** |
| `/kb` | `KnowledgeBase` | None | None | **UNGUARDED** |
| `/analytics` | `Analytics` | `view_analytics` | None | RBAC Guarded |
| `/settings` | `Settings` | None | None | **UNGUARDED** |
| `/certificates` | `Certificates` | None | None | **UNGUARDED** |
| `/tasks` | `Tasks` | None | None | **UNGUARDED** |
| `/tasks/it-ops` | `Tasks` (IT) | `manage_it_ops` | None | RBAC Guarded |
| `/workflows` | `Workflows` | `manage_workflows` | None | RBAC Guarded |
| `/manager` | `ManagerDashboard` | `view_team_ops` | None | RBAC Guarded |
| `/documents` | `Documents` | None | None | **UNGUARDED** |
| `/documents/:id/sign` | `DocumentSigner` | None | None | **UNGUARDED** |
| `/milestones` | `Milestones` | None | None | **UNGUARDED** |
| `/buddy` | `BuddyProgram` | None | None | **UNGUARDED** |
| `/calendar` | `CalendarIntegration` | None | None | **UNGUARDED** |
| `/hr-ops` | `HROperations` | `view_hr_ops` | None | RBAC Guarded |
| `/hr-ops/exceptions` | `HROpsExceptions` | `view_hr_ops` | None | RBAC Guarded |
| `/leaderboard` | `Leaderboard` | None | `gamification_badges`* | **KEY MISMATCH FAIL** |
| `/ai-assistant` | `AIAssistant` | None | None | **UNGUARDED** |
| `/ai-course-builder` | `AICourseBuilder` | `ai_course_builder` | `ai_course_builder` | **FULLY GUARDED** |
| `/settings/sso` | `SSOSettings` | `manage_sso` | `sso_enforcement` | **FULLY GUARDED** |
| `/settings/integrations`| `HRISIntegrations` | `manage_integrations`| `advanced_hris_sync` | **FULLY GUARDED** |
| `/office-map` | `OfficeMap` | None | None | **UNGUARDED** |

*\*Note on `/leaderboard`:* The route specifies `featureFlag="gamification_badges"`. The backend seeds `gamified_milestones`. When `hasFeature("gamification_badges")` evaluates, it finds no matching flag in the dictionary and falls back to `true`, allowing full access.

---

## 3. Evaluation of `ProtectedRoute.tsx`

`src/components/ProtectedRoute.tsx` contains two evaluation blocks:
1. **RBAC Check:** If `capability && !can(capability)`, renders an "Access Restricted" view.
2. **Feature Flag Check:**
   ```typescript
   if (featureFlag && !hasFeature(featureFlag)) {
     return (
       <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
         <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mb-4">
           <Sliders className="h-8 w-8" />
         </div>
         <h2 className="text-2xl font-bold tracking-tight text-foreground">Feature Temporarily Unavailable</h2>
         <p className="mt-2 max-w-md text-muted-foreground">
           The feature <code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs">{featureFlag}</code> is currently disabled by platform administration for your organization.
         </p>
         <div className="mt-6 flex gap-3">
           <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
           <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
         </div>
       </div>
     );
   }
   ```

### Findings on Route Interception UX
* The amber "Feature Temporarily Unavailable" screen is friendly, non-technical, and adheres to UX best practices.
* **Flaw:** It leaks the internal feature flag key string (`<code className="...">{featureFlag}</code>`).
* **Recommendation:** Replace raw key string with human-readable feature name looked up from a feature catalog.
