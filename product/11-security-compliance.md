# 11 — Security & Compliance

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative Security Architecture Specification  
> **Module Namespace:** System Core

---

## 1. Security Architecture Overview

The Talnova Onboarding platform employs a defense-in-depth security model designed to safeguard sensitive enterprise employee data, legal e-signature documents, and corporate knowledge base intellectual property.

```text
+------------------------------------------------------------------------------------+
|                                DEFENSE IN DEPTH                                    |
|                                                                                    |
|  [Edge & Network]    --> Cloudflare WAF, TLS 1.3 Encryption, DDoS Mitigation      |
|  [Gateway]           --> Fastify Helm Headers, Rate Limiting, CORS Policy          |
|  [Auth Layer]        --> Argon2 Password Hash, JWT Bearer Tokens, SAML 2.0 / OIDC  |
|  [Tenant Isolation]  --> Mandatory organizationId Scoping at Service Layer        |
|  [App Logic & RBAC]  --> Role Decorators (owner, admin, manager, employee)         |
|  [Data & Storage]    --> MongoDB Atlas Encryption at Rest, S3 Presigned URLs       |
|  [Compliance Audit]  --> Cryptographic E-Sign Audit Trail, System Audit Logs       |
+------------------------------------------------------------------------------------+
```

---

## 2. Security Controls & Specifications

### 2.1 Authentication & Session Management
- **Password Hashing:** Passwords hashed using `Argon2id` algorithm with minimum salt length of 16 bytes, memory cost of 65,536 KB, and 3 iterations.
- **JWT Authentication:** Short-lived JSON Web Tokens (15-minute expiration) signed with RSA-256 / HS256 secret keys. Tokens contain `userId`, `organizationId`, `role`, and `email`.
- **Refresh Tokens:** Long-lived refresh tokens (7-day expiration) stored in `HttpOnly`, `SameSite=Strict`, `Secure` cookies to prevent XSS cookie theft.
- **Enterprise SSO:** SAML 2.0 and OpenID Connect (OIDC) support for enterprise Single Sign-On with X.509 signature verification.

### 2.2 Multi-Tenant Data Isolation
- **Service Layer Enforcement:** Database queries must include `organizationId` matching the caller's JWT payload.
- **Zero Cross-Tenant Leakage:** Service methods reject requests where entity tenant ID differs from caller tenant ID.
- **Automated Isolation Auditing:** Automated unit/integration tests (`Vitest`) continuously verify tenant boundary enforcement across all 25 backend modules.

### 2.3 Cryptographic Public Kiosk Security
- **Signed Public URLs:** Unauthenticated public kiosk URLs rely on HMAC SHA-256 cryptographic signatures containing expiration timestamps (`t`), tenant parameters (`o`), device IDs (`d`), and signature hashes (`sig`).
- **Signature Validation Logic:**
  $$\text{sig} = \text{HMAC-SHA256}(\text{kioskSecret}, \text{journeyId} + "|" + \text{tenantId} + "|" + \text{timestamp})$$
- **Device Hardware Fingerprinting:** Physical terminal kiosks register using 6-digit PIN codes; registered devices authenticate via hardware-bound device JWTs.

### 2.4 E-Signature Audit Trail Cryptography
- **Legal Compliance:** Complies with ESIGN Act and eIDAS electronic signature standards.
- **Cryptographic Audit Log:** Executed e-signatures produce a signed PDF containing an embedded audit summary page detailing:
  - Signee Full Name & Email Address
  - Unique Document UUID & Organization Tenant ID
  - Signee Public IP Address & Web Browser User Agent
  - UTC Sign Date & Time Timestamp
  - SHA-256 Binary PDF Checksum Hash: `SHA256(PDFBytes + SignatureBytes)`

### 2.5 OWASP Protection Controls
- **Input Validation & Sanitization:** All incoming REST API request body payloads, headers, and query parameters validated against strict `Zod` schemas before reaching business service layers.
- **Injection Prevention:** MongoDB query operators sanitized via Mongoose 8.x schema validation to prevent NoSQL injection attacks.
- **HTTP Security Headers:** Fastify application uses `@fastify/helm` to configure Strict-Transport-Security (HSTS), Content-Security-Policy (CSP), X-Frame-Options (DENY), and X-Content-Type-Options (nosniff).
- **Rate Limiting:** Rate limiting configured via `@fastify/rate-limit` (100 requests per minute per IP address on public endpoints; 10 requests per minute on login/auth routes).

---

## 3. Compliance & Auditability

### 3.1 Audit Logging (`auditlogs` Collection)
- System records immutable audit logs for security-relevant operations:
  - User login / authentication events (Success, Failure, Lockout)
  - Role modifications and user privilege escalation
  - Journey publishing and deletion
  - Document template modifications and e-signature executions
  - SSO configuration changes
  - Kiosk device pairing and remote actions

### 3.2 Data Retention & Privacy
- Sensitive Personal Identifiable Information (PII) encrypted at rest in MongoDB Atlas via AES-256.
- Inactive user data soft-deleted and archived in accordance with corporate data retention policies.
