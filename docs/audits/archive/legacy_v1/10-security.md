# Talnova Onboarding

# 10 — Security Architecture

**Version:** 1.0.0

**Status:** Production Architecture

---

# Purpose

This document defines the mandatory security architecture for the Talnova Onboarding platform.

It specifies:

* Authentication security
* Authorization
* Tenant isolation
* API security
* Infrastructure security
* Database security
* File storage security
* Input validation
* Logging
* Secrets management
* Secure development practices

Every component of the platform must comply with these requirements.

---

# Security Principles

Talnova follows these core principles:

* Zero Trust
* Least Privilege
* Defense in Depth
* Secure by Default
* Fail Securely
* Principle of Explicit Access
* Data Minimization
* Separation of Duties

Security is enforced on the server.

The client is never trusted.

---

# Authentication Security

Authentication follows the architecture defined in **07-authentication.md**.

Mandatory rules:

* JWT Access Tokens
* Rotating Refresh Tokens
* Argon2id password hashing
* Secure HTTP-only cookies
* Short-lived access tokens
* Session invalidation
* Account state validation

Passwords are never stored or transmitted in plaintext.

---

# Authorization Security

Every protected request must verify:

1. Authentication
2. Session validity
3. Organization membership
4. User role
5. Required permission
6. Resource ownership (where applicable)

Authorization failures return HTTP 403.

No endpoint may bypass authorization checks.

---

# Multi-Tenant Isolation

Talnova is a multi-tenant SaaS platform.

Every tenant owns its own data.

Every tenant-owned document contains:

```text
organizationId
```

Repositories must always scope queries by `organizationId`.

Cross-tenant access is strictly prohibited.

The absence of an organization filter in a repository query is considered a critical security defect.

---

# API Security

All API endpoints must:

* Require HTTPS
* Validate JWT signatures
* Validate request payloads
* Enforce rate limits
* Return standardized errors
* Never expose stack traces
* Never expose internal implementation details

All endpoints are versioned.

Example

```text
/api/v1
```

---

# Input Validation

Every incoming request must validate:

* Route parameters
* Query parameters
* Request body
* Headers (where required)

Validation uses Zod.

No controller should process unvalidated input.

---

# Output Security

Responses must never expose:

* Password hashes
* Refresh tokens
* Internal database metadata
* Stack traces
* Internal file paths
* Environment variables
* Cloudflare R2 credentials
* MongoDB connection details

Only explicitly approved fields may be returned.

---

# Password Security

Passwords use:

Argon2id

Requirements:

* Minimum 8 characters
* Strong password policy
* Configurable complexity rules

Passwords are never reversible.

Passwords are never logged.

---

# Token Security

Access Tokens

* Lifetime: 15 minutes

Refresh Tokens

* Lifetime: 30 days
* HTTP-only cookies
* Secure
* SameSite=Strict

Refresh tokens rotate on every refresh.

Expired or revoked tokens must never issue new access tokens.

---

# Session Security

Every login creates a session.

Sessions contain:

* Session ID
* User ID
* Organization ID
* Device metadata
* IP address
* Last activity
* Expiration

Future versions may support user-managed active sessions.

---

# Database Security

MongoDB Atlas is the only production database.

Rules:

* TLS required
* Authentication required
* Private credentials
* Least-privilege database users
* Regular backups
* Indexes for authorization queries

MongoDB must never be publicly writable.

---

# Object Storage Security

Cloudflare R2 stores binary files.

Rules:

* No binary data in MongoDB
* Validate uploads
* Restrict MIME types
* Restrict file size
* Generate unique object keys
* Organization-aware access control

Private files must never be exposed through predictable URLs.

Future versions should use signed URLs.

---

# File Upload Security

Every upload validates:

* Authentication
* Authorization
* File type
* MIME type
* File size
* Filename

Rejected uploads must never reach storage.

Future enhancements:

* Malware scanning
* Virus scanning
* Content inspection

---

# Transport Security

All communication uses HTTPS.

TLS 1.2 or higher is required.

HTTP requests should redirect to HTTPS.

Internal communication should also use encrypted connections whenever supported.

---

# Secrets Management

Secrets include:

* JWT secrets
* MongoDB URI
* Cloudflare R2 credentials
* Email provider credentials
* API keys

Rules:

* Store in environment variables
* Never commit to Git
* Never hardcode
* Never log
* Rotate periodically

---

