# Canonical Feature Registry Specification

> **Document Status:** Authoritative Single Source of Truth  
> **System:** Talnova Onboarding Enterprise Platform  
> **Total Cataloged Capabilities:** 105  
> **Date:** September 2026  

---

## 1. Governance Registry Standard

This registry serves as the authoritative single source of truth for the Talnova Onboarding platform. All subsystems (Feature Flags, Navigation, Route Guards, Backend API Hooks, Adoption Dashboards, and Event Subscribers) derive their identifiers and configuration directly from this canonical catalog.

```
┌─────────────────────────────────────────────────────────────┐
│                 CANONICAL FEATURE REGISTRY                  │
│                                                             │
│  Key Format: snake_case (e.g. 'ai_course_builder')         │
│  ID Format:  FEAT-[DOMAIN]-[SEQ]                            │
│  Total Features: 105                                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
FEATURE FLAGS          UI ENFORCEMENT          ADOPTION ENGINE
`FeatureFlag.key`      `hasFeature(key)`       `FeatureUsageRecord.key`
```

---

## 2. Complete Canonical Feature Catalog (105 Capabilities)

### 1. Identity, Authentication & Tenant Access (9 Capabilities)
1. `FEAT-AUTH-001` | `auth_credentials` | Password-Based Authentication
2. `FEAT-AUTH-002` | `auth_session_revocation` | Secure Session Termination
3. `FEAT-AUTH-003` | `auth_self_registration` | Invitation & Self-Registration
4. `FEAT-AUTH-004` | `auth_password_reset` | Password Recovery & Reset
5. `FEAT-AUTH-005` | `sso_enforcement` | Enterprise SAML 2.0 / OIDC SSO
6. `FEAT-AUTH-006` | `auth_token_refresh` | JWT Token Auto-Renewal
7. `FEAT-AUTH-007` | `rbac_route_protection` | Role Capability Guards
8. `FEAT-AUTH-008` | `multi_org_switch` | Multi-Tenant Workspace Switcher
9. `FEAT-AUTH-009` | `scim_provisioning` | SCIM 2.0 Automated User Sync

### 2. Candidate Onboarding Experience (10 Capabilities)
10. `FEAT-ONB-001` | `onboarding_roadmap` | Interactive Candidate Roadmap
11. `FEAT-ONB-002` | `digital_signatures` | Compliance Document E-Signatures
12. `FEAT-ONB-003` | `checklist_tasks` | Candidate Task Checklist
13. `FEAT-ONB-004` | `lms_course_player` | LMS Interactive Course Viewer
14. `FEAT-ONB-005` | `lms_assessments` | Course Quizzes & Knowledge Checks
15. `FEAT-ONB-006` | `milestone_ratings` | 30-60-90 Self-Rating Intake
16. `FEAT-ONB-007` | `buddy_connection` | Onboarding Buddy Chat & Info
17. `FEAT-ONB-008` | `graduation_handover` | Handover & Graduation Certificate
18. `FEAT-ONB-009` | `pwa_offline_sync` | Mobile PWA Offline Learning
19. `FEAT-ONB-010` | `onboarding_copilot` | Virtual Onboarding AI Copilot

### 3. HR Administration & Journey Blueprinting (18 Capabilities)
20. `FEAT-ADM-001` | `journey_templates` | Journey Template Authoring
21. `FEAT-ADM-002` | `journey_builder` | Visual Drag-and-Drop Builder
22. `FEAT-ADM-003` | `step_prerequisites` | Dynamic Step Prerequisite Gating
23. `FEAT-ADM-004` | `employee_directory` | Employee Directory & Management
24. `FEAT-ADM-005` | `employee_invite` | Candidate Invitation Dispatch
25. `FEAT-ADM-006` | `bulk_csv_import` | Enterprise Bulk CSV Import
26. `FEAT-ADM-007` | `workflow_rules` | Workflow Automation Rules Engine
27. `FEAT-ADM-008` | `workflow_actions` | Trigger-Condition-Action Builder
28. `FEAT-ADM-009` | `hr_ops_dashboard` | HR Operations Velocity Dashboard
29. `FEAT-ADM-010` | `hr_exceptions` | Exceptions Workbench & SLA Triage
30. `FEAT-ADM-011` | `doc_templates` | Document Template Designer
31. `FEAT-ADM-012` | `doc_field_markers` | PDF Field Positioning (Canvas)
32. `FEAT-ADM-013` | `task_templates` | Standalone Task Template Builder
33. `FEAT-ADM-014` | `task_due_offsets` | Relative Due-Date Offset Rules
34. `FEAT-ADM-015` | `ai_course_builder` | Generative AI Course Generator
35. `FEAT-ADM-016` | `org_branding` | Org Branding, Logos & Themes
36. `FEAT-ADM-017` | `advanced_hris_sync` | HRIS Integrations Marketplace
37. `FEAT-ADM-018` | `tenant_analytics` | Executive Drop-Off Analytics

