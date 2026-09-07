# TALNOVA ONBOARDING — BROKEN PROCESS LOG

Generated: 2026-08-23
Auditor: Master Browser Process-Flow Forensic Validation Agent

---

## Broken Business Process Audit Findings

### Summary
- Core Onboarding Workflows Broken: 0
- Critical Process Failures (P0): 0
- Major Workflow Failures (P1): 0
- Environment-Blocked External Dependencies (P2/P3): 3

---

## Process Breakdown Analysis

| Process ID | Process Name | Internal Logic Status | External Integration Status | Overall Result | Root Cause / Note |
|---|---|:---:|:---:|:---:|---|
| FLOW-033 | Google/Outlook Calendar Live OAuth | Functional | Blocked | BLOCKED | External provider credentials (`GOOGLE_CLIENT_ID`, `MS_CLIENT_ID`) missing in dev sandbox environment. Internal calendar & ICS export work. |
| FLOW-049 | Live HRIS Provider API Sync | Functional | Blocked | BLOCKED | Live API keys for external HRIS tools (Workday, Rippling, BambooHR) missing. Internal connector pipeline works. |
| FLOW-050 | Live SAML SSO Assertion | Functional | Blocked | BLOCKED | External Identity Provider (Okta / Azure AD tenant) assertion endpoint missing. Internal SSO configuration works. |

---

## Data State & Persistence Audits
- Create Employee -> Reload -> Persisted in DB: PASS
- Create Task -> Reload -> Persisted in DB: PASS
- Create Journey -> Reload -> Persisted in DB: PASS
- Sign Document -> Reload -> Status `SIGNED` Persisted: PASS
- Log Buddy Check-in -> Reload -> Check-in record Persisted: PASS
- Save Workflow Rule -> Reload -> Rule active in DB: PASS
- Complete Lesson & Quiz -> Reload -> Progress percentage updated: PASS
- Desk Booking -> Reload -> Seat reserved in DB: PASS
