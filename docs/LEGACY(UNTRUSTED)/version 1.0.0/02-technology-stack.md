# Talnova Onboarding

# 02 — Technology Stack

**Version:** 1.0.0

**Status:** Production Architecture

---

# Purpose

This document defines the official technology stack for the Talnova Onboarding platform.

Every backend component, infrastructure service, development tool, and third-party dependency must follow this specification.

Alternative libraries should **not** be introduced unless this document is updated.

Consistency is preferred over personal preference.

---

# Engineering Philosophy

The technology stack has been selected based on the following priorities:

* Simplicity
* Maintainability
* Performance
* Type Safety
* Scalability
* Cloud-native architecture
* AI-assisted development
* Enterprise reliability
* Low operational overhead

Every technology should have one clear responsibility.

---

# Backend Stack

| Layer             | Technology                       |
| ----------------- | -------------------------------- |
| Runtime           | Node.js 22 LTS                   |
| Language          | TypeScript                       |
| Framework         | Fastify                          |
| Package Manager   | npm                              |
| Module System     | ES Modules                       |
| API Style         | REST                             |
| API Format        | JSON                             |
| Validation        | Zod                              |
| Authentication    | JWT + Refresh Tokens             |
| Authorization     | Role-Based Access Control (RBAC) |
| Password Hashing  | Argon2id                         |
| Logging           | Pino                             |
| API Documentation | OpenAPI 3.1 + Swagger            |
| Environment       | dotenv                           |
| File Upload       | @fastify/multipart               |
| Background Jobs   | BullMQ (Future)                  |
| Scheduler         | node-cron (initially)            |
| Process Manager   | PM2                              |
| Reverse Proxy     | Nginx                            |

---

# Frontend Stack

| Layer            | Technology      |
| ---------------- | --------------- |
| Framework        | React 19        |
| Build Tool       | Vite            |
| Language         | TypeScript      |
| Styling          | Tailwind CSS    |
| Components       | shadcn/ui       |
| Routing          | React Router    |
| State Management | TanStack Query  |
| Forms            | React Hook Form |
| Validation       | Zod             |
| Icons            | Lucide React    |
| Charts           | Recharts        |
| HTTP Client      | Axios           |
| Animations       | Framer Motion   |
| Notifications    | Sonner          |

The frontend consumes REST APIs exclusively.

No direct database access is permitted.

---

# Database Stack

## Primary Database

MongoDB Atlas

Reasons:

* Managed infrastructure
* Automatic backups
* Horizontal scalability
* Global availability
* Flexible document model
* Excellent TypeScript ecosystem
* High availability

---

## ODM

Mongoose

Reasons:

* Mature ecosystem
* Schema validation
* Middleware support
* Population
* Index management
* TypeScript support
* Stable production usage

Collections must always use Mongoose schemas.

No direct MongoDB driver usage inside business modules unless justified.

---

# Object Storage

## Cloudflare R2

Used for:

* Videos
* Images
* Audio
* PDF
* Office Documents
* Employee avatars
* Organization logos
* Course thumbnails
* Certificates

The backend stores only metadata.

Binary files are never stored in MongoDB.

---

# Caching

## Initial Phase

No Redis.

The application should remain fully functional without a cache.

---

## Future Phase

Redis

Responsibilities:

* Session cache
* Rate limiting
* Temporary verification codes
* Frequently accessed queries
* Background job queues

Redis must never become the primary data source.

---

# Background Processing

Initial Version

No queue workers.

Simple scheduled jobs use:

node-cron

Examples:

* Reminder emails
* Deadline checks
* Certificate expiration
* Cleanup tasks

---

Future Version

BullMQ

Examples:

* Email delivery
* Analytics processing
* Thumbnail generation
* Bulk imports
* Report exports
* Notification processing

---

# Authentication Stack

Access Tokens

JWT

Lifetime:

15 minutes

Refresh Tokens

JWT

Lifetime:

30 days

Storage

HTTP-only Secure Cookies

Authentication Flow

Access Token

↓

Expired

↓

Refresh Token

↓

Issue New Access Token

↓

Continue Session

Passwords are hashed using Argon2id.

Passwords are never logged or returned.

---

# API Validation

All incoming requests must be validated using Zod.

Validation occurs before reaching controllers.

Validation includes:

* Body
* Query parameters
* Route parameters
* Headers (when required)

