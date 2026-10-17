# Demo Feature-Parity Audit Matrix

**Document ID:** `TALNOVA-DEMO-PARITY-003`  
**Phase:** Two (Demo Feature-Parity Audit)  
**Status:** Complete  
**Date:** 2026-10-17  
**Author:** Principal Software Architect & Product Quality Lead  

---

## 1. Overview & Classification Strategy

To deliver an authentic, true-to-life demo experience without exposing sensitive production capabilities, every user-facing feature in the production application has been audited and classified into one of four deterministic categories:

1. **Required for Demo Parity (`REQUIRED_PARITY`):** Core onboarding and management workflows that must function identically in demo mode against synthetic demo data.
2. **Simulated / Controlled Form (`SIMULATED_DEMO`):** Features that involve external third-party services (e.g. Email dispatch, SMS, Hardware shipping, SSO providers, HRIS sync) that must run against controlled sandboxes or local sinks.
3. **Intentionally Production-Only (`PRODUCTION_ONLY`):** Administrative infrastructure, real financial billing/invoicing, live database management, and root platform administration that are strictly barred from the demo client bundle and API.
4. **Requires Security/Business Decision (`DECISION_PENDING`):** Features like interactive Kiosk player terminal modes that require product alignment on whether to provide a full interactive simulator or a guided modal.

---

## 2. Feature-Parity Matrix

