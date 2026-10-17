# ADR-002: Routing Isolation, Navigation Adapters, and Demo Error Boundaries

**Status:** Accepted  
**Date:** 2026-10-17  
**Context:**  
Reused production components (such as `JourneyBuilder`, `DocumentSigner`, and `CourseViewer`) contain hardcoded calls to `navigate('/journeys')` or `navigate('/employee')`. When executed in demo mode, these calls route outside `/demo` into the production root router, which redirects unauthenticated visitors to `/login`. Furthermore, unmatched demo routes fall through to production `AppShell`, causing unwanted redirects.

**Decision:**  
1. All demo routes will be encapsulated within a demo router subtree with a mandatory nested catch-all route (`<Route path="*" element={<DemoNotFound />} />`).
2. A context-aware navigation hook (`useSmartNavigate`) or demo router provider will transparently translate root-relative paths (e.g. `/journeys`) to `/demo/journeys` when operating in demo mode.
3. Dedicated demo error boundaries (`DemoErrorBoundary`), access-denied pages (`DemoAccessDenied`), and session-expiration modals (`DemoSessionExpiredModal`) will handle all abnormal conditions locally within the demo environment.

**Consequences:**  
- **Positive:** Zero unintended redirects from demo to production login, registration, or error screens.
- **Positive:** Preserves 100% of production component logic without having to rewrite or fork components.
- **Negative:** Requires ensuring the navigation adapter handles edge cases such as external links or query parameter preservation.
