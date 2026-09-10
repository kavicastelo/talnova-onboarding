# Journey Audit — Enterprise SSO Settings Configuration

## Journey ID
UJ-ADM-010

## Date
September 2026

## Primary Role
Organization Owner / HR Administrator (`owner`, `admin`) or SuperAdmin

## Intended Behavior
An organization administrator or owner with the `manage_sso` capability can configure enterprise SAML 2.0 / OIDC single sign-on parameters from `/settings/sso`. The administrator can:
1. Select the identity protocol (e.g. `SAML 2.0`).
2. Specify corporate authorization domains (e.g. `acme.corp`).
3. Set the Identity Provider (IdP) Single Sign-On URL / Entry Point (e.g. `https://okta.acme.corp/app/sso`).
4. Enter the Issuer ID / Entity ID (e.g. `http://www.okta.com/exk123`).
5. Paste an X.509 signing certificate in PEM format.
6. Toggle "Enable Single Sign-On" to activate tenant-level SSO.
7. Toggle "Enforce SSO" to disable standard password authentication for users on that domain.
8. Submit the form via `PUT /api/v1/auth/sso/config`, returning `HTTP 200 OK`.
9. The UI displays an "Active" badge and an active banner (`SSO configuration active for domain acme.corp`).
10. The backend validates URL formats, rejecting malformed entry points with `HTTP 400 Bad Request`.
11. Unauthorized employees attempting to modify SSO settings receive `HTTP 403 Forbidden`.
12. Data integrity is confirmed with both `SSOConfig` collection and `Organization.ssoConfig` in MongoDB having `enabled: true`, `status: "active"`, `entryPoint`, and `domains`.
13. Domain discovery (`POST /api/v1/auth/sso/discover`) reflects the new SSO configuration.

---

## Actual Behavior
1. **Navigation & Access Control**:
   - Organization administrators and owners navigate to `/settings/sso` directly or via the "SSO & Identity" link in the sidebar or via the "Enterprise Single Sign-On" card in the `/settings` Security tab.
   - Protected route verification ensures users lacking `manage_sso` capability are redirected or denied.

2. **Negative Validation (Malformed URL Handling)**:
   - Entering an invalid URL format (e.g. `invalid-sso-url`) into the IdP Single Sign-On URL input triggers real-time visual client validation (`[data-testid="sso-url-error"]`): `"Invalid URL format for IdP Single Sign-On URL (must start with http:// or https://)"` and highlights the input border in red.
   - Submitting the form with an invalid URL is blocked on the client and prevented with an error toast.
   - Backend validation in `SSOService.saveSSOConfig` enforces valid `http:` or `https:` URL parsing; direct API requests with invalid URLs return `HTTP 400 Bad Request` with `"Invalid IdP Single Sign-On URL format. Must be a valid http or https URL."`.

3. **Happy Path Configuration (SAML 2.0 Setup)**:
   - Protocol selector set to `SAML 2.0` (`[data-testid="sso-protocol-select"]`).
   - Domain set to `acme.corp` (`[data-testid="sso-domain-input"]`).
   - IdP Single Sign-On URL entered as `https://okta.acme.corp/app/sso` (`[data-testid="sso-url-input"]`).
   - Issuer ID entered as `http://www.okta.com/exk123` (`[data-testid="sso-issuer-input"]`).
   - Standard X.509 PEM certificate pasted into certificate textarea (`[data-testid="sso-certificate-textarea"]`).
   - "Enable Single Sign-On" toggle checked (`[data-testid="sso-enable-toggle"]`).
   - Administrator clicks "Save Configuration" (`[data-testid="sso-save-btn"]`).
   - Network payload dispatches `PUT /api/v1/auth/sso/config` returning `HTTP 200 OK`.
   - UI displays toast `"SSO configuration saved successfully!"`.
   - Header badge renders "Active" (`[data-testid="sso-status-badge"]`).
   - Active status banner appears: `"SSO configuration active for domain acme.corp"` (`[data-testid="sso-active-banner"]`).

4. **Alternative Path (Enforce Mandatory SSO)**:
   - Administrator toggles "Enforce SSO" checkbox (`[data-testid="sso-enforce-toggle"]`).
   - Clicking "Save Configuration" sends `enforceSSO: true` via `PUT /api/v1/auth/sso/config`.
   - Backend persists `enforceSSO: true` across `SSOConfig` and `Organization.ssoConfig`.
   - UI retains toggled state upon reload.

5. **Authorization Tests**:
   - Requests to `PUT /api/v1/auth/sso/config` made with a regular employee JWT (`role: "employee"`) are intercepted by `requireRole(["owner", "admin"])` and rejected with `HTTP 403 Forbidden` (`code: "FORBIDDEN"`).

6. **Data Integrity Checks**:
   - MongoDB Atlas query verifies:
     - `SSOConfig`: `status: "active"`, `domains: ["acme.corp"]`, `ssoUrl: "https://okta.acme.corp/app/sso"`, `issuerUrl: "http://www.okta.com/exk123"`, `enforceSSO: true`, `certificate: "-----BEGIN CERTIFICATE-----\n..."`.
     - `Organization.ssoConfig`: `enabled: true`, `status: "active"`, `domain: "acme.corp"`, `entryPoint: "https://okta.acme.corp/app/sso"`, `ssoUrl: "https://okta.acme.corp/app/sso"`, `issuerUrl: "http://www.okta.com/exk123"`, `enforceSSO: true`.

7. **Integration Verification (Domain Discovery UJ-AUTH-005)**:
   - Calling `POST /api/v1/auth/sso/discover` with `{ email: "alice@acme.corp" }` returns:
     ```json
     {
       "success": true,
       "data": {
         "ssoEnabled": true,
         "enabled": true,
         "provider": "saml2",
         "entryPoint": "https://okta.acme.corp/app/sso",
         "ssoUrl": "https://okta.acme.corp/app/sso",
         "enforceSSO": true
       }
     }
     ```