### 4. Team Supervision & Manager Operations (7 Capabilities)
38. `FEAT-MGR-001` | `manager_dashboard` | Manager Team Operations View
39. `FEAT-MGR-002` | `direct_report_view` | Direct Report Progress Dossier
40. `FEAT-MGR-003` | `milestone_approval` | 30-60-90 Milestone Approvals
41. `FEAT-MGR-004` | `task_verification` | Task Evidence & File Verification
42. `FEAT-MGR-005` | `checkin_scheduler` | 1-on-1 Check-In Meeting Scheduler
43. `FEAT-MGR-006` | `buddy_assignment` | Direct Hire Buddy Pairing
44. `FEAT-MGR-007` | `team_velocity` | Team Velocity & SLA Alerting

### 5. Mentorship & Buddy Program (4 Capabilities)
45. `FEAT-BUD-001` | `buddy_profile` | Buddy Profile & Capacity Setup
46. `FEAT-BUD-002` | `mentee_tracking` | Mentee Progress Oversight
47. `FEAT-BUD-003` | `buddy_feedback` | Check-in Sentiment & Notes Log
48. `FEAT-BUD-004` | `smart_buddy_match` | Algorithmic Buddy Matching

### 6. Frontline & Touch Kiosk Systems (5 Capabilities)
49. `FEAT-KSK-001` | `kiosk_pairing` | 6-Digit Kiosk Device Pairing
50. `FEAT-KSK-002` | `kiosk_mode` | Touchscreen Kiosk Player Mode
51. `FEAT-KSK-003` | `kiosk_audio_sop` | High-Contrast Audio SOP Playback
52. `FEAT-KSK-004` | `kiosk_safety_check`| Touch PPE Safety Checklists
53. `FEAT-KSK-005` | `kiosk_telemetry` | Device Heartbeat & Offline Cache

### 7. IT Administration & Hardware Provisioning (4 Capabilities)
54. `FEAT-IT-001` | `it_ops_queue` | IT Hardware Provisioning Queue
55. `FEAT-IT-002` | `it_asset_tracking` | Asset Serial & Model Tagging
56. `FEAT-IT-003` | `it_shipping_flow` | Hardware Shipping & Delivery Flow
57. `FEAT-IT-004` | `it_access_setup` | Software Accounts Provisioning

### 8. Engagement, Gamification & Recognition (5 Capabilities)
58. `FEAT-GAM-001` | `gamified_milestones` | Learner Gamification Points Engine
59. `FEAT-GAM-002` | `gamification_badges` | Achievement Badges & Awards
60. `FEAT-GAM-003` | `learner_streaks` | Daily Learning Streak Engine
61. `FEAT-GAM-004` | `leaderboard_view` | Organization Leaderboard Page
62. `FEAT-GAM-005` | `level_progression` | Experience Level Progression

### 9. Workplace Wayfinding, Maps & Scheduling (6 Capabilities)
63. `FEAT-LOC-001` | `office_map` | Interactive Floorplan Map Viewer
64. `FEAT-LOC-002` | `desk_pins` | Desk & Amenity Visual Pins
65. `FEAT-LOC-003` | `map_wayfinding` | Visual Wayfinding & Pathfinding
66. `FEAT-CAL-001` | `calendar_integration`| Google / Outlook Calendar Sync
67. `FEAT-CAL-002` | `meeting_automation` | Auto-Scheduled Orientation Meets
68. `FEAT-CAL-003` | `ical_feed` | Personal iCal Calendar Feed URL

