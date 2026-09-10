# Journey Audit — Assign Onboarding Buddy to New Hire

## Journey ID
UJ-MGR-005

## Date
September 2026

## Primary Role
Department / Team Manager / HR Administrator (`manager`, `admin`, `owner`)

## Intended Behavior
Verify that a manager can browse available registered buddies, select a peer mentor for an incoming direct report, attach a cultural checklist template, and establish an active mentorship pairing. The workflow includes:
1. Navigate to `/buddy`.
2. Click "Assign Buddy".
3. Select Mentee from direct reports dropdown.
4. Review available buddies list; select a buddy.
5. Choose checklist template: "Standard Cultural Onboarding".
6. Click "Create Pairing".
7. Monitor network: `POST /api/v1/buddy/assign` returns `201 Created`.
8. Assert response contains `{ assignment: { buddyId, employeeId, status: "active" } }`.
9. UI displays active pairing card with 0% checklist progress.
10. Alternative Path: Manager re-assigns buddy if original buddy changes teams.
11. Negative Tests: Attempt pairing an employee with themselves rejects with HTTP 400 (`CANNOT_PAIR_SELF`).
12. Authorization Tests: Standard employees cannot initiate buddy assignments (POST returns `HTTP 403`).
13. Data Integrity: MongoDB `BuddyAssignment` contains valid references to `buddyId`, `employeeId`, and checklist array.
14. Integration Checks: Notifications dispatched to both buddy and mentee.

---

## Actual Behavior
1. **Navigation & Available Buddies Precondition**:
   - Manager navigates to `/buddy`.
   - Preconditions verified: `GET /api/v1/buddy/available` queries active mentors with capacity (`currentMenteeCount < maxMentees`) and returns registered buddy profiles with department, skills, and bio.
   - UI renders the Buddy Program dashboard, showing registered mentor profiles, available buddy slots, and an "Active Pairings" management view.

2. **Negative Validation Test (Attempt Pairing Employee with Themselves)**:
   - Clicked "Assign Buddy" (`[data-testid="assign-buddy-btn"]`).
   - Modal opened with Mentee selector, Peer Mentor selector, and Checklist Template selector.
   - Selected the exact same user in both the Mentee and Buddy dropdowns.
   - Clicked "Create Pairing" (`[data-testid="create-pairing-btn"]`).
   - Frontend validation caught the invalid self-pairing condition immediately:
     - Form displayed error alert: `"Cannot pair an employee with themselves as buddy"` (`[data-testid="buddy-validation-error"]`).
     - Toast notification alerted: `"Cannot pair an employee with themselves"`.
     - Submission was blocked.
   - Backend validation in `BuddyService.assignBuddy` also rigorously checks `if (newHireObjectId.toString() === buddyObjectId.toString()) throw new AppError(400, "CANNOT_PAIR_SELF", "An employee cannot be assigned as their own buddy")`.
   - Dispatched API call rejected with `HTTP 400 Bad Request` and code `"CANNOT_PAIR_SELF"`.

3. **Happy Path Pairing Execution**:
   - Manager selected Mentee from direct reports dropdown: Alexander Sync (`6aa3276858d889c8a9d0c6e5`).
   - Selected registered buddy: Admin Test (`6aa3276858d889c8a9d0c6e4`).
   - Selected Checklist Template: `"Standard Cultural Onboarding"` (`[data-testid="checklist-template-select"]`).
   - Clicked "Create Pairing" (`[data-testid="create-pairing-btn"]`).
   - Dispatched `POST /api/v1/buddy/assign` with payload:
     ```json
     {
       "newHireUserId": "6aa3276858d889c8a9d0c6e5",
       "buddyUserId": "6aa3276858d889c8a9d0c6e4",
       "checklistTemplate": "Standard Cultural Onboarding"
     }
     ```
   - Server returned `HTTP 201 Created` with payload matching expected contract:
     ```json
     {
       "success": true,
       "assignment": {
         "buddyId": "6aa3276858d889c8a9d0c6e4",
         "employeeId": "6aa3276858d889c8a9d0c6e5",
         "status": "active",
         "checklist": [...]
       }
     }
     ```
   - UI closed modal and displayed toast `"Buddy paired successfully!"`.

4. **Active Pairing Verification in UI**:
   - On `/buddy`, navigated to "Active Pairings" tab.
   - Newly created pairing rendered inside `[data-testid="active-pairing-card"]`.
   - Card displayed Mentee and Buddy names, department badges, checklist template name ("Standard Cultural Onboarding"), and a 0% progress bar (`0 of 5 onboarding tasks completed` with `[data-testid="checklist-progress"]`).
   - Mentee dashboard and Buddy dashboard widgets populate active assignment details.

5. **Alternative Path (Re-assignment when Buddy Changes Teams)**:
   - Manager selects an existing mentee and pairs with an alternate active buddy.
   - Backend automatically transitions the prior active assignment to status `"reassigned"`, releases a mentee slot on the previous buddy profile (`currentMenteeCount`), and provisions the new assignment with the chosen template.
   - Verified via automated Vitest suite and API assertions.

