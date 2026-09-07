# Phase 3 — API Contract Summary

---

## Workflow Automation API

Base Path: `/api/v1/workflows`

### 1. GET `/api/v1/workflows`
- **Auth:** Bearer JWT required
- **Query Params:**
  - `triggerType` (enum: `user_created`, `journey_completed`, `task_completed`, `stage_entered`, `checkin_due`, optional)
- **Response 200:** Returns array of active workflow rules scoped to organization.

### 2. POST `/api/v1/workflows`
- **Auth:** Bearer JWT required (Admin/HR)
- **Payload:**
  ```json
  {
    "name": "Engineering New Hire Onboarding Rule",
    "description": "Auto-assigns journey and creates IT task when a new engineer joins",
    "triggerType": "user_created",
    "conditions": [
      {
        "field": "department",
        "operator": "equals",
        "value": "Engineering"
      }
    ],
    "actions": [
      {
        "type": "assign_journey",
        "params": {
          "journeyId": "6a85..."
        }
      },
      {
        "type": "create_task",
        "params": {
          "taskTitle": "Setup MacBook & GitHub Accounts",
          "taskCategory": "it_setup",
          "taskStage": "day_1",
          "taskPriority": "high"
        }
      },
      {
        "type": "send_notification",
        "params": {
          "notificationTitle": "Welcome to Engineering Team!",
          "notificationMessage": "Your onboarding path is active."
        }
      }
    ],
    "isActive": true
  }
  ```
- **Response 201:** Returns newly created workflow rule.

### 3. GET `/api/v1/workflows/executions`
- **Auth:** Bearer JWT required
- **Query Params:** `ruleId` (optional), `page` (number), `limit` (number)
- **Response 200:** Returns paginated list of workflow execution logs with evaluated conditions, step results, and status.

### 4. GET `/api/v1/workflows/:id`
- **Auth:** Bearer JWT required
- **Response 200:** Returns single workflow rule details.

### 5. PATCH `/api/v1/workflows/:id`
- **Auth:** Bearer JWT required
- **Payload:** Partial update of rule configuration.
- **Response 200:** Returns updated workflow rule and increments rule `version`.

### 6. PATCH `/api/v1/workflows/:id/toggle`
- **Auth:** Bearer JWT required
- **Payload:**
  ```json
  {
    "isActive": false
  }
  ```
- **Response 200:** Returns updated workflow rule with new active status.

### 7. DELETE `/api/v1/workflows/:id`
- **Auth:** Bearer JWT required
- **Response 200:** Soft-deletes workflow rule (`isDeleted: true`).

### 8. POST `/api/v1/workflows/:id/test-run`
- **Auth:** Bearer JWT required
- **Payload:**
  ```json
  {
    "targetUserId": "6a85..."
  }
  ```
- **Response 200:** Evaluates conditions and dispatches action steps for target user, returning executed step count and creating audit log.
