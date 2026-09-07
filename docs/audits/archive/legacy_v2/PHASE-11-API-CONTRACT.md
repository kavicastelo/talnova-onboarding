# Phase 11 API Contract Summary: HR Operations & Onboarding Administration

**Phase:** Phase 11 — HR Operations & Onboarding Administration  

---

## 1. Unified HR Operational Dashboard

- **HTTP Method:** `GET`
- **Path:** `/api/v1/hr/dashboard`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`, `manager`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "HR operational dashboard metrics retrieved successfully",
  "data": {
    "totalEmployees": 42,
    "activeOnboardees": 12,
    "pausedOnboardees": 1,
    "journeyComplianceRate": 92,
    "pendingDocuments": 4,
    "overdueMilestones": 2,
    "unassignedBuddiesCount": 3
  }
}
```

---

## 2. Onboarding Exception & Escalation Queue

- **HTTP Method:** `GET`
- **Path:** `/api/v1/hr/exceptions`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`, `manager`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Onboarding exception queue retrieved successfully",
  "data": [
    {
      "employee": {
        "_id": "60d5ec49f1b2c81123456789",
        "name": "Jane Onboardee",
        "email": "jane@company.com",
        "department": "Engineering",
        "jobTitle": "DevOps Engineer"
      },
      "riskLevel": "critical",
      "issues": [
        "2 overdue learning journey(s)",
        "No assigned onboarding buddy"
      ]
    }
  ]
}
```

---

## 3. Employee Lifecycle Controls (Pause / Resume / Extend)

- **HTTP Method:** `PUT`
- **Path:** `/api/v1/hr/lifecycle/:userId/state`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`, `manager`)
- **Request Body:**
```json
{
  "state": "paused",
  "reason": "Extended medical leave",
  "extensionDays": 14
}
```
- **Response `200 OK`:** Updated `User` object.

---

## 4. Bulk Batch Operations

- **HTTP Method:** `POST`
- **Path:** `/api/v1/hr/bulk-action`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`, `manager`)
- **Request Body:**
```json
{
  "action": "send_reminder",
  "employeeIds": ["60d5ec49f1b2c81123456789", "60d5ec49f1b2c81123456790"],
  "payload": {
    "message": "Batch onboarding reminder nudge from HR admin."
  }
}
```
- **Response `200 OK`:** `{ "processedCount": 2 }`

---

## 5. Compliance Audit Report

- **HTTP Method:** `GET`
- **Path:** `/api/v1/hr/compliance-report`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`, `manager`)
- **Response `200 OK`:** Array of employee compliance report objects.
