import mongoose from "mongoose";
import { Campaign, ICampaign, ICampaignRecipient } from "../models/campaign.model.js";
import { QueueService } from "../../../infrastructure/queue/queue.service.js";
import { CampaignBatchJobData } from "../workers/campaign.worker.js";
import AudienceSegmentationService from "./audience-segmentation.service.js";
import AppError from "../../../common/errors/app-error.js";

export interface LaunchCampaignOptions {
  batchSize?: number;
  rateLimitPerSecond?: number;
}

export interface LaunchCampaignResult {
  campaignId: string;
  status: "sending" | "completed";
  totalBatches: number;
  totalRecipients: number;
  pendingCount: number;
}

export class CampaignDispatcherService {
  private readonly audienceService = new AudienceSegmentationService();

  /**
   * Launch a campaign for background batch execution with rate limiting and pause/cancel awareness
   */
  public async launchCampaign(
    campaignId: string,
    options?: LaunchCampaignOptions
  ): Promise<LaunchCampaignResult> {
    if (!mongoose.isValidObjectId(campaignId)) {
      throw new AppError(400, "INVALID_ID", "Invalid campaign ID");
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new AppError(404, "NOT_FOUND", "Campaign not found");
    }

    if (!["draft", "scheduled", "paused"].includes(campaign.status)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        `Cannot launch campaign with status "${campaign.status}". Only draft, scheduled, or paused campaigns can be launched.`
      );
    }

    // Auto-resolve recipients if none populated but audienceFilter exists
    if (!campaign.recipients || campaign.recipients.length === 0) {
      if (campaign.audienceFilter) {
        const resolved = await this.audienceService.resolveAudienceRecipients({
          target: (campaign.audienceFilter as any)?.target || "leads",
          channel: campaign.channel,
          ...(campaign.audienceFilter as any),
        });

        campaign.recipients = resolved.recipients as any;
        campaign.stats.totalRecipients = campaign.recipients.length;
      }

      if (!campaign.recipients || campaign.recipients.length === 0) {
        throw new AppError(
          400,
          "NO_RECIPIENTS",
          "Campaign has no recipients and no matching audience to dispatch."
        );
      }
    }

    // Filter recipients awaiting dispatch
    const pendingRecipients = campaign.recipients.filter((r) => r.status === "pending");

    if (pendingRecipients.length === 0) {
      campaign.status = "completed";
      campaign.completedAt = new Date();
      await campaign.save();

      return {
        campaignId: campaign._id.toString(),
        status: "completed",
        totalBatches: 0,
        totalRecipients: campaign.stats.totalRecipients,
        pendingCount: 0,
      };
    }

    const batchSize = Math.max(1, options?.batchSize || 50);
    // Rate limit defaults: 14 msg/sec for email (SES sandbox default), 50 msg/sec for WhatsApp
    const defaultRate = campaign.channel === "email" ? 14 : 50;
    const rateLimit = Math.max(1, options?.rateLimitPerSecond || defaultRate);

    // Partition pending recipients into batches
    const batches: ICampaignRecipient[][] = [];
    for (let i = 0; i < pendingRecipients.length; i += batchSize) {
      batches.push(pendingRecipients.slice(i, i + batchSize));
    }

    const queue = QueueService.getInstance();
    const organizationId = campaign.createdBy?.toString() || "system";

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      // Delay each batch proportionally to enforce provider rate limits
      const delayMs = Math.floor(((batchIndex * batchSize) / rateLimit) * 1000);

      const recipientIds = batch.map((r: any) =>
        r._id ? r._id.toString() : r.recipientEmail || r.recipientPhone || ""
      );

      await queue.enqueue<CampaignBatchJobData>(
        "sales:campaign:dispatch_batch",
        {
          campaignId: campaign._id.toString(),
          batchIndex,
          recipientIds,
        },
        {
          organizationId,
          delayMs,
          idempotencyKey: `camp-${campaign._id.toString()}-b${batchIndex}-${Date.now()}`,
        }
      );
    }

    campaign.status = "sending";
    campaign.startedAt = campaign.startedAt || new Date();
    await campaign.save();

    return {
      campaignId: campaign._id.toString(),
      status: "sending",
      totalBatches: batches.length,
      totalRecipients: campaign.stats.totalRecipients,
      pendingCount: pendingRecipients.length,
    };
  }

  /**
   * Pause an actively sending campaign immediately
   */
  public async pauseCampaign(campaignId: string): Promise<ICampaign> {
    if (!mongoose.isValidObjectId(campaignId)) {
      throw new AppError(400, "INVALID_ID", "Invalid campaign ID");
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new AppError(404, "NOT_FOUND", "Campaign not found");
    }

    if (campaign.status !== "sending") {
      throw new AppError(
        400,
        "INVALID_STATE",
        `Cannot pause campaign with status "${campaign.status}". Only active campaigns in "sending" status can be paused.`
      );
    }

    campaign.status = "paused";
    await campaign.save();
    return campaign;
  }

  /**
   * Resume dispatching a previously paused campaign
   */
  public async resumeCampaign(
    campaignId: string,
    options?: LaunchCampaignOptions
  ): Promise<LaunchCampaignResult> {
    if (!mongoose.isValidObjectId(campaignId)) {
      throw new AppError(400, "INVALID_ID", "Invalid campaign ID");
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new AppError(404, "NOT_FOUND", "Campaign not found");
    }

    if (campaign.status !== "paused") {
      throw new AppError(
        400,
        "INVALID_STATE",
        `Cannot resume campaign with status "${campaign.status}". Only paused campaigns can be resumed.`
      );
    }

    return this.launchCampaign(campaignId, options);
  }

  /**
   * Cancel an active or queued campaign
   */
  public async cancelCampaign(campaignId: string): Promise<ICampaign> {
    if (!mongoose.isValidObjectId(campaignId)) {
      throw new AppError(400, "INVALID_ID", "Invalid campaign ID");
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new AppError(404, "NOT_FOUND", "Campaign not found");
    }

    if (campaign.status === "completed") {
      throw new AppError(400, "INVALID_STATE", "Completed campaigns cannot be cancelled.");
    }

    campaign.status = "cancelled";
    await campaign.save();
    return campaign;
  }

  /**
   * Check real-time progress and delivery stats of a campaign
   */
  public async getCampaignExecutionStatus(campaignId: string) {
    if (!mongoose.isValidObjectId(campaignId)) {
      throw new AppError(400, "INVALID_ID", "Invalid campaign ID");
    }

    const campaign = await Campaign.findById(campaignId).lean();
    if (!campaign) {
      throw new AppError(404, "NOT_FOUND", "Campaign not found");
    }

    const total = campaign.stats.totalRecipients || (campaign.recipients || []).length;
    const sent = campaign.stats.sentCount || 0;
    const failed = campaign.stats.failedCount || 0;
    const pending = Math.max(0, total - (sent + failed));
    const progressPercent = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;

    return {
      campaignId: campaign._id.toString(),
      status: campaign.status,
      stats: campaign.stats,
      totalRecipients: total,
      sentCount: sent,
      failedCount: failed,
      pendingCount: pending,
      progressPercent,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
    };
  }
}

export default CampaignDispatcherService;
