# Historical reconstruction

Git history begins with `a9f7eff Implement Fastify backend with full API integration`, then manual/bulk assignment changes (`91d109c`), followed by phase commits: phase1 foundation, phase2 tasks, phase3 workflows, phase4 smart assignment, then HR/docs/milestone/buddy/calendar and later features.

**INFERENCE:** V1 was user/journey/assignment-centric. V2 features were added by phase modules around existing User and EmployeeAssignment models rather than through a new onboarding aggregate. Evidence includes direct creation paths in `hr-operations.service.ts` and `advanced-journey.service.ts`, plus workflow/smart-assignment services that call the original assignment service.

No Git tag identifies v1/v2 release boundaries, and no migration history proves deployed transitions.
