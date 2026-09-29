# Enterprise Kiosk System

## Global Enterprise-Ready Target Feature Specification

### 1. Product Definition

The Kiosk subsystem should support four distinct concepts:

1. **Kiosk Journey** — the training/instructional experience created by administrators.
2. **Kiosk Device** — the physical computer/tablet/terminal running the kiosk player.
3. **Kiosk Session** — one employee's execution of one journey.
4. **Employee Identity** — the person completing the journey.

These must be independent entities.

A device must not equal a journey, and a kiosk session must not equal the device's authentication session.

The architecture should support:

* Public/anonymous kiosks
* Employee-identified kiosks
* Assigned-device kiosks
* Multi-journey kiosks
* Supervisor-witnessed kiosks
* Offline-capable kiosks
* Safety/emergency kiosks
* Shared enterprise devices
* Remote device management
* Enterprise directory integration
* Multi-language deployments
* Accessibility-first deployments

---

# 2. Kiosk Operating Modes

The system should provide configurable kiosk modes rather than forcing every organization into one authentication model.

### 2.1 Public / Anonymous Mode

Employees/users do not identify themselves.

Useful for:

* General information
* Safety displays
* Visitor information
* Public instructions
* Emergency information
* Digital signage

Analytics should record device/session information but not associate activity with an employee.

### 2.2 Employee-Identified Mode

Employee must identify themselves before starting a journey.

Supported identity methods should eventually include:

* Employee ID
* Corporate email
* QR code
* Short employee access code
* Badge/token integration
* Enterprise SSO
* Magic-link/mobile confirmation
* WebAuthn/passkey where appropriate
* Optional organization-specific identity provider

Do not force a username/password login on the kiosk.

WCAG 2.2 specifically emphasizes accessible authentication and avoiding unnecessary cognitive authentication requirements.

### 2.3 Assigned Device Mode

The device itself is trusted and paired.

The kiosk should not require an administrator/employee web login every time the device starts.

### 2.4 Supervisor-Witnessed Mode

Certain steps require a supervisor/authorized person to verify or witness completion.

Example:

> Employee completes safety training → supervisor confirms → completion is recorded.

The supervisor identity must be recorded separately from the employee identity.

### 2.5 Mixed Mode

A single device can support:

* Public journeys
* Employee journeys
* Supervisor-required journeys

The journey configuration determines which authentication mode is required.

---

# 3. Kiosk Journey Management

## Journey lifecycle

Support:

* Create
* Draft
* Save
* Preview
* Validate
* Publish
* Unpublish
* Archive
* Duplicate
* Restore
* Version
* Compare versions
* Roll back
* Schedule publication
* Schedule expiration
* Clone to another organization/site where permitted

### Journey metadata

Each journey should support:

* Journey ID
* Internal name
* Display title
* Description
* Thumbnail
* Category
* Tags
* Department
* Location
* Audience
* Owner
* Author
* Reviewer
* Published version
* Status
* Created date
* Updated date
* Published date
* Expiration date
* Supported languages
* Estimated duration
* Required/optional classification
* Compliance classification
* Safety-critical classification

### Journey status

Recommended states:

* Draft
* In Review
* Approved
* Scheduled
* Published
* Suspended
* Expired
* Archived

### Publication controls

Support:

* Immediate publish
* Scheduled publish
* Scheduled unpublish
* Version pinning
* Forced update
* Graceful update
* Device-specific rollout
* Site-specific rollout
* Department rollout

---

# 4. Kiosk Builder

Your existing builder should remain, but become a more formal content-authoring system.

## Step types

Current types:

* Information
* Image
* Video
* Audio
* Warning
* Emergency
* Interactive Hold
* Completion Gate

Additional types worth adding:

* Text/Input
* Confirmation
* Multiple Choice
* Single Choice
* Acknowledgement
* Knowledge Check
* Document Review
* Checklist
* Signature/Acknowledgement
* QR Scan
* Barcode Scan
* Supervisor Verification
* External Link
* Conditional Branch
* End/Completion
* Failure/Retry
* Pause/Resume
* Contact/Help
* Emergency Action

---

# 5. Interaction Mechanisms

Current:

* Static
* Tap anywhere
* Hold to confirm
* Button
* Yes/No branching
* Image hotspot
* Swipe

Add:

* Tap target
* Multiple choice
* Single choice
* Checkbox acknowledgement
* Radio selection
* Drag where genuinely necessary
* Numeric input
* Text input
* QR scanning
* Barcode scanning
* NFC integration abstraction
* Voice input where supported
* Keyboard input
* External-device confirmation
* Supervisor confirmation
* Timed acknowledgement
* Required reading/observation
* Retry
* Skip with authorization
* Conditional navigation

Avoid making dragging/swiping the only way to complete an essential action. WCAG 2.2 explicitly includes requirements around dragging movements and target size.

---

# 6. Content Blocks

Existing:

* Rich text
* Image
* Video
* Safety icon
* Animation

Recommended additional blocks:

### Text

* Heading
* Paragraph
* Bullet list
* Numbered list
* Callout
* Quote
* Definition
* Warning text
* Emergency text

### Media

* Image
* Video
* Audio
* Captioned video
* Audio description
* Animated illustration

### Safety

* Safety sign
* Hazard warning
* PPE requirement
* Emergency instruction
* Evacuation instruction
* Prohibited action
* Mandatory action

For safety-related graphical symbols, provide an enterprise safety-sign library aligned with the relevant ISO 7010/ISO 3864 principles rather than allowing arbitrary decorative icons to masquerade as safety signage. ISO 7010 covers registered safety signs for accident prevention, fire protection, health hazards and emergency evacuation; ISO 3864 establishes safety-sign colour/design principles.

### Interactive

* Button
* Choice
* Checkbox
* Hotspot
* Hold
* Swipe
* Input
* QR scanner
* Confirmation
* Supervisor approval

---

# 7. Journey Settings

Existing settings should expand to:

### General

* Title
* Description
* Thumbnail
* Category
* Tags
* Estimated duration
* Audience

### Localization

* Default language
* Supported languages
* Language fallback
* RTL support
* Translation status
* Translation completeness
* Per-language content
* Per-language media
* Per-language audio
* Language selector position

The system should not assume English/Sinhala forever.

Architecture should support:

* English
* Sinhala
* Tamil
* Arabic
* Hebrew
* German
* French
* Spanish
* Portuguese
* Italian
* Dutch
* Japanese
* Korean
* Chinese

without redesigning the data model.

### Session

* Idle timeout
* Maximum session duration
* Resume policy
* Restart policy
* Abandonment policy
* Completion behavior
* Auto-reset delay

### Security

* Employee identification required
* Supervisor verification required
* Device pairing required
* PIN required
* SSO required
* QR authentication allowed
* Offline execution allowed

### Accessibility

* Text scaling
* High contrast
* Reduced motion
* Audio assistance
* Captions
* Keyboard navigation
* Screen-reader compatibility
* Touch target enforcement
* Timeout extension
* Alternative interaction methods

---

# 8. Device Management

This should become one of the largest parts of the subsystem.

## Device entity

Every kiosk device should have:

* Device ID
* Device name
* Organization
* Site
* Building
* Floor
* Department
* Physical location
* Device type
* Operating system
* Browser/runtime
* App/player version
* Screen resolution
* Orientation
* Device status
* Pairing status
* Last heartbeat
* Last online time
* Last employee activity
* Current journey
* Current session
* Assigned journeys
* Device policy
* Device group
* Device certificate/key identifier
* Created date
* Paired date
* Last security event

---

# 9. Device Types

Support device profiles for:

* Windows PC
* Windows laptop
* Windows kiosk terminal
* macOS
* iPad
* Android tablet
* Android kiosk terminal
* Android phone
* ChromeOS
* Linux
* Smart display where browser support exists

The player should be browser-first where possible, while supporting native/managed kiosk wrappers where deeper OS lockdown is required.

