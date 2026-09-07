# Talnova Onboarding

# 04 — Project Structure

**Version:** 1.0.0

**Status:** Production Architecture

---

# Purpose

This document defines the official project structure for the Talnova Onboarding backend.

It establishes:

* Directory hierarchy
* Module organization
* File naming conventions
* Dependency rules
* Code ownership
* Layer responsibilities

Every AI agent and developer must follow this structure.

No alternative structures may be introduced without updating this document.

---

# Architectural Philosophy

The backend uses a **Feature-Based Modular Architecture**.

The project is **not** organized using classic MVC.

Instead, every business feature owns its complete implementation.

Each feature contains:

* Routes
* Controllers
* Services
* Models
* Validation
* DTOs
* Types
* Business logic

This minimizes coupling and maximizes maintainability.

---

# Root Directory Structure

The backend application is isolated inside a dedicated `server/` subdirectory under the repository root.

```text
server/

├── scripts/
├── src/
├── tests/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
├── README.md
└── ecosystem.config.js
```

---

# Source Directory

```text
server/src/

├── app/
├── bootstrap/
├── common/
├── config/
├── database/
├── middleware/
├── plugins/
├── modules/
├── shared/
├── types/
├── utils/
├── jobs/
├── server.ts
└── app.ts
```

---

# app/

Contains application startup logic.

Responsibilities:

* Create Fastify instance
* Register plugins
* Register middleware
* Register routes
* Initialize services

Contains no business logic.

---

# bootstrap/

Responsible for application initialization.

Examples:

* Database connection
* Environment validation
* Plugin registration
* Graceful shutdown
* Health initialization

---

# common/

Shared infrastructure used across all modules.

Examples:

```text
common/

errors/

constants/

responses/

exceptions/

decorators/

enums/

interfaces/

validators/

permissions/
```

Nothing inside common should depend on business modules.

---

# config/

Application configuration.

```text
config/

app.config.ts

database.config.ts

jwt.config.ts

storage.config.ts

cors.config.ts

logger.config.ts

swagger.config.ts
```

Configuration is read from environment variables.

Never hardcode secrets.

---

# database/

Database infrastructure.

Contains:

```text
database/

connection.ts

mongoose.ts

indexes/

plugins/

migrations/ (future)

seeders/ (development only)
```

Business models belong inside feature modules, not here.

---

# middleware/

Global middleware.

Examples:

```text
auth.middleware.ts

permission.middleware.ts

error.middleware.ts

request-id.middleware.ts

logging.middleware.ts
```

Middleware should remain lightweight.

No business logic.

---

# plugins/

Fastify plugins.

Examples:

```text
jwt.ts

helmet.ts

cors.ts

multipart.ts

swagger.ts

cookie.ts

compress.ts
```

Plugins are registered during bootstrap.

---

# shared/

Cross-feature reusable components.

Examples:

```text
shared/

storage/

email/

notifications/

pagination/

search/

audit/

analytics/
```

Shared components should remain generic.

---

# types/

Global TypeScript types.

Examples:

```text
api.ts

pagination.ts

jwt.ts

request.ts

response.ts
```

Business-specific types belong inside feature modules.

---

# utils/

Pure utility functions.

Examples:

```text
slug.ts

date.ts

crypto.ts

pagination.ts

validation.ts

files.ts
```

Utilities must be stateless.

---

# jobs/

Scheduled jobs.

Examples:

```text
send-reminders.job.ts

certificate-expiration.job.ts

cleanup.job.ts

analytics.job.ts
```

Jobs should call services.

Never duplicate business logic.

---

# Modules

Every business capability lives inside:

```text
server/src/modules/
```

Example

```text
modules/

auth/

organizations/

employees/

departments/

teams/

journeys/

courses/

modules/

lessons/

quizzes/

assignments/

progress/

knowledge-base/

uploads/

notifications/

analytics/

reports/

search/

settings/

audit/
```

Each module is isolated.

---

# Standard Module Structure

Every module must follow this layout.

```text
employees/

controllers/

services/

repositories/

models/

routes/

schemas/

dto/

types/

interfaces/

constants/

utils/

employees.module.ts

index.ts
```

---

# controllers/

Responsibilities

* Receive HTTP requests
* Validate input (if not handled globally)
* Call services
* Return standardized responses

Controllers must never contain business rules.

---

# services/

Contains business logic.

Responsibilities:

* Validation beyond schema rules
* Authorization decisions
* Database interaction
* Cross-module coordination
* Transactions (where applicable)

Services are the heart of the application.

---

# repositories/

Responsible for database access.

Responsibilities:

* Queries
* Aggregations
* Pagination
* Bulk operations

Repositories should never contain business logic.

Services communicate with repositories.

---

# models/

Contains Mongoose schemas.

One schema per file.

Naming:

```text
employee.model.ts

organization.model.ts

journey.model.ts
```

---

# routes/

Defines HTTP routes.

Only route definitions belong here.

No logic.

---

# schemas/

Contains Zod validation schemas.

Examples:

```text
create-employee.schema.ts

update-employee.schema.ts

search-employee.schema.ts
```

Validation should be reusable.

---

# dto/

Data Transfer Objects.

Maps request and response payloads.

Keeps API contracts stable.

---

# types/

Module-specific TypeScript types.

---

# interfaces/

Internal contracts.

Used for dependency inversion where appropriate.

---

# constants/

Feature-specific constants.

Examples:

```text
roles.ts

statuses.ts

permissions.ts
```

---

# utils/

Module-specific helpers.

Avoid using global utils unless functionality is generic.

---

# Naming Conventions

Directories

kebab-case

```text
knowledge-base

background-jobs
```

Files

kebab-case

```text
create-user.service.ts

update-course.schema.ts

upload-file.controller.ts
```

Classes

PascalCase

Variables

camelCase

Constants

UPPER_SNAKE_CASE

Environment variables

UPPER_SNAKE_CASE

---

# Import Rules

Import order:

1. Node modules
2. Third-party packages
3. Internal aliases
4. Relative imports

Prefer path aliases:

```text
@/modules

@/shared

@/common

@/config

@/database
```

Avoid deeply nested relative imports.

---

# Dependency Rules

Modules may depend on:

* Common
* Shared
* Config
* Database

Modules must not directly depend on unrelated modules unless explicitly required through service interfaces.

Avoid circular dependencies.

---

# Response Standardization

Every controller returns:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

Errors follow the global error specification.

Controllers should never manually build inconsistent responses.

---

# File Size Guidelines

Recommended maximum sizes:

| File Type  | Target     |
| ---------- | ---------- |
| Controller | ≤200 lines |
| Service    | ≤500 lines |
| Repository | ≤300 lines |
| Model      | ≤250 lines |
| Route      | ≤150 lines |
| Schema     | ≤250 lines |

Large services should be split into smaller domain services.

---

# AI Development Rules

AI agents must follow these rules:

* Create new code inside the appropriate module.
* Never place business logic in controllers or routes.
* Reuse existing services before creating new ones.
* Do not duplicate validation schemas.
* Do not create utility functions if an equivalent already exists.
* Respect module boundaries.
* Use path aliases instead of deep relative imports.
* Maintain consistent naming conventions.
* Export only what is required.
* Keep modules cohesive and loosely coupled.

Any generated code that violates this project structure should be refactored before merging.

---

# Future Growth

The project structure is designed to support:

* Hundreds of feature modules.
* Multiple development teams.
* AI-assisted code generation.
* Independent module testing.
* Horizontal scaling.
* Long-term maintainability.

The directory hierarchy defined in this document is considered part of the platform architecture and should remain stable throughout the project's lifecycle.