---

## Implementation Status
`FULLY_IMPLEMENTED`

## Final Verdict
`PASS` (All happy path steps, alternative enforcement path, negative validation, role-based authorization, data integrity synchronization, and integration checks verified in both live browser interaction and automated test suite).

---

## What Is Implemented
- **Frontend SSO Settings Management**:
  - `src/pages/SSOSettings.tsx`: Complete administration interface supporting protocol selection (`SAML 2.0`, `Custom SAML`, `Okta`, `Azure AD`, `Google Workspace`, `Custom OIDC`), corporate domain discovery configuration, IdP Single Sign-On entry point URL with client validation, Issuer/Entity ID input, X.509 certificate PEM textarea, Enable SSO toggle, Enforce SSO toggle, and status badges/banners.
  - `src/services/sso.service.ts`: API service supporting `getConfig`, `saveConfig`, `discoverDomain`, and `initiateSSO`.
  - `src/pages/Settings.tsx`: Security tab integration with an Enterprise SSO card directing administrators directly to `/settings/sso`.
  - `src/components/AppShell.tsx`: Navigation link to `/settings/sso` for admins.

- **Backend SSO Endpoints & Synchronization**:
  - `server/src/modules/auth/routes/sso.routes.ts`: `PUT /config` and `GET /config` guarded with `authenticate` and `requireRole(["owner", "admin"])`.
  - `server/src/modules/auth/controllers/sso.controller.ts`: Handles requests and responds with standardized JSON schemas.
  - `server/src/modules/auth/services/sso.service.ts`: URL syntax validation, domain normalization, `SSOConfig` persistence, and synchronization to `Organization.ssoConfig` in MongoDB.
  - `server/src/modules/organizations/models/organization.model.ts`: Extended `IOrganization` interface and `OrganizationSchema` with `ssoConfig` schema and indexes.

---

## Test Execution Summary

### 1. Automated Vitest Suite (`server/src/tests/uj-adm-010.test.ts`)
Run command: `npx vitest run src/tests/uj-adm-010.test.ts`
All 6 tests passed (100% success rate):
- `✓ Step 1-9: Organization Owner configures SAML 2.0 parameters and saves SSO settings` (552ms)
- `✓ Data Integrity Check: Verifies SSOConfig and Organization.ssoConfig in MongoDB` (112ms)
- `✓ Integration Check: Domain discovery endpoint reflects newly configured SSO` (100ms)
- `✓ Alternative Path: Toggle Enforce SSO disables standard password login for domain` (409ms)
- `✓ Negative Test: Submit invalid URL format for IdP entry point returns 400 Bad Request` (119ms)
- `✓ Authorization Test: Employees attempting PUT /api/v1/auth/sso/config receive HTTP 403 Forbidden` (99ms)

### 2. Live Browser Verification
- Subagent: `uj_adm_010_sso`
- Verified:
  1. Negative URL validation highlight and error prevention toast.
  2. Protocol selection (`SAML 2.0`), Domain (`acme.corp`), IdP Single Sign-On URL (`https://okta.acme.corp/app/sso`), Issuer ID (`http://www.okta.com/exk123`), and Certificate PEM paste.
  3. "Enable Single Sign-On" toggle activation and "Save Configuration" dispatch.
  4. Response `PUT /api/v1/auth/sso/config` returning `HTTP 200 OK`.
  5. Status badge updated to "Active" and banner displayed: `"SSO configuration active for domain acme.corp"`.
  6. Alternative Path: "Enforce SSO" toggle checked, saved, and persisted.

### 3. Database State Verification (MongoDB Atlas)
Queried document state:
```json
{
  "SSOConfig": {
    "provider": "okta",
    "domains": ["acme.corp"],
    "ssoUrl": "https://okta.acme.corp/app/sso",
    "issuerUrl": "http://www.okta.com/exk123",
    "enforceSSO": true,
    "status": "active",
    "hasCertificate": true
  },
  "Organization.ssoConfig": {
    "enabled": true,
    "provider": "okta",
    "domain": "acme.corp",
    "domains": ["acme.corp"],
    "entryPoint": "https://okta.acme.corp/app/sso",
    "ssoUrl": "https://okta.acme.corp/app/sso",
    "issuerId": "http://www.okta.com/exk123",
    "issuerUrl": "http://www.okta.com/exk123",
    "enforceSSO": true,
    "status": "active"
  }
}
```

---

## Evidence Artifacts

| Type | Path / URI | Description |
|---|---|---|
| **Video Recording** | [uj_adm_010_sso.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/uj_adm_010_sso_1789074866823.webp) | Full browser recording of SSO settings configuration, validation, and enforcement |
| **Negative Validation Screenshot** | [sso_negative_validation.png](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/sso_negative_validation_1789074927891.png) | URL validation error alert and input highlight for invalid URL format |
| **Happy Path Screenshot** | [sso_happy_path_active.png](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/sso_happy_path_active_1789075094048.png) | Saved SAML 2.0 configuration with Active badge and domain banner |
| **Enforced SSO Screenshot** | [sso_enforced_active.png](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/sso_enforced_active_1789075172447.png) | Saved configuration with Enforce SSO toggle enabled |
| **Test Suite** | [uj-adm-010.test.ts](file:///d:/talnova/talnova-onboarding/server/src/tests/uj-adm-010.test.ts) | Automated integration test covering all paths, integrity checks, and authorization |

---

## Failure Classification
`NONE` — All test criteria satisfied. Final Verdict: **PASS**.
