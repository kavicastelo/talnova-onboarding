# Talnova Onboarding

# 07 — Authentication & Authorization

**Version:** 1.0.0

**Status:** Production Architecture

---

# Purpose

This document defines the complete Identity and Access Management (IAM) architecture for the Talnova Onboarding platform.

It specifies:

* Authentication
* Authorization
* Session management
* Token lifecycle
* Role-based access control
* Tenant isolation
* Password security
* Invitation flow
* Future SSO readiness

Every protected API endpoint must comply with this specification.

---

# Authentication Principles

Talnova follows these core principles:

* Stateless authentication
* Short-lived access tokens
* Long-lived refresh tokens
* Secure password hashing
* Tenant-aware authorization
* Principle of least privilege
* Zero trust by default

Every request is considered unauthenticated until proven otherwise.

---

# Authentication Flow

```text
User

↓

Login

↓

Credentials Verified

↓

Generate Access Token

↓

Generate Refresh Token

↓

Store Refresh Token

↓

Return Tokens

↓

Authenticated Requests

↓

Access Token Expires

↓

Refresh Token

↓

Issue New Access Token
```

---

# Authentication Methods

Supported

* Email & Password

Future

* Google Workspace SSO
* Microsoft Entra ID
* Okta
* OneLogin
* SAML 2.0
* SCIM User Provisioning

The authentication architecture must remain extensible without breaking existing APIs.

---

# Password Security

Passwords are never stored in plaintext.

Algorithm

Argon2id

Requirements

Minimum length

* 8 characters

Recommended

* 12+ characters

Password rules

* Uppercase letter
* Lowercase letter
* Number
* Special character

Passwords are hashed before persistence.

Passwords are never returned through any API.

---

# Access Tokens

Format

JWT

Purpose

Authenticate API requests.

Lifetime

15 minutes

Stored

Memory (Frontend)

Never stored in Local Storage.

Contains

* User ID
* Organization ID
* Role
* Session ID
* Token Version
* Issued At
* Expiration

---

# Refresh Tokens

Format

JWT

Purpose

Issue new access tokens.

Lifetime

30 days

Stored

HTTP Only Cookie

Secure Cookie

SameSite=Strict

Rotating refresh tokens are mandatory.

Every refresh invalidates the previous refresh token.

---

# Token Rotation

```text
Login

↓

Access Token A

Refresh Token A

↓

Refresh

↓

Invalidate Refresh Token A

↓

Access Token B

Refresh Token B
```

Old refresh tokens cannot be reused.

Attempted reuse should invalidate the session.

---

# Session Management

Each login creates a unique session.

Session contains

* Session ID
* User ID
* Organization ID
* Device Information
* IP Address
* Last Activity
* Created At
* Expires At

Future versions may expose active sessions to users for session management.

---

# Logout

Logout process

```text
User

↓

Delete Refresh Token

↓

Invalidate Session

↓

Clear Cookies

↓

Client Deletes Access Token
```

Logging out from one device does not automatically terminate other active sessions.

Future support for "Logout All Devices" should be considered.

---

# Invitation Flow

Users cannot self-register.

Organizations invite employees.

Invitation flow

```text
Admin

↓

Invite Employee

↓

Generate Invitation Token

↓

Email Invitation

↓

Employee Accepts

↓

Set Password

↓

Account Activated
```

Invitation tokens

* Single use
* Time limited
* Cryptographically secure

Expired invitations require regeneration.

---

# Password Reset

Flow

```text
Forgot Password

↓

Generate Reset Token

↓

Email Link

↓

Token Validation

↓

New Password

↓

Invalidate Previous Sessions

↓

Login
```

Reset tokens expire after 30 minutes.

Passwords cannot be reused within configurable history (future).

---

# Multi-Tenant Authentication

Every authenticated user belongs to exactly one organization.

Every JWT contains

* userId
* organizationId
* role

Services must verify organization ownership for every protected resource.

Cross-tenant access is prohibited.

---

# Authorization

Talnova uses Role-Based Access Control (RBAC).

Authorization occurs after authentication.

Roles determine allowed actions.

Permissions determine allowed resources.

---

# System Roles

