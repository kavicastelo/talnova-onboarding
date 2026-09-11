# Journey Audit — View Leaderboard & Earn Points/Badges

## Journey ID
UJ-OPS-001

## Date
September 2026

## Primary Role
All Authenticated Users (`employee`, `manager`, `admin`, `owner`)

## Intended Behavior
Verify that users can view gamification metrics (points, learning streaks, badges) and inspect the cohort leaderboard:
1. Navigate to `/leaderboard`.
2. Verify requests:
   - `GET /api/v1/gamification/profile` returns `HTTP 200 OK`.
   - `GET /api/v1/gamification/leaderboard` returns `HTTP 200 OK`.
3. Inspect UI:
   - Total Points card displays user's score (e.g. `250 pts`).
   - Streak counter shows active consecutive days.
   - Badge showcase displays earned badges (e.g. "Quick Starter", "First Signer", "First Step", "Streak Master").
   - Leaderboard ranks cohort members by score.
4. Alternative Paths:
   - Complete a lesson or task and re-visit leaderboard to observe incremented points.
5. Negative Tests:
   - Direct unauthenticated access or excessive client requests are restricted server-side.
6. Authorization & Multi-Tenant Boundary:
   - Only tenant users can view tenant leaderboard; cross-tenant data leakage is prevented.
7. Data Integrity:
   - MongoDB `GamificationProfile.points` matches displayed score.

---

## Actual Behavior

1. **Navigation & Initial State (`/leaderboard`)**:
   - Authenticated user navigates to `http://localhost:5173/leaderboard`.
   - Client requests `GET /api/v1/gamification/profile` and `GET /api/v1/gamification/leaderboard`, both returning `HTTP 200 OK`.
   - Top banner renders `"Gamification & Leaderboard"` (`[data-testid="gamification-header"]`) with description and practice action button (`[data-testid="claim-xp-btn"]`).

2. **Gamification Profile Metrics Cards**:
   - **Your Progress (`[data-testid="user-points-card"]`)**: Displays level badge (`Level 3`), total score (`250 pts` at `[data-testid="user-points-value"]`), and level completion progress bar (`50%`).
   - **Active Streak (`[data-testid="user-streak-card"]`)**: Displays active consecutive streak (`5 Days` at `[data-testid="user-streak-value"]`) and longest historical streak (`7 days`).
   - **Micro-Credentials (`[data-testid="user-badges-card"]`)**: Displays earned badges count (`4 Badges` at `[data-testid="user-badges-value"]`).

3. **Unlocked Badges & Achievements Showcase (`[data-testid="badges-showcase"]`)**:
   - Renders a clean grid displaying 4 earned badges:
     - ⚡ **Quick Starter**: "Earned your first onboarding points!"
     - 🌟 **First Step**: "Earned your first 50 points in onboarding!"
     - ✍️ **First Signer**: "Completed key onboarding documents!"
     - 🔥 **Streak Master**: "Maintained a 3-day active learning streak!"

4. **Cohort Leaderboard Podium & Table (`[data-testid="leaderboard-section"]`)**:
   - **Top 3 Podium (`[data-testid="leaderboard-podium"]`)**:
     - 🥇 **Rank 1**: Sarah Connor (Engineering) — `420 pts` (Level 5, 8d Streak)
     - 🥈 **Rank 2**: Michael Chang (Product) — `350 pts` (Level 4, 5d Streak)
     - 🥉 **Rank 3**: Priya Patel (Design) — `280 pts` (Level 3, 4d Streak)
   - **Rankings Table (`[data-testid="leaderboard-table"]`)**:
     - Accurately lists all cohort members in descending order of points:
       - `#1` Sarah Connor (`sarah.connor@talnova.dev`) — Engineering — Lvl 5 — 8d — 420 pts
       - `#2` Michael Chang (`michael.chang@talnova.dev`) — Product — Lvl 4 — 5d — 350 pts
       - `#3` Priya Patel (`priya.patel@talnova.dev`) — Design — Lvl 3 — 4d — 280 pts
       - `#4` Alex Developer (`alex.dev@talnova-dev.com`) — General — Lvl 3 — 5d — 250 pts
       - `#5` David Kim (`david.kim@talnova.dev`) — Marketing — Lvl 2 — 2d — 190 pts

5. **Alternative Path: Points Awarding & Progression**:
   - User clicks `"Claim Practice +25 pts"` button (`[data-testid="claim-xp-btn"]`).
   - Dispatches `POST /api/v1/gamification/award-points` with `{ action: "quiz_completion", points: 25, description: "Completed onboarding practice quiz" }`.
   - Server returns `HTTP 200 OK` and recalculates level and badges.
   - User's score updates dynamically from `250 pts` to `275 pts` (level progress updates from `50%` to `75%`).
   - Badge collection unlocks 5th badge: `🚀 Fast Learner` ("Reached Level 3 onboarding proficiency!").
   - Micro-Credentials card updates to `5 Badges`.

6. **Telemetry & Streak Recording**:
   - `POST /api/v1/gamification/streak` records activity and calculates consecutive day deltas against `lastActiveDate`.

7. **Negative & Security Tests**:
   - Unauthenticated requests to `/api/v1/gamification/profile` return `HTTP 401 Unauthorized`.
   - Anti-gaming rate limit restricts rapid repetitive point claims (`>150 pts/hr` for same action), preventing client-side farming.

