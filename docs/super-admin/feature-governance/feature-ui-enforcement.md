# Frontend Feature Enforcement Architectural Standard

> **Document Status:** Authoritative Frontend Engineering Standard  
> **System:** Talnova Onboarding React Client  
> **Target:** `AppShell.tsx`, `ProtectedRoute.tsx`, Dashboards, and In-Page Action Gating  
> **Date:** September 2026  

---

## 1. Architectural Philosophy

The frontend is **not a security boundary**, but it is the **authoritative UX boundary**. 

Exposing disabled features to end users results in:
* Dead-end navigation links.
* Broken cards with empty states or NaN counters.
* Confusing 403 error toasts when buttons are clicked.

The Talnova frontend enforces feature governance across 4 cohesive layers:

```
┌─────────────────────────────────────────────────────────────┐
│                 LAYER 1: NAVIGATION FILTER                  │
│       Hides sidebar items and mobile nav if disabled        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 LAYER 2: DASHBOARD WIDGETS                  │
│       Removes summary cards and counters if disabled        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 LAYER 3: CLIENT ROUTE GUARDS                │
│     Intercepts direct URL entries with friendly UX alert    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 LAYER 4: IN-PAGE ACTION BUTTONS             │
│      Disables or hides specific modals, buttons & forms     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Standard Implementation Patterns

### 2.1 Navigation Filtering (`AppShell.tsx`)
Navigation sections must filter items dynamically using `hasFeature()`:

```typescript
const filterNavSection = (section: NavSection): NavSection => ({
  ...section,
  items: section.items
    .filter(item => !item.featureFlag || hasFeature(item.featureFlag))
    .map(item => ({
      ...item,
      subItems: item.subItems?.filter(sub => !sub.featureFlag || hasFeature(sub.featureFlag))
    }))
});
```

### 2.2 Route Protection (`App.tsx`)
All gated product routes must declare `featureFlag`:

```tsx
<Route
  path="documents"
  element={
    <ProtectedRoute featureFlag="digital_signatures">
      <Documents />
    </ProtectedRoute>
  }
/>
```

### 2.3 Dashboard Widget Gating
```tsx
{hasFeature("gamified_milestones") && (
  <LeaderboardWidget rank={userRank} points={pointsTotal} />
)}
```

### 2.4 Action Button Disablement
```tsx
<Button
  disabled={!hasFeature("ai_course_builder")}
  onClick={handleGenerateAICourse}
  title={!hasFeature("ai_course_builder") ? "AI Course Builder is disabled for your organization" : ""}
>
  <Wand2 className="h-4 w-4 mr-2" /> Generate with AI
</Button>
```

---

## 3. Fallback Screen Standard (`ProtectedRoute.tsx`)

When an unauthorized or direct URL access occurs:
1. Do not display technical HTTP 403 errors.
2. Display human-readable feature title looked up from registry.
3. Provide one-click "Return to Dashboard" and "Go Back" recovery buttons.
4. Suppress internal code identifiers (`feat_...`) in production environments.
