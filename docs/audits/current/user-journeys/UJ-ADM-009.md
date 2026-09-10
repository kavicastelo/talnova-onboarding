# Journey Audit — Org Branding & Department Settings

## Journey ID
UJ-ADM-009

## Date
September 2026

## Primary Role
Organization Owner / HR Administrator (`owner`, `admin`)

## Intended Behavior
An organization administrator can configure organizational branding and department taxonomies from `/settings`. The administrator can customize the organization's primary brand color (e.g. `#1d4ed8`), which persists to MongoDB via `PATCH /api/v1/organizations/branding` and dynamically colors interactive elements across the platform. 

In addition, the administrator can manage departments through a dedicated "Departments" tab, creating new department entities with unique department codes (e.g. `Customer Success` with code `CS`) via `POST /api/v1/organizations/departments`. The newly added departments are persisted under `Organization.departments` in MongoDB, rendered in the departments management table with code badges, and made immediately available in employee dropdowns across the workspace (including `/directory` "Invite Employee" dialog). Empty departments can be deleted via `DELETE /api/v1/organizations/departments/:id`. Non-administrative users visiting `/settings` see personal preferences only, with organization and branding tabs securely hidden.

## Actual Behavior
1. **Navigation & Role-Based Tab Rendering**:
   - Authenticated administrators accessing `/settings` see organization administration tabs: `Workspace`, `Branding`, `Departments`, `Security`, `Notifications`, and `Certificates`.
   - Non-administrative employees (`role: "employee"`) visiting `/settings` see a restricted view titled `"Personal Settings"` with only the `"Notifications"` tab visible. Organization-level tabs (`Workspace`, `Branding`, `Departments`, `Security`, `Certificates`) are hidden from both view and DOM interaction.

2. **Negative Validation (Color Format)**:
   - Entering an invalid color string (e.g., `blue`) into the Primary Brand Color input and attempting to save triggers client-side validation: `"Invalid hex color format. Must be a 6-digit hex code (e.g. #1d4ed8)"`.
   - The backend API (`PATCH /api/v1/organizations/branding`) validates against the hex regex `/^#[0-9A-F]{6}$/i` and rejects invalid values with `HTTP 400`/`HTTP 422`.

3. **Branding Update (Happy Path)**:
   - In the "Branding" tab (`[data-testid="tab-branding"]`), the administrator enters `#1d4ed8` into the primary color input (`[data-testid="primary-color-input"]`).
   - The live color preview circle immediately reflects royal blue (`#1d4ed8`).
   - Clicking "Save Branding" (`[data-testid="save-branding-btn"]`) dispatches `PATCH /api/v1/organizations/branding` with `{ primaryColor: "#1d4ed8" }`.
   - Network response returns `HTTP 200 OK` with updated branding metadata.
   - UI displays toast notification: `"Branding updated successfully!"`.
   - MongoDB inspection confirms `Organization.branding.primaryColor` is updated to `#1d4ed8`.

4. **Department Management (Happy Path)**:
   - In the "Departments" tab (`[data-testid="tab-departments"]`), the administrator clicks "Add Department" (`[data-testid="add-department-btn"]`).
   - The administrator inputs:
     - Name: `Customer Success` (`[data-testid="dept-name-input"]`)
     - Code: `CS` (`[data-testid="dept-code-input"]`)
   - Clicking "Save Department" (`[data-testid="save-department-btn"]`) dispatches `POST /api/v1/organizations/departments`.
   - Network response returns `HTTP 201 Created` with the new department object.
   - UI displays toast: `"Department created successfully!"`.
   - The departments table renders the new row with Department Name `Customer Success`, status badge `Active`, and code badge `CS` (`[data-testid="dept-code-badge-CS"]`).

5. **Alternative Path (Department Deletion)**:
   - Clicking the delete icon on an empty department row dispatches `DELETE /api/v1/organizations/departments/:id`.
   - Network response returns `HTTP 200 OK`.
   - The department is removed from MongoDB and filtered out of active departments in subsequent queries.

6. **Integration Verification**:
   - Navigating to `/directory` and opening the "Invite Employee" modal reveals that `Customer Success` is immediately populated in the "Department" dropdown.

7. **Negative Tests (Duplicate Code Collision)**:
   - Attempting to create another department with the existing code `CS` returns `HTTP 400 Bad Request` with message `"Department with code 'CS' already exists"`, preventing department code collision within the tenant.

8. **Authorization Tests**:
   - Standard employees calling `PATCH /api/v1/organizations/branding` receive `HTTP 403 Forbidden`.
   - Standard employees calling `POST /api/v1/organizations/departments` receive `HTTP 403 Forbidden`.
   - Standard employees calling `DELETE /api/v1/organizations/departments/:id` receive `HTTP 403 Forbidden`.

## Implementation Status
`FULLY_IMPLEMENTED`

## Final Verdict
`PASS` (All happy path steps, alternative paths, negative validations, role-based isolation, data integrity, and integration checks verified in both live browser execution and automated tests).

---

