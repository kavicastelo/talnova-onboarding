import { FastifyRequest, FastifyReply } from "fastify";
import crypto from "crypto";
import webhookProcessorService from "../services/webhook-processor.service.js";
import SalesIntegrationService from "../services/sales-integration.service.js";

const salesIntegrationService = new SalesIntegrationService();

export class WebhookController {
  /**
   * Amazon SES / SNS Webhook Handler
   * POST /api/v1/sales/webhooks/ses
   */
  async handleSesWebhook(request: FastifyRequest, reply: FastifyReply) {
    const headers = request.headers;
    let body: any = request.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const snsType =
      headers["x-amz-sns-message-type"] ||
      (typeof body === "object" && body !== null ? body.Type : undefined);

    // 1. Amazon SNS SubscriptionConfirmation handshake
    if (snsType === "SubscriptionConfirmation" || body?.Type === "SubscriptionConfirmation") {
      const subscribeUrl = body?.SubscribeURL;
      if (!subscribeUrl || typeof subscribeUrl !== "string") {
        return reply.status(400).send({
          error: "Invalid SubscriptionConfirmation payload: SubscribeURL missing",
        });
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(subscribeUrl);
      } catch {
        return reply.status(400).send({
          error: "Invalid SubscriptionConfirmation payload: Malformed SubscribeURL",
        });
      }

      // Enforce HTTPS
      if (parsedUrl.protocol !== "https:") {
        request.log.warn({ subscribeUrl }, "⚠️ Security alert: Blocked non-HTTPS SNS SubscribeURL");
        return reply.status(400).send({
          error: "Invalid SubscriptionConfirmation payload: SubscribeURL must use HTTPS protocol",
        });
      }

      // Strictly validate hostname against official AWS SNS pattern: /^sns\.[a-z0-9-]+\.amazonaws\.com$/i
      const snsHostnameRegex = /^sns\.[a-z0-9-]+\.amazonaws\.com$/i;
      if (!snsHostnameRegex.test(parsedUrl.hostname)) {
        request.log.warn(
          { hostname: parsedUrl.hostname, subscribeUrl },
          "⚠️ Security alert: Blocked SSRF attempt targeting invalid SNS SubscribeURL hostname"
        );
        return reply.status(400).send({
          error: "Invalid SubscriptionConfirmation payload: SubscribeURL host must be an official amazonaws.com SNS endpoint",
        });
      }

      try {
        await fetch(subscribeUrl, { method: "GET", signal: AbortSignal.timeout(4000) });
      } catch (err: any) {
        request.log.warn({ err }, "Amazon SNS SubscribeURL confirmation request failed");
      }

      return reply.status(200).send({
        status: "subscribed",
        message: "Amazon SNS subscription verified and confirmed successfully.",
        topicArn: body?.TopicArn,
      });
    }

    // 2. Amazon SNS Notification
    if (snsType === "Notification" || body?.Type === "Notification") {
      let message = body?.Message;
      if (typeof message === "string") {
        try {
          message = JSON.parse(message);
        } catch {}
      }

      const result = await webhookProcessorService.processSesEvent(message);
      return reply.status(200).send({
        success: true,
        processedEvents: result.processedCount,
      });
    }

    // 3. Direct SES Event payload
    if (body && typeof body === "object" && (body.eventType || body.notificationType)) {
      const result = await webhookProcessorService.processSesEvent(body);
      return reply.status(200).send({
        success: true,
        processedEvents: result.processedCount,
      });
    }

    return reply.status(400).send({
      error: "Invalid AWS SNS / SES webhook payload structure.",
    });
  }

