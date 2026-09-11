# Journey Audit — Query AI Assistant for Policies

## Journey ID
UJ-KB-002

## Date
September 2026

## Primary Role
All Authenticated Users (`employee`, `manager`, `admin`, `owner`)

## Intended Behavior
Verify that an employee can submit natural language questions about corporate policies to the AI Assistant and receive grounded responses citing specific Knowledge Base articles:
1. Navigate to `/ai-assistant`.
2. Type question: "What is the policy on annual leave accrual?".
3. Click "Send" or press Enter.
4. Monitor network: `POST /api/v1/ai/query` returns `HTTP 200 OK`.
5. Body contains `{ answer: string, sources: [{ id, title, url }] }`.
6. Inspect UI:
   - Assistant message bubble renders formatted text answer.
   - Clickable source badge "Leave & Attendance Policy" appears below answer.
7. Click source badge: Opens referenced KB article (`/kb/:id`).
8. Alternative Paths: User asks a follow-up question in the same chat thread ("What is the policy for expense reimbursements during travel?").
9. Negative Tests: Submit empty query string; input validation prevents submission and returns `HTTP 400 Bad Request`.
10. Authorization & Tenant Isolation: AI never returns citations or content from another organization's articles (`WHERE organizationId = context.organizationId`).
11. Data Integrity Checks: All cited sources strictly belong to the authenticated user's `organizationId`.

---

## Actual Behavior

1. **Navigation & Starting State (`/ai-assistant`)**:
   - Authenticated user navigates to `http://localhost:5173/ai-assistant`.
   - The AI Assistant interface loads with header, "New Conversation Thread" action button, conversation history sidebar, and central interactive chat panel.
   - Initial greeting prompts the user to ask questions about company policies, required documents, or assigned learning journeys.

2. **Policy Query Submission & RAG Response (`Annual Leave Accrual`)**:
   - User types `"What is the policy on annual leave accrual?"` into the query input (`[data-testid="ai-prompt-input"]`).
   - User clicks Send (`[data-testid="ai-send-btn"]`).
   - Network dispatches `POST /api/v1/ai/query`, returning `HTTP 200 OK`.
   - Response payload returns:
     ```json
     {
       "success": true,
       "message": "AI response generated successfully",
       "answer": "Based on your company's policy document **\"Leave & Attendance Policy\"**:\n\nComprehensive guidelines on annual leave accrual, sick leave, compassionate leave, and holiday carry-over allowances.\n\nEmployees accrue 1.67 days of paid annual leave per completed month of service, totaling 20 business days of paid annual leave per calendar year. Annual Leave Accrual & Carry-Over:\n- Full-time employees accrue 20 annual leave days per year.\n- A maximum of 5 unused leave days can be carried forward into the subsequent calendar year.\n\nFor additional guidelines, please reference the official article below.",
       "sources": [
         {
           "id": "6aa466cbf33502c385d56ce9",
           "title": "Leave & Attendance Policy",
           "url": "/kb/6aa466cbf33502c385d56ce9"
         }
       ]
     }
     ```
   - UI renders assistant message bubble (`[data-testid="assistant-message-bubble"]`) displaying the formatted answer and clickable citation badge `[data-testid="ai-citation-chip"]` labeled `"Leave & Attendance Policy"`.
   - Quick action shortcuts (`View Tasks & Checklists`, `View Onboarding Journeys`, `Contact Buddy Support`) and response feedback thumbs up/down icons appear.

3. **Citation Navigation to Knowledge Base (`/kb/:id`)**:
   - User clicks the citation badge `"Leave & Attendance Policy"`.
   - Browser navigates directly to `http://localhost:5173/kb/6aa466cbf33502c385d56ce9`.
   - The Knowledge Base reader view automatically opens, displaying the full rich-text content of the "Leave & Attendance Policy" article (summary, callouts, carry-over rules, and tags).

4. **Multi-turn Alternative Path (Follow-up Travel Reimbursement Query)**:
   - User returns to the active thread in `/ai-assistant` and asks the follow-up question:
     `"What is the policy for expense reimbursements during travel?"`.
   - AI Assistant generates a grounded response citing `"Travel & Expense Reimbursement Policy"`, outlining the 30-day receipt submission window, per diem allowances ($75 domestic / $100 international), and flight rules.
   - Citation chip labeled `"Travel & Expense Reimbursement Policy"` is rendered.
   - Message history preserves both conversation turns in chronological order.

5. **Negative Test (Empty Query Validation)**:
   - Submitting an empty or whitespace-only string returns `HTTP 400 Bad Request` with `{ "success": false, "message": "Message or query prompt is required" }`.
   - Frontend validation prevents submitting empty input.

6. **Authorization & Tenant Isolation**:
   - RAG article searches strictly filter by `organizationId = context.organizationId`.
   - Cross-tenant queries confirm that articles belonging to Organization B are never retrieved or cited when an Organization A employee queries the AI Assistant.

