# Client Navigation & Shell Forensic Audit

> **Document Status:** Authoritative Navigation Subsystem Audit  
> **Target:** `src/components/AppShell.tsx`, `MobileBottomNav.tsx`, and `CommandPalette.tsx`  
> **Standard:** Dynamic Capability Filtering, Zero Dead Links, and Role Alignment  
> **Date:** September 2026  

---

## 1. Executive Summary

Navigation menus represent the primary affordance for user discovery. When a Super Admin disables a feature, leaving that feature visible in the navigation sidebar creates immediate user confusion, leading directly to 403 errors or dead-end views.

Forensic inspection of `AppShell.tsx` confirms that **navigation sections are completely static arrays**. The navigation subsystem does not evaluate `hasFeature()` or filter items based on resolved tenant feature flags.

---

## 2. Forensic Code Deconstruction (`AppShell.tsx`)

In `src/components/AppShell.tsx:157-300`, navigation arrays are declared statically:

```typescript
const adminNavSections: NavSection[] = [
  {
    label: 'Overview & Operations',
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard },
      { title: 'HR Operations', url: '/hr-ops', icon: ShieldAlert, ... },
      { title: 'Team Operations', url: '/manager', icon: UserCheck },
    ],
  },
  {
    label: 'People & Teams',
    items: [
      { title: 'Employee Directory', url: '/directory', icon: Users },
      { title: 'Buddy Program', url: '/buddy', icon: HeartHandshake },
      { title: '30/60/90 Milestones', url: '/milestones', icon: CalendarCheck },
    ],
  },
  {
    label: 'Learning & Content',
    items: [
      { title: 'Journey Templates', url: '/journeys', icon: GraduationCap },
      { title: 'AI Course Builder', url: '/ai-course-builder', icon: Wand2 },
      { title: 'Knowledge Base', url: '/kb', icon: BookOpen },
    ],
  },
  {
    label: 'Operations & Compliance',
    items: [
      { title: 'Digital Documents', url: '/documents', icon: FileText },
      { title: 'Tasks & Checklists', url: '/tasks', icon: CheckSquare, ... },
      { title: 'Calendar & Meetings', url: '/calendar', icon: Calendar },
      { title: 'Kiosk Terminals', url: '/kiosks', icon: Tv },
    ],
  },
  {
    label: 'System & Insights',
    items: [
      { title: 'Analytics', url: '/analytics', icon: BarChart2 },
      { title: 'Workflows & Rules', url: '/workflows', icon: Workflow },
      { title: 'Office Map', url: '/office-map', icon: MapPin },
      { title: 'AI Assistant', url: '/ai-assistant', icon: Bot },
      { title: 'Leaderboard', url: '/leaderboard', icon: Trophy },
      {
        title: 'Settings',
        url: '/settings',
        icon: Settings,
        subItems: [
          { title: 'SSO & Identity', url: '/settings/sso', icon: KeyRound },
          { title: 'HRIS Integrations', url: '/settings/integrations', icon: Workflow },
        ],
      },
    ],
  },
];
```

### Forensic Deficiencies
1. **No Feature Flag Property:** The `NavItem` and `NavSubItem` interfaces contain:
   ```typescript
   interface NavItem {
     title: string;
     url: string;
     icon: React.ComponentType;
     badge?: string | number | null;
     badgeVariant?: string;
     subItems?: NavSubItem[];
     // MISSING: featureFlag?: string;
     // MISSING: capability?: Capability;
   }
   ```
2. **Unconditional Rendering:** `navSections.map(...)` iterates directly over items without a filter predicate.
3. **Sub-Item Leakage:** Disabling `sso_enforcement` or `advanced_hris_sync` leaves "SSO & Identity" and "HRIS Integrations" visible in the Settings dropdown menu.
4. **Mobile Bottom Navigation:** `src/components/MobileBottomNav.tsx` mirrors the static array defect.
5. **Command Palette Leakage:** `src/components/CommandPalette.tsx` hardcodes searchable routes (including `/super-admin/product/features` and `/ai-course-builder`), allowing users to search and navigate to disabled views.

---

## 3. Dynamic Navigation Architectural Specification

To achieve full Administrative Effectiveness, `AppShell.tsx` must be refactored:

### 1. Updated NavItem Type
```typescript
export interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number | null;
  badgeVariant?: 'default' | 'destructive' | 'secondary' | 'outline';
  featureFlag?: string;
  capability?: Capability;
  subItems?: NavSubItem[];
}
```

### 2. Dynamic Filtering Predicate
```typescript
const filterNavItems = (items: NavItem[]): NavItem[] => {
  return items
    .filter(item => {
      if (item.capability && !can(item.capability)) return false;
      if (item.featureFlag && !hasFeature(item.featureFlag)) return false;
      return true;
    })
    .map(item => ({
      ...item,
      subItems: item.subItems?.filter(sub => {
        if (sub.capability && !can(sub.capability)) return false;
        if (sub.featureFlag && !hasFeature(sub.featureFlag)) return false;
        return true;
      }),
    }));
};
```
