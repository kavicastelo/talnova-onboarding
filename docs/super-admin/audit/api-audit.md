# Super Admin REST API Surface & Contract Audit

> **Document Status:** Authoritative API Contract Audit  
> **System:** Talnova Onboarding Enterprise Platform  
> **Prefix:** `/api/v1/super-admin`  
> **Backend Router:** `server/src/modules/super-admin/routes/super-admin.routes.ts` (2,112 lines)  

---

## 1. Executive Summary of API Surface

The Super Admin API is registered in `server/src/app.ts:98` under prefix `/api/v1/super-admin`.
* **35 Endpoints** are actively registered in `super-admin.routes.ts`.
* **All routes enforce** authentication and root authorization via:
  ```typescript
  app.addHook("onRequest", authenticate);
  app.addHook("onRequest", requireRole(["super_admin"]));
  ```
* **8 Required Endpoints** from `api-requirements.md` are **completely missing** from the backend router.

---

## 2. Granular API Contract Audit

### 2.1 Command Center & Search
| Method | Endpoint | Query / Body | Implemented Status | Contract Verification |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/search` | `q`, `limit` | **IMPLEMENTED** | Returns `{ organizations, users, journeys, invoices }`. Case-insensitive regex. |
| `GET` | `/telemetry` | `organizationId`, `startDate`, `endDate` | **IMPLEMENTED** | Returns 8 core KPI blocks + 6-month growth data. |
| `GET` | `/stats` | None | **IMPLEMENTED** | Returns quick tenant/user overview counts. |
| `GET` | `/activity-logs` | `limit` | **IMPLEMENTED** | Returns recent system-level audit logs for dashboard drawer. |

### 2.2 Organizations Management
| Method | Endpoint | Query / Body | Implemented Status | Contract Verification |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/organizations` | `search`, `status`, `page`, `limit` | **IMPLEMENTED** | Server-side pagination and status filtering. |
| `POST` | `/organizations` | `{ name, domain, slug, plan, adminEmail }` | **IMPLEMENTED** | Provisions organization, initial Owner account, and audit log. |
| `PATCH` | `/organizations/:id` | `{ plan, seatLimit, status, name }` | **IMPLEMENTED** | Updates limits and plan in `Organization`. Audited. |
| `PATCH` | `/organizations/:id/status` | `{ status: "Active" \| "Suspended" }` | **IMPLEMENTED** | Toggles operational tenant state. |
| `GET` | `/organizations/:id/360` | None | **IMPLEMENTED** | Consolidates quotas, users, journeys, invoices, uploads. |
| `POST` | `/organizations/:id/quarantine` | `{ reason }` | **IMPLEMENTED** | Sets `status = "Suspended"`, creates critical `TENANT_QUARANTINED` audit log. |

### 2.3 Users & Sessions Management
| Method | Endpoint | Query / Body | Implemented Status | Contract Verification |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/users` | `search`, `organizationId`, `role`, `status`, `page`, `limit` | **IMPLEMENTED** | Paginated cross-tenant user roster with department search. |
| `GET` | `/users/:id/360` | None | **IMPLEMENTED** | Detailed profile, sessions, tasks, audit history, and onboarding case. |
| `PATCH` | `/users/:id` | `{ role, status, unlock }` | **PARTIAL** | Updates role and employment status. Unlock fails to clear `lockoutUntil`. |
| `POST` | `/users/:id/force-logout` | None | **IMPLEMENTED** | Sets `Session.isValid = false` across all user sessions. Audited. |
| `GET` | `/sessions` | `organizationId`, `page`, `limit` | **IMPLEMENTED** | Lists active sessions with device info, IP, and expiration. |
| `POST` | `/sessions/:sessionId/revoke` | None | **IMPLEMENTED** | Invalidate single active session record. |

### 2.4 Onboarding & Operations
| Method | Endpoint | Query / Body | Implemented Status | Contract Verification |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/onboarding/cases` | `organizationId`, `state`, `page`, `limit` | **IMPLEMENTED** | State aggregation, candidate name populate, transition counts. |
| `GET` | `/tasks-ops` | `organizationId`, `status`, `type`, `page`, `limit` | **IMPLEMENTED** | Paginated queue, overdue task calculation, assignee populate. |
| `GET` | `/activity` | `organizationId`, `category`, `severity`, `search`, `page`, `limit` | **IMPLEMENTED** | Queryable audit log stream with severity aggregation. |

