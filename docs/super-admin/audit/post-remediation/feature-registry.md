# Master Product Feature Registry

> **Document Status:** Authoritative Master Feature Registry  
> **System:** Talnova Onboarding Enterprise Platform  
> **Total Capabilities Cataloged:** 105  
> **Domain Classification:** 12 Functional Business Domains  
> **Date:** September 2026  

---

## 1. Feature Taxonomy & Classification Schema

Each product capability is cataloged according to the canonical schema:
* **ID:** Unique canonical identifier (format: `FEAT-[DOMAIN]-[SEQ]`)
* **Feature Flag Key:** Canonical system flag key
* **Domain:** Functional domain
* **Module:** Backend module / frontend feature package
* **Type:** `MODULE` | `WORKFLOW` | `PAGE` | `CAPABILITY` | `INTEGRATION` | `ANALYTICS` | `ADMINISTRATION` | `AUTOMATION` | `AI` | `COMMUNICATION` | `REPORTING`
* **Lifecycle Status:** `ACTIVE` (GA) | `BETA` | `EXPERIMENTAL` | `INTERNAL` | `DEPRECATED`
* **Allowed Roles:** Roles permitted to interact with this feature
* **Frontend Surface:** Routes, pages, navigation sections, components
* **Backend Surface:** REST endpoints, services, Mongoose models
* **Linked User Journeys:** Associated journeys from the 49-journey catalog
* **Dependencies:** Prerequisite platform capabilities

---

## 2. Master Feature Inventory Table

### Domain 1: Identity, Authentication & Tenant Access (9 Capabilities)

