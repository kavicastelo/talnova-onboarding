# Multi-Tenant Workspace Provisioning & Health Oversight

## Journey ID
UJ-SUP-001

## Primary Role
SuperAdmin / Platform Operator (`super_admin`)

## Business Goal
Oversee platform-wide multi-tenant operations, provision new enterprise customer workspaces, monitor global database and API health, and review cross-tenant security audit logs.

## Preconditions
User is authenticated with root `role: "super_admin"`.

## Trigger
SuperAdmin navigates to `/super-admin`.

## Expected Outcome
1. Global operations dashboard loads platform metrics: Total Tenants, Active Users, Monthly Recurring Revenue, System Error Rate, and Service Latency.
2. SuperAdmin can click "Provision Tenant Workspace" to spin up a new isolated organization.
3. System provisions tenant with isolated ID, assigns initial subscription plan, and seeds default onboarding templates.

## Journey Steps
1. Navigate to `/super-admin` (`src/pages/SuperAdminDashboard.tsx`).
2. Frontend requests `GET /api/v1/super-admin/stats`.
3. Backend verifies `requireRole(["super_admin"])`, queries across tenant boundaries, returns aggregate statistics.
4. SuperAdmin clicks "Create Tenant".
5. Enters Organization Name: "Acme Global", Domain: "acme.com", Admin Email: "owner@acme.com", Tier: "Enterprise".
6. Frontend dispatches `POST /api/v1/super-admin/organizations`.
7. Backend creates `Organization`, creates initial Owner `User`, seeds default journeys.
8. UI updates tenant list with new active tenant.

## Alternative Paths
- SuperAdmin toggles tenant operational status (e.g. suspend tenant for non-payment).

## Validation Rules
- Only users with `role == "super_admin"` in their verified JWT can access these endpoints.
- Organization domain must be unique.

## Permissions
`requireRole(["super_admin"])` (Root platform bypass).

## APIs / Backend Dependencies
- `GET /api/v1/super-admin/stats`
- `POST /api/v1/super-admin/organizations` (`server/src/modules/super-admin/routes/super-admin.routes.ts`)

## Data Dependencies
- Global access across `organizations` and `users` collections.

## Notifications / Integrations
- System audit log: `TENANT_PROVISIONED`.

## Failure Scenarios
- Non-superadmin access attempt: Immediate HTTP 403 Forbidden.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/SuperAdminDashboard.tsx`
- `server/src/modules/super-admin/controllers/super-admin.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/auth.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-SUP-001.md`
