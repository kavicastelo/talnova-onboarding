# Phase 7 API Contract Summary: 30/60/90-Day Milestones & Check-Ins

**Phase:** Phase 7 — 30/60/90-Day Milestones & Check-Ins  

---

## 1. Create Milestone Template

- **HTTP Method:** `POST`
- **Path:** `/api/v1/milestones/templates`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`)
- **Request Body:**
```json
{
  "title": "Day 30 Integration Milestone",
  "targetDay": 30,
  "goals": [
    { "title": "Complete initial tools setup" },
    { "title": "Conduct 1-on-1 feedback session" }
  ],
  "checkinQuestions": [
    { "question": "What were your biggest accomplishments in Month 1?", "type": "text", "required": true }
  ],
  "audience": {
    "autoAssignNewHires": true
  }
}
```
- **Response `201 Created`:** Created `MilestoneTemplate` object.

---

## 2. Assign Milestone Program

- **HTTP Method:** `POST`
- **Path:** `/api/v1/milestones/assign`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`)
- **Request Body:**
```json
{
  "templateId": "6a85eb71d55120e003f75f11",
  "employeeId": "60d5ec49f1b2c81123456789"
}
```
- **Response `201 Created`:** Created `EmployeeMilestone` object with `dueDate` calculated relative to employee's hire date.

---

## 3. Employee Self Check-In Submission

- **HTTP Method:** `POST`
- **Path:** `/api/v1/milestones/:id/self-checkin`
- **Auth / RBAC:** `Bearer JWT` (Assignee employee)
- **Request Body:**
```json
{
  "responses": [
    {
      "questionId": "60d5ec49f1b2c81123456789",
      "question": "What were your biggest accomplishments in Month 1?",
      "answer": "Completed security training and shipped first feature."
    }
  ],
  "confidenceRating": 5,
  "comments": "Feeling confident and well supported by team.",
  "goalsCompletedTitles": ["Complete initial tools setup"]
}
```
- **Response `200 OK`:** Updated `EmployeeMilestone` object with status `in_review`.

---

## 4. Manager Review & Approval

- **HTTP Method:** `POST`
- **Path:** `/api/v1/milestones/:id/manager-review`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`, `manager`)
- **Request Body:**
```json
{
  "approvalStatus": "approved",
  "performanceRating": 5,
  "feedback": "Great start in your first 30 days! Approved."
}
```
- **Response `200 OK`:** Updated `EmployeeMilestone` object with status `completed`.
