# Orchestration model

## FACT — current answer

There is no single onboarding orchestrator or onboarding record. `User`, `EmployeeAssignment`, workflow executions, tasks, documents, milestones and buddy records are independently created and transitioned.

| Question | Evidence-led answer |
|---|---|
| What starts onboarding? | No authoritative start. User creation is intended to publish `USER_CREATED`, but primary creation paths do not. Assignment starts on API/lesson action. |
| What creates onboarding record? | No model named Onboarding. User and assignment are separate. |
| Who resolves journey? | Workflow `assign_journey`, SmartAssignment auto-enrol, direct assignment and HR bulk each can do so. |
| What creates tasks/content/KPIs? | Workflows can create tasks. Journey assignment creates content-progress only. No KPI entity. |
| What progresses/completes? | Lesson completion mutates assignment. Tasks/documents/milestones have separate states; they do not gate assignment completion. |
| Waiting/retry/failure? | Queue retries scheduler jobs only and is RAM-only. Workflow writes logs but has no retry/resume. Smart assignment swallows exceptions. |
| Handover? | Manager sign-off is a standalone endpoint with no requirement check. |

## P0 FACT

`USER_CREATED` has subscribers but `rg` finds no producer. `event-subscribers.ts` defines dependent setup; `employee.service.ts`, `sso.service.ts`, and `hris-integration.service.ts` create users without publishing. This renders the primary V2 automatic orchestration unreachable.

## P0 FACT

The event bus catches handler errors using `Promise.allSettled` and only logs them (`event-bus.ts`); it cannot roll back already-created resources or persist/retry failed setup. This permits partial onboarding with no authoritative failure state.
