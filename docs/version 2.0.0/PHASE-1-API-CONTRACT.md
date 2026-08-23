# Phase 1 — API Contract Summary

---

## 1. Notification Preferences API

### GET `/api/v1/notifications/preferences`
- **Auth:** Bearer JWT required
- **Scope:** Returns current authenticated user's notification preferences for their active organization.
- **Response 200:**
  ```json
  {
    "success": true,
    "message": "Notification preferences retrieved successfully",
    "data": {
      "_id": "6a85...",
      "organizationId": "...",
      "userId": "...",
      "channels": {
        "inApp": true,
        "email": true
      },
      "categories": {
        "journeyAssigned": { "inApp": true, "email": true },
        "journeyOverdue": { "inApp": true, "email": true },
        "complianceDue": { "inApp": true, "email": true },
        "announcements": { "inApp": true, "email": true },
        "reminders": { "inApp": true, "email": true }
      },
      "quietHours": {
        "enabled": false
      },
      "frequency": "immediate"
    }
  }
  ```

### PUT `/api/v1/notifications/preferences`
- **Auth:** Bearer JWT required
- **Request Payload:** Partial `NotificationPreferences` fields to update.
- **Response 200:**
  ```json
  {
    "success": true,
    "message": "Notification preferences updated successfully",
    "data": { ... }
  }
  ```

---

## 2. Notification Center API

### GET `/api/v1/notifications`
- **Auth:** Bearer JWT required
- **Query Params:** `isRead` (boolean, optional), `page` (number, default 1), `limit` (number, default 50)
- **Response 200:** Returns list of notifications scoped to authenticated user & organization.

### GET `/api/v1/notifications/count`
- **Auth:** Bearer JWT required
- **Response 200:** `{ "success": true, "data": { "count": 3 } }`

### PATCH `/api/v1/notifications/:id/read`
- **Auth:** Bearer JWT required
- **Response 200:** Marks single notification as read and sets `readAt` timestamp.

### PATCH `/api/v1/notifications/read-all`
- **Auth:** Bearer JWT required
- **Response 200:** Marks all unread notifications for authenticated user as read.
