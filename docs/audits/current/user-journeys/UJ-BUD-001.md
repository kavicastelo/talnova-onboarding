# Journey Audit — Register Buddy Profile & Availability

## Journey ID
UJ-BUD-001

## Date
September 2026

## Primary Role
Onboarding Buddy / Employee (`buddy`, `employee`, `manager`)

## Intended Behavior
Verify that an employee or manager can register as a peer buddy, submit their bio, languages, and technical skills, and set their maximum mentee capacity. The workflow includes:
1. Navigate to `/buddy`.
2. Click "Join as Buddy".
3. Fill Bio, Skills (`TypeScript`, `MongoDB`), and Languages (`English`, `Spanish`).
4. Set Max Mentees: `2`.
5. Click "Save Profile".
6. Monitor network: `POST /api/v1/buddy/profiles` returns `200 OK` or `201 Created`.
7. Assert response contains `{ profile: { userId, maxMentees: 2, isActive: true } }`.
8. UI displays "Buddy Profile Active" card.
9. Alternative Paths: Buddy toggles availability switch to `false` when on vacation.
10. Negative Tests: Submit max mentees = 0 or negative: Form validation flags invalid range.
11. Authorization Tests: User can only modify their own buddy profile (`403 Forbidden` if attempting to modify another user's profile).
12. Data Integrity Checks: MongoDB `BuddyProfile.userId` matches authenticated user.
13. Integration Checks: Profile is returned in `GET /api/v1/buddy/available`.

---

## Actual Behavior
1. **Navigation & Initial State**:
   - User navigates to `/buddy`.
   - The Buddy & Peer Onboarding Support dashboard renders with tabs for "My Buddy", "My Mentees", "Active Pairings", and "Available Buddies Directory".
   - If not yet registered as a buddy, header displays `"Join as Buddy"` button (`[data-testid="join-as-buddy-btn"]`).

2. **Negative Validation Test (Max Mentees = 0 or Negative)**:
   - Clicked "Join as Buddy" (`[data-testid="join-as-buddy-btn"]`).
   - Modal opened titled `"Join as an Onboarding Buddy"`.
   - Inputted Max Mentees: `0` into `[data-testid="buddy-max-mentees-input"]`.
   - Clicked "Save Profile" (`[data-testid="save-profile-btn"]`).
   - Client validation immediately triggered:
     - Error banner rendered: `"Max mentees must be between 1 and 10"` (`[data-testid="buddy-profile-error"]`).
     - Toast notification alerted: `"Max mentees must be between 1 and 10"`.
     - Form submission aborted, preventing invalid payload transmission.
   - Backend validation in Fastify Zod compiler (`registerBuddySchema`) also enforces `.min(1)` and `.max(10)`, returning `HTTP 400 / 422 Bad Request` if invalid numbers are submitted directly to the API.

3. **Happy Path Profile Registration**:
   - Entered Bio: `"Senior backend engineer enthusiastic about Node.js and distributed systems."` (`[data-testid="buddy-bio-input"]`).
   - Entered Technical Skills: `"TypeScript, MongoDB"` (`[data-testid="buddy-skills-input"]`).
   - Entered Languages: `"English, Spanish"` (`[data-testid="buddy-languages-input"]`).
   - Entered Max Mentees: `2` (`[data-testid="buddy-max-mentees-input"]`).
   - Checked Availability toggle (`[data-testid="buddy-availability-toggle"]`).
   - Clicked "Save Profile" (`[data-testid="save-profile-btn"]`).
   - Network call `POST /api/v1/buddy/profiles` succeeded with `HTTP 200 OK`:
     ```json
     {
       "success": true,
       "message": "Buddy profile updated successfully",
       "data": { ... },
       "profile": {
         "userId": "6aa3276858d889c8a9d0c6e4",
         "maxMentees": 2,
         "isActive": true,
         "skills": ["TypeScript", "MongoDB"],
         "languages": ["English", "Spanish"],
         "bio": "Senior backend engineer enthusiastic about Node.js and distributed systems."
       }
     }
     ```
   - Modal closed, toast notification `"Buddy profile saved successfully!"` appeared, and queries refetched.

4. **Active Buddy Profile Card in UI**:
   - UI instantly rendered the active profile card (`[data-testid="buddy-profile-active-card"]`) at the top of the dashboard.
   - Status badge rendered `"Buddy Profile Active"` with emerald highlight (`[data-testid="buddy-status-badge"]`).
   - Displayed bio: `"Senior backend engineer enthusiastic about Node.js and distributed systems."`.
   - Capacity metrics displayed: `Max Mentees: 2 | Current Load: 0 mentees`.
   - Skills rendered: `TypeScript, MongoDB`.
   - Languages rendered: `English, Spanish`.
   - Quick action buttons rendered: `"Set to Away / Vacation"` and `"Edit Profile"`.

5. **Alternative Path (Vacation Toggle)**:
   - Clicked `"Set to Away / Vacation"` (`[data-testid="availability-toggle"]`).
   - Dispatched `POST /api/v1/buddy/profiles` with `{ isAvailable: false }`.
   - Status badge dynamically updated to `"On Vacation / Inactive"` with amber highlight.
   - Available directory count decremented from `2` to `1` as profile was excluded from discovery.
   - Clicked `"Set to Active"`, immediately restoring `"Buddy Profile Active"` status and returning available count back to `2`.

6. **Authorization Enforcement**:
   - A non-admin user attempting to submit `userId` targeting a different employee received `HTTP 403 Forbidden` (`FORBIDDEN`, `"User can only modify their own buddy profile"`).

7. **Data Integrity & Integration Checks**:
   - MongoDB `BuddyProfile` document confirmed:
     - `userId` matches authenticated user.
     - `organizationId` matches tenant.
     - `maxMentees` is `2`.
     - `isAvailable` is `true`.
     - `skills` contains `["TypeScript", "MongoDB"]`.
     - `languages` contains `["English", "Spanish"]`.
   - `GET /api/v1/buddy/available` returns the registered buddy profile with populated user profile and employment details.

---

## Implementation Status
`FULLY_IMPLEMENTED`

## Final Verdict
`PASS`

---

## What Is Implemented
- **Buddy Program Page (`src/pages/BuddyProgram.tsx`, `src/services/buddy.service.ts`, `src/hooks/useBuddy.ts`)**:
  - Direct buddy profile registration modal with Bio, Technical Skills, Languages, Max Mentees (1-10), and Availability toggle.
  - Client-side & server-side range validation (`1-10`) with explicit error alert banner `[data-testid="buddy-profile-error"]`.
  - Prominent "Buddy Profile Active" card (`[data-testid="buddy-profile-active-card"]`) displaying live status badge, bio, skills, languages, and capacity utilization.
  - One-click vacation availability toggle (`[data-testid="availability-toggle"]`) allowing buddies to transition between active mentoring and vacation/away states.
  - Query caching and invalidation across available buddy directories and personal profiles.

- **Backend Buddy Profile API (`server/src/modules/buddy/`)**:
  - `POST /api/v1/buddy/profiles`: Registers or updates buddy profile, validates mentee capacity, supports languages and skills arrays, and returns `{ profile: { userId, maxMentees, isActive } }`.
  - `GET /api/v1/buddy/my-profile`: Returns the authenticated user's buddy profile.
  - `GET /api/v1/buddy/available`: Queries mentors filtering by `isAvailable: true` and `currentMenteeCount < maxMentees`.
  - Multi-tenant data integrity enforcement and RBAC preventing users from modifying other employees' buddy profiles (`403 Forbidden`).

---

## Test Execution Summary

### 1. Automated Vitest Suite (`server/src/tests/uj-bud-001.test.ts`)
Run command: `npx vitest run src/tests/uj-bud-001.test.ts`
All 7 tests passed (100% success rate):
- `✓ Step 1-7: Employee registers buddy profile (POST /api/v1/buddy/profiles returns 200 OK with expected profile)` (419ms)
- `✓ Step 8: UI and query support (GET /api/v1/buddy/my-profile returns active buddy profile)` (18ms)
- `✓ Integration Check: Profile is discoverable in available buddies pool (GET /api/v1/buddy/available)` (22ms)
- `✓ Alternative Path: Buddy toggles availability to false when on vacation (profile excluded from available pool)` (978ms)
- `✓ Negative Test: Submit max mentees = 0 or negative flags invalid range` (14ms)
- `✓ Authorization Test: User cannot modify another user's buddy profile (HTTP 403)` (85ms)
- `✓ Data Integrity Checks: MongoDB BuddyProfile matches authenticated user` (1387ms)

### 2. Live Browser Verification
- Subagent: `uj_bud_001_register` / `buddy_active_card_capture`
- Verified:
  1. Opened `http://localhost:5173/buddy`.
  2. Executed Negative Test: Set Max Mentees to 0, clicked Save Profile -> Verified error banner `"Max mentees must be between 1 and 10"`.
  3. Executed Happy Path Registration: Bio, Skills (`TypeScript, MongoDB`), Languages (`English, Spanish`), Max Mentees (`2`), and Availability (`true`).
  4. Verified "Buddy Profile Active" card rendered with live capacity (`2`), skills, languages, and emerald status badge.
  5. Executed Vacation Toggle: Clicked `"Set to Away / Vacation"` -> Status badge changed to `"On Vacation / Inactive"` and directory count updated.
  6. Clicked `"Set to Active"` -> Status restored to `"Buddy Profile Active"`.

---

## Evidence Artifacts

### 1. Negative Validation Alert (Max Mentees = 0)
![Buddy Profile Negative Validation](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/buddy_profile_negative_validation_1789133682036.png)

### 2. Active Buddy Profile Card
![Buddy Profile Active Card](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/buddy_profile_active_card_1789137023820.png)

### 3. Vacation State Toggled (On Vacation / Inactive)
![Buddy Profile Vacation Toggled](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/buddy_profile_vacation_toggled_1789137046927.png)

### 4. Interactive Browser Session Recordings
- Full Registration & Negative Test Session: [uj_bud_001_register.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/uj_bud_001_register_1789129564758.webp)
- Active Card & Vacation Toggle Session: [buddy_active_card_capture.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/buddy_active_card_capture_1789136992774.webp)

---

## Conclusion
The Peer Buddy Registration and Availability management journey functions properly across backend APIs, MongoDB schemas, and the frontend web application. All requirements for bio, technical skills, languages, mentee capacity constraints, vacation toggling, and authorization boundary enforcement have been verified with 100% test pass rates.