| Feature ID | Feature Flag Key | Name | Type | Status | Allowed Roles | Frontend Route | Backend Endpoint | Linked Journey |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-AUTH-001` | `auth_credentials` | Password-Based Authentication | CAPABILITY | ACTIVE | All Roles | `/login` | `POST /api/v1/auth/login` | `UJ-AUTH-001` |
| `FEAT-AUTH-002` | `auth_session_revocation` | Secure Session Termination | CAPABILITY | ACTIVE | All Roles | All | `POST /api/v1/auth/logout` | `UJ-AUTH-002` |
| `FEAT-AUTH-003` | `auth_self_registration` | Invitation & Self-Registration | WORKFLOW | ACTIVE | Public | `/register` | `POST /api/v1/auth/register` | `UJ-AUTH-003` |
| `FEAT-AUTH-004` | `auth_password_reset` | Password Recovery & Reset | WORKFLOW | ACTIVE | Public | `/forgot-password`, `/reset-password` | `POST /api/v1/auth/forgot-password` | `UJ-AUTH-004` |
| `FEAT-AUTH-005` | `sso_enforcement` | Enterprise SAML 2.0 / OIDC SSO | INTEGRATION | BETA | Owner, Admin, Employee | `/settings/sso` | `GET/POST /api/v1/auth/sso/*` | `UJ-AUTH-005`, `UJ-ADM-010` |
| `FEAT-AUTH-006` | `auth_token_refresh` | JWT Token Auto-Renewal | CAPABILITY | ACTIVE | All Roles | Transparent | `POST /api/v1/auth/refresh` | `UJ-AUTH-006` |
| `FEAT-AUTH-007` | `rbac_route_protection` | Role Capability Guards | ADMINISTRATION| ACTIVE | All Roles | App-Wide | Middleware hooks | `UJ-AUTH-007` |
| `FEAT-AUTH-008` | `multi_org_switch` | Multi-Tenant Workspace Switcher| CAPABILITY | ACTIVE | Super Admin, Owner | Header | `GET /api/v1/organizations` | Internal |
| `FEAT-AUTH-009` | `scim_provisioning` | SCIM 2.0 Automated User Sync | INTEGRATION | INTERNAL | Super Admin, Admin | Background | `POST /api/v1/scim/v2/*` | Internal |

### Domain 2: Candidate Onboarding Experience (10 Capabilities)

| Feature ID | Feature Flag Key | Name | Type | Status | Allowed Roles | Frontend Route | Backend Endpoint | Linked Journey |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-ONB-001` | `onboarding_roadmap` | Interactive Candidate Roadmap | PAGE | ACTIVE | Employee | `/employee` | `GET /api/v1/onboarding/cases/me` | `UJ-ONB-001` |
| `FEAT-ONB-002` | `digital_signatures` | Compliance Document E-Signatures| WORKFLOW | ACTIVE | Employee | `/documents/:id/sign` | `POST /api/v1/documents/:id/sign` | `UJ-ONB-002` |
| `FEAT-ONB-003` | `checklist_tasks` | Candidate Task Checklist | CAPABILITY | ACTIVE | Employee | `/tasks` | `PATCH /api/v1/tasks/:id/status` | `UJ-ONB-003` |
| `FEAT-ONB-004` | `lms_course_player` | LMS Interactive Course Viewer | PAGE | ACTIVE | Employee | `/course/:id` | `GET /api/v1/journeys/courses/:id`| `UJ-ONB-004` |
| `FEAT-ONB-005` | `lms_assessments` | Course Quizzes & Knowledge Checks| CAPABILITY| ACTIVE | Employee | `/course/:id/quiz` | `POST /api/v1/journeys/quiz/submit`| `UJ-ONB-005` |
| `FEAT-ONB-006` | `milestone_ratings` | 30-60-90 Self-Rating Intake | CAPABILITY | ACTIVE | Employee | `/milestones` | `POST /api/v1/milestones/:id/rating`| `UJ-ONB-006` |
| `FEAT-ONB-007` | `buddy_connection` | Onboarding Buddy Chat & Info | CAPABILITY | ACTIVE | Employee | `/buddy` | `GET /api/v1/buddy/my-buddy` | `UJ-ONB-007` |
| `FEAT-ONB-008` | `graduation_handover`| Handover & Graduation Certificate| WORKFLOW | ACTIVE | Employee | `/certificates` | `GET /api/v1/certificates/me` | `UJ-ONB-008` |
| `FEAT-ONB-009` | `pwa_offline_sync` | Mobile PWA Offline Learning | CAPABILITY | BETA | Employee | Mobile Shell | Service Worker / IndexedDB | `UJ-ONB-009` |
| `FEAT-ONB-010` | `onboarding_copilot` | Virtual Onboarding AI Copilot | AI | BETA | Employee | `/employee` Widget | `POST /api/v1/ai/chat` | Internal |

### Domain 3: HR Administration & Journey Blueprinting (18 Capabilities)

| Feature ID | Feature Flag Key | Name | Type | Status | Allowed Roles | Frontend Route | Backend Endpoint | Linked Journey |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-ADM-001` | `journey_templates` | Journey Template Authoring | PAGE | ACTIVE | Admin, Owner, HR Admin | `/journeys` | `POST /api/v1/journeys` | `UJ-ADM-001` |
| `FEAT-ADM-002` | `journey_builder` | Visual Drag-and-Drop Builder | PAGE | ACTIVE | Admin, Owner, HR Admin | `/journeys/:id` | `PUT /api/v1/journeys/:id` | `UJ-ADM-001` |
| `FEAT-ADM-003` | `step_prerequisites`| Dynamic Step Prerequisite Gating| CAPABILITY| ACTIVE | Admin, Owner, HR Admin | `/journeys/:id` | `POST /api/v1/journeys/:id/rules` | `UJ-ADM-001` |
| `FEAT-ADM-004` | `employee_directory`| Employee Directory & Management | PAGE | ACTIVE | Admin, Owner, Manager | `/directory` | `GET /api/v1/employees` | `UJ-ADM-002` |
| `FEAT-ADM-005` | `employee_invite` | Candidate Invitation Dispatch | CAPABILITY | ACTIVE | Admin, Owner, HR Admin | `/directory` | `POST /api/v1/employees/invite` | `UJ-ADM-002` |
| `FEAT-ADM-006` | `bulk_csv_import` | Enterprise Bulk CSV Import | WORKFLOW | ACTIVE | Admin, Owner, HR Admin | `/directory` (Modal)| `POST /api/v1/employees/bulk-import`| `UJ-ADM-003` |
| `FEAT-ADM-007` | `workflow_rules` | Workflow Automation Rules Engine| PAGE | ACTIVE | Admin, Owner, HR Admin | `/workflows` | `GET /api/v1/workflows` | `UJ-ADM-004` |
| `FEAT-ADM-008` | `workflow_actions` | Trigger-Condition-Action Builder | WORKFLOW | ACTIVE | Admin, Owner, HR Admin | `/workflows/builder` | `POST /api/v1/workflows` | `UJ-ADM-004` |
| `FEAT-ADM-009` | `hr_ops_dashboard` | HR Operations Velocity Dashboard | PAGE | ACTIVE | Admin, Owner, HR Admin | `/hr-ops` | `GET /api/v1/hr/dashboard` | `UJ-ADM-005` |
| `FEAT-ADM-010` | `hr_exceptions` | Exceptions Workbench & SLA Triage | PAGE | ACTIVE | Admin, Owner, HR Admin | `/hr-ops/exceptions` | `GET /api/v1/hr/exceptions` | `UJ-ADM-005` |
| `FEAT-ADM-011` | `doc_templates` | Document Template Designer | PAGE | ACTIVE | Admin, Owner, HR Admin | `/documents` | `POST /api/v1/documents/templates`| `UJ-ADM-006` |
| `FEAT-ADM-012` | `doc_field_markers` | PDF Field Positioning (Canvas) | CAPABILITY | ACTIVE | Admin, Owner, HR Admin | `/documents/builder` | `PUT /api/v1/documents/fields` | `UJ-ADM-006` |
| `FEAT-ADM-013` | `task_templates` | Standalone Task Template Builder | PAGE | ACTIVE | Admin, Manager, HR Admin| `/tasks` | `POST /api/v1/tasks/templates` | `UJ-ADM-007` |
| `FEAT-ADM-014` | `task_due_offsets` | Relative Due-Date Offset Rules | AUTOMATION | ACTIVE | Admin, Manager, HR Admin| `/tasks` | `POST /api/v1/tasks/assign` | `UJ-ADM-007` |
| `FEAT-ADM-015` | `ai_course_builder` | Generative AI Course Generator | AI | ACTIVE | Admin, Owner, HR Admin | `/ai-course-builder` | `POST /api/v1/ai/generate-course`| `UJ-ADM-008` |
| `FEAT-ADM-016` | `org_branding` | Org Branding, Logos & Themes | ADMINISTRATION| ACTIVE | Admin, Owner | `/settings` | `PATCH /api/v1/organizations/me` | `UJ-ADM-009` |
| `FEAT-ADM-017` | `advanced_hris_sync`| HRIS Integrations Marketplace | INTEGRATION | BETA | Admin, Owner | `/settings/integrations`| `POST /api/v1/integrations/*` | `UJ-ADM-011` |
| `FEAT-ADM-018` | `tenant_analytics` | Executive Drop-Off Analytics | ANALYTICS | ACTIVE | Admin, Owner, Manager | `/analytics` | `GET /api/v1/analytics/overview` | `UJ-ADM-012` |

### Domain 4: Team Supervision & Manager Operations (7 Capabilities)

| Feature ID | Feature Flag Key | Name | Type | Status | Allowed Roles | Frontend Route | Backend Endpoint | Linked Journey |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-MGR-001` | `manager_dashboard`| Manager Team Operations View | PAGE | ACTIVE | Manager, Admin | `/manager` | `GET /api/v1/manager/team` | `UJ-MGR-001` |
| `FEAT-MGR-002` | `direct_report_view`| Direct Report Progress Dossier | PAGE | ACTIVE | Manager, Admin | `/directory/:id` | `GET /api/v1/manager/reports/:id`| `UJ-MGR-001` |
| `FEAT-MGR-003` | `milestone_approval`| 30-60-90 Milestone Approvals | WORKFLOW | ACTIVE | Manager, Admin | `/milestones` | `POST /api/v1/milestones/:id/eval`| `UJ-MGR-002` |
| `FEAT-MGR-004` | `task_verification` | Task Evidence & File Verification| WORKFLOW | ACTIVE | Manager, Admin | `/tasks` | `POST /api/v1/tasks/:id/verify` | `UJ-MGR-003` |
| `FEAT-MGR-005` | `checkin_scheduler` | 1-on-1 Check-In Meeting Scheduler| CAPABILITY | ACTIVE | Manager, Buddy | `/calendar` | `POST /api/v1/calendar/events` | `UJ-MGR-004` |
| `FEAT-MGR-006` | `buddy_assignment` | Direct Hire Buddy Pairing | WORKFLOW | ACTIVE | Manager, Admin | `/buddy` | `POST /api/v1/buddy/assign` | `UJ-MGR-005` |
| `FEAT-MGR-007` | `team_velocity` | Team Velocity & SLA Alerting | ANALYTICS | ACTIVE | Manager | `/manager` | `GET /api/v1/manager/velocity` | `UJ-MGR-001` |

### Domain 5: Mentorship & Buddy Program (4 Capabilities)

| Feature ID | Feature Flag Key | Name | Type | Status | Allowed Roles | Frontend Route | Backend Endpoint | Linked Journey |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-BUD-001` | `buddy_profile` | Buddy Profile & Capacity Setup | CAPABILITY | ACTIVE | Employee, Buddy | `/buddy/profile` | `POST /api/v1/buddy/profile` | `UJ-BUD-001` |
| `FEAT-BUD-002` | `mentee_tracking` | Mentee Progress Oversight | PAGE | ACTIVE | Buddy | `/buddy` | `GET /api/v1/buddy/mentees` | `UJ-BUD-002` |
| `FEAT-BUD-003` | `buddy_feedback` | Check-in Sentiment & Notes Log | CAPABILITY | ACTIVE | Buddy | `/buddy/notes` | `POST /api/v1/buddy/notes` | `UJ-BUD-003` |
| `FEAT-BUD-004` | `smart_buddy_match`| Algorithmic Buddy Matching | AUTOMATION | ACTIVE | Admin, Manager | `/buddy/match` | `POST /api/v1/buddy/auto-match` | `UJ-MGR-005` |

### Domain 6: Frontline & Touch Kiosk Systems (5 Capabilities)

| Feature ID | Feature Flag Key | Name | Type | Status | Allowed Roles | Frontend Route | Backend Endpoint | Linked Journey |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-KSK-001` | `kiosk_pairing` | 6-Digit Kiosk Device Pairing | INTEGRATION | ACTIVE | Admin, Kiosk Device | `/kiosks` | `POST /api/v1/kiosk/pair` | `UJ-KSK-001` |
| `FEAT-KSK-002` | `kiosk_mode` | Touchscreen Kiosk Player Mode | PAGE | BETA | Public / Device | `/kiosk/play/:id` | `GET /api/v1/kiosk/sessions/:id` | `UJ-KSK-002` |
| `FEAT-KSK-003` | `kiosk_audio_sop` | High-Contrast Audio SOP Playback | CAPABILITY | ACTIVE | Frontline Worker | `/kiosk/play/:id` | `GET /api/v1/kiosk/sop/:id` | `UJ-KSK-003` |
| `FEAT-KSK-004` | `kiosk_safety_check`| Touch PPE Safety Checklists | CAPABILITY | ACTIVE | Frontline Worker | `/kiosk/play/:id` | `POST /api/v1/kiosk/ppe-confirm` | `UJ-KSK-003` |
| `FEAT-KSK-005` | `kiosk_telemetry` | Device Heartbeat & Offline Cache | AUTOMATION | ACTIVE | Kiosk Device | Background | `POST /api/v1/kiosk/heartbeat` | `UJ-KSK-004` |

### Domain 7: IT Administration & Hardware Provisioning (4 Capabilities)

| Feature ID | Feature Flag Key | Name | Type | Status | Allowed Roles | Frontend Route | Backend Endpoint | Linked Journey |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-IT-001` | `it_ops_queue` | IT Hardware Provisioning Queue | PAGE | ACTIVE | IT Admin, Admin | `/tasks/it-ops` | `GET /api/v1/tasks/it-ops` | `UJ-IT-001` |
| `FEAT-IT-002` | `it_asset_tracking`| Asset Serial & Model Tagging | CAPABILITY | ACTIVE | IT Admin, Admin | `/tasks/it-ops` | `PATCH /api/v1/tasks/it-ops/:id` | `UJ-IT-001` |
| `FEAT-IT-003` | `it_shipping_flow` | Hardware Shipping & Delivery Flow| WORKFLOW | ACTIVE | IT Admin, Admin | `/tasks/it-ops` | `POST /api/v1/tasks/it-ops/:id/ship`| `UJ-IT-001` |
| `FEAT-IT-004` | `it_access_setup` | Software Accounts Provisioning | CAPABILITY | ACTIVE | IT Admin | `/tasks/it-ops` | `POST /api/v1/tasks/it-ops/:id/access`| `UJ-IT-001` |

### Domain 8: Engagement, Gamification & Recognition (5 Capabilities)

| Feature ID | Feature Flag Key | Name | Type | Status | Allowed Roles | Frontend Route | Backend Endpoint | Linked Journey |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-GAM-001` | `gamified_milestones`| Learner Gamification Points Engine| CAPABILITY | ACTIVE | All Roles | `/leaderboard` | `GET /api/v1/gamification/points`| `UJ-OPS-001` |
| `FEAT-GAM-002` | `gamification_badges`| Achievement Badges & Awards | CAPABILITY | ACTIVE | All Roles | `/leaderboard` | `GET /api/v1/gamification/badges`| `UJ-OPS-001` |
| `FEAT-GAM-003` | `learner_streaks` | Daily Learning Streak Engine | CAPABILITY | ACTIVE | Employee | `/employee` | `GET /api/v1/gamification/streaks`| `UJ-OPS-001` |
| `FEAT-GAM-004` | `leaderboard_view` | Organization Leaderboard Page | PAGE | ACTIVE | All Roles | `/leaderboard` | `GET /api/v1/gamification/leaderboard`| `UJ-OPS-001`|
| `FEAT-GAM-005` | `level_progression` | Experience Level Progression | CAPABILITY | ACTIVE | Employee | `/employee` | `GET /api/v1/gamification/level` | `UJ-OPS-001` |

### Domain 9: Workplace Wayfinding, Maps & Scheduling (6 Capabilities)

| Feature ID | Feature Flag Key | Name | Type | Status | Allowed Roles | Frontend Route | Backend Endpoint | Linked Journey |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-LOC-001` | `office_map` | Interactive Floorplan Map Viewer | PAGE | ACTIVE | All Roles | `/office-map` | `GET /api/v1/locations/floors` | `UJ-OPS-002` |
| `FEAT-LOC-002` | `desk_pins` | Desk & Amenity Visual Pins | CAPABILITY | ACTIVE | All Roles | `/office-map` | `GET /api/v1/locations/pins` | `UJ-OPS-002` |
| `FEAT-LOC-003` | `map_wayfinding` | Visual Wayfinding & Pathfinding | CAPABILITY | ACTIVE | All Roles | `/office-map` | Client Algorithm | `UJ-OPS-002` |
| `FEAT-CAL-001` | `calendar_integration`| Google / Outlook Calendar Sync | INTEGRATION | ACTIVE | All Roles | `/calendar` | `POST /api/v1/calendar/sync` | `UJ-MGR-004` |
| `FEAT-CAL-002` | `meeting_automation` | Auto-Scheduled Orientation Meets| AUTOMATION | ACTIVE | Admin, Manager | `/calendar` | `POST /api/v1/calendar/auto` | `UJ-ADM-004` |
| `FEAT-CAL-003` | `ical_feed` | Personal iCal Calendar Feed URL | CAPABILITY | ACTIVE | All Roles | `/calendar` | `GET /api/v1/calendar/feed.ics` | Internal |

### Domain 10: Knowledge Base & AI Intelligence (5 Capabilities)

| Feature ID | Feature Flag Key | Name | Type | Status | Allowed Roles | Frontend Route | Backend Endpoint | Linked Journey |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-KB-001` | `knowledge_base` | Categorized Knowledge Base | PAGE | ACTIVE | All Roles | `/kb` | `GET /api/v1/knowledge-base/articles`| `UJ-KB-001` |
| `FEAT-KB-002` | `kb_slideshow` | Fullscreen Presentation Slideshow| PAGE | ACTIVE | All Roles | `/kb/slideshow` | Client State | `UJ-KB-001` |
| `FEAT-AI-001` | `ai_assistant` | Interactive AI Q&A Assistant | AI | ACTIVE | All Roles | `/ai-assistant` | `POST /api/v1/ai/assistant/chat` | `UJ-KB-002` |
| `FEAT-AI-002` | `rag_policy_search`| RAG Vector Search over Handbooks| AI | ACTIVE | All Roles | `/ai-assistant` | `POST /api/v1/ai/rag/query` | `UJ-KB-002` |
| `FEAT-AI-003` | `ai_response_feedback`| AI Rating & Answer Feedback | CAPABILITY | ACTIVE | All Roles | `/ai-assistant` | `POST /api/v1/ai/feedback` | Internal |

### Domain 11: Public Compliance & Cryptographic Verification (4 Capabilities)

| Feature ID | Feature Flag Key | Name | Type | Status | Allowed Roles | Frontend Route | Backend Endpoint | Linked Journey |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-CER-001` | `certificates` | Digital Completion Certificates | PAGE | ACTIVE | Employee, Admin | `/certificates` | `GET /api/v1/certificates` | `UJ-ONB-008` |
| `FEAT-CER-002` | `public_qr_verify` | Public QR Code Certificate Page | PAGE | ACTIVE | Public | `/public/certificate/:id`| `GET /api/v1/certificates/public/:id`| `UJ-OPS-003`|
| `FEAT-CER-003` | `sha256_audit_seal`| SHA-256 Tamper-Evident Signatures| CAPABILITY | ACTIVE | Public, Admin | `/public/certificate/:id`| Computed hash | `UJ-OPS-003` |
| `FEAT-CER-004` | `cert_pdf_download` | Client PDF Certificate Render | CAPABILITY | ACTIVE | Employee, Public | `/certificates` | `GET /api/v1/certificates/:id/pdf` | `UJ-ONB-008` |

### Domain 12: Super Admin Enterprise Control Plane (18 Capabilities)

| Feature ID | Feature Flag Key | Name | Type | Status | Allowed Roles | Frontend Route | Backend Endpoint | Linked Journey |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-SUP-001` | `super_admin_core` | Super Admin Command Center Hub | PAGE | ACTIVE | Super Admin | `/super-admin` | `GET /api/v1/super-admin/telemetry`| `UJ-SUP-001` |
| `FEAT-SUP-002` | `tenant_oversight` | Organization 360 Dossier & Health| PAGE | ACTIVE | Super Admin | `/super-admin/organizations/:id`| `GET /api/v1/super-admin/organizations/:id/360`| `UJ-SUP-001` |
| `FEAT-SUP-003` | `tenant_lifecycle` | Tenant Quarantine & Suspension | WORKFLOW | ACTIVE | Super Admin | `/super-admin/organizations/:id`| `POST /api/v1/super-admin/organizations/:id/quarantine`| `UJ-SUP-002` |
| `FEAT-SUP-004` | `user_360` | User 360 & Impersonation | PAGE | ACTIVE | Super Admin | `/super-admin/users/:id` | `GET /api/v1/super-admin/users/:id/360`| `UJ-SUP-002` |
| `FEAT-SUP-005` | `session_tracker` | Active JWT Session Management | PAGE | ACTIVE | Super Admin | `/super-admin/users/sessions`| `GET /api/v1/super-admin/sessions`| `UJ-SUP-002` |
| `FEAT-SUP-006` | `session_kill` | Force User Logout & Kill Session | CAPABILITY | ACTIVE | Super Admin | `/super-admin/users/sessions`| `POST /api/v1/super-admin/sessions/:id/revoke`| `UJ-SUP-002` |
| `FEAT-SUP-007` | `b2b_invoicing` | Itemized Invoice Engine | PAGE | ACTIVE | Super Admin | `/super-admin/finance/invoices`| `POST /api/v1/super-admin/finance/invoices`| `UJ-SUP-003` |
| `FEAT-SUP-008` | `payment_receipts` | Partial Payment Reconciliation | WORKFLOW | ACTIVE | Super Admin | `/super-admin/finance/payments`| `POST /api/v1/super-admin/finance/payments`| `UJ-SUP-003` |
| `FEAT-SUP-009` | `operating_expenses`| Authoritative Expense Tracking | CAPABILITY | ACTIVE | Super Admin | `/super-admin/finance/expenses`| `POST /api/v1/super-admin/finance/expenses`| `UJ-SUP-003` |
| `FEAT-SUP-010` | `customer_accounts`| Commercial Tiers & Credit Holds | PAGE | ACTIVE | Super Admin | `/super-admin/finance/accounts`| `GET /api/v1/super-admin/finance/accounts`| `UJ-SUP-003` |
| `FEAT-SUP-011` | `api_ring_buffer` | Fastify Live Latency Telemetry | CAPABILITY | ACTIVE | Super Admin | `/super-admin/observability/api`| `GET /api/v1/super-admin/observability/api`| `SA-OBS-001` |
| `FEAT-SUP-012` | `ai_token_tracker` | AI Token & Cost Telemetry Buffer | CAPABILITY | ACTIVE | Super Admin | `/super-admin/observability/ai` | `GET /api/v1/super-admin/observability/ai`| `SA-OBS-002` |
| `FEAT-SUP-013` | `alert_triage` | Incident Alert Lifecycle Engine | PAGE | ACTIVE | Super Admin | `/super-admin/alerts` | `PATCH /api/v1/super-admin/alerts/:id/status`| `SA-ALT-001` |
| `FEAT-SUP-014` | `advanced_reporting`| 15 Streaming Canonical Reports | REPORTING | ACTIVE | Super Admin | `/super-admin/reports` | `GET /api/v1/super-admin/reports/:id/export`| `SA-REP-001` |
| `FEAT-SUP-015` | `maintenance_guard`| Global Maintenance Mode Hook | ADMINISTRATION| ACTIVE | Super Admin | `/super-admin/settings/platform`| `PATCH /api/v1/super-admin/settings/platform`| `SA-SET-001` |
| `FEAT-SUP-016` | `feature_governance`| Feature Flag Overrides Center | PAGE | ACTIVE | Super Admin | `/super-admin/settings/flags`| `PATCH /api/v1/super-admin/settings/flags/:key`| `SA-PF-001` |
| `FEAT-SUP-017` | `feature_adoption` | Feature Adoption Telemetry View | PAGE | BETA | Super Admin | `/super-admin/product/features`| Hardcoded mock (needs API) | Internal |
| `FEAT-SUP-018` | `cross_tenant_search`| Global Cross-Tenant Omnisearch | CAPABILITY | ACTIVE | Super Admin | Header / Command Palette | `GET /api/v1/super-admin/search` | Internal |

---

## 3. Summary Statistics

* **Total Cataloged Capabilities:** 105
* **Domain Distribution:**
  1. Identity & Access: 9 (8.6%)
  2. Candidate Onboarding: 10 (9.5%)
  3. HR Administration: 18 (17.1%)
  4. Team Supervision: 7 (6.7%)
  5. Mentorship: 4 (3.8%)
  6. Frontline Kiosk: 5 (4.8%)
  7. IT Provisioning: 4 (3.8%)
  8. Gamification: 5 (4.8%)
  9. Workplace & Maps: 6 (5.7%)
  10. Knowledge & AI: 5 (4.8%)
  11. Public Verification: 4 (3.8%)
  12. Super Admin Control Plane: 18 (17.1%)
* **Lifecycle Distribution:**
  * Active (GA): 95 (90.5%)
  * Beta: 8 (7.6%)
  * Internal: 2 (1.9%)
  * Experimental / Deprecated: 0 (0.0%)
