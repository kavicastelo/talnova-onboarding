# Journey Audit — AI Course Builder Generation

## Journey ID
UJ-ADM-008

## Date
September 2026

## Primary Role
HR Administrator / Owner (`admin`, `owner`)

## Intended Behavior
An HR administrator or organization owner can access `/ai-course-builder` to rapidly generate complete onboarding course curricula, lesson descriptions, and multi-option quiz assessments grounded in enterprise knowledge. The administrator supplies a topic prompt or policy document, specifies difficulty level and module count, and triggers AI course synthesis (`POST /api/v1/ai/generate-course`). 

The resulting structured draft contains modules, lessons, and quiz questions with defined correct options. The administrator can review and edit module titles in an interactive preview editor (such as adding `"(Mandatory)"` to Module 1), then click "Save Course to LMS". The system converts the draft syllabus into a published LMS course via `POST /api/v1/courses`, saves it to MongoDB, displays `"Course saved successfully"`, and redirects to the course library / journey builder.

## Actual Behavior
1. **Interactive AI Generator Form & Validation**:
   - The administrator accesses `/ai-course-builder` with role `admin`.
   - The UI provides:
     - Onboarding Topic, Policy Document, or Prompt input (`data-testid="course-prompt-input"`).
     - Policy document attachment button (`data-testid="policy-file-input"`).
     - Course Level dropdown (`Beginner`, `Intermediate`, `Advanced`).
     - Modules dropdown (`2 Modules`, `3 Modules`, `4 Modules`, `5 Modules`).
   - Negative validation: When the prompt input is empty, the "Generate Course Draft" button (`data-testid="generate-course-btn"`) remains strictly disabled.

2. **AI Course Generation**:
   - The administrator inputs: `"Enterprise Data Privacy & GDPR Guidelines for 2026"`, selects `"Intermediate"` level, and selects `3 Modules`.
   - Clicking "Generate Course Draft" dispatches `POST /api/v1/ai/generate-course`.
   - The backend AI course builder service synthesizes a 3-module syllabus grounded in corporate policies:
     - **Module 1**: `Introduction to Data Privacy` (Lessons on GDPR principles and individual privacy rights).
     - **Module 2**: `Identifying PII & Security Practices` (Lessons on PII classification, encryption, and storage security).
     - **Module 3**: `Quiz Assessment` (Compliance assessment containing multiple scenario questions with answer options and validated `correctOptionIndex`).
   - Network response returns `HTTP 200 OK`.

3. **Interactive Course Preview & In-line Editing**:
   - The generated syllabus is presented in the "Course Draft Preview & Editor" card.
   - Module 1 header includes an in-line edit trigger (`data-testid="edit-module-btn-1"`).
   - The administrator edits the title from `"Introduction to Data Privacy"` to `"Introduction to Data Privacy (Mandatory)"` and clicks Save (`data-testid="save-module-title-btn-1"`).
   - The preview updates immediately to reflect `"Introduction to Data Privacy (Mandatory)"`.

4. **Saving Course to LMS**:
   - Clicking "Save Course to LMS" (`data-testid="save-course-lms-btn"`) transforms the draft modules, lessons, content blocks, and quizzes into the canonical LMS schema and dispatches `POST /api/v1/courses`.
   - Backend responds with `HTTP 201 Created`, persisting the course under the tenant's `organizationId` with `publishing.status: "published"`.
   - Toast notification `"Course saved successfully"` is rendered.
   - The user is seamlessly redirected to the course library / journey builder (`/journeys`).

5. **Data Persistence & Tenancy**:
   - MongoDB inspection confirms a `Journey` document created with:
     - `title`: `"Enterprise Data Privacy & GDPR Guidelines for 2026"`
     - 3 modules with lessons and content blocks.
     - Module 1 title: `"Introduction to Data Privacy (Mandatory)"`.
     - Module 3 lesson with populated `quiz` containing multiple choice questions, options, and points.
     - Correct tenant isolation under `organizationId`.

6. **Authorization Enforcement**:
   - Non-administrator employees (`role: "employee"`) attempting to access `POST /api/v1/ai/generate-course` receive `HTTP 403 Forbidden`.
   - Non-administrator employees attempting to call `POST /api/v1/courses` receive `HTTP 403 Forbidden`.

7. **Integration Availability**:
   - The course is immediately listed via `GET /api/v1/courses` and `GET /api/v1/journeys`, available for linking in the JourneyBuilder and assigning to employees.

## Implementation Status
`FULLY_IMPLEMENTED`

## Final Verdict
`PASS` (All happy path steps, preview editing, LMS publishing, MongoDB persistence, negative tests, and authorization checks verified in both live browser execution and automated integration tests).

---

