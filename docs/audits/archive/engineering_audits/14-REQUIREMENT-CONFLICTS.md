# Requirement contradictions and clarification requests

| Source A | Source B | Conflict / impact | Recommended clarification |
|---|---|---|---|
| Product docs describe automated onboarding; code subscriber | Invite/import/SSO/HRIS code | User creation does not trigger setup | Define authoritative creation event and activation timing. |
| `docs/product` task dependency language | Task/assignment services | Prerequisites stored, not used to block work | Are task dependencies mandatory gates and for whom? |
| Journey model advanced fields | Assignment progression | branches/prerequisites/due rules stored, unenforced | Specify runtime semantics and precedence. |
| Workflow schema | workflow engine | delay/buddy actions imply execution, implementation does not | Decide whether to implement durable actions or remove them. |
| HR lifecycle UI/API | manager/assignment flows | User can be complete while resources are not | Define canonical completion and allowed overrides. |
| Requirements call out KPI | models/routes | No KPI domain | Define KPI entity, ownership, assignments and completion impact. |
| Smart audience IDs and name fields | employee ingestion | Targeting fields differ | Establish canonical org taxonomy references/denormalisation. |

All existing “complete” reports are historical/untrusted inputs, not verification evidence.