Windows, Android and Apple already expose native kiosk/dedicated-device capabilities, but they work differently. Windows supports single-app and multi-app kiosk experiences, Android supports dedicated devices and lock-task mode, and Apple provides App Lock/Single App Mode mechanisms.

---

# 10. Device Pairing

This needs to be completely redesigned.

## Pairing lifecycle

### Step 1 — Admin creates device

Admin enters:

* Device name
* Site
* Location
* Device group
* Optional description

System generates:

* One-time activation code
* QR activation code
* Short-lived pairing token

### Step 2 — Device opens pairing screen

Device shows:

> Enter activation code or scan QR code.

### Step 3 — Device proves identity

After pairing:

* Server creates device identity
* Device generates cryptographic key material
* Server registers public key/device credential
* Device receives a device credential
* Pairing token becomes invalid

### Step 4 — Device becomes trusted

The device can then:

* Start without employee/admin authentication
* Obtain short-lived access tokens
* Refresh credentials automatically
* Receive configuration
* Receive journey assignments
* Send telemetry
* Receive remote commands

### Important security principle

Do **not** make the MAC address the primary device identity.

Modern operating systems increasingly randomize MAC addresses. Android exposes randomized MAC addresses, and Apple explicitly supports MAC-address randomization/rotation.

Use:

**Primary identity**

`deviceId + device-generated keypair + server-issued credential`

Optional metadata:

* MAC address
* Device serial
* OS device ID
* Hostname
* IP
* Hardware model

MAC can be useful for diagnostics or admin display, but should not be the security trust anchor.

---

# 11. Device Credential Management

Support:

* Credential rotation
* Credential expiration/refresh
* Credential revocation
* Device disable
* Device quarantine
* Device re-pair
* Device transfer
* Device replacement
* Lost-device revocation
* Compromised-device revocation
* Device certificate lifecycle
* Secure storage where native app support exists

A paired device should remain operational for long periods without interactive authentication, but its underlying credentials should still rotate.

That gives you:

> persistent device trust

without:

> permanent bearer-token access.

NIST's current digital identity guidance emphasizes cryptographic authentication, protected channels, resistance to replay and stronger authentication mechanisms; OWASP likewise recommends server-enforced idle and absolute session expiration.

---

# 12. Device Assignment

This should support many-to-many relationships.

### Device → Journeys

A device can have:

* 0 assigned journeys
* 1 assigned journey
* Multiple assigned journeys

### Journey → Devices

A journey can be assigned to:

* One device
* Multiple devices
* Device group
* Site
* Department
* Organization-wide deployment

### Assignment rule

Your proposed rule is good:

**If device has explicit assignments:**

> Show only assigned journeys.

**If device has zero assignments:**

> Show all eligible journeys.

Add additional conditions:

* Journey must be published.
* Journey must be within publication schedule.
* Journey must support the device language.
* Journey must be available to the device's organization/site.
* Journey must not be expired.
* Journey must satisfy employee eligibility.

---

# 13. Device Groups

Add:

* Site groups
* Department groups
* Location groups
* Device-type groups
* Production/test groups
* Safety-critical groups
* Training-room groups

Example:

`Finland > Helsinki > Warehouse > Safety Kiosks`

Assignments can then be made to the group rather than 50 devices individually.

---

# 14. Employee Identification

Employee tracking should be an independent subsystem.

## Employee identity options

Support:

* Employee ID
* Corporate email
* QR employee badge
* Access code
* SSO
* Directory lookup
* Mobile confirmation
* Badge/reader integration
* Optional organization-specific identifier

Avoid requiring employees to create another platform account purely for kiosk completion if your main platform already has employee identities.

---

# 15. Employee Lookup

For 5,000–10,000 employees:

Do not load all employees into the kiosk browser.

Use:

* Server-side search
* Debounced lookup
* Employee ID exact search
* Email exact search
* Prefix search
* Organization filtering
* Department filtering
* Active employee filtering

Example:

`Enter employee ID`

→ `EMP-10293`

→ employee identity confirmation

→ continue.

Do not expose an employee directory unnecessarily.

---

# 16. Privacy-Preserving Employee Selection

Do not display a giant employee list.

Prefer:

1. Employee enters identifier.
2. System finds matching employee.
3. Kiosk shows minimal confirmation.
4. Employee confirms.
5. Session starts.

If privacy requirements demand it, avoid displaying unnecessary:

* Department
* Job title
* Manager
* Email
* Personal information

GDPR's principles include data minimisation and storage limitation, which are particularly relevant when tracking employee kiosk activity.

---

# 17. Employee Session

Each kiosk session should have:

* Session ID
* Device ID
* Employee ID
* Journey ID
* Journey version
* Start time
* End time
* Completion status
* Current step
* Language
* Session duration
* Restart count
* Abandonment status
* Failure status
* Supervisor ID if applicable

---

# 18. Session States

Support:

* Created
* Started
* In progress
* Paused
* Timed out
* Abandoned
* Restarted
* Completed
* Failed
* Supervisor pending
* Supervisor approved
* Supervisor rejected
* Invalidated

---

# 19. Multi-Journey Kiosk Home Screen

This is a major UX requirement.

After:

* device startup
* session completion
* session abandonment
* restart
* timeout

the kiosk returns to a simple journey-selection screen.

Example:

**What would you like to complete?**

Search:

`🔍 Search training`

Filters:

* All
* Safety
* Onboarding
* Compliance
* Department
* Required
* Recently used

Journey cards should show only:

* Title
* Short description
* Estimated time
* Language
* Required badge
* Category

Do not show enterprise administrative complexity.

---

# 20. Kiosk Home Screen UX

The home screen should support:

* Large touch targets
* Minimal navigation
* Clear hierarchy
* Large readable typography
* Search
* Simple categories
* Language selector
* Accessibility controls
* Help
* Emergency access where configured

WCAG 2.2 includes a minimum target-size requirement of 24×24 CSS pixels for applicable targets; for a physical touchscreen kiosk, your internal design system should generally use substantially larger touch targets than that minimum.

---

# 21. Kiosk Reset

After completion:

`Training completed ✓`

Then automatically return to:

`Choose another training`

with configurable delay.

Never leave:

* employee name
* employee ID
* previous answers
* personal information

visible to the next employee.

---

# 22. Automatic Privacy Reset

On session end:

* Clear employee identity from UI
* Clear form data
* Clear temporary files
* Clear session state
* Reset media state
* Reset journey state
* Reset language if configured
* Return to kiosk home

This is essential for shared devices.

---

# 23. Kiosk Screen Lock

Keep your existing optional screen lock, but expand it.

Support:

* Admin lock
* Maintenance lock
* Supervisor lock
* Screen privacy mode
* Idle lock
* Device offline lock
* Emergency lock

Administrative unlock should be separated from employee interaction.

---

# 24. Supervisor Witness PIN

Do not make the current four-digit PIN the only security mechanism.

Instead support:

### Supervisor approval methods

* Supervisor PIN
* Supervisor employee ID + PIN
* Supervisor SSO
* QR approval
* Mobile approval
* WebAuthn/passkey
* Enterprise identity provider

Supervisor approval should record:

* Supervisor identity
* Timestamp
* Device
* Employee
* Journey
* Step
* Approval/rejection
* Reason if rejected

PIN should be treated as one authentication mechanism, not the entire security architecture.

---

# 25. PIN Security

For PIN-based workflows:

* Configurable length
* Rate limiting
* Attempt limit
* Progressive lockout
* Audit failed attempts
* Temporary device lock
* Supervisor lockout
* Secure server-side verification
* Never store plaintext PIN
* Strong salted hashing
* Rotation
* Emergency administrator recovery

---

# 26. Accessibility

Target:

**WCAG 2.2 AA as the baseline.**

For enterprise/international procurement, also map the product against **EN 301 549**, where applicable.

WCAG 2.2 adds requirements particularly relevant to kiosk interfaces, including focus visibility, dragging alternatives, target size, consistent help, redundant entry, and accessible authentication.