7. **Data Integrity Checks**:
   - All cited article IDs directly verify against database records matching the caller's active `organizationId`.

---

## Implementation Status
`FULLY_IMPLEMENTED`

## Final Verdict
`PASS`

---

## What Is Implemented

- **Backend AI Assistant Route Aliasing & Controller (`server/src/modules/ai/routes/ai-assistant.routes.ts`, `server/src/modules/ai/controllers/ai-assistant.controller.ts`)**:
  - Registered `POST /query` route alias alongside `POST /chat` in `aiAssistantRoutes`.
  - Added input validation in `AIAssistantController.chat` returning `HTTP 400 Bad Request` for empty query strings.
  - Standardized JSON response payload returning `{ success: true, message, answer, sources: [{ id, title, url }], data: conversation }`.

- **Enhanced RAG Knowledge Base Retrieval (`server/src/modules/ai/services/ai-assistant.service.ts`)**:
  - Implemented stop-word filtering (`what`, `is`, `the`, `for`, `during`, `policy`, `guidelines`, `rules`, etc.) and keyword extraction.
  - Added multi-factor candidate scoring and ranking: keyword matches in title (+15), summary (+8), tags (+6), and searchKeywords (+6) ensure the most relevant policy document is selected and cited.
  - Formatted citation URLs as `/kb/:id` for seamless deep linking.

- **Frontend Navigation & Auto-Opening (`src/App.tsx`, `src/pages/KnowledgeBase.tsx`, `src/pages/AIAssistant.tsx`)**:
  - Added `/kb/:id` route support in `App.tsx`.
  - Updated `KnowledgeBase.tsx` to automatically load and open articles in reader view when navigating with `:id` param.
  - Added test identifiers in `AIAssistant.tsx`: `[data-testid="ai-prompt-input"]`, `[data-testid="ai-send-btn"]`, `[data-testid="assistant-message-bubble"]`, `[data-testid="assistant-message-content"]`, `[data-testid="ai-citation-chip"]`, and `[data-testid="ai-citation-title"]`.

- **Automated Vitest Test Suite (`server/src/tests/uj-kb-002.test.ts`)**:
  - 6 of 6 tests passing (100% success rate):
    - `✓ Step 1-4: POST /api/v1/ai/query returns HTTP 200 OK with grounded policy answer and sources`
    - `✓ Required Test Data: User queries expense reimbursements during travel and receives travel citation`
    - `✓ Alternative Path: User asks a follow-up question in the same chat thread`
    - `✓ Negative Test: Submitting an empty query string returns HTTP 400 Bad Request`
    - `✓ Authorization & Tenant Isolation: AI never returns citations or answers from another organization`
    - `✓ Data Integrity Check: All cited sources strictly belong to the authenticated organizationId`

---

## Evidence Artifacts

### 1. Initial Policy Query (`Annual Leave Accrual`) with Citation Badge
![AI Assistant Annual Leave Query](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/ai_response_annual_leave_1789159170723.png)

### 2. Knowledge Base Article Opened via Citation Click (`/kb/:id`)
![KB Article Reader from Citation](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/kb_article_leave_policy_1789159192038.png)

### 3. Multi-turn Follow-up Travel Reimbursement Query with Citation
![AI Assistant Travel Reimbursement Query](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/ai_assistant_travel_query_1789159274347.png)

### 4. Browser Session Video Recording
The complete interactive browser session was recorded and archived:
- Recording: [query_ai_policies_flow_1789159123667.webp](file:///C:/Users/talno/.gemini/antigravity-ide/brain/66c48402-881a-4ec3-9c0c-905a367987f2/query_ai_policies_flow_1789159123667.webp)

---

## Summary of Test Results

| Step / Test Case | Expectation | Actual Result | Status |
|---|---|---|---|
| **Navigate to `/ai-assistant`** | AI Assistant loads chat interface | Header, history, and chat box rendered | **PASS** |
| **Query Annual Leave Accrual** | Answer generated citing Leave Policy | Grounded answer with 1.67 days/mo & 20 days/yr | **PASS** |
| **Verify Citation Chip** | Clickable badge "Leave & Attendance Policy" | Citation chip rendered with icon & text | **PASS** |
| **Click Citation Chip** | Navigates to `/kb/:id` opening article | Opened article in reader view at `/kb/:id` | **PASS** |
| **Follow-up Travel Query** | Grounded travel policy answer & citation | Travel policy answer with 30 days receipts & per diem | **PASS** |
| **Negative: Empty Query** | `400 Bad Request` validation error | Returns `400 Bad Request` with error message | **PASS** |
| **Tenant Isolation** | No cross-tenant article citations | Strict `WHERE organizationId` filter in queries | **PASS** |
| **Automated Vitest Suite** | 6 test assertions pass | 6 of 6 tests passed (100%) | **PASS** |