Invalid requests return standardized validation errors.

---

# API Documentation

Swagger

Generated automatically from OpenAPI definitions.

Documentation should always reflect the current implementation.

Manual API documentation is prohibited.

---

# Logging

Official logger:

Pino

Development

* Pretty logs
* Colored output

Production

* Structured JSON
* Log aggregation ready

Never use:

console.log()

inside production code.

---

# Configuration

All configuration is environment-driven.

Examples:

```env
NODE_ENV=
PORT=

API_PREFIX=

JWT_SECRET=
JWT_REFRESH_SECRET=

ACCESS_TOKEN_EXPIRES=
REFRESH_TOKEN_EXPIRES=

MONGODB_URI=

R2_ENDPOINT=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

CORS_ORIGIN=

LOG_LEVEL=
```

Secrets must never be committed to Git.

---

# Web Server

Nginx

Responsibilities

* HTTPS
* SSL termination
* Reverse proxy
* Compression
* Static assets
* Security headers

Nginx should never contain business logic.

---

# Process Management

PM2

Responsibilities

* Auto restart
* Process monitoring
* Startup scripts
* Log management
* Graceful reload

Deployment should not rely on running Node directly.

---

# Development Tools

| Tool               | Purpose             |
| ------------------ | ------------------- |
| ESLint             | Static analysis     |
| Prettier           | Code formatting     |
| Husky              | Git hooks           |
| lint-staged        | Pre-commit checks   |
| tsx                | Development runtime |
| Nodemon (optional) | File watching       |

Every commit should pass:

* Lint
* Type checking
* Formatting

---

# Testing Stack

Unit Testing

Vitest

API Testing

Supertest

Integration Testing

Vitest

End-to-End Testing (Future)

Playwright

Production code must remain testable.

Business logic should be isolated from HTTP layers.

---

# Monitoring

Initial

* PM2 monitoring
* Server logs

Future

* Uptime monitoring
* Error tracking
* Performance metrics
* Health dashboards

Application health endpoints:

```text
GET /health

GET /ready

GET /live
```

---

# Security Libraries

| Purpose           | Technology          |
| ----------------- | ------------------- |
| Security Headers  | @fastify/helmet     |
| CORS              | @fastify/cors       |
| Rate Limiting     | @fastify/rate-limit |
| Multipart Uploads | @fastify/multipart  |
| JWT               | @fastify/jwt        |
| Cookies           | @fastify/cookie     |
| Compression       | @fastify/compress   |

---

# File Upload Strategy

Upload Flow

```text
Client

↓

Fastify

↓

Validation

↓

Cloudflare R2

↓

Store Metadata

↓

MongoDB

↓

Return Public File URL
```

Uploads larger than configured limits should be rejected before processing.

Accepted MIME types must be validated on the server.

---

# Dependency Management Rules

Every dependency must satisfy the following:

* Actively maintained
* TypeScript support
* Production-ready
* Good documentation
* Large community adoption
* Compatible with Fastify
* MIT, Apache 2.0, or similarly permissive license

Avoid introducing multiple libraries that solve the same problem.

---

# Technologies Explicitly Excluded

The following technologies are intentionally excluded from this project unless a future architecture revision approves them:

* Express.js
* NestJS
* Spring Boot
* Prisma
* Sequelize
* TypeORM
* GraphQL
* Firebase
* Supabase
* MySQL
* PostgreSQL
* SQLite
* Socket.IO (initial release)
* RabbitMQ
* Kafka
* Docker (initial deployment)
* Kubernetes
* Serverless functions

These technologies may be evaluated in future versions but are not part of the current architecture.

---

# Versioning Policy

Technology upgrades must follow:

* Prefer Long-Term Support (LTS) releases.
* Avoid adopting newly released major versions in production until they are proven stable.
* Review dependencies regularly for security updates.
* Remove deprecated packages promptly.

---

# AI Development Rules

All AI coding agents contributing to this project must adhere to the following:

* Use only the technologies defined in this document.
* Do not introduce alternative frameworks or libraries without explicit approval.
* Prefer official libraries over community-maintained alternatives.
* Follow feature-based architecture.
* Maintain strict TypeScript typing.
* Avoid unnecessary dependencies.
* Keep the dependency graph minimal.
* Ensure all generated code is compatible with the approved stack.

Any deviation from this technology stack requires an update to this document before implementation.
