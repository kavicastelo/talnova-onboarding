import mongoose from "mongoose";
import AppError from "../../../common/errors/app-error.js";
import CommThread, { ICommThread, ICommMessage } from "../models/comm-thread.model.js";
import Lead from "../models/lead.model.js";
import Contact from "../models/contact.model.js";
import Company from "../models/company.model.js";
import Deal from "../models/deal.model.js";
import { EmailProviderFactory } from "../integrations/email/email.factory.js";
import { WhatsAppProviderFactory } from "../integrations/whatsapp/whatsapp.factory.js";
import { normalizeToE164 } from "../integrations/whatsapp/whatsapp-provider.interface.js";
import {
  InboxQueryParams,
  SendReplyDto,
  UpdateThreadDto,
  CreateThreadDto,
} from "../schemas/inbox.schemas.js";

export class InboxService {
  /**
   * List threads with multi-channel filtering, search, pagination, and counter aggregates
   */
  async listThreads(params: InboxQueryParams): Promise<{
    items: ICommThread[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    counters: {
      total: number;
      open: number;
      pending: number;
      resolved: number;
      unread: number;
    };
  }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};

    // 1. Channel Filter
    if (params.channel) {
      query.channel = params.channel;
    }

    // 2. Status Filter
    if (params.status) {
      query.status = params.status;
    }

    // 3. Assignment Filter
    if (params.assignedTo) {
      query.assignedTo = new mongoose.Types.ObjectId(params.assignedTo);
    }

    // 4. Entity Linkage Filters
    if (params.leadId) {
      query.leadId = new mongoose.Types.ObjectId(params.leadId);
    }
    if (params.contactId) {
      query.contactId = new mongoose.Types.ObjectId(params.contactId);
    }
    if (params.companyId) {
      query.companyId = new mongoose.Types.ObjectId(params.companyId);
    }
    if (params.dealId) {
      query.dealId = new mongoose.Types.ObjectId(params.dealId);
    }

    // 5. Unread Only Filter
    if (params.unreadOnly) {
      query["messages"] = {
        $elemMatch: {
          direction: "inbound",
          status: { $ne: "read" },
        },
      };
    }

