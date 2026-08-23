# Phase 16 API Contract Summary: Enterprise SSO & Identity

**Phase:** Phase 16 — Enterprise SSO & Identity  

---

## 1. Get Tenant SSO Configuration

- **HTTP Method:** `GET`
- **Path:** `/api/v1/auth/sso/config`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "SSO configuration retrieved successfully",
  "data": {
    "_id": "60d5ec49f1b2c81123456789",
    "organizationId": "60d5ec49f1b2c81123456780",
    "provider": "okta",
    "domains": ["acme.com"],
    "issuerUrl": "https://acme.okta.com",
    "enforceSSO": true,
    "defaultRole": "employee",
    "roleMappings": [
      {
        "idpGroup": "HR-Admins",
        "role": "admin"
      }
    ],
    "status": "active"
  }
}
```

---

## 2. Discover Domain SSO Settings

- **HTTP Method:** `POST`
- **Path:** `/api/v1/auth/sso/discover`
- **Auth / RBAC:** Public Endpoint
- **Request Body:**
```json
{
  "email": "employee@acme.com"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "SSO domain discovery processed successfully",
  "data": {
    "ssoEnabled": true,
    "provider": "okta",
    "ssoUrl": "https://acme.okta.com/authorize",
    "enforceSSO": true,
    "organizationId": "60d5ec49f1b2c81123456780"
  }
}
```

---

## 3. Handle SSO Assertion Callback (JIT & Role Mapping)

- **HTTP Method:** `POST`
- **Path:** `/api/v1/auth/sso/callback`
- **Auth / RBAC:** Public Endpoint
- **Request Body:**
```json
{
  "organizationId": "60d5ec49f1b2c81123456780",
  "email": "newuser@acme.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "ssoId": "sso_12345",
  "idpGroups": ["HR-Admins"]
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "SSO authentication successful",
  "data": {
    "user": {
      "_id": "60d5ec49f1b2c81123456781",
      "auth": { "email": "newuser@acme.com" },
      "permissions": { "role": "admin" }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR...",
    "session": {
      "_id": "60d5ec49f1b2c81123456782"
    }
  }
}
```