### Accessibility features

Support:

* Keyboard navigation
* Touch navigation
* Mouse
* Switch input where supported
* Screen reader compatibility
* Accessible names
* Semantic controls
* Focus visibility
* Focus order
* High contrast
* Text scaling
* Reduced motion
* Captions
* Transcripts
* Audio descriptions
* Colour-independent instructions
* Alternative to swipe
* Alternative to drag
* Large touch targets
* Accessible authentication
* Error recovery
* Timeout extension
* No unnecessary cognitive challenges

---

# 27. Responsive Kiosk Player

The player should be designed around the actual viewport rather than fixed screen assumptions.

Support:

* 320px mobile
* 375px
* 414px
* tablet portrait
* tablet landscape
* 1280×720
* 1366×768
* 1920×1080
* 2560×1440
* 4K
* ultrawide
* portrait kiosks
* landscape kiosks

Also handle:

* browser zoom
* OS display scaling
* browser UI differences
* safe areas
* notches
* virtual keyboards
* orientation changes
* touch-only screens
* mouse-only screens
* keyboard/mouse hybrid

---

# 28. Orientation

Journey/device configuration:

* Landscape
* Portrait
* Auto
* Portrait only
* Landscape only

The player should detect unsupported orientation and provide a clear instruction.

---

# 29. Media Support

### Video

Support:

* MP4/H.264
* modern browser-supported codecs
* subtitles
* captions
* poster image
* autoplay policy handling
* mute policy
* playback resume
* buffering state
* network fallback

### Audio

Complete your unfinished audio implementation with:

* Play
* Pause
* Resume
* Restart
* Volume
* Mute
* Progress
* Captions/transcript
* Autoplay handling
* Accessibility alternative
* Audio completion tracking

---

# 30. Offline Mode

For enterprise kiosks, this is extremely important.

Support:

* Offline journey cache
* Offline media cache
* Offline employee verification where safely possible
* Offline session execution
* Local session queue
* Automatic synchronization
* Conflict resolution
* Failed-sync retry
* Network status
* Offline banner
* Last successful synchronization time

However, sensitive identity operations should not automatically become offline-capable without explicit security design.

---

# 31. Offline Security

Device should have:

* Encrypted local storage
* Short-lived offline authorization
* Maximum offline period
* Offline credential expiration
* Local session encryption
* Automatic purge
* Remote invalidation when reconnecting

Example:

> Device may execute previously downloaded training for 24 hours offline.

After that:

> Device enters restricted/offline-expired mode until it reconnects.

---

# 32. Device Connectivity

Track:

* Online/offline
* Latency
* Last heartbeat
* Last sync
* Upload queue
* Download queue
* Sync failures
* API availability
* DNS failure
* TLS failure
* Authentication failure

---

# 33. Device Health Monitoring

Admin dashboard:

* Online
* Offline
* Warning
* Critical
* Unpaired
* Disabled
* Quarantined
* Outdated
* Low storage
* Media failure
* Player crash
* Sync failure

---

# 34. Remote Device Operations

Future-ready controls:

* Restart player
* Refresh configuration
* Sync now
* Clear cache
* Re-download journey
* Lock device
* Unlock device
* Disable device
* Revoke device
* Re-pair device
* Upgrade player
* Send diagnostic report

Actual OS reboot/shutdown should be supported only where the deployment architecture/MDM permits it.

Windows Assigned Access, Android dedicated-device mode and Apple's managed app-lock capabilities demonstrate why the application layer and operating-system kiosk layer should be treated as separate concerns.

---

# 35. Device Update Management

Track:

* Player version
* Required version
* Minimum supported version
* Update availability
* Update status
* Failed update
* Rollback version

Support:

* Automatic updates
* Maintenance window
* Staged rollout
* Device-group rollout
* Emergency update
* Forced security update

---

# 36. Journey Deployment

Enterprise deployment should support:

* Device assignment
* Device-group assignment
* Site assignment
* Department assignment
* Employee-group assignment
* Schedule
* Version
* Rollout percentage
* Effective date
* Expiration
* Rollback

---

# 37. Version Compatibility

A running session should remain attached to the journey version it started with.

Example:

Employee starts:

`Safety Training v3`

Admin publishes:

`Safety Training v4`

The existing employee should normally finish v3.

The next session receives v4.

This prevents mid-session content mutation.

---

# 38. Content Validation

Before publishing:

Validate:

* Missing translations
* Missing media
* Broken media
* Invalid links
* Empty blocks
* Missing accessibility labels
* Missing captions
* Invalid branches
* Dead-end branches
* Unreachable steps
* Circular branches
* Missing completion gate
* Invalid timeout
* Unsupported media
* Invalid safety configuration

---

# 39. Journey Simulation

Builder should support:

* Desktop preview
* Tablet preview
* Mobile preview
* Portrait
* Landscape
* Touch simulation
* Keyboard simulation
* Accessibility simulation
* Different languages
* Slow network
* Offline mode
* Timeout simulation
* Employee flow
* Supervisor flow

---

# 40. Journey QA

Provide an automated pre-publish checklist:

### Structural

* All branches reachable
* No dead ends
* Completion exists
* Required steps valid
* No missing content

### Accessibility

* Contrast
* Target size
* Labels
* Keyboard operation
* Focus order
* Captions
* Alternative interaction

### Localization

* Translation completeness
* Text overflow
* RTL compatibility
* Missing audio
* Missing media

### Device

* Resolution compatibility
* Orientation compatibility
* Browser compatibility
* Media compatibility

---

# 41. Employee Completion Tracking

For each employee:

* Total assigned kiosk journeys
* Started
* In progress
* Completed
* Failed
* Abandoned
* Expired
* Restarted
* Completion date
* Time spent
* Attempts
* Language used
* Device used
* Site
* Supervisor verification status

---

# 42. Analytics

Current:

* Total launches
* Completions
* Completion rate
* Average session time
* Language usage
* Daily interaction ratio

Expand with:

### Usage

* Unique employees
* Unique devices
* Sessions/day
* Sessions/week
* Sessions/month
* Peak usage
* Average sessions/device
* Journey popularity

### Completion

* Completion rate
* Abandonment rate
* Failure rate
* Restart rate
* Timeout rate
* Average completion time

### Interaction

* Step interaction rate
* Step abandonment
* Most skipped step
* Most failed step
* Average attempts/step
* Branch selection distribution
* Hold completion rate
* Hotspot accuracy
* Swipe success rate

### Device

* Device uptime
* Offline duration
* Sync failures
* Crash count
* Player version distribution
* Device health

---

# 43. Safety/Compliance Analytics

For safety-critical journeys:

* Required employee count
* Completed employee count
* Outstanding employees
* Expired training
* Failed assessments
* Supervisor verification
* Training version
* Completion evidence
* Completion timestamp
* Device/location
* Audit trail

---

# 44. Analytics Privacy Controls

Admins should be able to configure:

* Individual employee reporting
* Aggregated-only reporting
* Retention period
* Anonymized analytics
* Pseudonymized employee identifiers
* Export restrictions

Do not make individual-level tracking mandatory for every kiosk deployment.

GDPR's data-minimisation and storage-limitation principles are particularly relevant here.

---

# 45. Audit Trail

Record every administrative action:

* Kiosk created
* Kiosk modified
* Kiosk deleted
* Device paired
* Device revoked
* Device assigned
* Device unassigned
* Journey created
* Journey edited
* Journey published
* Journey unpublished
* Version created
* Version rolled back
* Assignment changed
* Employee session started
* Employee session completed
* Supervisor approval
* Security failure
* PIN failure
* Device authentication failure

Audit entries should contain:

* Actor
* Actor role
* Timestamp
* IP where appropriate
* Device
* Organization
* Object
* Action
* Before/after values where appropriate
* Correlation/request ID

---

# 46. Enterprise RBAC

Separate permissions:

### Kiosk Administrator

Full kiosk management.

### Kiosk Designer

