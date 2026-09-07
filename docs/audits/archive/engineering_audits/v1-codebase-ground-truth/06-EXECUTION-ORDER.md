# Actual execution order

## Synchronous primary API path

```text
invite User → email → accept invitation → active User → END
```

## Synchronous manual assignment path

```text
request → Journey validation → analytics increment → Assignment insert
→ audit-log attempt → EventBus.publish(JOURNEY_ASSIGNED)
→ subscriber notification → HTTP response
```

Event subscribers execute in the same Node process, not asynchronously. Scheduler scans are delayed/asynchronous only in the sense of interval + RAM queue. The intended `USER_CREATED` ordering is workflow before smart assignment before other provisioning, but it has no producer and hence no observed path.

There is no content or KPI assignment distinct from journey-progress initialisation. Handover is not downstream of completion.
