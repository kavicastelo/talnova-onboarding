# Proposed Information Architecture & Navigation Design

> **System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Document:** Coherent Information Architecture Specification  
> **Focus:** Cognitive Load Reduction, Progressive Disclosure & Journey-Oriented Navigation  

---

## 1. Information Architecture Principles

1. **Orientation & Mental Model Alignment:**
   - Group capabilities by *what the user is attempting to accomplish* rather than database entities or backend service modules.
   - Distinct, intuitive conceptual sections:
     - **Daily Operations & People**
     - **Onboarding & Learning Curriculum**
     - **Workplace & Employee Support**
     - **System Governance & Automation**

2. **Progressive Disclosure:**
   - High-frequency operational items remain immediately visible.
   - Low-frequency administrative items and advanced configuration tools are nested logically inside sub-menus or dedicated section hubs (e.g. `SSO & Identity` and `HRIS Integrations` accessible within `Settings`).
   - Deep links and direct routes continue to resolve transparently.

3. **Role Differentiation without Isolation:**
   - Employees see a focused, encouraging journey with explicit phase progression.
   - Managers see team-focused oversight, approvals, and coaching tools.
   - Admins and Owners see end-to-end pipeline management, exceptions workbench, and configuration controls.
   - IT Admins receive immediate focus on hardware queues and integration health.
   - SuperAdmins retain dedicated tenant and platform oversight.

4. **Multi-Level Navigation Structure:**
   - **Global Level:** Sticky header with active workspace indicator, search palette trigger (`⌘K`), language switcher, role switcher, notifications center, and user account dropdown.
   - **Primary Level:** Responsive sidebar structured with semantic section groups and expandable nested sub-items.
   - **Contextual Level:** Page-level tabs, header quick-actions, and "Next Step" continuation guidance cards.
   - **Discovery Level:** Full-coverage Command Palette indexing all 44 routes and key actions.
   - **Mobile Level:** Adaptive bottom navigation bar with role-tailored high-frequency shortcuts and access to the complete slide-over menu.

---

## 2. Reorganized Navigation Architecture by Role

