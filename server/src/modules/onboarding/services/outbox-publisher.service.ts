import eventBus from "../../../infrastructure/events/event-bus.js";
import { EventType } from "../../../infrastructure/events/event-types.js";
import OutboxEvent, { IOutboxEvent } from "../models/outbox-event.model.js";
import User from "../../auth/models/user.model.js";
import onboardingCaseService from "./onboarding-case.service.js";
import HRISWebhookLog from "../../integrations/models/hris-webhook-log.model.js";
import { HRISIntegrationService } from "../../integrations/services/hris-integration.service.js";
import workflowEngine from "../../workflows/services/workflow.engine.js";
import documentService from "../../documents/services/document.service.js";

/**
 * Publishes persisted onboarding and lifecycle events using atomic distributed locking.
 * Guarantees at-least-once delivery with exponential backoff and dead-letter queueing.
 */
export class OutboxPublisherService {
  async publishPending(limit = 100): Promise<{ published: number; failed: number }> {
    let published = 0;
    let failed = 0;

    for (let i = 0; i < limit; i++) {
      // Atomically claim one pending/failed event with a 60-second lock
      const now = new Date();
      const lockExpiry = new Date(now.getTime() - 60_000);

      const item = await OutboxEvent.findOneAndUpdate(
        {
          status: { $in: ["pending", "failed"] },
          availableAt: { $lte: now },
          $or: [{ lockedAt: null }, { lockedAt: { $lt: lockExpiry } }],
        },
        {
          $set: {
            status: "processing",
            lockedAt: now,
          },
          $inc: { attempts: 1 },
        },
        { sort: { createdAt: 1 }, new: true }
      );

      // No more claimable events in this cycle
      if (!item) {
        break;
      }

      try {
        let eventType: EventType;

        if (item.aggregateType === "hris_integration") {
          const rawData: any = item.payload?.data || item.payload || {};
          const email = rawData.work_email || rawData.email;

          if (item.eventName === "hris.employee.created") {
            let user = await User.findOne({
              organizationId: item.organizationId,
              "auth.email": email?.toLowerCase(),
            });

            if (!user && email) {
              user = await User.create({
                organizationId: item.organizationId,
                auth: {
                  email: email.toLowerCase(),
                  passwordHash: "HRIS_PROVISIONED_ACCOUNT",
                },
                profile: {
                  firstName: rawData.firstName || rawData.first_name || "New",
                  lastName: rawData.lastName || rawData.last_name || "Hire",
                },
                employment: {
                  department: rawData.department || "General",
                  jobTitle: rawData.jobTitle || rawData.job_title || "Employee",
                  status: "onboarding",
                  onboardingState: "active",
                },
                permissions: {
                  role: "employee",
                },
              });
            }

            if (user) {
              await onboardingCaseService.createCase({
                organizationId: item.organizationId.toString(),
                employeeId: user._id.toString(),
                source: "hris",
                idempotencyKey: `hris-case-${item.payload?.eventId || user._id.toString()}`,
              });

              await workflowEngine.processEvent(
                item.organizationId,
                "user_created",
                user._id,
                { department: user.employment?.department }
              );

              await documentService.autoAssignDocumentsToNewHire(
                item.organizationId,
                user._id
              );
            }

            if (item.payload?.eventId) {
              await HRISWebhookLog.updateOne(
                { organizationId: item.organizationId, eventId: item.payload.eventId },
                { $set: { status: "processed", processedAt: new Date() } }
              );
            }

            eventType = "ONBOARDING_CASE_CREATED";
          } else if (item.eventName === "hris.employee.updated") {
            const user = await User.findOne({
              organizationId: item.organizationId,
              "auth.email": email?.toLowerCase(),
            });

            if (user) {
              if (rawData.firstName || rawData.first_name)
                user.profile.firstName = rawData.firstName || rawData.first_name;
              if (rawData.lastName || rawData.last_name)
                user.profile.lastName = rawData.lastName || rawData.last_name;
              if (rawData.department)
                user.employment.department = rawData.department;
              if (rawData.jobTitle || rawData.job_title)
                user.employment.jobTitle = rawData.jobTitle || rawData.job_title;
              await user.save();
            }

            if (item.payload?.eventId) {
              await HRISWebhookLog.updateOne(
                { organizationId: item.organizationId, eventId: item.payload.eventId },
                { $set: { status: "processed", processedAt: new Date() } }
              );
            }

            eventType = "USER_UPDATED";
          } else if (item.eventName === "hris.employee.terminated") {
            const targetIdentifier = email || rawData.employeeId || rawData.id || rawData.userId;
            const hrisService = new HRISIntegrationService();
            await hrisService.executeTerminationLifecycle(
              item.organizationId,
              targetIdentifier,
              "hris_termination_event"
            );

            if (item.payload?.eventId) {
              await HRISWebhookLog.updateOne(
                { organizationId: item.organizationId, eventId: item.payload.eventId },
                { $set: { status: "processed", processedAt: new Date() } }
              );
            }

            eventType = "USER_DEACTIVATED";
          } else {
            eventType = "ONBOARDING_CASE_STATE_CHANGED";
          }
        } else if (item.eventName === "onboarding.case.created" || item.eventName === "employee.invited") {
          eventType = "ONBOARDING_CASE_CREATED";
        } else if (item.eventName === "employee.profile_updated") {
          eventType = "USER_UPDATED";
        } else {
          eventType = "ONBOARDING_CASE_STATE_CHANGED";
        }

        await eventBus.publish({
          eventName: eventType,
          organizationId: item.organizationId,
          entityId: item.aggregateId,
          correlationId: item.correlationId,
          payload: { eventName: item.eventName, ...item.payload },
        });

        item.status = "published";
        item.publishedAt = new Date();
        item.lockedAt = undefined;
        item.lastError = undefined;
        await item.save();
        published++;
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        const maxAttempts = 5;

        if (item.attempts >= maxAttempts) {
          item.status = "dead_letter";
          item.lockedAt = undefined;
          item.lastError = `Dead letter: Exceeded ${maxAttempts} attempts. Last error: ${errorMsg}`;
          await item.save();
          console.error(`[OutboxPublisher] Event ${item._id} (${item.eventName}) transitioned to DEAD_LETTER:`, errorMsg);
        } else {
          const delayMs = Math.min(60_000, 1000 * Math.pow(2, item.attempts));
          item.status = "failed";
          item.lockedAt = undefined;
          item.lastError = errorMsg;
          item.availableAt = new Date(Date.now() + delayMs);
          await item.save();
          console.warn(`[OutboxPublisher] Event ${item._id} failed (attempt ${item.attempts}). Retrying in ${delayMs}ms:`, errorMsg);
        }

        failed++;
      }
    }

    return { published, failed };
  }
}

export const outboxPublisherService = new OutboxPublisherService();
export default outboxPublisherService;
