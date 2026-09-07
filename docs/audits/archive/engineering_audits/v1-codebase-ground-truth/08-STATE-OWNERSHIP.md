# State ownership

| State | Writer(s) | Readers / conflict |
|---|---|---|
| employment/onboarding state | Employee, HR, manager/SSO/HRIS services | independent from learning resources. |
| assignment progress | AssignmentService; HR direct create; advanced journey direct create | learner/analytics/manager; duplicate creation paths differ. |
| task state | TaskService and scheduler | workflow consumes completion; no case aggregate. |
| workflow state | WorkflowEngine execution log | no recovery controller. |
| handover | Manager service returns response only | no persisted sign-off entity. |

**CONFLICT:** HR can set onboardingState completed; manager sign-off sets employment active; assignment service completes learning. None validates the others.
