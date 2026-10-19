import mongoose from "mongoose";
import Campaign, { ICampaign } from "../models/campaign.model.js";
import Suppression from "../models/suppression.model.js";
import Lead from "../models/lead.model.js";
import Contact from "../models/contact.model.js";
import CommThread from "../models/comm-thread.model.js";
import queueService from "../../../infrastructure/queue/queue.service.js";
import { normalizeToE164 } from "../integrations/whatsapp/whatsapp-provider.interface.js";

export interface DeliveryEventParams {
  email?: string;
  phone?: string;
  providerMessageId?: string;
  campaignId?: string;
  timestamp?: string | number | Date;
  channel: "email" | "whatsapp";
}

export interface BounceEventParams extends DeliveryEventParams {
  bounceType?: string;
  diagnosticCode?: string;
  source?: string;
}

export interface ComplaintEventParams extends DeliveryEventParams {
  feedbackType?: string;
  source?: string;
}

export interface InboundMessageParams {
  channel: "email" | "whatsapp";
  sender: string;
  recipients?: string[];
  subject?: string;
  body: string;
  providerMessageId?: string;
  timestamp?: string | number | Date;
  metadata?: Record<string, any>;
}

export interface ProcessResult {
  success: boolean;
  processedCount: number;
  details?: Record<string, any>;
}

export class WebhookProcessorService {
  /**
   * Process AWS SES / SNS incoming event payload
   */
  async processSesEvent(event: any): Promise<ProcessResult> {
    if (!event || typeof event !== "object") {
      return { success: false, processedCount: 0 };
    }

    let processedCount = 0;
    const eventType = event.eventType || event.notificationType;
    const mail = event.mail || {};
    const messageId = mail.messageId;
    const tags = mail.tags || {};
    const campaignId = Array.isArray(tags.campaignId) ? tags.campaignId[0] : tags.campaignId;

    switch (eventType) {
      case "Delivery": {
        const recipients: string[] = event.delivery?.recipients || mail.destination || [];
        for (const email of recipients) {
          await this.handleDelivery({
            email,
            providerMessageId: messageId,
            campaignId,
            timestamp: event.delivery?.timestamp || mail.timestamp,
            channel: "email",
          });
          processedCount++;
        }
        break;
      }
      case "Open": {
        const destination = mail.destination?.[0] || event.open?.emailAddress;
        await this.handleOpen({
          email: destination,
          providerMessageId: messageId,
          campaignId,
          timestamp: event.open?.timestamp || mail.timestamp,
          channel: "email",
        });
        processedCount++;
        break;
      }
      case "Click": {
        const destination = mail.destination?.[0] || event.click?.emailAddress;
        await this.handleClick({
          email: destination,
          providerMessageId: messageId,
          campaignId,
          timestamp: event.click?.timestamp || mail.timestamp,
          channel: "email",
        });
        processedCount++;
        break;
      }
      case "Bounce": {
        const bouncedRecipients = event.bounce?.bouncedRecipients || [];
        const bounceType = event.bounce?.bounceType || "Permanent";
        for (const b of bouncedRecipients) {
          const email = b.emailAddress;
          const diagnosticCode = b.diagnosticCode || event.bounce?.bounceSubType || "Bounced";
          await this.handleBounce({
            email,
            providerMessageId: messageId,
            campaignId,
            bounceType,
            diagnosticCode,
            source: "ses",
            timestamp: event.bounce?.timestamp || mail.timestamp,
            channel: "email",
          });
          processedCount++;
        }
        break;
      }
      case "Complaint": {
        const complainedRecipients = event.complaint?.complainedRecipients || [];
        const feedbackType = event.complaint?.complaintFeedbackType || "abuse";
        for (const c of complainedRecipients) {
          const email = c.emailAddress;
          await this.handleComplaint({
            email,
            providerMessageId: messageId,
            campaignId,
            feedbackType,
            source: "ses",
            timestamp: event.complaint?.timestamp || mail.timestamp,
            channel: "email",
          });
          processedCount++;
        }
        break;
      }
      case "Received": {
        // Inbound email notification
        const sender = mail.source || mail.commonHeaders?.from?.[0] || "";
        const recipients = mail.destination || [];
        const subject = mail.commonHeaders?.subject || "Inbound Email";
        const body = event.content || event.body || mail.commonHeaders?.subject || "Inbound message received";
        await this.handleInboundMessage({
          channel: "email",
          sender,
          recipients,
          subject,
          body,
          providerMessageId: messageId,
          timestamp: mail.timestamp,
          metadata: { sesMessageId: messageId },
        });
        processedCount++;
        break;
      }
      default:
        break;
    }

    return { success: true, processedCount };
  }

