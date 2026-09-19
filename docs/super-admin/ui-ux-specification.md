# Super Admin UI/UX Specification & Screen-by-Screen Dossier

> **Document Status:** Authoritative UI/UX Design & Engineering Specification  
> **System:** Talnova Onboarding Enterprise Platform  
> **Target Audience:** Principal Frontend Engineers, Product Designers, Enterprise Architects  
> **Design Philosophy:** Dense, informative, keyboard-accessible, sleek dark-mode (`#0B0F19`) enterprise operational control plane.

---

## 1. Global UI/UX Standards & Common Elements

### 1.1 Color Palette & Visual Semantics
* **Background:** Base slate `#0B0F19`, Surface cards `rgba(255, 255, 255, 0.02)` to `rgba(255, 255, 255, 0.05)`, borders `rgba(255, 255, 255, 0.08)`.
* **Semantic Accents:**
  * **Information / Primary:** Indigo / Blue (`#4F46E5`, `#3B82F6`)
  * **Success / Operational:** Emerald (`#10B981`)
  * **Warning / Attention:** Amber / Orange (`#F59E0B`)
  * **Danger / Critical Failure:** Crimson (`#EF4444`)
  * **Special / AI:** Violet / Purple (`#8B5CF6`)

### 1.2 Universal Header Filter Bar
Present across every Super Admin page:
* **Date Range Selector:** Presets (`1h`, `24h`, `7d`, `30d`, `90d`, `1y`) + Custom Date Picker.
* **Organization Selector:** Live searchable dropdown of all active tenants + "All Organizations" global mode.
* **Environment Indicator:** Badge showing active target (`Production`, `Staging`, `Development`).
* **Active Severity Filter:** `All`, `Critical`, `Warning`, `Info`.
* **Refresh Action:** Instant re-fetch button with rotating spinner and last updated timestamp indicator (`"Updated 42s ago"`).

### 1.3 Asynchronous State Standards
* **Loading State:** Shimmering skeleton cards with matching dimensions (never blank screens or layout shifts).
* **Error State:** Warning icon, concise explanation of the failure, actionable `[Retry Request]` button, and support correlation reference.
* **Empty State:** Descriptive empty state illustration, human explanation, and primary call-to-action button (e.g. `[Create Invoice]`, `[Provision Tenant]`, `[Deploy Feature Flag]`).

---

## 2. Screen-by-Screen Functional Specifications

---

### Screen 1: Platform Command Center (`/super-admin`)
* **Purpose:** Executive platform-wide situational awareness.
* **Target Administrator:** CEO, CTO, VP Operations, Head of Customer Success.
* **Primary Questions Answered:**
  * "Is the platform healthy right now?"
  * "How many active organizations and users are on the platform today?"
  * "What is our current cash collection vs outstanding receivables?"
  * "Are there any critical incidents or onboarding provisioning failures?"
* **KPI Metrics:**
  * Total Organizations (with 30d delta %)
  * Platform Users & Active DAU
  * Active Onboarding Cases
  * Monthly Cash Revenue ($)
  * Net Operating Result ($)
  * System Reliability (Availability % & P95 latency)
  * Open Critical Alerts Count
* **Visualizations:**
  * Dual-layer Area Chart: 6-Month Trajectory (Tenant Growth vs Verified Cash Collection).
  * Onboarding Case Pipeline Distribution (Stacked Bar: Created -> Provisioning -> Active -> Completed).
  * System Health Radar (API P95 Latency, DB Ping, Error Rate %).
* **Tables:**
  * Recent High-Priority Alerts (Top 5 open alerts with severity badges).
  * Recent Privileged Audit Actions (Last 5 actions with actor avatar, target, and timestamp).
* **Actions:** `[Provision Workspace]`, `[Export Snapshot]`, `[Acknowledge Alerts]`.
* **Drill-Downs:** Clicking any KPI card deep-links into the corresponding specialized domain view.

---

