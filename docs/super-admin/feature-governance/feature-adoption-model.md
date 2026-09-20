# Feature Adoption Telemetry & Mathematical Model

> **Document Status:** Authoritative Telemetry Specification  
> **Target:** Feature Adoption Engine & Cross-Tenant Telemetry Warehouse  
> **Date:** September 2026  

---

## 1. Mathematical Telemetry Model

To eliminate fabricated synthetic multipliers, feature adoption must be computed deterministically from verified transactional events:

### 1.1 Organization Adoption Rate
$$\text{Org Adoption \%} = \frac{N_{\text{active\_orgs}}}{N_{\text{eligible\_orgs}}} \times 100$$
Where:
* $N_{\text{active\_orgs}}$: Number of distinct organizations that recorded $\ge 1$ verified domain event for the feature within the last 30 days.
* $N_{\text{eligible\_orgs}}$: Number of active organizations that have the feature flag enabled.

### 1.2 User Adoption Rate
$$\text{User Adoption \%} = \frac{U_{\text{active}}}{U_{\text{eligible}}} \times 100$$
Where:
* $U_{\text{active}}$: Distinct users who executed $\ge 1$ action using the feature within the evaluation window.
* $U_{\text{eligible}}$: Total active users whose role permits access to the feature within organizations where the feature is enabled.

---

## 2. Telemetry Data Schemas

### 2.1 Granular Event Collection (`feature_usage_records`)
```typescript
interface IFeatureUsageRecord {
  featureKey: string;             // Canonical key (e.g. 'digital_signatures')
  organizationId: ObjectId;      // Scoped tenant ID
  userId: ObjectId;              // Executing actor
  userRole: string;              // 'employee', 'manager', 'admin'
  actionName: string;            // 'SIGN_DOCUMENT', 'GENERATE_AI_COURSE'
  metadata?: Record<string, any>;// Additional contextual payload
  timestamp: Date;               // Event timestamp (indexed for TTL)
}
```

### 2.2 Pre-Aggregated Rollup Collection (`feature_adoption_rollups`)
To support real-time querying without executing full collection scans over millions of events:
```typescript
interface IFeatureAdoptionRollup {
  featureKey: string;
  period: "daily" | "weekly" | "monthly";
  date: Date;
  totalEvents: number;
  uniqueOrganizations: number;
  uniqueUsers: number;
  organizationsEligible: number;
  organizationAdoptionPct: number;
  usersEligible: number;
  userAdoptionPct: number;
  roleBreakdown: {
    role: string;
    uniqueUsers: number;
    eventCount: number;
  }[];
}
```

---

## 3. Instrumentation Standards for Domain Workflows

Domain services record feature invocations via a non-blocking asynchronous call:

```typescript
// Standard Controller/Service Instrumentation Pattern
await FeatureTelemetryService.recordUsage({
  featureKey: "digital_signatures",
  organizationId: user.organizationId,
  userId: user.id,
  userRole: user.role,
  actionName: "EXECUTE_SIGNATURE",
  metadata: { documentId: doc._id }
});
```

* Fire-and-forget: Telemetry persistence failures must never abort primary user transactions.
* Buffered writes: In high-throughput environments, records are queued in memory and flushed in micro-batches (e.g. 50 events or 1 second).
