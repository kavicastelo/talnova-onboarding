# Phase 8 API Contract Summary: Buddy & Onboarding Support Program

**Phase:** Phase 8 — Buddy & Onboarding Support Program  

---

## 1. Register / Update Buddy Profile

- **HTTP Method:** `POST`
- **Path:** `/api/v1/buddy/profiles`
- **Auth / RBAC:** `Bearer JWT` (Any authenticated employee)
- **Request Body:**
```json
{
  "isAvailable": true,
  "maxMentees": 3,
  "skills": ["React", "Node.js", "Agile"],
  "bio": "Excited to mentor new team members!"
}
```
- **Response `200 OK`:** Created/updated `BuddyProfile` object.

---

## 2. Assign Buddy to New Hire

- **HTTP Method:** `POST`
- **Path:** `/api/v1/buddy/assign`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`, `manager`)
- **Request Body:**
```json
{
  "newHireUserId": "60d5ec49f1b2c81123456789",
  "buddyUserId": "60d5ec49f1b2c81123459999"
}
```
- **Response `201 Created`:** Created `BuddyAssignment` object with default checklist.

---

## 3. Update Buddy Checklist Task

- **HTTP Method:** `PUT`
- **Path:** `/api/v1/buddy/assignment/:id/checklist`
- **Auth / RBAC:** `Bearer JWT` (Assignee buddy or onboardee)
- **Request Body:**
```json
{
  "taskId": "60d5ec49f1b2c81123458888",
  "completed": true
}
```
- **Response `200 OK`:** Updated `BuddyAssignment` object.

---

## 4. Log 1-on-1 Buddy Check-In Meeting

- **HTTP Method:** `POST`
- **Path:** `/api/v1/buddy/assignment/:id/checkin`
- **Auth / RBAC:** `Bearer JWT` (Assignee buddy or onboardee)
- **Request Body:**
```json
{
  "notes": "Had virtual coffee chat! Helped with Slack and tools setup.",
  "rating": 5
}
```
- **Response `200 OK`:** Updated `BuddyAssignment` object with appended checkin log.
