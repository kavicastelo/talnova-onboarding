# Database evidence

Mongoose schemas define enums, soft deletion and timestamps; no migrations directory, foreign-key enforcement or transaction boundary is present. User holds both employment status and onboardingState. Assignment embeds copied journey title/version and progress, but completion reads the live Journey definition. Task has prerequisite ObjectIds but not a case/journey ID. Journey has prerequisite/conditional branch/due-rule fields. 

Indexes include tenant-oriented indexes for User/Assignment/Task/Workflow. Runtime test output reports duplicate Mongo schema indexes for `slug`, `auth.email`, and `invoiceNo`; that is executable evidence of schema duplication warnings, not necessarily data corruption. No DB schema supports KPI ownership. Existing uncommitted onboarding/outbox collections should not be assumed deployed.
