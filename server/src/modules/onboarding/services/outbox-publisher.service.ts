import eventBus from "../../../infrastructure/events/event-bus.js";
import { EventType } from "../../../infrastructure/events/event-types.js";
import OutboxEvent from "../models/outbox-event.model.js";

/**
 * Publishes persisted onboarding facts. Records remain the recovery source if a
 * process stops between state mutation and subscriber delivery.
 */
export class OutboxPublisherService {
  async publishPending(limit = 100): Promise<{ published: number; failed: number }> {
    const events = await OutboxEvent.find({ status: { $in: ["pending", "failed"] }, availableAt: { $lte: new Date() } })
      .sort({ createdAt: 1 })
      .limit(limit);
    let published = 0;
    let failed = 0;
    for (const item of events) {
      item.status = "processing";
      item.attempts += 1;
      await item.save();
      try {
        const isCreated = item.eventName === "onboarding.case.created";
        await eventBus.publish({
          eventName: (isCreated ? "ONBOARDING_CASE_CREATED" : "ONBOARDING_CASE_STATE_CHANGED") as EventType,
          organizationId: item.organizationId,
          entityId: item.aggregateId,
          correlationId: item.correlationId,
          payload: { eventName: item.eventName, ...item.payload },
        });
        item.status = "published";
        item.publishedAt = new Date();
        item.lastError = undefined;
        await item.save();
        published++;
      } catch (error: any) {
        item.status = "failed";
        item.lastError = error?.message || String(error);
        item.availableAt = new Date(Date.now() + Math.min(60_000, 1000 * 2 ** Math.min(item.attempts, 6)));
        await item.save();
        failed++;
      }
    }
    return { published, failed };
  }
}

export const outboxPublisherService = new OutboxPublisherService();
export default outboxPublisherService;
