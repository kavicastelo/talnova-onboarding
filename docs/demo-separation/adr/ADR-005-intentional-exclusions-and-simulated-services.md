# ADR-005: Intentional Production-Only Exclusions and Simulated Services

**Status:** Accepted  
**Date:** 2026-10-17  
**Context:**  
Certain production capabilities involve external side-effects (real transactional email delivery, SMS dispatch, credit card charging, real S3/R2 object storage) or sensitive platform administration (Super Admin tenant provisioning and audit log tampering). These must be managed in demo mode without presenting broken links or swallowing errors.

**Decision:**  
1. **Production-Only Exclusions:** Super Admin platform routes (`/super-admin/*`), live billing/invoicing, and raw infrastructure controls are strictly excluded from the demo frontend bundle.
2. **Simulated Services:**  
   - Outbound emails are captured into the `demo-email-log` sink and rendered in the demo-only `/demo/inbox` screen.
   - File uploads are routed to local sandboxed storage (`storage/demo-uploads`).
   - Enterprise integrations (HRIS, SCIM 2.0, SSO) trigger the non-intrusive `DemoRestrictedModal` to capture prospective customer commercial upgrade intent.

**Consequences:**  
- **Positive:** Zero risk of spamming real employee inboxes or altering production cloud storage.
- **Positive:** Provides sales engineering with verifiable telemetry on prospect interest.
- **Negative:** Prospective buyers testing integrations see a guided sales preview rather than a live external OAuth connection.
