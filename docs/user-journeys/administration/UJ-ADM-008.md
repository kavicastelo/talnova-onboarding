# AI Course Builder Generation from Policy Docs

## Journey ID
UJ-ADM-008

## Primary Role
HR Administrator / Organization Owner (`admin`, `owner`)

## Business Goal
Accelerate LMS course authoring by uploading unstructured corporate policy documents (PDF, DOCX, TXT) and leveraging AI to automatically parse, summarize, extract key learning points, structure interactive lessons, and generate assessment quizzes.

## Preconditions
1. Authenticated as `admin` or `owner` with `ai_course_builder` capability.
2. Target policy document available for upload.

## Trigger
Admin navigates to `/ai-course-builder`, uploads document file, and clicks "Generate Course Draft".

## Expected Outcome
1. System uploads document to backend AI endpoint.
2. AI extracts text content and prompts LLM to generate course syllabus, module titles, lesson markdown content, and quiz questions with answer options.
3. Interactive course preview renders allowing admin to review, edit, and approve.
4. Clicking "Create Course" instantiates a new `Course` and `Quiz` in the LMS repository.

## Journey Steps
1. Navigate to `/ai-course-builder` (`src/pages/AICourseBuilder.tsx`).
2. Drop or browse PDF policy document (e.g. "Information Security Policy 2026.pdf").
3. Select difficulty level and target audience.
4. Click "Generate Course Draft".
5. Client calls `POST /api/v1/ai/generate-course` with multipart form data.
6. Backend processes document text and invokes generative AI provider (or deterministic fallback parser).
7. Returns draft course JSON structure.
8. UI renders interactive curriculum editor with generated lessons and quizzes.
9. Admin edits lesson 1, updates quiz question 2, and clicks "Save to LMS".
10. Course is published and available in `/journeys` course library.

## Alternative Paths
- Admin enters raw text prompt or paste policy markdown directly instead of uploading a file.

## Validation Rules
- Document must not be empty.
- Generated quiz questions must contain at least 2 options and 1 correct answer index.

## Permissions
`requireRole(["owner", "admin"])`.

## APIs / Backend Dependencies
- `POST /api/v1/ai/generate-course` (`server/src/modules/ai/routes/ai.routes.ts`)
- `POST /api/v1/courses`

## Data Dependencies
- `Course`, `Lesson`, `Quiz`.

## Notifications / Integrations
- AI generation completion event.

## Failure Scenarios
- Corrupted file: Displays upload error message.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/AICourseBuilder.tsx`
- `server/src/modules/ai/controllers/ai.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase15-ai.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-ADM-008.md`
