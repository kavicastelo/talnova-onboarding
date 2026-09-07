# Actual onboarding runtime trace

```text
POST /employees/invite
→ EmployeeService.inviteEmployee
→ User.create (invited), invitation email
→ POST /auth/invitations/accept
→ User employment.status = active
→ END (no onboarding event or resource provisioning)
```

Manual learning path:

```text
POST /assignments → AssignmentService.assignJourney
→ published Journey read; EmployeeAssignment created with progress tree
→ JOURNEY_ASSIGNED (synchronous in-process subscribers) → notification
→ employee start/complete lesson → assignment status/progress mutation
→ JOURNEY_COMPLETED → notification + workflow engine
```

**UNKNOWN:** no runtime trace reaches handover from the normal invite route. Manager sign-off is independently callable and changes `employment.status` to active (`manager.service.ts`).
