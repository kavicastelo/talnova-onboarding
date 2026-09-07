# Proposed canonical V2 journey (recommendation, not current fact)

## INFERENCE — recommended ordering

The product should first create a durable **OnboardingCase** (employee + correlation + authoritative state), then resolve an approved journey/plan, materialise all dependent work, and only then activate the learner. This ordering is required because current resources need a resolved employee, journey policy and start date; it prevents V1 assignment from preceding V2 decisioning.

```text
employee provisioned/activated
→ create idempotent OnboardingCase (RESOLVING)
→ evaluate trigger/rules and resolve exactly one plan/journey policy
→ materialise journey assignment + tasks + documents + milestones + buddy + meetings
→ validate required provisioning (READY) → notify/activate (ACTIVE)
→ independently progress resources; case aggregates required gates
→ READY_FOR_HANDOVER → manager sign-off → COMPLETED/ARCHIVED
```

### Paths

* Automation: durable event/outbox starts the case; rule evaluation produces an auditable plan before materialisation.
* Manual: HR creates the same case and selects/overrides the plan; it must use the same materialiser.
* Failure: failed resource enters `PROVISIONING_FAILED` with compensation/idempotency information; it does not silently activate.
* Retry: retry one deterministic materialisation item with durable attempt history.
* Completion/handover: assignment-only completion is a learning result; case completion awaits declared required resources and manager handover policy.

## UNKNOWN / decision required

Whether one employee may have several concurrent journeys, which resource types are mandatory, rule precedence, and whether activation awaits all provisioned resources are not defined consistently in code/requirements.