  /**
   * Process SendGrid Event Webhook batch
   */
  async processSendGridEvents(events: any[]): Promise<ProcessResult> {
    if (!Array.isArray(events)) {
      return { success: false, processedCount: 0 };
    }

    let processedCount = 0;

    for (const evt of events) {
      if (!evt || typeof evt !== "object") continue;

      const email = evt.email;
      const messageId = evt.sg_message_id;
      const campaignId = evt.campaignId;
      const timestamp = evt.timestamp ? new Date(evt.timestamp * 1000) : new Date();

      switch (evt.event) {
        case "delivered":
          await this.handleDelivery({
            email,
            providerMessageId: messageId,
            campaignId,
            timestamp,
            channel: "email",
          });
          processedCount++;
          break;

        case "open":
          await this.handleOpen({
            email,
            providerMessageId: messageId,
            campaignId,
            timestamp,
            channel: "email",
          });
          processedCount++;
          break;

        case "click":
          await this.handleClick({
            email,
            providerMessageId: messageId,
            campaignId,
            timestamp,
            channel: "email",
          });
          processedCount++;
          break;

        case "bounce":
        case "dropped":
          await this.handleBounce({
            email,
            providerMessageId: messageId,
            campaignId,
            bounceType: evt.type || "Permanent",
            diagnosticCode: evt.reason || evt.status || "SendGrid bounce",
            source: "sendgrid",
            timestamp,
            channel: "email",
          });
          processedCount++;
          break;

        case "spamreport":
        case "unsubscribe":
          await this.handleComplaint({
            email,
            providerMessageId: messageId,
            campaignId,
            feedbackType: evt.event,
            source: "sendgrid",
            timestamp,
            channel: "email",
          });
          processedCount++;
          break;

        case "inbound":
          await this.handleInboundMessage({
            channel: "email",
            sender: evt.from || email,
            recipients: evt.to ? [evt.to] : [],
            subject: evt.subject || "SendGrid Inbound Email",
            body: evt.text || evt.html || "",
            providerMessageId: messageId,
            timestamp,
            metadata: evt,
          });
          processedCount++;
          break;

        default:
          break;
      }
    }

    return { success: true, processedCount };
  }

  /**
   * Process Meta WhatsApp Cloud API incoming events (statuses & messages)
   */
  async processWhatsAppEvents(
    payload: any
  ): Promise<{ processedStatuses: number; processedMessages: number }> {
    let processedStatuses = 0;
    let processedMessages = 0;

    if (!payload?.entry || !Array.isArray(payload.entry)) {
      return { processedStatuses, processedMessages };
    }

    for (const entry of payload.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // Process message delivery statuses
        if (Array.isArray(value.statuses)) {
          for (const statusObj of value.statuses) {
            const providerMessageId = statusObj.id;
            const recipientPhone = statusObj.recipient_id;
            const status = statusObj.status;
            const timestamp = statusObj.timestamp
              ? new Date(parseInt(statusObj.timestamp, 10) * 1000)
              : new Date();

            if (status === "delivered") {
              await this.handleDelivery({
                phone: recipientPhone,
                providerMessageId,
                timestamp,
                channel: "whatsapp",
              });
              processedStatuses++;
            } else if (status === "read") {
              await this.handleOpen({
                phone: recipientPhone,
                providerMessageId,
                timestamp,
                channel: "whatsapp",
              });
              processedStatuses++;
            } else if (status === "failed") {
              const errorTitle =
                statusObj.errors?.[0]?.title ||
                statusObj.errors?.[0]?.message ||
                "WhatsApp delivery failure";
              await this.handleBounce({
                phone: recipientPhone,
                providerMessageId,
                diagnosticCode: errorTitle,
                source: "whatsapp",
                timestamp,
                channel: "whatsapp",
              });
              processedStatuses++;
            }
          }
        }

        // Process inbound messages
        if (Array.isArray(value.messages)) {
          for (const msg of value.messages) {
            const sender = msg.from;
            const messageId = msg.id;
            const timestamp = msg.timestamp
              ? new Date(parseInt(msg.timestamp, 10) * 1000)
              : new Date();
            const body =
              msg.text?.body ||
              msg.button?.text ||
              msg.interactive?.button_reply?.title ||
              msg.interactive?.list_reply?.title ||
              `[${msg.type || "media"} message]`;

            await this.handleInboundMessage({
              channel: "whatsapp",
              sender,
              body,
              providerMessageId: messageId,
              timestamp,
              metadata: {
                messageType: msg.type,
                displayPhoneNumber: value.metadata?.display_phone_number,
              },
            });
            processedMessages++;
          }
        }
      }
    }

