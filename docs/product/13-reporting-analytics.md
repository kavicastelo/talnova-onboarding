# 13 — Reporting & Analytics

> **Document Version:** Consolidated Baseline (v1.0.0 + v2.0.0)  
> **Status:** Authoritative Operational Analytics & Telemetry Specification  
> **Module Namespace:** System Core

---

## 1. Analytics & Reporting Architecture

The Talnova Onboarding platform provides real-time operational reporting and learning analytics (`analytics.service.ts`, `hr-operations.service.ts`) across 3 analytical perspectives:
1. **Executive & HR Operations:** Time-to-productivity, completion rates, eNPS satisfaction, department benchmarking.
2. **Department & Team Managers:** Team progress, quiz failure drilldown, time spent learning, direct report confidence scores.
3. **SuperAdmin Platform Operations:** Cross-tenant system usage, active user metrics, storage consumption.

---

## 2. Core Operational Metrics Catalog

| Metric / Report Name | Metric Code | Target Persona | Data Source & Formula | Key Insights / Value |
| :--- | :--- | :--- | :--- | :--- |
| **Average Time-to-Productivity** | `MET-TTP` | HR Admin, Exec | $$\text{TTP} = \text{Avg}(\text{completedAt} - \text{hireDate})$$ | Measures onboarding efficiency and speed to full operational ramp. |
| **Department Completion Comparison** | `MET-DCC` | HR Admin, Exec | Completion % per department across all assigned journeys | Identifies lagging departments requiring curriculum intervention. |
| **Highest Failure Modules** | `MET-HFM` | HR Admin, Author | Modules with highest quiz failure rate ($< 80\%$) | Pinpoints confusing learning content or unfair test questions. |
| **Difficult Quiz Question Breakdown**| `MET-DQB` | HR Admin, Author | Question-level incorrect response frequency | Highlights specific knowledge gaps for content revision. |
| **Learning Time Telemetry** | `MET-LTT` | Manager, HR Admin | Total active learning hours tracked via player heartbeat | Measures time invested in corporate enablement. |
| **Manager Effectiveness Score** | `MET-MES` | HR Admin, Exec | Weighted score: Team completion % (60%) + Milestone sign-off speed (40%) | Evaluates manager commitment to onboarding direct reports. |
| **New-Hire Satisfaction (eNPS)** | `MET-NPS` | HR Admin, Exec | eNPS rating score (-100 to +100) from onboarding surveys | Tracks employee sentiment during the first 90 days. |
| **Employee Confidence Score** | `MET-ECS` | Manager, HR Admin | Self-reported confidence score (1-5 stars) in 30-60-90 check-ins | Provides qualitative pulse on employee preparedness. |
| **Onboarding Exception Queue** | `RPT-EXC` | HR Admin | List of employees with overdue tasks or stuck for > 7 days | Operational triage queue for HR intervention. |
| **Platform Telemetry** | `RPT-TEL` | SuperAdmin | Active monthly users, API error rates, S3/R2 storage usage | System health and multi-tenant resource consumption. |

---

## 3. Filtering & Export Specifications

- **Dimensions & Filters:** Filter by Organization Tenant, Date Range (Last 7 Days, 30 Days, 90 Days, Custom), Department, Role, Office Location, Manager.
- **Export Formats:** CSV raw data export, formatted PDF executive summary reports, JSON telemetry payloads for BI tools.
