# Manage Organization Tenants & Subscriptions

## Journey ID
UJ-SUP-002

## Primary Role
SuperAdmin (`super_admin`)

## Business Goal
Inspect and administer customer organization tenants, modify subscription plans (Starter, Professional, Enterprise), adjust user seat quotas, update billing contacts, and manage workspace lifecycle states.

## Preconditions
Authenticated with `super_admin` credentials.

## Trigger
SuperAdmin navigates to `/super-admin/organizations`.

## Expected Outcome
1. Displays comprehensive table of all customer organizations with subscription tiers, user count, creation date, and status.
2. SuperAdmin can edit tenant settings, upgrade seat licenses, or change subscription tier.
3. Backend updates tenant record without cross-tenant leakage.

## Journey Steps
1. Navigate to `/super-admin/organizations` (`src/pages/SuperAdminOrganizations.tsx`).
2. Frontend calls `GET /api/v1/super-admin/organizations`.
3. Table lists all customer tenants.
4. SuperAdmin clicks "Edit" on a tenant row.
5. Updates Plan from `Professional` to `Enterprise`, and increases seat quota from 50 to 250.
6. Clicks "Update Tenant".
7. Client dispatches `PATCH /api/v1/super-admin/organizations/:id`.
8. Backend updates `Organization.subscription` and `Organization.limits`.
9. Table row refreshes with new Enterprise badge.

## Alternative Paths
- SuperAdmin suspends or archives a churned customer tenant.

## Validation Rules
- Tenant ID must exist; valid subscription tier enum.

## Permissions
`requireRole(["super_admin"])`.

## APIs / Backend Dependencies
- `GET /api/v1/super-admin/organizations`
- `PATCH /api/v1/super-admin/organizations/:id` (`server/src/modules/super-admin/routes/super-admin.routes.ts`)

## Data Dependencies
- `Organization` in `organizations` collection.

## Notifications / Integrations
None.

## Failure Scenarios
- Invalid plan tier: HTTP 400.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/SuperAdminOrganizations.tsx`
- `server/src/modules/super-admin/controllers/super-admin.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/auth.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-SUP-002.md`