    return { processedStatuses, processedMessages };
  }

  // --- Core Lifecycle Handlers ---

  /**
   * Handle Delivered Event
   */
  async handleDelivery(params: DeliveryEventParams): Promise<void> {
    const campaign = await this.findCampaignAndRecipient(params);
    if (!campaign) return;

    const recipient = this.getMatchingRecipient(campaign, params);
    if (recipient) {
      if (
        recipient.status !== "delivered" &&
        recipient.status !== "opened" &&
        recipient.status !== "clicked" &&
        recipient.status !== "read"
      ) {
        recipient.status = "delivered";
        recipient.deliveredAt = params.timestamp ? new Date(params.timestamp) : new Date();
        campaign.stats.deliveredCount = (campaign.stats.deliveredCount || 0) + 1;
        await campaign.save();
      }
    }
  }

  /**
   * Handle Opened / Read Event
   */
  async handleOpen(params: DeliveryEventParams): Promise<void> {
    const campaign = await this.findCampaignAndRecipient(params);
    if (!campaign) return;

    const recipient = this.getMatchingRecipient(campaign, params);
    if (recipient) {
      if (recipient.status !== "opened" && recipient.status !== "clicked") {
        const previousStatus = recipient.status;
        recipient.status = "opened";
        campaign.stats.openedCount = (campaign.stats.openedCount || 0) + 1;

        if (previousStatus !== "delivered" && previousStatus !== "read") {
          campaign.stats.deliveredCount = (campaign.stats.deliveredCount || 0) + 1;
          recipient.deliveredAt = recipient.deliveredAt || new Date();
        }

        await campaign.save();
      }
    }
  }

  /**
   * Handle Clicked Event
   */
  async handleClick(params: DeliveryEventParams): Promise<void> {
    const campaign = await this.findCampaignAndRecipient(params);
    if (!campaign) return;

    const recipient = this.getMatchingRecipient(campaign, params);
    if (recipient) {
      if (recipient.status !== "clicked") {
        const wasOpened = recipient.status === "opened";
        recipient.status = "clicked";
        campaign.stats.clickedCount = (campaign.stats.clickedCount || 0) + 1;

        if (!wasOpened) {
          campaign.stats.openedCount = (campaign.stats.openedCount || 0) + 1;
          recipient.deliveredAt = recipient.deliveredAt || new Date();
        }

        await campaign.save();
      }
    }
  }

  /**
   * Handle Bounce Event: update recipient, campaign stats, and insert into Suppression registry
   */
  async handleBounce(params: BounceEventParams): Promise<void> {
    const campaign = await this.findCampaignAndRecipient(params);
    if (campaign) {
      const recipient = this.getMatchingRecipient(campaign, params);
      if (recipient && recipient.status !== "bounced") {
        recipient.status = "bounced";
        recipient.errorMessage = params.diagnosticCode || "Bounced";
        campaign.stats.bouncedCount = (campaign.stats.bouncedCount || 0) + 1;
        await campaign.save();
      }
    }

    // Record in global suppression registry
    if (params.email) {
      const normalizedEmail = params.email.trim().toLowerCase();
      try {
        await Suppression.findOneAndUpdate(
          { identifier: normalizedEmail, type: "email" },
          {
            identifier: normalizedEmail,
            type: "email",
            reason: "hard_bounce",
            source: params.source || "webhook",
            metadata: {
              campaignId: params.campaignId,
              diagnosticCode: params.diagnosticCode,
              bouncedAt: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      } catch {}
    } else if (params.phone) {
      const normalizedPhone = params.phone.trim();
      try {
        await Suppression.findOneAndUpdate(
          { identifier: normalizedPhone, type: "phone" },
          {
            identifier: normalizedPhone,
            type: "phone",
            reason: "hard_bounce",
            source: params.source || "webhook",
            metadata: {
              campaignId: params.campaignId,
              diagnosticCode: params.diagnosticCode,
              bouncedAt: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      } catch {}
    }
  }

  /**
   * Handle Spam Complaint: update recipient, campaign stats, record suppression, and revoke consent
   */
  async handleComplaint(params: ComplaintEventParams): Promise<void> {
    const campaign = await this.findCampaignAndRecipient(params);
    if (campaign) {
      const recipient = this.getMatchingRecipient(campaign, params);
      if (recipient) {
        recipient.status = "failed";
        recipient.errorMessage = `spam_complaint: ${params.feedbackType || "complaint"}`;
        campaign.stats.failedCount = (campaign.stats.failedCount || 0) + 1;
        await campaign.save();
      }
    }

    if (params.email) {
      const normalizedEmail = params.email.trim().toLowerCase();
      // Record suppression
      try {
        await Suppression.findOneAndUpdate(
          { identifier: normalizedEmail, type: "email" },
          {
            identifier: normalizedEmail,
            type: "email",
            reason: "spam_complaint",
            source: params.source || "webhook",
            metadata: {
              campaignId: params.campaignId,
              feedbackType: params.feedbackType,
              complainedAt: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      } catch {}

      // Revoke email marketing consent on Lead and Contact records
      try {
        await Lead.updateMany(
          { normalizedEmail },
          {
            $set: {
              "consent.emailMarketing": false,
              "consent.optedOutAt": new Date(),
            },
          }
        );
        await Contact.updateMany(
          { normalizedEmail },
          {
            $set: {
              "consent.emailMarketing": false,
              "consent.optedOutAt": new Date(),
            },
          }
        );
      } catch {}
    }
  }

  /**
   * Handle Inbound Message: match to Lead/Contact, append to CommThread, increment campaign repliedCount, and trigger workflow
   */
  async handleInboundMessage(params: InboundMessageParams): Promise<void> {
    const sender = params.sender.trim();
    let normalizedEmail = "";
    let cleanPhone = "";
    let e164Phone = "";

    let matchedLead: any = null;
    let matchedContact: any = null;

    if (params.channel === "email") {
      normalizedEmail = sender.toLowerCase();
      matchedLead = await Lead.findOne({ normalizedEmail });
      if (!matchedLead) {
        matchedContact = await Contact.findOne({ normalizedEmail });
      }
    } else {
      // WhatsApp
      cleanPhone = sender.replace(/[\s\-\(\)\.]/g, "");
      e164Phone = cleanPhone;
      try {
        e164Phone = normalizeToE164(cleanPhone);
      } catch {}

      matchedLead = await Lead.findOne({
        $or: [
          { normalizedPhone: cleanPhone },
          { normalizedPhone: e164Phone },
          { phone: sender },
          { phone: cleanPhone },
          { whatsapp: sender },
          { whatsapp: cleanPhone },
          { whatsapp: e164Phone },
        ],
      });

      if (!matchedLead) {
        matchedContact = await Contact.findOne({
          $or: [
            { normalizedPhone: cleanPhone },
            { normalizedPhone: e164Phone },
            { phone: sender },
            { phone: cleanPhone },
            { whatsapp: sender },
            { whatsapp: cleanPhone },
            { whatsapp: e164Phone },
          ],
        });
      }
    }

    // Append or create CommThread
    const queryConditions: any[] = [];
    if (matchedLead) queryConditions.push({ leadId: matchedLead._id });
    if (matchedContact) queryConditions.push({ contactId: matchedContact._id });

    let thread =
      queryConditions.length > 0
        ? await CommThread.findOne({
            channel: params.channel,
            $or: queryConditions,
            status: { $in: ["open", "pending"] },
          })
        : null;

    const newMessage = {
      channel: params.channel,
      direction: "inbound" as const,
      from: sender,
      to: params.recipients && params.recipients.length > 0 ? params.recipients : ["system@talnova.com"],
      subject: params.subject,
      body: params.body,
      status: "delivered" as const,
      providerMessageId: params.providerMessageId,
      sentAt: params.timestamp ? new Date(params.timestamp) : new Date(),
      metadata: params.metadata,
    };

    if (thread) {
      thread.messages.push(newMessage as any);
      thread.status = "open";
      thread.lastMessageSnippet = params.body.slice(0, 160);
      thread.lastMessageAt = new Date();
      await thread.save();
    } else {
      thread = await CommThread.create({
        channel: params.channel,
        leadId: matchedLead?._id,
        contactId: matchedContact?._id,
        companyId: matchedContact?.companyId,
        status: "open",
        subject:
          params.subject ||
          (params.channel === "whatsapp"
            ? `WhatsApp Conversation with ${sender}`
            : `Inbound Email from ${sender}`),
        lastMessageSnippet: params.body.slice(0, 160),
        lastMessageAt: new Date(),
        messages: [newMessage],
      });
    }

    // Match Campaign to increment repliedCount
    try {
      let campaignMatch: any = null;
      if (params.channel === "email" && normalizedEmail) {
        campaignMatch = await Campaign.findOne({
          channel: "email",
          "recipients.recipientEmail": normalizedEmail,
        }).sort({ updatedAt: -1 });
      } else if (params.channel === "whatsapp") {
        const withPlus = sender.startsWith("+") ? sender : `+${sender}`;
        const withoutPlus = sender.replace(/^\+/, "");
        campaignMatch = await Campaign.findOne({
          channel: "whatsapp",
          $or: [
            { "recipients.recipientPhone": sender },
            { "recipients.recipientPhone": cleanPhone },
            { "recipients.recipientPhone": withPlus },
            { "recipients.recipientPhone": withoutPlus },
            { "recipients.recipientPhone": e164Phone },
          ],
        }).sort({ updatedAt: -1 });
      }

      if (campaignMatch) {
        campaignMatch.stats.repliedCount = (campaignMatch.stats.repliedCount || 0) + 1;
        await campaignMatch.save();
      }
    } catch {}

    // Dispatch workflow automation job
    try {
      await queueService.enqueue(
        "sales:workflow:trigger",
        {
          triggerType: "lead_created",
          targetId: (matchedLead?._id || matchedContact?._id || thread._id).toString(),
          action: "create_task",
          actionPayload: {
            title: `Inbound ${params.channel.toUpperCase()} reply from ${sender}`,
            type: "follow_up",
            priority: "high",
            leadId: matchedLead?._id,
            outcomeNotes: `Inbound reply: ${params.body.slice(0, 140)}`,
          },
        },
        {
          organizationId: new mongoose.Types.ObjectId(),
          idempotencyKey: `reply-trigger-${params.providerMessageId || Date.now()}`,
        }
      );
    } catch {}
  }

  // --- Helper Methods ---

  private async findCampaignAndRecipient(
    params: DeliveryEventParams
  ): Promise<ICampaign | null> {
    // 1. By providerMessageId
    if (params.providerMessageId) {
      const byMsg = await Campaign.findOne({
        "recipients.providerMessageId": params.providerMessageId,
      });
      if (byMsg) return byMsg;
    }

    // 2. By campaignId
    if (params.campaignId && mongoose.Types.ObjectId.isValid(params.campaignId)) {
      const byId = await Campaign.findById(params.campaignId);
      if (byId) return byId;
    }

    // 3. Fallback by email / phone
    if (params.channel === "email" && params.email) {
      const byEmail = await Campaign.findOne({
        channel: "email",
        "recipients.recipientEmail": params.email.trim().toLowerCase(),
      }).sort({ updatedAt: -1 });
      if (byEmail) return byEmail;
    }

    if (params.channel === "whatsapp" && params.phone) {
      const raw = params.phone.trim();
      const digits = raw.replace(/\D/g, "");
      const byPhone = await Campaign.findOne({
        channel: "whatsapp",
        $or: [
          { "recipients.recipientPhone": raw },
          { "recipients.recipientPhone": `+${digits}` },
          { "recipients.recipientPhone": digits },
        ],
      }).sort({ updatedAt: -1 });
      if (byPhone) return byPhone;
    }

    return null;
  }

  private getMatchingRecipient(campaign: ICampaign, params: DeliveryEventParams) {
    if (!campaign.recipients || campaign.recipients.length === 0) return null;

    if (params.providerMessageId) {
      const found = campaign.recipients.find(
        (r) => r.providerMessageId === params.providerMessageId
      );
      if (found) return found;
    }

    if (params.channel === "email" && params.email) {
      const target = params.email.trim().toLowerCase();
      const found = campaign.recipients.find(
        (r) => r.recipientEmail?.toLowerCase() === target
      );
      if (found) return found;
    }

    if (params.channel === "whatsapp" && params.phone) {
      const targetDigits = params.phone.replace(/\D/g, "");
      const found = campaign.recipients.find((r) => {
        const rDigits = (r.recipientPhone || "").replace(/\D/g, "");
        return rDigits === targetDigits;
      });
      if (found) return found;
    }

    return null;
  }
}

export const webhookProcessorService = new WebhookProcessorService();
export default webhookProcessorService;
