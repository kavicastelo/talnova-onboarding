# Talnova Onboarding

# 08 — API Standards

**Version:** 1.0.0

**Status:** Production Architecture

---

# Purpose

This document defines the official API standards for the Talnova Onboarding platform.

It specifies:

* REST conventions
* Endpoint naming
* Request structure
* Response structure
* Error handling
* Pagination
* Filtering
* Sorting
* Versioning
* HTTP status codes
* Validation rules

Every backend endpoint must comply with this specification.

---

# API Philosophy

Talnova exposes a RESTful JSON API.

The API is designed to be:

* Predictable
* Consistent
* Stateless
* Versioned
* Type-safe
* Frontend-friendly
* Easy to document
* Easy to test

Every endpoint should follow the same patterns regardless of the module.

---

# Base URL

```text
/api/v1
```

Examples

```text
/api/v1/auth/login

/api/v1/employees

/api/v1/journeys

/api/v1/knowledge-base
```

Future breaking changes require:

```text
/api/v2
```

---

# Content Type

Requests

```http
Content-Type: application/json
```

Responses

```http
Content-Type: application/json
```

Multipart uploads

```http
multipart/form-data
```

---

# Resource Naming

Resources use plural nouns.

Correct

```text
/employees

/journeys

/organizations

/uploads
```

Incorrect

```text
/getEmployees

/createJourney

/deleteEmployee
```

Actions belong to HTTP methods, not URLs.

---

# HTTP Methods

| Method | Purpose            |
| ------ | ------------------ |
| GET    | Retrieve resources |
| POST   | Create resources   |
| PUT    | Replace resources  |
| PATCH  | Partial updates    |
| DELETE | Remove resources   |

---

# Endpoint Examples

List

```http
GET /employees
```

Retrieve

```http
GET /employees/{id}
```

Create

```http
POST /employees
```

Update

```http
PATCH /employees/{id}
```

Delete

```http
DELETE /employees/{id}
```

Nested resource

```http
GET /journeys/{journeyId}/assignments
```

---

# Standard Success Response

Every successful response uses the same envelope.

```json
{
  "success": true,
  "message": "Employee retrieved successfully.",
  "data": {}
}
```

---

# Collection Response

```json
{
  "success": true,
  "message": "Employees retrieved successfully.",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 153,
    "totalPages": 8
  }
}
```

---

# Error Response

Every error response follows the same structure.

```json
{
  "success": false,
  "message": "Validation failed.",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": []
  }
}
```

Never return stack traces.

Never expose internal errors.

---

# HTTP Status Codes

| Status | Meaning                |
| ------ | ---------------------- |
| 200    | Success                |
| 201    | Resource Created       |
| 204    | No Content             |
| 400    | Bad Request            |
| 401    | Unauthorized           |
| 403    | Forbidden              |
| 404    | Not Found              |
| 409    | Conflict               |
| 413    | Payload Too Large      |
| 415    | Unsupported Media Type |
| 422    | Validation Error       |
| 429    | Too Many Requests      |
| 500    | Internal Server Error  |

Use the most specific status code available.

---

# Validation Errors

Validation errors should identify invalid fields.

Example

```json
{
  "success": false,
  "message": "Validation failed.",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "email",
        "message": "Email is invalid."
      }
    ]
  }
}
```

---

# Pagination

Collection endpoints should support pagination.

Query parameters

```text
?page=1

?limit=20
```

Defaults

```text
page=1

limit=20
```

Maximum limit

```text
100
```

---

# Sorting

Sorting uses

```text
?sort=name
```

Descending

```text
?sort=-createdAt
```

Multiple fields

```text
?sort=name,-createdAt
```

---

# Filtering

Simple filters

```text
?department=Engineering

?status=Active
```

Multiple filters

```text
?department=Engineering&status=Active
```

---

# Searching

Keyword search

```text
?q=john
```

Search behavior is determined by the resource.

---

# Field Selection

Optional sparse fieldsets

```text
?fields=name,email,status
```

Useful for lightweight requests.

---

# Includes

Expandable relationships

