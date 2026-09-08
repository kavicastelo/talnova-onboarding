# 10 — Frontend Capability Map

> **Document Purpose:** Ground-Truth Mapping of Frontend UI Capabilities, Components, Services, and Architectural Status in Talnova Onboarding.

---

## 1. Overview & Capability Status Classification

This audit maps the frontend application (`src/`) against the unified V1 + V2 Talnova Onboarding Product specification. 

Status vocabulary used throughout:
- `CORRECT`: Frontend component correctly aligns with unified V1+V2 product contracts.
- `PARTIAL`: Frontend component implements part of the domain contract but omits critical unified integration.
- `DISCONNECTED`: Frontend page or UI element exists but operates in isolation without updating overall journey or onboarding state.
- `STALE`: Component contains outdated V1-only assumptions (e.g. treating journeys as course LMS modules only).
- `BROKEN`: Component fails at runtime due to missing backend API endpoints or incompatible schema payloads.
- `MISSING`: Required capability UI is entirely absent from the frontend layout or navigation.

---

## 2. Master Frontend Capability Matrix

| Capability Domain | Primary UI Components / Pages | API Client / Service | Backend Owner | Status | Key Architectural Findings |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Employee & Lifecycle** | [`EmployeeDirectory.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/EmployeeDirectory.tsx), [`EmployeeProfile.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/EmployeeProfile.tsx) | [`employee.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/employee.service.ts) | `EmployeeService` | `PARTIAL` | Invites and displays employees; collapses `invited`, `onboarding`, `offboarding` states into boolean active/inactive. |
| **2. Journey Management** | [`JourneysList.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/JourneysList.tsx), [`JourneyBuilder.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/JourneyBuilder.tsx) | [`journey.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/journey.service.ts) | `JourneyService` | `PARTIAL` | JourneyBuilder focuses strictly on LMS modules and lesson content; lacks non-LMS step definitions (Tasks, E-Signatures, Milestones). |
| **3. Workflow Automation** | [`Workflows.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/Workflows.tsx) | [`workflow.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/workflow.service.ts) | `WorkflowEngine` | `PARTIAL` | UI rule builder dropdown only allows `assign_journey`, `create_task`, and `send_notification`. Missing `assign_document` and `trigger_webhook`. |
| **4. Employee Onboarding UI** | [`EmployeeDashboard.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/EmployeeDashboard.tsx) | [`employee.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/employee.service.ts) | `EmployeeAssignmentService` | `STALE` | Equates onboarding journey to LMS course progress (`/course/:id`); does not display assigned tasks, documents, buddy, or milestones in employee dashboard. |
| **5. LMS & Course Viewer** | [`CourseViewer.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/CourseViewer.tsx) | [`course.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/course.service.ts) | `CourseService` | `CORRECT` | Full LMS content block renderer, video tracking, quiz submission, and real-time AI translation. |
| **6. Tasks & Checklists** | [`Tasks.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/Tasks.tsx) | [`task.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/task.service.ts) | `TaskService` | `DISCONNECTED` | Standalone task dashboard works for manual tasks, but completing tasks does not reflect in journey or onboarding completion. |
| **7. Digital Documents & E-Sign** | [`Documents.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/Documents.tsx), [`DocumentSigner.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/DocumentSigner.tsx) | [`document.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/document.service.ts) | `DocumentService` | `DISCONNECTED` | Renders templates, canvas signatures, and audit trail; document signature completion is isolated from journey progress. |
| **8. 30/60/90-Day Milestones** | [`Milestones.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/Milestones.tsx) | [`milestone.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/milestone.service.ts) | `MilestoneService` | `DISCONNECTED` | Displays 30/60/90-day milestone progress and manager reviews; milestone status is not reflected in overall onboarding progress. |
| **9. Buddy Program** | [`BuddyProgram.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/BuddyProgram.tsx) | [`buddy.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/buddy.service.ts) | `BuddyService` | `DISCONNECTED` | Displays mentor/mentee pairings, buddy profiles, and check-in logs; buddy pairing is managed in a separate page from the journey container. |
| **10. Manager Operations** | [`ManagerDashboard.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/ManagerDashboard.tsx) | [`manager.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/manager.service.ts) | `ManagerService` | `PARTIAL` | Displays team onboarding progress, pending sign-offs, and 1-on-1 schedules; progress calculation is based solely on LMS completion rates. |
| **11. HR Operations & Handover** | [`HROperations.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/HROperations.tsx) | [`hr.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/hr.service.ts) | `HROperationsService` | `PARTIAL` | Displays onboarding queue and manual handover button; handover triggers status transition without unified completion verification guard. |
| **12. Analytics & Reporting** | [`Analytics.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/Analytics.tsx) | [`analytics.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/analytics.service.ts) | `AnalyticsService` | `CORRECT` | Department completion trends, journey completion rates, learning hours, and export CSV reports. |
| **13. Enterprise SSO & HRIS** | [`SSOSettings.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/SSOSettings.tsx), [`HRISIntegrations.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/HRISIntegrations.tsx) | [`sso.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/sso.service.ts), [`integration.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/integration.service.ts) | `SSOService`, `HRISIntegrationService` | `CORRECT` | SAML/OIDC configuration, HRIS connector sync rules, field mapping table, and sync log history. |
| **14. AI Assistant & Builder** | [`AIAssistant.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/AIAssistant.tsx), [`AICourseBuilder.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/AICourseBuilder.tsx) | [`ai.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/ai.service.ts), [`ai-course.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/ai-course.service.ts) | `AIService` | `CORRECT` | Interactive AI chat assistant for onboarding policies and automated AI course module generator. |
| **15. Kiosk & Office Location** | [`KioskDashboard.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/KioskDashboard.tsx), [`OfficeMap.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/OfficeMap.tsx) | [`location.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/location.service.ts) | `KioskService` | `CORRECT` | Kiosk device management, pin code access, interactive office desk/floor map viewer. |
| **16. Certificates & Public View** | [`Certificates.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/Certificates.tsx), [`PublicCertificateViewer.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/PublicCertificateViewer.tsx) | [`certificate.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/certificate.service.ts) | `CertificateService` | `CORRECT` | PDF certificate download, public verification link, and certificate gallery. |

---

## 3. Key Findings on Product Model Representation

1. **Journeys are Misrepresented as LMS Courses Only:**
   The employee dashboard [`EmployeeDashboard.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/EmployeeDashboard.tsx#L146) links assigned journeys directly to `/course/:id` ([`CourseViewer.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/CourseViewer.tsx)). Non-LMS tasks, e-signatures, buddy pairings, and milestones are rendered in isolated separate top-level navigation routes (`/tasks`, `/documents`, `/buddy`, `/milestones`).

2. **Workflow Builder Missing Repaired Action Types:**
   [`Workflows.tsx`](file:///d:/talnova/talnova-onboarding/src/pages/Workflows.tsx#L565-L569) action dropdown lists only `assign_journey`, `create_task`, and `send_notification`. Repaired backend action types `assign_document` and `trigger_webhook` are absent from the UI workflow builder dropdown.

3. **Employee Lifecycle Status Simplification:**
   [`employee.service.ts`](file:///d:/talnova/talnova-onboarding/src/services/employee.service.ts#L13) maps backend employment status (`invited`, `onboarding`, `active`, `offboarding`, `archived`) into a 3-way string (`Active` | `Onboarding` | `Inactive`), losing lifecycle state granularity.
