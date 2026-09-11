# Journey Audit — Navigate Workplace Map & Desks

## Journey ID
UJ-OPS-002

## Date
September 2026

## Primary Role
All Authenticated Users (`employee`, `manager`, `admin`, `owner`)

## Business Goal
Verify that a new hire can navigate the interactive office map, view floor layouts, search for teammates' desks, and locate key amenities:
1. Navigate to `/office-map`.
2. Monitor network: `GET /api/v1/locations/office-map` returns `HTTP 200 OK`.
3. Inspect UI: Interactive SVG floor plan renders with desk pins, conference rooms, and kitchen areas.
4. Type name of teammate in map search input.
5. Assert map highlights matching desk pin with person card popover.
6. Alternative Paths: Switch between floors using floor selector dropdown.
7. Negative Tests: Search for non-existent name renders "No matching team members found on this floor".
8. Authorization & Tenant Boundary: Multi-tenant boundary enforced; only tenant users can access tenant office maps.
9. Data Integrity: All desks, floors, and location records belong to user's `organizationId`.

---

## Actual Behavior

1. **Navigation & Initial Map State (`/office-map`)**:
   - Authenticated user navigates to `http://localhost:5173/office-map`.
   - Client requests `GET /api/v1/locations/office-map`, which returns `HTTP 200 OK`.
   - UI renders page title `"Office Map & Location Experience"` (`[data-testid="office-map-header"]`).
   - Primary Location guidance card (`[data-testid="guidance-summary-card"]`) renders building details:
     - **Location:** Talnova San Francisco HQ (`500 Howard Street, Suite 400, San Francisco, USA`)
     - **Wi-Fi Credentials (`[data-testid="wifi-card"]`):** SSID `Talnova-Secure-5G`, Password `SFOHQ-Welcome2026!`
     - **Building Access (`[data-testid="access-code-card"]`):** Lobby Pass Code `KEY-5004`
     - **Assigned Desk (`[data-testid="assigned-desk-card"]`):** Floor 1, Desk `101-A`

2. **Interactive SVG Floor Plan (`[data-testid="office-floor-plan-svg"]`)**:
   - High-fidelity architectural vector floor plan renders smoothly on SVG canvas (`viewBox="0 0 920 520"`):
     - **Conference Rooms:**
       - Conference Room Alpha (`[data-testid="room-conference-alpha"]`): 12 Seats with 4K Display
       - Apollo Meeting Room (`[data-testid="room-apollo"]`): 8 Seats with Digital Whiteboard
       - Phone & Quiet Pods (`[data-testid="room-quiet-pods"]`): Quiet Pod A & Quiet Pod B
     - **Kitchen & Amenities:**
       - Kitchen & Coffee Bar (`[data-testid="room-kitchen"]`): Espresso bar, dining island, microwaves, and sparkling water
       - Restrooms & Wellness (`[data-testid="room-restrooms"]`): Accessible restrooms & first aid station
       - Emergency Exit (`[data-testid="emergency-exit"]`)
     - **Desk Workstations:**
       - Desk `101-A`: Assigned to Alex Developer
       - Desk `101-B`: Assigned to Sarah Connor (`[data-testid="desk-pin-101-B"]`)
       - Desk `102-A`: Assigned to Michael Chang
       - Desk `102-B`: Assigned to Priya Patel
       - Desk `103-A`: Available / Vacant hotdesk
       - Desk `103-B`: Available / Vacant hotdesk

3. **Teammate Search & Person Card Popover**:
   - User types `"Sarah"` into map search input (`[data-testid="map-search-input"]`).
   - Match alert appears: `"Found teammate: Sarah Connor at Desk 101-B (Engineering Core)"`.
   - SVG floor plan highlights Desk `101-B` with an animated pulsing amber glow ring.
   - Person card popover (`[data-testid="person-card-popover"]`) opens displaying:
     - Avatar initials `SC`, Name `"Sarah Connor"`, Status badge `OCCUPIED`
     - Department / Zone: `"Engineering Core"`
     - Assigned Desk: `"101-B"` (`[data-testid="popover-person-desk"]`)
     - Floor Level: `"Floor 1"` (`[data-testid="popover-person-floor"]`)
     - Desk re-assignment controls

4. **Alternative Path: Multi-Floor Switcher**:
   - User changes floor selector dropdown (`[data-testid="floor-selector"]`) to `"Floor 2 — Executive & Growth"`.
   - Map smoothly updates layout and loads Floor 2 workstations:
     - Desk `201-A`: Assigned to David Kim
     - Desk `201-B`: Assigned to Elena Rostova
     - Desk `202-A`: Vacant Executive Hotdesk
     - Desk `202-B`: Vacant Executive Hotdesk

5. **Negative Test: Search for Non-Existent Name**:
   - User types `"NonExistentTeammate"` into search bar on Floor 2.
   - Map displays warning banner (`[data-testid="no-matching-members"]`):
     `"⚠️ No matching team members found on this floor"`.
   - SVG floor plan remains interactive and error-free without console exceptions.

