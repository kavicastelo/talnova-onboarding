# Talnova Onboarding — Super Admin Command Center
## Authoritative Architecture, Domain, Observability, and Implementation Blueprint

> **Document Status:** Authoritative System Specification & Architectural Blueprint  
> **Target Audience:** Principal Enterprise Product Architects, Staff/Principal Engineers, Security & Data Architects, FinOps, SRE, Platform Leadership  
> **System Scope:** Global Multi-Tenant Control Plane for Talnova Onboarding Platform  
> **Version:** 2.0.0 (Unified Enterprise Architecture)

---

## 1. Executive Summary & Core Mission

**Talnova Onboarding** is a high-scale enterprise employee onboarding, compliance automation, workforce enablement, and frontline operational training platform supporting **50+ distinct user journeys and hundreds of specialized capabilities**. 

The **Super Admin Command Center** is not a superficial CRUD administration panel. It serves as the **mission-critical operational control plane, telemetry nervous system, and authoritative administrative cockpit** for the entire Talnova platform. 

It empowers authorized platform operators, executive leadership (CEO, CTO, VP Operations), security officers, and financial controllers to:
1. **OBSERVE:** Continuously monitor platform-wide health, adoption, active organizations, user journeys, background workflows, AI consumption, storage, financial revenue/expenses, and infrastructure metrics in real time.
2. **INVESTIGATE:** Trace incidents and behavioral patterns end-to-end along deterministic investigation chains:
   $$\text{Metric} \longrightarrow \text{Domain} \longrightarrow \text{Organization} \longrightarrow \text{User} \longrightarrow \text{Journey Instance} \longrightarrow \text{Event} \longrightarrow \text{API Request} \longrightarrow \text{Error} \longrightarrow \text{System Log}$$
3. **CONTROL:** Safely execute privileged, auditable administrative actions—such as tenant workspace provisioning, customer account configuration, role modifications, feature rollouts, manual financial reconciliations, task verification overrides, and incident mitigations—with multi-layered confirmation and immutable audit trails.

---

## 2. Platform Foundations & Technology Stack

Based on rigorous discovery across the repository, the Talnova Onboarding platform utilizes the following production-tested architecture:

* **Backend Runtime & Framework:** Node.js (ES Modules, TypeScript 5.6) with **Fastify v5.1.0** for high-throughput, low-overhead HTTP request handling.
* **Database & ODM:** **MongoDB Atlas** managed document database accessed via **Mongoose v8.8.2** with strict schemas, secondary indexes, TTL cleanup, and complex multi-stage aggregation pipelines.
* **Authentication & Authorization:** Dual-token JWT (Fastify JWT + HTTP-only cookies), Argon2 password hashing, Enterprise SAML 2.0 / OIDC SSO, and multi-tenant RBAC enforcement (`super_admin`, `owner`, `admin`, `manager`, `employee`, `it_admin`).
* **Storage Layer:** **Cloudflare R2 Object Storage** (S3-compatible via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`) for secure media, compliance PDFs, avatars, and e-signature assets.
* **Event & Workflow Processing:** In-memory asynchronous pub/sub event bus coupled with a transactional MongoDB-backed **Outbox Pattern** (`outbox_events`) and persistent delayed job workers (`queue.service.ts`).
* **AI Integrations:** Retrieval-Augmented Generation (RAG) assistant, policy gap detection, and AI Course Builder supporting Google Gemini, OpenAI, Azure OpenAI, Anthropic, and custom LLM endpoints.
* **Frontend Architecture:** **React 18.3** single-page application built with **Vite 5.2**, TypeScript 5.5, TailwindCSS 3.4, Lucide React icons, **TanStack React Query v5** for declarative caching and optimistic updates, **Recharts v2.12** for data visualization, and **i18next** for multi-language localization.

---

## 3. Guiding Architectural Principles

1. **Absolute Truth — No Fake Data & No Hardcoded Multipliers:** Every metric displayed across the Super Admin Command Center is derived directly from real database collections, live aggregation pipelines, server instrumentation, or provider APIs. Hardcoded mock multipliers (e.g., `orgsCount * 150`) are strictly forbidden. If real data is unavailable, the UI transparently reports `DATA_NOT_AVAILABLE` and references the exact instrumentation gap.
2. **Deterministic Financial Traceability (No Black-Box Gateways):** The platform handles B2B enterprise billing manually rather than through consumer gateways like Stripe or PayPal. Financial truth is established through deterministic, auditable accounting models:
   $$\text{Gross Invoiced} - \text{Discounts} + \text{Taxes} = \text{Total Due}$$
   $$\sum \text{Verified Payments} = \text{Cash Collected}$$
   $$\text{Total Due} - \text{Cash Collected} = \text{Outstanding Balance}$$
   $$\text{Cash Collected} - \text{Recorded Expenses} = \text{Operating Result}$$
   Every number displayed can be drilled down to individual invoices, line items, and bank transaction references.
3. **Defense-in-Depth Security & Immutability:** Super Admin endpoints bypass tenant boundaries solely for platform-wide operations, while enforcing strict backend authorization, IP recording, and immutable append-only audit logging. Privileged actions require explicit confirmations and categorization by risk level (READ, LOW-RISK WRITE, HIGH-RISK WRITE, DESTRUCTIVE).
4. **Server-Side Aggregation & Scalability:** In an enterprise environment hosting millions of events, frontend-side filtering of raw records is prohibited. The architecture relies on server-side pagination, indexed queries, and hourly/daily metric rollups to deliver sub-200ms P95 latency.
5. **Universal Context & Progressive Disclosure:** The interface provides a unified header filter bar (date range, organization, environment, severity) that persists across navigation, supported by global search (Ctrl+K) and rich 360° views for Organizations and Users.

---

## 4. Documentation Suite Sitemap

This directory (`docs/super-admin/`) contains the complete architectural and operational specification for the Super Admin Command Center:

| Document | File Link | Focus Area |
| :--- | :--- | :--- |
| **01. System Architecture** | [`architecture.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/architecture.md) | Layered architectural model, control plane boundaries, integration gateways. |
| **02. Information Architecture** | [`information-architecture.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/information-architecture.md) | Navigation taxonomy, routing matrix, 360° views, drill-down paths. |
| **03. Domain Map** | [`domain-map.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/domain-map.md) | End-to-end mapping from product domains to models, APIs, and views. |
| **04. Data Availability Matrix** | [`data-availability-matrix.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/data-availability-matrix.md) | Exhaustive capability-to-data mapping and availability classification. |
| **05. Data & Observability Gaps** | [`data-gaps.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/data-gaps.md) | Root cause analysis and remediation strategies for all discovered gaps. |
| **06. Observability Model** | [`observability-model.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/observability-model.md) | Metrics, logs, traces, correlation IDs, and APM instrumentation. |
| **07. Event Taxonomy** | [`event-taxonomy.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/event-taxonomy.md) | Standardized platform event schema, categories, and emission contracts. |
| **08. Analytics Model** | [`analytics-model.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/analytics-model.md) | Time-bucket rollups, aggregation pipelines, caching, and retention. |
| **09. Finance Model** | [`finance-model.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/finance-model.md) | Internal B2B manual billing, invoices, payments, expenses, and reconciliations. |
| **10. Audit & Governance** | [`audit-model.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/audit-model.md) | Privileged action tracking, mutation before/after diffs, compliance retention. |
| **11. Security Model** | [`security-model.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/security-model.md) | Root authorization, tenant bypass controls, rate limiting, and data protection. |
| **12. Reporting Engine** | [`reporting-model.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/reporting-model.md) | Business, product, operational, technical, and AI reporting specifications. |
| **13. API Requirements** | [`api-requirements.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/api-requirements.md) | Comprehensive REST contracts for all `/api/v1/super-admin/*` endpoints. |
| **14. Database Requirements** | [`database-requirements.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/database-requirements.md) | New Mongoose schemas, indexes, schema migrations, and validation rules. |
| **15. Implementation Plan** | [`implementation-plan.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/implementation-plan.md) | 14-phase vertical slice roadmap, milestones, dependencies, and Definition of Done. |
| **16. Testing Strategy** | [`testing-strategy.md`](file:///d:/talnova/talnova-onboarding/docs/super-admin/testing-strategy.md) | Automated Vitest test plans, security penetration cases, and UI validation suites. |

---

## 5. Next Steps

Review this documentation suite before executing code changes. All engineering work must adhere strictly to the designs and data contracts defined herein.
