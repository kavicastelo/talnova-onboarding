# Phase 18 API Contract Summary: Mobile PWA & Field Access

**Phase:** Phase 18 — Mobile PWA & Field Access  

---

## 1. Register Web Push Subscription

- **HTTP Method:** `POST`
- **Path:** `/api/v1/notifications/push-subscription`
- **Auth / RBAC:** `Bearer JWT` (Authenticated User)
- **Request Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/device_token_123",
  "keys": {
    "p256dh": "BNcR...=",
    "auth": "tB2j...="
  }
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Web Push subscription registered successfully",
  "data": {
    "_id": "60d5ec49f1b2c81123456789",
    "organizationId": "60d5ec49f1b2c81123456780",
    "userId": "60d5ec49f1b2c81123456781",
    "endpoint": "https://fcm.googleapis.com/fcm/send/device_token_123"
  }
}
```

---

## 2. Unregister Web Push Subscription

- **HTTP Method:** `DELETE`
- **Path:** `/api/v1/notifications/push-subscription`
- **Auth / RBAC:** `Bearer JWT` (Authenticated User)
- **Request Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/device_token_123"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Web Push subscription unregistered successfully"
}
```