Can create/edit journeys.

### Kiosk Publisher

Can approve/publish.

### Device Manager

Can pair/manage devices.

### Analytics Viewer

Can view analytics.

### Compliance Manager

Can view compliance records.

### Supervisor

Can witness/approve sessions.

### Organization Administrator

Can manage organization-level configuration.

### Platform Administrator

Global administration.

Do not give every HR admin unrestricted device/security permissions.

---

# 47. Approval Workflow

For large enterprises:

`Draft → Review → Approval → Publish`

Support:

* Single approver
* Multiple approvers
* Required compliance approval
* Safety approval
* Legal approval
* Localization approval

Approval should attach to a specific journey version.

---

# 48. Enterprise SSO

Support integration with:

* Microsoft Entra ID
* Okta
* Google Workspace
* SAML 2.0
* OpenID Connect

SSO should primarily be used for administrators, supervisors and enterprise management—not necessarily as the employee interaction mechanism on every kiosk.

---

# 49. Employee Directory Integration

Future enterprise integrations:

* Microsoft Entra ID
* SCIM
* HRIS
* Workday
* SAP SuccessFactors
* BambooHR
* CSV import
* REST API

Employee synchronization:

* Create
* Update
* Deactivate
* Department changes
* Manager changes
* Employee ID changes

Kiosk should automatically prevent inactive employees from starting new sessions.

---

# 50. Device Directory Integration

Future enterprise MDM integration:

* Microsoft Intune
* Android Enterprise
* Apple MDM
* Other enterprise mobility platforms

This is important because real enterprise kiosk deployments often use the OS/MDM layer to enforce lockdown rather than expecting the web application itself to provide complete device security. Windows, Android and Apple all expose dedicated kiosk/device-management mechanisms.

---

# 51. Device Provisioning at Scale

For 5–50 devices today, manual QR pairing is sufficient.

But design for:

* 1 device
* 10 devices
* 100 devices
* 1,000 devices

Support:

* Individual pairing
* Bulk import
* QR provisioning
* Enrollment codes
* Device groups
* Bulk assignment
* Bulk revoke
* Bulk update

Android Enterprise, for example, explicitly supports QR-based provisioning for dedicated devices.

---

# 52. Device Enrollment Security

Pairing code should be:

* One-time
* Short-lived
* High entropy
* Server validated
* Rate limited
* Invalidated immediately after use
* Bound to organization
* Optionally bound to an intended device record

Do not use a permanent six-digit activation PIN.

---

# 53. Device Theft/Compromise Handling

Admin actions:

* Disable
* Revoke
* Quarantine
* Force reauthentication
* Revoke credentials
* Remove assignments
* Clear local data on reconnect
* Mark as compromised

Device status:

`Trusted → Suspicious → Quarantined → Revoked`

---

# 54. Security Architecture

Use:

* HTTPS/TLS
* Secure cookies where applicable
* Short-lived access tokens
* Refresh-token rotation
* Device credentials
* Server-side authorization
* Rate limiting
* Replay protection
* CSRF protection where applicable
* Content Security Policy
* Secure headers
* Input validation
* Output encoding
* Media URL protection
* Signed/expiring media URLs
* Audit logs

OWASP recommends server-side enforcement of idle and absolute session expiration rather than relying on client-side timers.

---

# 55. Separate Session Types

Do not reuse the main application's normal user session for kiosk sessions.

You should have:

### Admin session

Used by HR/admin.

### Device session

Used by the paired kiosk.

### Employee kiosk session

Used during one employee interaction.

### Supervisor session

Used for approval.

This directly solves your current problem where the kiosk inherits the normal application's one-minute/hour authentication behaviour.

---

# 56. Device Trust vs Employee Authentication

These must be independent.

Example:

`Device authenticated ✓`

does NOT mean:

`Employee authenticated ✓`

The device is trusted to run the kiosk.

The employee is separately identified when required.

This gives you:

> Persistent device trust + short-lived employee sessions.

---

# 57. Kiosk Emergency Mode

For emergency journeys:

* Emergency button
* Immediate emergency journey
* No normal employee authentication
* High-visibility design
* Emergency audio
* Emergency instructions
* Site-specific emergency content
* Emergency contacts
* Evacuation instructions
* Emergency acknowledgment where appropriate

Important:

A kiosk emergency feature should not be treated as a replacement for legally required physical emergency signage, alarms, evacuation systems or site procedures.

---

# 58. Safety Content Governance

Safety blocks should support:

* Standardized safety icons
* Warning severity
* Mandatory acknowledgment
* Required reading
* Safety classification
* Revision tracking
* Approval
* Expiration
* Translation validation

Use standardized safety-sign systems where appropriate. ISO 7010 is specifically designed around safety signs for accident prevention, fire protection, health hazards and emergency evacuation.

---

# 59. Internationalization

Global architecture should support:

* Unicode
* UTF-8
* RTL
* Locale-aware dates
* Locale-aware numbers
* Time zones
* Regional formats
* Translation memory
* Language fallback
* Per-journey language availability
* Per-device default language
* Per-site default language

---

# 60. Time Zone Management

Every event should have:

* UTC timestamp
* Organization timezone
* Device timezone where appropriate

Do not store only local timestamps.

---

# 61. Multi-Site Enterprise Support

Organization hierarchy:

`Organization`

→ `Region`

→ `Country`

→ `Site`

→ `Building`

→ `Department`

→ `Device Group`

→ `Device`

Journeys can be deployed at any applicable level.

---

# 62. Multi-Tenant Isolation

Every kiosk-related object should have strong tenant isolation.

Examples:

* Organization ID
* Site ID
* Device ownership
* Journey ownership
* Employee ownership

Never trust client-provided organization/device IDs.

---

# 63. API

Expose APIs for:

### Devices

* Create
* Pair
* Activate
* Heartbeat
* Status
* Revoke
* Disable
* Assign
* Unassign

### Journeys

* List
* Get
* Publish
* Versions
* Assign

### Employees

* Lookup
* Validate
* Status

### Sessions

* Start
* Progress
* Complete
* Abandon
* Restart

### Analytics

* Device analytics
* Journey analytics
* Employee completion
* Compliance reports

---

# 64. Webhooks

Enterprise integrations should receive events such as:

* kiosk.device.paired
* kiosk.device.revoked
* kiosk.device.offline
* kiosk.device.online
* kiosk.session.started
* kiosk.session.completed
* kiosk.session.failed
* kiosk.session.abandoned
* kiosk.journey.published
* kiosk.journey.updated
* kiosk.journey.assigned
* kiosk.employee.completed

---

# 65. Reliability

The player should be resilient to:

* API timeout
* Internet loss
* server restart
* browser refresh
* device restart
* media failure
* partial synchronization
* expired credentials

Avoid losing an employee's completed session because the network disappeared 2 seconds before completion.

---

# 66. Idempotency

Critical operations should be idempotent:

* Start session
* Complete session
* Supervisor approval
* Device pairing
* Device assignment
* Telemetry submission

This prevents duplicate completions when network retries occur.

---

# 67. Telemetry Architecture

Separate:

### Operational telemetry

Device health and technical events.

### Product analytics

Journey interaction.

### Compliance records

Employee completion evidence.

Do not mix these into one unrestricted analytics dataset.

---

# 68. Performance

Kiosk startup target:

* Very fast first render
* Minimal JavaScript
* Progressive media loading
* Cached shell
* Preload only required journey assets
* Lazy-load later steps
* Optimize video
* Optimize images
* Avoid downloading all 20–50 journeys to every device

For a device with 50 journeys, only metadata should initially be loaded.

Journey content should be loaded on demand or pre-cached according to assignment.

---

# 69. Media Optimization

Support:

* Responsive images
* WebP/AVIF where supported
* Video compression
* Adaptive bitrate where useful
* Poster images
* Lazy loading
* Offline caching
* Cache invalidation by journey version

---

# 70. Kiosk Startup Flow

Recommended flow:

`Device boots`

