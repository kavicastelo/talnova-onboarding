# Deployment & Environment Variable Specification

**Document ID:** `TALNOVA-DEMO-DEPLOY-SPEC`  
**Phase:** Three (Target Architecture)  
**Status:** Complete  
**Date:** 2026-10-17  
**Author:** Deployment & Infrastructure Engineering Lead  

---

## 1. Environment Variable Architecture

The demo frontend is built as a static Single Page Application (SPA). Any environment variable prefixed with `VITE_` is baked into the compiled JavaScript bundle at build time and is publicly inspectable in browser devtools.

> [!WARNING]  
> **Zero Secrets in Frontend:** Never place backend database credentials, private JWT keys, or administrative tokens in client `.env` files.

### 1.1 Demo Frontend Environment Template (`.env.demo`)

```ini
# Base URL for the backend API.
# In local development: http://localhost:8080/api/v1
# In production/staging: https://api.talnova.com/api/v1
VITE_API_BASE_URL=http://localhost:8080/api/v1

# Demo Application Mode Flag
VITE_APP_MODE=demo

# Telemetry and Watermarking Enforcement
VITE_DEMO_WATERMARK_ENABLED=true
VITE_DEMO_DEFAULT_TENANT=acme-corp
```

### 1.2 Shared Backend Environment Additions (`server/.env`)

```ini
# Demo Master Switch
APP_ENV=development # or 'production' / 'demo'

# Physical Database Isolation (Must be distinct from MONGODB_URI)
DEMO_DATABASE_URL=mongodb+srv://app_user:secret@cluster0.mongodb.net/Talnova-Demo?retryWrites=true&w=majority

# Cryptographic Token Separation (Minimum 32 random characters)
DEMO_JWT_SECRET=demo_super_secret_jwt_key_at_least_32_chars_long!
DEMO_JWT_REFRESH_SECRET=demo_super_secret_refresh_key_at_least_32_chars!
DEMO_SESSION_SECRET=demo_session_secret_encryption_key_32_chars!

# Demo Lifecycle & Security Guardrails
DEMO_SESSION_DURATION_MINUTES=60
DEMO_INACTIVITY_TIMEOUT_MINUTES=15
DEMO_MAX_CONCURRENT_SESSIONS=1
DEMO_WATERMARK_ENABLED=true
DEMO_STORAGE_BUCKET=talnova-demo-assets
DEMO_RESET_CONFIRMATION_KEY=RESET DEMO

# CORS Origin Whitelist (Must explicitly include demo frontend origin)
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:5174,https://app.talnova.com,https://demo.talnova.com
```

---

## 2. Independent Build & Deployment Configuration

### 2.1 Build Command & Target Output

```bash
# Clean previous build artifacts
rm -rf dist-demo

# Build independent demo application bundle
npm run build:demo
```
- **Configuration File:** `vite.demo.config.ts`
- **Entrypoint:** `demo/index.html`
- **Output Directory:** `dist-demo/`

### 2.2 SPA Fallback / Rewrite Rules

Single Page Applications require all non-file route requests to be rewritten to the entry HTML file so client-side routing functions after a direct page load or browser refresh.

#### Netlify (`dist-demo/_redirects`)
```
/*    /index.html   200
```

#### Vercel (`vercel.json`)
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### Nginx / Static Host (`nginx.conf`)
```nginx
location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

---

## 3. Deployment Smoke Test Verification Checklist

Before releasing any demo frontend deployment, the following 8 smoke tests must be executed:

1. [ ] **Direct Route Load:** Directly navigate to `https://demo.talnova.com/journeys` on a cold browser. Verify it prompts for demo login or loads journeys without 404.
2. [ ] **Unknown Route 404:** Navigate to `https://demo.talnova.com/random-path`. Verify demo-branded 404 displays with "Return to Demo Dashboard" button.
3. [ ] **401 Token Invalidation:** Invalidate token via devtools; click any action; verify graceful redirect to `https://demo.talnova.com/login?reason=session_expired`.
4. [ ] **Persona Switcher:** Switch between Sarah Connor (Admin) and Bob Vance (Employee); verify active navigation items and role change in < 300ms.
5. [ ] **Save & Back Action:** Open a journey in JourneyBuilder; click "Save" or "Back"; verify it returns to `/demo/journeys` and does not jump to production `/login`.
6. [ ] **Email Sink Inspection:** Perform an action that triggers a welcome email; navigate to `/demo/inbox`; verify the synthetic email appears in the sandbox inbox.
7. [ ] **Watermark Rendering:** Inspect the screen; verify semi-transparent canvas watermark displays active persona email, session ID, and timestamp.
8. [ ] **Production Protection:** Verify that `https://app.talnova.com` remains completely unaffected and zero demo records pollute production tables.
