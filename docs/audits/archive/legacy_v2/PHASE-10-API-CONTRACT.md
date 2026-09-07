# Phase 10 API Contract Summary: Advanced Journey & Learning Experience

**Phase:** Phase 10 — Advanced Journey & Learning Experience  

---

## 1. Check Journey Prerequisites

- **HTTP Method:** `GET`
- **Path:** `/api/v1/journeys/:id/prerequisites-check`
- **Auth / RBAC:** `Bearer JWT` (Any authenticated user)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Prerequisite check completed",
  "data": {
    "locked": true,
    "pendingPrerequisites": [
      {
        "_id": "60d5ec49f1b2c81123456789",
        "title": "Foundation Security Training"
      }
    ]
  }
}
```

---

## 2. Deep Clone Journey

- **HTTP Method:** `POST`
- **Path:** `/api/v1/journeys/:id/clone`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`)
- **Response `201 Created`:** Cloned `Journey` object with status `draft`.

---

## 3. Reorder Curriculum Modules & Lessons

- **HTTP Method:** `PUT`
- **Path:** `/api/v1/journeys/:id/reorder`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`)
- **Request Body:**
```json
{
  "moduleOrders": [
    { "moduleId": "60d5ec49f1b2c81123456789", "order": 2 },
    { "moduleId": "60d5ec49f1b2c81123456790", "order": 1 }
  ]
}
```
- **Response `200 OK`:** Updated `Journey` object.

---

## 4. Trigger Learning Reminder Dispatch

- **HTTP Method:** `POST`
- **Path:** `/api/v1/journeys/reminders/dispatch`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Dispatched 5 learning progress reminders",
  "data": {
    "dispatchedCount": 5
  }
}
```