↓

`Kiosk player starts`

↓

`Device credential verified`

↓

`Configuration synchronized`

↓

`Assigned journeys loaded`

↓

`Kiosk home`

↓

`Employee identification if required`

↓

`Journey selection`

↓

`Journey execution`

↓

`Completion`

↓

`Session securely closed`

↓

`Return to kiosk home`

---

# 71. Employee Journey Flow

Recommended:

`Choose Journey`

↓

`Identify Employee`

↓

`Confirm Identity`

↓

`Start Session`

↓

`Journey`

↓

`Assessment / acknowledgement`

↓

`Supervisor verification if required`

↓

`Completion`

↓

`Completion record synchronized`

↓

`Clear employee state`

↓

`Return to Journey Selection`

---

# 72. Device Assignment Flow

Recommended:

`Admin creates device`

↓

`Generate QR / activation code`

↓

`Device enters pairing mode`

↓

`Scan/enter code`

↓

`Server validates`

↓

`Device creates cryptographic identity`

↓

`Device registered`

↓

`Admin assigns journeys`

↓

`Device synchronizes`

↓

`Device becomes operational`

---

# 73. Device Assignment Semantics

Implement explicit precedence:

1. Device disabled → nothing accessible.
2. Device has explicit journey assignments → only those journeys.
3. Device has zero assignments → all eligible published journeys.
4. Journey unavailable/expired → never display.
5. Employee is not eligible → do not display if employee-level restrictions are enabled.
6. Device offline → display only locally available journeys.

---

# 74. Search and Filtering

Journey selection should support:

* Search
* Category
* Department
* Required
* Recently used
* Language
* Duration
* Employee eligibility

For 20–50 journeys, keep the UI simple.

Do not turn it into an enterprise admin dashboard.

---

# 75. Accessibility-Safe Filtering

Do not rely exclusively on:

* Colour
* Icons
* Animation

Every category must have readable text.

Focus order and keyboard navigation must remain logical.

WCAG 2.2 specifically covers consistent navigation, labels/instructions, error identification, focus behaviour and input assistance.

---

# 76. Timeout Design

Your current:

> 1-minute inactivity + 1-hour session

should not automatically be inherited by kiosk sessions.

Create separate configuration:

### Device idle timeout

Example:

`5 minutes`

### Employee session timeout

Example:

`10 minutes`

### Absolute session maximum

Example:

`2 hours`

### Journey-specific timeout

Optional.

### Emergency journey

Potentially no automatic timeout.

Timeout should:

* warn before expiration
* allow extension where appropriate
* preserve progress where safe
* securely clear employee identity after expiration

WCAG 2.2 includes timing-related accessibility considerations, while OWASP recommends both idle and absolute server-side session limits.

---

# 77. Timeout Warning

Example:

> Your session will reset in 60 seconds.

Buttons:

`Continue`

`Restart`

No confusing authentication redirect.

---

# 78. Kiosk Recovery

If player crashes:

* Automatically restart
* Restore safe state
* Do not expose previous employee information
* Record crash
* Upload diagnostic telemetry
* Resume only if the organization permits it

---

# 79. Browser Recovery

Handle:

* Refresh
* Back
* Forward
* Duplicate tab
* Closed tab
* Browser restart

The kiosk should prevent navigation into the administrative application.

---

# 80. Fullscreen/Kiosk Enforcement

Application-level:

* Fullscreen
* Navigation protection
* Context-menu restrictions where appropriate
* Keyboard escape handling
* External navigation prevention
* New-window prevention
* Download restrictions

OS-level:

* Windows Assigned Access
* Android Lock Task Mode
* Apple App Lock/Single App Mode
* MDM controls

These should be considered separate security layers rather than pretending browser fullscreen alone is a secure kiosk. Microsoft, Android and Apple all provide dedicated device controls for this purpose.

---

# 81. Maintenance Mode

Authorized administrators should have a maintenance workflow.

Example:

`Hold corner for 5 seconds`

↓

`Administrator authentication`

↓

`Maintenance Mode`

Available:

* Device diagnostics
* Connectivity
* Device information
* Sync
* Clear cache
* Pair/re-pair
* Test screen
* Test audio
* Test touch
* Test camera
* Exit kiosk

Never expose maintenance controls to ordinary employees.

---

# 82. Hardware Capability Detection

Detect:

* Touch
* Keyboard
* Mouse
* Camera
* Microphone
* Audio output
* Screen dimensions
* Orientation
* Browser
* OS
* Network
* Storage where accessible

Then the journey can determine whether required functionality exists.

---

# 83. Capability-Based Publishing

Example:

A journey requiring:

`Camera QR scanning`

cannot be assigned to a device that does not have a compatible camera.

A journey requiring:

`Audio`

can warn if audio output is unavailable.

A journey requiring:

`Touch`

can be restricted from a mouse-only deployment.

---

# 84. Device Compatibility Matrix

Maintain:

| Capability  | Windows | Android            | iPadOS | macOS    | Browser               |
| ----------- | ------- | ------------------ | ------ | -------- | --------------------- |
| Touch       | ✓       | ✓                  | ✓      | optional | ✓                     |
| Camera      | ✓       | ✓                  | ✓      | ✓        | permission-dependent  |
| Audio       | ✓       | ✓                  | ✓      | ✓        | ✓                     |
| QR          | ✓       | ✓                  | ✓      | ✓        | camera-dependent      |
| Offline     | ✓       | ✓                  | ✓      | ✓        | application-dependent |
| OS Lockdown | MDM     | Android Enterprise | MDM    | MDM      | limited               |

---

# 85. Accessibility Testing

Automated testing:

* axe
* Lighthouse accessibility
* semantic inspection
* keyboard tests
* contrast
* target-size checks

Manual testing:

* Screen reader
* Keyboard-only
* Touch-only
* Zoom
* High contrast
* Reduced motion
* Captions
* Different languages
* RTL

Target WCAG 2.2 AA rather than simply chasing an automated Lighthouse score. WCAG conformance contains requirements that cannot all be proven by automated tooling.

---

# 86. International Compliance Mapping

Create an internal compliance matrix:

### Accessibility

* WCAG 2.2 AA
* EN 301 549 where applicable

### Interaction/usability

* ISO 9241-110
* ISO 9241-210

ISO 9241-110 focuses on interaction principles including suitability for tasks, self-descriptiveness, conformity with expectations, learnability, controllability, error robustness and engagement.

### Safety symbols

* ISO 7010
* ISO 3864

### Security

* OWASP application-security practices
* NIST digital identity guidance where authentication applies

### Privacy

* GDPR principles where applicable
* Regional privacy requirements according to deployment country

Do not claim "ISO certified" or "WCAG certified" merely because the implementation follows guidance. Compliance/certification requires the appropriate assessment process.

---

# 87. Enterprise Data Retention

Organization-configurable:

* Session retention
* Analytics retention
* Audit retention
* Device telemetry retention
* Employee completion retention

Example:

`Technical telemetry: 90 days`

`Completion records: 7 years`

But the actual default should depend on the organization's legal/compliance requirements.

---

# 88. Data Export

Support:

* CSV
* JSON
* PDF report
* API
* Scheduled export

Reports:

* Employee completion
* Journey completion
* Device activity
* Compliance
* Safety training
* Supervisor verification
* Audit history

---

# 89. Reporting

Enterprise dashboards:

### Organization

* Total devices
* Active devices
* Offline devices
* Total journeys
* Total sessions
* Completion rate

### Site

* Device health
* Usage
* Training completion

### Journey

* Usage
* Completion
* Failure
* Abandonment
* Average duration
* Version comparison

### Employee

* Required journeys
* Completed
* Outstanding
* Expired

---

# 90. Alerts

Notify administrators about:

* Device offline
* Device unpaired
* Device revoked
* Device compromised
* Player outdated
* Sync failure
* Journey expired
* Required training overdue
* High abandonment
* High failure rate
* Media failure
* Repeated PIN failures

Channels:

