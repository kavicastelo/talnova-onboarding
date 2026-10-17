# ADR-001: Independent Demo Frontend Build Target and Entrypoint

**Status:** Accepted  
**Date:** 2026-10-17  
**Context:**  
The sales and customer onboarding teams require a standalone demo environment that can be deployed independently to a dedicated demo subdomain (e.g. `demo.talnova.com`). The demo currently shares the root application's `App.tsx` and `index.html`. Deploying the entire application exposes production-only super-admin routes, kiosk routes, and billing interfaces within the compiled JavaScript chunks.

**Decision:**  
We will implement an independent build configuration (`vite.demo.config.ts`) and a dedicated HTML entrypoint (`demo/index.html`) linking to `demo/src/main.tsx`. The build will output directly to `dist-demo/`.

**Consequences:**  
- **Positive:** Produces a lean, isolated bundle without production-only administrative code or secrets.
- **Positive:** Enables continuous delivery of demo enhancements without touching production deployments.
- **Negative:** Requires maintaining two Vite configuration files; mitigated by sharing common Tailwind, PostCSS, and TypeScript definitions.
