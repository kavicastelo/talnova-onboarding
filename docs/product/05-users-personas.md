# 05 — User & Persona Model

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative User & Persona Specification  
> **Module Namespace:** System Core

---

## 1. System Persona Overview

The Talnova Onboarding platform accommodates 8 distinct user personas across executive management, HR operations, team managers, new hire employees, peer mentors, IT administrators, and frontline kiosk operators.

```text
                                 +-------------------------+
                                 |  SUPERADMIN PLATFORM    |
                                 +-------------------------+
                                              |
                                 +-------------------------+
                                 |   ORGANIZATION OWNER    |
                                 +-------------------------+
                                              |
               +------------------------------+------------------------------+
               |                                                             |
+------------------------------+                             +------------------------------+
|     HR ADMINISTRATOR         |                             |       IT ADMINISTRATOR       |
+------------------------------+                             +------------------------------+
               |                                                             |
+------------------------------+                             +------------------------------+
|     DEPARTMENT MANAGER       |                             |     ONBOARDING BUDDY         |
+------------------------------+                             +------------------------------+
               |                                                             |
+------------------------------+                             +------------------------------+
|    EMPLOYEE (NEW HIRE)       |                             |  FRONTLINE KIOSK OPERATOR    |
+------------------------------+                             +------------------------------+
```

---

## 2. Detailed Persona Profiles

### 2.1 Persona 1: Organization Owner (`owner`)
- **Profile Name:** Victoria Sterling
- **Job Title:** VP of People & Operations / Co-Founder
- **Context:** Responsible for overall company workplace setup, compliance governance, security policies, and subscription billing.
- **Goals:** Guarantee enterprise-wide data security, enforce SAML/OIDC SSO login, maintain corporate branding, ensure zero multi-tenant data leaks.
- **Pain Points:** Tedious user provisioning, lack of visibility into multi-department onboarding compliance, security risks with unauthenticated tools.
- **Permissions:** Full organization tenant privileges, SSO configuration, organization settings, administrator management.
- **Primary Journeys:** Workspace creation, SSO configuration, HR Admin role assignment, executive compliance dashboard review.

### 2.2 Persona 2: HR Administrator (`admin`)
- **Profile Name:** Sarah Jenkins
- **Job Title:** Senior HR Operations Manager
- **Context:** Manages daily onboarding operations for 500+ employees across office and remote teams. Creates content, schedules onboarding, monitors completion rates.
- **Goals:** Automate new hire setup, eliminate manual paper signing, accelerate time-to-productivity, handle stuck onboarding plans quickly.
- **Pain Points:** High volume of manual follow-ups, lost paper NDAs, lack of visibility into manager check-ins, slow course authoring.
- **Permissions:** Full HR operations access, journey builder, document templates, milestone templates, smart assignment rules, workflow automation, analytics.
- **Primary Journeys:** Journey curriculum creation, document template setup, smart rule definition, HR operations exception queue management, eNPS survey review.

### 2.3 Persona 3: Department Manager (`manager`)
- **Profile Name:** Marcus Vance
- **Job Title:** Engineering / Sales Manager
- **Context:** Leads a team of 12 direct reports. Needs new hires to get up to speed quickly on team-specific tools and workflows.
- **Goals:** Track direct reports' progress, identify struggling new hires early, conduct structured 30-60-90 day milestone reviews, log 1-on-1 check-ins.
- **Pain Points:** Unaware if new hires complete critical safety/compliance tasks, no visibility into quiz scores, missed 1-on-1 check-ins.
- **Permissions:** Team scoping (`managerId`), direct report progress dashboard, milestone evaluation sign-off, team task assignment, check-in logger.
- **Primary Journeys:** Team dashboard monitoring, quiz score drilldown, 30-60-90 day milestone review and rating, 1-on-1 meeting logging.

### 2.4 Persona 4: Employee / New Hire (`employee`)
- **Profile Name:** Alex Rivera
- **Job Title:** Software Engineer / Product Specialist
- **Context:** Newly hired employee undergoing onboarding during their first 90 days.
- **Goals:** Understand company culture, complete mandatory compliance training, sign legal documents, meet team members, earn achievement badges.
- **Pain Points:** Overwhelmed by fragmented onboarding emails, unclear priorities, lack of feedback from manager, missing meeting links.
- **Permissions:** Read/consume assigned journeys, complete content blocks and quizzes, sign assigned documents, update milestone self-check-ins, view buddy profile.
- **Primary Journeys:** Single Sign-On login, onboarding journey progression, e-signature document completion, milestone self check-in, XP level tracking.

### 2.5 Persona 5: Onboarding Buddy (`buddy`)
- **Profile Name:** Elena Rostova
- **Job Title:** Senior Product Designer (Peer Mentor)
- **Context:** Experienced employee paired with a new hire to provide informal guidance, answer cultural questions, and host weekly check-ins.
- **Goals:** Welcome new hire, ensure smooth informal integration, log structured weekly 1-on-1 feedback notes.
- **Pain Points:** Unsure what topics to cover each week, forgotten meetings, lack of structure in buddy program.
- **Permissions:** Buddy profile management, assigned buddy pairing view, weekly agenda access, meeting feedback logging.
- **Primary Journeys:** Buddy profile creation, viewing assigned buddy details, conducting weekly agenda check-ins, logging 1-on-1 notes.

### 2.6 Persona 6: IT Administrator (`it_admin`)
- **Profile Name:** David Vance
- **Job Title:** IT Systems Administrator
- **Context:** Responsible for IT provisioning, laptop hardware shipping, access account setup, security token issuance, and kiosk hardware fleet pairing.
- **Goals:** Complete IT onboarding tasks on schedule, receive automated task alerts, monitor kiosk terminal telemetry and battery health.
- **Pain Points:** Late notifications for new hires, missing equipment specs, offline kiosk terminals without alerts.
- **Permissions:** Cross-person IT task execution view, hardware pairing code generation, kiosk device telemetry management, integration settings.
- **Primary Journeys:** IT task queue completion, laptop setup verification, 6-digit kiosk device pairing, integration webhook setup.

### 2.7 Persona 7: Frontline Kiosk Operator (`kiosk_operator`)
- **Profile Name:** Manuel Silva
- **Job Title:** Warehouse Operator / Forklift Driver
- **Context:** High-noise, fast-paced industrial environment (factory floor, warehouse entry). Wears heavy PPE (gloves, hardhat). Low literacy / language barriers.
- **Goals:** Quickly review forklift inspection SOPs and safety briefs before shift starts without remembering passwords or emails.
- **Pain Points:** Tiny touchscreen buttons impossible with gloves, complex text instructions, lack of native language audio narration.
- **Permissions:** Unauthenticated player session constrained to signed URL kiosk path.
- **Primary Journeys:** Approach kiosk terminal, select national flag language button, tap oversized 64px visual slides, listen to audio narration, confirm SOP.

### 2.8 Persona 8: SuperAdmin (`super_admin`)
- **Profile Name:** Platform Operations Director
- **Context:** Operations team member managing the multi-tenant SaaS environment across hundreds of corporate clients.
- **Goals:** Monitor global system health, manage tenant lifecycle, inspect platform audit logs, manage billing states.
- **Pain Points:** Cross-tenant data leak risks, unmonitored API errors.
- **Permissions:** Global cross-tenant read/write privileges, tenant creation, platform telemetry.
- **Primary Journeys:** SuperAdmin tenant dashboard, global analytics review, platform audit log inspection.
