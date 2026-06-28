# Talnova Onboarding — Backend Implementation Plan

This document defines the implementation order, dependency structure, milestones, and complexities for building the backend application.

---

## 1. Dependency Graph

```mermaid
flowchart TD
    M1[Milestone 1: Foundations] --> M2[Milestone 2: Security & Auth]
    M2 --> M3[Milestone 3: Core Workspace]
    M3 --> M4[Milestone 4: Learning Engine]
    M4 --> M5[Milestone 5: Knowledge & Media]
    M5 --> M6[Milestone 6: System Ops & QA]

    subgraph Foundations
        1[1. Project Init] --> 2[2. Env Config]
        2 --> 3[3. Config System]
        3 --> 4[4. Logger]
        4 --> 5[5. Fastify Bootstrap]
        5 --> 6[6. Plugin Reg]
        6 --> 7[7. MongoDB Connection]
        7 --> 8[8. Global Middleware]
        8 --> 9[9. Error Handler]
        9 --> 10[10. Validation]
    end

    subgraph Security & Auth
        10 --> 11[11. Authentication]
        11 --> 12[12. Authorization]
    end

    subgraph Core Workspace
        12 --> 13[13. Organization Module]
        13 --> 14[14. User Module]
        14 --> 15[15. Employee Module]
    end

    subgraph Learning Engine
        15 --> 16[16. Journey Module]
        16 --> 17[17. Assignment Module]
    end

    subgraph Knowledge & Media
        17 --> 18[18. Knowledge Base]
        17 --> 19[19. Uploads]
        17 --> 20[20. Notifications]
    end

    subgraph System Ops & QA
        18 & 19 & 20 --> 21[21. Audit Logs]
        21 --> 22[22. Health Endpoints]
        22 --> 23[23. Swagger Docs]
        23 --> 24[24. Testing Suite]
        24 --> 25[25. Production Optimization]
    end
```

---

## 2. Implementation Milestones

### Milestone 1: Foundations (Complexity: Low) [COMPLETED]
Prerequisites: Node 22 runtime, MongoDB Atlas sandbox database instance.

1. **[x] Project Initialization**
   * Setup npm workspace, `package.json`, TypeScript config (`tsconfig.json`), ESLint, and Prettier configurations.
   * Target Complexity: Very Low (1 hour)
2. **[x] Environment Configuration**
   * Define `.env.example`, bootstrap `.env` loader.
   * Target Complexity: Very Low (0.5 hours)
3. **[x] Configuration System**
   * Build strongly-typed configuration module (`server/src/config/`) reading from env.
   * Target Complexity: Low (1 hour)
4. **[x] Logger**
   * Configure Pino logger options for development (pretty print) and production (JSON stream).
   * Target Complexity: Low (1 hour)
5. **[x] Fastify Bootstrap**
   * Build core Fastify instance lifecycle hooks and startup script (`server/src/app.ts`, `server/src/server.ts`).
   * Target Complexity: Low (2 hours)
6. **[x] Plugin Registration**
   * Register Fastify standard plugins (Helmet, CORS, Cookie, Compress).
   * Target Complexity: Low (1 hour)
7. **[x] MongoDB Connection**
   * Initialize Mongoose connection management, reconnection strategies, and graceful shutdown handlers.
   * Target Complexity: Low (2 hours)
8. **[x] Global Middleware**
   * Setup request-id injection, request duration logging, and context hooks.
   * Target Complexity: Low (2 hours)
9. **[x] Error Handler**
   * Build centralized Fastify error handler to format standard error responses and log internal details.
   * Target Complexity: Medium (3 hours)
10. **[x] Validation**
    * Map custom Zod Fastify validation compiler and parser for incoming request bodies, params, and queries.
    * Target Complexity: Medium (3 hours)

---

### Milestone 2: Security & Authentication (Complexity: Medium) [COMPLETED]
Prerequisites: Milestone 1 complete.

11. **[x] Authentication**
    * Build `auth` module routes, handlers, and services.
    * Set up Argon2id password hashing.
    * Implement access token and rotating refresh token generation.
    * Set up session management and cookie options.
    * Target Complexity: High (8 hours)
12. **[x] Authorization**
    * Enforce RBAC middlewares and user decorators.
    * Implement token validation hooks on protected routes.
    * Target Complexity: Medium (4 hours)

---

### Milestone 3: Core Workspace (Complexity: Medium) [COMPLETED]
Prerequisites: Milestone 2 complete.

13. **[x] Organization Module**
    * Implement Mongoose schema, repository, service, and routes.
    * Handle default branding, locations, and organization profile.
    * Target Complexity: Medium (5 hours)
14. **[x] User Module**
    * Implement profiles, user settings, password reset flows, and settings.
    * Target Complexity: Medium (4 hours)
15. **[x] Employee Module**
    * Implement invitation system, directory listing, and department/team structures.
    * Target Complexity: Medium (6 hours)

---

### Milestone 4: Learning Engine (Complexity: High) [COMPLETED]
Prerequisites: Milestone 3 complete.

16. **[x] Journey Module**
    * Build Journey Builder routes, schemas, and nested models (Modules, Lessons, ContentBlocks, Quizzes).
    * Implement publishing workflows (Draft, Publish, Archive) and optimistic versioning.
    * Target Complexity: Very High (12 hours)
17. **[x] Assignment Module**
    * Track employee journey assignments, progress percentages, time tracking, and completion evaluations.
    * Evaluate quiz submission attempts.
    * Target Complexity: High (10 hours)

---

### Milestone 5: Knowledge & Media (Complexity: Medium) [COMPLETED]
Prerequisites: Milestone 4 complete.

18. **[x] Knowledge Base**
    * Build KB Articles Mongoose schema, full-text search, and department/team visibility checks.
    * Target Complexity: Medium (6 hours)
19. **[x] Uploads**
    * Integrate Cloudflare R2 bucket connection.
    * Build upload metadata tracker database schema, upload endpoint, and visibility controls.
    * Target Complexity: Medium (6 hours)
20. **[x] Notifications**
    * Setup In-app, Email event channels, TTL expiration indexes, and read status modifiers.
    * Target Complexity: Medium (5 hours)

---

### Milestone 6: System Ops & QA (Complexity: Medium) [COMPLETED]
Prerequisites: Milestone 5 complete.

21. **[x] Audit Logs**
    * Implement immutable audit log recording service and resource historical tracking.
    * Target Complexity: Medium (4 hours)
22. **[x] Health Endpoints**
    * Implement public unauthenticated `/health`, `/ready`, `/live` hooks checking DB and storage states.
    * Target Complexity: Low (2 hours)
23. **[x] Swagger Docs**
    * Setup `@fastify/swagger` and `@fastify/swagger-ui` auto-generation.
    * Target Complexity: Low (2 hours)
24. **[x] Testing Suite**
    * Setup Vitest and build integration tests for critical authentication, organization isolation, and learning progression routes.
    * Target Complexity: High (10 hours)
25. **[x] Production Optimization**
    * Prepare PM2 configuration reload commands, compression tuning, and environment variable audits.
    * Target Complexity: Low (3 hours)
