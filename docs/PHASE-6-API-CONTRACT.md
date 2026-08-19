# Phase 6 API Contract Summary: Digital Documents & E-Signatures

**Phase:** Phase 6 — Digital Documents & E-Signatures  

---

## 1. Create Document Template

- **HTTP Method:** `POST`
- **Path:** `/api/v1/documents/templates`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`)
- **Request Body:**
```json
{
  "title": "Non-Disclosure Agreement (NDA)",
  "category": "nda",
  "content": "This agreement is between {{companyName}} and {{employeeName}} ({{employeeEmail}})...",
  "signatureRequired": true,
  "audience": {
    "autoAssignNewHires": true
  }
}
```
- **Response `201 Created`:** Created `DocumentTemplate` object.

---

## 2. Assign Document to Employee

- **HTTP Method:** `POST`
- **Path:** `/api/v1/documents/assign`
- **Auth / RBAC:** `Bearer JWT` (Role: `owner`, `admin`)
- **Request Body:**
```json
{
  "templateId": "6a85e83285e943da512b1ec4",
  "employeeId": "60d5ec49f1b2c81123456789",
  "dueDate": "2026-09-01T00:00:00.000Z"
}
```
- **Response `201 Created`:** Created `DocumentAssignment` object with `renderedContent`.

---

## 3. Get Employee Document Inbox

- **HTTP Method:** `GET`
- **Path:** `/api/v1/documents/inbox`
- **Auth / RBAC:** `Bearer JWT` (Any authenticated user)
- **Response `200 OK`:** Array of `DocumentAssignment` objects assigned to current user.

---

## 4. In-App E-Signature Submission

- **HTTP Method:** `POST`
- **Path:** `/api/v1/documents/:id/sign`
- **Auth / RBAC:** `Bearer JWT` (Assignee employee)
- **Request Body:**
```json
{
  "type": "draw",
  "signatureDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "signerName": "John Doe"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Document signed successfully with SHA-256 cryptographic audit trail",
  "data": {
    "_id": "6a85e83285e943da512b1ec4",
    "status": "signed",
    "signedAt": "2026-08-19T23:00:00.000Z",
    "signatureData": {
      "type": "draw",
      "signatureDataUrl": "data:image/png;base64,...",
      "signerName": "John Doe",
      "signedAt": "2026-08-19T23:00:00.000Z",
      "sha256Hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    "auditTrail": [
      {
        "action": "assigned",
        "timestamp": "2026-08-19T22:50:00.000Z"
      },
      {
        "action": "signed",
        "timestamp": "2026-08-19T23:00:00.000Z",
        "details": "E-Signature executed by John Doe. Checksum SHA-256: e3b0c44298fc1c14..."
      }
    ]
  }
}
```