### 2.5 Observability Endpoints
| Method | Endpoint | Query / Body | Implemented Status | Contract Verification |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/observability/api` | None | **MOCK DATA** | Returns hardcoded static JSON (`p50: 28, p95: 64, rpm: 342`). |
| `GET` | `/observability/infrastructure` | None | **IMPLEMENTED** | Real Node.js memory, uptime, platform info, MongoDB document counts. |
| `GET` | `/observability/ai` | None | **MOCK DATA** | Returns hardcoded static JSON (`tokens: 482000, cost: $1.45`). |
| `GET` | `/observability/storage` | None | **IMPLEMENTED** | Live aggregation over `Upload` collection by media type. |

### 2.6 Finance & Invoicing
| Method | Endpoint | Query / Body | Implemented Status | Contract Verification |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/invoices` | `search`, `page`, `limit` | **IMPLEMENTED** | Paginated invoices with status badges and customer name. |
| `POST` | `/invoices` | `{ organization, amount, type, status, description }` | **IMPLEMENTED** | Creates invoice. Lacks line items, tax, discount, dueDate picker. |
| `GET` | `/invoices/export` | None | **IMPLEMENTED** | Streams CSV file of invoices with content-disposition header. |
| `GET` | `/finance` | None | **PARTIAL** | Computes MRR, ARR, ARPU, but uses synthetic `scaleFactor` for growth. |
| `GET` | `/finance/export` | None | **IMPLEMENTED** | Streams CSV file of tenant subscription pricing and seat quotas. |
| `GET` | `/finance/payments` | None | **IMPLEMENTED** | Returns manual payment receipts from `payment_records`. |
| `POST` | `/finance/payments` | `{ organizationName, organizationId, amount, method, reference, invoiceNo, notes }` | **PARTIAL** | Records payment. Unconditionally sets invoice to "Paid" without balance check. |
| `GET` | `/finance/expenses` | None | **IMPLEMENTED** | Returns operating expenses from `expense_records`. |
| `POST` | `/finance/expenses` | `{ category, vendor, amount, description, incurredAt }` | **IMPLEMENTED** | Inserts operational expense into `expense_records`. Audited. |

### 2.7 Feature Flags & Alerts
| Method | Endpoint | Query / Body | Implemented Status | Contract Verification |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/settings/flags` | None | **IMPLEMENTED** | Returns resolved feature flags merged with default catalog. |
| `PATCH` | `/settings/flags/:key` | `{ enabled, rolloutPct }` | **PARTIAL** | Updates `platform_feature_flags` collection. **No runtime enforcement.** |
| `GET` | `/alerts` | None | **PARTIAL** | Synthesizes alerts dynamically from 4 collections. No persistence. |

---

## 3. Missing Endpoints Required by Specification

The following endpoints documented in `api-requirements.md` are **NOT implemented** in `super-admin.routes.ts`:

1. `GET /api/v1/super-admin/finance/accounts`: Customer commercial accounts with billing cycle and credit status.
2. `PATCH /api/v1/super-admin/alerts/:id/status`: Transition alert lifecycle (`acknowledged`, `investigating`, `resolved`).
3. `POST /api/v1/super-admin/settings/flags`: Administrative creation of new feature flags.
4. `PATCH /api/v1/super-admin/settings/flags/:id`: Tenant-scoped feature override configuration.
5. `GET /api/v1/super-admin/reports`: Centralized reports catalog with generation scheduling.
6. `POST /api/v1/super-admin/reports/generate`: Backend generation and export of canonical reports.
7. `GET /api/v1/super-admin/settings/platform`: Retrieve platform maintenance mode and session policies.
8. `PATCH /api/v1/super-admin/settings/platform`: Update platform maintenance mode and governance parameters.
9. `GET /api/v1/super-admin/onboarding/bottlenecks`: Specialized journey bottleneck and quiz failure telemetry.

---

## 4. Input Validation & Error Handling

* **Ad-hoc Validation:** Routes perform manual validation (e.g., `if (!orgName || !amount) throw new AppError(400, ...)`). While functional, they do not utilize Fastify's standardized Zod compiler registered in `app.ts:18`.
* **Standard Response Envelope:** Handlers consistently return `{ success: true, message: string, data: any }`.
* **HTTP Status Codes:** Properly returns `200 OK` for reads/updates, `201 Created` for creations, `400 Bad Request` for invalid input, `403 Forbidden` for unauthorized roles, and `404 Not Found` for non-existent entities.