* In-app
* Email
* Webhook
* Enterprise notification integrations

---

# 91. Auditability of Completion

For compliance-sensitive organizations, completion should be immutable or append-only.

Record:

* Employee
* Journey
* Version
* Device
* Site
* Start
* Completion
* Duration
* Language
* Supervisor
* Result
* Timestamp
* Completion evidence

If a journey changes later, the historical record still points to the exact version completed.

---

# 92. Evidence

Optional evidence:

* Completion certificate
* Supervisor verification
* Acknowledgement
* Assessment score
* Required step completion
* Version hash
* Device identifier

Avoid collecting unnecessary photographs/audio/video of employees merely for evidence.

---

# 93. Configuration Profiles

Create reusable kiosk profiles:

### Public Information Profile

Anonymous, no employee tracking.

### Employee Training Profile

Employee identification + completion tracking.

### Safety Profile

Safety content + mandatory acknowledgement.

### Compliance Profile

Employee identification + audit trail + supervisor approval.

### Training Room Profile

Multiple journeys + employee identification.

### Emergency Profile

Emergency access + prominent emergency journeys.

---

# 94. Device Policy Profiles

Reusable policies:

* Idle timeout
* Session timeout
* Language
* Orientation
* Assigned journeys
* Offline availability
* Authentication mode
* Accessibility defaults
* Screen lock
* Maintenance policy
* Update policy

---

# 95. Device Fleet Dashboard

Admin should see:

`50 Devices`

* 44 Online
* 3 Offline
* 2 Updating
* 1 Needs Attention

Then drill down:

`Site → Device Group → Device`

---

# 96. Device Detail Page

Show:

* Device name
* Status
* Site
* Last seen
* Player version
* OS
* Resolution
* Assigned journeys
* Current session
* Employee
* Health
* Connectivity
* Audit events

---

# 97. Device Lifecycle

Support:

`Created`

→ `Pairing`

→ `Paired`

→ `Active`

→ `Suspended`

→ `Quarantined`

→ `Revoked`

→ `Retired`

---

# 98. Journey Lifecycle

Support:

`Draft`

→ `Review`

→ `Approved`

→ `Published`

→ `Suspended`

→ `Expired`

→ `Archived`

---

# 99. Employee Session Lifecycle

Support:

`Created`

→ `Authenticated`

→ `Started`

→ `In Progress`

→ `Completed`

or:

`Timed Out`

`Abandoned`

`Failed`

`Restarted`

---

# 100. Device-Journey Assignment Lifecycle

Support:

`Assigned`

→ `Downloaded`

→ `Available`

→ `Running`

→ `Outdated`

→ `Unassigned`

---

# 101. Large Enterprise Scalability

Your stated scale:

* 5,000–10,000 employees
* 20–50 journeys
* 5–50 devices

is not particularly large technically.

But the architecture should avoid assumptions that create future limitations.

Design for:

* 100k employees
* 1,000 devices
* 10k devices
* 1,000 journeys
* Multiple countries
* Multiple organizations/sites

The biggest scaling concern is not raw database size. It is **device synchronization, media distribution, analytics volume and enterprise directory integration**.

---

# 102. Caching Strategy

Cache:

* Device configuration
* Journey metadata
* Published journey versions
* Media
* Language resources

Do not cache:

* Sensitive authorization decisions indefinitely
* Revoked device credentials
* Active employee identity indefinitely

---

# 103. CDN

Use CDN/object storage for:

* Images
* Videos
* Audio
* Fonts
* Static journey assets

Do not serve large media through the primary API server.

---

# 104. Security Boundaries

Recommended architecture:

`Admin Application`

↓

`Kiosk Management API`

↓

`Device Identity Service`

↓

`Journey Service`

↓

`Employee Identity Service`

↓

`Session Service`

↓

`Analytics/Event Pipeline`

This does not necessarily mean microservices.

A modular monolith can implement these boundaries internally.

---

# 105. Event Model

Useful event types:

```text
DEVICE_PAIRED
DEVICE_REVOKED
DEVICE_ONLINE
DEVICE_OFFLINE
DEVICE_HEARTBEAT
DEVICE_SYNC_STARTED
DEVICE_SYNC_COMPLETED
JOURNEY_PUBLISHED
JOURNEY_ASSIGNED
JOURNEY_UNASSIGNED
SESSION_STARTED
SESSION_RESUMED
SESSION_RESTARTED
STEP_VIEWED
STEP_COMPLETED
STEP_FAILED
SESSION_COMPLETED
SESSION_ABANDONED
SESSION_TIMEOUT
SUPERVISOR_APPROVED
SUPERVISOR_REJECTED
```

---

# 106. Anti-Tampering

The server must never trust:

* Client-submitted employee ID
* Client-submitted journey completion
* Client-submitted completion time
* Client-submitted score
* Client-submitted device ID
* Client-submitted assignment
* Client-submitted supervisor ID

All critical authorization and completion decisions must be server-authoritative.

---

# 107. Completion Integrity

For each completion:

Server validates:

1. Device is trusted.
2. Device belongs to organization.
3. Journey is published.
4. Journey version is valid.
5. Employee is eligible.
6. Session exists.
7. Session belongs to device.
8. Required steps are satisfied.
9. Supervisor requirement is satisfied.
10. Completion has not already been recorded.

---

# 108. Duplicate Completion Protection

Use unique constraints around:

* Session ID
* Completion event ID
* Employee + journey + attempt where appropriate

Retries must not create duplicate records.

---

# 109. Employee Privacy

Employee tracking should be configurable.

Possible modes:

* Anonymous
* Pseudonymous
* Identified
* Identified + compliance evidence

The organization should explicitly choose what it needs.

---

# 110. Privacy UX

Before identification where appropriate:

> This kiosk records your training completion for your organization.

The exact notice should be configurable according to the organization's privacy/legal requirements.

---

# 111. Accessibility of Audio/Video

Every important audio/video instruction should have an equivalent alternative.

Support:

* Captions
* Transcript
* Text alternative
* Audio description
* Visual alternative

Do not make audio-only instructions mandatory for critical information.

---

# 112. Animation

Support:

* Reduced motion
* Disable animation
* No flashing content
* Animation duration limits
* Static alternative

This is especially important for safety kiosks.

---

# 113. Touch Design System

Establish a dedicated kiosk UI design system:

* Large controls
* High contrast
* Clear spacing
* Simple navigation
* Persistent progress
* Large back/next controls
* Minimal text
* Clear state changes
* Confirmation for destructive actions

---

# 114. Error UX

Never display technical errors like:

`AxiosError 401`

Instead:

> Something went wrong. Please try again.

For administrators:

> Device synchronization failed — authentication credential expired.

---

# 115. Network Error UX

Employee sees:

> Connection temporarily unavailable.

If offline operation is supported:

> You can continue. Your completion will be synchronized automatically.

If not:

> This training is temporarily unavailable. Please try again later.

---

# 116. Language Selection

Language should be available:

* Before employee identification
* On kiosk home
* Within journey where configured

Changing language must not accidentally reset an active session unless explicitly configured.

---

# 117. Translation Governance

For each journey:

`English ✓`

`Sinhala ✓`

`Tamil 80%`

`German ✗`

Publishing should optionally be blocked when required languages are incomplete.

---

# 118. RTL

Do not implement RTL as simply `direction: rtl`.

Test:

* Layout
* Icons
* Navigation
* Progress
* Media controls
* Numbers
* Mixed-language text
* Hotspots
* Animation
* Builder preview

---

# 119. Global Date/Time

Never assume:

`MM/DD/YYYY`

Use locale-aware formatting.

Store backend timestamps in UTC.

---

# 120. Enterprise Search

Admin-side search should support:

* Device ID
* Device name
* Employee ID
* Email
* Journey
* Site
* Department
* Session
* Date range

---

# 121. Bulk Operations

Admins should be able to:

* Assign journeys to multiple devices
* Remove journeys
* Disable devices
* Revoke devices
* Change device groups
* Export devices
* Export completion records
* Publish multiple journeys
* Archive journeys

---

# 122. Import/Export

Support:

* Employee CSV
* Device CSV
* Journey metadata
* Device assignment CSV
* Completion reports

---

# 123. Enterprise API Rate Limits

Separate limits for:

* Device heartbeat
* Session events
* Employee lookup
* Admin APIs
* Bulk APIs
* Analytics APIs

Do not allow 50 devices to accidentally generate excessive heartbeat traffic.

---

# 124. Heartbeat

Recommended conceptual heartbeat:

`device → server`

with:

* Device ID
* Player version
* Current journey
* Current session
* Connectivity
* Health status
* Timestamp

Server responds with:

* Configuration version
* Credential refresh
* Assignment update
* Commands

---

# 125. Remote Configuration

Device should periodically synchronize:

* Journey assignments
* Device policy
* Language
* Timeout
* Player version
* Feature flags

No administrator should need to manually change the kiosk URL.

---

# 126. Eliminate the Current URL Problem

Your new architecture should completely eliminate:

> "Admin must change the kiosk URL when changing journeys."

Instead:

**One permanent device URL**

Example:

`/kiosk/device/{devicePublicId}`

The device loads its configuration from the server.

The journey list is dynamic.

Assignments determine visibility.

---

# 127. Permanent Device URL

The URL identifies the kiosk application instance, not the journey.

The URL should not contain:

* Employee identity
* Authentication tokens
* Permanent secrets
* Journey-specific credentials

---

# 128. Pairing vs URL

A device URL alone should never authenticate a device.

Correct model:

`Device URL`

*

`Device credential`

=

`Trusted device session`

---

# 129. QR Code

Support two separate QR concepts:

### Pairing QR

Used once to enroll device.

### Employee QR

Used repeatedly to identify an employee.

Do not confuse these.

---

# 130. Future Identity Extensions

Design an abstraction:

`EmployeeIdentityProvider`

Implementations:

* Employee ID
* Email
* QR
* SSO
* Badge
* Mobile approval
* WebAuthn

This lets enterprises choose their identity method without changing the journey engine.

---

# 131. Future Device Extensions

Create:

`DeviceIdentityProvider`

Implementations:

* Browser-managed credential
* Native device key
* Certificate
* MDM identity
* Hardware-backed key

This is much more future-proof than hardcoding MAC address logic.

---

# 132. Future Journey Assignment Rules

Eventually support:

* Employee group
* Department
* Job title
* Location
* Country
* Site
* Device
* Device group
* Date
* Shift
* Compliance status

Example:

> Employees in `Production` at `Helsinki Factory` must complete `Fire Safety v4`.

---

# 133. Scheduling

Support:

* Available from
* Available until
* Required by
* Recurring training
* Annual renewal
* Expiration
* Grace period

---

# 134. Recertification

For safety/compliance journeys:

`Completed`

→ valid until:

`2027-09-30`

Then:

`Renewal Required`

---

# 135. Employee Dashboard Integration

The kiosk completion should also update the main employee onboarding platform:

`Kiosk Completion`

→

`Employee Training Record`

→

`Compliance Status`

---

# 136. Notifications

After completion optionally:

* Update employee dashboard
* Send confirmation
* Notify supervisor
* Update HR system
* Generate certificate

---

# 137. Supervisor Dashboard

Supervisor can see:

* Employees awaiting approval
* Completed sessions
* Failed sessions
* Outstanding training
* Expired training

---

# 138. Compliance Dashboard

Compliance manager can filter:

* Site
* Department
* Journey
* Version
* Employee
* Completion status
* Expiration
* Supervisor status

---

# 139. Kiosk Analytics Improvements

Your existing:

* Total launches
* Completions
* Completion rate
* Average session time
* Language usage
* Daily interaction ratio

should become part of a broader telemetry model.

Also include:

* Unique employees
* Unique devices
* Peak hours
* Abandonment
* Timeout
* Failure
* Restart
* Step-level drop-off
* Device uptime
* Offline time
* Sync health
* Version distribution

---

# 140. Feature Flags

Use feature flags for:

* New player
* New authentication
* New pairing
* New analytics
* New interaction types
* New accessibility features

This allows gradual enterprise rollout.

---

# 141. Canary Deployment

Allow:

`Device Group A → new player`

while:

`Device Group B → stable player`

Then compare failures before global rollout.

---

# 142. Test Environment

Provide:

* Development
* Staging
* Production

Never allow a production kiosk to accidentally connect to staging content.

---

# 143. Kiosk Test Mode

A device can optionally enter:

`TEST MODE`

Test sessions should be clearly marked and excluded from compliance analytics.

---

# 144. Synthetic Monitoring

A virtual kiosk should periodically test:

* Device authentication
* Journey loading
* Media loading
* Employee lookup
* Session creation
* Completion
* Analytics submission

---

# 145. Browser Compatibility

Officially test:

* Chrome
* Edge
* Safari
* Firefox where required
* Android Chrome
* iPad Safari

For enterprise Windows deployment, Edge kiosk mode is especially relevant because Windows natively supports Edge as a kiosk application.

---

# 146. Security Testing

Include:

* Authentication testing
* Authorization testing
* Device credential theft simulation
* Replay testing
* Session fixation
* Session hijacking
* PIN brute force
* QR pairing abuse
* Cross-tenant access
* Employee enumeration
* IDOR testing
* Offline credential abuse
* Assignment bypass
* Completion forgery

---

# 147. Privacy Testing

Verify:

* Employee information disappears after session
* No employee data remains in browser storage unnecessarily
* Logs don't contain excessive PII
* Analytics respects retention
* Exports respect permissions
* Revoked employees cannot start new sessions
* Deleted/disabled devices cannot authenticate

---

# 148. Accessibility Acceptance

A journey should not be publishable as "accessible" unless:

* Keyboard works
* Touch works
* Screen reader semantics work where applicable
* Contrast passes
* Target sizes pass
* Captions exist where required
* Alternatives exist for gestures
* Timeouts are accessible
* Authentication is accessible
* Errors are understandable

---

# 149. Enterprise Deployment Documentation

Provide:

* Supported devices
* Supported browsers
* Recommended hardware
* Network requirements
* Firewall requirements
* Domain allowlist
* CDN requirements
* MDM configuration
* Windows kiosk setup
* Android kiosk setup
* iPad kiosk setup
* Troubleshooting
* Security architecture
* Privacy architecture

---

# 150. Recommended Hardware Guidance

Do not hard-code one device.

Define minimum requirements:

* Modern browser
* Stable network
* Touchscreen where required
* 1080p recommended
* Speakers where audio is required
* Camera where QR is required
* Adequate storage for offline media
* Automatic power recovery
* Screen always-on capability

---

# 151. Power Failure Recovery

Device should recover after:

* Power loss
* Restart
* OS update
* Browser crash

Target:

`Power restored → OS starts → kiosk player starts → device authenticates → kiosk home`

with no administrator intervention.

---

# 152. Network Failure Recovery

Target:

`Network lost`

→

`Continue offline if permitted`

→

`Queue events`

→

`Network restored`

→

`Synchronize`

→

`Confirm server receipt`

---

# 153. Security Emergency

Admin should be able to globally:

* Disable all kiosks
* Disable a site
* Disable a device group
* Revoke all device credentials
* Unpublish a journey
* Force a journey update

This is important if a safety instruction is discovered to be incorrect.

---

# 154. Emergency Journey Propagation

For a safety-critical emergency update:

`Admin publishes v5`

↓

`Server marks v4 obsolete`

↓

`Devices synchronize`

↓

`v5 becomes mandatory`

This should be distinct from ordinary gradual rollout.

---

# 155. Content Immutability

Once a compliance session begins:

`Journey Version ID`

must remain immutable for that session.

---

# 156. Completion Certificate

Optional:

* Employee
* Journey
* Version
* Completion date
* Score
* Supervisor
* Organization
* Certificate ID

