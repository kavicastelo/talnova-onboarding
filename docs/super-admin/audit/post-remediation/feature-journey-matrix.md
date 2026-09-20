# Feature-to-User Journey Traceability Matrix

> **Document Status:** Authoritative Journey Impact & Graceful Degradation Matrix  
> **System:** Talnova Onboarding Enterprise Platform  
> **Total Journeys Audited:** 49 User Journeys  
> **Date:** September 2026  

---

## 1. Journey Degradation Architecture

When a feature is disabled by the Super Admin, associated user journeys must handle the disablement gracefully:
1. **Bypass / Skip:** If the step is optional (e.g., Buddy Meet or Leaderboard view), the journey should skip the step without stalling candidate progression.
2. **Graceful Fallback:** If an AI or automated feature is disabled (e.g., AI Course Builder), the system must fallback to manual authoring rather than throwing errors.
3. **Hard Blocker:** If a mandatory compliance feature is disabled (e.g., E-Signatures or Compliance Quiz), the journey cannot progress, and HR Operations must be notified of an administrative policy conflict.

---

## 2. 49-Journey Governance & Degradation Matrix

| Journey ID | Journey Name | Associated Feature Flag | Current Behavior if Flag Disabled | Target Desired Degradation Semantics |
| :--- | :--- | :--- | :--- | :--- |
| **UJ-AUTH-001** | User Login (Credentials) | `auth_credentials` | Allowed (Core Access) | Core system capability; cannot be disabled. |
| **UJ-AUTH-002** | User Logout & Invalidation | `auth_session_revocation` | Allowed (Core Security) | Core system capability; cannot be disabled. |
| **UJ-AUTH-003** | User Self-Registration | `auth_self_registration` | Allowed (Public) | When disabled, displays "Registration closed by administrator". |
| **UJ-AUTH-004** | Password Reset & Recovery | `auth_password_reset` | Allowed (Public) | When disabled, displays "Self-service password reset unavailable". |
| **UJ-AUTH-005** | Enterprise SSO Discovery | `sso_enforcement` | Route blocked; API works | Redirects to standard credential login fallback. |
| **UJ-AUTH-006** | Token Refresh & Renewal | `auth_token_refresh` | Allowed (Core Engine) | Core system capability; cannot be disabled. |
| **UJ-AUTH-007** | Route Rejection & RBAC | `rbac_route_protection` | Allowed (Core Security) | Core system capability; cannot be disabled. |
| **UJ-ONB-001** | Personal Roadmap View | `onboarding_roadmap` | Page loads normally | Reverts to simplified flat checklist view. |
| **UJ-ONB-002** | Compliance E-Signature | `digital_signatures` | Signature canvas active | Halts compliance step; alerts HR Ops with exception. |
| **UJ-ONB-003** | Checklist Task Execution | `checklist_tasks` | Tasks active | Core onboarding capability; cannot be disabled. |
| **UJ-ONB-004** | LMS Course Lesson Player| `lms_course_player` | Course loads normally | Hides course player; marks as pending external training. |
| **UJ-ONB-005** | LMS Assessment Quiz | `lms_assessments` | Quiz loads normally | Skips quiz step or converts to manual HR sign-off. |
| **UJ-ONB-006** | 30-60-90 Self-Rating | `milestone_ratings` | Form loads normally | Skips candidate rating; triggers manager direct evaluation. |
| **UJ-ONB-007** | Onboarding Buddy Connect| `buddy_connection` | Buddy view active | Skips buddy step on candidate roadmap. |
| **UJ-ONB-008** | Handover & Certificate | `graduation_handover` | Certificate loads | Issues completion email without PDF certificate seal. |
| **UJ-ONB-009** | PWA Offline Sync | `pwa_offline_sync` | Service Worker caches | Disables offline caching; requires active internet connection. |
| **UJ-ADM-001** | Journey Template Author | `journey_templates` | Template builder active | Disables new template authoring; allows viewing existing. |
| **UJ-ADM-002** | Employee Directory & Inv | `employee_directory` | Directory active | Core administration; cannot be disabled globally. |
| **UJ-ADM-003** | Bulk CSV Import | `bulk_csv_import` | Modal active | Hides "Bulk Import" button; enforces single invitations. |
| **UJ-ADM-004** | Workflow Automation Rule| `workflow_rules` | Workflow builder active | Freezes automated rule trigger engine; logs warning. |
| **UJ-ADM-005** | HR Ops Handover Verify | `hr_ops_dashboard` | Dashboard active | Reverts to individual employee dossier inspection. |
| **UJ-ADM-006** | Document Template Design| `doc_templates` | Template designer active| Disables new template creation; retains active templates. |
| **UJ-ADM-007** | Standalone Task Template| `task_templates` | Task builder active | Disables template creation; allows manual task entry. |
| **UJ-ADM-008** | AI Course Builder Gen | `ai_course_builder` | Route blocked / 403 API | Hides AI generator button; redirects to manual course editor. |
| **UJ-ADM-009** | Org Branding & Themes | `org_branding` | Settings active | Reverts to default Talnova system blue theme. |
| **UJ-ADM-010** | Enterprise SSO Config | `sso_enforcement` | Route blocked | Disables SSO settings tab in organization admin. |
| **UJ-ADM-011** | HRIS Marketplace Sync | `advanced_hris_sync` | Route blocked | Disables automated webhooks; requires manual CSV import. |
| **UJ-ADM-012** | Company Drop-Off Analytics| `tenant_analytics` | Analytics loads | Reverts to raw employee completion lists. |
| **UJ-MGR-001** | Team Progress Monitoring| `manager_dashboard` | Manager view active | Core management capability; cannot be disabled. |
| **UJ-MGR-002** | 30-60-90 Approvals | `milestone_approval` | Approval modal active | Auto-advances milestones or escalates to HR Admin. |
| **UJ-MGR-003** | Direct Report Task Sign | `task_verification` | Verification active | Tasks auto-complete upon candidate submission. |
| **UJ-MGR-004** | 1-on-1 Meeting Scheduler| `checkin_scheduler` | Calendar active | Instructs manager to book via direct email/calendar. |
| **UJ-MGR-005** | Assign Onboarding Buddy | `buddy_assignment` | Assignment active | Hides buddy pairing interface; disables buddy prompts. |
| **UJ-BUD-001** | Buddy Profile Setup | `buddy_profile` | Profile form active | Hides buddy availability toggle in profile. |
| **UJ-BUD-002** | Review Mentee Progress | `mentee_tracking` | Mentee card active | Disables buddy mentee view. |
| **UJ-BUD-003** | Log Buddy Check-In Notes| `buddy_feedback` | Note form active | Disables check-in notes log. |
| **UJ-KSK-001** | Pair Kiosk Device | `kiosk_pairing` | Pairing screen active | Disables new terminal pairings; rejects 6-digit code. |
| **UJ-KSK-002** | Launch Kiosk Player | `kiosk_mode` | Route blocked | Displays "Kiosk Terminal Disabled by Administrator". |
| **UJ-KSK-003** | SOP Playback & PPE Touch| `kiosk_audio_sop` | SOP player active | Displays static warning notice. |
| **UJ-KSK-004** | Kiosk Heartbeat Sync | `kiosk_telemetry` | Heartbeat API active | Kiosk device enters local standby mode. |
| **UJ-SUP-001** | Tenant Provisioning | `super_admin_core` | Core platform control | Core system capability; cannot be disabled. |
| **UJ-SUP-002** | Manage Tenants & Subs | `tenant_oversight` | Core platform control | Core system capability; cannot be disabled. |
| **UJ-SUP-003** | Cross-Tenant Finance | `b2b_invoicing` | Core platform control | Core system capability; cannot be disabled. |
| **UJ-OPS-001** | Leaderboard & Badges | `gamified_milestones`| Leaderboard loads | Hides Leaderboard navigation; pauses streak counter. |
| **UJ-OPS-002** | Interactive Office Map | `office_map` | Floorplan loads | Hides Office Map navigation link. |
| **UJ-OPS-003** | Public QR Verification | `public_qr_verify` | Public page loads | Displays "Certificate verification temporarily offline". |
| **UJ-KB-001** | Knowledge Base Articles | `knowledge_base` | KB articles load | Hides Knowledge Base sidebar item. |
| **UJ-KB-002** | Query AI Policy Assistant| `ai_assistant` | AI assistant active | Hides AI Assistant drawer; directs users to KB search. |
| **UJ-IT-001** | IT Hardware Provisioning| `it_ops_queue` | Queue loads | Hides IT queue; routes asset tasks to general checklist. |

---

## 3. Impact Assessment Summary

* **Graceful Degradation Readiness:** Only 2 journeys (`UJ-ADM-008` AI Course Builder and `UJ-KSK-002` Kiosk Mode) currently implement graceful fallback handling when disabled.
* **Unguarded Journeys:** 47 journeys continue executing in full without degradation because their underlying feature flags are either missing, decoupled, or not checked.