6. **Desk Re-Assignment Action**:
   - Admin/manager submits `POST /api/v1/locations/:id/assign-desk`.
   - Server returns `HTTP 200 OK` and updates MongoDB desk assignment.

7. **Authorization & Tenant Boundary Isolation**:
   - Authenticated user in Organization B requests `GET /api/v1/locations/office-map` and only receives Organization B's location (`Acme London Satellite Office`), with zero data leakage from Organization A.

8. **Data Integrity Checks**:
   - All locations and desks returned match the user's active `organizationId` in MongoDB.

---

## Implementation Status
`FULLY_IMPLEMENTED`

## Final Verdict
`PASS`

---

## What Is Implemented

- **Backend Office Map Route & Controller (`server/src/modules/locations/routes/office-location.routes.ts`, `server/src/modules/locations/controllers/office-location.controller.ts`, `server/src/modules/locations/services/office-location.service.ts`)**:
  - Registered `GET /office-map` in `officeLocationRoutes` prior to `/:id` route parameter.
  - Implemented `getOfficeMap` controller and service methods returning comprehensive location guidance, building credentials, and floor plan desks.
  - Desk assignment API `POST /api/v1/locations/:id/assign-desk` supporting floor and desk number reassignment.

- **Frontend Interactive Workplace Map (`src/pages/OfficeMap.tsx`, `src/services/location.service.ts`)**:
  - Interactive SVG canvas with architectural walls, conference rooms (Alpha, Apollo), quiet booths, kitchen cafe, and restrooms.
  - Teammate search input (`[data-testid="map-search-input"]`) with live desk highlight and pulsing locator ring.
  - Person card popover (`[data-testid="person-card-popover"]`) displaying teammate details, status, and desk number.
  - Multi-floor selector dropdown (`[data-testid="floor-selector"]`).
  - Empty state warning (`[data-testid="no-matching-members"]`).

- **Automated Vitest Test Suite (`server/src/tests/uj-ops-002.test.ts`)**:
  - 6 of 6 tests passing (100% success rate):
    - `✓ Step 1-2: GET /api/v1/locations/office-map returns HTTP 200 OK with floor layouts, desks, and access info`
    - `✓ Alternative Path: Multi-floor navigation returns Floor 2 layouts and configurations`
    - `✓ Desk Assignment Action: Assigning an employee to a vacant desk via POST /api/v1/locations/:id/assign-desk`
    - `✓ Negative Test: Unauthenticated request to /api/v1/locations/office-map is rejected with HTTP 401`
    - `✓ Authorization & Tenant Boundary Isolation: User B in Org B never receives Org A location or desks`
    - `✓ Data Integrity Check: All returned desks and location record belong strictly to authenticated organizationId`

---

## Evidence Artifacts

### 1. Initial Office Floor Plan (Floor 1) with Amenities and Desk Pins
![Initial Office Floor Plan](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/initial_office_map_view_1789160170889.png)

### 2. Teammate Search ("Sarah") with Highlighted Pin & Person Card Popover
![Teammate Search & Person Card Popover](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/sarah_desk_popover_1789160190069.png)

### 3. Multi-Floor Navigation (Floor 2 — Executive & Growth)
![Floor 2 Office Map](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/floor_2_office_map_1789160226767.png)

### 4. Negative Test: Search for Non-Existent Teammate
![Negative Search Result](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/no_matching_members_warning_1789160273203.png)

### 5. Browser Session Video Recording
The complete interactive browser session was recorded and archived:
- Recording: [office_map_navigation_flow_1789160152736.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/office_map_navigation_flow_1789160152736.webp)

---

## Summary of Test Results

| Step / Test Case | Expectation | Actual Result | Status |
|---|---|---|---|
| **Navigate to `/office-map`** | Office Map page loads | Page, Wi-Fi credentials, and SVG map rendered | **PASS** |
| **GET `/office-map` Endpoint** | Returns `200 OK` with floors & desks | Returns `200 OK` with 2 floors and desk assignments | **PASS** |
| **Interactive SVG Layout** | Meeting rooms & kitchen amenities rendered | Conference Alpha, Apollo, Kitchen, and Restrooms rendered | **PASS** |
| **Teammate Search** | Search teammate highlights pin & opens popover | Desk 101-B highlighted + Sarah Connor popover | **PASS** |
| **Floor Selector Switch** | Changes to Floor 2 layouts | Floor 2 rendered with David Kim & Elena Rostova | **PASS** |
| **Negative Search Test** | Warns if teammate not on floor | Displays "No matching team members found on this floor" | **PASS** |
| **Tenant Isolation** | Scoped strictly to authenticated org | Org B only receives Org B offices and desks | **PASS** |
| **Automated Vitest Suite** | 6 test assertions pass | 6 of 6 tests passed (100%) | **PASS** |
