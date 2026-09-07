# Canonical V2 acceptance scenarios

These are business-behaviour tests for the next phase; they are not tests of current code.

1. **Invite happy path:** Inviting an eligible employee creates one case, resolves one deterministic plan, provisions all required resources exactly once, activates it, and records correlation ids.
2. **Idempotent replay:** Repeating the same HRIS payload or outbox delivery does not add a second case, journey assignment, task, document, buddy or meeting.
3. **No-plan:** A matching failure creates a visible manual-review/failed case according to approved policy; it never silently marks onboarding active/completed.
4. **Resolver precedence:** Manual override beats automatic rule; highest-priority matching plan wins; a tie produces a deterministic/error result specified by policy.
5. **Partial provisioning:** Fail document creation after journey/task creation; case is `PROVISIONING_FAILED`, records the failing item, never activates, and retry creates only the missing document.
6. **Pause:** Pausing prevents learner/case transitions and scheduled progression according to policy, retains evidence, and resuming is auditable.
7. **Learning completion is insufficient:** Completing all lessons completes the assignment but only advances the case if every declared mandatory gate is satisfied.
8. **Cross-person dependency:** An employee cannot treat dependent work as ready before the responsible IT/HR task is completed; the case reflects why it is waiting.
9. **Handover:** Manager sign-off is rejected before `READY_FOR_HANDOVER`; approved sign-off persists actor/time/notes and completes only the corresponding case.
10. **Restart/retry:** Restart between event persistence and delivery; the worker resumes and yields the same materialised case/resource set.
11. **Tenant isolation:** A plan/resource/event belonging to Organisation A cannot be resolved, linked, viewed or mutated by Organisation B.
12. **Legacy reconciliation:** A current active EmployeeAssignment can be linked to a case exactly once or placed in a review queue, without data loss.