| Feature ID | Feature Name & Purpose | Production Location | Demo Location | Status | Scope Category | Priority | Complexity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FP-001** | **Admin Executive Dashboard**<br>Metrics, progress widgets, stage distributions | `src/pages/AdminDashboard.tsx` | Reused at `/demo/admin` | Partial (Nav jumps to `/`) | `REQUIRED_PARITY` | P0 | Low |
| **FP-002** | **Manager Operations Dashboard**<br>Team roster, approvals, nudges | `src/pages/ManagerDashboard.tsx` | Reused at `/demo/manager` | Partial (Nudge routes / redirects) | `REQUIRED_PARITY` | P0 | Medium |
| **FP-003** | **Employee Onboarding Portal**<br>Roadmap, tasks, journeys, milestones | `src/pages/EmployeeDashboard.tsx` | Reused at `/demo/employee` | Partial (Certificate link broken) | `REQUIRED_PARITY` | P0 | Low |
| **FP-004** | **Journey Builder & Visual Canvas**<br>Module creation, drag-and-drop, rules | `src/pages/JourneyBuilder.tsx` | Reused at `/demo/journeys/:id` | Broken (Save/back jumps to `/journeys`) | `REQUIRED_PARITY` | P0 | High |
| **FP-005** | **Journeys List & Templates**<br>Template discovery, duplication, bulk assign | `src/pages/JourneysList.tsx` | Reused at `/demo/journeys` | Complete | `REQUIRED_PARITY` | P0 | Low |
| **FP-006** | **Course & Lesson Interactive Viewer**<br>Rich text, multimedia, quiz evaluation | `src/pages/CourseViewer.tsx` | Reused at `/demo/course/:id` | Partial (Back button navigates to `/employee`) | `REQUIRED_PARITY` | P0 | Medium |
| **FP-007** | **Interactive Checklist Tasks**<br>Category filtering, stage verifications | `src/pages/Tasks.tsx` | Reused at `/demo/tasks` | Complete | `REQUIRED_PARITY` | P0 | Low |
| **FP-008** | **IT Operations Hardware Queue**<br>Asset dispatch, courier tracking, receipts | `src/pages/Tasks.tsx` (`/tasks/it-ops`) | Missing in demo router | Missing | `REQUIRED_PARITY` | P1 | Medium |
| **FP-009** | **Employee Directory & Profile 360**<br>Search, filter, department trees, profile view | `src/pages/EmployeeDirectory.tsx`, `EmployeeProfile.tsx` | Reused at `/demo/directory`, `/demo/profile` | Complete | `REQUIRED_PARITY` | P0 | Low |
| **FP-010** | **Knowledge Base & Search**<br>Article reader, category navigation, quick links | `src/pages/KnowledgeBase.tsx` | Reused at `/demo/kb` | Partial (Slideshow links to `/kb/slideshow`) | `REQUIRED_PARITY` | P0 | Low |
| **FP-011** | **Knowledge Base Slideshow Presentation**<br>Full-screen onboarding slide viewer | `src/pages/KnowledgeBaseSlideshow.tsx` | Missing in demo router | Missing | `REQUIRED_PARITY` | P1 | Low |
| **FP-012** | **Digital Documents & Compliance**<br>Template list, e-signature requests | `src/pages/Documents.tsx` | Reused at `/demo/documents` | Complete | `REQUIRED_PARITY` | P0 | Low |
| **FP-013** | **Interactive Document Signer**<br>Canvas signing, compliance acceptance | `src/pages/DocumentSigner.tsx` | Reused at `/demo/documents/:id/sign` | Broken (Exit navigates to `/documents`) | `REQUIRED_PARITY` | P0 | Medium |
| **FP-014** | **Certificates & Verification**<br>Journey graduation badges, PDF download | `src/pages/Certificates.tsx` | Missing in demo router | Missing | `REQUIRED_PARITY` | P1 | Medium |
| **FP-015** | **Public Certificate Verification**<br>Public verification permalink | `src/pages/PublicCertificateViewer.tsx` | Excluded | `SIMULATED_DEMO` | P2 | Low |
| **FP-016** | **Milestones & Recognition Badges**<br>Goal tracking, manager reviews | `src/pages/Milestones.tsx` | Reused at `/demo/milestones` | Complete | `REQUIRED_PARITY` | P0 | Low |
| **FP-017** | **Gamification & Leaderboard**<br>XP scores, streaks, team ranking | `src/pages/Leaderboard.tsx` | Reused at `/demo/leaderboard` | Complete | `REQUIRED_PARITY` | P1 | Low |
| **FP-018** | **Buddy & Mentor Program**<br>Matching algorithm, check-in log | `src/pages/BuddyProgram.tsx` | Reused at `/demo/buddy` | Complete | `REQUIRED_PARITY` | P1 | Low |
| **FP-019** | **Talent Analytics & Retention Insights**<br>Charts, churn probability, time-to-productivity | `src/pages/Analytics.tsx` | Reused at `/demo/analytics` | Complete | `REQUIRED_PARITY` | P0 | Low |
| **FP-020** | **AI Onboarding Assistant**<br>Chat interface, policy Q&A | `src/pages/AIAssistant.tsx` | Reused at `/demo/ai-assistant` | Complete | `REQUIRED_PARITY` | P1 | Low |
| **FP-021** | **AI Course Builder**<br>Prompt-based curriculum generation | `src/pages/AICourseBuilder.tsx` | Missing in demo router | Missing | `SIMULATED_DEMO` | P2 | Medium |
| **FP-022** | **HR Operations & Outbox Exceptions**<br>Data sync exceptions, resolution workbench | `src/pages/HROperations.tsx`, `HROpsExceptions.tsx` | Gated with `DemoRestrictedPage` | Simulated Modal | `SIMULATED_DEMO` | P1 | Low |
| **FP-023** | **Interactive Office Floor Map**<br>Desk allocation, amenity markers | `src/pages/OfficeMap.tsx` | Missing in demo router | Missing | `REQUIRED_PARITY` | P2 | Medium |
| **FP-024** | **Automated Workflows & Triggers**<br>Event-based rule builder | `src/pages/Workflows.tsx` | Missing in demo router | Missing | `REQUIRED_PARITY` | P2 | Medium |
| **FP-025** | **Organization & Workspace Settings**<br>Branding, department management | `src/pages/Settings.tsx` | Reused at `/demo/settings` | Broken (Sub-tabs jump to `/settings/*`) | `REQUIRED_PARITY` | P1 | Medium |
| **FP-026** | **HRIS Directory Integrations**<br>Workday, BambooHR, Rippling sync | `src/pages/HRISIntegrations.tsx` | Gated with `DemoRestrictedPage` | Simulated Modal | `SIMULATED_DEMO` | P1 | Low |
| **FP-027** | **Enterprise SSO Enforcement**<br>SAML 2.0 / OIDC configuration | `src/pages/SSOSettings.tsx` | Gated with `DemoRestrictedPage` | Simulated Modal | `SIMULATED_DEMO` | P1 | Low |
| **FP-028** | **Sandbox Email Sink & Inbox**<br>Inspect outbound demo transactional emails | None (Demo-only) | `demo/src/pages/DemoInbox.tsx` | Complete | `SIMULATED_DEMO` | P0 | Low |
| **FP-029** | **Super Admin Platform Console**<br>Tenant provisioning, system observability | `src/pages/SuperAdmin*.tsx` | None | Strictly Barred | `PRODUCTION_ONLY` | N/A | Excluded |
| **FP-030** | **Physical Kiosk Player & Fleet**<br>MDM pairing, offline caching, lockdown terminal | `src/features/kiosk/*` | None | Decision Pending | `DECISION_PENDING`| P3 | High |