## Organization Owner

Full workspace access.

Capabilities

* Organization management
* User management
* Role management
* Security
* Settings
* All administrative functions

---

## HR Administrator

Capabilities

* Employees
* Journeys
* Assignments
* Analytics
* Knowledge Base

Cannot

* Delete organization
* Transfer ownership

---

## Department Manager

Capabilities

* Team assignments
* Progress tracking
* Department analytics

Limited to assigned departments.

---

## Team Manager

Capabilities

* Direct reports
* Team progress
* Assignment monitoring

Cannot modify organization-wide settings.

---

## Employee

Capabilities

* View assigned journeys
* Complete lessons
* Download resources
* View progress
* Update personal profile

Cannot administer workspace resources.

---

# Permission Model

Permissions follow:

```text
resource:action
```

Examples

```text
employees:read

employees:create

employees:update

employees:delete

journeys:publish

journeys:update

knowledge:create

analytics:view
```

Permissions remain extensible.

---

# Authorization Flow

```text
Request

↓

Authenticate

↓

Extract JWT

↓

Validate Signature

↓

Validate Expiration

↓

Load User

↓

Verify Organization

↓

Verify Role

↓

Verify Permission

↓

Execute Request
```

Authorization failures return HTTP 403.

---

# Protected Routes

Default rule

Every API requires authentication.

Only explicitly public endpoints may bypass authentication.

Examples

Public

* Login
* Forgot Password
* Accept Invitation
* Health Checks

Protected

Everything else.

---

# Token Revocation

Refresh tokens may be revoked when

* User logs out
* Password changes
* Organization disables account
* Security breach
* Session expires

Revoked tokens must never generate new access tokens.

---

# Account Status

Supported account states

* Pending Invitation
* Active
* Suspended
* Disabled
* Archived

Only Active users may authenticate.

---

# Audit Logging

Authentication events should be logged.

Examples

* Login
* Logout
* Failed Login
* Password Reset
* Password Change
* Invitation Accepted
* Role Changed
* Permission Changed
* Session Revoked

Logs should include

* Timestamp
* User ID
* Organization ID
* IP Address
* User Agent
* Request ID

Sensitive values must never be logged.

---

# Rate Limiting

Authentication endpoints require stricter limits.

Example

Login

5 attempts

15 minutes

Forgot Password

3 requests

30 minutes

Invitation Acceptance

10 requests

Hour

General API

100 requests

Minute

Limits remain configurable.

---

# Cookie Security

Refresh token cookies must use

* HttpOnly
* Secure
* SameSite=Strict

JavaScript must never access refresh tokens.

---

# CORS Policy

Allowed origins are configured through environment variables.

Credentials are permitted only for trusted frontend domains.

Wildcard origins are prohibited in production.

---

# Future Enterprise Features

The architecture is designed to support

* Single Sign-On (SSO)
* SCIM provisioning
* Multi-factor Authentication (MFA)
* Passkeys (WebAuthn)
* Device trust
* IP allowlists
* Organization security policies
* Conditional access
* Session dashboards

These features should integrate without redesigning the authentication layer.

---

# Security Constraints

The following rules are mandatory:

* Never store plaintext passwords.
* Never expose password hashes.
* Never trust client-provided roles.
* Always validate JWT signatures.
* Always validate token expiration.
* Always enforce tenant isolation.
* Always authorize after authentication.
* Never expose refresh tokens to JavaScript.
* Rotate refresh tokens on every refresh.
* Invalidate refresh tokens after logout.
* Reject revoked sessions.

---

# AI Development Rules

AI agents contributing to authentication features must follow these rules:

* Implement authentication exactly as specified.
* Do not introduce alternative authentication mechanisms without approval.
* Use Argon2id for password hashing.
* Use JWT for access and refresh tokens.
* Enforce role and tenant validation on every protected request.
* Keep authentication logic centralized within the Auth module.
* Never duplicate authorization logic across controllers.
* Use middleware or dedicated authorization services for permission checks.
* Preserve stateless backend principles.
* Maintain compatibility with future SSO and MFA support.

The authentication architecture defined in this document is the canonical identity and access management specification for the Talnova Onboarding platform.
