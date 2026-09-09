# Navigate Interactive Workplace Map & Desks

## Journey ID
UJ-OPS-002

## Primary Role
All Roles (Employees, Managers, Admins)

## Business Goal
Help incoming new hires orient themselves in corporate offices by rendering interactive floor maps, office locations, assigned desk seating, meeting rooms, amenities (cafeteria, restrooms), and emergency exits.

## Preconditions
User is authenticated.

## Trigger
User navigates to `/office-map` from sidebar or onboarding checklist.

## Expected Outcome
1. Renders interactive SVG/Canvas floor map for selected office location.
2. Highlights the new hire's assigned desk.
3. Allows searching for teammates' desks, conference rooms, and printer stations.

## Journey Steps
1. Navigate to `/office-map` (`src/pages/OfficeMap.tsx`).
2. Frontend calls `GET /api/v1/locations/office-map`.
3. UI renders floor plan selector (e.g. "San Francisco - Floor 4").
4. Map pins indicate desks with occupant avatars.
5. User searches for their manager's name in the map search input.
6. Map pans and highlights the manager's assigned desk location.

## Alternative Paths
- If user has no assigned physical desk (e.g. remote employee), displays remote badge and virtual team directory.

## Validation Rules
- Location data scoped to tenant.

## Permissions
All authenticated tenant users.

## APIs / Backend Dependencies
- `GET /api/v1/locations/office-map` (`server/src/modules/locations/routes/location.routes.ts`)

## Data Dependencies
- `Location`, `DeskAssignment` in MongoDB.

## Notifications / Integrations
None.

## Failure Scenarios
- Invalid office ID: Falls back to primary headquarters map.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/OfficeMap.tsx`
- `server/src/modules/locations/controllers/location.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase19-office-map.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-OPS-002.md`
