# Phase 14 API Contract Summary: AI Onboarding Assistant

**Phase:** Phase 14 — AI Onboarding Assistant  

---

## 1. Process AI Chat Prompt

- **HTTP Method:** `POST`
- **Path:** `/api/v1/ai/chat`
- **Auth / RBAC:** `Bearer JWT` (Authenticated User)
- **Request Body:**
```json
{
  "message": "What is the Company Security policy?",
  "conversationId": "60d5ec49f1b2c81123456789"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "AI response generated successfully",
  "data": {
    "_id": "60d5ec49f1b2c81123456789",
    "title": "What is the Company Security...",
    "messages": [
      {
        "sender": "user",
        "content": "What is the Company Security policy?",
        "timestamp": "2026-08-19T18:00:00.000Z"
      },
      {
        "sender": "assistant",
        "content": "Based on your company's knowledge base article \"Company Security and Data Policy\":...",
        "citations": [
          {
            "title": "Company Security and Data Policy",
            "url": "/knowledge-base/security-policy-123",
            "articleId": "60d5ec49f1b2c81123456790"
          }
        ],
        "actionSuggestions": [
          {
            "text": "View Tasks & Checklists",
            "action": "/tasks"
          }
        ],
        "timestamp": "2026-08-19T18:00:01.000Z"
      }
    ]
  }
}
```

---

## 2. List User AI Conversations

- **HTTP Method:** `GET`
- **Path:** `/api/v1/ai/conversations`
- **Auth / RBAC:** `Bearer JWT` (Authenticated User)
- **Response `200 OK`:** Array of `AIConversation` objects.

---

## 3. Log Response Feedback

- **HTTP Method:** `POST`
- **Path:** `/api/v1/ai/feedback`
- **Auth / RBAC:** `Bearer JWT` (Authenticated User)
- **Request Body:**
```json
{
  "conversationId": "60d5ec49f1b2c81123456789",
  "messageId": "60d5ec49f1b2c81123456791",
  "rating": "up",
  "comment": "Accurate citation"
}
```
- **Response `200 OK`:** Updated `AIConversation` object with feedback.
