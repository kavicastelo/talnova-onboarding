import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import crypto from "crypto";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import Campaign from "../modules/sales/models/campaign.model.js";
import Suppression from "../modules/sales/models/suppression.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import Contact from "../modules/sales/models/contact.model.js";
import CommThread from "../modules/sales/models/comm-thread.model.js";
import SalesIntegration from "../modules/sales/models/sales-integration.model.js";
import { encryptSecret } from "../utils/crypto.js";
import queueService from "../infrastructure/queue/queue.service.js";

describe("CAMP-006: Delivery & Inbound Webhook Handlers", () => {
  let app: FastifyInstance;
  const testPrefix = `camp006-${Date.now()}`;
  const dummyUserId = new mongoose.Types.ObjectId();

  const createdCampaignIds: mongoose.Types.ObjectId[] = [];
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdSuppressionIds: mongoose.Types.ObjectId[] = [];
  const createdThreadIds: mongoose.Types.ObjectId[] = [];
  const createdIntegrationIds: mongoose.Types.ObjectId[] = [];

  const testAppSecret = "test_meta_webhook_secret_12345";
  const testVerifyToken = "test_whatsapp_verify_token_54321";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Configure WhatsApp integration with appSecret and verifyToken
    const integration = await SalesIntegration.create({
      category: "whatsapp",
      provider: "meta_whatsapp",
      name: "Meta WhatsApp Test",
      enabled: true,
      status: "valid",
      publicConfig: {
        phoneNumberId: "1234567890",
        verifyToken: testVerifyToken,
      },
      encryptedSecrets: new Map([
        ["accessToken", encryptSecret("EAAtest_token")],
        ["appSecret", encryptSecret(testAppSecret)],
        ["verifyToken", encryptSecret(testVerifyToken)],
      ]),
    });
    createdIntegrationIds.push(integration._id);
  });

  afterAll(async () => {
    if (createdCampaignIds.length > 0) {
      await Campaign.deleteMany({ _id: { $in: createdCampaignIds } });
    }
    if (createdLeadIds.length > 0) {
      await Lead.deleteMany({ _id: { $in: createdLeadIds } });
    }
    if (createdSuppressionIds.length > 0) {
      await Suppression.deleteMany({ _id: { $in: createdSuppressionIds } });
    }
    if (createdThreadIds.length > 0) {
      await CommThread.deleteMany({ _id: { $in: createdThreadIds } });
    }
    if (createdIntegrationIds.length > 0) {
      await SalesIntegration.deleteMany({ _id: { $in: createdIntegrationIds } });
    }
    await disconnectDatabase(app.log);
    await app.close();
  });

  // --- 1. Amazon SES / SNS Webhooks ---
  describe("1. Amazon SES & SNS Webhook Listener (POST /api/v1/sales/webhooks/ses)", () => {
    it("should handle SNS SubscriptionConfirmation handshake automatically", async () => {
      const payload = {
        Type: "SubscriptionConfirmation",
        MessageId: `msg-${Date.now()}`,
        Token: "test_token_123",
        TopicArn: "arn:aws:sns:us-east-1:123456789012:ses-events",
        Message: "You have chosen to subscribe to the topic...",
        SubscribeURL: "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&Token=test",
        Timestamp: new Date().toISOString(),
      };

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/ses",
        headers: {
          "x-amz-sns-message-type": "SubscriptionConfirmation",
          "content-type": "text/plain",
        },
        payload: JSON.stringify(payload),
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.status).toBe("subscribed");
      expect(data.topicArn).toBe(payload.TopicArn);
    });

    it("should process SES Delivery event and update campaign recipient status and stats", async () => {
      const email = `ses-delivery-${testPrefix}@example.com`;
      const sesMessageId = `ses-msg-${Date.now()}`;

      const campaign = await Campaign.create({
        name: `SES Delivery Campaign ${testPrefix}`,
        channel: "email",
        status: "sending",
        createdBy: dummyUserId,
        recipients: [
          {
            recipientEmail: email,
            status: "sent",
            providerMessageId: sesMessageId,
            sentAt: new Date(),
          },
        ],
        stats: { totalRecipients: 1, sentCount: 1, deliveredCount: 0 },
      });
      createdCampaignIds.push(campaign._id);

      const snsPayload = {
        Type: "Notification",
        MessageId: `sns-${Date.now()}`,
        TopicArn: "arn:aws:sns:us-east-1:123456789012:ses-events",
        Message: JSON.stringify({
          eventType: "Delivery",
          mail: {
            messageId: sesMessageId,
            destination: [email],
            tags: { campaignId: [campaign._id.toString()] },
            timestamp: new Date().toISOString(),
          },
          delivery: {
            timestamp: new Date().toISOString(),
            recipients: [email],
            smtpResponse: "250 2.0.0 OK",
          },
        }),
      };

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/ses",
        headers: {
          "x-amz-sns-message-type": "Notification",
          "content-type": "application/json",
        },
        payload: snsPayload,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.processedEvents).toBe(1);

      // Verify campaign in database
      const updated = await Campaign.findById(campaign._id);
      expect(updated?.stats.deliveredCount).toBe(1);
      expect(updated?.recipients[0].status).toBe("delivered");
      expect(updated?.recipients[0].deliveredAt).toBeDefined();
    });

    it("should process SES Open and Click events", async () => {
      const email = `ses-engagement-${testPrefix}@example.com`;
      const sesMessageId = `ses-eng-${Date.now()}`;

      const campaign = await Campaign.create({
        name: `SES Engagement Campaign ${testPrefix}`,
        channel: "email",
        status: "sending",
        createdBy: dummyUserId,
        recipients: [
          {
            recipientEmail: email,
            status: "delivered",
            providerMessageId: sesMessageId,
            sentAt: new Date(),
          },
        ],
        stats: { totalRecipients: 1, sentCount: 1, deliveredCount: 1, openedCount: 0, clickedCount: 0 },
      });
      createdCampaignIds.push(campaign._id);

      // 1. Open Event
      await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/ses",
        payload: {
          Type: "Notification",
          Message: JSON.stringify({
            eventType: "Open",
            mail: { messageId: sesMessageId, destination: [email] },
            open: { timestamp: new Date().toISOString() },
          }),
        },
      });

      let updated = await Campaign.findById(campaign._id);
      expect(updated?.stats.openedCount).toBe(1);
      expect(updated?.recipients[0].status).toBe("opened");

      // 2. Click Event
      await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/ses",
        payload: {
          Type: "Notification",
          Message: JSON.stringify({
            eventType: "Click",
            mail: { messageId: sesMessageId, destination: [email] },
            click: { timestamp: new Date().toISOString(), link: "https://talnova.com/demo" },
          }),
        },
      });

      updated = await Campaign.findById(campaign._id);
      expect(updated?.stats.clickedCount).toBe(1);
      expect(updated?.recipients[0].status).toBe("clicked");
    });

    it("should process SES Hard Bounce, increment bounce stat, and record in Suppression registry", async () => {
      const email = `ses-bounce-${testPrefix}@example.com`;
      const sesMessageId = `ses-bounce-msg-${Date.now()}`;

      const campaign = await Campaign.create({
        name: `SES Bounce Campaign ${testPrefix}`,
        channel: "email",
        status: "sending",
        createdBy: dummyUserId,
        recipients: [
          {
            recipientEmail: email,
            status: "sent",
            providerMessageId: sesMessageId,
            sentAt: new Date(),
          },
        ],
        stats: { totalRecipients: 1, sentCount: 1, bouncedCount: 0 },
      });
      createdCampaignIds.push(campaign._id);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/ses",
        payload: {
          Type: "Notification",
          Message: JSON.stringify({
            eventType: "Bounce",
            mail: { messageId: sesMessageId },
            bounce: {
              bounceType: "Permanent",
              bounceSubType: "General",
              bouncedRecipients: [
                {
                  emailAddress: email,
                  action: "failed",
                  status: "5.1.1",
                  diagnosticCode: "smtp; 550 5.1.1 User unknown",
                },
              ],
            },
          }),
        },
      });

      expect(res.statusCode).toBe(200);

      const updated = await Campaign.findById(campaign._id);
      expect(updated?.stats.bouncedCount).toBe(1);
      expect(updated?.recipients[0].status).toBe("bounced");

      // Verify suppression registry
      const suppression = await Suppression.findOne({
        identifier: email.toLowerCase(),
        type: "email",
      });
      expect(suppression).toBeDefined();
      expect(suppression?.reason).toBe("hard_bounce");
      if (suppression) createdSuppressionIds.push(suppression._id);
    });

    it("should process SES Complaint, record suppression, and revoke marketing consent on Lead", async () => {
      const email = `ses-complaint-${testPrefix}@example.com`;
      const sesMessageId = `ses-complaint-msg-${Date.now()}`;

      // Create Lead with active marketing consent
      const lead = await Lead.create({
        name: "Complaint Tester",
        email,
        normalizedEmail: email.toLowerCase(),
        companyName: "Complaint Corp",
        status: "new",
        score: 40,
        consent: { emailMarketing: true, whatsappMarketing: true },
      });
      createdLeadIds.push(lead._id);

      const campaign = await Campaign.create({
        name: `SES Complaint Campaign ${testPrefix}`,
        channel: "email",
        status: "sending",
        createdBy: dummyUserId,
        recipients: [
          {
            recipientEmail: email,
            status: "sent",
            providerMessageId: sesMessageId,
            sentAt: new Date(),
          },
        ],
        stats: { totalRecipients: 1, sentCount: 1, failedCount: 0 },
      });
      createdCampaignIds.push(campaign._id);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/ses",
        payload: {
          Type: "Notification",
          Message: JSON.stringify({
            eventType: "Complaint",
            mail: { messageId: sesMessageId },
            complaint: {
              complainedRecipients: [{ emailAddress: email }],
              complaintFeedbackType: "abuse",
            },
          }),
        },
      });

      expect(res.statusCode).toBe(200);

      // Verify suppression record
      const suppression = await Suppression.findOne({
        identifier: email.toLowerCase(),
        type: "email",
      });
      expect(suppression?.reason).toBe("spam_complaint");
      if (suppression) createdSuppressionIds.push(suppression._id);

      // Verify Lead consent revoked
      const updatedLead = await Lead.findById(lead._id);
      expect(updatedLead?.consent.emailMarketing).toBe(false);
      expect(updatedLead?.consent.optedOutAt).toBeDefined();
    });

    it("should process Inbound Email notification, append message to CommThread, and increment repliedCount", async () => {
      const email = `ses-reply-${testPrefix}@example.com`;

      const lead = await Lead.create({
        name: "Inbound Email Lead",
        email,
        normalizedEmail: email.toLowerCase(),
        companyName: "Reply Corp",
        status: "contacted",
        score: 30,
        consent: { emailMarketing: true, whatsappMarketing: true },
      });
      createdLeadIds.push(lead._id);

      const campaign = await Campaign.create({
        name: `SES Reply Campaign ${testPrefix}`,
        channel: "email",
        status: "sending",
        createdBy: dummyUserId,
        recipients: [{ recipientEmail: email, status: "sent", sentAt: new Date() }],
        stats: { totalRecipients: 1, sentCount: 1, repliedCount: 0 },
      });
      createdCampaignIds.push(campaign._id);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/ses",
        payload: {
          Type: "Notification",
          Message: JSON.stringify({
            eventType: "Received",
            mail: {
              messageId: `ses-inbound-${Date.now()}`,
              source: email,
              destination: ["sales@talnova.com"],
              commonHeaders: {
                subject: "Re: Interested in Talnova Platform",
                from: [email],
              },
            },
            content: "Hello, we would love to see an enterprise demonstration next Tuesday.",
          }),
        },
      });

      expect(res.statusCode).toBe(200);

      // Verify CommThread was created
      const thread = await CommThread.findOne({ leadId: lead._id, channel: "email" });
      expect(thread).toBeDefined();
      expect(thread?.status).toBe("open");
      expect(thread?.messages.length).toBe(1);
      expect(thread?.messages[0].direction).toBe("inbound");
      expect(thread?.messages[0].body).toContain("enterprise demonstration");
      if (thread) createdThreadIds.push(thread._id);

      // Verify Campaign replied count incremented
      const updatedCampaign = await Campaign.findById(campaign._id);
      expect(updatedCampaign?.stats.repliedCount).toBe(1);
    });

    it("should reject malformed or non-SNS/SES payloads with HTTP 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/ses",
        payload: { randomKey: "invalid_payload" },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBeDefined();
    });
  });

  // --- 2. SendGrid Webhooks ---
  describe("2. SendGrid Event Webhook Listener (POST /api/v1/sales/webhooks/sendgrid)", () => {
    it("should reject forged or explicitly invalid SendGrid signatures with HTTP 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/sendgrid",
        headers: {
          "x-twilio-email-event-webhook-signature": "invalid_signature",
          "x-twilio-email-event-webhook-timestamp": `${Date.now()}`,
        },
        payload: [{ event: "delivered", email: "test@example.com" }],
      });

      expect(res.statusCode).toBe(401);
      const data = JSON.parse(res.body);
      expect(data.error).toContain("Invalid SendGrid webhook signature");
    });

    it("should reject non-array payload with HTTP 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/sendgrid",
        payload: { notAnArray: true },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toContain("array");
    });

    it("should process batch SendGrid delivery, open, click, and bounce events", async () => {
      const deliveredEmail = `sg-del-${testPrefix}@example.com`;
      const bouncedEmail = `sg-bounce-${testPrefix}@example.com`;
      const sgMsgDel = `sg-msg-del-${Date.now()}`;
      const sgMsgBounce = `sg-msg-bounce-${Date.now()}`;

      const campaign = await Campaign.create({
        name: `SendGrid Batch Campaign ${testPrefix}`,
        channel: "email",
        status: "sending",
        createdBy: dummyUserId,
        recipients: [
          { recipientEmail: deliveredEmail, status: "sent", providerMessageId: sgMsgDel, sentAt: new Date() },
          { recipientEmail: bouncedEmail, status: "sent", providerMessageId: sgMsgBounce, sentAt: new Date() },
        ],
        stats: { totalRecipients: 2, sentCount: 2, deliveredCount: 0, openedCount: 0, bouncedCount: 0 },
      });
      createdCampaignIds.push(campaign._id);

      const batchPayload = [
        {
          event: "delivered",
          email: deliveredEmail,
          sg_message_id: sgMsgDel,
          timestamp: Math.floor(Date.now() / 1000),
          campaignId: campaign._id.toString(),
        },
        {
          event: "open",
          email: deliveredEmail,
          sg_message_id: sgMsgDel,
          timestamp: Math.floor(Date.now() / 1000),
          campaignId: campaign._id.toString(),
        },
        {
          event: "bounce",
          email: bouncedEmail,
          sg_message_id: sgMsgBounce,
          reason: "550 5.1.1 User unknown",
          timestamp: Math.floor(Date.now() / 1000),
          campaignId: campaign._id.toString(),
        },
      ];

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/sendgrid",
        payload: batchPayload,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.processedEvents).toBe(3);

      const updated = await Campaign.findById(campaign._id);
      expect(updated?.stats.deliveredCount).toBe(1);
      expect(updated?.stats.openedCount).toBe(1);
      expect(updated?.stats.bouncedCount).toBe(1);

      // Verify bounce suppression
      const suppression = await Suppression.findOne({
        identifier: bouncedEmail.toLowerCase(),
        type: "email",
      });
      expect(suppression).toBeDefined();
      if (suppression) createdSuppressionIds.push(suppression._id);
    });
  });

  // --- 3. Meta WhatsApp Cloud API Webhooks ---
  describe("3. Meta WhatsApp Cloud API Webhook Listener (/api/v1/sales/webhooks/whatsapp)", () => {
    it("should respond with challenge text when verify_token matches on GET", async () => {
      const challengeStr = "challenge_123456789";

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sales/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${testVerifyToken}&hub.challenge=${challengeStr}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(challengeStr);
    });

    it("should reject GET verification with HTTP 403 when verify_token does not match", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sales/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=123`,
      });

      expect(res.statusCode).toBe(403);
      const data = JSON.parse(res.body);
      expect(data.error).toContain("mismatch");
    });

    it("should reject POST with forged HMAC signature (HTTP 401)", async () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [],
      };

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/whatsapp",
        headers: {
          "x-hub-signature-256": "sha256=invalid_hash",
        },
        payload,
      });

      expect(res.statusCode).toBe(401);
      const data = JSON.parse(res.body);
      expect(data.error).toContain("Invalid WhatsApp webhook signature");
    });

    it("should accept POST with valid HMAC SHA-256 signature and process delivery statuses", async () => {
      const phone = "14155552671";
      const wamidDelivered = `wamid.del.${Date.now()}`;
      const wamidRead = `wamid.read.${Date.now()}`;

      const campaign = await Campaign.create({
        name: `WhatsApp Status Campaign ${testPrefix}`,
        channel: "whatsapp",
        status: "sending",
        createdBy: dummyUserId,
        recipients: [
          { recipientPhone: `+${phone}`, status: "sent", providerMessageId: wamidDelivered, sentAt: new Date() },
          { recipientPhone: `+14155559999`, status: "sent", providerMessageId: wamidRead, sentAt: new Date() },
        ],
        stats: { totalRecipients: 2, sentCount: 2, deliveredCount: 0, openedCount: 0 },
      });
      createdCampaignIds.push(campaign._id);

      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123456789",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  statuses: [
                    {
                      id: wamidDelivered,
                      status: "delivered",
                      timestamp: `${Math.floor(Date.now() / 1000)}`,
                      recipient_id: phone,
                    },
                    {
                      id: wamidRead,
                      status: "read",
                      timestamp: `${Math.floor(Date.now() / 1000)}`,
                      recipient_id: "14155559999",
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const validSignature =
        "sha256=" + crypto.createHmac("sha256", testAppSecret).update(rawBody).digest("hex");

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/whatsapp",
        headers: {
          "x-hub-signature-256": validSignature,
          "content-type": "application/json",
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.processedStatuses).toBe(2);

      const updated = await Campaign.findById(campaign._id);
      expect(updated?.stats.deliveredCount).toBe(2); // read also counts toward delivery
      expect(updated?.stats.openedCount).toBe(1);
    });

    it("should process inbound WhatsApp message, append to CommThread, increment repliedCount, and enqueue workflow job", async () => {
      const phone = "14155553333";
      const e164Phone = `+${phone}`;

      const lead = await Lead.create({
        name: "WhatsApp Prospect",
        email: `wa-lead-${testPrefix}@example.com`,
        normalizedEmail: `wa-lead-${testPrefix}@example.com`,
        phone: e164Phone,
        normalizedPhone: phone,
        companyName: "Mobile Commerce LLC",
        status: "contacted",
        score: 45,
        consent: { emailMarketing: true, whatsappMarketing: true },
      });
      createdLeadIds.push(lead._id);

      const campaign = await Campaign.create({
        name: `WhatsApp Inbound Campaign ${testPrefix}`,
        channel: "whatsapp",
        status: "sending",
        createdBy: dummyUserId,
        recipients: [{ recipientPhone: e164Phone, status: "sent", sentAt: new Date() }],
        stats: { totalRecipients: 1, sentCount: 1, repliedCount: 0 },
      });
      createdCampaignIds.push(campaign._id);

      const inboundMsgId = `wamid.inbound.${Date.now()}`;
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123456789",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  contacts: [{ profile: { name: "WhatsApp Prospect" }, wa_id: phone }],
                  messages: [
                    {
                      from: phone,
                      id: inboundMsgId,
                      timestamp: `${Math.floor(Date.now() / 1000)}`,
                      type: "text",
                      text: { body: "Yes, please connect me with your sales engineer for API integration." },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const validSignature =
        "sha256=" + crypto.createHmac("sha256", testAppSecret).update(rawBody).digest("hex");

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/whatsapp",
        headers: {
          "x-hub-signature-256": validSignature,
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.processedMessages).toBe(1);

      // Verify CommThread was created
      const thread = await CommThread.findOne({ leadId: lead._id, channel: "whatsapp" });
      expect(thread).toBeDefined();
      expect(thread?.status).toBe("open");
      expect(thread?.messages.length).toBe(1);
      expect(thread?.messages[0].direction).toBe("inbound");
      expect(thread?.messages[0].body).toContain("sales engineer for API integration");
      if (thread) createdThreadIds.push(thread._id);

      // Verify Campaign replied count incremented
      const updatedCampaign = await Campaign.findById(campaign._id);
      expect(updatedCampaign?.stats.repliedCount).toBe(1);
    });
  });
});
