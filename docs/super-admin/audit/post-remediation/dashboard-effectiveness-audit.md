# Dashboard Effectiveness & Widget Traceability Audit

> **Document Status:** Authoritative Dashboard Experience Audit  
> **System:** Talnova Onboarding Multi-Persona Dashboards  
> **Dashboards Audited:** Super Admin, Organization Admin, Team Manager, Candidate/Employee  
> **Date:** September 2026  

---

## 1. Executive Summary

Dashboards serve as the primary landing interface for all user personas. When an administrative decision disables a feature, the dashboard must respond immediately. Rendering widgets, metrics, or quick actions for disabled capabilities creates **ghost widgets**, confusing users and resulting in unhandled errors upon interaction.

This audit evaluates all four platform dashboards against feature flag and capability awareness.

---

## 2. Dashboard Evaluation Scorecard

| Dashboard Component | Target Persona | Total Widgets / Cards | Feature-Flag Aware Widgets | Stale / Ghost Widget Risk | Overall Effectiveness |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `SuperAdminDashboard.tsx` | Super Admin | 14 | 14 (Control Plane) | Low | **HIGH (Fully Effective)** |
| `AdminDashboard.tsx` | Org Admin / Owner | 11 | 0 | **SEVERE** | **LOW (Stale / Ghost Widgets)** |
| `ManagerDashboard.tsx` | Team Manager | 8 | 0 | **HIGH** | **LOW (Stale / Ghost Widgets)** |
| `EmployeeDashboard.tsx` | Candidate / Employee | 9 | 0 | **SEVERE** | **LOW (Stale / Ghost Widgets)** |

---

## 3. Granular Dashboard Findings

### 3.1 Organization Admin Dashboard (`AdminDashboard.tsx`)
* **Widget 1: "Onboarding Velocity & Exceptions"**
  * Evaluates active onboarding cases and SLA breaches.
  * *Audit Finding:* Renders unconditionally even if HR Operations is restricted.
* **Widget 2: "Digital Documents Pending Execution"**
  * Displays count of pending e-signatures.
  * *Audit Finding:* If `digital_signatures` is disabled, the card still renders `X Pending Signatures`. Clicking it navigates to `/documents`, which loads normally because the route is unguarded.
* **Widget 3: "AI Course Builder Quick Action"**
  * Button: "Generate Course with AI".
  * *Audit Finding:* Button remains visible when `ai_course_builder` is disabled. Clicking it navigates to `/ai-course-builder`, triggering the amber route warning. The card should hide the button dynamically.
* **Widget 4: "Kiosk Terminal Health"**
  * Displays active kiosk counters.
  * *Audit Finding:* Still renders when `kiosk_mode` is disabled for the tenant.

### 3.2 Team Manager Dashboard (`ManagerDashboard.tsx`)
* **Widget 1: "Direct Report 30-60-90 Milestone Reviews"**
  * *Audit Finding:* Renders milestone cards even if milestone tracking is disabled.
* **Widget 2: "Buddy Program Assignment"**
  * Card: "Hires Needing Buddy Matching".
  * *Audit Finding:* If `buddy_assignment` is disabled by Super Admin, managers still see a prompt urging them to pair buddies. Clicking "Pair" triggers a failure.
* **Widget 3: "1-on-1 Check-In Schedule"**
  * *Audit Finding:* Renders calendar sync button even if external calendar integration is disabled.

### 3.3 Candidate Onboarding Dashboard (`EmployeeDashboard.tsx`)
* **Widget 1: "My Onboarding Buddy"**
  * Displays assigned buddy profile, avatar, and "Chat with Buddy" button.
  * *Audit Finding:* If the buddy feature is disabled, the card still renders, displaying empty placeholder text.
* **Widget 2: "Required Documents to Sign"**
  * Prompts candidate to complete digital signatures.
  * *Audit Finding:* If e-signatures are disabled, candidate is prompted to sign documents that cannot be completed.
* **Widget 3: "Leaderboard & Points"**
  * Displays gamification level, points, and current streak.
  * *Audit Finding:* Renders even if gamification is toggled off.

---

## 4. Remediation Standard for Dashboards

Every dashboard widget must be wrapped in a declarative capability guard:

```tsx
// Standard Widget Guard Pattern
{hasFeature('digital_signatures') && (
  <PendingSignaturesCard count={pendingDocsCount} />
)}

{hasFeature('ai_course_builder') && (
  <Button onClick={() => navigate('/ai-course-builder')}>
    <Wand2 className="h-4 w-4 mr-2" /> Generate AI Course
  </Button>
)}
```
