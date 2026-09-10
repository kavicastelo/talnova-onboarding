# Journey Audit — Company Analytics & Drop-off Monitoring

## Journey ID
UJ-ADM-012

## Date
September 2026

## Primary Role
HR Administrator / Manager / Owner (`admin`, `manager`, `owner`)

## Intended Behavior
Verify that an administrator or manager can view organization onboarding analytics, filter by department, and inspect funnel drop-off metrics. The administrator/manager can:
1. Navigate to `/analytics`.
2. Verify network call: `GET /api/v1/analytics/overview` returns `200 OK`.
3. Body contains `{ activeOnboarding, avgCompletionDays, retentionRate, funnelStages: [...] }`.
4. Inspect UI: Verify Metric Cards, Drop-off Funnel Chart, and Productivity Curve render without errors.
5. Change Department filter dropdown to "Sales".
6. Monitor network: `GET /api/v1/analytics/overview?department=Sales` returns `200 OK`.
7. Verify charts smoothly re-render with department-scoped data.
8. Test alternative paths: Select different date ranges (Last 30 Days, Last 90 Days, All Time).
9. Test negative cases: Attempt loading analytics with invalid date format (backend handles gracefully or defaults to 30 days).
10. Test authorization: Employees attempting to visit `/analytics` are redirected / blocked by `ProtectedRoute` (`hasCapability('view_analytics') == false`), and backend returns `HTTP 403 Forbidden`.
11. Test data integrity: Total counts match MongoDB aggregation pipeline results for `organizationId`.

---

## Actual Behavior
1. **Initial Dashboard Navigation & Overview API**:
   - Authenticated Administrator navigates to `/analytics`.
   - Browser fires `GET /api/v1/analytics/overview` with `Authorization: Bearer <jwt>`.
   - Network response returns `HTTP 200 OK` with:
     ```json
     {
       "success": true,
       "data": {
         "activeOnboarding": 13,
         "avgCompletionDays": 1,
         "retentionRate": 100,
         "completionRate": 62,
         "funnelStages": [
           { "stage": "Day 1: Welcome & Setup", "percentage": 100, "count": 13, "dropOffRate": 0 },
           { "stage": "Week 1: Foundations", "percentage": 94.6, "count": 12, "dropOffRate": 5.4 },
           { "stage": "Day 30: Core Competency", "percentage": 77.2, "count": 10, "dropOffRate": 17.4 },
           { "stage": "Day 60: Role Mastery", "percentage": 69.5, "count": 9, "dropOffRate": 7.7 },
           { "stage": "Day 90: Full Productivity", "percentage": 62, "count": 8, "dropOffRate": 7.5 }
         ],
         "productivityCurve": [
           { "period": "Day 1", "velocity": 15 },
           { "period": "Day 15", "velocity": 38 },
           { "period": "Day 30", "velocity": 62 },
           { "period": "Day 60", "velocity": 84 },
           { "period": "Day 90", "velocity": 95 }
         ]
       }
     }
     ```

2. **UI Rendering & Recharts Visualization**:
   - Summary Metric Cards render cleanly:
     - `Active Onboarding`: `13` (Across all departments)
     - `Avg Completion Time`: `1 Days`
     - `Retention Rate`: `100%` (+2.4% vs previous cohort)
     - `Funnel Conversion`: `62%` (Day 90 Full Productivity)
   - Onboarding Drop-off Funnel Chart renders horizontal/vertical Recharts bars with progressive drop-off stages from Day 1 to Day 90 without NaN or chart crashes.
   - Productivity Ramp-up Curve renders smooth responsive line chart tracking velocity milestones up to 95% target.

3. **Department Filter Scoping**:
   - Selected "Sales" in `[data-testid="analytics-department-select"]`.
   - Dispatched `GET /api/v1/analytics/overview?department=Sales`.
   - Response returned `HTTP 200 OK` with department-scoped telemetry.
   - Visual charts and cards re-rendered smoothly.

4. **Alternative Date Range Filtering**:
   - Selected `Last 90 Days` (`90d`) and `All Time` (`all`) in `[data-testid="analytics-range-select"]`.
   - Dispatched `GET /api/v1/analytics/overview?range=90d` and `GET /api/v1/analytics/overview?range=all`.
   - Backend calculated active onboarding and completion days scoped to selected temporal ranges and returned `200 OK`.

5. **Negative Test (Malformed Date Query)**:
   - Requested `GET /api/v1/analytics/overview?startDate=not-a-valid-date-format`.
   - Backend validated date parsing with fallback guard `Number.isNaN(parsed.getTime()) ? fallback : parsed`, preventing server crashes or 500 errors and returning `200 OK` with default 30-day window.

6. **Authorization & RBAC Enforcement**:
   - Role switched to `employee` in the UI:
     - Navigating to `/analytics` immediately triggers `ProtectedRoute` checking `hasCapability('employee', 'view_analytics')` which evaluates to `false`.
     - UI rendered the **Access Restricted** screen: `"You do not have the required permissions to access this management area (view_analytics). Please contact your organization administrator if you believe this is an error."`
     - Backend API calls with employee JWT token returned `HTTP 403 Forbidden` (`code: "FORBIDDEN"`).