## What Is Implemented
- **Branding Update Endpoint & Validation**: `PATCH /api/v1/organizations/branding` in `server/src/modules/organizations/routes/organization.routes.ts` with hex regex schema validation in `organization.schema.ts`.
- **Department CRUD with Code Support**:
  - `IDepartment` model interface and `DepartmentSchema` in `server/src/modules/organizations/models/organization.model.ts` updated with `code?: string`.
  - Duplicate code and name checking in `OrganizationService.createDepartment`.
  - Atomically removing deleted departments via `OrganizationRepository.deleteDepartment` ($pull).
- **Settings UI with Role-Based Isolation**:
  - `src/pages/Settings.tsx`: Non-admin users see "Personal Settings" with "Notifications" only.
  - Dedicated "Branding" tab with color preview circle, hex format validation, and `Save Branding` action.
  - Dedicated "Departments" tab with "Add Department" form, department table, code badges, pagination, and deletion actions.
- **Directory Dropdown Integration**: `src/pages/EmployeeDirectory.tsx` dynamically renders newly added departments from `useDepartments()` in the "Invite Employee" dialog.
- **Automated Vitest Suite**: `server/src/tests/uj-adm-009.test.ts` verifying all 7 test cases (7/7 passed).

---

## What Is Missing
- None. All requirements of UJ-ADM-009 are satisfied.

---

## What Is Incorrect
- None.

---

## Test Evidence & Payloads

### 1. Network Request: `PATCH /api/v1/organizations/branding`
```http
PATCH /api/v1/organizations/branding HTTP/1.1
Host: localhost:8080
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "primaryColor": "#1d4ed8"
}
```

### 2. Network Response: `PATCH /api/v1/organizations/branding` (HTTP 200 OK)
```json
{
  "success": true,
  "message": "Branding updated successfully",
  "data": {
    "_id": "67d024b89e60a370e7041a80",
    "name": "Northwind Labs",
    "slug": "northwind-labs",
    "branding": {
      "primaryColor": "#1d4ed8",
      "secondaryColor": "#ffffff",
      "accentColor": "#6366f1"
    }
  }
}
```

### 3. Network Request: `POST /api/v1/organizations/departments`
```http
POST /api/v1/organizations/departments HTTP/1.1
Host: localhost:8080
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "name": "Customer Success",
  "code": "CS"
}
```

### 4. Network Response: `POST /api/v1/organizations/departments` (HTTP 201 Created)
```json
{
  "success": true,
  "message": "Department created successfully",
  "data": {
    "_id": "6aa31732fee0e331592d6288",
    "name": "Customer Success",
    "code": "CS",
    "active": true
  }
}
```

### 5. Network Request: `DELETE /api/v1/organizations/departments/:id` (Alternative Path)
```http
DELETE /api/v1/organizations/departments/6aa31732fee0e331592d6288 HTTP/1.1
Host: localhost:8080
Authorization: Bearer <admin_jwt_token>
```
Response: `HTTP 200 OK`
```json
{
  "success": true,
  "message": "Department deleted successfully",
  "data": null
}
```

---

## Visual Evidence

### 1. Updated Branding View (`#1d4ed8`)
The branding configuration tab showing updated primary brand color `#1d4ed8` with real-time visual circle preview and Save Branding button:
![Branding Settings Updated](C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/branding_settings_updated_1789074115264.png)

### 2. Updated Departments Table
The departments taxonomy tab displaying the newly persisted `Customer Success` department with code badge `CS`:
![Department Settings Updated](C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/department_settings_updated_1789074239529.png)

### 3. Integration Check — Directory Invite Dropdown
The employee directory "Invite Employee" modal displaying `Customer Success` in the dynamic department selection list:
![Directory Invite Dropdown](C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/directory_invite_dropdown_verified_1789074301291.png)

### 4. Authorization Check — Employee Settings Tabs Hidden
Standard employee accessing `/settings` receives the restricted "Personal Settings" view with organization and branding administration tabs completely hidden:
![Employee Settings View](C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/employee_settings_tabs_hidden_1789074387191.png)

---

## Automated Test Execution Summary
```bash
npx vitest run src/tests/uj-adm-009.test.ts
```
```text
 ✓ src/tests/uj-adm-009.test.ts (7 tests) 11242ms
   ✓ Step 3, 4 & 5: PATCH /api/v1/organizations/branding updates primary brand color to #1d4ed8 (943ms)
   ✓ Step 8, 9, 10 & 11: POST /api/v1/organizations/departments creates Customer Success (CS) department (1427ms)
   ✓ Integration Check: GET /api/v1/organizations/departments lists the new department (1961ms)
   ✓ Alternative Path: DELETE /api/v1/organizations/departments/:id deletes empty department (553ms)
   ✓ Negative Tests: Invalid hex color format ('blue') is rejected with 400/422 Bad Request (8ms)
   ✓ Negative Tests: Duplicate department code within tenant is rejected with 400 Bad Request (696ms)
   ✓ Authorization Tests: Regular employees are rejected with 403 Forbidden (278ms)

Test Files  1 passed (1)
     Tests  7 passed (7)
```
