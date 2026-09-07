# Phase 4 API Contract Summary: Journey Automation & Smart Assignment

**Phase:** Phase 4 — Journey Automation & Smart Assignment  

---

## 1. Dry-Run Smart Assignment Preview

- **HTTP Method:** `POST`
- **Path:** `/api/v1/journeys/:id/assignment-preview`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Smart assignment preview generated successfully",
  "data": {
    "journeyId": "6a85e3567a57018df4d7cae8",
    "journeyTitle": "Engineering Onboarding",
    "totalMatchingEmployees": 12,
    "alreadyAssignedCount": 4,
    "netNewEnrolleesCount": 8,
    "matchingEmployees": [
      {
        "_id": "60d5ec49f1b2c81123456789",
        "fullName": "Alice Smith",
        "email": "alice@company.com",
        "department": "Engineering",
        "jobTitle": "Backend Engineer",
        "location": "San Francisco",
        "isAlreadyAssigned": false
      }
    ]
  }
}
```

---

## 2. Bulk Smart Auto-Assignment Execution

- **HTTP Method:** `POST`
- **Path:** `/api/v1/journeys/:id/smart-assign`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`)
- **Request Body (Optional):**
```json
{
  "overrideDueDate": "2026-09-01T00:00:00.000Z"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Successfully smart-assigned journey \"Engineering Onboarding\" to 8 employees. (4 already assigned/skipped)",
  "data": {
    "assignedCount": 8,
    "skippedCount": 4,
    "message": "Successfully smart-assigned journey \"Engineering Onboarding\" to 8 employees. (4 already assigned/skipped)"
  }
}
```

---

## 3. Update Journey Targeting Rules

- **HTTP Method:** `PATCH`
- **Path:** `/api/v1/journeys/:id/targeting`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`)
- **Request Body:**
```json
{
  "departmentNames": ["Engineering", "Product"],
  "jobTitleNames": ["Software Engineer", "DevOps Engineer"],
  "locations": ["San Francisco", "Remote"],
  "employmentTypes": ["full_time"],
  "startDateOffsetDays": 14,
  "autoEnrollNewHires": true,
  "reassignmentPolicy": "keep_progress"
}
```
- **Response `200 OK`:** Updated `Journey` object.
