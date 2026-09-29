# Kiosk Domain Chunk 15: Enterprise Governance & Integrations

## 1. Domain Scope

This domain covers enterprise Role-Based Access Control (RBAC), SCIM 2.0 / HRIS directory synchronization for badge IDs, MDM Managed App Configuration, webhooks, and compliance data export.

---

## 2. Enterprise RBAC Matrix

| Role | Scope & Permissions |
| :--- | :--- |
| **Kiosk Administrator** | Full management of fleet, devices, pairing codes, assignments, and policies. |
| **Kiosk Designer** | Create, edit, and preview draft journeys in `KioskBuilder`. Cannot publish to production. |
| **Kiosk Publisher** | Authorize and publish approved journey versions to fleet devices (Four-Eyes Principle). |
| **Device Manager** | Monitor fleet health, execute remote maintenance commands, view device telemetry. |
| **Compliance Manager** | Inspect completion audit trails, view supervisor sign-offs, export compliance reports. |
| **Shift Supervisor** | Frontline physical attestation via PIN or badge scan on physical terminals. |

---

## 3. SCIM 2.0 & HRIS Directory Synchronization

To ensure frontline terminals recognize worker badges immediately upon onboarding:
- Talnova integrates with enterprise HRIS (Workday, SAP SuccessFactors, BambooHR) and identity providers (Okta, Microsoft Entra ID).
- **SCIM 2.0 Mapping**:
  - `urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:employeeNumber` -> `user.employment.employeeId`
  - `urn:ietf:params:scim:schemas:extension:talnova:2.0:User:badgeId` -> `user.employment.badgeId`
- Real-time webhooks provision newly hired or updated worker badge IDs into the tenant's user database within seconds.

---

## 4. Mobile Device Management (MDM) AppConfig

For managed enterprise hardware (iPads, Android tablets, Windows Kiosk PCs):
- Kiosk runtime supports MDM AppConfig XML payloads to automate initial enrollment without manual typing:
  ```xml
  <dict>
    <key>organizationSlug</key>
    <string>acme-industrial</string>
    <key>enrollmentToken</key>
    <string>tok_enc_8921849182</string>
    <key>kioskMode</key>
    <string>fullscreen_locked</string>
  </dict>
  ```
- Terminals reading this payload execute zero-touch device pairing automatically on first boot.