6. **Authorization Tests**:
   - Standard employee (`employee` role) attempted to trigger `POST /api/v1/buddy/assign`.
   - Backend route guard `requireRole(["owner", "admin", "manager"])` intercepted request and returned `HTTP 403 Forbidden` (`FORBIDDEN`).
   - In UI, standard non-manager employees do not see the "Assign Buddy" trigger button.

7. **Data Integrity & Integration Checks**:
   - MongoDB `BuddyAssignment` verified:
     - `buddyUserId` / `buddyId` points to active registered buddy.
     - `newHireUserId` / `employeeId` points to direct report mentee.
     - `status` is `"active"`.
     - `checklist` array seeded with 5 onboarding milestones.
   - In-app `Notification` documents verified:
     - Notification sent to buddy: `"You have been assigned as a buddy for Alexander Sync!"`.
     - Notification sent to mentee: `"Admin Test has been assigned as your onboarding buddy!"`.

---

## Implementation Status
`FULLY_IMPLEMENTED`

## Final Verdict
`PASS`

---

## What Is Implemented
- **Buddy Program Interface (`src/pages/BuddyProgram.tsx`, `src/services/buddy.service.ts`, `src/hooks/useBuddy.ts`)**:
  - Direct report mentee selection, registered buddy browser, and onboarding checklist template selector.
  - Client-side & server-side self-pairing negative validation with explicit visual alert banners and toast notifications.
  - Active Pairings management tab rendering pairing cards, mentor-mentee relationship badges, template tags, and 0% starting progress bars.
  - Seamless query cache invalidation on pairing creation and reassignment.
  - Role-based UI visibility restricting assignment controls to `manager`, `admin`, and `owner`.

- **Backend Buddy API & Services (`server/src/modules/buddy/`)**:
  - `POST /api/v1/buddy/assign`: Role-guarded endpoint (`owner`, `admin`, `manager`) supporting parameter aliases (`buddyUserId`/`buddyId`, `newHireUserId`/`employeeId`), template selection, self-pairing rejection (`CANNOT_PAIR_SELF`), and returning `{ assignment: { buddyId, employeeId, status: "active" } }`.
  - `GET /api/v1/buddy/available`: Mentor profile discovery filtering by active status and capacity.
  - `GET /api/v1/buddy/assignments`: Organization-wide pairings list for managers and HR admins.
  - `GET /api/v1/buddy/my-buddy` & `GET /api/v1/buddy/my-mentees`: Mentee and Buddy dashboard queries.
  - Cultural and technical onboarding checklist seeding templates:
    - `"Standard Cultural Onboarding"`
    - `"Technical Deep Dive & Tooling"`
    - `"Leadership & Executive Fast Track"`
  - Automatic prior pairing lifecycle management (`reassigned` status) and capacity recalculation on reassignment.
  - In-app notifications dispatched to both parties on assignment.

---

## Test Execution Summary

### 1. Automated Vitest Suite (`server/src/tests/uj-mgr-005.test.ts`)
Run command: `npx vitest run src/tests/uj-mgr-005.test.ts`
All 7 tests passed (100% success rate):
- `✓ Precondition: Available registered buddies query returns active buddies` (32ms)
- `✓ Step 1-8: Manager assigns buddy to direct report (POST /api/v1/buddy/assign returns 201 Created)` (24ms)
- `✓ Step 9: Mentee and Manager dashboards reflect active pairing with 0% progress` (16ms)
- `✓ Alternative Path: Manager re-assigns buddy when original buddy changes teams` (21ms)
- `✓ Negative Test: Attempt pairing an employee with themselves rejects with HTTP 400 (CANNOT_PAIR_SELF)` (12ms)
- `✓ Authorization Test: Standard employees cannot initiate buddy assignments (HTTP 403 Forbidden)` (11ms)
- `✓ Data Integrity & Integration Checks: References stored and notifications dispatched to both parties` (18ms)

### 2. Live Browser Verification
- Subagent: `uj_mgr_005_buddy`
- Verified:
  1. Navigated to `/buddy` as Manager/Admin.
  2. Registered current user as buddy mentor with capacity 3.
  3. Tested negative validation: Selected same user in Mentee and Buddy dropdowns. Verified error banner `"Cannot pair an employee with themselves as buddy"` and prevented submission.
  4. Executed Happy Path pairing: Mentee Alexander Sync, Buddy Admin Test, Template `"Standard Cultural Onboarding"`.
  5. Verified `POST /api/v1/buddy/assign` returned `201 Created` with expected assignment payload structure.
  6. Inspected "Active Pairings" tab: Verified active pairing card rendered showing 0% checklist progress (`0 of 5 onboarding tasks completed`).

---

## Evidence Artifacts

### 1. Negative Validation Alert (Self-Pairing Rejected)
![Buddy Negative Validation](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/buddy_negative_validation_1789078596041.png)

### 2. Active Pairing Card with 0% Checklist Progress
![Buddy Pairing Success](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/buddy_pairing_success_1789078682902.png)

### 3. Interactive Browser Session Recording
- Full Workflow Session: [uj_mgr_005_buddy.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/uj_mgr_005_buddy_1789078148505.webp)

---

## Conclusion
The Onboarding Buddy assignment journey operates seamlessly across both backend APIs and the frontend management UI. Available buddy discovery, pairing creation, cultural checklist template seeding, self-pairing rejection, employee authorization boundaries, and cross-party notifications all function with 100% compliance to specifications.
