# 19 — Release Scope & Categorization

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative Product Release Scope Specification  
> **Module Namespace:** System Core

---

## 1. Scope Classification Tiers

Product capabilities are categorized into 5 operational release tiers based strictly on documented business requirements and implementation dependencies:

1. **Core / Foundation:** Mandatory tenant boundaries, security models, authentication, and core data primitives.
2. **MVP (Minimum Viable Product):** Essential onboarding journey authoring, standalone checklists, document signing, and manager dashboards required for initial customer launch.
3. **Extended:** Operational enhancements including automated workflows, 30-60-90 milestones, buddy matching, calendar sync, gamification, and analytics.
4. **Advanced:** Enterprise capability layer including AI RAG Assistant, AI Course Builder, SAML/OIDC SSO, HRIS integrations, PWA field access, office map.
5. **Optional / Future:** Advanced recommendations requiring product-owner prioritization (Redis cluster, OpenTelemetry, vector DB migration).

---

## 2. Release Scope Matrix

| Capability / Feature Name | Domain | Release Scope Tier | Baseline vs Extended Origin | Requirement IDs |
| :--- | :--- | :---: | :---: | :--- |
| Multi-Tenant Workspace & Data Isolation | Core Platform | **Core / Foundation** | v1.0.0 | CON-REQ-001 |
| Multi-Role Authorization (RBAC) | Core Platform | **Core / Foundation** | v1.0.0 / v2.0.0 | CON-REQ-003 |
| JWT Authentication & Session Management | Core Platform | **Core / Foundation** | v1.0.0 | CON-REQ-001 |
| User Directory & Org Management | Core Platform | **Core / Foundation** | v1.0.0 | CON-REQ-004 |
| Visual Journey Builder & Curriculum Engine | Journeys & Content | **MVP** | v1.0.0 | CON-REQ-005 |
| Multi-Format Interactive Content Blocks | Journeys & Content | **MVP** | v2.0.0 | CON-REQ-006 |
| Prerequisite & Quiz Passing Gating | Journeys & Content | **MVP** | v1.0.0 / v2.0.0 | CON-REQ-007 |
| Standalone Multi-Stage Task Engine | Task & Workflow | **MVP** | v2.0.0 | CON-REQ-012 |
| Cross-Person Task Handoff (IT/HR/Manager) | Task & Workflow | **MVP** | v2.0.0 | CON-REQ-013 |
| Digital Document Templates & Canvas E-Signing| Enablement & E-Sign | **MVP** | v2.0.0 | CON-REQ-027, CON-REQ-028 |
| Manager Direct Report Dashboard | Manager & HR Ops | **MVP** | v2.0.0 | CON-REQ-016 |
| Unauthenticated Public Kiosk Safety Player | Mobile & Kiosk | **MVP** | v1.0.0 | CON-REQ-037 |
| Event-Driven Workflow Automation Rules | Task & Workflow | **Extended** | v2.0.0 | CON-REQ-015 |
| Smart Journey Auto-Assignment Rules | Journeys & Content | **Extended** | v2.0.0 | CON-REQ-008 |
| 30-60-90 Day Milestone Success Plans | Manager & HR Ops | **Extended** | v2.0.0 | CON-REQ-019, CON-REQ-020 |
| Smart Buddy Program & 1-on-1 Logger | Enablement & Culture | **Extended** | v2.0.0 | CON-REQ-023, CON-REQ-024 |
| Personal iCal & Calendar OAuth Sync | Integrations & AI | **Extended** | v2.0.0 | CON-REQ-032 |
| Operational Analytics & Time-to-Productivity| Manager & HR Ops | **Extended** | v2.0.0 | CON-REQ-022 |
| Gamification XP, Levels & Leaderboards | Enablement & Culture | **Extended** | v2.0.0 | CON-REQ-025, CON-REQ-026 |
| RAG Conversational AI Onboarding Assistant | Integrations & AI | **Advanced** | v2.0.0 | CON-REQ-033 |
| AI Document-to-Course & Quiz Builder | Integrations & AI | **Advanced** | v2.0.0 | CON-REQ-034 |
| Enterprise SAML 2.0 & OIDC Single Sign-On | Core Platform | **Advanced** | v2.0.0 | CON-REQ-002 |
| HRIS Integration Marketplace (BambooHR/Workday)| Integrations & AI | **Advanced** | v2.0.0 | CON-REQ-030 |
| Mobile PWA & Offline Field Task Sync | Mobile & Kiosk | **Advanced** | v2.0.0 | CON-REQ-035 |
| Interactive Office Floorplan & Wayfinding | Mobile & Location | **Advanced** | v2.0.0 | CON-REQ-036 |
| Kiosk 6-Digit PIN Device Telemetry | Mobile & Kiosk | **Advanced** | v2.0.0 | CON-REQ-038 |
| Distributed Redis Queue Infrastructure | Infrastructure | **Optional / Future** | Recommendation | RECOMMENDATION-001 |
| OpenTelemetry Distributed Tracing | Infrastructure | **Optional / Future** | Recommendation | RECOMMENDATION-002 |
