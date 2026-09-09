# Query AI Assistant for Company Policies

## Journey ID
UJ-KB-002

## Primary Role
All Roles (Employees, Managers, Admins)

## Business Goal
Empower employees to ask natural language questions about workplace policies, holidays, benefits, and IT setups, receiving cited answers backed by the organization's Knowledge Base articles.

## Preconditions
1. User is authenticated.
2. Organization has indexed policy documents in the Knowledge Base.

## Trigger
User navigates to `/ai-assistant` and submits a natural language question.

## Expected Outcome
1. Renders conversational chat UI.
2. User asks: "What is the policy on remote work expense stipends?"
3. AI engine performs semantic retrieval across tenant KB articles and streams a synthesized answer with clickable source citations.

## Journey Steps
1. Navigate to `/ai-assistant` (`src/pages/AIAssistant.tsx`).
2. Type question into input prompt: "How many vacation days do I get in my first year?"
3. Click "Send" or press Enter.
4. Client dispatches `POST /api/v1/ai/query` with question body.
5. Backend AI service queries vector embeddings or search index for tenant articles.
6. Returns grounded answer string along with referenced article IDs and titles.
7. UI renders assistant response bubble with badges linking to the referenced KB policies.

## Alternative Paths
- If query matches no internal documentation, assistant politely clarifies that no policy exists and suggests contacting HR.

## Validation Rules
- AI query must not leak confidential documents from other tenants (`organizationId` boundary).

## Permissions
All authenticated tenant users.

## APIs / Backend Dependencies
- `POST /api/v1/ai/query` (`server/src/modules/ai/routes/ai.routes.ts`)

## Data Dependencies
- Vector embeddings and `KBArticle` store.

## Notifications / Integrations
- LLM API service.

## Failure Scenarios
- LLM rate limit: Graceful fallback error message.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/AIAssistant.tsx`
- `server/src/modules/ai/controllers/ai.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase15-ai.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-KB-002.md`
