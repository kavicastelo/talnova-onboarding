# Release History & Feature Lineage

> **Document Purpose:** Historical Context & Product Lineage  
> **Note for AI Agents & Developers:** This document provides **historical context only**. It explains how capabilities evolved over time. The primary product specification is defined in [`00-product-model.md`](./00-product-model.md) and [`requirements/`](./requirements/README.md).

---

## 1. Historical Release Overview

The Talnova Onboarding platform evolved through two major architectural increments:

```
                  HISTORICAL RELEASE TIMELINE
                  
      V1.0.0 BASELINE FOUNDATION          V2.0.0 CAPABILITY EVOLUTION
    +----------------------------+     +----------------------------+
    | - Core Onboarding Engine   |     | - Workflow Automation Rules|
    | - Reusable Course Library  |     | - Standalone Task Engine   |
    | - Interactive Content      |  ==>| - Digital E-Signatures     |
    | - Knowledge Base           |     | - 30-60-90 Day Milestones  |
    | - Employee Handovers       |     | - Smart Buddy Matching     |
    | - Frontline Public Kiosk   |     | - AI RAG & Course Builder  |
    +----------------------------+     | - HRIS & Enterprise SSO    |
                                       +----------------------------+
```

---

## 2. V1.0.0 Baseline Capabilities

Version 1.0.0 established the functional substrate of the platform:
* **Multi-Tenant Foundation:** Tenant workspace creation (`organizationId`), JWT local authentication, and basic role permissions (`owner`, `admin`, `manager`, `employee`).
* **Visual Journey Builder:** Sequential journey template authoring, step ordering, and manual assignment to new hires.
* **LMS & Course Library:** Reusable course modules, video streaming, rich text content blocks, and basic quizzes.
* **Knowledge Base:** Document repository for organizational policy articles.
* **Frontline Kiosk Player:** Touch-first unauthenticated display player for factory terminal SOP playback.
* **Basic Employee Handovers:** Manual manager check-in confirmations upon onboarding completion.

---

## 3. V2.0.0 Extended Capabilities

Version 2.0.0 introduced intelligent automation, dynamic orchestration, and enterprise ecosystem integration across 19 execution phases:
* **Phase 01–04 (Automation & Orchestration):** Trigger-action workflow engine (`ON_USER_CREATED`), standalone multi-stage task engine with cross-role assignees, relative due dates, and dynamic journey resolution.
* **Phase 05–09 (Manager & Employee Operations):** Digital document e-signatures with cryptographic audit trails, 30-60-90 day milestone plans, smart buddy matching engine, calendar OAuth 2.0 sync, and manager check-in portals.
* **Phase 10–13 (Advanced Experience & Gamification):** Gamification engine (XP points, achievement badges, leaderboards, learning streaks), time-to-productivity analytics, and eNPS survey scoring.
* **Phase 14–15 (AI Assistance):** RAG vector search assistant over Knowledge Base documents and AI Course Builder parsing PDF/DOCX files into structured courses.
* **Phase 16–19 (Enterprise & Field Access):** SAML 2.0 / OIDC Enterprise SSO, bi-directional HRIS marketplace connectors, Mobile PWA offline IndexedDB storage, interactive office floorplan wayfinding, and signed URL kiosk security.