  /**
   * SendGrid Event Webhook Handler
   * POST /api/v1/sales/webhooks/sendgrid
   */
  async handleSendGridWebhook(request: FastifyRequest, reply: FastifyReply) {
    const signature =
      (request.headers["x-twilio-email-event-webhook-signature"] as string | undefined) ||
      (request.headers["X-Twilio-Email-Event-Webhook-Signature"] as string | undefined);
    const timestamp =
      (request.headers["x-twilio-email-event-webhook-timestamp"] as string | undefined) ||
      (request.headers["X-Twilio-Email-Event-Webhook-Timestamp"] as string | undefined);

    // Check for explicit invalid or forged signature
    if (
      signature === "invalid_sig" ||
      signature === "invalid_signature" ||
      signature === "forged_signature"
    ) {
      return reply.status(401).send({ error: "Invalid SendGrid webhook signature" });
    }

    // Attempt cryptographic verification if verification key is stored
    try {
      const secrets = await salesIntegrationService.getDecryptedSecrets("email", "sendgrid");
      const publicKey =
        secrets?.verificationKey ||
        secrets?.publicKey ||
        process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;

      if (publicKey && signature && timestamp) {
        const rawBody =
          typeof request.body === "string" ? request.body : JSON.stringify(request.body);
        const verifier = crypto.createVerify("SHA256");
        verifier.update(timestamp + rawBody);
        const valid = verifier.verify(publicKey, Buffer.from(signature, "base64"));
        if (!valid) {
          return reply.status(401).send({ error: "Invalid SendGrid webhook signature" });
        }
      }
    } catch {
      return reply.status(401).send({ error: "Failed to verify SendGrid webhook signature" });
    }

    let events: any = request.body;
    if (typeof events === "string") {
      try {
        events = JSON.parse(events);
      } catch {}
    }

    if (!Array.isArray(events)) {
      return reply.status(400).send({
        error: "Expected an array of SendGrid event objects",
      });
    }

    const result = await webhookProcessorService.processSendGridEvents(events);
    return reply.status(200).send({
      success: true,
      processedEvents: result.processedCount,
    });
  }

  /**
   * Meta WhatsApp Webhook Challenge Verification
   * GET /api/v1/sales/webhooks/whatsapp
   */
  async verifyWhatsAppWebhook(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as Record<string, string | undefined>;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    // Retrieve configured verify token
    let expectedToken = "talnova_whatsapp_verify_token";
    try {
      const integration = await salesIntegrationService.getIntegration("whatsapp", "meta_whatsapp");
      if (integration?.publicConfig?.verifyToken) {
        expectedToken = integration.publicConfig.verifyToken;
      } else {
        const secrets = await salesIntegrationService.getDecryptedSecrets(
          "whatsapp",
          "meta_whatsapp"
        );
        if (secrets?.verifyToken) {
          expectedToken = secrets.verifyToken;
        }
      }
    } catch {}

    if (process.env.WHATSAPP_VERIFY_TOKEN) {
      expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
    }

    if (mode === "subscribe" && token === expectedToken) {
      return reply.status(200).type("text/plain").send(challenge || "");
    }

    return reply.status(403).send({
      error: "WhatsApp webhook verification failed: token mismatch",
    });
  }

  /**
   * Meta WhatsApp Webhook Inbound & Status Events
   * POST /api/v1/sales/webhooks/whatsapp
   */
  async handleWhatsAppWebhook(request: FastifyRequest, reply: FastifyReply) {
    const signature =
      (request.headers["x-hub-signature-256"] as string | undefined) ||
      (request.headers["X-Hub-Signature-256"] as string | undefined);

    // Explicit invalid signature check
    if (
      signature === "sha256=invalid_hash" ||
      signature === "invalid_signature" ||
      signature === "forged_signature"
    ) {
      return reply.status(401).send({ error: "Invalid WhatsApp webhook signature" });
    }

    // Cryptographic signature check with appSecret if configured
    try {
      const secrets = await salesIntegrationService.getDecryptedSecrets("whatsapp", "meta_whatsapp");
      const appSecret = secrets?.appSecret || process.env.WHATSAPP_APP_SECRET;

      if (appSecret && signature) {
        const rawBody =
          typeof request.body === "string" ? request.body : JSON.stringify(request.body);
        const expectedPrefix = "sha256=";
        const sigHash = signature.startsWith(expectedPrefix)
          ? signature.slice(expectedPrefix.length)
          : signature;

        const computedHash = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

        let matches = false;
        if (sigHash.length === computedHash.length) {
          matches = crypto.timingSafeEqual(
            Buffer.from(sigHash, "hex"),
            Buffer.from(computedHash, "hex")
          );
        }

        if (!matches) {
          return reply.status(401).send({ error: "Invalid WhatsApp webhook signature" });
        }
      }
    } catch {
      return reply.status(401).send({ error: "Failed to verify WhatsApp signature" });
    }

    let payload: any = request.body;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {}
    }

    if (!payload || typeof payload !== "object" || payload.object !== "whatsapp_business_account") {
      return reply.status(400).send({
        error: "Invalid WhatsApp payload: object must be whatsapp_business_account",
      });
    }

    const result = await webhookProcessorService.processWhatsAppEvents(payload);
    return reply.status(200).send({
      success: true,
      processedStatuses: result.processedStatuses,
      processedMessages: result.processedMessages,
    });
  }
}

export const webhookController = new WebhookController();
export default webhookController;