```text
?include=manager

?include=department

?include=organization
```

Multiple

```text
?include=manager,department
```

---

# Idempotency

POST endpoints that create resources may support an optional

```http
Idempotency-Key
```

header.

Future support for safe retries.

---

# Request Headers

Standard headers

```http
Authorization: Bearer <token>

Content-Type: application/json

Accept: application/json
```

Request ID

```http
X-Request-ID
```

Generated automatically if absent.

---

# Response Headers

Recommended

```http
X-Request-ID

X-RateLimit-Limit

X-RateLimit-Remaining

X-RateLimit-Reset
```

---

# Date Format

All timestamps use ISO 8601 UTC.

Example

```text
2026-06-27T12:30:45.123Z
```

Never return localized date strings.

---

# Identifiers

MongoDB ObjectIds are returned as strings.

Example

```json
{
  "id": "6861b7d93d6e9f39c2f6f17b"
}
```

Do not expose internal database metadata.

---

# Soft Delete

Deleted resources should generally be soft deleted.

Responses should not include archived resources unless explicitly requested.

---

# File Upload API

Upload endpoint

```http
POST /uploads
```

Request

```http
multipart/form-data
```

Response

```json
{
  "success": true,
  "message": "File uploaded successfully.",
  "data": {
    "id": "...",
    "url": "...",
    "mimeType": "...",
    "size": 12345
  }
}
```

Binary files are stored in Cloudflare R2.

Only metadata is stored in MongoDB.

---

# Bulk Operations

Bulk endpoints

```http
POST /employees/bulk-import

PATCH /employees/bulk-update

DELETE /employees/bulk-delete
```

Bulk responses should return per-item results where appropriate.

---

# Rate Limiting Response

When limits are exceeded

```json
{
  "success": false,
  "message": "Too many requests.",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED"
  }
}
```

HTTP Status

429

---

# API Versioning

Version appears in the URL.

Current

```text
/api/v1
```

Breaking changes require

```text
/api/v2
```

Minor enhancements should remain backward compatible.

---

# Deprecation

Deprecated endpoints should include

```http
Deprecation: true
Sunset: <date>
```

Clients should receive migration guidance before removal.

---

# OpenAPI Specification

Every endpoint must be documented.

Documentation is generated automatically.

Manual API documentation is prohibited.

---

# Error Codes

Standard application codes

```text
VALIDATION_ERROR

UNAUTHORIZED

FORBIDDEN

NOT_FOUND

CONFLICT

RATE_LIMIT_EXCEEDED

FILE_TOO_LARGE

UNSUPPORTED_MEDIA_TYPE

TOKEN_EXPIRED

INVALID_TOKEN

INTERNAL_SERVER_ERROR
```

Codes should remain stable across versions.

---

# Security Rules

Protected endpoints require

```http
Authorization: Bearer <access_token>
```

Refresh tokens are never transmitted through Authorization headers.

Input validation occurs before business logic.

Sensitive data must never be returned.

---

# Performance Guidelines

Collection endpoints should

* Paginate by default.
* Support filtering.
* Support sorting.
* Avoid N+1 queries.
* Return only required fields.

Large exports should use background jobs.

---

# API Consistency Rules

Every endpoint must:

* Return the standard response envelope.
* Use the correct HTTP status code.
* Validate all input.
* Return structured errors.
* Respect tenant isolation.
* Support pagination where applicable.
* Use ISO 8601 timestamps.
* Return ObjectIds as strings.
* Follow REST naming conventions.

Consistency is mandatory across all modules.

---

# AI Development Rules

AI coding agents must follow these rules:

* Do not invent custom response formats.
* Always return the standard API envelope.
* Never expose stack traces or database errors.
* Use RESTful endpoints.
* Validate every request before reaching business logic.
* Respect versioning conventions.
* Use proper HTTP status codes.
* Keep endpoint names resource-oriented.
* Ensure all new endpoints are compatible with OpenAPI generation.
* Maintain backward compatibility within the same API version.

This document defines the canonical API contract for the Talnova Onboarding platform. Any deviation from these standards requires an architecture revision before implementation.
