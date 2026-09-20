# Role-Based Feature Governance Model

> **Document Status:** Authoritative RBAC & Feature Governance Standard  
> **System:** Talnova Onboarding Enterprise Platform  
> **Target:** Two-Tier Authorization Architecture (RBAC + Feature Flags)  
> **Date:** September 2026  

---

## 1. The Two-Tier Authorization Standard

In enterprise multi-tenant systems, **Permissions (RBAC)** and **Capabilities (Feature Flags)** solve two different business problems:

```
┌─────────────────────────────────────────────────────────────┐
│                       THE USER ACTION                       │
│           (e.g., "Create AI Course Draft")                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 TIER 1: FEATURE GOVERNANCE                  │
│       Is this feature enabled for this organization?        │
│       - FeatureFlagService.isEnabled('ai_course_builder')   │
│       - Gated by: Commercial plan, beta rollout, super-admin│
└──────────────────────────────┬──────────────────────────────┘
                               │ [PASS: Feature is active]
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 TIER 2: ROLE-BASED SECURITY                 │
│      Does this user's role have permission to use it?       │
│      - hasCapability(user.role, 'ai_course_builder')        │
│      - Gated by: 'owner', 'admin', 'hr_admin'               │
└──────────────────────────────┬──────────────────────────────┘
                               │ [PASS: User is authorized]
                               ▼
                         ACTION EXECUTES
```

### Authorization Rule
$$\text{Access Granted} \iff \text{FeatureIsEnabled(flag, orgId, role)} \land \text{UserHasRole(user, requiredRoles)}$$

If the feature is disabled for the organization, **even the Organization Owner cannot access it**.  
If the feature is enabled for the organization, **only authorized roles within the organization can access it**.

---

## 2. Role Applicability & Persona Scoping

Not every feature requires granular per-role targeting. Feature capabilities are categorized into 3 applicability scopes:

1. **Organization-Level Features:**
   * Enabled or disabled at the organization boundary.
   * When enabled, accessible to all standard authorized roles.
   * *Examples:* `sso_enforcement`, `advanced_hris_sync`, `office_map`, `branding`.
2. **Role-Targeted Features:**
   * Selectively exposed only to specific roles within the tenant.
   * *Examples:* `onboarding_copilot` (enabled only for `employee`), `ai_course_builder` (enabled only for `admin` and `hr_admin`).
3. **Global Infrastructure Features:**
   * Foundational platform mechanics.
   * Cannot be toggled off per role.
   * *Examples:* `auth_token_refresh`, `rbac_route_protection`.

---

## 3. Super Admin Override Matrix

| Scenario | Organization Flag State | User Role | Backend Result | Frontend UX |
| :--- | :--- | :--- | :---: | :--- |
| **Normal Access** | Enabled (`true`) | Authorized (`admin`) | `200 OK` | Nav visible, route accessible, actions work |
| **Role Restriction** | Enabled (`true`) | Unauthorized (`employee`) | `403 FORBIDDEN` | Nav hidden, route shows "Access Restricted" |
| **Feature Disabled** | Disabled (`false`) | Authorized (`admin`) | `403 FORBIDDEN` | Nav hidden, route shows "Feature Temporarily Unavailable" |
| **Super Admin Root** | Disabled (`false`) | Root (`super_admin`) | `200 OK` | Full control plane access for diagnostics |
