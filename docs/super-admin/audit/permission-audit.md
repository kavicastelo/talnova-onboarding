# Super Admin RBAC & Permission Architecture Audit

> **Document Status:** Authoritative Permission Matrix & RBAC Audit  
> **System:** Talnova Onboarding Enterprise Platform  
> **Scope:** Multi-role permission matrix, capability enforcement, route guards, and backend authorization hooks.  

---

## 1. Multi-Role Permission Matrix

The platform supports 6 distinct roles defined in `src/utils/rbac.ts` and `server/src/middleware/auth.middleware.ts`:
1. `super_admin`: Global platform operator (bypasses tenant boundaries).
2. `owner`: Tenant organization founder / primary billing administrator.
3. `admin`: Tenant operational administrator.
4. `hr_admin`: Tenant human resources and onboarding coordinator.
5. `manager`: Team lead / frontline employee supervisor.
6. `employee`: Individual contributor / onboarding learner.
7. `it_admin`: Hardware and workspace IT provisioning specialist.

### Super Admin Capability Matrix

| Operational Capability | Super Admin | Tenant Owner | Tenant Admin | HR Admin | Manager | Employee | IT Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Access Super Admin Control Plane** (`view_super_admin`) | **YES** | NO | NO | NO | NO | NO | NO |
| **Cross-Tenant Telemetry & KPIs** | **YES** | NO | NO | NO | NO | NO | NO |
| **Provision New Tenant Organization** | **YES** | NO | NO | NO | NO | NO | NO |
| **Emergency Tenant Quarantine** | **YES** | NO | NO | NO | NO | NO | NO |
| **Adjust Subscription Plan / User Quota** | **YES** | NO | NO | NO | NO | NO | NO |
| **Cross-Tenant User Roster & 360** | **YES** | NO | NO | NO | NO | NO | NO |
| **Global Force-Logout / Session Revoke** | **YES** | NO | NO | NO | NO | NO | NO |
| **Promote User to Super Admin** | **YES** | NO | NO | NO | NO | NO | NO |
| **Cross-Tenant Onboarding Pipeline** | **YES** | NO | NO | NO | NO | NO | NO |
| **Global IT Hardware Task Queue** | **YES** | NO | NO | NO | NO | NO | NO |
| **Access Observability Suite** | **YES** | NO | NO | NO | NO | NO | NO |
| **Toggle Platform Feature Flags** | **YES** | NO | NO | NO | NO | NO | NO |
| **Record Manual Payments & Expenses** | **YES** | NO | NO | NO | NO | NO | NO |
| **Manage Invoices & Issue Invoices** | **YES** | NO | NO | NO | NO | NO | NO |
| **Export Platform Audit & Reports** | **YES** | NO | NO | NO | NO | NO | NO |
| **Configure Platform Maintenance Mode** | **YES** | NO | NO | NO | NO | NO | NO |

---

## 2. Frontend Authorization Guards

In `src/App.tsx:89-114`, every super-admin route is wrapped with the `ProtectedRoute` component requiring the `view_super_admin` capability:

```typescript
<Route
  path="super-admin/organizations/:id"
  element={
    <ProtectedRoute capability="view_super_admin">
      <SuperAdminOrganization360 />
    </ProtectedRoute>
  }
/>
```

### Verification Verdict:
* In `src/utils/rbac.ts`, only the `super_admin` role possesses the `view_super_admin` capability.
* Attempts by non-super-admins to navigate to `/super-admin/*` immediately redirect to `/` or render an unauthorized access notice.

---

## 3. Backend Authorization Enforcement

In `server/src/modules/super-admin/routes/super-admin.routes.ts:18-19`:
```typescript
app.addHook("onRequest", authenticate);
app.addHook("onRequest", requireRole(["super_admin"]));
```

### Verification Verdict:
* Fastify enforces these pre-handler hooks before entering ANY route handler in the prefix.
* Even if an attacker bypasses client-side React route guards, the backend rejects any request missing a verified JWT containing `role: "super_admin"` with HTTP 403 Forbidden.
* Automated integration test `super-admin-command-center.test.ts:107-116` proves that employee tokens are rejected with HTTP 403.