## What Is Implemented
- **AI Course Generator Form**: `src/pages/AICourseBuilder.tsx` with prompt input, file attachment trigger, level selector, module count selector, and disabled state validation.
- **AI Course Generation Route & Controller**: `POST /api/v1/ai/generate-course` and `POST /api/v1/ai/course-builder/generate` in `server/src/modules/ai/routes/ai-assistant.routes.ts` and `ai-assistant.controller.ts`.
- **Knowledge-Grounded Synthesis Engine**: `server/src/modules/ai/services/ai-course-builder.service.ts` supporting multi-module syllabus and quiz questions with `correctOptionIndex`.
- **In-line Module Editor**: `src/pages/AICourseBuilder.tsx` allowing administrators to modify module titles before saving.
- **LMS Course Creation API**: `POST /api/v1/courses` route alias mapping to `JourneyService.createJourney` with modules, lessons, and quizzes.
- **Client LMS Integration Service**: `src/services/ai-course.service.ts` (`generateDraft`, `saveCourseToLMS`) and React Query hooks `useGenerateCourse`, `useSaveCourseToLMS`.
- **Automated Vitest Suite**: `server/src/tests/uj-adm-008.test.ts` verifying all 5 core test cases (5/5 passed).

---

## What Is Missing
- None. All requirements of UJ-ADM-008 are satisfied.

---

## What Is Incorrect
- None.

---

## Test Evidence & Payloads

### 1. Network Request Payload: `POST /api/v1/ai/generate-course`
```http
POST /api/v1/ai/generate-course HTTP/1.1
Host: localhost:8080
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "prompt": "Enterprise Data Privacy & GDPR Guidelines for 2026",
  "level": "Intermediate",
  "moduleCount": 3,
  "targetRole": "All Employees",
  "department": "Compliance"
}
```

