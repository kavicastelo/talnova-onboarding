# Navigation Architecture Technical Specification

> **System:** Talnova Onboarding Enterprise B2B SaaS Platform  
> **Document:** Frontend Navigation Implementation Specification  
> **Status:** Execution Ready  

---

## 1. Technical Scope of Modifications

To execute the information architecture reorganization with **100% preservation of routes, pages, and components**, the implementation targets five core areas:

1. **`src/components/AppShell.tsx`**:
   - Refactor flat navigation arrays into **semantic navigation groups** (`SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuSub`).
   - Add progressive disclosure: nest sub-routes (`/settings/sso`, `/settings/integrations` under `Settings`; `/tasks/it-ops` under `Tasks`; `/hr-ops/exceptions` under `HR Operations`).
   - Add dynamic badges (e.g. pending documents count, exception count).
   - Enhance breadcrumbs hierarchy with complete path mapping across all 44 routes.

2. **`src/components/CommandPalette.tsx`**:
   - Expand the indexed page catalog from 8 items to all **35+ system pages and tools**, properly categorized into sections (`Navigation`, `Operations & Tasks`, `Learning & Content`, `People & Mentorship`, `System & Administration`).
   - Implement role-aware filtering so users only see items they have permission to access.
   - Support rich keywords for search (e.g. searching "SAML", "SSO", "Hardware", "Quarantine", "Quiz", "Certificate").

3. **`src/components/MobileBottomNav.tsx`**:
   - Make bottom tabs role-responsive (e.g. Manager sees `Team`, `Milestones`, `Tasks`, `More`; Employee sees `Roadmap`, `Docs`, `Tasks`, `Learning`, `More`).
   - Integrate a "Menu / More" button that opens the full sidebar on mobile screens.

4. **Contextual Navigation Enhancements**:
   - In `HROperations.tsx`: Add a prominent tab or action banner pointing to `/hr-ops/exceptions` ("Exceptions & Quarantined Cases") so administrators can seamlessly move between normal handovers and exception triage.
   - In `Tasks.tsx`: Add an "IT Hardware Queue" tab link or badge linking directly to `/tasks/it-ops`.
   - In `Settings.tsx`: Add quick navigation cards or links to `/settings/sso` and `/settings/integrations`.

5. **Starting Experiences (Quick Actions & Journey Starters)**:
   - Augment `AdminDashboard.tsx` with a "Quick Journey Actions" panel (e.g. "Invite New Hire", "Build Course", "Verify Handovers", "Exceptions Workbench") without removing any existing charts or stats.
   - Ensure `ManagerDashboard.tsx` provides clear contextual entry points to 30/60/90 milestones, task verification, and buddy pairing.

---

## 2. Navigation Data Structures

```typescript
export interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number | null;
  badgeVariant?: 'default' | 'destructive' | 'secondary' | 'outline';
  subItems?: {
    title: string;
    url: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}
```

---

## 3. Strict Quality & Preservation Checklist

- [x] All 44 routes remain completely reachable.
- [x] No route parameters (`:id`, `me`, query params) are altered.
- [x] No backend API calls are broken.
- [x] RBAC capabilities (`can('...')`) remain authoritative.
- [x] Unsaved changes warning in `JourneyBuilder` is fully preserved.
- [x] Internationalization (`t('nav:...')`) remains intact with seamless fallbacks.
