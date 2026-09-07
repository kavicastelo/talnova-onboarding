# Phase 12 API Contract Summary: Analytics & Operational Reporting

**Phase:** Phase 12 — Analytics & Operational Reporting  

---

## 1. Get Time-to-Completion Metrics

- **HTTP Method:** `GET`
- **Path:** `/api/v1/analytics/time-to-completion`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`, `manager`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Time-to-completion metrics retrieved successfully",
  "data": {
    "averageCompletionDays": 4.5,
    "fastestCompletionDays": 1.2,
    "slowestCompletionDays": 14.0,
    "totalCompletedAssignments": 15
  }
}
```

---

## 2. Get Quiz & Module Failure Bottlenecks

- **HTTP Method:** `GET`
- **Path:** `/api/v1/analytics/bottlenecks`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`, `manager`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Quiz and module failure bottlenecks retrieved successfully",
  "data": {
    "moduleBottlenecks": [
      {
        "moduleId": "60d5ec49f1b2c81123456789",
        "title": "Security Compliance Module",
        "attempts": 12,
        "passRate": 66,
        "averageScore": 72
      }
    ],
    "difficultQuestions": [
      {
        "questionId": "60d5ec49f1b2c81123456790",
        "questionText": "Question 3456790",
        "attempts": 12,
        "incorrectRate": 42
      }
    ]
  }
}
```

---

## 3. Export Raw Compliance CSV

- **HTTP Method:** `GET`
- **Path:** `/api/v1/analytics/export`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`, `manager`)
- **Response `200 OK`:**
- **Headers:** `Content-Type: text/csv; charset=utf-8`
- **Body Content:**
```csv
Employee Name,Email,Department,Journey Title,Status,Completion %,Assigned Date,Completed Date
"Jane Onboardee","jane@company.com","Engineering","Security Orientation",completed,100%,2026-08-15,2026-08-19
```

---

## 4. Create Scheduled Report Schedule

- **HTTP Method:** `POST`
- **Path:** `/api/v1/analytics/scheduled-reports`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`, `manager`)
- **Request Body:**
```json
{
  "title": "Weekly HR Executive Summary",
  "frequency": "weekly",
  "recipients": ["hr@company.com", "exec@company.com"],
  "format": "csv"
}
```
- **Response `201 Created`:** Created `ScheduledReport` object.
