# Kiosk Domain Chunk 14: Analytics, Telemetry & Audit Trail

## 1. Domain Scope

This domain defines the clear separation between operational device telemetry, product UX analytics, and legal compliance audit records, along with privacy controls and GDPR anonymization.

---

## 2. Three Distinct Telemetry Streams

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Stream 1: Operational Telemetry                      │
│  - Purpose: Fleet health monitoring, device uptime, battery, network   │
│  - Storage: KioskDeviceModel.telemetry + Time-series logs              │
│  - Retention: 30 days rolling buffer                                   │
│  - PII: Zero employee PII                                              │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                   Stream 2: Product & UX Analytics                     │
│  - Purpose: Content effectiveness, step drop-off funnels, dwell times  │
│  - Storage: KioskAnalyticsModel (aggregated by journeyId & dateKey)    │
│  - Retention: 12 months                                                │
│  - PII: Redacted; aggregated metrics (launches, completions, duration) │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                   Stream 3: Legal Compliance Audit Trail               │
│  - Purpose: OSHA / regulatory proof of training, supervisor sign-offs  │
│  - Storage: KioskSessionModel + AuditLogModel                          │
│  - Retention: 3 to 30 years (configurable per compliance policy)       │
│  - PII: Explicitly bound to employee identity (exempt from anonymize)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Privacy Controls & GDPR Redaction

- For Public / Anonymous journeys, product analytics records `userId = null` and omits IP addresses.
- Frontline worker identifiers are never logged in plaintext in application server access logs.
- When an employee profile is soft-deleted or anonymized under GDPR Article 17, compliance training records remain cryptographically verifiable under the legal obligation exemption (Article 17(3)(b)), while non-essential behavioral analytics are scrubbed.