---

# 157. Certificate Verification

Generate a verification identifier/QR.

Example:

`Certificate ID: KSK-2026-001239`

External verifier can validate without exposing unnecessary employee information.

---

# 158. Enterprise Governance

Support:

* Ownership
* Approvals
* Review dates
* Content expiry
* Compliance classification
* Required reviewer
* Change reason
* Version notes

---

# 159. Change Management

Every published version should contain:

* Change summary
* Author
* Reviewer
* Approver
* Release date
* Previous version
* Reason for change

---

# 160. Final Target Architecture

The kiosk subsystem should ultimately consist of these logical modules:

```text
KIOSK PLATFORM
│
├── Journey Management
│   ├── Builder
│   ├── Versions
│   ├── Publishing
│   ├── Approvals
│   └── Localization
│
├── Journey Runtime
│   ├── Player
│   ├── Sessions
│   ├── Interactions
│   ├── Branching
│   └── Completion
│
├── Employee Identity
│   ├── Employee ID
│   ├── Email
│   ├── QR
│   ├── SSO
│   └── External Identity Providers
│
├── Device Management
│   ├── Enrollment
│   ├── Pairing
│   ├── Device Identity
│   ├── Assignment
│   ├── Groups
│   ├── Health
│   └── Remote Operations
│
├── Supervisor
│   ├── Verification
│   ├── Witness
│   └── Approval
│
├── Analytics
│   ├── Usage
│   ├── Completion
│   ├── Employee
│   ├── Device
│   └── Compliance
│
├── Security
│   ├── Device Trust
│   ├── Session Security
│   ├── RBAC
│   ├── Audit
│   └── Credential Management
│
├── Accessibility
│   ├── WCAG
│   ├── Keyboard
│   ├── Touch
│   ├── Audio
│   ├── Captions
│   └── Reduced Motion
│
├── Localization
│   ├── Languages
│   ├── RTL
│   ├── Translation
│   └── Locale
│
├── Reliability
│   ├── Offline
│   ├── Sync
│   ├── Recovery
│   └── Update Management
│
└── Enterprise Integration
    ├── SSO
    ├── SCIM
    ├── HRIS
    ├── MDM
    ├── API
    └── Webhooks
```

# 161. Most Important Changes From Your Current System

The existing system should evolve from:

```text
Admin
   ↓
Kiosk URL
   ↓
One Journey
   ↓
Public Employee
   ↓
4-digit PIN
```

into:

```text
                    ┌── Journey Management
                    ├── Employee Identity
Admin ──► Platform ─┼── Device Management
                    ├── Assignment Engine
                    ├── Session Engine
                    ├── Compliance
                    └── Analytics

                         ↓

                   Trusted Device
                         ↓
                 Kiosk Home Screen
                         ↓
                 Employee Identity
                         ↓
                 Eligible Journeys
                         ↓
                  Journey Session
                         ↓
              Supervisor / Assessment
                         ↓
                     Completion
                         ↓
                 Secure Reset
                         ↓
                 Kiosk Home Screen
```

# 162. Critical Architectural Decisions

These should be considered non-negotiable for the redesign.

### 1. Device ≠ Journey

One device must support many journeys.

### 2. Device trust ≠ employee authentication

A paired device can remain trusted while each employee gets a separate short-lived session.

### 3. MAC ≠ security identity

Use cryptographic device identity; MAC is optional metadata.

### 4. Kiosk URL ≠ journey URL

The device gets one permanent kiosk endpoint and dynamically receives its available journeys.

### 5. Employee identity ≠ main application login

Kiosk employee identification should have its own lightweight flow.

### 6. Session ≠ authentication session

A kiosk training session should not inherit the normal HR/admin application's one-minute authentication timeout.

### 7. Published journey versions are immutable

Never modify a journey version while employees are completing it.

### 8. Completion is server-authoritative

The browser cannot decide that training was successfully completed.

### 9. Offline support should be architectural

Even if initially disabled, the data model should support queued synchronization.

### 10. Accessibility should be built into the journey engine

Do not bolt accessibility onto the player at the end.

---

# 163. Target Enterprise Capability Set

The finished subsystem should therefore provide:

**Journey authoring**

* Builder
* Blocks
* Interactions
* Branching
* Media
* Safety
* Accessibility
* Localization

**Journey lifecycle**

* Draft
* Review
* Approval
* Publish
* Schedule
* Version
* Rollback
* Archive

**Device**

* Enrollment
* Pairing
* Device identity
* Groups
* Assignment
* Health
* Remote management
* Revocation
* Updates

**Employee**

* Identification
* Directory integration
* Eligibility
* Completion
* Compliance
* Privacy

**Runtime**

* Multi-journey
* Session management
* Timeout
* Reset
* Offline
* Recovery
* Responsive player

**Security**

* Device credentials
* RBAC
* Supervisor verification
* PIN controls
* Audit
* Rate limiting
* Credential rotation
* Revocation

**Accessibility**

* WCAG 2.2 AA target
* Keyboard
* Touch
* Screen reader
* Captions
* Audio alternatives
* Large targets
* Reduced motion
* Gesture alternatives

**International**

* Multiple languages
* RTL
* Unicode
* Time zones
* Locale formats
* Translation governance

**Enterprise**

* SSO
* SCIM
* HRIS
* MDM
* APIs
* Webhooks
* Bulk operations
* Multi-site

**Analytics**

* Device telemetry
* Journey analytics
* Employee completion
* Compliance
* Step analytics
* Operational health

**Reliability**

* Offline
* Sync
* Recovery
* Idempotency
* Caching
* CDN
* Monitoring

---

# 164. Recommended Priority Structure

## P0 — Fix the fundamental kiosk architecture

These should happen first:

* Device pairing
* Cryptographic device identity
* Permanent device URL
* Multi-journey device support
* Journey assignment
* Employee identification
* Separate device/employee/session authentication
* Secure session reset
* Supervisor witness
* Device revocation
* Server-authoritative completion
* Responsive player
* Security hardening

## P1 — Enterprise-grade operational capability

* Device groups
* Bulk assignment
* Device health
* Heartbeat
* Remote configuration
* Offline support
* Synchronization
* Analytics
* Audit trail
* Version rollout
* Employee directory integration
* SSO
* Accessibility WCAG 2.2 AA
* Localization expansion

## P2 — Global enterprise maturity

* MDM integrations
* SCIM
* HRIS integrations
* Advanced compliance
* Recertification
* Certificates
* Advanced reporting
* Webhooks
* API ecosystem
* staged deployments
* canary releases
* remote diagnostics

## P3 — Advanced/future capabilities

* Badge/NFC
* Mobile approval
* WebAuthn
* Hardware-backed device identity
* Advanced offline operation
* Intelligent journey recommendations
* Advanced device orchestration
* enterprise MDM automation
* predictive device-health monitoring

---

# 165. Bottom Line

Your biggest problem is **not that the kiosk is missing a few features**.

The current model is fundamentally:

> **"A kiosk URL that launches one journey."**

The enterprise model should be:

> **"A trusted managed device that provides an adaptive set of authorized journeys to identified or anonymous users, records secure sessions and compliance evidence, and can be remotely governed at enterprise scale."**

That distinction is what will make the feature future-ready.

The strongest external patterns support this direction: Windows treats kiosks as managed dedicated/shared-device experiences, Android provides dedicated-device/lock-task management, Apple provides managed app-lock mechanisms, WCAG 2.2 adds several interaction and authentication requirements directly relevant to kiosks, ISO 9241 provides human-centred interaction principles, and ISO 7010/3864 provide a foundation for safety-sign presentation.

For your stated **5,000–10,000 employees / 20–50 journeys / 5–50 kiosk devices**, this architecture is comfortably achievable without introducing microservices merely for scale. A well-structured modular backend with clear boundaries between **Device Management, Journey Management, Employee Identity, Session Management, Assignment, Analytics and Audit** should be sufficient.
