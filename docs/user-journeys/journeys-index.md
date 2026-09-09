# Master User Journeys Inventory Index

> **Document Status:** Authoritative Journey Catalog  
> **Target System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Total Journeys Identified:** 49

---

## 1. Master Journey Index Table

| ID | Journey Name | Primary Role | Category | Priority | Implementation Status | Test Prompt | Audit Document |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **UJ-AUTH-001** | User Login (Credentials) | All Users | Authentication | `P0` | `IMPLEMENTED` | [UJ-AUTH-001.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-AUTH-001.md) | None (Passing) |
| **UJ-AUTH-002** | User Logout & Session Invalidation | All Users | Authentication | `P0` | `IMPLEMENTED` | [UJ-AUTH-002.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-AUTH-002.md) | None (Passing) |
| **UJ-AUTH-003** | User Self-Registration | Public | Authentication | `P1` | `IMPLEMENTED` | [UJ-AUTH-003.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-AUTH-003.md) | None (Passing) |
| **UJ-AUTH-004** | Password Reset & Recovery | All Users | Authentication | `P1` | `IMPLEMENTED` | [UJ-AUTH-004.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-AUTH-004.md) | None (Passing) |
| **UJ-AUTH-005** | Enterprise SSO Discovery & Initiation | Owner / Employee | Authentication | `P2` | `PARTIALLY_IMPLEMENTED` | [UJ-AUTH-005.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-AUTH-005.md) | [UJ-AUTH-005.md](file:///d:/talnova/talnova-onboarding/docs/audits/current/user-journeys/UJ-AUTH-005.md) |
| **UJ-AUTH-006** | Token Refresh & Session Renewal | All Users | Authentication | `P0` | `IMPLEMENTED` | [UJ-AUTH-006.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-AUTH-006.md) | None (Passing) |
| **UJ-AUTH-007** | Unauthorized Access & Route Rejection | All Users | Authentication | `P0` | `IMPLEMENTED` | [UJ-AUTH-007.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-AUTH-007.md) | None (Passing) |
| **UJ-ONB-001** | View Personal Roadmap & Active Phase | Employee | Onboarding | `P0` | `IMPLEMENTED` | [UJ-ONB-001.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ONB-001.md) | None (Passing) |
| **UJ-ONB-002** | Mandatory Compliance E-Signature | Employee | Onboarding | `P0` | `IMPLEMENTED` | [UJ-ONB-002.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ONB-002.md) | None (Passing) |
| **UJ-ONB-003** | Execute Personal Checklist Tasks | Employee | Onboarding | `P1` | `IMPLEMENTED` | [UJ-ONB-003.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ONB-003.md) | None (Passing) |
| **UJ-ONB-004** | Complete LMS Course Lessons | Employee | Onboarding | `P1` | `IMPLEMENTED` | [UJ-ONB-004.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ONB-004.md) | None (Passing) |
| **UJ-ONB-005** | Take LMS Assessment Quiz | Employee | Onboarding | `P1` | `IMPLEMENTED` | [UJ-ONB-005.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ONB-005.md) | None (Passing) |
| **UJ-ONB-006** | Submit Day 30-60-90 Self-Rating | Employee | Onboarding | `P1` | `IMPLEMENTED` | [UJ-ONB-006.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ONB-006.md) | None (Passing) |
| **UJ-ONB-007** | View & Connect with Onboarding Buddy | Employee | Onboarding | `P2` | `IMPLEMENTED` | [UJ-ONB-007.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ONB-007.md) | None (Passing) |
| **UJ-ONB-008** | Complete Handover & Receive Certificate | Employee | Onboarding | `P1` | `IMPLEMENTED` | [UJ-ONB-008.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ONB-008.md) | None (Passing) |
| **UJ-ONB-009** | Offline Learning Progress Sync via PWA | Employee | Onboarding | `P2` | `PARTIALLY_IMPLEMENTED` | [UJ-ONB-009.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ONB-009.md) | [UJ-ONB-009.md](file:///d:/talnova/talnova-onboarding/docs/audits/current/user-journeys/UJ-ONB-009.md) |
| **UJ-ADM-001** | Author & Manage Journey Templates | Admin / Owner | Administration | `P0` | `IMPLEMENTED` | [UJ-ADM-001.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ADM-001.md) | None (Passing) |
| **UJ-ADM-002** | Employee Directory & Invite New Hire | Admin / Owner | Administration | `P0` | `IMPLEMENTED` | [UJ-ADM-002.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ADM-002.md) | None (Passing) |
| **UJ-ADM-003** | Bulk Import Employees via CSV | Admin / Owner | Administration | `P2` | `IMPLEMENTED` | [UJ-ADM-003.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ADM-003.md) | None (Passing) |
| **UJ-ADM-004** | Workflow Automation Rule Configuration | Admin / Owner | Administration | `P1` | `IMPLEMENTED` | [UJ-ADM-004.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ADM-004.md) | None (Passing) |
| **UJ-ADM-005** | HR Ops Handover Verification & Analytics | Admin / Owner | Administration | `P1` | `IMPLEMENTED` | [UJ-ADM-005.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ADM-005.md) | None (Passing) |
| **UJ-ADM-006** | Compliance Document Template Authoring | Admin / Owner | Administration | `P1` | `IMPLEMENTED` | [UJ-ADM-006.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ADM-006.md) | None (Passing) |
| **UJ-ADM-007** | Standalone Task Template Creation | Admin / Manager | Administration | `P1` | `IMPLEMENTED` | [UJ-ADM-007.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ADM-007.md) | None (Passing) |
| **UJ-ADM-008** | AI Course Builder Generation | Admin / Owner | Administration | `P2` | `IMPLEMENTED` | [UJ-ADM-008.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ADM-008.md) | None (Passing) |
| **UJ-ADM-009** | Org Branding & Department Settings | Admin / Owner | Administration | `P2` | `IMPLEMENTED` | [UJ-ADM-009.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ADM-009.md) | None (Passing) |
| **UJ-ADM-010** | Enterprise SSO Settings Configuration | Owner / Admin | Administration | `P2` | `IMPLEMENTED` | [UJ-ADM-010.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ADM-010.md) | None (Passing) |
| **UJ-ADM-011** | HRIS Marketplace Integration Sync | Admin / Owner | Administration | `P2` | `PARTIALLY_IMPLEMENTED` | [UJ-ADM-011.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ADM-011.md) | [UJ-ADM-011.md](file:///d:/talnova/talnova-onboarding/docs/audits/current/user-journeys/UJ-ADM-011.md) |
| **UJ-ADM-012** | Company Analytics & Drop-off Monitoring | Admin / Manager | Administration | `P2` | `IMPLEMENTED` | [UJ-ADM-012.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-ADM-012.md) | None (Passing) |
| **UJ-MGR-001** | Direct Report Progress Monitoring | Manager | Management | `P1` | `IMPLEMENTED` | [UJ-MGR-001.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-MGR-001.md) | None (Passing) |
| **UJ-MGR-002** | Evaluate & Approve 30-60-90 Milestones | Manager | Management | `P1` | `IMPLEMENTED` | [UJ-MGR-002.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-MGR-002.md) | None (Passing) |
| **UJ-MGR-003** | Approve & Verify Direct Report Tasks | Manager | Management | `P1` | `IMPLEMENTED` | [UJ-MGR-003.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-MGR-003.md) | None (Passing) |
| **UJ-MGR-004** | Schedule & Log 1-on-1 Check-in Meetings | Manager | Management | `P2` | `IMPLEMENTED` | [UJ-MGR-004.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-MGR-004.md) | None (Passing) |
| **UJ-MGR-005** | Assign Onboarding Buddy to New Hire | Manager / Admin | Management | `P2` | `IMPLEMENTED` | [UJ-MGR-005.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-MGR-005.md) | None (Passing) |
| **UJ-BUD-001** | Register Buddy Profile & Availability | Buddy / Employee | Mentorship | `P2` | `IMPLEMENTED` | [UJ-BUD-001.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-BUD-001.md) | None (Passing) |
| **UJ-BUD-002** | Review Mentee Progress & Checklists | Buddy | Mentorship | `P2` | `IMPLEMENTED` | [UJ-BUD-002.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-BUD-002.md) | None (Passing) |
| **UJ-BUD-003** | Log Buddy Check-in Notes & Sentiment | Buddy | Mentorship | `P2` | `IMPLEMENTED` | [UJ-BUD-003.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-BUD-003.md) | None (Passing) |
| **UJ-KSK-001** | Pair Kiosk Device via 6-Digit Code | Admin / Device | Kiosk | `P2` | `IMPLEMENTED` | [UJ-KSK-001.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-KSK-001.md) | None (Passing) |
| **UJ-KSK-002** | Launch Touch Kiosk Journey Player | Frontline Worker | Kiosk | `P1` | `IMPLEMENTED` | [UJ-KSK-002.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-KSK-002.md) | None (Passing) |
| **UJ-KSK-003** | SOP Playback & Touch PPE Confirmation | Frontline Worker | Kiosk | `P1` | `IMPLEMENTED` | [UJ-KSK-003.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-KSK-003.md) | None (Passing) |
| **UJ-KSK-004** | Kiosk Device Heartbeat & Analytics Sync | Kiosk Device | Kiosk | `P2` | `IMPLEMENTED` | [UJ-KSK-004.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-KSK-004.md) | None (Passing) |
| **UJ-SUP-001** | Tenant Provisioning & Health Oversight | SuperAdmin | Platform | `P1` | `IMPLEMENTED` | [UJ-SUP-001.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-SUP-001.md) | None (Passing) |
| **UJ-SUP-002** | Manage Tenants & Subscriptions | SuperAdmin | Platform | `P1` | `IMPLEMENTED` | [UJ-SUP-002.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-SUP-002.md) | None (Passing) |
| **UJ-SUP-003** | Cross-Tenant Finance & Billing Tracking | SuperAdmin | Platform | `P2` | `IMPLEMENTED` | [UJ-SUP-003.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-SUP-003.md) | None (Passing) |
| **UJ-OPS-001** | View Leaderboard & Earn Points/Badges | All Users | Operations | `P3` | `IMPLEMENTED` | [UJ-OPS-001.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-OPS-001.md) | None (Passing) |
| **UJ-OPS-002** | Navigate Interactive Workplace Office Map | All Users | Operations | `P3` | `IMPLEMENTED` | [UJ-OPS-002.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-OPS-002.md) | None (Passing) |
| **UJ-OPS-003** | Public Certificate Verification via QR | Public | Operations | `P2` | `IMPLEMENTED` | [UJ-OPS-003.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-OPS-003.md) | None (Passing) |
| **UJ-KB-001** | Browse KB Articles & Policy Slideshow | All Users | Operations | `P2` | `IMPLEMENTED` | [UJ-KB-001.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-KB-001.md) | None (Passing) |
| **UJ-KB-002** | Query AI Assistant for Policies | All Users | Operations | `P2` | `IMPLEMENTED` | [UJ-KB-002.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-KB-002.md) | None (Passing) |
| **UJ-IT-001** | IT Hardware Provisioning Workflow | IT Admin / Assignee | Operations | `P1` | `PARTIALLY_IMPLEMENTED` | [UJ-IT-001.md](file:///d:/talnova/talnova-onboarding/prompts/user-journeys/UJ-IT-001.md) | [UJ-IT-001.md](file:///d:/talnova/talnova-onboarding/docs/audits/current/user-journeys/UJ-IT-001.md) |

---

## 2. Summary Statistics

* **Total Documented Personas:** 8 (`super_admin`, `owner`, `admin`, `manager`, `employee`, `buddy`, `it_admin`, `kiosk_operator`)
* **Total Implemented DB Roles:** 5 (`super_admin`, `owner`, `admin`, `manager`, `employee`) + 1 device role (`kiosk_device`)
* **Total Discovered Journeys:** 49
* **Priority Distribution:**
  * `P0`: 6
  * `P1`: 17
  * `P2`: 24
  * `P3`: 2
* **Implementation Status Breakdown:**
  * `IMPLEMENTED`: 45 (91.8%)
  * `PARTIALLY_IMPLEMENTED`: 4 (8.2%) (`UJ-AUTH-005`, `UJ-ONB-009`, `UJ-ADM-011`, `UJ-IT-001`)
  * `NOT_IMPLEMENTED`: 0
  * `BROKEN`: 0
  * `BLOCKED`: 0
