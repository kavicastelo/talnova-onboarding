# 17 — Assumptions & Open Questions

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative Inventory of Assumptions, Derived Requirements & Recommendations  
> **Module Namespace:** System Core

---

## 1. Inventory Categorization

This document categorizes all implicit assumptions, derived functional requirements, open stakeholder decisions, and technical architectural recommendations across the consolidated product model.

---

## 2. Explicit System Assumptions

1. **ASM-001 (Single Tenant Ownership per User):** An employee user account belongs strictly to one organization tenant workspace (`organizationId`). Users requiring access to multiple corporate tenants must maintain separate email credentials.
2. **ASM-002 (In-Process Scheduler Scale):** The `node-cron` background scheduler with MongoDB state locking is sufficient for single-instance or dual-instance application deployments, up to 10,000 active daily users.
3. **ASM-003 (Cloud Storage Availability):** AWS S3 / Cloudflare R2 object storage is available and reachable with presigned URL capabilities for media streams and signed document PDFs.
4. **ASM-004 (Frontline Device Hardware):** Public kiosk displays possess modern HTML5 browser support (Chrome/Edge Chromium) with Web Audio API and PWA Service Worker compatibility.

---

## 3. Derived Functional Requirements (`DER-REQ-xxx`)

#### DER-REQ-001: Automatic Certificate PDF Generation Trigger
- **Source Requirement:** CON-REQ-011 (Certificates)
- **Derivation Logic:** Explicit requirement CON-REQ-011 mandates public verification URLs and PDF exports for course completions. It is logically derived that the system must trigger automated background PDF rendering upon setting `EmployeeAssignment.status = COMPLETED`.

#### DER-REQ-002: Dynamic Stage Unlocking on Prerequisite Task Completion
- **Source Requirement:** CON-REQ-012, CON-REQ-013 (Task Engine)
- **Derivation Logic:** Explicit requirement CON-REQ-013 establishes cross-person task dependencies (e.g., IT laptop setup). It is logically derived that downstream onboarding stage tasks (`DAY_1`) must remain locked until prerequisite cross-person tasks (`PRE_BOARDING`) achieve `COMPLETED` status.

#### DER-REQ-003: Automatic Buddy Check-in Agenda Generation
- **Source Requirement:** CON-REQ-024 (Buddy Program)
- **Derivation Logic:** Explicit requirement CON-REQ-024 specifies weekly buddy check-ins. It is logically derived that the system must automatically instantiate weekly agenda templates (`Week 1: Office Tour`, `Week 2: Team Introduction`) upon creating a `BuddyPairing` record.

---

## 4. Open Questions for Stakeholder Decision

| Question ID | Subject / Topic | Context & Impact | Recommended Action |
| :--- | :--- | :--- | :--- |
| **OPNQ-001** | AI Token Consumption Limits | RAG AI Assistant and AI Course Builder utilize LLM API calls. Source docs do not specify per-tenant token quotas. | Establish tenant-level monthly AI token allowances (e.g., 500,000 tokens/month per tenant) with admin upgrade prompts. |
| **OPNQ-002** | Custom Domain SSL Certificate Provisioning | Organizations can specify custom branding slugs/domains. Automatic SSL certificate issuance is unspecified. | Integrate Cloudflare SSL / Let's Encrypt automated certificate management for custom tenant domain aliases. |
| **OPNQ-003** | E-Signature Legal Jurisdiction Customization | Current e-signature audit trails comply with US ESIGN Act. International eIDAS Advanced Electronic Signature (AdES) requirements may require HSM hardware timestamping. | Validate target enterprise customer geographic compliance requirements for legal document sign-offs. |

---

## 5. Technical Architecture Recommendations (`RECOMMENDATION`)

> [!NOTE]
> The following items are technical recommendations for engineering scalability and must **not** be presented as explicit business requirements.

- **RECOMMENDATION-001 (Redis & BullMQ Queue):** As tenant scale exceeds 50,000 active users, migrate in-process `node-cron` schedulers to a distributed Redis / BullMQ message queue for background job execution.
- **RECOMMENDATION-002 (OpenTelemetry Observability):** Implement OpenTelemetry distributed tracing across Fastify REST API routes, MongoDB query drivers, and HTTP client requests for end-to-end P99 latency tracking.
- **RECOMMENDATION-003 (Vector Database Dedicated Cluster):** Migrate Knowledge Base article RAG embeddings from MongoDB Atlas Vector Search to a dedicated Qdrant / Pinecone cluster if RAG query volumes exceed 100 requests per second.
