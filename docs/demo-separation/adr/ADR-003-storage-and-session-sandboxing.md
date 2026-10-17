# ADR-003: Storage & Session Sandboxing

**Status:** Accepted  
**Date:** 2026-10-17  
**Context:**  
`DemoAuthContext.tsx` previously stored the demo persona's role into `localStorage.setItem('user_role', normalizedRole)`. This clashed with the production authentication key `user_role`, causing session state pollution when administrators toggled between production and demo tabs within the same browser.

**Decision:**  
All demo client-side state is strictly namespaced under `talnova_demo_*`:
- `talnova_demo_token`
- `talnova_demo_user`
- `talnova_demo_tenant`
- `talnova_demo_role`
- `talnova_demo_roles`
- `talnova_demo_watermark`
- `talnova_demo_last_activity`

Production keys (`auth_token`, `user_role`, `user_roles`, `user_features`, `talnova_last_activity`) are never read, written, or cleared by demo authentication flows.

**Consequences:**  
- **Positive:** Total session isolation on `localhost` and shared staging domains.
- **Positive:** Switching demo personas in one tab has zero effect on active production administrator sessions in another tab.
- **Negative:** `RoleContext` and permissions checks must dynamically resolve from the active environment namespace.