### Screen 2: Organizations Directory (`/super-admin/organizations`)
* **Purpose:** High-density inventory of all customer enterprise workspaces.
* **Target Administrator:** Platform Admin, Customer Success Lead.
* **Primary Questions Answered:**
  * "Which customer tenants are active, suspended, or nearing seat limits?"
  * "When does this organization's subscription renew?"
* **Filters:** Search (name, domain, slug), Plan tier (Starter, Pro, Enterprise), Status (Active, Suspended).
* **Data Table Columns:** Organization Name, Domain, Plan Tier, Status Badge, Active Seats / Quota, Storage Consumed (GB), Onboarding Progress %, Created Date, Actions (`[View 360°]`, `[Edit Quota]`, `[Toggle Status]`).
* **Empty State:** "No organizations found matching your search criteria. [Provision New Organization]".
* **Data Sources:** `GET /api/v1/super-admin/organizations`.

---

### Screen 3: Organization 360° Profile (`/super-admin/organizations/:id`)
* **Purpose:** 360-degree operational dossier for an individual enterprise customer.
* **Target Administrator:** Account Executive, Lead SRE, Support Engineer.
* **Modular Tabs:**
  1. **Overview Tab:** Contract tier, primary billing contact, custom domain, SSO state, seat usage gauge, active alerts.
  2. **Users & Employees Tab:** Full employee directory for this tenant, roles, hire dates, last active timestamps.
  3. **Onboarding & Journeys Tab:** Active onboarding instances, completion rate gauge, drop-off step heatmap.
  4. **Resource Consumption Tab:** Cloudflare R2 storage GB consumed, media breakdown (video/PDF), monthly AI token usage.
  5. **Billing & Invoices Tab:** Full invoice history, verified payments, outstanding balance, credit status.
  6. **Activity & API Traffic Tab:** Filtered event feed and API request latency for this tenant.
  7. **Incidents & Alerts Tab:** Active or resolved alerts originating from this tenant.
  8. **Security Audit Tab:** Complete audit log of all changes made to this organization.
* **Actions:** `[Suspend Workspace]`, `[Adjust Seat Quotas]`, `[Issue Custom Invoice]`, `[Reset Admin Password]`.

---

### Screen 4: Platform User Directory & Access Control (`/super-admin/users`)
* **Purpose:** Global searchable directory of all registered users across all tenants.
* **Target Administrator:** Security Administrator, Identity & Access Lead.
* **Primary Questions Answered:**
  * "Which users hold elevated privileges (super_admin, owner, admin)?"
  * "Who has experienced failed login lockouts or missing MFA?"
* **Filters:** Search (name, email, employee ID), Organization, Role, Status (`active`, `invited`, `inactive`, `on_leave`, `terminated`).
* **Data Table Columns:** Full Name, Email, Organization, Role Badge, Department, Account Status, Last Active Timestamp, Actions (`[View 360°]`, `[Change Role]`, `[Deactivate]`).
* **Data Sources:** `GET /api/v1/super-admin/users`.

---

### Screen 5: User 360° Profile (`/super-admin/users/:id`)
* **Purpose:** Complete administrative view of an individual user's platform history.
* **Target Administrator:** HR Investigator, Security Admin, Support SRE.
* **Modular Sections:**
  * **Profile & Identity:** Name, national ID / badge ID, department, manager hierarchy, role, MFA status.
  * **Onboarding Journey Roadmap:** Visual progression timeline of assigned journey steps, quiz scores, and certificate status.
  * **Checklist Tasks & Hardware:** Assigned operational tasks, verification states, hardware tracking numbers.
  * **Compliance E-Signatures:** Signed document templates with SHA-256 hashes, timestamps, and IP addresses.
  * **Active Device Sessions:** IP address, device user-agent, last activity, and `[Terminate Session]` action.
  * **AI Interactions:** Prompts executed, feedback ratings, reported knowledge gaps.
  * **Audit History:** Every privileged action performed by or on this user account.

---

### Screen 6: Onboarding & Journey Observability (`/super-admin/onboarding`)
* **Purpose:** Platform-wide oversight of employee onboarding health, velocity, and bottlenecks.
* **Target Administrator:** Head of People Operations, Customer Success Architect.
* **Primary Questions Answered:**
  * "Where are new hires dropping off across our journey blueprints?"
  * "Which organizations have onboarding provisioning failures?"
