# 14 — Non-Functional Requirements

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative System Quality & Performance Specification  
> **Module Namespace:** System Core

---

## 1. Executive Summary & NFR Categories

This specification defines the non-functional requirements (NFRs) governing performance, scalability, availability, security, accessibility, observability, and offline resilience for the Talnova Onboarding platform.

---

## 2. Comprehensive Non-Functional Requirements Catalog

### 2.1 Performance & Latency SLAs
- **NFR-PERF-01 (API Response Latency):** 95% of REST API requests must respond within < 200ms under standard production load.
- **NFR-PERF-02 (Kiosk Player Transitions):** Once visual/audio assets are cached, slide-to-slide transitions on frontline kiosk terminals must render within < 100ms.
- **NFR-PERF-03 (Static Asset Payload):** Server-side media transcoding (WebM/MP4, WebP/AVIF, Opus audio) must keep individual slide media payloads below 1.5MB.

### 2.2 Scalability & Architecture
- **NFR-SCAL-01 (Stateless Fastify Application):** Application servers must remain strictly stateless, utilizing token-based JWT authentication to enable horizontal scaling behind Nginx load balancers without session affinity.
- **NFR-SCAL-02 (Database Indexing Strategy):** All MongoDB collections must enforce compound indexes starting with `organizationId` to guarantee constant-time ($O(1)$) tenant query execution.

### 2.3 Availability & Reliability
- **NFR-RELI-01 (Uptime Target):** Multi-tenant SaaS platform targets 99.9% application availability (excluding scheduled maintenance windows).
- **NFR-RELI-02 (Background Job Recovery):** Node-cron schedulers and background workers must implement idempotent processing with MongoDB state locking to prevent duplicate notification dispatching.

### 2.4 Accessibility & Ergonomics (WCAG 2.1 AA/AAA)
- **NFR-ACCESS-01 (Glove-Friendly Touch Targets):** Interactive touch controls on Public Kiosk player interfaces must occupy a minimum size of 64px x 64px (approx. 9mm x 9mm) to allow reliable interaction by workers wearing heavy industrial safety gloves.
- **NFR-ACCESS-02 (Visual Contrast Ratio):** Essential warning blocks, safety text, and action buttons must maintain a minimum contrast ratio of 7:1 against background colors.
- **NFR-ACCESS-03 (Audio Narration & ARIA):** Visual safety instructions on kiosk displays must be accompanied by synchronized audio narration; screen reader attributes (`aria-live`, `aria-label`) must update dynamically.

### 2.5 Mobile PWA & Offline Resilience
- **NFR-MOB-01 (PWA Field Installation):** Web application must satisfy Progressive Web App (PWA) criteria, including Web App Manifest (`public/manifest.json`) and Service Worker registration (`public/sw.js`).
- **NFR-MOB-02 (IndexedDB Offline Queue):** Field staff task completions performed without network connectivity must persist in IndexedDB and automatically synchronize via background sync when connectivity is restored.

### 2.6 Observability, Maintainability & Code Quality
- **NFR-CODE-01 (Strict TypeScript Standard):** The entire backend and frontend codebase must maintain strict TypeScript compiler compliance (`strict: true`) with zero use of the `any` type.
- **NFR-OBS-01 (Structured JSON Logging):** Application servers must emit structured JSON log entries using Pino logger, tagging each log line with `requestId`, `organizationId`, and execution duration.
