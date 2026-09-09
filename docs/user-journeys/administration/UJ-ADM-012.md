# Company Analytics & Drop-off Monitoring

## Journey ID
UJ-ADM-012

## Primary Role
HR Administrator / Manager / Owner (`admin`, `manager`, `owner`)

## Business Goal
Visualize aggregate onboarding performance, completion velocity, drop-off rates by journey step, quiz score distributions, and department-level time-to-productivity metrics.

## Preconditions
Authenticated with `view_analytics` capability.

## Trigger
User navigates to `/analytics`.

## Expected Outcome
1. Renders executive summary cards: Total Active Onboardees, Average Completion Days, 30-Day Retention Rate, and Overall Compliance Rate.
2. Interactive charts display:
   - Onboarding Funnel & Drop-off stage analysis
   - Time-to-Productivity curves by department
   - Quiz score histograms
3. Filter controls allow slicing by Date Range, Department, and Journey Template.

## Journey Steps
1. Navigate to `/analytics` (`src/pages/Analytics.tsx`).
2. Frontend dispatches `GET /api/v1/analytics/overview`.
3. Backend aggregates data across `users`, `assignments`, and `tasks` collections using MongoDB aggregation pipelines.
4. UI renders interactive Recharts charts (Funnel, Bar, Line).
5. User selects Department: "Engineering" from dropdown filter.
6. Client updates query with `?department=Engineering`.
7. Charts smoothly re-render with scoped metrics.

## Alternative Paths
- Managers viewing `/analytics` see department-scoped data (`department == req.user.department`).

## Validation Rules
- Tenant isolation strictly enforced on aggregation pipelines (`$match: { organizationId }`).

## Permissions
`requireRole(["owner", "admin", "manager"])`.

## APIs / Backend Dependencies
- `GET /api/v1/analytics/overview` (`server/src/modules/analytics/routes/analytics.routes.ts`)
- `GET /api/v1/analytics/drop-off`
- `GET /api/v1/analytics/time-to-productivity`

## Data Dependencies
- Aggregations over `User`, `Assignment`, `Task`, `DocumentSignature`.

## Notifications / Integrations
None.

## Failure Scenarios
- Aggregation timeout on massive tenant datasets: Handled with indexed queries.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/Analytics.tsx`
- `server/src/modules/analytics/controllers/analytics.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase8-analytics.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ADM-012.md`
