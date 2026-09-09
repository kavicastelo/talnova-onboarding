# Browse Knowledge Base Articles & Policy Slideshow

## Journey ID
UJ-KB-001

## Primary Role
All Roles (Employees, Managers, Admins)

## Business Goal
Provide employees with self-serve access to company handbooks, compliance policies, team guides, and benefits documentation, featuring tag-based filtering, text search, and full-screen presentation slideshow mode.

## Preconditions
User is authenticated.

## Trigger
User clicks "Knowledge Base" in the sidebar or visits `/kb` (or `/kb/slideshow`).

## Expected Outcome
1. Renders categorized articles (e.g. "HR Policies", "Engineering Guidelines", "Benefits & Leave").
2. Live search filters articles by keyword and tag in real time.
3. User can click "Launch Slideshow" to enter distraction-free full-screen orientation mode.

## Journey Steps
1. Navigate to `/kb` (`src/pages/KnowledgeBase.tsx`).
2. Frontend calls `GET /api/v1/kb/articles`.
3. Articles render in grid with category tabs.
4. User types "Parental Leave" into search bar.
5. Filtered list updates instantaneously.
6. User clicks article to read full rich-text content.
7. User clicks "Present Mode" which routes to `/kb/slideshow` for full-screen slide transitions.

## Alternative Paths
- Admins can edit or publish new articles (`POST /api/v1/kb/articles`).

## Validation Rules
- Articles must be scoped by tenant.

## Permissions
Read access: All authenticated users; Write access: `admin`, `owner`.

## APIs / Backend Dependencies
- `GET /api/v1/kb/articles` (`server/src/modules/knowledge-base/routes/kb.routes.ts`)
- `POST /api/v1/kb/articles`

## Data Dependencies
- `KBArticle` in `kbarticles` collection.

## Notifications / Integrations
None.

## Failure Scenarios
- Network drop: Cached article fallback.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/KnowledgeBase.tsx`, `src/pages/KnowledgeBaseSlideshow.tsx`
- `server/src/modules/knowledge-base/controllers/kb.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase9-kb.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-KB-001.md`
