# Phase 17 API Contract Summary: HRIS & Enterprise Integrations

**Phase:** Phase 17 — HRIS & Enterprise Integrations  

---

## 1. Create HRIS Integration Connector

- **HTTP Method:** `POST`
- **Path:** `/api/v1/integrations`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`)
- **Request Body:**
```json
{
  "provider": "bamboohr",
  "name": "BambooHR Production Sync",
  "subdomain": "acme-corp",
  "apiKey": "bamboo_api_key_123",
  "conflictPolicy": "hris_wins"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "HRIS integration created successfully",
  "data": {
    "_id": "60d5ec49f1b2c81123456789",
    "provider": "bamboohr",
    "name": "BambooHR Production Sync",
    "status": "active",
    "subdomain": "acme-corp",
    "fieldMappings": [
      { "externalField": "work_email", "internalField": "email" },
      { "externalField": "first_name", "internalField": "firstName" }
    ],
    "conflictPolicy": "hris_wins"
  }
}
```

---

## 2. Trigger Manual / Scheduled Employee Lifecycle Sync Pass

- **HTTP Method:** `POST`
- **Path:** `/api/v1/integrations/:id/sync`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`)
- **Request Body (Optional):**
```json
{
  "records": [
    {
      "work_email": "newhire@acme.com",
      "first_name": "Alexander",
      "last_name": "Sync",
      "department": "Engineering"
    }
  ]
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "HRIS employee lifecycle sync triggered successfully",
  "data": {
    "syncLog": {
      "_id": "60d5ec49f1b2c81123456790",
      "status": "success",
      "processedCount": 1,
      "createdUsersCount": 1,
      "updatedUsersCount": 0,
      "errorCount": 0
    }
  }
}
```

---

## 3. Inbound HRIS Webhook Receiver

- **HTTP Method:** `POST`
- **Path:** `/api/v1/integrations/webhooks/:provider`
- **Auth / RBAC:** Public Webhook Endpoint (HMAC Signature Verified)
- **Headers:** `x-signature: <sha256_hmac>`
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Webhook event processed successfully",
  "data": {
    "syncLog": {
      "status": "success",
      "processedCount": 1
    }
  }
}
```
