# Architecture Validation Issues & Inconsistencies

This document lists the architectural, schema, and structural inconsistencies found within the Talnova Onboarding documentation (`docs/`).

---

## 1. Notification & Security Settings Duplication

* **Inconsistency:** Overlapping configurations stored in two distinct schema locations.
* **Details:**
  * [06.1-organizations.md](../06.1-organizations.md) embeds `notificationSettings` (`assignmentEmail`, `reminderEmail`, `weeklyDigest`) and `securitySettings` (`allowPasswordLogin`, `enforceMfa`, `sessionTimeout`) directly within the `organizations` collection.
  * [06.9-system-settings.md](../06.9-system-settings.md) defines a separate `systemSettings` collection that stores `notifications` (`emailEnabled`, `inAppEnabled`, `digestEnabled`) and `security` (`passwordMinLength`, `enforceMfa`, `sessionTimeoutMinutes`) settings.
* **Impact:** Duplicate state for `enforceMfa` and session timeouts leads to conflicting data, synchronization overhead, and validation ambiguity.

---

## 2. File Upload Flow Contradictions

* **Inconsistency:** Discrepancy between backend-mediated and direct client-to-R2 upload flows.
* **Details:**
  * [02-technology-stack.md](../02-technology-stack.md), [03-deployment-architecture.md](../03-deployment-architecture.md), [05-backend-architecture.md](../05-backend-architecture.md), and [09-file-storage.md](../09-file-storage.md) outline a **backend-proxied** flow: `Client -> Fastify -> Cloudflare R2` (using `@fastify/multipart` to stream files to R2).
  * [06.6-uploads.md](../06.6-uploads.md) outlines a **client-direct** flow: `Client requests signed URL -> Backend generates URL -> Client uploads directly to R2 -> Client confirms with Backend`.
  * [09-file-storage.md](../09-file-storage.md) lists "Signed upload URLs" under *Future Enhancements*, while `06.6-uploads.md` defines it as the active architecture.
* **Impact:** Inconsistent API contract design for file uploads. The implementation must choose between streaming through the API or direct-to-R2 signed URLs.

---

## 3. Users vs. Employees Module Mismatch

* **Inconsistency:** Ambiguous boundaries and naming conventions between "Users" and "Employees".
* **Details:**
  * [06-database-design.md](../06-database-design.md) and [06.2-users.md](../06.2-users.md) specify a single `users` collection that stores both authentication credentials and employee profile/employment data.
  * The backend build order lists `14. User module` and `15. Employee module` as two separate modules.
  * [04-project-structure.md](../04-project-structure.md) lists `employees/` as a source module, but does not list `users/`.
  * [06.2-users.md](../06.2-users.md) refers to endpoints like `/users/me` and `/users`, while [08-api-standards.md](../08-api-standards.md) refers to `/employees` endpoints.
* **Impact:** Code module boundaries are unclear. If there is a single `users` collection, having separate `users` and `employees` modules introduces circular/cross-module dependencies or duplicate repository controls.

---

## 4. Organization Sub-documents vs. Separate Feature Modules

* **Inconsistency:** Departments, teams, and locations are treated both as embedded sub-documents and independent modules.
* **Details:**
  * [06.1-organizations.md](../06.1-organizations.md) embeds `departments`, `teams`, `jobTitles`, and `locations` as sub-document arrays inside the `organizations` collection.
  * [04-project-structure.md](../04-project-structure.md) lists `departments/` and `teams/` as separate feature modules in `src/modules/`.
  * [06.1-organizations.md](../06.1-organizations.md) lists nested endpoints: `GET /organizations/departments`, `POST /organizations/departments`, `GET /organizations/teams`, etc.
* **Impact:** Creating independent modules like `departments` and `teams` in `src/modules/` when they do not possess their own MongoDB collections violates the feature-first modularity principle, as they must access the `Organization` model and repository to perform CRUD operations.
