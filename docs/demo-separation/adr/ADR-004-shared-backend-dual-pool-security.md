# ADR-004: Shared Backend Architecture with Dual Connection Pools and Cryptographic Isolation

**Status:** Accepted  
**Date:** 2026-10-17  
**Context:**  
The demo frontend requires backend services to support onboarding journeys, task checklists, document signing, and candidate profiles. We evaluated deploying a completely separate backend server vs. retaining the existing shared Fastify backend with strictly partitioned connection pools and cryptographic tokens.

**Decision:**  
Retain the existing shared Fastify backend with dual Mongoose connection pools (`mongoose.connection` for production, `demoConnection` for demo). Cryptographic JWT separation (`JWT_SECRET` vs `DEMO_JWT_SECRET`) guarantees that demo tokens can never be used to query or mutate production collections, and production tokens cannot access demo models.

**Consequences:**  
- **Positive:** Zero additional backend deployment overhead or server hosting costs.
- **Positive:** Leverages existing 34 verified automated backend tests ensuring physical database isolation.
- **Positive:** Centralizes Super Admin observability and enables 1-click deterministic baseline resets.
- **Negative:** Requires CORS configuration to allow both production and demo client origins.
