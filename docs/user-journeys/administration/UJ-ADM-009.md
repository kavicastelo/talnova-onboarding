# Organization Branding & Department Settings

## Journey ID
UJ-ADM-009

## Primary Role
Organization Owner / HR Administrator (`owner`, `admin`)

## Business Goal
Customize workspace branding (logo, primary theme colors, company name), manage department taxonomies, and configure tenant operational parameters.

## Preconditions
Authenticated with `manage_organization` capability.

## Trigger
User navigates to `/settings`.

## Expected Outcome
1. Displays General, Branding, Departments, and Security configuration tabs.
2. User updates logo URL, primary color hex, or adds a new department.
3. Changes persist immediately and update workspace UI theme tokens.

## Journey Steps
1. Navigate to `/settings` (`src/pages/Settings.tsx`).
2. Select "Branding" tab.
3. Update primary brand color to `#2563eb` and upload company logo.
4. Click "Save Branding Changes".
5. Client sends `PATCH /api/v1/organizations/branding`.
6. Select "Departments" tab.
7. Click "Add Department", enter Name: "Product Design", Code: "DES".
8. Client sends `POST /api/v1/organizations/departments`.
9. Backend updates tenant record in MongoDB.

## Alternative Paths
- Admin deletes an empty department (`DELETE /api/v1/organizations/departments/:id`).

## Validation Rules
- Hex color codes must match standard `#RRGGBB` format.
- Department codes must be unique within tenant.

## Permissions
`requireRole(["owner", "admin"])`.

## APIs / Backend Dependencies
- `GET /api/v1/organizations/current`
- `PATCH /api/v1/organizations/branding`
- `POST /api/v1/organizations/departments`
- `DELETE /api/v1/organizations/departments/:id`

## Data Dependencies
- `Organization` in `organizations` collection.

## Notifications / Integrations
None.

## Failure Scenarios
- Invalid hex code: Schema rejection (HTTP 400).

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/Settings.tsx`
- `server/src/modules/organizations/controllers/organization.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase1-core-onboarding.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ADM-009.md`