* **KPI Cards:** Active Onboardings, Graduation Rate %, Average Days to Complete, Quarantined Verifications Count.
* **Visualizations:**
  * Journey Drop-Off Funnel (Pre-boarding -> Compliance Docs -> LMS Courses -> Milestones -> Handover).
  * Assessment Failure Radar (Quizzes with failure rate > 20%).
* **Tables:**
  * At-Risk Employees (Ranked by `dropOffRiskScore: -1`).
  * Provisioning Exceptions Queue (Failed outbox events or resource allocation errors).
* **Actions:** `[Retry Provisioning]`, `[Override Verification]`, `[Export Onboarding SLA Report]`.

---

### Screen 7: API & Request Observability (`/super-admin/observability/api`)
* **Purpose:** Real-time API traffic monitoring, latency distribution, and error breakdown.
* **Target Administrator:** Staff SRE, Backend Architect, DevOps.
* **Primary Questions Answered:**
  * "What is our current P95 and P99 latency?"
  * "Which endpoint or organization is driving abnormal 5xx errors?"
* **KPI Cards:** Requests Per Minute (RPM), Error Rate %, P50 Latency (ms), P95 Latency (ms), P99 Latency (ms).
* **Charts:**
  * Live Request Volume Stream (Split by HTTP 2xx, 4xx, 5xx).
  * Latency Percentile Trend (P50 vs P95 vs P99 over rolling 60 minutes).
* **Tables:**
  * Top 10 Endpoints by Volume & Latency.
  * Top 10 Organizations by API Request Share.
* **Data Sources:** In-Memory `TelemetryBuffer`.

---

### Screen 8: Technical Health & Database Cockpit (`/super-admin/observability/infrastructure`)
* **Purpose:** Low-level diagnostics for Node.js process, host OS, and MongoDB Atlas.
* **Target Administrator:** Systems Engineer, Lead Database Administrator.
* **Metrics & Visualizations:**
  * **Process Vitals:** Resident Set Size (RSS MB), V8 Heap Consumed vs Total (MB), Process Uptime.
  * **Event Loop Diagnostics:** Lag measurement in milliseconds (warn threshold: > 50ms).
  * **Host System:** CPU Cores, 1m/5m/15m Load Averages, Free Memory vs Total System Memory.
  * **MongoDB Atlas Cockpit:** Round-trip ping latency (ms), Connection pool size, Total collections count, Data size (MB), Index size (MB), Top collections document counts.
* **Actions:** `[Test DB Round-Trip]`, `[Inspect Connection Pool]`, `[Download Diagnostic Bundle]`.

---

### Screen 9: AI Observability & Cost Center (`/super-admin/observability/ai`)
* **Purpose:** Monitor external LLM usage, token consumption, provider latency, and attributed expenses.
* **Target Administrator:** AI Architect, FinOps Analyst, VP Engineering.
* **Primary Questions Answered:**
  * "How many tokens are we consuming across Gemini, OpenAI, and Anthropic?"
  * "What is our daily estimated AI expenditure?"
  * "Which organizations are consuming the most AI compute?"
* **KPI Cards:** Total AI Invocations, Input Tokens, Output Tokens, Estimated Spend ($), P95 AI Latency (ms).
* **Charts:**
  * AI Token Usage Trajectory (Stacked area: Input vs Output tokens).
  * Provider Share Donut (Gemini vs OpenAI vs Azure vs Anthropic).
* **Tables:**
  * AI Feature Consumption Breakdown (`assistant_chat` vs `course_builder` vs `kb_retrieval`).
  * Top AI Consuming Organizations (Ranked by estimated spend).
  * Knowledge Gaps Review (Top unanswered employee policy queries).
* **Data Sources:** `AIUsageRecord`, `KnowledgeGap`.

---

