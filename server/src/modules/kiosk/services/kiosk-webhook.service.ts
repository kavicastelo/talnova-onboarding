import crypto from "crypto";
import mongoose from "mongoose";
import {
  KioskWebhookSubscriptionModel,
  IKioskWebhookSubscription,
} from "../models/kiosk-webhook-subscription.model.js";
import {
  KioskWebhookDeliveryModel,
  IKioskWebhookDelivery,
} from "../models/kiosk-webhook-delivery.model.js";
import { Organization } from "../../organizations/models/organization.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import { AppError } from "../../../common/errors/app-error.js";
import {
  CreateKioskWebhookSubscriptionInput,
  UpdateKioskWebhookSubscriptionInput,
} from "../validation/webhook.schema.js";

export type KioskWebhookTopic =
  | "kiosk.device.offline"
  | "kiosk.device.tampered"
  | "kiosk.session.completed"
  | "kiosk.emergency.activated"
  | string;

export interface KioskWebhookEnvelope<T = any> {
  id: string;
  event: KioskWebhookTopic;
  topic: KioskWebhookTopic;
  timestamp: string;
  organizationId: string;
  data: T;
}

export interface KioskWebhookDispatchResult {
  eventId: string;
  topic: KioskWebhookTopic;
  deliveredCount: number;
  failedCount: number;
  totalSubscribers: number;
  deliveries: Array<{
    subscriptionId?: string;
    url: string;
    status: "success" | "failed";
    statusCode?: number;
    error?: string;
    signature: string;
    durationMs?: number;
  }>;
}

export class KioskWebhookService {
  /**
   * Compute HMAC-SHA256 signature for payload using the shared secret
   */
  public computeSignature(payload: string | Record<string, any>, secret: string): string {
    const content = typeof payload === "string" ? payload : JSON.stringify(payload);
    return crypto.createHmac("sha256", secret).update(content).digest("hex");
  }

