import mongoose from "mongoose";
import { Campaign, ICampaign, ICampaignRecipient } from "../models/campaign.model.js";
import { CampaignTemplate, ICampaignTemplate } from "../models/campaign-template.model.js";
import { Lead } from "../models/lead.model.js";
import { Contact } from "../models/contact.model.js";
import { Company } from "../models/company.model.js";
import AppError from "../../../common/errors/app-error.js";
import AudienceSegmentationService from "./audience-segmentation.service.js";
import {
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignQueryParams,
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateQueryParams,
  PreviewTemplateInput,
  CloneCampaignInput,
} from "../schemas/campaign.schemas.js";

export interface InterpolationResult {
  text: string;
  missingVariables: string[];
}

export class CampaignService {
  /**
   * Core interpolation engine that replaces {{var}} and {{var|fallback}}
   */
  public interpolateText(
    template: string,
    variables: Record<string, any>,
    defaultFallback = ""
  ): InterpolationResult {
    if (!template) {
      return { text: "", missingVariables: [] };
    }

    const missingVariables: string[] = [];
    const regex = /\{\{\s*([a-zA-Z0-9_.-]+)(?:\|([^}]+))?\s*\}\}/g;

    const text = template.replace(regex, (_, key, tagFallback) => {
      // Resolve dotted or simple key
      const keys = key.split(".");
      let val: any = variables;
      for (const k of keys) {
        if (val !== undefined && val !== null && typeof val === "object" && k in val) {
          val = val[k];
        } else {
          val = undefined;
          break;
        }
      }

      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val);
      }

      // Check tag-level fallback, then defaultFallback
      if (tagFallback !== undefined) {
        return tagFallback;
      }