### Screen 10: Financial Command Center (`/super-admin/finance`)
* **Purpose:** Internal B2B manual billing oversight, receivables management, and cash flow tracking.
* **Target Administrator:** CFO, Financial Controller, Operations Lead.
* **Primary Questions Answered:**
  * "How much cash have we actually collected this month?"
  * "What is our total outstanding Accounts Receivable?"
  * "What are our recorded operating expenses and net profitability?"
* **KPI Cards:** Gross Cash Collected ($), Total Invoiced ($), Accounts Receivable ($), Overdue Receivables ($), Recorded Expenses ($), Net Operating Result ($).
* **Charts:**
  * 6-Month Cash Flow & Operating Result (Cash Collected vs Approved Expenses).
  * Invoicing Aging Breakdown (Current vs 1-30d vs 31-60d vs 90d+ overdue).
* **Sub-Navigation Links:** `[Invoicing Directory]`, `[Payment Ledger]`, `[Expense Tracker]`, `[Customer Accounts]`.
* **Actions:** `[Issue New Invoice]`, `[Record Manual Payment]`, `[Log Operational Expense]`, `[Export Financial Summary]`.

---

### Screen 11: Invoicing & Receivables Directory (`/super-admin/finance/invoices`)
* **Purpose:** Manage itemized customer invoices and invoice states.
* **Target Administrator:** Billing Administrator.
* **Filters:** Search (invoice number, organization), Status (`all`, `issued`, `partially_paid`, `paid`, `overdue`, `draft`, `cancelled`), Date Range.
* **Table Columns:** Invoice No (`INV-XXXX`), Organization, Issue Date, Due Date, Total Amount, Paid, Balance Due, Status Badge, Actions (`[View/Print]`, `[Record Payment]`, `[Void]`).
* **Modal Forms:**
  * **Create Invoice Modal:** Select Organization, Add Itemized Line Items (Description, Quantity, Unit Price, Amount), Apply Discount/Tax, Select Due Date, Enter Terms.
  * **Record Payment Modal:** Invoice No, Payment Date, Amount Received, Payment Method (Bank Wire, Check), Wire Reference Number, Notes.

---

### Screen 12: Unified Alert & Incident Workbench (`/super-admin/alerts`)
* **Purpose:** Centralized operational incident radar across security, technical, operational, and financial domains.
* **Target Administrator:** SRE On-Call, Support Lead, Security Officer.
* **Filters:** Severity (`Critical`, `High`, `Medium`, `Low`), Category (`Security`, `Application`, `Database`, `AI`, `Finance`, `Onboarding`), Status (`Open`, `Acknowledged`, `Resolved`, `Ignored`).
* **Alert Card Anatomy:** Severity Icon, Alert No, Title, Description, Root Source Service, Timestamp, Suggested Remediation Guidance, Current Status.
* **Actions:** `[Acknowledge]`, `[Mark Investigating]`, `[Resolve with Notes]`, `[Ignore]`.

---

### Screen 13: Centralized Reporting Center (`/super-admin/reports`)
* **Purpose:** Centralized catalog for generating, previewing, and downloading platform reports.
* **Target Administrator:** Business Analyst, Auditor, Leadership.
* **Report Categories:** Business & Financial, Product & Adoption, Operational & Compliance, Technical & Reliability, AI Consumption.
* **Controls:** Select Report, Select Target Organization (or All), Select Date Range, Choose Format (`CSV`, `JSON`), `[Generate & Stream Download]`.
* **Security:** Emits `DATA_EXPORTED` audit log on completion.

---

### Screen 14: Feature Flags & Platform Settings (`/super-admin/settings/flags`)
* **Purpose:** Control runtime platform feature availability and phased rollouts without redeploying code.
* **Target Administrator:** Head of Product, Platform Architect.
* **Table Columns:** Feature Key, Display Name, Description, Target Audience (Global / Orgs / Roles / % Rollout), Status Toggle (Enabled / Disabled), Last Modified By, Actions (`[Edit Rollout]`, `[Audit History]`).
* **Safety Gate:** Toggling a global flag requires a confirmation modal with mandatory human justification.