---

## 3. Detailed Audit Findings & Gaps

### 3.1 Gaps Identified for Immediate Resolution

1. **Gap 1: Missing `/demo/certificates` Route**
   - **Impact:** When a demo user finishes an onboarding journey, they receive an achievement toast inviting them to inspect their certificate, but clicking the notification or navigation fails because the demo route does not exist.
   - **Remedy:** Mount `Certificates.tsx` under `/demo/certificates` and add it to `demoNavSections`.
2. **Gap 2: Missing `/demo/tasks/it-ops` Hardware Route**
   - **Impact:** IT Admin personas or HR admins cannot showcase hardware lifecycle management (laptop provisioning, asset tagging).
   - **Remedy:** Mount `Tasks.tsx` under `/demo/tasks/it-ops` with initial view set to hardware queue.
3. **Gap 3: Missing `/demo/office-map` Route**
   - **Impact:** Prospective buyers cannot view the interactive floorplan and desk booking feature.
   - **Remedy:** Mount `OfficeMap.tsx` under `/demo/office-map` with synthetic desk allocation records.
4. **Gap 4: Missing `/demo/workflows` Route**
   - **Impact:** Custom automated onboarding triggers (e.g. "When 7 days before start date, trigger welcome email") cannot be viewed or demonstrated.
   - **Remedy:** Mount `Workflows.tsx` under `/demo/workflows`.
5. **Gap 5: Missing Context-Aware Navigation in `JourneyBuilder` & `DocumentSigner`**
   - **Impact:** Clicking standard back/cancel buttons ejects users to production `/journeys` and `/documents`, causing forced `/login` redirects.
   - **Remedy:** Wrap component rendering in a navigation adapter that routes `/journeys` to `/demo/journeys`.

---

## 4. Intentional Production-Only Restrictions

The following capabilities are deliberately withheld from the demo environment to maintain application security, prevent abuse, and prevent confusion:

1. **Super Admin Platform Operations:** Root access to tenant databases, license invoicing, payment gateways, and system observability (`/super-admin/*`).
2. **Real External Communications:** Live SMTP / SendGrid / Resend dispatch. All outbound emails are trapped in `DemoEmailSinkService` and visible in `/demo/inbox`.
3. **Real Cloud Bucket Modification:** Production AWS S3/Cloudflare R2 buckets are replaced with sandboxed local directory storage (`storage/demo-uploads/`).
4. **Active Identity Provider Sync:** Live SCIM 2.0 endpoints and production IdP SAML assertion endpoints are restricted.