```
===================================================================================
ADMIN & OWNER NAVIGATION (Structured Domain Groups)
===================================================================================
Overview
├── 📊 Dashboard                                     [/]
├── 🛡️ HR Operations & Handovers                     [/hr-ops]
└── 🚨 Exceptions & Stuck Cases                      [/hr-ops/exceptions]

People & Teams
├── 👥 Employee Directory                            [/directory]
├── 👔 Team Operations (Managers)                    [/manager]
├── 🤝 Buddy Program & Pairing                       [/buddy]
└── 🎯 30/60/90 Day Milestones                       [/milestones]

Learning & Content
├── 🎓 Journey Templates                             [/journeys]
│   └── ✏️ Journey Builder (Contextual)               [/journeys/:id]
├── 🪄 AI Course Builder                             [/ai-course-builder]
└── 📖 Knowledge Base & Handbooks                    [/kb]

Operations & Logistics
├── 📝 Digital Documents & Compliance                [/documents]
├── ✅ Tasks & Checklists                            [/tasks]
│   └── 💻 IT Hardware Provisioning Queue             [/tasks/it-ops]
├── 📅 Calendar & Orientation Meetings               [/calendar]
└── 📺 Kiosk Terminals (Frontline SOPs)              [/kiosks]

System & Insights
├── 📈 Analytics & Drop-off Reports                  [/analytics]
├── ⚡ Workflows & Automation Rules                  [/workflows]
├── 🗺️ Workplace Office Map                          [/office-map]
├── 🤖 AI Assistant                                  [/ai-assistant]
└── ⚙️ Workspace Settings                            [/settings]
    ├── 🔑 SSO & Identity (SAML / OIDC)              [/settings/sso]
    └── 🔗 HRIS Integrations (BambooHR, Workday)      [/settings/integrations]

===================================================================================
EMPLOYEE / NEW HIRE NAVIGATION (Journey Progression)
===================================================================================
My Onboarding
├── 🚀 Onboarding Roadmap (Active Phase)             [/employee]
├── 📄 Required Documents & E-Signatures             [/documents]
├── ✅ Checklist Tasks (Day 1 / Week 1)              [/tasks]
└── 🎓 Learning Journeys (LMS Courses)               [/journeys]

Support & Milestones
├── 🤝 My Onboarding Buddy                           [/buddy]
├── 🎯 30/60/90 Day Goals & Reviews                  [/milestones]
└── 📅 Schedule & 1-on-1 Meetings                    [/calendar]

Workplace & Resources
├── 📖 Company Knowledge Base                        [/kb]
├── 🤖 AI Assistant                                  [/ai-assistant]
├── 🏆 Earned Certificates                           [/certificates]
├── 🗺️ Workplace Office Map                          [/office-map]
└── 🏅 Community Leaderboard                         [/leaderboard]

===================================================================================
MANAGER NAVIGATION (Team Supervision & Coaching)
===================================================================================
Team Supervision
├── 👔 Team Operations Dashboard                     [/manager]
├── 🎯 30/60/90 Milestone Reviews                    [/milestones]
└── ✅ Direct Report Tasks & Verification            [/tasks]

People & Mentorship
├── 👥 Department Directory                          [/directory]
├── 🤝 Buddy Support & Assignment                    [/buddy]
└── 📅 1-on-1 Check-in Calendar                      [/calendar]

Insights & Tools
├── 📈 Team Velocity Analytics                       [/analytics]
├── 📖 Company Knowledge Base                        [/kb]
├── 🗺️ Workplace Office Map                          [/office-map]
└── 🤖 AI Assistant                                  [/ai-assistant]

===================================================================================
IT ADMINISTRATOR NAVIGATION (Hardware & Provisioning)
===================================================================================
Hardware & Provisioning
├── 💻 IT Hardware Provisioning Queue                [/tasks/it-ops]
└── ✅ Tasks & Operational Checklists                [/tasks]

Systems & Workplace
├── 🔗 HRIS & System Integrations                    [/settings/integrations]
├── 👥 Employee Directory                            [/directory]
├── 📖 Knowledge Base (IT Specs & Setup)             [/kb]
└── 🗺️ Workplace Office Map (Hardware/Desks)        [/office-map]

===================================================================================
SUPER ADMIN NAVIGATION (Platform Multi-Tenant Oversight)
===================================================================================
Platform Management
├── 📊 Global Platform Health                        [/super-admin]
├── 🏢 Organizations & Workspaces                    [/super-admin/organizations]
└── 💳 Cross-Tenant Finance & Billing                [/super-admin/finance]
```

---

## 3. Contextual Navigation & "What Next" Journey Continuity

To prevent dead ends after completing a task, the platform introduces contextual navigation aids:
1. **Completion Handover to Next Journey:**
   - Signing documents on `/documents/:id/sign` displays a "Next Step: Proceed to Day 1 Checklist Tasks" call-to-action button upon completion.
   - Passing an LMS quiz on `/course/:id` guides the employee to view their updated progress on `/employee` or review milestones on `/milestones`.
   - Creating a journey on `/journeys/:id` suggests "Invite New Hires" or "Configure Workflow Automation".
2. **Dynamic Badges & Counts:**
   - Documents displays a badge if the employee has unsigned mandatory forms.
   - Exceptions displays a warning badge if there are quarantined hires requiring admin triage.
   - Direct reports count and overdue alerts displayed on Manager Dashboard.
3. **Comprehensive Breadcrumb Hierarchy:**
   - Explicit parent/child relationships (e.g. `HR Operations > Exceptions & Quarantined Cases`, `Settings > SSO & Identity`, `Tasks > IT Hardware Queue`).