### 2. Network Response Payload: `POST /api/v1/ai/generate-course` (HTTP 200 OK)
```json
{
  "success": true,
  "message": "AI course draft generated successfully",
  "data": {
    "_id": "6aa31732fee0e331592d6230",
    "title": "Enterprise Data Privacy & GDPR Guidelines for 2026",
    "description": "AI-synthesized Intermediate course curriculum for All Employees (General). Grounded in 2 corporate policy documents.",
    "targetRole": "All Employees",
    "department": "Compliance",
    "status": "draft",
    "version": 1,
    "modules": [
      {
        "moduleId": "6aa31732fee0e331592d622d",
        "title": "Introduction to Data Privacy",
        "description": "Fundamental principles of GDPR, data protection regulations, and institutional compliance standards.",
        "lessons": [
          {
            "lessonId": "6aa31732fee0e331592d622a",
            "title": "Understanding GDPR & Privacy Rights",
            "content": "Overview of data controller responsibilities, lawful processing, and fundamental individual rights under modern data privacy legislation.",
            "durationMinutes": 15,
            "quizQuestions": [
              {
                "questionId": "6aa31732fee0e331592d6228",
                "questionText": "What is the core principle of GDPR data minimization?",
                "options": [
                  "Collect only necessary data for specified purposes",
                  "Retain all user data indefinitely",
                  "Share data across all vendors without consent",
                  "Encrypt data only during transmission"
                ],
                "correctOptionIndex": 0,
                "explanation": "GDPR Article 5(1)(c) mandates that personal data must be adequate, relevant and limited to what is necessary."
              }
            ]
          }
        ]
      },
      {
        "moduleId": "6aa31732fee0e331592d622e",
        "title": "Identifying PII & Security Practices",
        "description": "Classification of Personally Identifiable Information (PII) and secure handling protocols.",
        "lessons": [
          {
            "lessonId": "6aa31732fee0e331592d622b",
            "title": "PII Classification and Storage Security",
            "content": "Guidelines for recognizing direct and indirect identifiers, anonymization techniques, and encryption standards across enterprise workflows.",
            "durationMinutes": 20,
            "quizQuestions": [
              {
                "questionId": "6aa31732fee0e331592d6229",
                "questionText": "Which of the following is considered Personally Identifiable Information (PII)?",
                "options": [
                  "Social Security Number or National ID",
                  "Operating system version",
                  "Generic department name",
                  "Anonymized aggregate statistic"
                ],
                "correctOptionIndex": 0,
                "explanation": "National identification numbers uniquely identify individuals and represent sensitive PII."
              }
            ]
          }
        ]
      },
      {
        "moduleId": "6aa31732fee0e331592d622f",
        "title": "Quiz Assessment",
        "description": "Comprehensive compliance evaluation and scenario assessment.",
        "lessons": [
          {
            "lessonId": "6aa31732fee0e331592d622c",
            "title": "Data Privacy Compliance Assessment",
            "content": "Complete the compliance assessment questions below to certify your knowledge of enterprise privacy protocols and reporting obligations.",
            "durationMinutes": 20,
            "quizQuestions": [
              {
                "questionId": "6aa31732fee0e331592d6227",
                "questionText": "Within what timeframe must a personal data breach be reported to the supervisory authority?",
                "options": [
                  "Within 72 hours",
                  "Within 30 days",
                  "Within 14 days",
                  "Only upon customer request"
                ],
                "correctOptionIndex": 0,
                "explanation": "GDPR Article 33 requires notification of a personal data breach without undue delay and, where feasible, not later than 72 hours."
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### 3. Network Request Payload: `POST /api/v1/courses` (Save Course to LMS)
```http
POST /api/v1/courses HTTP/1.1
Host: localhost:8080
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "title": "Enterprise Data Privacy & GDPR Guidelines for 2026",
  "description": "AI-synthesized Intermediate course curriculum for All Employees (General). Grounded in 2 corporate policy documents.",
  "category": "Compliance & Security",
  "tags": ["AI-Generated", "LMS-Course", "Compliance"],
  "modules": [
    {
      "title": "Introduction to Data Privacy (Mandatory)",
      "description": "Fundamental principles of GDPR, data protection regulations, and institutional compliance standards.",
      "order": 1,
      "estimatedDurationMinutes": 15,
      "lessons": [
        {
          "title": "Understanding GDPR & Privacy Rights",
          "description": "Overview of data controller responsibilities, lawful processing, and fundamental individual rights under modern data privacy legislation.",
          "order": 1,
          "estimatedDurationMinutes": 15,
          "contentBlocks": [
            {
              "type": "text",
              "title": "Understanding GDPR & Privacy Rights",
              "content": "Overview of data controller responsibilities...",
              "order": 1
            }
          ],
          "completionRules": {
            "requireContentCompletion": true,
            "requireQuizCompletion": true
          },
          "quiz": {
            "title": "Understanding GDPR & Privacy Rights Assessment",
            "passingScore": 80,
            "questions": [
              {
                "type": "single_choice",
                "question": "What is the core principle of GDPR data minimization?",
                "points": 1,
                "options": [
                  { "text": "Collect only necessary data for specified purposes", "isCorrect": true },
                  { "text": "Retain all user data indefinitely", "isCorrect": false },
                  { "text": "Share data across all vendors without consent", "isCorrect": false },
                  { "text": "Encrypt data only during transmission", "isCorrect": false }
                ],
                "explanation": "GDPR Article 5(1)(c) mandates that personal data must be adequate, relevant and limited to what is necessary."
              }
            ]
          }
        }
      ]
    },
    {
      "title": "Identifying PII & Security Practices",
      "description": "Classification of Personally Identifiable Information (PII) and secure handling protocols.",
      "order": 2,
      "estimatedDurationMinutes": 20,
      "lessons": [...]
    },
    {
      "title": "Quiz Assessment",
      "description": "Comprehensive compliance evaluation and scenario assessment.",
      "order": 3,
      "estimatedDurationMinutes": 20,
      "lessons": [...]
    }
  ]
}
```

### 4. Network Response: `POST /api/v1/courses` (HTTP 201 Created)
```json
{
  "success": true,
  "message": "Journey created successfully",
  "data": {
    "_id": "6aa31732fee0e331592d6238",
    "organizationId": "6aa31732fee0e331592d6210",
    "title": "Enterprise Data Privacy & GDPR Guidelines for 2026",
    "slug": "enterprise-data-privacy-gdpr-guidelines-for-2026-a9f2",
    "publishing": {
      "status": "published",
      "version": 1
    },
    "modules": [
      {
        "title": "Introduction to Data Privacy (Mandatory)",
        "order": 1,
        "lessons": [...]
      },
      {
        "title": "Identifying PII & Security Practices",
        "order": 2,
        "lessons": [...]
      },
      {
        "title": "Quiz Assessment",
        "order": 3,
        "lessons": [...]
      }
    ]
  }
}
```

---

## Visual Evidence

### 1. AI Course Generator & Preview Editor
The preview editor displays the synthesized 3-module syllabus with editable module titles and generation controls.
![AI Course Preview Editor](C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/ai_course_builder_preview_editor_1789073356043.png)

### 2. Saved LMS Course in Journey Builder
After clicking "Save Course to LMS", the course is created in MongoDB and loaded directly into the LMS builder showing Module 1 title edited to `"Introduction to Data Privacy (Mandatory)"` and the questions rendered in the curriculum tree.
![Saved LMS Course Details](C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/journey_details_verified_1789073261579.png)

---

## Automated Test Execution Summary
```text
✓ src/tests/uj-adm-008.test.ts (5 tests) 9177ms
  ✓ Step 4 & 5: POST /api/v1/ai/generate-course synthesizes 3 modules with lessons and quiz questions (624ms)
  ✓ Step 6, 7 & 8: Edit Module 1 title to add '(Mandatory)' and Save Course to LMS (POST /api/v1/courses) (1639ms)
  ✓ Negative Test: Empty prompt is rejected with HTTP 400 (145ms)
  ✓ Authorization Test: Regular employees are rejected with HTTP 403 (275ms)
  ✓ Integration Check: Created course is listed in Journeys / Course Library (420ms)

Test Files  1 passed (1)
     Tests  5 passed (5)
```
