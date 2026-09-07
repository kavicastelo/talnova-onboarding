# Actual state machines

* User: `invited|active|onboarding|inactive`; separate onboardingState `not_started|active|paused|completed|archived` (default active).
* Assignment: `assigned|in_progress|completed|overdue|expired`; service/scheduler/HR each write it.
* Task: `pending|in_progress|completed|overdue|cancelled`; TaskService/scheduler write it.
* Workflow log: success/partial_failure/failed/pending_delay; no resumption mechanism.
* Document, milestone, buddy and meeting have independent model states.

No code enforces a transition relation between User onboardingState, assignment completion, task/document/milestone/buddy state, and manager sign-off.