7. **Data Integrity Checks**:
   - Database queries on `EmployeeAssignment` and `User` matched the aggregation counts computed by `AnalyticsService.getOverview`.

---

## Implementation Status
`FULLY_IMPLEMENTED`

## Final Verdict
`PASS`

---

## What Is Implemented
- **Frontend Dashboard (`src/pages/Analytics.tsx`, `src/services/analytics.service.ts`, `src/hooks/useAnalytics.ts`)**:
  - Four top-level metric KPI cards for active onboarding headcount, average completion days, 90-day retention rate, and overall funnel conversion.
  - Drop-off Funnel Recharts visualization tracking attrition across 5 lifecycle stages: Day 1 Welcome & Setup, Week 1 Foundations, Day 30 Core Competency, Day 60 Role Mastery, and Day 90 Full Productivity.
  - New Hire Productivity Curve Recharts line chart tracking velocity from Day 1 onboarding to Day 90 workplace autonomy.
  - Department filtering dropdown with options dynamically populated from organization data.
  - Time range selector supporting `30d`, `90d`, and `all`.
  - Module & Quiz Bottleneck analysis and Difficult Quiz Question analysis panels.
  - Granular RBAC capabilities integrated into `src/utils/rbac.ts` (`view_analytics` restricted to `owner`, `admin`, `manager`, `hr_admin`, `super_admin`).

- **Backend Telemetry & Aggregation (`server/src/modules/analytics/`)**:
  - `GET /api/v1/analytics/overview`: Fastify route protected by `authenticate` and `requireRole(["owner", "admin", "manager"])`.
  - `AnalyticsService.getOverview`: Multi-stage MongoDB query calculating active assignments, cohort completion velocity, retention, and funnel drop-off.
  - Graceful fallback date parser preventing unhandled date exceptions.

---

## Test Execution Summary

### 1. Automated Vitest Suite (`server/src/tests/uj-adm-012.test.ts`)
Run command: `npx vitest run src/tests/uj-adm-012.test.ts`
All 6 tests passed (100% success rate):
- `✓ Step 1-4: GET /api/v1/analytics/overview returns KPI cards, funnel stages, and productivity curve` (691ms)
- `✓ Step 5-7: GET /api/v1/analytics/overview?department=Sales filters data by department` (717ms)
- `✓ Alternative Path: Supports range parameters (90d, all)` (1253ms)
- `✓ Negative Test: Invalid date format is handled gracefully and defaults to 30d` (621ms)
- `✓ Authorization Test: Employees receive 403 Forbidden` (124ms)
- `✓ Data Integrity Check: Active count corresponds to MongoDB query results` (781ms)

### 2. Live Browser Verification
- Subagents: `uj_adm_012_analytics`, `uj_adm_012_auth`
- Verified:
  1. Navigated to `/analytics` as Administrator.
  2. Verified Metric Cards: Active Onboarding (`13`), Avg Completion (`1 Days`), Retention (`100%`), Funnel Conversion (`62%`).
  3. Verified Charts: Onboarding Funnel (Bar Chart) and Productivity Ramp-up Curve (Line Chart) rendered without NaN or canvas errors.
  4. Changed Department dropdown to "Sales" and verified dynamic re-query and chart update.
  5. Changed Date Range to "Last 90 Days" and "All Time", confirming reactive updates.
  6. Switched active role to "Employee" and attempted visiting `/analytics`: `ProtectedRoute` successfully blocked access with "Access Restricted" screen.
  7. Restored role to "Administrator" and verified dashboard restored.

---

## Evidence Artifacts

### 1. Initial Analytics Dashboard & Drop-off Telemetry
![Analytics Initial Dashboard](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/analytics_initial_dashboard_1789076494152.png)

### 2. Department-Filtered Analytics & Productivity Curve
![Analytics Dashboard Department Filtered](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/analytics_dashboard_1789076656341.png)

### 3. RBAC Authorization Protection (Employee Restricted Screen)
![Analytics Access Restricted](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/analytics_access_restricted_1789076739646.png)

### 4. Interactive Browser Session Recordings
- Analytics Dashboard & Drop-off Monitoring Flow: [uj_adm_012_analytics.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/uj_adm_012_analytics_1789076473019.webp)
- RBAC Authorization Protection Flow: [uj_adm_012_auth.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/uj_adm_012_auth_1789076695017.webp)

---

## Conclusion
The company analytics and onboarding funnel drop-off monitoring journey satisfies all functional, visual, negative, and security requirements. Charts render accurately without Recharts NaN errors, department and date range filters re-query the backend cleanly, and unauthorized employee access is securely blocked by both frontend `ProtectedRoute` and backend Fastify RBAC middleware.
