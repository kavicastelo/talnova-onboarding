# Phase 2 — API Contract Summary

---

## Task Management API

Base Path: `/api/v1/tasks`

### 1. GET `/api/v1/tasks`
- **Auth:** Bearer JWT required
- **Query Params:**
  - `assignedToMe` (boolean, optional) - filter tasks assigned to current user
  - `assignedToUserId` (string, optional)
  - `employeeId` (string, optional)
  - `stage` (enum: `preboarding`, `day_1`, `week_1`, `month_1`, `custom`)
  - `category` (enum: `it_setup`, `hr_paperwork`, `equipment`, `training`, `general`)
  - `priority` (enum: `low`, `normal`, `high`, `critical`)
  - `status` (enum: `pending`, `in_progress`, `completed`, `overdue`, `cancelled`)
  - `isOverdue` (boolean, optional)
  - `page` (number, default 1)
  - `limit` (number, default 50)
- **Response 200:** Returns array of populated task objects scoped to organization.

### 2. POST `/api/v1/tasks`
- **Auth:** Bearer JWT required
- **Payload:**
  ```json
  {
    "title": "Setup IT Workstation & Software Access",
    "description": "Provision MacBook Pro, Slack, GitHub, and 1Password accounts.",
    "assignedToUserId": "6a85...",
    "employeeId": "6a85...",
    "stage": "preboarding",
    "category": "it_setup",
    "priority": "high",
    "dueDate": "2026-08-25T00:00:00.000Z",
    "relativeOffsetDays": 3,
    "prerequisiteTaskIds": ["6a85..."]
  }
  ```
- **Response 201:** Returns newly created task.

### 3. GET `/api/v1/tasks/:id`
- **Auth:** Bearer JWT required
- **Response 200:** Returns single task details with populated assignee, employee, author, and prerequisite tasks.

### 4. PATCH `/api/v1/tasks/:id/status`
- **Auth:** Bearer JWT required
- **Payload:**
  ```json
  {
    "status": "completed",
    "note": "Workstation delivered and accounts active"
  }
  ```
- **Errors:** `400 PREREQUISITES_NOT_MET` if uncompleted prerequisite tasks exist.
- **Response 200:** Returns updated task and appends entry to `statusHistory`.

### 5. POST `/api/v1/tasks/:id/comments`
- **Auth:** Bearer JWT required
- **Payload:**
  ```json
  {
    "comment": "Asset tracking number is DEL-99812."
  }
  ```
- **Response 200:** Appends comment subdocument and returns updated task.

### 6. DELETE `/api/v1/tasks/:id`
- **Auth:** Bearer JWT required
- **Response 200:** Soft-deletes task (`isDeleted: true`).
