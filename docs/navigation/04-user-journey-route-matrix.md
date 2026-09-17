# User Journey → Route & Navigation Flow Matrix

> **System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Document:** Complete End-to-End Mapping of All 49 Documented User Journeys  
> **Source:** `docs/user-journeys/journeys-index.md`, `prompts/user-journeys/`, `docs/audits/current/`  

---

## 1. Master Journey Execution & Navigation Flow Table

| Journey ID | Journey Name | Role | Primary Entry Point | Route | Prerequisites | Core Workflow Steps | Completion State | Next Logical Journey |
|---|---|---|---|---|---|---|---|---|
| **UJ-AUTH-001** | User Login | All Users | Login Page | `/login` | Registered account | Enter credentials → Validate JWT → Direct to role dashboard | Authenticated session | UJ-ONB-001 or UJ-ADM-001 |
| **UJ-AUTH-002** | User Logout | All Users | Header Profile Menu | User Dropdown | Active session | Click "Log out" → Clear token in storage → Invalidate session | Unauthenticated redirect to `/login` | UJ-AUTH-001 |
| **UJ-AUTH-003** | Self-Registration | Public | Login Page Link | `/register` | Valid invite code / domain | Fill name, email, password → Submit | Account created → Auto-login | UJ-ONB-001 |
| **UJ-AUTH-004** | Password Reset | All Users | Login Page Link | `/forgot-password`, `/reset-password` | Registered email | Request reset link → Click email token → Set new password | Password updated | UJ-AUTH-001 |
| **UJ-AUTH-005** | Enterprise SSO Discovery | Owner / Employee | Login Page Domain Input | `/login`, `/settings/sso` | SSO enabled | Enter corporate email → Auto-detect IdP → SAML/OIDC redirect | SSO authenticated session | UJ-ONB-001 |
| **UJ-AUTH-006** | Token Refresh | All Users | Background Axios Interceptor | API Layer | Active token | Silent background refresh via HTTP interceptor | Refreshed JWT | N/A (Transparent) |
| **UJ-AUTH-007** | Unauthorized Access Rejection | All Users | Protected Route Guard | Route URL | Insufficient role capability | Guard catches unauthorized attempt → Display alert or redirect | Security preserved | Role switcher / Request access |
| **UJ-ONB-001** | View Personal Roadmap | Employee | Sidebar: Roadmap | `/employee` | Logged in as employee | Inspect active stage, overall progress % and current tasks | Informed on progress | UJ-ONB-002 or UJ-ONB-003 |
| **UJ-ONB-002** | Mandatory Compliance E-Signature | Employee | Roadmap Stage 1 / Sidebar | `/documents`, `/documents/:id/sign` | Pending compliance doc | Review legal document → Sign on canvas → Submit SHA-256 hash | Document marked signed | UJ-ONB-003 (Tasks) |
| **UJ-ONB-003** | Execute Personal Tasks | Employee | Roadmap Stage 2 / Sidebar | `/tasks` | Assigned tasks exist | Review day-1 / week-1 tasks → Mark complete | Tasks completed | UJ-ONB-004 (LMS Course) |
| **UJ-ONB-004** | Complete LMS Course Lessons | Employee | Roadmap Stage 3 / Sidebar | `/journeys`, `/course/:id` | Signed docs completed | Launch course player → Watch video/read content → Complete lessons | 100% lessons watched | UJ-ONB-005 (Assessment Quiz) |
| **UJ-ONB-005** | Take LMS Assessment Quiz | Employee | Course Player Quiz Tab | `/course/:id` | Lessons completed | Answer multiple choice quiz questions → Submit for grading | Passing score earned | UJ-ONB-006 (Milestones) |
| **UJ-ONB-006** | Day 30-60-90 Self-Rating | Employee | Roadmap Stage 4 / Sidebar | `/milestones` | Milestone phase reached | Open milestone dialog → Enter self-rating & reflection notes | Milestone submitted | UJ-MGR-002 (Manager Review) |
| **UJ-ONB-007** | View & Connect with Buddy | Employee | Roadmap Stage 4 / Sidebar | `/buddy` | Buddy assigned | Review buddy profile, send message, review buddy checklist | Buddy connected | UJ-ONB-008 (Graduation) |
| **UJ-ONB-008** | Complete Handover & Receive Certificate | Employee | Roadmap Stage 5 / Sidebar | `/employee`, `/certificates` | All stages completed | Confirm completion → View cryptographic digital certificate | Certificate issued | UJ-OPS-003 (Public Verify) |
| **UJ-ONB-009** | Offline Learning Progress Sync | Employee | PWA Banner / Mobile View | `/course/:id` | PWA registered | Offline module cached in IndexedDB → Sync on reconnect | Telemetry synced | UJ-ONB-004 |
| **UJ-ADM-001** | Author Journey Templates | Admin / Owner | Sidebar: Learning > Journeys | `/journeys`, `/journeys/:id` | Admin permissions | Click "New Journey" → Set modules & steps → Configure rules → Save | Journey template published | UJ-ADM-002 (Invite Hire) |
| **UJ-ADM-002** | Employee Directory & Invite | Admin / Owner | Sidebar: People > Directory | `/directory` | Admin permissions | Click "Invite Employee" → Enter details & assign journey → Send | Invitation dispatched | UJ-ADM-005 (Monitor Ops) |
| **UJ-ADM-003** | Bulk Import Employees via CSV | Admin / Owner | Directory "Bulk Import" CTA | `/directory` | Admin permissions | Upload CSV file → Review column mapping → Run batch import | Employees enrolled | UJ-ADM-004 (Workflows) |
| **UJ-ADM-004** | Workflow Automation Rule Config | Admin / Owner | Sidebar: System > Workflows | `/workflows` | Admin permissions | Create rule → Select trigger → Define conditions → Set actions | Automation rule active | UJ-ADM-005 |
| **UJ-ADM-005** | HR Ops Handover & Verification | Admin / Owner | Sidebar: Operations > HR Ops | `/hr-ops`, `/hr-ops/exceptions` | Admin permissions | Inspect completed hires → Verify checklist → Sign off handover | Employee graduated | UJ-ADM-012 (Analytics) |
| **UJ-ADM-006** | Compliance Document Templates | Admin / Owner | Sidebar: Compliance > Documents | `/documents` | Admin permissions | "Create Template" → Enter legal text & handlebars → Set category | Template published | UJ-ONB-002 |
| **UJ-ADM-007** | Standalone Task Templates | Admin / Manager | Sidebar: Operations > Tasks | `/tasks` (Templates tab) | Task admin permissions | "Create Template" → Define title, category, stage offset → Save | Template available | UJ-ONB-003 |
| **UJ-ADM-008** | AI Course Builder Generation | Admin / Owner | Sidebar: Learning > AI Builder | `/ai-course-builder` | Admin permissions | Enter prompt or upload document → Generate curriculum → Save to LMS | Journey created in `/journeys` | UJ-ADM-001 |
| **UJ-ADM-009** | Org Branding & Settings | Admin / Owner | Sidebar: System > Settings | `/settings` | Admin permissions | Update logo, primary color, departments, notification prefs | Workspace updated | UJ-ADM-010 |
| **UJ-ADM-010** | Enterprise SSO Configuration | Owner / Admin | Sidebar: System > SSO & Identity | `/settings/sso` | Owner permissions | Configure SAML 2.0 / OIDC IdP metadata, entity ID, certs | SSO enabled | UJ-AUTH-005 |
| **UJ-ADM-011** | HRIS Marketplace Integration | Admin / Owner | Sidebar: System > Integrations | `/settings/integrations` | Admin permissions | Connect HRIS connector (BambooHR/Workday) → Test sync | Bi-directional sync active | UJ-ADM-002 |
| **UJ-ADM-012** | Company Analytics & Drop-off | Admin / Manager | Sidebar: Insights > Analytics | `/analytics` | View analytics permissions | Inspect milestone completion rates, bottleneck stages, export CSV | Insights reviewed | UJ-ADM-004 |
| **UJ-MGR-001** | Direct Report Monitoring | Manager | Sidebar: Team Operations | `/manager` | Manager permissions | Review direct reports list, filter overdue, check progress | Team status clear | UJ-MGR-002 |
| **UJ-MGR-002** | Evaluate 30-60-90 Milestones | Manager | Manager Dashboard / Milestones | `/milestones`, `/manager` | Employee submitted rating | Open review modal → Score competencies → Provide feedback | Milestone approved | UJ-MGR-004 |
| **UJ-MGR-003** | Verify Direct Report Tasks | Manager | Sidebar: Tasks / Manager Board | `/tasks`, `/manager` | Tasks pending verification | Inspect attached artifacts → Click "Verify Task" | Task verified | UJ-MGR-001 |
| **UJ-MGR-004** | Schedule 1-on-1 Check-ins | Manager | Sidebar: Calendar / Team Ops | `/calendar` | Manager permissions | Select direct report → Set date & video link → Log meeting notes | Meeting scheduled & logged | UJ-MGR-005 |
| **UJ-MGR-005** | Assign Onboarding Buddy | Manager / Admin | Team Ops / Buddy Program | `/buddy`, `/manager` | New hire needs buddy | Open "Assign Buddy" modal → Pick mentor or AI match → Confirm | Buddy paired | UJ-BUD-001 |
| **UJ-BUD-001** | Register Buddy Profile | Buddy / Employee | Sidebar: Buddy Program | `/buddy` (Profile tab) | Authenticated user | Enable "Available for Mentoring" → Set max mentees & bio | Buddy profile active | UJ-BUD-002 |
| **UJ-BUD-002** | Review Mentee Progress | Buddy | Sidebar: Buddy Program | `/buddy` (My Mentees tab) | Mentee assigned | View mentee checklist, onboarding phase, and discussion topics | Prepared for check-in | UJ-BUD-003 |
| **UJ-BUD-003** | Log Buddy Check-in Notes | Buddy | Buddy Program Mentee Card | `/buddy` | Check-in held | Enter check-in date, sentiment (Great/Good/Struggling), notes | Check-in recorded | UJ-MGR-001 |
| **UJ-KSK-001** | Pair Kiosk Device via Code | Admin / Terminal | Sidebar: Kiosks | `/kiosks` | Admin permissions | Generate 6-digit hardware pairing PIN → Enter on terminal screen | Terminal paired | UJ-KSK-002 |
| **UJ-KSK-002** | Launch Touch Kiosk Player | Frontline Worker | Physical Terminal Screen | `/kiosk/play/:id` | Paired kiosk device | Select assigned frontline journey on touch screen → Start | Player active | UJ-KSK-003 |
| **UJ-KSK-003** | SOP Playback & PPE Confirmation | Frontline Worker | Kiosk Player Screen | `/kiosk/play/:id` | Kiosk player running | Watch SOP safety video → Confirm PPE requirements on touch UI | Compliance logged | UJ-KSK-004 |
| **UJ-KSK-004** | Kiosk Heartbeat & Telemetry | Device Background | Terminal Background | API Layer | Terminal running | Periodic device telemetry, offline sync status, ping server | Device health green | UJ-KSK-001 |
| **UJ-SUP-001** | Tenant Provisioning & Oversight | SuperAdmin | Sidebar: Platform Dashboard | `/super-admin` | SuperAdmin permissions | View global tenant telemetry, provision new workspace, monitor load | Workspace live | UJ-SUP-002 |
| **UJ-SUP-002** | Manage Tenants & Subscriptions | SuperAdmin | Sidebar: Organizations | `/super-admin/organizations` | SuperAdmin permissions | Upgrade subscription tiers, manage organization limits & status | Tenant updated | UJ-SUP-003 |
| **UJ-SUP-003** | Cross-Tenant Finance Tracking | SuperAdmin | Sidebar: Finance | `/super-admin/finance` | SuperAdmin permissions | Review ARR, monthly revenue, plan breakdown, payment logs | Finance audited | UJ-SUP-001 |
| **UJ-OPS-001** | View Leaderboard & Points | All Users | Sidebar: Leaderboard | `/leaderboard` | Authenticated user | Check rank, earned milestone badges, and upcoming rewards | Motivated to progress | UJ-ONB-004 |
| **UJ-OPS-002** | Navigate Workplace Office Map | All Users | Sidebar: Office Map | `/office-map` | Authenticated user | Explore floorplans, find desk numbers, locate cafeteria & rooms | Oriented to workplace | UJ-ONB-003 |
| **UJ-OPS-003** | Public Certificate Verification | Public / User | Certificate QR / Direct URL | `/public/certificate/:id` | Certificate ID issued | Scan certificate QR code → View public verification screen | Authenticity verified | N/A (Public) |
| **UJ-KB-001** | Browse Knowledge Base | All Users | Sidebar: Knowledge Base | `/kb`, `/kb/slideshow` | Authenticated or public | Search articles, view employee handbook, launch slideshow | Informed on policies | UJ-KB-002 |
| **UJ-KB-002** | Query AI Assistant for Policies | All Users | Sidebar: AI Assistant | `/ai-assistant` | Authenticated user | Ask natural language questions regarding company policies | Answer provided | UJ-KB-001 |
| **UJ-IT-001** | IT Hardware Provisioning | IT Admin / Assignee | Sidebar: IT Hardware Queue | `/tasks/it-ops`, `/tasks` | IT setup task assigned | Open hardware task → Attach serial number, asset tag, tracking | Hardware dispatched | UJ-ONB-003 |