      missingVariables.push(key);
      return defaultFallback;
    });

    return {
      text,
      missingVariables: Array.from(new Set(missingVariables)),
    };
  }

  /**
   * Helper to build merge variables from contact or lead records
   */
  public async buildMergeVariables(options: {
    leadId?: string;
    contactId?: string;
    sampleVariables?: Record<string, any>;
  }): Promise<Record<string, any>> {
    const vars: Record<string, any> = {
      productName: "Talnova",
      currentYear: new Date().getFullYear().toString(),
      ctaUrl: "https://talnova.io",
      unsubscribeUrl: "https://talnova.io/unsubscribe",
      ...options.sampleVariables,
    };

    if (options.leadId && mongoose.isValidObjectId(options.leadId)) {
      const lead = await Lead.findById(options.leadId).lean();
      if (lead) {
        const nameParts = (lead.name || "").trim().split(" ");
        vars.firstName = vars.firstName || nameParts[0] || "";
        vars.lastName = vars.lastName || nameParts.slice(1).join(" ") || "";
        vars.fullName = vars.fullName || lead.name || "";
        vars.email = vars.email || lead.email || "";
        vars.phone = vars.phone || lead.phone || lead.whatsapp || "";
        vars.companyName = vars.companyName || lead.companyName || "";
        vars.jobTitle = vars.jobTitle || lead.jobTitle || "";
        vars.industry = vars.industry || lead.industry || "";
      }
    }

    if (options.contactId && mongoose.isValidObjectId(options.contactId)) {
      const contact = await Contact.findById(options.contactId).lean();
      if (contact) {
        vars.firstName = vars.firstName || contact.firstName || "";
        vars.lastName = vars.lastName || contact.lastName || "";
        vars.fullName = vars.fullName || contact.fullName || `${contact.firstName} ${contact.lastName}`.trim();
        vars.email = vars.email || contact.email || "";
        vars.phone = vars.phone || contact.phone || contact.whatsapp || "";
        vars.jobTitle = vars.jobTitle || contact.jobTitle || "";

        if (contact.companyId && !vars.companyName) {
          const company = await Company.findById(contact.companyId).lean();
          if (company) {
            vars.companyName = company.name;
          }
        }
      }
    }

    return vars;
  }

  // ==========================================
  // CAMPAIGN METHODS
  // ==========================================

  public async getCampaigns(params: CampaignQueryParams) {
    const filter: Record<string, any> = {};

    if (params.search) {
      const escaped = params.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { subject: { $regex: escaped, $options: "i" } },
        { tags: { $regex: escaped, $options: "i" } },
      ];
    }

    if (params.channel) {
      filter.channel = params.channel;
    }

    if (params.status) {
      filter.status = params.status;
    }

    if (params.tag) {
      filter.tags = params.tag;
    }

    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const sortField = params.sortBy || "createdAt";
    const sortDirection = params.sortOrder === "asc" ? 1 : -1;

    const [items, total, statsAgg] = await Promise.all([
      Campaign.find(filter)
        .populate("templateId", "name channel subject whatsappTemplateName")
        .populate("createdBy", "name email")
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      Campaign.countDocuments(filter),
      Campaign.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statusCounters: Record<string, number> = {
      all: total,
      draft: 0,
      scheduled: 0,
      sending: 0,
      paused: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const s of statsAgg) {
      if (s._id in statusCounters) {
        statusCounters[s._id] = s.count;
      }
    }

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusCounters,
    };
  }

  public async getCampaignById(id: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(400, "INVALID_ID", "Invalid campaign ID");
    }

    const campaign = await Campaign.findById(id)
      .populate("templateId")
      .populate("createdBy", "name email")
      .lean();

    if (!campaign) {
      throw new AppError(404, "NOT_FOUND", "Campaign not found");
    }

    return campaign;
  }

  public async createCampaign(dto: CreateCampaignInput, creatorId: string) {
    let template: ICampaignTemplate | null = null;

    if (dto.templateId) {
      if (!mongoose.isValidObjectId(dto.templateId)) {
        throw new AppError(400, "INVALID_TEMPLATE_ID", "Invalid templateId format");
      }
      template = await CampaignTemplate.findById(dto.templateId);
      if (!template) {
        throw new AppError(404, "TEMPLATE_NOT_FOUND", "Selected template was not found");
      }
      if (template.channel !== dto.channel) {
        throw new AppError(
          400,
          "CHANNEL_MISMATCH",
          `Template channel (${template.channel}) does not match campaign channel (${dto.channel})`
        );
      }
    }

    // Determine initial status
    let initialStatus: ICampaign["status"] = "draft";
    if (dto.scheduledAt) {
      const schedDate = new Date(dto.scheduledAt);
      if (!isNaN(schedDate.getTime()) && schedDate > new Date()) {
        initialStatus = "scheduled";
      }
    }

    let recipients: ICampaignRecipient[] = [];

    if (dto.recipients && dto.recipients.length > 0) {
      recipients = dto.recipients.map((r) => ({
        contactId: r.contactId && mongoose.isValidObjectId(r.contactId) ? new mongoose.Types.ObjectId(r.contactId) : undefined,
        leadId: r.leadId && mongoose.isValidObjectId(r.leadId) ? new mongoose.Types.ObjectId(r.leadId) : undefined,
        recipientEmail: r.recipientEmail,
        recipientPhone: r.recipientPhone,
        recipientName: r.recipientName,
        status: "pending",
      }));
    } else if (dto.audienceFilter) {
      const audienceService = new AudienceSegmentationService();
      const resolved = await audienceService.resolveAudienceRecipients({
        target: "leads",
        channel: dto.channel,
        ...(dto.audienceFilter as any),
      });
      recipients = resolved.recipients;
    }

    const campaign = new Campaign({
      name: dto.name,
      description: dto.description,
      channel: dto.channel,
      status: initialStatus,
      templateId: dto.templateId ? new mongoose.Types.ObjectId(dto.templateId) : undefined,
      subject: dto.subject || template?.subject,
      previewText: dto.previewText || template?.previewText,
      content: dto.content || template?.htmlContent || template?.plainTextContent,
      whatsappTemplateName: dto.whatsappTemplateName || template?.whatsappTemplateName,
      whatsappLanguageCode: dto.whatsappLanguageCode || template?.whatsappLanguageCode || "en",
      whatsappParameters: dto.whatsappParameters,
      audienceFilter: dto.audienceFilter,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      createdBy: new mongoose.Types.ObjectId(creatorId),
      stats: {
        totalRecipients: recipients.length,
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        bouncedCount: 0,
        repliedCount: 0,
        failedCount: 0,
      },
      recipients,
      tags: dto.tags || [],
    });

    await campaign.save();
    return campaign;
  }

  public async updateCampaign(id: string, dto: UpdateCampaignInput, _actorId: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(400, "INVALID_ID", "Invalid campaign ID");
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      throw new AppError(404, "NOT_FOUND", "Campaign not found");
    }

    if (!["draft", "scheduled", "paused"].includes(campaign.status)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        `Cannot update campaign with active status "${campaign.status}". Only draft, scheduled, or paused campaigns can be modified.`
      );
    }

    if (dto.templateId) {
      if (!mongoose.isValidObjectId(dto.templateId)) {
        throw new AppError(400, "INVALID_TEMPLATE_ID", "Invalid templateId format");
      }
      const template = await CampaignTemplate.findById(dto.templateId);
      if (!template) {
        throw new AppError(404, "TEMPLATE_NOT_FOUND", "Selected template was not found");
      }
      if (template.channel !== campaign.channel) {
        throw new AppError(
          400,
          "CHANNEL_MISMATCH",
          `Template channel (${template.channel}) does not match campaign channel (${campaign.channel})`
        );
      }
      campaign.templateId = new mongoose.Types.ObjectId(dto.templateId);
    } else if (dto.templateId === null) {
      campaign.templateId = undefined;
    }

    if (dto.name !== undefined) campaign.name = dto.name;
    if (dto.description !== undefined) campaign.description = dto.description ?? undefined;
    if (dto.subject !== undefined) campaign.subject = dto.subject ?? undefined;
    if (dto.previewText !== undefined) campaign.previewText = dto.previewText ?? undefined;
    if (dto.content !== undefined) campaign.content = dto.content ?? undefined;
    if (dto.whatsappTemplateName !== undefined) campaign.whatsappTemplateName = dto.whatsappTemplateName ?? undefined;
    if (dto.whatsappLanguageCode !== undefined) campaign.whatsappLanguageCode = dto.whatsappLanguageCode;
    if (dto.whatsappParameters !== undefined) campaign.whatsappParameters = dto.whatsappParameters ?? undefined;
    if (dto.audienceFilter !== undefined) campaign.audienceFilter = dto.audienceFilter ?? undefined;
    if (dto.tags !== undefined) campaign.tags = dto.tags;

    if (dto.scheduledAt !== undefined) {
      if (dto.scheduledAt) {
        const schedDate = new Date(dto.scheduledAt);
        campaign.scheduledAt = schedDate;
        if (campaign.status === "draft" && schedDate > new Date()) {
          campaign.status = "scheduled";
        }
      } else {
        campaign.scheduledAt = undefined;
        if (campaign.status === "scheduled") {
          campaign.status = "draft";
        }
      }
    }

    await campaign.save();
    return campaign;
  }

  public async updateCampaignStatus(
    id: string,
    newStatus: "draft" | "scheduled" | "sending" | "paused" | "completed" | "cancelled",
    _actorId: string
  ) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(400, "INVALID_ID", "Invalid campaign ID");
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      throw new AppError(404, "NOT_FOUND", "Campaign not found");
    }

    const current = campaign.status;

    // Allowed transition map
    const allowedTransitions: Record<string, string[]> = {
      draft: ["scheduled", "cancelled"],
      scheduled: ["draft", "sending", "cancelled"],
      sending: ["paused", "completed", "cancelled"],
      paused: ["sending", "cancelled"],
      completed: [],
      cancelled: [],
    };

    if (!allowedTransitions[current] || !allowedTransitions[current].includes(newStatus)) {
      throw new AppError(
        400,
        "INVALID_STATE_TRANSITION",
        `Transition from status "${current}" to "${newStatus}" is not permitted.`
      );
    }

    campaign.status = newStatus;

    if (newStatus === "sending" && !campaign.startedAt) {
      campaign.startedAt = new Date();
    } else if (newStatus === "completed") {
      campaign.completedAt = new Date();
    }

    await campaign.save();
    return campaign;
  }

  public async cloneCampaign(id: string, dto: CloneCampaignInput, creatorId: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(400, "INVALID_ID", "Invalid campaign ID");
    }

    const source = await Campaign.findById(id);
    if (!source) {
      throw new AppError(404, "NOT_FOUND", "Source campaign not found");
    }

    const cloneName = dto.name?.trim() || `${source.name} (Copy)`;

    let clonedRecipients: ICampaignRecipient[] = [];
    if (dto.includeRecipients !== false && source.recipients && source.recipients.length > 0) {
      clonedRecipients = source.recipients.map((r) => ({
        contactId: r.contactId,
        leadId: r.leadId,
        recipientEmail: r.recipientEmail,
        recipientPhone: r.recipientPhone,
        recipientName: r.recipientName,
        status: "pending",
      }));
    }

    const cloned = new Campaign({
      name: cloneName,
      description: source.description,
      channel: source.channel,
      status: "draft",
      templateId: source.templateId,
      subject: source.subject,
      previewText: source.previewText,
      content: source.content,
      whatsappTemplateName: source.whatsappTemplateName,
      whatsappLanguageCode: source.whatsappLanguageCode,
      whatsappParameters: source.whatsappParameters,
      audienceFilter: source.audienceFilter,
      createdBy: new mongoose.Types.ObjectId(creatorId),
      stats: {
        totalRecipients: clonedRecipients.length,
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        bouncedCount: 0,
        repliedCount: 0,
        failedCount: 0,
      },
      recipients: clonedRecipients,
      tags: [...source.tags],
    });

    await cloned.save();
    return cloned;
  }

  public async addRecipients(
    id: string,
    recipientsInput: Array<{
      contactId?: string;
      leadId?: string;
      recipientEmail?: string;
      recipientPhone?: string;
      recipientName?: string;
    }>
  ) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(400, "INVALID_ID", "Invalid campaign ID");
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      throw new AppError(404, "NOT_FOUND", "Campaign not found");
    }

    if (!["draft", "scheduled", "paused"].includes(campaign.status)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        `Cannot add recipients to campaign in "${campaign.status}" state.`
      );
    }

    const newRecipients: ICampaignRecipient[] = recipientsInput.map((r) => ({
      contactId: r.contactId && mongoose.isValidObjectId(r.contactId) ? new mongoose.Types.ObjectId(r.contactId) : undefined,
      leadId: r.leadId && mongoose.isValidObjectId(r.leadId) ? new mongoose.Types.ObjectId(r.leadId) : undefined,
      recipientEmail: r.recipientEmail,
      recipientPhone: r.recipientPhone,
      recipientName: r.recipientName,
      status: "pending",
    }));

    campaign.recipients.push(...newRecipients);
    campaign.stats.totalRecipients = campaign.recipients.length;

    await campaign.save();
    return {
      totalRecipients: campaign.stats.totalRecipients,
      addedCount: newRecipients.length,
    };
  }

  public async deleteCampaign(id: string, _actorId: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(400, "INVALID_ID", "Invalid campaign ID");
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      throw new AppError(404, "NOT_FOUND", "Campaign not found");
    }

    if (campaign.status === "sending") {
      throw new AppError(400, "INVALID_STATE", "Cannot delete an active campaign currently in sending state");
    }

    await Campaign.findByIdAndDelete(id);
    return { deleted: true, id };
  }

  // ==========================================
  // TEMPLATE METHODS
  // ==========================================

  public async getTemplates(params: TemplateQueryParams) {
    const filter: Record<string, any> = {};

    if (params.search) {
      const escaped = params.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { subject: { $regex: escaped, $options: "i" } },
        { tags: { $regex: escaped, $options: "i" } },
      ];
    }

    if (params.channel) {
      filter.channel = params.channel;
    }

    if (params.tag) {
      filter.tags = params.tag;
    }

    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const sortField = params.sortBy || "createdAt";
    const sortDirection = params.sortOrder === "asc" ? 1 : -1;

    const [items, total] = await Promise.all([
      CampaignTemplate.find(filter)
        .populate("createdBy", "name email")
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      CampaignTemplate.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public async getTemplateById(id: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(400, "INVALID_ID", "Invalid template ID");
    }

    const template = await CampaignTemplate.findById(id)
      .populate("createdBy", "name email")
      .lean();

    if (!template) {
      throw new AppError(404, "NOT_FOUND", "Template not found");
    }

    return template;
  }

  public async createTemplate(dto: CreateTemplateInput, creatorId: string) {
    const template = new CampaignTemplate({
      name: dto.name,
      channel: dto.channel,
      subject: dto.subject,
      previewText: dto.previewText,
      htmlContent: dto.htmlContent,
      plainTextContent: dto.plainTextContent,
      whatsappTemplateName: dto.whatsappTemplateName,
      whatsappLanguageCode: dto.whatsappLanguageCode || "en",
      whatsappCategory: dto.whatsappCategory || "MARKETING",
      whatsappParameters: dto.whatsappParameters || [],
      tags: dto.tags || [],
      createdBy: new mongoose.Types.ObjectId(creatorId),
    });

    await template.save();
    return template;
  }

  public async updateTemplate(id: string, dto: UpdateTemplateInput, _actorId: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(400, "INVALID_ID", "Invalid template ID");
    }

    const template = await CampaignTemplate.findById(id);
    if (!template) {
      throw new AppError(404, "NOT_FOUND", "Template not found");
    }

    if (dto.name !== undefined) template.name = dto.name;
    if (dto.subject !== undefined) template.subject = dto.subject ?? undefined;
    if (dto.previewText !== undefined) template.previewText = dto.previewText ?? undefined;
    if (dto.htmlContent !== undefined) template.htmlContent = dto.htmlContent ?? undefined;
    if (dto.plainTextContent !== undefined) template.plainTextContent = dto.plainTextContent ?? undefined;
    if (dto.whatsappTemplateName !== undefined) template.whatsappTemplateName = dto.whatsappTemplateName ?? undefined;
    if (dto.whatsappLanguageCode !== undefined) template.whatsappLanguageCode = dto.whatsappLanguageCode;
    if (dto.whatsappCategory !== undefined) template.whatsappCategory = dto.whatsappCategory;
    if (dto.whatsappParameters !== undefined) template.whatsappParameters = dto.whatsappParameters;
    if (dto.tags !== undefined) template.tags = dto.tags;

    await template.save();
    return template;
  }

  public async deleteTemplate(id: string, _actorId: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(400, "INVALID_ID", "Invalid template ID");
    }

    const template = await CampaignTemplate.findById(id);
    if (!template) {
      throw new AppError(404, "NOT_FOUND", "Template not found");
    }

    // Check if active campaigns are referencing this template
    const activeCampaigns = await Campaign.countDocuments({
      templateId: template._id,
      status: { $in: ["draft", "scheduled", "sending", "paused"] },
    });

    if (activeCampaigns > 0) {
      throw new AppError(
        400,
        "TEMPLATE_IN_USE",
        `Cannot delete template because it is currently used by ${activeCampaigns} active campaign(s).`
      );
    }

    await CampaignTemplate.findByIdAndDelete(id);
    return { deleted: true, id };
  }

  public async previewTemplate(dto: PreviewTemplateInput) {
    let subject = dto.subject || "";
    let htmlContent = dto.htmlContent || "";
    let plainTextContent = dto.plainTextContent || "";

    if (dto.templateId) {
      if (!mongoose.isValidObjectId(dto.templateId)) {
        throw new AppError(400, "INVALID_ID", "Invalid template ID format");
      }
      const template = await CampaignTemplate.findById(dto.templateId);
      if (!template) {
        throw new AppError(404, "NOT_FOUND", "Template not found");
      }
      subject = subject || template.subject || "";
      htmlContent = htmlContent || template.htmlContent || "";
      plainTextContent = plainTextContent || template.plainTextContent || "";
    }

    const variables = await this.buildMergeVariables({
      leadId: dto.leadId,
      contactId: dto.contactId,
      sampleVariables: dto.sampleVariables,
    });

    const fallback = dto.defaultFallback ?? "";
    const subjectResult = this.interpolateText(subject, variables, fallback);
    const htmlResult = this.interpolateText(htmlContent, variables, fallback);
    const textResult = this.interpolateText(plainTextContent, variables, fallback);

    const allMissing = Array.from(
      new Set([
        ...subjectResult.missingVariables,
        ...htmlResult.missingVariables,
        ...textResult.missingVariables,
      ])
    );

    return {
      subject: subjectResult.text,
      htmlContent: htmlResult.text,
      plainTextContent: textResult.text,
      resolvedVariables: variables,
      missingVariables: allMissing,
    };
  }
}

export default CampaignService;
