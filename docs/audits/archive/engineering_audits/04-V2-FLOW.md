# V2 functionality and actual entry points

## FACT

V2 additions include workflow rules, smart assignment, HR lifecycle control, tasks, documents, milestones, buddy allocation, calendars, and scheduler scans. The intended new-hire chain is encoded in `infrastructure/events/event-subscribers.ts`:

```text
USER_CREATED
→ workflowEngine.processEvent(user_created)
→ smartAssignmentService.autoEnrollNewHire
→ document/milestone/buddy/calendar auto-assignment
```

Workflow actions are only `assign_journey`, `create_task`, `send_notification`, placeholder `trigger_buddy`, and placeholder `delay` (`workflow-rule.model.ts`, `workflow.engine.ts`). They execute serially in-process; delayed action records “delayed” but schedules nothing.

## FACT — actual reachable flows

Manual journey assignment, smart-assignment preview/execute, workflow test-run, HR bulk operation, document/task/buddy/calendar API calls are separately reachable. The normal employee `inviteEmployee` and `bulkImportEmployees` methods create Mongo users but do not call `eventBus.publish(USER_CREATED)`. `SSOService` and `HRISIntegrationService` also directly create Users and do not publish it. Thus no normal creation route activates the shown V2 chain.

## CONFLICT

The workflow engine runs before auto-enrolment in the subscriber, but it is not itself the sole resolver: both workflows and smart auto-enrolment can independently assign journeys. Multiple matching auto-enrol journeys are permitted, and failure is swallowed by the smart-assignment loop.