### 10. Knowledge Base & AI Intelligence (5 Capabilities)
69. `FEAT-KB-001` | `knowledge_base` | Categorized Knowledge Base
70. `FEAT-KB-002` | `kb_slideshow` | Fullscreen Presentation Slideshow
71. `FEAT-AI-001` | `ai_assistant` | Interactive AI Q&A Assistant
72. `FEAT-AI-002` | `rag_policy_search` | RAG Vector Search over Handbooks
73. `FEAT-AI-003` | `ai_response_feedback`| AI Rating & Answer Feedback

### 11. Public Compliance & Cryptographic Verification (4 Capabilities)
74. `FEAT-CER-001` | `certificates` | Digital Completion Certificates
75. `FEAT-CER-002` | `public_qr_verify` | Public QR Code Certificate Page
76. `FEAT-CER-003` | `sha256_audit_seal` | SHA-256 Tamper-Evident Signatures
77. `FEAT-CER-004` | `cert_pdf_download` | Client PDF Certificate Render

### 12. Super Admin Enterprise Control Plane (18 Capabilities)
78. `FEAT-SUP-001` | `super_admin_core` | Super Admin Command Center Hub
79. `FEAT-SUP-002` | `tenant_oversight` | Organization 360 Dossier & Health
80. `FEAT-SUP-003` | `tenant_lifecycle` | Tenant Quarantine & Suspension
81. `FEAT-SUP-004` | `user_360` | User 360 & Impersonation
82. `FEAT-SUP-005` | `session_tracker` | Active JWT Session Management
83. `FEAT-SUP-006` | `session_kill` | Force User Logout & Kill Session
84. `FEAT-SUP-007` | `b2b_invoicing` | Itemized Invoice Engine
85. `FEAT-SUP-008` | `payment_receipts` | Partial Payment Reconciliation
86. `FEAT-SUP-009` | `operating_expenses`| Authoritative Expense Tracking
87. `FEAT-SUP-010` | `customer_accounts` | Commercial Tiers & Credit Holds
88. `FEAT-SUP-011` | `api_ring_buffer` | Fastify Live Latency Telemetry
89. `FEAT-SUP-012` | `ai_token_tracker` | AI Token & Cost Telemetry Buffer
90. `FEAT-SUP-013` | `alert_triage` | Incident Alert Lifecycle Engine
91. `FEAT-SUP-014` | `advanced_reporting`| 15 Streaming Canonical Reports
92. `FEAT-SUP-015` | `maintenance_guard` | Global Maintenance Mode Hook
93. `FEAT-SUP-016` | `feature_governance` | Feature Flag Overrides Center
94. `FEAT-SUP-017` | `feature_adoption` | Feature Adoption Telemetry View
95. `FEAT-SUP-018` | `cross_tenant_search`| Global Cross-Tenant Omnisearch
96. `FEAT-SUP-019` | `audit_log_viewer` | Platform Security Audit Trail
97. `FEAT-SUP-020` | `organization_export`| Tenant Data Portability & Archive
98. `FEAT-SUP-021` | `security_policy_enforcement`| MFA & Session Timeout Guard
99. `FEAT-SUP-022` | `infra_telemetry` | Node & Database Health Observability
100. `FEAT-SUP-023`| `storage_telemetry` | S3 / Local Media Asset Metrics
101. `FEAT-SUP-024`| `revenue_recognition`| Deterministic MRR & ARR Accounting
102. `FEAT-SUP-025`| `cash_reconciliation`| Authoritative Cash Collection Math
103. `FEAT-SUP-026`| `tenant_credit_limits`| Enterprise Credit Hold Governance
104. `FEAT-SUP-027`| `task_sla_monitoring`| Cross-Tenant SLA Bottleneck Heatmap
105. `FEAT-SUP-028`| `onboarding_funnels` | Cross-Tenant Onboarding Progression