    // 6. Search across subject, snippet, or linked lead/contact names
    if (params.search && params.search.trim()) {
      const searchRegex = new RegExp(params.search.trim(), "i");

      // Find matching leads or contacts
      const [matchedLeads, matchedContacts] = await Promise.all([
        Lead.find({
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
            { companyName: searchRegex },
          ],
        }).select("_id"),
        Contact.find({
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
          ],
        }).select("_id"),
      ]);

      const leadIds = matchedLeads.map((l) => l._id);
      const contactIds = matchedContacts.map((c) => c._id);

      query.$or = [
        { subject: searchRegex },
        { lastMessageSnippet: searchRegex },
        { "messages.from": searchRegex },
        { "messages.to": searchRegex },
        { "messages.body": searchRegex },
        ...(leadIds.length > 0 ? [{ leadId: { $in: leadIds } }] : []),
        ...(contactIds.length > 0 ? [{ contactId: { $in: contactIds } }] : []),
      ];
    }

    // Calculate aggregations / counters across all channels or current filter scope
    const [total, items, openCount, pendingCount, resolvedCount, unreadCount] =
      await Promise.all([
        CommThread.countDocuments(query),
        CommThread.find(query)
          .sort({ [params.sortBy]: params.sortOrder === "asc" ? 1 : -1 })
          .skip(skip)
          .limit(limit)
          .populate("leadId", "firstName lastName fullName email phone companyName status leadScore")
          .populate("contactId", "firstName lastName fullName email phone jobTitle")
          .populate("companyId", "name domain industry size")
          .populate("dealId", "name stage value currency")
          .populate("assignedTo", "name email role")
          .lean(),
        CommThread.countDocuments({ ...query, status: "open" }),
        CommThread.countDocuments({ ...query, status: "pending" }),
        CommThread.countDocuments({ ...query, status: "resolved" }),
        CommThread.countDocuments({
          ...query,
          messages: {
            $elemMatch: { direction: "inbound", status: { $ne: "read" } },
          },
        }),
      ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items as unknown as ICommThread[],
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
      counters: {
        total,
        open: openCount,
        pending: pendingCount,
        resolved: resolvedCount,
        unread: unreadCount,
      },
    };
  }

  /**
   * Get single thread with complete chronological messages and populated details
   */
  async getThreadById(
    threadId: string,
    options?: { markAsRead?: boolean }
  ): Promise<ICommThread> {
    if (!mongoose.Types.ObjectId.isValid(threadId)) {
      throw new AppError(400, "INVALID_THREAD_ID", "Invalid thread ID format");
    }

    const thread = await CommThread.findById(threadId)
      .populate("leadId", "firstName lastName fullName email phone companyName status leadScore")
      .populate("contactId", "firstName lastName fullName email phone jobTitle")
      .populate("companyId", "name domain industry size")
      .populate("dealId", "name stage value currency")
      .populate("assignedTo", "name email role");

    if (!thread) {
      throw new AppError(404, "THREAD_NOT_FOUND", "Communication thread not found");
    }

    // Auto mark inbound messages as read if requested
    if (options?.markAsRead) {
      let changed = false;
      thread.messages.forEach((msg) => {
        if (msg.direction === "inbound" && msg.status !== "read") {
          msg.status = "read";
          changed = true;
        }
      });
      if (changed) {
        await thread.save();
      }
    }

    return thread;
  }

  /**
   * Send an outbound reply to an existing thread via provider adapter
   */
  async sendReply(
    threadId: string,
    replyData: SendReplyDto,
    authorUser?: any
  ): Promise<ICommThread> {
    const thread = await this.getThreadById(threadId);

    // 1. Resolve counterparty recipient
    let recipient = replyData.to?.trim();
    if (!recipient) {
      // Find the last inbound message from
      const inboundMessages = thread.messages
        .filter((m) => m.direction === "inbound")
        .reverse();

      if (inboundMessages.length > 0 && inboundMessages[0].from) {
        recipient = inboundMessages[0].from;
      } else if (thread.channel === "email") {
        recipient =
          (thread.contactId as any)?.email || (thread.leadId as any)?.email;
      } else {
        recipient =
          (thread.contactId as any)?.phone || (thread.leadId as any)?.phone;
      }
    }

    if (!recipient) {
      throw new AppError(
        400,
        "CANNOT_RESOLVE_RECIPIENT",
        "Could not determine destination recipient for reply message."
      );
    }

    let providerMessageId = `msg-${Date.now()}`;

    // 2. Dispatch Outbound Message via Provider Adapter
    if (thread.channel === "email") {
      const emailProvider = await EmailProviderFactory.getActiveProvider();
      const subject =
        replyData.subject ||
        (thread.subject?.startsWith("Re:")
          ? thread.subject
          : `Re: ${thread.subject || "Outreach follow-up"}`);

      const sendResult = await emailProvider.sendMail({
        to: [recipient],
        from: authorUser?.email || "outreach@talnova.io",
        subject,
        html: `<p>${replyData.body.replace(/\n/g, "<br/>")}</p>`,
        text: replyData.body,
      });

      if (sendResult.messageId) {
        providerMessageId = sendResult.messageId;
      }
    } else {
      // WhatsApp
      const normalizedPhone = normalizeToE164(recipient);
      const waProvider = await WhatsAppProviderFactory.getActiveProvider();

      let sendResult;
      if (typeof waProvider.sendTextMessage === "function") {
        sendResult = await waProvider.sendTextMessage(normalizedPhone, replyData.body);
      } else {
        sendResult = await waProvider.sendTemplateMessage({
          to: normalizedPhone,
          templateName: "enterprise_support_reply",
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: replyData.body }],
            },
          ],
        });
      }

      if (sendResult.messageId) {
        providerMessageId = sendResult.messageId;
      }
    }

    // 3. Append to thread messages
    const outboundMessage: ICommMessage = {
      channel: thread.channel,
      direction: "outbound",
      from: authorUser?.email || "outreach@talnova.io",
      to: [recipient],
      subject: replyData.subject || thread.subject,
      body: replyData.body,
      status: "sent",
      providerMessageId,
      sentAt: new Date(),
      metadata: {
        sentByUserId: authorUser?._id,
        sentByName: authorUser?.name || "System Admin",
      },
    };

    thread.messages.push(outboundMessage);
    thread.lastMessageSnippet = replyData.body.slice(0, 120);
    thread.lastMessageAt = new Date();

    // Update status to pending (awaiting customer response) or user specified
    if (replyData.status) {
      thread.status = replyData.status;
    } else if (thread.status === "open") {
      thread.status = "pending";
    }

    await thread.save();
    return this.getThreadById(thread._id.toString());
  }

  /**
   * Update thread status, owner assignment, or entity linkages
   */
  async updateThread(
    threadId: string,
    updates: UpdateThreadDto
  ): Promise<ICommThread> {
    const thread = await this.getThreadById(threadId);

    if (updates.status !== undefined) {
      thread.status = updates.status;
    }

    if (updates.assignedTo !== undefined) {
      thread.assignedTo = updates.assignedTo
        ? new mongoose.Types.ObjectId(updates.assignedTo)
        : undefined;
    }

    if (updates.leadId !== undefined) {
      thread.leadId = updates.leadId
        ? new mongoose.Types.ObjectId(updates.leadId)
        : undefined;
    }

    if (updates.contactId !== undefined) {
      thread.contactId = updates.contactId
        ? new mongoose.Types.ObjectId(updates.contactId)
        : undefined;
    }

    if (updates.companyId !== undefined) {
      thread.companyId = updates.companyId
        ? new mongoose.Types.ObjectId(updates.companyId)
        : undefined;
    }

    if (updates.dealId !== undefined) {
      thread.dealId = updates.dealId
        ? new mongoose.Types.ObjectId(updates.dealId)
        : undefined;
    }

    await thread.save();
    return this.getThreadById(thread._id.toString());
  }

  /**
   * Mark all unread messages in thread as read
   */
  async markThreadRead(threadId: string): Promise<ICommThread> {
    return this.getThreadById(threadId, { markAsRead: true });
  }

  /**
   * Create a new outbound communication thread and dispatch initial message
   */
  async createThread(
    payload: CreateThreadDto,
    authorUser?: any
  ): Promise<ICommThread> {
    let leadId = payload.leadId
      ? new mongoose.Types.ObjectId(payload.leadId)
      : undefined;
    let contactId = payload.contactId
      ? new mongoose.Types.ObjectId(payload.contactId)
      : undefined;
    let companyId = payload.companyId
      ? new mongoose.Types.ObjectId(payload.companyId)
      : undefined;
    let dealId = payload.dealId
      ? new mongoose.Types.ObjectId(payload.dealId)
      : undefined;

    // Automatic Entity Linkage Resolution based on recipient
    if (!leadId && !contactId) {
      if (payload.channel === "email") {
        const normalized = payload.recipient.toLowerCase().trim();
        const foundLead = await Lead.findOne({ normalizedEmail: normalized });
        if (foundLead) {
          leadId = foundLead._id;
          if (!companyId && foundLead.convertedTo?.companyId) {
            companyId = foundLead.convertedTo.companyId;
          } else if (!companyId && foundLead.companyName) {
            const matchedCo = await Company.findOne({ name: new RegExp(`^${foundLead.companyName.trim()}$`, "i") });
            if (matchedCo) companyId = matchedCo._id;
          }
        } else {
          const foundContact = await Contact.findOne({ normalizedEmail: normalized });
          if (foundContact) {
            contactId = foundContact._id;
            companyId = companyId || foundContact.companyId;
          }
        }
      } else {
        // WhatsApp
        const clean = payload.recipient.replace(/[\s\-\(\)\.]/g, "");
        const foundLead = await Lead.findOne({
          $or: [{ phone: clean }, { whatsapp: clean }, { normalizedPhone: clean }],
        });
        if (foundLead) {
          leadId = foundLead._id;
          if (!companyId && foundLead.convertedTo?.companyId) {
            companyId = foundLead.convertedTo.companyId;
          } else if (!companyId && foundLead.companyName) {
            const matchedCo = await Company.findOne({ name: new RegExp(`^${foundLead.companyName.trim()}$`, "i") });
            if (matchedCo) companyId = matchedCo._id;
          }
        } else {
          const foundContact = await Contact.findOne({
            $or: [{ phone: clean }, { whatsapp: clean }, { normalizedPhone: clean }],
          });
          if (foundContact) {
            contactId = foundContact._id;
            companyId = companyId || foundContact.companyId;
          }
        }
      }
    }

    // 1. Dispatch initial message
    let providerMessageId = `init-${Date.now()}`;
    if (payload.channel === "email") {
      const emailProvider = await EmailProviderFactory.getActiveProvider();
      const sendRes = await emailProvider.sendMail({
        to: [payload.recipient],
        from: authorUser?.email || "outreach@talnova.io",
        subject: payload.subject || "Message from Talnova",
        html: `<p>${payload.body.replace(/\n/g, "<br/>")}</p>`,
        text: payload.body,
      });
      if (sendRes.messageId) {
        providerMessageId = sendRes.messageId;
      }
    } else {
      const normalizedPhone = normalizeToE164(payload.recipient);
      const waProvider = await WhatsAppProviderFactory.getActiveProvider();
      let sendRes;
      if (typeof waProvider.sendTextMessage === "function") {
        sendRes = await waProvider.sendTextMessage(normalizedPhone, payload.body);
      } else {
        sendRes = await waProvider.sendTemplateMessage({
          to: normalizedPhone,
          templateName: "enterprise_support_reply",
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: payload.body }],
            },
          ],
        });
      }
      if (sendRes.messageId) {
        providerMessageId = sendRes.messageId;
      }
    }

    // 2. Persist new CommThread
    const newThread = new CommThread({
      channel: payload.channel,
      leadId,
      contactId,
      companyId,
      dealId,
      status: "pending",
      assignedTo: payload.assignedTo
        ? new mongoose.Types.ObjectId(payload.assignedTo)
        : authorUser?._id,
      subject: payload.subject || `Outbound ${payload.channel} to ${payload.recipient}`,
      lastMessageSnippet: payload.body.slice(0, 120),
      lastMessageAt: new Date(),
      messages: [
        {
          channel: payload.channel,
          direction: "outbound",
          from: authorUser?.email || "outreach@talnova.io",
          to: [payload.recipient],
          subject: payload.subject,
          body: payload.body,
          status: "sent",
          providerMessageId,
          sentAt: new Date(),
          metadata: {
            initiatedByUserId: authorUser?._id,
            initiatedByName: authorUser?.name || "System Admin",
          },
        },
      ],
    });

    await newThread.save();
    return this.getThreadById(newThread._id.toString());
  }
}

export default InboxService;
