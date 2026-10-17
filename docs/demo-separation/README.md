# Talnova Demo Separation & Feature Parity Documentation

Welcome to the central documentation index for the **Talnova Onboarding Demo Separation and Feature Parity** engineering initiative.

This directory contains the complete technical reports, root-cause analyses, feature audit matrices, target architectures, decision records, and implementation plans required to establish an independently buildable, secure, and isolated demo environment.

---

## Document Index

1. [`01-discovery-report.md`](./01-discovery-report.md)  
   **Phase Zero: Repository Discovery Report**  
   Verified architecture, technology stack, coupling dimensions, and verified code facts.

2. [`02-routing-security-analysis.md`](./02-routing-security-analysis.md)  
   **Phase One: Route and Security Failure Root-Cause Analysis**  
   In-depth diagnosis of unintended redirects to production login/registration, 401 interceptor behavior, missing 404 routes, and route behavior matrix.

3. [`03-feature-parity-matrix.md`](./03-feature-parity-matrix.md) & [`feature-parity.json`](./feature-parity.json)  
   **Phase Two: Demo Feature-Parity Audit**  
   Complete audit of 30 platform capabilities, identifying required parity items, simulated services, and intentional exclusions.

4. [`04-target-architecture.md`](./04-target-architecture.md) & [`04-deployment-env-spec.md`](./04-deployment-env-spec.md)  
   **Phase Three: Independent Demo Architecture & Deployment Specification**  
   System architecture diagrams, independent Vite build configuration, storage sandboxing, trust boundaries, and environment templates.

5. **Architectural Decision Records (`adr/`)**  
   - [`ADR-001: Independent Demo Frontend Build Target`](./adr/ADR-001-independent-build-target.md)
   - [`ADR-002: Routing Isolation & Error Boundaries`](./adr/ADR-002-routing-isolation-and-error-boundaries.md)
   - [`ADR-003: Storage & Session Sandboxing`](./adr/ADR-003-storage-and-session-sandboxing.md)
   - [`ADR-004: Shared Backend Dual Pool Security`](./adr/ADR-004-shared-backend-dual-pool-security.md)
   - [`ADR-005: Intentional Production-Only Exclusions`](./adr/ADR-005-intentional-exclusions-and-simulated-services.md)

6. [`05-implementation-plan.md`](./05-implementation-plan.md)  
   **Phase Four: Implementation Plan**  
   Detailed task specifications, dependencies, acceptance criteria, rollback plans, and test definitions across 5 execution phases.

7. [`06-execution-status.md`](./06-execution-status.md)  
   **Execution Status Tracker**  
   Live status board tracking all task IDs, testing outcomes, blockers, and verified phases.

8. [`07-release-runbook.md`](./07-release-runbook.md)  
   **Production Release Runbook & Deployment Guide**  
   Complete hosting configurations (Netlify, Cloudflare Pages, S3+CloudFront, NGINX), environment variables, smoke testing scripts, and rollback procedures.

9. [`07-final-handover.md`](./07-final-handover.md)  
   **Final Handover & Operational Audit Report**  
   Comprehensive architecture decoupling report, testing verification logs, security boundary assurances, operator runbooks, and sign-offs.

---

## Reusable Prompt Library

The accompanying agent prompt library is located under [`../../prompts/demo-separation/`](../../prompts/demo-separation/):
- `00-master-orchestrator.md`
- `01-repository-discovery.md`
- `02-routing-root-cause.md`
- `03-feature-parity-audit.md`
- `04-architecture-design.md`
- `05-implementation-planning.md`
- `06-routing-and-error-isolation.md`
- `07-demo-build-and-configuration.md`
- `08-page-and-component-parity.md`
- `09-workflow-and-api-integration.md`
- `10-security-review.md`
- `11-testing-and-regression.md`
- `12-independent-deployment.md`
- `13-release-verification.md`
- `14-final-audit-and-handover.md`
