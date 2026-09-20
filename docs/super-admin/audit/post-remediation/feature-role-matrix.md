# Feature-to-Role Authorization Matrix

> **Document Status:** Authoritative Role Governance Matrix  
> **System:** Talnova Onboarding Enterprise Platform  
> **Roles Audited:** 7 Platform Personas (`super_admin`, `owner`, `admin`, `hr_admin`, `manager`, `it_admin`, `employee`)  
> **Date:** September 2026  

---

## 1. Role Definitions & Privilege Hierarchy

The Talnova platform enforces authorization via a two-tier mechanism:
1. **RBAC Capabilities:** Compile-time and token-time permissions defined in `src/utils/rbac.ts` and backend `requireRole` middleware.
2. **Feature Flag Applicability:** Runtime tenant and role-specific enablement evaluated via `FeatureFlagService.isEnabled(key, orgId, role)`.

### Role Persona Hierarchy

```
┌──────────────────────────────────────────────────────────────┐
│                         SUPER ADMIN                          │
│               (Global Multi-Tenant Control Plane)            │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────┴───────────────────────────────┐
│                          TENANT ROOT                         │
│                    ┌───────────────────┐                     │
│                    │    ORG OWNER      │                     │
│                    └─────────┬─────────┘                     │
│                              │                               │
│              ┌───────────────┴───────────────┐               │
│              │                               │               │
│     ┌────────┴────────┐             ┌────────┴────────┐      │
│     │    ORG ADMIN    │             │    HR ADMIN     │      │
│     └────────┬────────┘             └────────┬────────┘      │
│              │                               │               │
│              └───────────────┬───────────────┘               │
│                              │                               │
│              ┌───────────────┴───────────────┐               │
│              │                               │               │
│     ┌────────┴────────┐             ┌────────┴────────┐      │
│     │     MANAGER     │             │    IT ADMIN     │      │
│     └────────┬────────┘             └─────────────────┘      │
│              │                                               │
│     ┌────────┴────────┐                                      │
│     │    EMPLOYEE     │                                      │
│     │ (Learner/Buddy) │                                      │
│     └─────────────────┘                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Feature-to-Role Matrix

* **FULL:** Unrestricted access (create, read, update, delete, configure)
* **EXEC:** Execution/Operational access (fill, submit, verify, execute)
* **VIEW:** Read-only viewing and monitoring access
* **NONE:** Access denied (hidden in UI, rejected by API with 403)

| Feature ID | Feature Name | Super Admin | Org Owner | Org Admin | HR Admin | Manager | IT Admin | Employee |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Domain 1: Identity & Access** | | | | | | | | |
| `FEAT-AUTH-001` | Password Authentication | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-AUTH-002` | Session Revocation | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-AUTH-003` | Self-Registration | FULL | FULL | FULL | FULL | NONE | NONE | EXEC |
| `FEAT-AUTH-004` | Password Reset | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-AUTH-005` | Enterprise SSO Setup | FULL | FULL | FULL | NONE | NONE | NONE | NONE |
| `FEAT-AUTH-006` | JWT Token Renewal | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-AUTH-007` | Route Protection | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-AUTH-008` | Multi-Org Switcher | FULL | FULL | NONE | NONE | NONE | NONE | NONE |
| `FEAT-AUTH-009` | SCIM Directory Sync | FULL | FULL | FULL | NONE | NONE | NONE | NONE |
| **Domain 2: Onboarding** | | | | | | | | |
| `FEAT-ONB-001` | Candidate Roadmap | VIEW | VIEW | VIEW | VIEW | VIEW | NONE | FULL |
| `FEAT-ONB-002` | E-Signature Signing | VIEW | VIEW | VIEW | VIEW | NONE | NONE | EXEC |
| `FEAT-ONB-003` | Checklist Tasks | VIEW | VIEW | VIEW | VIEW | VIEW | NONE | EXEC |
| `FEAT-ONB-004` | LMS Course Viewer | VIEW | VIEW | VIEW | VIEW | VIEW | NONE | EXEC |
| `FEAT-ONB-005` | Assessment Quizzes | VIEW | VIEW | VIEW | VIEW | VIEW | NONE | EXEC |
| `FEAT-ONB-006` | Milestone Self-Rating | VIEW | VIEW | VIEW | VIEW | VIEW | NONE | EXEC |
| `FEAT-ONB-007` | Buddy Connection | VIEW | VIEW | VIEW | VIEW | VIEW | NONE | EXEC |
| `FEAT-ONB-008` | Graduation Certificate | VIEW | VIEW | VIEW | VIEW | VIEW | NONE | FULL |
| `FEAT-ONB-009` | PWA Offline Sync | NONE | NONE | NONE | NONE | NONE | NONE | EXEC |
| `FEAT-ONB-010` | Onboarding AI Copilot | VIEW | VIEW | VIEW | VIEW | NONE | NONE | EXEC |
| **Domain 3: HR Administration**| | | | | | | | |
| `FEAT-ADM-001` | Journey Templates | FULL | FULL | FULL | FULL | NONE | NONE | NONE |
| `FEAT-ADM-002` | Visual Journey Builder | FULL | FULL | FULL | FULL | NONE | NONE | NONE |
| `FEAT-ADM-003` | Step Prerequisite Rules | FULL | FULL | FULL | FULL | NONE | NONE | NONE |
| `FEAT-ADM-004` | Employee Directory | FULL | FULL | FULL | FULL | VIEW | VIEW | VIEW |
| `FEAT-ADM-005` | Invite New Hires | FULL | FULL | FULL | FULL | NONE | NONE | NONE |
| `FEAT-ADM-006` | Bulk CSV Import | FULL | FULL | FULL | FULL | NONE | NONE | NONE |
| `FEAT-ADM-007` | Workflow Rules Engine | FULL | FULL | FULL | FULL | NONE | NONE | NONE |
| `FEAT-ADM-008` | Trigger-Action Builder | FULL | FULL | FULL | FULL | NONE | NONE | NONE |
| `FEAT-ADM-009` | HR Operations View | FULL | FULL | FULL | FULL | NONE | NONE | NONE |
| `FEAT-ADM-010` | Exceptions Workbench | FULL | FULL | FULL | FULL | NONE | NONE | NONE |
| `FEAT-ADM-011` | Document Templates | FULL | FULL | FULL | FULL | NONE | NONE | NONE |
| `FEAT-ADM-012` | PDF Field Positioning | FULL | FULL | FULL | FULL | NONE | NONE | NONE |
| `FEAT-ADM-013` | Standalone Task Templates| FULL | FULL | FULL | FULL | FULL | NONE | NONE |
| `FEAT-ADM-014` | Relative Due-Date Offsets| FULL | FULL | FULL | FULL | FULL | NONE | NONE |
| `FEAT-ADM-015` | AI Course Builder | FULL | FULL | FULL | FULL | NONE | NONE | NONE |
| `FEAT-ADM-016` | Organization Branding | FULL | FULL | FULL | NONE | NONE | NONE | NONE |
| `FEAT-ADM-017` | HRIS Integrations | FULL | FULL | FULL | NONE | NONE | FULL | NONE |
| `FEAT-ADM-018` | Executive Analytics | FULL | FULL | FULL | FULL | VIEW | NONE | NONE |
| **Domain 4: Team Supervision** | | | | | | | | |
| `FEAT-MGR-001` | Manager Operations View | FULL | FULL | FULL | FULL | FULL | NONE | NONE |
| `FEAT-MGR-002` | Direct Report Progress | FULL | FULL | FULL | FULL | FULL | NONE | NONE |
| `FEAT-MGR-003` | Milestone Approvals | FULL | FULL | FULL | FULL | FULL | NONE | NONE |
| `FEAT-MGR-004` | Task Verification | FULL | FULL | FULL | FULL | FULL | NONE | NONE |
| `FEAT-MGR-005` | Check-in Scheduler | FULL | FULL | FULL | FULL | FULL | NONE | NONE |
| `FEAT-MGR-006` | Buddy Assignment | FULL | FULL | FULL | FULL | FULL | NONE | NONE |
| `FEAT-MGR-007` | Team Velocity Alerts | FULL | FULL | FULL | FULL | FULL | NONE | NONE |
| **Domain 5: Mentorship** | | | | | | | | |
| `FEAT-BUD-001` | Buddy Profile Setup | VIEW | VIEW | VIEW | VIEW | VIEW | NONE | EXEC |
| `FEAT-BUD-002` | Mentee Tracking | FULL | FULL | FULL | FULL | FULL | NONE | EXEC (Buddy)|
| `FEAT-BUD-003` | Check-in Sentiment Notes | FULL | FULL | FULL | FULL | FULL | NONE | EXEC (Buddy)|
| `FEAT-BUD-004` | Algorithmic Buddy Match | FULL | FULL | FULL | FULL | FULL | NONE | NONE |
| **Domain 6: Kiosk Systems** | | | | | | | | |
| `FEAT-KSK-001` | Kiosk 6-Digit Pairing | FULL | FULL | FULL | NONE | NONE | FULL | NONE |
| `FEAT-KSK-002` | Touch Kiosk Player Mode | FULL | VIEW | VIEW | NONE | NONE | NONE | EXEC (Frontline)|
| `FEAT-KSK-003` | Audio SOP Playback | FULL | VIEW | VIEW | NONE | NONE | NONE | EXEC (Frontline)|
| `FEAT-KSK-004` | Touch PPE Confirmations | FULL | VIEW | VIEW | NONE | NONE | NONE | EXEC (Frontline)|
| `FEAT-KSK-005` | Device Telemetry Heartbeat| FULL | FULL | FULL | NONE | NONE | FULL | NONE |
| **Domain 7: IT Administration**| | | | | | | | |
| `FEAT-IT-001` | IT Hardware Queue | FULL | FULL | FULL | NONE | NONE | FULL | NONE |
| `FEAT-IT-002` | Asset Tagging & Serial | FULL | FULL | FULL | NONE | NONE | FULL | NONE |
| `FEAT-IT-003` | Hardware Shipping Flow | FULL | FULL | FULL | NONE | NONE | FULL | NONE |
| `FEAT-IT-004` | Software Account Setup | FULL | FULL | FULL | NONE | NONE | FULL | NONE |
| **Domain 8: Gamification** | | | | | | | | |
| `FEAT-GAM-001` | Points Engine | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-GAM-002` | Badges & Awards | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-GAM-003` | Daily Streak Tracker | VIEW | VIEW | VIEW | VIEW | VIEW | NONE | FULL |
| `FEAT-GAM-004` | Leaderboard View | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-GAM-005` | Level Progression | VIEW | VIEW | VIEW | VIEW | VIEW | NONE | FULL |
| **Domain 9: Workplace & Maps** | | | | | | | | |
| `FEAT-LOC-001` | Office Map Viewer | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-LOC-002` | Floorplan Pin Editing | FULL | FULL | FULL | NONE | NONE | NONE | NONE |
| `FEAT-LOC-003` | Pathfinding Directions | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-CAL-001` | Calendar Integration | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-CAL-002` | Meeting Automation | FULL | FULL | FULL | FULL | FULL | NONE | NONE |
| `FEAT-CAL-003` | Personal iCal Feed | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| **Domain 10: Knowledge & AI** | | | | | | | | |
| `FEAT-KB-001` | Knowledge Base | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-KB-002` | Fullscreen Slideshow | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-AI-001` | AI Q&A Assistant | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-AI-002` | RAG Policy Search | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-AI-003` | AI Response Feedback | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| **Domain 11: Public Certs** | | | | | | | | |
| `FEAT-CER-001` | Digital Certificates | FULL | FULL | FULL | FULL | VIEW | NONE | FULL |
| `FEAT-CER-002` | Public QR Verification | FULL | FULL | FULL | FULL | FULL | FULL | FULL (Public)|
| `FEAT-CER-003` | Tamper-Evident SHA256 | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| `FEAT-CER-004` | PDF Certificate Export | FULL | FULL | FULL | FULL | VIEW | NONE | FULL |
| **Domain 12: Super Admin** | | | | | | | | |
| `FEAT-SUP-001..018`| Super Admin Controls | FULL | NONE | NONE | NONE | NONE | NONE | NONE |

---

## 3. Governance Findings

1. **Role Context Gaps:** `it_admin` is defined in `Role` types, but does not have dedicated dashboard cards.
2. **Missing Dynamic Role Restriction:** While the Mongoose model for feature flags supports `targetRoles`, the client navigation ignores role-targeted feature flag restrictions, allowing users to see navigation links for features their role cannot execute.
