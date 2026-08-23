# Talnova Onboarding

# 06 — Database Design

**Version:** 1.0.0

**Status:** Production Architecture

---

# Purpose

This document defines the database architecture, modeling principles, data standards, and document conventions for the Talnova Onboarding platform.

Unlike relational database specifications, this document focuses on designing aggregates optimized for MongoDB.

Every collection, schema, repository, and service must comply with the rules defined here.

This document acts as the foundation for all subsequent database specifications.

---

# Database Philosophy

Talnova uses **MongoDB Atlas** as its primary database.

The platform embraces MongoDB's document-oriented architecture rather than attempting to replicate relational database design.

The primary goals are:

* Minimize database queries.
* Keep related data together.
* Avoid unnecessary joins.
* Optimize read performance.
* Support horizontal scaling.
* Simplify business logic.
* Keep aggregates consistent.

The database should model the **business**, not the UI.

---

# Design Principles

The database follows these principles.

## Aggregate First

Collections represent business aggregates.

Examples:

* Organization
* User
* Journey
* Employee Assignment
* Knowledge Article

Collections do **not** represent UI pages.

---

## Embed Before Reference

Related data should be embedded whenever:

* Ownership is exclusive.
* The child object has no independent lifecycle.
* The child object is always retrieved with the parent.

Example

Journey

↓

Modules

↓

Lessons

↓

Content Blocks

These belong inside a single Journey document.

---

## Reference When Necessary

Separate collections are used only when:

* Data grows independently.
* Data is shared.
* Data changes frequently.
* Documents could exceed MongoDB limits.
* Ownership differs.

Examples:

* Users
* Uploads
* Notifications
* Audit Logs

---

## Tenant Isolation

Every tenant-owned document includes:

```typescript
organizationId: ObjectId
```

Every query must be scoped by:

```typescript
organizationId
```

Cross-tenant access is prohibited.

---

# Aggregate Overview

Talnova uses the following primary aggregates.

```text
Organizations

Users

Journeys

Employee Assignments

Knowledge Articles

Uploads

Notifications

Audit Logs

System Settings
```

These collections form the complete business model.

---

# Relationship Strategy

MongoDB relationships are intentionally limited.

Use:

Embedded Documents

when

* Parent owns child.
* Child has no independent identity.

Use:

References

when

* Data is shared.
* Data is reused.
* Data grows independently.

Avoid excessive population.

---

# Collection Naming

Collections use:

plural

lowercase

snake_case

Examples

```text
organizations

users

journeys

employee_assignments

knowledge_articles

audit_logs
```

Collection names must remain stable.

---

# Primary Keys

Every document uses MongoDB ObjectId.

```typescript
_id: ObjectId
```

Never replace ObjectId with UUID.

Public identifiers may be added later if required.

---

# Common Fields

Every business document includes:

```typescript
createdAt

updatedAt

createdBy

updatedBy
```

Tenant-owned documents also include:

```typescript
organizationId
```

These fields are mandatory unless explicitly exempted.

---

# Soft Deletes

Talnova uses soft deletion for business data.

Required fields:

```typescript
deletedAt

deletedBy

isDeleted
```

Deleted records remain recoverable.

Repositories exclude deleted records by default.

Permanent deletion should be restricted to administrative cleanup processes.

---

# Auditability

Business-critical changes should be traceable.

Examples:

* Employee creation
* Journey publication
* Assignment updates
* Permission changes
* Organization settings

Detailed history belongs in the Audit Log aggregate.

Business collections should not duplicate audit history.

---

# Document Size

MongoDB document limit:

16 MB

Design guidelines:

* Embed only bounded child collections.
* Store media externally.
* Avoid unlimited arrays.
* Split growing datasets into separate aggregates.

Journey documents should remain comfortably below MongoDB limits.

---

# Media Storage

Binary files are **never** stored inside MongoDB.

Uploads are stored in Cloudflare R2.

MongoDB stores only metadata.

Example

```typescript
{
  fileId,
  fileName,
  mimeType,
  size,
  storageKey,
  publicUrl
}
```

---

# Schema Validation

Application validation occurs using:

Zod

Database validation occurs using:

Mongoose Schemas

Validation must exist at both layers.

Database validation protects against invalid writes outside the API.

---

# Indexing Strategy

Indexes are designed for:

* Authentication
* Search
* Filtering
* Pagination
* Tenant isolation
* Analytics

Indexes are documented separately in:

06.10-indexing-strategy.md

---

# Transactions

MongoDB transactions should be used sparingly.

Recommended only when multiple aggregates must remain consistent.

Examples:

* Organization creation
* Bulk employee import
* Assignment generation

Most operations should complete within a single aggregate.

---

# Read Optimization

Design favors read performance.

Typical operations should require:

```text
findOne()

find()

aggregate()
```

Avoid repeated lookups across collections.

---

# Write Optimization

Updates should target individual aggregates.

Avoid updating multiple collections within a single request whenever possible.

Services coordinate consistency when cross-aggregate updates are required.

---

# Repository Rules

Repositories:

* Query MongoDB.
* Build aggregation pipelines.
* Handle pagination.
* Execute bulk operations.

Repositories must never:

* Perform authorization.
* Apply business rules.
* Send notifications.
* Upload files.

---

# Multi-Tenant Security

Repositories must always inject:

```typescript
organizationId
```

into tenant-scoped queries.

No repository method should expose unrestricted access.

Global collections are the only exception.

---

# Timestamp Strategy

Every document stores timestamps using UTC.

Fields:

```typescript
createdAt

updatedAt
```

Dates are stored using MongoDB Date objects.

Timezone conversion occurs only at the presentation layer.

---

# Versioning

Complex business documents support optimistic versioning.

```typescript
version
```

may be added where concurrent editing is expected.

Examples:

* Journey Builder
* Knowledge Articles

---

# Search Strategy

Simple filtering uses MongoDB indexes.

Advanced search may later integrate:

Atlas Search

without requiring schema redesign.

The current design remains compatible with future full-text search.

---

# Pagination

Collections support:

* Offset pagination
* Cursor pagination (future)

Repository APIs should remain pagination-aware even for small datasets.

---

# Data Retention

Retention policies:

Business Data

Never automatically deleted.

Audit Logs

Retained according to organization policy.

Notifications

Archived after expiration.

Temporary Uploads

Automatically cleaned.

---

# Backup Strategy

MongoDB Atlas manages:

* Continuous backups
* Point-in-time recovery
* Automated snapshots

Application code should never implement custom backup logic.

---

# Aggregate Specifications

The following documents define each aggregate in detail.

* 06.1-organizations.md
* 06.2-users.md
* 06.3-journeys.md
* 06.4-employee-assignments.md
* 06.5-knowledge-base.md
* 06.6-uploads.md
* 06.7-notifications.md
* 06.8-audit-logs.md
* 06.9-system-settings.md
* 06.10-indexing-strategy.md

This document defines the common database architecture shared by every aggregate.

Subsequent documents specify the individual collections and their business responsibilities.
