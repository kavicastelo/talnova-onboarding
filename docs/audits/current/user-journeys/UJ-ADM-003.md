# Journey Audit — Bulk Import Employees via CSV

## Journey ID
UJ-ADM-003

## Date
September 2026

## Primary Role
HR Administrator / Owner (`admin`, `owner`)

## Intended Behavior
An administrator or organization owner can accelerate onboarding by uploading a multi-row CSV file containing new hire records (`fullName,email,department,jobTitle,employmentType,hireDate`). The frontend parses and validates the CSV, displaying a preview modal with row validation indicators (green checkmarks). Upon clicking "Confirm Import", the client dispatches `POST /api/v1/employees/import`. The backend processes records in batches, performs duplicate email deduplication, dynamically creates or resolves departments, persists user accounts under the correct tenant `organizationId`, emits `USER_CREATED` events, and returns `{ imported: 3, skipped: 0, errors: [] }`. The directory table immediately updates with the newly imported employees.

## Actual Behavior
1. **CSV Parsing & Column Validation**:
   - The CSV parser (`parseCSVContent`) parses carriage returns, newlines, and quoted values safely without crashing.
   - Header matching detects standard columns: `fullName`, `email`, `department`, `jobTitle`, `employmentType`, `hireDate`.
   - Client-side validation: If the required `email` or name column is missing, an error banner is displayed (`"CSV missing required column: 'email'"`), and the "Confirm Import" button is disabled.
2. **Preview Mode**:
   - When 3 valid rows are parsed, the preview modal displays: `"3 valid rows ready to import"`.
   - Each row (Alice Walker, Bob Martinez, Charlie Kim) displays a green checkmark icon (`CheckCircle2`), employee full name, email, department, job title, and employment badge.
3. **Batch Import Execution**:
   - Clicking "Confirm Import" dispatches `POST /api/v1/employees/import` with parsed row data.
   - The backend accepts the payload, resolves departments dynamically without failing legacy organization schemas, hashes default passwords, creates `User` records, and publishes `USER_CREATED` events via the event bus.
   - Network response returns `200 OK` with payload:
     ```json
     {
       "success": true,
       "message": "Employees imported successfully",
       "imported": 3,
       "skipped": 0,
       "errors": [],
       "data": {
         "successCount": 3,
         "failures": [],
         "imported": 3,
         "skipped": 0,
         "errors": []
       }
     }
     ```
4. **Data Persistence & Tenancy**:
   - MongoDB query confirms 3 new `User` records created with matching `organizationId`, correct profile details, and designations.
5. **Directory Table Update**:
   - Directory table refreshes and displays Alice Walker (`Frontend Dev`), Bob Martinez (`Content Specialist`), and Charlie Kim (`Account Exec`) with `Active` status.
6. **Alternative Path (Duplicate Handling)**:
   - When a CSV with 1 duplicate email and 2 new emails is submitted, the system imports the 2 new employees and skips the duplicate with reason `"A user with this email address already exists."`.
7. **Authorization Enforcement**:
   - An employee role token attempting to call `POST /api/v1/employees/import` receives `HTTP 403 Forbidden`.

## Implementation Status
`FULLY_IMPLEMENTED`

## Final Verdict
`PASS` (All happy path, alternative path, negative test, authorization, data integrity, and integration requirements verified in both the live running application and automated test suites).

---

## What Is Implemented
- **CSV Parser with Quote and Carriage-Return Resiliency**: `src/pages/EmployeeDirectory.tsx` (`parseCSVContent`).
- **Preview Modal with Row Indicators**: Displaying green checkmarks (`CheckCircle2`), full employee details, and validation counts.
- **Client Header Validation**: Negative error banner and disabled submit button when required headers are missing.
- **Backend Import Route & Controller**: `POST /api/v1/employees/import` in `server/src/modules/employees/routes/employee.routes.ts` and `employee.controller.ts`.
- **Dynamic Department Resolution & Safe Document Updates**: `server/src/modules/employees/services/employee.service.ts` (`Organization.updateOne` for dynamic department creation).
- **Event Bus Integration**: Emits `USER_CREATED` events for each imported user for downstream workflows, auto-enrollments, and task assignments.
- **Automated Test Suite**: `server/src/tests/uj-adm-003.test.ts` (4/4 tests passed).

---

## What Is Missing
- None. All requirements of UJ-ADM-003 are satisfied.

---

## What Is Incorrect
- None.

---

## Test Evidence & Payloads

### 1. Network Response Payload: `POST /api/v1/employees/import`
**Request**:
```http
POST /api/v1/employees/import HTTP/1.1
Host: localhost:8080
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "users": [
    {
      "fullName": "Alice Walker",
      "email": "alice_csv@test.com",
      "department": "Engineering",
      "jobTitle": "Frontend Dev",
      "employmentType": "full_time",
      "hireDate": "2026-10-01"
    },
    {
      "fullName": "Bob Martinez",
      "email": "bob_csv@test.com",
      "department": "Marketing",
      "jobTitle": "Content Specialist",
      "employmentType": "full_time",
      "hireDate": "2026-10-01"
    },
    {
      "fullName": "Charlie Kim",
      "email": "charlie_csv@test.com",
      "department": "Sales",
      "jobTitle": "Account Exec",
      "employmentType": "full_time",
      "hireDate": "2026-10-01"
    }
  ]
}
```

