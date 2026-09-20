# Feature-to-UI Mapping Matrix

> **Document Status:** Authoritative UI Traceability Matrix  
> **System:** Talnova Onboarding Enterprise Platform  
> **Scope:** Navigation, Dashboards, Routes, Pages, Tabs, Buttons & Modals  
> **Date:** September 2026  

---

## 1. UI Governance Architectural Model

To make Super Admin feature flags **administratively effective**, the UI must respond dynamically to feature availability:
1. **Navigation:** Disabled features must not render in sidebar sections or mobile bottom navigation.
2. **Dashboards:** Widgets, progress counters, and quick-action cards must not render if their target feature is disabled.
3. **Route Guards:** Direct URL access must display a friendly "Feature Temporarily Unavailable" screen instead of a broken page or raw 403 error.
4. **Action Buttons:** In-page buttons (e.g., "Add Module", "Invite Employee") must be hidden or disabled with tooltips.

---

## 2. Feature-to-UI Mapping Table

| Feature ID | Feature Name | Sidebar Nav Section | Dashboard Widget / Card | Route Path | Primary Page / Component | Buttons / Modals | Gated in Code Today? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `FEAT-AUTH-001` | Password Login | N/A | N/A | `/login` | `Login.tsx` | "Sign In" button | No (Public) |
| `FEAT-AUTH-003` | Self-Registration | N/A | N/A | `/register` | `Register.tsx` | "Create Account" | No (Public) |
| `FEAT-AUTH-004` | Password Reset | N/A | N/A | `/forgot-password` | `ForgotPassword.tsx` | "Send Reset Link" | No (Public) |
| `FEAT-AUTH-005` | Enterprise SSO | Settings -> SSO | "SSO Active" Badge | `/settings/sso` | `SSOSettings.tsx` | "Configure SAML" | **YES (Route only)** |
| `FEAT-ONB-001` | Candidate Roadmap | My Onboarding -> Roadmap | "Active Phase" Card | `/employee` | `EmployeeDashboard.tsx` | "Continue Journey" | **NO** |
| `FEAT-ONB-002` | E-Signature Signing | My Onboarding -> Documents| "Pending Signatures" Card| `/documents/:id/sign` | `DocumentSigner.tsx` | Canvas / "Sign & Submit" | **NO** |
| `FEAT-ONB-003` | Checklist Tasks | My Onboarding -> Tasks | "Tasks Remaining" Card | `/tasks` | `Tasks.tsx` | "Mark Complete" | **NO** |
| `FEAT-ONB-004` | LMS Course Player | My Onboarding -> Learning | "Current Course" Card | `/course/:id` | `CourseViewer.tsx` | "Next Lesson" | **NO** |
| `FEAT-ONB-005` | Assessment Quizzes | Inside Course Player | "Quiz Available" Badge | `/course/:id` | `CourseViewer.tsx` (Quiz)| "Submit Quiz" | **NO** |
| `FEAT-ONB-006` | Milestone Ratings | Support -> 30/60/90 | "Milestone Due" Card | `/milestones` | `Milestones.tsx` | "Submit Self-Rating" | **NO** |
| `FEAT-ONB-007` | Buddy Connection | Support -> Buddy | "My Buddy" Card | `/buddy` | `BuddyProgram.tsx` | "Schedule 1-on-1" | **NO** |
| `FEAT-ONB-008` | Graduation Cert | Workplace -> Certificates | "Certificates Earned" | `/certificates` | `Certificates.tsx` | "Download PDF" | **NO** |
| `FEAT-ONB-009` | PWA Offline Sync | PWA Install Banner | Offline Indicator Banner | Mobile PWA Shell | `PWAInstallBanner.tsx` | "Install App" | **NO** |
| `FEAT-ONB-010` | Onboarding AI Copilot | Workplace -> AI Assistant | "Ask Copilot" Widget | `/ai-assistant` | `AIAssistant.tsx` | "Ask Question" | **NO** |
| `FEAT-ADM-001` | Journey Templates | Learning -> Templates | "Active Journeys" Metric | `/journeys` | `JourneysList.tsx` | "New Journey" | **NO** |
| `FEAT-ADM-002` | Visual Journey Builder | Child of `/journeys` | N/A | `/journeys/:id` | `JourneyBuilder.tsx` | "Add Step", "Publish" | **NO** |
| `FEAT-ADM-004` | Employee Directory | People -> Directory | "Total Employees" Metric | `/directory` | `EmployeeDirectory.tsx` | "Invite Employee" | **NO** |
| `FEAT-ADM-006` | Bulk CSV Import | Inside Directory | N/A | `/directory` (Modal)| `EmployeeDirectory.tsx` | "Upload CSV", "Map" | **NO** |
| `FEAT-ADM-007` | Workflow Rules | System -> Workflows | "Active Automations" Card| `/workflows` | `Workflows.tsx` | "Create Rule" | **NO** |
| `FEAT-ADM-009` | HR Operations | Overview -> HR Ops | "Onboarding Velocity" | `/hr-ops` | `HROperations.tsx` | "Export CSV" | **NO** |
| `FEAT-ADM-010` | Exceptions Workbench | HR Ops -> Exceptions | Exceptions Badge Counter | `/hr-ops/exceptions` | `HROpsExceptions.tsx` | "Acknowledge", "Resolve"| **NO** |
| `FEAT-ADM-011` | Document Templates | Operations -> Documents | "Template Library" Tab | `/documents` | `Documents.tsx` | "New Template" | **NO** |
| `FEAT-ADM-013` | Standalone Tasks | Operations -> Tasks | "Overdue Tasks" Card | `/tasks` | `Tasks.tsx` | "New Task Template" | **NO** |
| `FEAT-ADM-015` | AI Course Builder | Learning -> AI Builder | "Generate AI Course" Card| `/ai-course-builder` | `AICourseBuilder.tsx` | "Generate Outline" | **YES (Route only)** |
| `FEAT-ADM-016` | Org Branding | System -> Settings | N/A | `/settings` | `Settings.tsx` | "Save Branding" | **NO** |
| `FEAT-ADM-017` | HRIS Integrations | Settings -> HRIS | "Connected HRIS" Badge | `/settings/integrations`| `HRISIntegrations.tsx` | "Connect BambooHR" | **YES (Route only)** |
| `FEAT-ADM-018` | Executive Analytics | System -> Analytics | "Completion Rate" Chart | `/analytics` | `Analytics.tsx` | "Export Report" | **NO** |
| `FEAT-MGR-001` | Manager Team Ops | Overview -> Team Ops | "Direct Reports" Summary | `/manager` | `ManagerDashboard.tsx` | "Review Next Hire" | **NO** |
| `FEAT-MGR-003` | Milestone Approvals | People -> 30/60/90 | "Pending Approvals" Card | `/milestones` | `Milestones.tsx` | "Approve Rating" | **NO** |
| `FEAT-MGR-004` | Task Verification | Supervision -> Tasks | "Verification Queue" | `/tasks` | `Tasks.tsx` | "Verify & Sign-off" | **NO** |
| `FEAT-MGR-005` | Check-in Scheduler | People -> 1-on-1 Calendar | "Upcoming 1-on-1s" | `/calendar` | `CalendarIntegration.tsx`| "Schedule 1-on-1" | **NO** |
| `FEAT-MGR-006` | Buddy Assignment | People -> Buddy Support | "Unpaired Hires" Counter | `/buddy` | `BuddyProgram.tsx` | "Pair Buddy" | **NO** |
| `FEAT-BUD-001` | Buddy Profile | Support -> Buddy Support | "My Availability" Status | `/buddy` | `BuddyProgram.tsx` | "Save Preferences" | **NO** |
| `FEAT-BUD-003` | Check-in Notes | Support -> Buddy Support | "Meeting Notes History" | `/buddy` | `BuddyProgram.tsx` | "Log Meeting Notes" | **NO** |
| `FEAT-KSK-001` | Kiosk Pairing | Operations -> Kiosks | "Paired Terminals" Metric | `/kiosks` | `KioskDashboard.tsx` | "Pair New Device" | **YES (Route only)** |
| `FEAT-KSK-002` | Kiosk Player Mode | N/A (Device Standalone) | Fullscreen Kiosk Shell | `/kiosk/play/:id` | `KioskPlayerPage.tsx` | Touch Buttons | **NO** |
| `FEAT-IT-001` | IT Hardware Queue | Tasks -> IT Hardware Queue| "Pending Laptops" Counter | `/tasks/it-ops` | `Tasks.tsx` (IT Tab) | "Mark Configured" | **NO** |
| `FEAT-GAM-001` | Gamification Points | Workplace -> Leaderboard | "Points Balance" Badge | `/leaderboard` | `Leaderboard.tsx` | N/A | **NO** |
| `FEAT-GAM-002` | Badges & Awards | Workplace -> Leaderboard | "Badges Unlocked" Grid | `/leaderboard` | `Leaderboard.tsx` | N/A | **NO** |
| `FEAT-GAM-004` | Leaderboard View | Workplace -> Leaderboard | Leaderboard Rank Card | `/leaderboard` | `Leaderboard.tsx` | "View Department" | **YES (Key mismatch)**|
| `FEAT-LOC-001` | Office Map Viewer | Workplace -> Office Map | Interactive Floorplan | `/office-map` | `OfficeMap.tsx` | Floor Selector Tabs | **NO** |
| `FEAT-CAL-001` | Calendar Integration | Operations -> Calendar | "Orientation Schedule" | `/calendar` | `CalendarIntegration.tsx`| "Sync Outlook" | **NO** |
| `FEAT-KB-001` | Knowledge Base | Learning -> KB | "Recommended Reading" | `/kb` | `KnowledgeBase.tsx` | "Search Articles" | **NO** |
| `FEAT-KB-002` | KB Slideshow Mode | Header of KB Article | N/A | `/kb/slideshow` | `KnowledgeBaseSlideshow.tsx`| Fullscreen Controls | **NO** |
| `FEAT-AI-001` | AI Q&A Assistant | System -> AI Assistant | AI Chat Drawer | `/ai-assistant` | `AIAssistant.tsx` | "Send Query" | **NO** |
| `FEAT-CER-001` | Digital Certificates | Workplace -> Certificates | "Certificates" Card | `/certificates` | `Certificates.tsx` | "View Certificate" | **NO** |
| `FEAT-CER-002` | Public QR Verify | Public Landing Page | Verified Certificate Stamp | `/public/certificate/:id`| `PublicCertificateViewer.tsx`| "Verify SHA-256" | **NO** |

---

## 3. Forensic UI Gaps & Flaws

1. **Dead Links in Navigation:** As shown in the table, **42 of the 47 user-facing capabilities** have their navigation links rendered unconditionally.
2. **Ghost Dashboard Widgets:** When a feature like `digital_signatures` is disabled, `EmployeeDashboard.tsx` still renders the "Required Documents" card and shows pending counts.
3. **Missing In-Page Action Disablement:** Buttons such as "Generate AI Course Draft" or "Schedule 1-on-1" are not disabled when the feature flag is off.
4. **Key Mismatch Route Interception:** In `src/App.tsx`, line 141 sets `featureFlag="gamification_badges"`. The backend seeds `gamified_milestones`. When `hasFeature("gamification_badges")` is evaluated, it returns `true` (default fallback), meaning route protection fails completely.
