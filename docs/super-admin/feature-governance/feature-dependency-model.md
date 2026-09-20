# Feature Dependency & Cascade Invalidation Specification

> **Document Status:** Authoritative Dependency Model Specification  
> **System:** Talnova Onboarding Enterprise Control Plane  
> **Target:** Dependency Resolution, Impact Analysis & Administrative Warning Standard  
> **Date:** September 2026  

---

## 1. Dependency Principles & Semantics

In an enterprise platform, dependencies between features are modeled as a **Directed Acyclic Graph (DAG)**:

$$G = (V, E)$$
Where:
* $V$ represents the set of 105 product capabilities.
* $E$ represents directed edges $(u, v)$ where feature $v$ strictly requires feature $u$ to function.

### Dependency Types
1. **Hard Structural Dependency:** Feature $v$ cannot run without feature $u$. If $u$ is disabled, $v$ must be automatically disabled or blocked.
   * *Example:* `digital_signatures` strictly depends on `doc_templates`.
2. **Soft Enhancement Dependency:** Feature $v$ uses feature $u$ as an accelerator. If $u$ is disabled, $v$ falls back to a manual alternative.
   * *Example:* `journey_builder` uses `ai_course_builder` for automated drafting. Disabling AI falls back to manual step creation.
3. **Infrastructure Dependency:** Foundational platform services required by all features.
   * *Example:* `file_uploads`, `auth_credentials`.

---

## 2. Master Dependency Graph Table

| Feature Key | Name | Dependency Type | Upstream Prerequisites | Cascading Behavior on Prerequisite Disablement |
| :--- | :--- | :--- | :--- | :--- |
| `digital_signatures` | E-Signatures | Hard | `doc_templates`, `file_uploads` | Block signing canvas; alert HR Ops. |
| `ai_course_builder` | AI Builder | Soft | `journey_templates`, `ai_token_tracker` | Hide AI wizard; allow manual authoring. |
| `kiosk_audio_sop` | Kiosk SOP | Hard | `kiosk_mode`, `file_uploads` | Block SOP playback; display warning. |
| `kiosk_safety_check`| Touch PPE | Hard | `kiosk_mode` | Block PPE confirmation step. |
| `buddy_connection` | Buddy Chat | Hard | `buddy_assignment`, `employee_directory` | Skip buddy step on candidate roadmap. |
| `it_ops_queue` | IT Queue | Hard | `checklist_tasks` | Route hardware items to standard checklist. |
| `public_qr_verify` | QR Verify | Hard | `certificates` | Display "Verification temporarily offline". |
| `leaderboard_view` | Leaderboard | Hard | `gamified_milestones` | Hide leaderboard link; freeze streak counts. |
| `workflow_rules` | Automations | Hard | `onboarding_roadmap` | Freeze rule execution; log administrative warning. |

---

## 3. Super Admin Warning & Cascade Standard

When a Super Admin attempts to disable a feature that has downstream dependents:

```typescript
interface IDependencyImpactReport {
  targetFeatureKey: string;
  hardDependents: string[];
  softDependents: string[];
  affectedJourneys: string[];
  activeTenantsImpacted: number;
}
```

### Pre-Mutation Warning Dialog Standard
1. The UI calls `GET /api/v1/super-admin/features/:key/impact`.
2. A confirmation modal displays:
   * "Warning: Disabling **Document Template Designer** will also disable **Digital Compliance Signatures**."
   * "Affected Candidate Journeys: UJ-ONB-002, UJ-ADM-006."
   * "Active Tenants Impacted: 14 organizations."
3. The administrator must explicitly confirm: `"I understand the cascading impacts"`.
