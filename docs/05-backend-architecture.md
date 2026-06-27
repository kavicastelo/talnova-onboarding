# Talnova Onboarding

# 05 — Backend Architecture

**Version:** 1.0.0

**Status:** Production Architecture

---

# Purpose

This document defines the internal backend architecture for the Talnova Onboarding platform.

It specifies:

* Application layers
* Request lifecycle
* Module interaction
* Dependency flow
* Service responsibilities
* Repository responsibilities
* Cross-cutting concerns

Every backend feature must follow this architecture.

---

# Architectural Style

Talnova uses a **Layered Modular Architecture**.

The backend is organized by business capabilities (features) while maintaining clear separation of responsibilities.

The application is intentionally **not** built using:

* Classic MVC
* Domain-Driven Design (full tactical DDD)
* Clean Architecture with excessive abstraction
* Hexagonal architecture

Instead, it adopts a pragmatic structure optimized for:

* TypeScript
* Fastify
* MongoDB
* AI-assisted development
* Long-term maintainability

---

# Core Principles

The backend follows these principles:

* Feature-first organization
* Stateless application server
* Thin controllers
* Rich services
* Lightweight repositories
* Explicit validation
* Strong typing
* Dependency direction toward infrastructure
* No duplicated business logic
* Predictable request lifecycle

---

# Request Lifecycle

Every HTTP request follows the same flow.

```text
Client

↓

Fastify Route

↓

Middleware

↓

Authentication

↓

Authorization

↓

Request Validation (Zod)

↓

Controller

↓

Service

↓

Repository

↓

MongoDB Atlas

↓

Repository

↓

Service

↓

Controller

↓

Standard API Response

↓

Client
```

No step should be skipped.

---

# Layer Responsibilities

## Routes

Responsibilities:

* Register endpoints
* Define HTTP methods
* Attach middleware
* Attach validation
* Connect controllers

Routes contain **no business logic**.

---

## Middleware

Global request processing.

Examples:

* Authentication
* Authorization
* Logging
* Rate limiting
* Request ID
* Error handling

Middleware should remain stateless.

---

## Validation Layer

Validation occurs before controllers.

Every request validates:

* Route parameters
* Query parameters
* Body
* Headers (where required)

Validation uses Zod exclusively.

Controllers should never manually validate payloads.

---

## Controllers

Controllers translate HTTP into application calls.

Responsibilities:

* Receive validated input
* Invoke services
* Return standardized responses
* Set HTTP status codes

Controllers must never:

* Access MongoDB
* Perform business logic
* Call external services directly
* Contain authorization rules

Controllers should remain thin.

---

## Services

Services contain business rules.

Responsibilities include:

* Business validation
* Permission checks
* Workflow orchestration
* Cross-module coordination
* Calling repositories
* Calling shared services
* Publishing domain events (future)
* File upload orchestration
* Analytics updates

Services are the heart of the application.

If a rule affects business behavior, it belongs here.

---

## Repositories

Repositories encapsulate persistence.

Responsibilities:

* CRUD operations
* Aggregation pipelines
* Pagination
* Filtering
* Sorting
* Bulk operations

Repositories must never:

* Perform authorization
* Send notifications
* Execute workflows
* Contain business rules

Repositories communicate only with MongoDB.

---

## Models

Models define MongoDB collections.

Responsibilities:

* Mongoose schemas
* Indexes
* Default values
* Virtual fields
* Schema middleware

Models should not contain business workflows.

---

## Shared Services

Some services span multiple modules.

Examples:

* File Storage
* Email
* Notifications
* Audit Logging
* Search
* Analytics

Shared services expose reusable APIs to feature modules.

---

# Dependency Direction

Dependencies always flow inward.

```text
Route

↓

Controller

↓

Service

↓

Repository

↓

Database
```

Controllers never call repositories directly.

Routes never call services.

Repositories never call controllers.

Business logic never exists in routes.

---

# Module Communication

Modules communicate through services.

Example:

```text
Assignments Service

↓

Employee Service

↓

Notification Service
```

Direct access to another module's repository is prohibited.

If a module needs information from another module, it should consume that module's public service interface.

---

# Cross-Cutting Services

The following concerns are shared across all modules:

* Authentication
* Authorization
* Audit Logging
* File Storage
* Notifications
* Search
* Pagination
* Error Handling
* Logging
* Configuration

These capabilities belong in `shared/` or `common/`, not inside feature modules.

---

# Error Handling

All errors must pass through a centralized error handler.

Error categories include:

* Validation
* Authentication
* Authorization
* Resource Not Found
* Conflict
* Rate Limited
* External Service Failure
* Internal Server Error

Every error response follows the standardized API envelope.

Services throw typed application errors.

Controllers do not construct error responses manually.

---

# Transactions

MongoDB multi-document transactions should be used only when required.

Examples:

* Creating an organization and its owner.
* Bulk employee imports.
* Assignment creation affecting multiple collections.

Avoid unnecessary transactions.

Prefer designing operations around aggregate boundaries.

---

# File Upload Workflow

File uploads follow this sequence:

```text
Client

↓

Validation

↓

Upload Service

↓

Cloudflare R2

↓

MongoDB Metadata

↓

Response
```

Business modules never communicate with Cloudflare R2 directly.

Only the shared Upload Service handles object storage.

---

# Background Processing

Long-running tasks must not block HTTP requests.

Examples:

* Email delivery
* Report generation
* Thumbnail creation
* Reminder processing
* Analytics aggregation

Initial implementation may use scheduled jobs.

Future implementations should migrate these tasks to BullMQ workers without changing module APIs.

---

# Caching Strategy

The application must operate correctly without caching.

When Redis is introduced, it should cache:

* Frequently requested reference data.
* Computed analytics.
* Session metadata.
* Temporary tokens.

Business logic must never depend on cache availability.

---

# Logging Strategy

Every request should receive a unique Request ID.

Logs should include:

* Timestamp
* Request ID
* User ID (if authenticated)
* Organization ID
* Route
* HTTP method
* Status code
* Response time

Services may log business events when appropriate.

Sensitive information must never be logged.

---

# Authorization

Authorization occurs after authentication.

Role-Based Access Control (RBAC) governs access to protected resources.

Every service must verify that the authenticated user belongs to the organization that owns the requested resource.

Tenant isolation is enforced in the service layer for every database query.

---

# Multi-Tenant Data Isolation

All tenant-owned documents include an `organizationId`.

Repositories must always scope queries by `organizationId` unless the collection is global.

No query should return data across organizations.

Cross-tenant access is considered a critical security violation.

---

# Event Readiness

Although the initial implementation is synchronous, the architecture should remain ready for future event-driven enhancements.

Examples of future events:

* EmployeeInvited
* JourneyAssigned
* LessonCompleted
* CoursePublished
* CertificateIssued

When introduced, events should augment—not replace—the existing service layer.

---

# API Versioning

All endpoints are versioned.

Example:

```text
/api/v1/...
```

Breaking changes require a new version.

Minor enhancements should remain backward compatible.

---

# Performance Guidelines

Services should minimize database round trips.

Repositories should use projections and indexes to avoid over-fetching.

Controllers should avoid expensive transformations.

Heavy calculations should be delegated to background processing where possible.

---

# Testing Strategy

Each layer has distinct testing responsibilities:

| Layer           | Test Type          |
| --------------- | ------------------ |
| Routes          | Integration        |
| Controllers     | Integration        |
| Services        | Unit               |
| Repositories    | Integration        |
| Shared Services | Unit + Integration |

Business logic should be testable independently of HTTP and MongoDB.

---

# Architectural Constraints

The following rules are mandatory:

* Controllers must never access Mongoose models directly.
* Repositories must never contain business rules.
* Services must never return HTTP responses.
* Middleware must remain stateless.
* Validation must occur before controllers.
* Shared services must remain generic.
* Modules must communicate only through public service interfaces.
* Every database query must respect tenant boundaries.
* Business logic must be implemented once and reused.

---

# AI Development Rules

AI coding agents contributing to the backend must follow these architectural rules:

* Preserve the defined request lifecycle.
* Keep controllers thin.
* Centralize business rules in services.
* Reuse repositories rather than duplicating queries.
* Do not bypass validation.
* Respect module boundaries.
* Avoid circular dependencies.
* Do not access Cloudflare R2 outside the Upload Service.
* Do not access MongoDB outside repositories.
* Maintain strict TypeScript typing.
* Prefer composition over inheritance.
* Generate predictable, readable, and testable code.

Any implementation that violates these architectural rules should be considered incorrect, even if it functions.

---

# Architecture Evolution

This backend architecture is intentionally designed to evolve without structural changes.

Future capabilities—including Redis caching, BullMQ workers, WebSocket notifications, SCIM provisioning, SSO, AI-powered assistants, and additional integrations—should integrate into the existing layers rather than introducing new architectural patterns.

The architecture defined in this document is the canonical backend blueprint for the Talnova Onboarding platform.
