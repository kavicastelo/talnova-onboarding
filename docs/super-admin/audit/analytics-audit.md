# Super Admin Analytics & Telemetry Engine Audit

> **Document Status:** Authoritative Analytics & Telemetry Audit  
> **System:** Talnova Onboarding Enterprise Platform  
> **Evaluation Scope:** Telemetry aggregation pipelines, time-series rollups, growth algorithms, and metric definitions.  

---

## 1. Executive Summary of Analytics Engine

The Super Admin analytics engine resides primarily in `server/src/modules/super-admin/routes/super-admin.routes.ts` within two core endpoints:
* `GET /telemetry`: Real-time operational counters, 30-day delta percentages, and 6-month dynamic growth trends.
* `GET /finance`: Subscription tier distribution, MRR/ARR aggregations, ARPU, and historical growth.

### Summary Verdict:
* **Real-Time Operational Analytics:** High integrity. Dynamic 6-month historical counts for Organizations, Users, and Onboarding cases are computed using MongoDB `createdAt: { $lte: endOfMonth }` time-bucket queries.
* **Financial Analytics:** Flawed by hardcoded zero-expenses in `/telemetry` and synthetic `scaleFactor` math in `/finance`.

---

## 2. Dynamic 6-Month Growth Pipeline (`GET /telemetry`)

In `super-admin.routes.ts:214-249`, the backend constructs a dynamic 6-month time series for Recharts Area visualization:

```typescript
for (let i = 5; i >= 0; i--) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
  const monthLabel = monthNames[targetDate.getMonth()];

  const orgsCount = await Organization.countDocuments({ createdAt: { $lte: endOfMonth }, isDeleted: false });
  const usersCount = await User.countDocuments({ createdAt: { $lte: endOfMonth }, isDeleted: false });
  const monthlyPaidInvoices = await Invoice.find({ status: "Paid", createdAt: { $gte: startOfMonth, $lte: endOfMonth } });
  const monthlyRevenue = monthlyPaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const monthlyOnboardings = await OnboardingCase.countDocuments({ createdAt: { $gte: startOfMonth, $lte: endOfMonth } });

  growthData.push({ month: monthLabel, organizations: orgsCount, revenue: monthlyRevenue, users: usersCount, onboardings: monthlyOnboardings });
}
```

### Forensic Verdict:
* **Timezone Safety:** Uses UTC month boundaries.
* **Cumulative vs Discrete Metrics:** Correctly treats Organizations and Users as cumulative snapshots (`$lte: endOfMonth`), while treating Revenue and Onboardings as discrete monthly volumes (`$gte: startOfMonth, $lte: endOfMonth`).
* **Performance Consideration:** In a high-scale deployment, executing 24 individual count queries inside a loop on each dashboard request will introduce latency. Historical months (1 to 5) should be cached or aggregated via a scheduled daily rollup model (`SystemMetricDaily`).

---

## 3. Financial Metrics Integrity (`GET /finance`)

### 3.1 MRR & ARR Calculations
* **Formula:**
  $$\text{Total MRR} = \sum_{\text{active orgs}} \text{monthlyPrice}$$
  $$\text{Total ARR} = \text{Total MRR} \times 12$$
  $$\text{ARPU} = \frac{\text{Total MRR}}{\text{Total Platform Users}}$$
* **Evaluation:** Accurate based on organization subscription plan mapping (`Starter: $99`, `Pro: $299`, `Enterprise: $999`).

### 3.2 Tier Distribution Calculation
* Categorizes organizations into Starter, Pro/Growth, and Enterprise tiers.
* Computes percentage distribution and ARR run-rate per tier.
* **Verdict: ACCURATE.**

### 3.3 Historical MRR Defect (Repeated Finding)
* Line 1415 introduces `scaleFactor = Math.max(0.4, (6 - i) / 6)`, fabricating historical MRR. This must be replaced with true invoice aggregations.

---

## 4. Journey & Feature Adoption Analytics Gaps

1. **Journey Completion Funnel Missing:** There is no aggregation tracking drop-off across individual journey steps. While `OnboardingCase.state` tracks macro states (`provisioning`, `active`, `completed`), step-level completion telemetry is absent.
2. **Feature Adoption Matrix is Static:** `SuperAdminFeatures.tsx` renders a hardcoded array rather than aggregating feature adoption from active organization configurations.