  /**
   * Verify HMAC-SHA256 signature using constant-time comparison
   */
  public verifySignature(
    payload: string | Record<string, any>,
    signature: string,
    secret: string
  ): boolean {
    if (!signature || !secret) return false;
    try {
      const cleanSignature = signature.startsWith("sha256=") ? signature.slice(7) : signature;
      const expected = this.computeSignature(payload, secret);
      const sigBuf = Buffer.from(cleanSignature, "hex");
      const expectedBuf = Buffer.from(expected, "hex");
      if (sigBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  }

  /**
   * Register a new webhook subscription
   */
  public async createSubscription(
    orgId: string | mongoose.Types.ObjectId,
    input: CreateKioskWebhookSubscriptionInput
  ): Promise<IKioskWebhookSubscription> {
    const orgIdObj = new mongoose.Types.ObjectId(orgId);
    const secret = input.secret || crypto.randomBytes(24).toString("hex");

    const subscription = await KioskWebhookSubscriptionModel.create({
      organizationId: orgIdObj,
      url: input.url,
      secret,
      topics: input.topics && input.topics.length > 0 ? input.topics : ["*"],
      name: input.name,
      description: input.description,
      headers: input.headers || {},
      enabled: input.enabled !== false,
      failureCount: 0,
    });

    try {
      await AuditLog.create({
        organizationId: orgIdObj,
        actorType: "system",
        eventCategory: "security",
        eventType: "KIOSK_WEBHOOK_SUBSCRIPTION_CREATED",
        resourceType: "kiosk_webhook_subscription",
        resourceId: subscription._id,
        action: "create",
        description: `Registered kiosk webhook subscription for URL ${input.url}`,
        metadata: {
          url: input.url,
          topics: subscription.topics,
          subscriptionId: subscription._id.toString(),
        },
        severity: "info",
      });
    } catch {
      // Best effort audit log
    }

    return subscription;
  }

  /**
   * List webhook subscriptions for an organization
   */
  public async getSubscriptions(
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IKioskWebhookSubscription[]> {
    const orgIdObj = new mongoose.Types.ObjectId(orgId);
    return KioskWebhookSubscriptionModel.find({ organizationId: orgIdObj }).sort({ createdAt: -1 });
  }

  /**
   * Get subscription by ID
   */
  public async getSubscriptionById(
    orgId: string | mongoose.Types.ObjectId,
    subscriptionId: string
  ): Promise<IKioskWebhookSubscription> {
    const orgIdObj = new mongoose.Types.ObjectId(orgId);
    const sub = await KioskWebhookSubscriptionModel.findOne({
      _id: new mongoose.Types.ObjectId(subscriptionId),
      organizationId: orgIdObj,
    });

    if (!sub) {
      throw new AppError(404, "NOT_FOUND", "Webhook subscription not found");
    }
    return sub;
  }

  /**
   * Update subscription
   */
  public async updateSubscription(
    orgId: string | mongoose.Types.ObjectId,
    subscriptionId: string,
    input: UpdateKioskWebhookSubscriptionInput
  ): Promise<IKioskWebhookSubscription> {
    const orgIdObj = new mongoose.Types.ObjectId(orgId);
    const sub = await this.getSubscriptionById(orgIdObj, subscriptionId);

    if (input.url !== undefined) sub.url = input.url;
    if (input.secret !== undefined) sub.secret = input.secret;
    if (input.topics !== undefined) sub.topics = input.topics;
    if (input.name !== undefined) sub.name = input.name;
    if (input.description !== undefined) sub.description = input.description;
    if (input.headers !== undefined) sub.headers = input.headers;
    if (input.enabled !== undefined) sub.enabled = input.enabled;

    await sub.save();
    return sub;
  }

  /**
   * Delete subscription
   */
  public async deleteSubscription(
    orgId: string | mongoose.Types.ObjectId,
    subscriptionId: string
  ): Promise<{ success: boolean; message: string }> {
    const orgIdObj = new mongoose.Types.ObjectId(orgId);
    const result = await KioskWebhookSubscriptionModel.deleteOne({
      _id: new mongoose.Types.ObjectId(subscriptionId),
      organizationId: orgIdObj,
    });

    if (result.deletedCount === 0) {
      throw new AppError(404, "NOT_FOUND", "Webhook subscription not found");
    }

    return { success: true, message: "Webhook subscription deleted successfully" };
  }

  /**
   * Get recent delivery records
   */
  public async getDeliveries(
    orgId: string | mongoose.Types.ObjectId,
    filter?: { topic?: string; status?: "success" | "failed"; limit?: number }
  ): Promise<IKioskWebhookDelivery[]> {
    const orgIdObj = new mongoose.Types.ObjectId(orgId);
    const query: Record<string, any> = { organizationId: orgIdObj };
    if (filter?.topic) query.topic = filter.topic;
    if (filter?.status) query.status = filter.status;

    const limit = Math.min(filter?.limit || 50, 100);
    return KioskWebhookDeliveryModel.find(query).sort({ createdAt: -1 }).limit(limit);
  }

  /**
   * Outbound Webhook Publisher for Kiosk Lifecycle Event Topics:
   * - kiosk.device.offline
   * - kiosk.device.tampered
   * - kiosk.session.completed
   * - kiosk.emergency.activated
   */
  public async publishEvent<T = any>(
    orgId: string | mongoose.Types.ObjectId,
    topic: KioskWebhookTopic,
    data: T
  ): Promise<KioskWebhookDispatchResult> {
    const orgIdObj = new mongoose.Types.ObjectId(orgId);
    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const envelope: KioskWebhookEnvelope<T> = {
      id: eventId,
      event: topic,
      topic,
      timestamp,
      organizationId: orgIdObj.toString(),
      data,
    };

    // 1. Fetch matching active database subscriptions
    const dbSubscriptions = await KioskWebhookSubscriptionModel.find({
      organizationId: orgIdObj,
      enabled: true,
      $or: [{ topics: "*" }, { topics: topic }],
    });

    const activeEndpoints: Array<{
      id?: mongoose.Types.ObjectId;
      url: string;
      secret: string;
      headers?: Record<string, string>;
    }> = dbSubscriptions.map((s) => ({
      id: s._id as mongoose.Types.ObjectId,
      url: s.url,
      secret: s.secret,
      headers: s.headers,
    }));

    // 2. Fallback to Organization settings webhook if configured and not already added
    try {
      const org = await Organization.findById(orgIdObj);
      const legacyUrl =
        (org as any)?.kioskSettings?.webhookUrl ||
        (org as any)?.kioskSettings?.kioskWebhookUrl ||
        (org as any)?.integrations?.kioskWebhookUrl ||
        (org as any)?.integrations?.webhookUrl;

      if (legacyUrl && !activeEndpoints.some((e) => e.url === legacyUrl)) {
        const legacySecret =
          (org as any)?.kioskSettings?.webhookSecret ||
          (org as any)?.integrations?.webhookSecret ||
          process.env.KIOSK_WEBHOOK_SECRET ||
          "talnova-kiosk-default-secret";
        activeEndpoints.push({
          url: legacyUrl,
          secret: legacySecret,
        });
      }
    } catch (orgErr) {
      console.warn("[KioskWebhookService] Error resolving organization fallback webhook:", orgErr);
    }

    if (activeEndpoints.length === 0) {
      return {
        eventId,
        topic,
        deliveredCount: 0,
        failedCount: 0,
        totalSubscribers: 0,
        deliveries: [],
      };
    }

    const payloadString = JSON.stringify(envelope);
    const deliveries: KioskWebhookDispatchResult["deliveries"] = [];
    let deliveredCount = 0;
    let failedCount = 0;

    // 3. Dispatch to all matching endpoints concurrently
    await Promise.all(
      activeEndpoints.map(async (endpoint) => {
        const startTime = Date.now();
        const signature = this.computeSignature(payloadString, endpoint.secret);
        let deliveryStatus: "success" | "failed" = "failed";
        let statusCode: number | undefined;
        let responseBody: string | undefined;
        let deliveryError: string | undefined;

        try {
          const res = await fetch(endpoint.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "Talnova-Kiosk-Webhook-Publisher/1.0",
              "X-Talnova-Signature": signature,
              "X-Talnova-Event": topic,
              "X-Talnova-Delivery": eventId,
              "X-Talnova-Timestamp": timestamp,
              ...(endpoint.headers || {}),
            },
            body: payloadString,
            signal: AbortSignal.timeout(5000),
          });

          statusCode = res.status;
          try {
            responseBody = await res.text();
          } catch {
            responseBody = "";
          }

          if (res.ok) {
            deliveryStatus = "success";
            deliveredCount++;
          } else {
            deliveryStatus = "failed";
            deliveryError = `HTTP error ${res.status}: ${responseBody.slice(0, 200)}`;
            failedCount++;
          }
        } catch (fetchErr: any) {
          deliveryStatus = "failed";
          deliveryError = fetchErr.message || String(fetchErr);
          failedCount++;
        }

        const durationMs = Date.now() - startTime;

        // Record delivery result
        deliveries.push({
          subscriptionId: endpoint.id?.toString(),
          url: endpoint.url,
          status: deliveryStatus,
          statusCode,
          error: deliveryError,
          signature,
          durationMs,
        });

        // Persist delivery log in MongoDB
        try {
          await KioskWebhookDeliveryModel.create({
            organizationId: orgIdObj,
            subscriptionId: endpoint.id,
            url: endpoint.url,
            topic,
            eventId,
            payload: envelope,
            signature,
            statusCode,
            responseBody: responseBody ? responseBody.slice(0, 1000) : undefined,
            status: deliveryStatus,
            durationMs,
            error: deliveryError,
            attempts: 1,
          });
        } catch (dbErr) {
          console.warn("[KioskWebhookService] Failed to record delivery log:", dbErr);
        }

        // Update subscription health stats if database subscription exists
        if (endpoint.id) {
          try {
            if (deliveryStatus === "success") {
              await KioskWebhookSubscriptionModel.updateOne(
                { _id: endpoint.id },
                {
                  $set: {
                    lastDeliveredAt: new Date(),
                    failureCount: 0,
                    lastFailureError: null,
                  },
                }
              );
            } else {
              await KioskWebhookSubscriptionModel.updateOne(
                { _id: endpoint.id },
                {
                  $set: {
                    lastFailureAt: new Date(),
                    lastFailureError: deliveryError,
                  },
                  $inc: { failureCount: 1 },
                }
              );
            }
          } catch {
            // Ignore stats update failure
          }
        }
      })
    );

    return {
      eventId,
      topic,
      deliveredCount,
      failedCount,
      totalSubscribers: activeEndpoints.length,
      deliveries,
    };
  }
}

export const kioskWebhookService = new KioskWebhookService();
export default kioskWebhookService;
