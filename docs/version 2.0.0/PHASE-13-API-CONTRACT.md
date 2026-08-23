# Phase 13 API Contract Summary: Gamification & Engagement

**Phase:** Phase 13 — Gamification & Engagement  

---

## 1. Get Employee Gamification Profile

- **HTTP Method:** `GET`
- **Path:** `/api/v1/gamification/profile`
- **Auth / RBAC:** `Bearer JWT` (Authenticated User)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Gamification profile retrieved successfully",
  "data": {
    "_id": "60d5ec49f1b2c81123456789",
    "userId": "60d5ec49f1b2c81123456790",
    "points": 150,
    "level": 2,
    "currentStreak": 3,
    "longestStreak": 5,
    "unlockedBadges": [
      {
        "badgeId": "first_step",
        "name": "First Step",
        "description": "Earned your first 50 XP in onboarding!",
        "icon": "🌟",
        "unlockedAt": "2026-08-19T18:00:00.000Z"
      }
    ],
    "pointHistory": [
      {
        "action": "quiz_completed",
        "points": 50,
        "description": "Completed onboarding practice quiz",
        "timestamp": "2026-08-19T18:00:00.000Z"
      }
    ]
  }
}
```

---

## 2. Award XP Points

- **HTTP Method:** `POST`
- **Path:** `/api/v1/gamification/award-points`
- **Auth / RBAC:** `Bearer JWT` (Authenticated User)
- **Request Body:**
```json
{
  "action": "quiz_completed",
  "points": 50,
  "description": "Completed onboarding practice quiz"
}
```
- **Response `200 OK`:** Updated `GamificationProfile` object.

---

## 3. Record Activity Streak

- **HTTP Method:** `POST`
- **Path:** `/api/v1/gamification/streak`
- **Auth / RBAC:** `Bearer JWT` (Authenticated User)
- **Response `200 OK`:** Updated `GamificationProfile` object with current streak.

---

## 4. Get Organization Leaderboard

- **HTTP Method:** `GET`
- **Path:** `/api/v1/gamification/leaderboard`
- **Auth / RBAC:** `Bearer JWT` (Authenticated User)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Organization leaderboard retrieved successfully",
  "data": [
    {
      "rank": 1,
      "userId": "60d5ec49f1b2c81123456790",
      "name": "Phase13 Learner",
      "email": "learner@company.com",
      "department": "Engineering",
      "points": 150,
      "level": 2,
      "currentStreak": 3,
      "badgesCount": 1,
      "badges": []
    }
  ]
}
```
