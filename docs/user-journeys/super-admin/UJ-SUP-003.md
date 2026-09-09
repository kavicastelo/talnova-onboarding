# Cross-Tenant Financials & Subscription Billing Monitoring

## Journey ID
UJ-SUP-003

## Primary Role
SuperAdmin (`super_admin`)

## Business Goal
Track global platform revenue, Annual Recurring Revenue (ARR), Monthly Recurring Revenue (MRR), subscription tier distribution, churn rate, and invoice payment statuses across all customer workspaces.

## Preconditions
Authenticated with `super_admin` credentials.

## Trigger
SuperAdmin navigates to `/super-admin/finance`.

## Expected Outcome
1. Renders financial analytics: Total MRR, ARR Run Rate, Net Revenue Retention (NRR), and Overdue Invoices.
2. Breakdown charts illustrate revenue by subscription tier (Starter, Pro, Enterprise) and customer expansion trends.
3. Allows auditing billing anomalies or payment failures.

## Journey Steps
1. Navigate to `/super-admin/finance` (`src/pages/SuperAdminFinance.tsx`).
2. Frontend requests `GET /api/v1/super-admin/finance`.
3. Backend aggregates subscription tiers, active billing status, and monthly seat totals across all organizations.
4. UI renders revenue overview metrics, MRR growth line chart, and breakdown by plan.
5. SuperAdmin reviews financial trends and exports financial summary if needed.

## Alternative Paths
- Filter by billing currency or billing interval (monthly vs annual).

## Validation Rules
- Access restricted exclusively to root `super_admin`.

## Permissions
`requireRole(["super_admin"])`.

## APIs / Backend Dependencies
- `GET /api/v1/super-admin/finance` (`server/src/modules/super-admin/routes/super-admin.routes.ts`)

## Data Dependencies
- Multi-tenant aggregation over `Organization.subscription`.

## Notifications / Integrations
None.

## Failure Scenarios
- Unauthorized role access: HTTP 403.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/SuperAdminFinance.tsx`
- `server/src/modules/super-admin/controllers/super-admin.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/auth.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-SUP-003.md`
