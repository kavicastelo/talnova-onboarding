# Phase 15 API Contract Summary: AI Course & Journey Builder

**Phase:** Phase 15 — AI Course & Journey Builder  

---

## 1. Synthesize AI Course Draft

- **HTTP Method:** `POST`
- **Path:** `/api/v1/ai/course-builder/generate`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`)
- **Request Body:**
```json
{
  "prompt": "DevOps Security Onboarding",
  "targetRole": "DevOps Engineer",
  "department": "Engineering"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "AI course draft generated successfully",
  "data": {
    "_id": "60d5ec49f1b2c81123456789",
    "title": "DevOps Security Onboarding — DevOps Engineer Onboarding",
    "description": "AI-generated onboarding curriculum...",
    "targetRole": "DevOps Engineer",
    "department": "Engineering",
    "status": "draft",
    "version": 1,
    "modules": [
      {
        "moduleId": "mod-1",
        "title": "Module 1: Orientation & Core Fundamentals",
        "description": "Introduction to core policies...",
        "lessons": [
          {
            "lessonId": "les-1",
            "title": "Company Policies & Code of Conduct",
            "content": "Welcome to the team!...",
            "durationMinutes": 15,
            "quizQuestions": [
              {
                "questionId": "q-1",
                "questionText": "What is the mandatory timeline?",
                "options": ["Within 14 days", "Within 30 days"],
                "correctOptionIndex": 0
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 2. Regenerate Module Content

- **HTTP Method:** `POST`
- **Path:** `/api/v1/ai/course-builder/drafts/:id/regenerate-module`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`)
- **Request Body:**
```json
{
  "moduleId": "mod-1"
}
```
- **Response `200 OK`:** Updated `AICourseDraft` object with incremented version.

---

## 3. Approve & Publish Draft to Live Journeys

- **HTTP Method:** `POST`
- **Path:** `/api/v1/ai/course-builder/drafts/:id/publish`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Course draft published to live Journeys successfully",
  "data": {
    "draft": {
      "_id": "60d5ec49f1b2c81123456789",
      "status": "published",
      "publishedJourneyId": "60d5ec49f1b2c81123456799"
    },
    "journey": {
      "_id": "60d5ec49f1b2c81123456799",
      "title": "DevOps Security Onboarding...",
      "status": "published"
    }
  }
}
```
