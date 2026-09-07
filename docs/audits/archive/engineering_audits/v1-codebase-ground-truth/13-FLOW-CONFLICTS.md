# Flow conflicts

1. Employee activation is not onboarding activation; an invited employee becomes active without resources.
2. Smart auto-enrolment/workflows are coded as a `USER_CREATED` consumer but primary user creators do not emit it.
3. Audience/rule matching reads names (`employment.department`, jobTitle/location) while invite/import primarily use IDs/profile location.
4. Assignment complete triggers journey-completed workflow/notification but never aggregates operational work.
5. HR bulk and adaptive branch assignment create alternate assignment shapes, so learning rules/progress/events vary by source.
6. The scheduler mutates overdue resources after an interval, while user lifecycle state does not participate.

Each is implementation evidence; intended order is addressed separately, not assumed here.