# Rate Limiting

Default API:

* 100 requests/minute/IP

Authentication endpoints:

* 5 login attempts/15 minutes/IP

Password reset:

* 3 requests/30 minutes

Limits remain configurable.

---

# Logging Security

Application logs must never contain:

* Passwords
* JWT tokens
* Refresh tokens
* API secrets
* Database credentials
* File contents

Logs may include:

* Request ID
* User ID
* Organization ID
* Route
* Status code
* Response time
* Timestamp

---

# Audit Logging

The following events should be audited:

* Login
* Logout
* Failed login
* Password reset
* User invitation
* Role changes
* Permission changes
* Employee creation
* Journey publication
* Assignment changes
* File uploads
* File deletions

Audit logs should be immutable.

---

# CORS Security

Allowed origins are explicitly configured.

Production must not use:

```text
*
```

Credentials are allowed only for trusted frontend domains.

---

# HTTP Security Headers

The backend should enforce:

* Content-Security-Policy
* X-Frame-Options
* X-Content-Type-Options
* Referrer-Policy
* Permissions-Policy
* Strict-Transport-Security

Headers are configured through Fastify Helmet.

---

# Cross-Site Request Forgery (CSRF)

Access tokens are transmitted in Authorization headers.

Refresh tokens use HTTP-only cookies.

If cookie-based authenticated endpoints are introduced, CSRF protection must be enabled.

---

# Cross-Site Scripting (XSS)

Prevent XSS by:

* Escaping user-generated content
* Sanitizing rich text where applicable
* Validating HTML inputs
* Avoiding dangerous HTML rendering

The backend must never trust HTML from clients.

---

# Injection Prevention

Protect against:

* NoSQL Injection
* Command Injection
* Path Traversal
* Header Injection

Validation occurs before business logic.

Repositories must never construct queries from unsanitized input.

---

# Dependency Security

Dependencies must:

* Be actively maintained
* Support TypeScript
* Receive security updates
* Use permissive licenses

Deprecated or vulnerable packages should be replaced promptly.

---

# Error Handling

Unexpected errors should return:

```json
{
  "success": false,
  "message": "An unexpected error occurred.",
  "error": {
    "code": "INTERNAL_SERVER_ERROR"
  }
}
```

Detailed errors belong only in server logs.

---

# Infrastructure Security

Production server requirements:

* Ubuntu LTS
* Nginx reverse proxy
* PM2 process manager
* Firewall enabled
* Automatic security updates
* SSH restricted to trusted IPs
* Fail2Ban (recommended)

Only ports 80 and 443 should be publicly accessible.

---

# Backup Security

MongoDB Atlas manages database backups.

Cloudflare R2 stores binary assets.

Environment configuration should be backed up securely.

Backups must never contain exposed secrets.

---

# Monitoring

Security monitoring should include:

* Failed logins
* Suspicious IP activity
* Rate limit violations
* Permission denials
* Unexpected server errors
* Storage failures

Future versions may integrate centralized monitoring and alerting.

---

# Future Security Enhancements

The architecture is designed to support:

* Multi-Factor Authentication (MFA)
* Single Sign-On (SSO)
* WebAuthn / Passkeys
* SCIM provisioning
* IP allowlists
* Device trust
* Security dashboards
* Automatic threat detection
* Data Loss Prevention (DLP)

These enhancements should integrate without redesigning the existing security model.

---

# Security Checklist

Every new feature must satisfy the following before release:

* Authentication enforced
* Authorization enforced
* Tenant isolation verified
* Input validated
* Output sanitized
* Sensitive data excluded
* Audit logging implemented
* Error handling standardized
* Rate limiting applied
* File validation completed (if applicable)

No feature may bypass this checklist.

---

# AI Development Rules

AI coding agents contributing to the Talnova backend must follow these mandatory rules:

* Never trust client input.
* Never bypass authentication or authorization.
* Always scope tenant queries by `organizationId`.
* Never expose sensitive information.
* Validate all requests using Zod.
* Use only approved cryptographic algorithms.
* Never hardcode secrets.
* Never log credentials or tokens.
* Enforce secure defaults.
* Prefer denying access over assuming permission.
* Treat security violations as implementation defects.

If generated code conflicts with this document, the implementation must be considered incorrect regardless of functionality.

This document is the canonical security specification for the Talnova Onboarding platform and supersedes individual module implementations where security behavior is concerned.