**Response (`HTTP 200 OK`)**:
```json
{
  "success": true,
  "message": "Employees imported successfully",
  "imported": 3,
  "skipped": 0,
  "errors": [],
  "data": {
    "successCount": 3,
    "failures": [],
    "imported": 3,
    "skipped": 0,
    "errors": []
  }
}
```

### 2. MongoDB Verified Records
```json
[
  {
    "email": "alice_csv@test.com",
    "name": "Alice Walker",
    "organizationId": "6a42e795916da0cac4bb1853",
    "department": "Engineering",
    "designation": "Frontend Dev",
    "employmentType": "full_time"
  },
  {
    "email": "bob_csv@test.com",
    "name": "Bob Martinez",
    "organizationId": "6a42e795916da0cac4bb1853",
    "department": "Marketing",
    "designation": "Content Specialist",
    "employmentType": "full_time"
  },
  {
    "email": "charlie_csv@test.com",
    "name": "Charlie Kim",
    "organizationId": "6a42e795916da0cac4bb1853",
    "department": "Sales",
    "designation": "Account Exec",
    "employmentType": "full_time"
  }
]
```

### 3. Automated Vitest Execution Output (`server/src/tests/uj-adm-003.test.ts`)
```text
 ✓ src/tests/uj-adm-003.test.ts (4 tests) 4784ms
   ✓ Journey Test UJ-ADM-003: Bulk Import Employees via CSV > Happy Path: Successfully imports 3 valid rows from CSV data (606ms)
   ✓ Journey Test UJ-ADM-003: Bulk Import Employees via CSV > Alternative Path: Handles duplicate row gracefully (2 valid, 1 duplicate skipped) (559ms)
   ✓ Journey Test UJ-ADM-003: Bulk Import Employees via CSV > Negative Test: Rejects malformed payload or missing required email with HTTP 400/422 (7ms)
   ✓ Journey Test UJ-ADM-003: Bulk Import Employees via CSV > Authorization Test: Regular employees cannot access import endpoint (returns HTTP 403) (67ms)

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### 4. Visual Evidence Artifacts
- **Preview Modal with 3 Valid Rows and Green Checkmarks**:
  `uj_adm_003_preview_modal_valid_rows_1789070514714.png`
- **Negative Test (Malformed CSV missing email header with disabled submit button)**:
  `uj_adm_003_negative_test_malformed_csv_1789070456232.png`
- **Directory Table View with Alice, Bob, and Charlie**:
  `uj_adm_003_directory_table_imported_1789072094557.png`
- **Full E2E Video Recording**:
  `uj_adm_003_bulk_import_1789070185498.webp`

---

## Gap Analysis

| Requirement | Expected | Actual | Status |
| :--- | :--- | :--- | :--- |
| **Directory Navigation** | Admin navigates to `/directory` and clicks "Bulk Import". | Verified: Modal opens with sample template download and upload zone. | `ALIGNED` |
| **CSV Preview Mode** | Parses 3 rows with green checkmarks. | Verified: 3 rows parsed, labeled "3 valid rows ready to import", each row displaying `CheckCircle2`. | `ALIGNED` |
| **Negative Test (Missing Header)** | Uploading CSV missing email header flags missing required column and disables submit. | Verified: Error banner "CSV missing required column: 'email'" displayed; "Confirm Import" disabled. | `ALIGNED` |
| **Batch Import Execution** | `POST /api/v1/employees/import` returns HTTP 200 with `{ imported: 3, skipped: 0, errors: [] }`. | Verified: HTTP 200 returned with exact expected payload structure. | `ALIGNED` |
| **Directory Table Refresh** | Directory table updates to display Alice, Bob, and Charlie. | Verified: Table updates displaying all 3 employees with roles and departments. | `ALIGNED` |
| **Duplicate Row Handling** | 1 duplicate row is skipped while 2 valid rows are imported. | Verified: Tested and passing in `uj-adm-003.test.ts` (imported: 2, skipped: 1). | `ALIGNED` |
| **Authorization Check** | Employee role receives HTTP 403 on import endpoint. | Verified: Fastify `requireRole(["owner", "admin"])` returns HTTP 403. | `ALIGNED` |
| **Data Integrity & Tenancy** | Users persisted in MongoDB with correct `organizationId`. | Verified: All 3 accounts created under tenant ID `6a42e795916da0cac4bb1853`. | `ALIGNED` |
| **Integration Events** | Emits `USER_CREATED` events for created users. | Verified: Captured in event bus during import. | `ALIGNED` |

---

## Impact
Zero regression. Administrators can reliably upload new hire CSVs, preview them with row-level validation indicators, and import employees with duplicate protection and event dispatch.

---

## Related Code
- Frontend Directory: `src/pages/EmployeeDirectory.tsx`
- Frontend Service: `src/services/employee.service.ts`
- Backend Controller: `server/src/modules/employees/controllers/employee.controller.ts`
- Backend Service: `server/src/modules/employees/services/employee.service.ts`
- Backend Schema: `server/src/modules/employees/schemas/employee.schema.ts`
- Backend Routes: `server/src/modules/employees/routes/employee.routes.ts`
- Automated Test Suite: `server/src/tests/uj-adm-003.test.ts`

---

## Related Documentation
- `docs/user-journeys/administration/UJ-ADM-003.md`
- `prompts/user-journeys/UJ-ADM-003.md`
