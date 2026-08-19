# Phase 5 API Contract Summary: Manager Operations & Team Oversight

**Phase:** Phase 5 — Manager Operations & Team Oversight  

---

## 1. Manager Dashboard Metrics

- **HTTP Method:** `GET`
- **Path:** `/api/v1/manager/dashboard`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`, `manager`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Manager dashboard retrieved successfully",
  "data": {
    "totalDirectReports": 5,
    "activeOnboardingCount": 3,
    "overallCompletionRate": 78,
    "overdueItemsCount": 2,
    "recentActivities": [
      {
        "id": "60d5ec49f1b2c81123456789",
        "employeeName": "Alice Smith",
        "type": "journey_completed",
        "title": "Completed journey \"Engineering Onboarding\"",
        "timestamp": "2026-08-19T20:00:00.000Z"
      }
    ]
  }
}
```

---

## 2. Direct Reports Roster

- **HTTP Method:** `GET`
- **Path:** `/api/v1/manager/team`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`, `manager`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Direct reports roster retrieved successfully",
  "data": [
    {
      "_id": "60d5ec49f1b2c81123456789",
      "fullName": "Alice Smith",
      "email": "alice@company.com",
      "jobTitle": "Backend Engineer",
      "department": "Engineering",
      "status": "onboarding",
      "journeyStats": {
        "totalAssigned": 2,
        "completed": 1,
        "inProgress": 1,
        "completionPercentage": 75
      },
      "taskStats": {
        "totalAssigned": 4,
        "completed": 3,
        "overdue": 1
      },
      "hasOverdueItems": true
    }
  ]
}
```

---

## 3. Direct Report Deep-Dive Details

- **HTTP Method:** `GET`
- **Path:** `/api/v1/manager/team/:employeeId`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`, `manager`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Direct report details retrieved successfully",
  "data": {
    "employee": {
      "_id": "60d5ec49f1b2c81123456789",
      "fullName": "Alice Smith",
      "email": "alice@company.com",
      "jobTitle": "Backend Engineer",
      "department": "Engineering",
      "status": "onboarding"
    },
    "assignments": [],
    "tasks": []
  }
}
```

---

## 4. Send Manager Nudge

- **HTTP Method:** `POST`
- **Path:** `/api/v1/manager/team/:employeeId/nudge`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`, `manager`)
- **Request Body (Optional):**
```json
{
  "message": "Please complete your assigned Compliance training today."
}
```

---

## 5. Manager Onboarding Sign-Off

- **HTTP Method:** `POST`
- **Path:** `/api/v1/manager/team/:employeeId/sign-off`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`, `manager`)
- **Request Body (Optional):**
```json
{
  "notes": "All onboarding modules completed satisfactorily."
}
```