8. **Authorization & Multi-Tenant Boundary Isolation**:
   - Verified that users in Organization B calling `/api/v1/gamification/leaderboard` only receive cohort members belonging to Organization B. Organization A members never leak.

9. **Data Integrity Checks**:
   - Database record `GamificationProfile.points` matches the exact score returned by the API and displayed in the frontend DOM.

---

## Implementation Status
`FULLY_IMPLEMENTED`

## Final Verdict
`PASS`

---

## What Is Implemented

- **Backend Gamification Routes & Controller (`server/src/modules/gamification/routes/gamification.routes.ts`, `server/src/modules/gamification/controllers/gamification.controller.ts`)**:
  - `GET /api/v1/gamification/profile` — Retrieves or auto-initializes the caller's gamification profile.
  - `POST /api/v1/gamification/award-points` — Server-side verified points engine with anti-gaming checks.
  - `POST /api/v1/gamification/streak` — Daily activity streak tracking.
  - `GET /api/v1/gamification/leaderboard` — Tenant-isolated cohort ranking.

- **Gamification Service & Badges Catalog (`server/src/modules/gamification/services/gamification.service.ts`)**:
  - `AVAILABLE_BADGES` catalog with "Quick Starter", "First Step", "First Signer", "Fast Learner", "Streak Master", and "Quiz Master".
  - Automatic badge unlock triggers based on points, levels, or streak milestones.
  - Rate limit protection preventing duplicate claims (>150 pts/hour per action).

- **Frontend Leaderboard & Gamification UI (`src/pages/Leaderboard.tsx`)**:
  - Rendered `pts` scoring units matching specification.
  - Added comprehensive `data-testid` attributes: `gamification-header`, `claim-xp-btn`, `user-points-card`, `user-points-value`, `user-streak-card`, `user-streak-value`, `user-badges-card`, `user-badges-value`, `badges-showcase`, `badge-item`, `leaderboard-podium`, `leaderboard-table`, and `leaderboard-row`.
  - Responsive Top 3 podium with medals (🥇, 🥈, 🥉).
  - Paginated full leaderboard table with rank, employee, department, level, streak flame, and total score.

- **Automated Vitest Test Suite (`server/src/tests/uj-ops-001.test.ts`)**:
  - 8 of 8 tests passing (100% success rate):
    - `✓ Step 1-2: GET /api/v1/gamification/profile returns HTTP 200 OK with points, streak, and badges`
    - `✓ Step 1-2: GET /api/v1/gamification/leaderboard returns HTTP 200 OK with ranked cohort entries`
    - `✓ Alternative Path: User completes task/lesson and awards points server-side`
    - `✓ Telemetry: User records activity streak via POST /api/v1/gamification/streak`
    - `✓ Negative Test: Unauthenticated request is rejected with HTTP 401 Unauthorized`
    - `✓ Negative Test: Anti-gaming rate limit protects against excessive client points farming`
    - `✓ Authorization & Tenant Isolation: User B cannot see User A on leaderboard`
    - `✓ Data Integrity Check: MongoDB GamificationProfile points matches API response exactly`

---

## Evidence Artifacts

### 1. Stats Cards & Badges Showcase Initial State
![Leaderboard Stats & Badges](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/leaderboard_top_section_1789159683845.png)

### 2. Top 3 Podium & Cohort Leaderboard Table
![Leaderboard Podium & Table](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/leaderboard_podium_and_table_1789159698000.png)

### 3. Points Increment (275 pts) & Newly Unlocked "Fast Learner" Badge
![Updated Points & Unlocked Badge](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/updated_points_and_badges_1789159724999.png)

### 4. Browser Session Video Recording
The complete interactive browser session was recorded and archived:
- Recording: [view_leaderboard_flow_1789159660979.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/view_leaderboard_flow_1789159660979.webp)

---

## Summary of Test Results

| Step / Test Case | Expectation | Actual Result | Status |
|---|---|---|---|
| **Navigate to `/leaderboard`** | Leaderboard page loads cleanly | Header, stats, badges, and table rendered | **PASS** |
| **Verify Points Score** | Total Points card displays user's score | Displays `250 pts`, Level 3, 50% progress | **PASS** |
| **Verify Streak Counter** | Active consecutive days displayed | Displays `5 Days` active, longest `7 days` | **PASS** |
| **Verify Badge Showcase** | Unlocked badges displayed with icons | Displays 4 unlocked badges with icons & descriptions | **PASS** |
| **Verify Cohort Leaderboard** | Top performers and ranked table | 3-member podium + full table ranked by points | **PASS** |
| **Claim Points (Alt Path)** | Points increment server-side and UI updates | Score updated to `275 pts` & unlocked Fast Learner | **PASS** |
| **Negative Tests** | Reject unauthenticated / rate-limit farming | Returns `401 Unauthorized` / blocks duplicate claims | **PASS** |
| **Tenant Isolation** | Cohort strictly isolated to tenant org | Zero cross-tenant leaderboard leakage | **PASS** |
| **Data Integrity** | Mongo points match API score | MongoDB `GamificationProfile.points` matches exact score | **PASS** |
| **Automated Vitest Suite** | 8 test assertions pass | 8 of 8 tests passed (100%) | **PASS** |
