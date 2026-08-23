# Talnova Onboarding

# 01 — System Overview

**Version:** 1.0.0

**Status:** Production Architecture

---

# Purpose

This document defines the overall architecture, product vision, engineering principles, and system boundaries for the Talnova Onboarding platform.

It serves as the foundation for every backend, frontend, infrastructure, and DevOps decision throughout the project.

All subsequent architecture documents should comply with the principles defined here.

---

# Product Overview

Talnova Onboarding is a modern B2B SaaS platform that enables organizations to build, manage, deliver, and monitor employee onboarding and internal training programs.

Unlike public Learning Management Systems (LMS), Talnova is designed exclusively for private organizational workspaces where employees receive structured learning journeys assigned by administrators, HR teams, and managers.

The platform combines:

* Employee onboarding
* Internal learning management
* Corporate knowledge base
* Compliance training
* Employee progress tracking
* Organizational analytics

into a single enterprise application.

Talnova is **not** a marketplace.

Talnova does **not** sell courses publicly.

Organizations own their workspace and manage all users, content, permissions, and learning resources internally.

---

# Vision

Build the simplest, fastest, and most intuitive employee onboarding platform for modern organizations.

The platform should feel as polished and easy to use as consumer software while providing the security, scalability, and administrative controls expected from enterprise software.

---

# Product Goals

The platform should enable organizations to:

* Create structured onboarding journeys.
* Create reusable learning content.
* Upload multimedia learning resources.
* Train employees consistently.
* Assign learning automatically.
* Monitor employee progress.
* Track compliance completion.
* Build internal documentation.
* Generate management reports.
* Scale across multiple departments.

---

# Primary Users

## Organization Owner

Owns the organization workspace.

Responsible for:

* Organization settings
* Billing (future)
* Administrators
* Security
* Branding
* Workspace management

---

## HR Administrator

Responsible for:

* Employee onboarding
* User invitations
* Assigning journeys
* Monitoring completion
* Employee management

---

## Department Manager

Responsible for:

* Department-specific onboarding
* Team progress
* Employee completion
* Department analytics

---

## Team Manager

Responsible for:

* Direct reports
* Team assignments
* Progress monitoring

---

## Employee

Consumes assigned learning content.

Can:

* Complete onboarding
* View progress
* Download resources
* Complete quizzes
* Read documentation
* Earn certificates (future)

---

# Core Features

## Authentication

* Secure login
* JWT authentication
* Refresh tokens
* Session management
* Password reset
* Invitation acceptance

---

## Organization Management

* Organization profile
* Departments
* Teams
* Employee directory
* Roles
* Permissions

---

## Journey Builder

Organizations can build complete onboarding journeys consisting of:

* Modules
* Lessons
* Assessments
* Tasks
* Documents
* Videos
* Audio
* Images
* PDFs
* Rich text
* External resources

---

## Course Management

Learning content is reusable.

Courses can be assigned across multiple onboarding journeys.

---

## Employee Assignments

Assignments can target:

* Individual employees
* Teams
* Departments
* Roles
* Entire organization

Assignments support:

* Deadlines
* Mandatory completion
* Progress tracking
* Recurring training (future)

---

## Knowledge Base

Organizations can maintain internal documentation including:

* Policies
* SOPs
* FAQs
* Employee handbook
* Technical documentation

---

## Analytics

Real-time reporting including:

* Employee progress
* Department completion
* Journey completion
* Engagement
* Learning time
* Compliance

---

## Notifications

Supports:

* In-app notifications
* Email notifications
* Assignment reminders
* Deadline reminders

---

# High-Level Architecture

Talnova follows a modern decoupled architecture.

```text
                React SPA
                     │
              HTTPS / REST API
                     │
               Nginx Reverse Proxy
                     │
             Fastify Application
                     │
        ┌────────────┼────────────┐
        │            │            │
 MongoDB Atlas   Cloudflare R2   Redis*
        │                         │
        └────────────┬────────────┘
                     │
              Background Jobs

(*Redis optional during initial deployment)
```

---

# Architectural Principles

The platform follows these engineering principles.

## API First

Every feature is exposed through REST APIs.

The frontend never accesses the database directly.

---

## Stateless Backend

Application servers remain stateless.

Authentication is token-based.

This allows horizontal scaling without session affinity.

---

## Modular Architecture

Each business capability is implemented as an independent module.

Examples:

* Authentication
* Employees
* Organizations
* Journeys
* Courses
* Assignments
* Analytics
* Notifications

Modules should have minimal coupling.

---

## Feature-Based Structure

Backend source code is organized by business features rather than technical layers.

Each module owns:

* Routes
* Controllers
* Services
* Models
* Validation
* Types
* Business logic

---

## Separation of Concerns

Business logic must never exist inside:

* Route definitions
* Controllers
* Database models

Business rules belong only inside service classes.

---

## Strong Typing

The entire backend is written using TypeScript.

No use of `any` is permitted.

Strict compiler settings must remain enabled.

---

## Validation First

Every request entering the API must be validated before reaching business logic.

Invalid requests should never reach service methods.

---

## Security by Default

Every endpoint assumes authentication unless explicitly marked public.

Authorization is enforced using role-based access control (RBAC).

Security takes precedence over convenience.

---

## Cloud Native

Persistent assets are never stored on the application server.

Media uploads are stored in Cloudflare R2.

Application data is stored in MongoDB Atlas.

Application servers remain disposable.

---

## Environment Driven Configuration

No secrets may be committed to source control.

All configuration must come from environment variables.

---

# Multi-Tenant Model

Talnova uses a logical multi-tenant architecture.

Each organization owns an isolated workspace.

Organizations cannot access data belonging to other organizations.

Every business document references its owning organization.

Workspace isolation is enforced at the service layer.

---

# Scalability Strategy

The platform is designed for incremental growth.

## Phase 1

Single EC2 instance

Single Fastify server

MongoDB Atlas

Cloudflare R2

No Redis

Suitable for:

* MVP
* Early customers
* Small organizations

---

## Phase 2

Redis caching

Background workers

Email queues

Improved monitoring

Suitable for:

* Growing customer base
* Hundreds of organizations

---

## Phase 3

Multiple Fastify instances

Load balancer

Dedicated worker servers

Horizontal scaling

Suitable for:

* Enterprise deployments
* Thousands of organizations

---

# Non-Goals

The platform intentionally excludes:

* Public course marketplace
* Individual course purchases
* Public instructor profiles
* Public reviews
* Affiliate marketing
* Public search engine indexing
* Consumer-focused learning

---

# Success Criteria

Talnova should achieve:

* Excellent user experience.
* Fast page loading.
* Responsive API performance.
* Enterprise-grade security.
* Maintainable codebase.
* Scalable architecture.
* High developer productivity.
* AI-assisted development compatibility.
* Cloud-native deployment.
* Future-ready extensibility.

---

# Document Dependencies

This document defines the architectural foundation.

Subsequent documents expand upon this specification:

* 02-technology-stack.md
* 03-deployment-architecture.md
* 04-project-structure.md
* 05-backend-architecture.md
* 06-database-design.md
* 07-authentication.md
* 08-api-standards.md
* 09-file-storage.md
* 10-security.md
* 11-performance.md
* 12-coding-standards.md
* 13-development-rules.md

All implementation decisions must remain consistent with the principles established in this document.
