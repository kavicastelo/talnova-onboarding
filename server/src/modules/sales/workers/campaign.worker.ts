import { Job } from "../../../infrastructure/queue/queue.service.js";
import Campaign from "../models/campaign.model.js";
import CampaignTemplate from "../models/campaign-template.model.js";
import Suppression from "../models/suppression.model.js";
import { EmailProviderFactory } from "../integrations/email/email.factory.js";
import { WhatsAppProviderFactory } from "../integrations/whatsapp/whatsapp.factory.js";
import CampaignService from "../services/campaign.service.js";
import SystemLogBuffer from "../../../infrastructure/telemetry/system-log-buffer.js";

export interface CampaignBatchJobData {
  campaignId: string;
  batchIndex: number;
  recipientIds: string[];
}

export async function processCampaignBatchJob(job: Job<CampaignBatchJobData>): Promise<void> {
  const { campaignId, batchIndex, recipientIds } = job.data;

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      SystemLogBuffer.record({
        level: "warning",
        source: "sales:campaign:worker",
        eventType: "CAMPAIGN_NOT_FOUND",
        description: `Campaign ${campaignId} not found during batch ${batchIndex} execution.`,
      });
      return;
    }

    // Check pause or cancel state before dispatching
    if (campaign.status === "paused" || campaign.status === "cancelled") {
      SystemLogBuffer.record({
        level: "info",
        source: "sales:campaign:worker",
        eventType: "CAMPAIGN_HALTED",
        description: `Campaign ${campaignId} execution halted due to status: ${campaign.status}.`,
      });
      return;
    }

    // Load template if associated
    let template: any = null;
    if (campaign.templateId) {
      template = await CampaignTemplate.findById(campaign.templateId).lean();
    }

    // Pre-fetch active suppressions for safety
    const suppressionType = campaign.channel === "email" ? "email" : "phone";
    const suppressions = await Suppression.find({ type: suppressionType }).select("identifier").lean();
    const suppressedSet = new Set(suppressions.map((s) => s.identifier.toLowerCase().trim()));

    const campaignService = new CampaignService();
    const emailProvider = campaign.channel === "email" ? await EmailProviderFactory.getActiveProvider() : null;
    const waProvider = campaign.channel === "whatsapp" ? await WhatsAppProviderFactory.getActiveProvider() : null;

    let processedCount = 0;

    // Normalize whatsapp parameters to a flat object
    const rawWaParams: Record<string, string> = {};
    if (campaign.whatsappParameters) {
      if (campaign.whatsappParameters instanceof Map) {
        campaign.whatsappParameters.forEach((val: string, key: string) => {
          rawWaParams[key] = val;
        });
      } else if (typeof campaign.whatsappParameters === "object") {
        Object.assign(rawWaParams, campaign.whatsappParameters);
      }
    }

    for (const recipientId of recipientIds) {
      // Re-verify campaign status hasn't been flipped mid-batch
      const currentCampaignCheck = await Campaign.findById(campaignId).select("status").lean();
      if (currentCampaignCheck?.status === "paused" || currentCampaignCheck?.status === "cancelled") {
        campaign.status = currentCampaignCheck.status;
        break;
      }

      const targetStr = recipientId.toString();
      const recipient = campaign.recipients.find(
        (r: any) =>
          r._id?.toString() === targetStr ||
          r.contactId?.toString() === targetStr ||
          r.leadId?.toString() === targetStr ||
          r.recipientEmail === targetStr ||
          r.recipientPhone === targetStr
      );

      if (!recipient || recipient.status !== "pending") {
        continue;
      }

      // Check suppression list
      const identifier =
        campaign.channel === "email"
          ? (recipient.recipientEmail || "").toLowerCase().trim()
          : (recipient.recipientPhone || "").toLowerCase().trim();

      if (suppressedSet.has(identifier)) {
        recipient.status = "failed";
        recipient.errorMessage = "Suppressed: recipient is in global suppression list";
        campaign.stats.failedCount++;
        processedCount++;
        continue;
      }

      // Build merge variables for recipient
      const variables = await campaignService.buildMergeVariables({
        leadId: recipient.leadId?.toString(),
        contactId: recipient.contactId?.toString(),
        sampleVariables: rawWaParams,
      });

      if (recipient.recipientName && !variables.firstName) {
        variables.firstName = recipient.recipientName.split(" ")[0];
        variables.fullName = recipient.recipientName;
      }
      if (recipient.recipientEmail && !variables.email) {
        variables.email = recipient.recipientEmail;
      }
      if (recipient.recipientPhone && !variables.phone) {
        variables.phone = recipient.recipientPhone;
      }

      if (campaign.channel === "email" && emailProvider) {
        if (!recipient.recipientEmail) {
          recipient.status = "failed";
          recipient.errorMessage = "Missing recipient email address";
          campaign.stats.failedCount++;
          processedCount++;
          continue;
        }

        const rawSubject = campaign.subject || template?.subject || "Update from Talnova";
        const rawContent = campaign.content || template?.htmlContent || template?.plainTextContent || "";
        const rawPreview = campaign.previewText || template?.previewText || "";

        const subject = campaignService.interpolateText(rawSubject, variables).text;
        const html = campaignService.interpolateText(rawContent, variables).text;
        const text = campaignService.interpolateText(rawPreview || rawContent, variables).text;

        const emailTags: Record<string, string> = {
          campaignId: campaign._id.toString(),
          channel: "email",
        };
        if (campaign.tags && Array.isArray(campaign.tags)) {
          campaign.tags.slice(0, 5).forEach((t, i) => {
            emailTags[`tag_${i}`] = t;
          });
        }

        try {
          const result = await emailProvider.sendMail({
            to: recipient.recipientEmail,
            subject,
            html,
            text,
            tags: emailTags,
            campaignId: campaign._id.toString(),
            leadId: recipient.leadId?.toString(),
            contactId: recipient.contactId?.toString(),
          });

          recipient.status = "sent";
          recipient.providerMessageId = result.messageId;
          recipient.sentAt = new Date();
          campaign.stats.sentCount++;
        } catch (error: any) {
          recipient.status = "failed";
          recipient.errorMessage = error?.message || String(error);
          campaign.stats.failedCount++;
        }
      } else if (campaign.channel === "whatsapp" && waProvider) {
        if (!recipient.recipientPhone) {
          recipient.status = "failed";
          recipient.errorMessage = "Missing recipient phone number";
          campaign.stats.failedCount++;
          processedCount++;
          continue;
        }

        const templateName = campaign.whatsappTemplateName || template?.whatsappTemplateName;
        const languageCode = campaign.whatsappLanguageCode || template?.whatsappLanguageCode || "en";

        try {
          let result;
          if (templateName) {
            let parameterValues: string[] = [];
            const paramKeys = Object.keys(rawWaParams);
            if (paramKeys.length > 0) {
              parameterValues = paramKeys.map(
                (k) => campaignService.interpolateText(rawWaParams[k] || `{{${k}}}`, variables).text
              );
            } else {
              parameterValues = [variables.firstName || recipient.recipientName || "Customer"];
            }

            result = await waProvider.sendTemplateMessage({
              to: recipient.recipientPhone,
              templateName,
              languageCode,
              components: [
                {
                  type: "body",
                  parameters: parameterValues.map((p) => ({
                    type: "text",
                    text: p,
                  })),
                },
              ],
              campaignId: campaign._id.toString(),
              leadId: recipient.leadId?.toString(),
              contactId: recipient.contactId?.toString(),
            });
          } else if (waProvider.sendTextMessage) {
            const rawContent = campaign.content || template?.plainTextContent || "Hello from Talnova";
            const textContent = campaignService.interpolateText(rawContent, variables).text;

            result = await waProvider.sendTextMessage(recipient.recipientPhone, textContent);
          } else {
            throw new Error("WhatsApp provider does not support raw text sending without an approved template");
          }

          recipient.status = "sent";
          recipient.providerMessageId = result.messageId;
          recipient.sentAt = new Date();
          campaign.stats.sentCount++;
        } catch (error: any) {
          recipient.status = "failed";
          recipient.errorMessage = error?.message || String(error);
          campaign.stats.failedCount++;
        }
      }

      processedCount++;
    }

    // Determine if all recipients are processed
    const remainingPending = campaign.recipients.filter((r) => r.status === "pending").length;
    if (remainingPending === 0) {
      campaign.status = "completed";
      campaign.completedAt = new Date();
    } else if (campaign.status !== "paused" && campaign.status !== "cancelled") {
      campaign.status = "sending";
    }

    campaign.markModified("recipients");
    campaign.markModified("stats");
    await campaign.save();

    SystemLogBuffer.record({
      level: "info",
      source: "sales:campaign:worker",
      eventType: "CAMPAIGN_BATCH_PROCESSED",
      description: `Campaign ${campaignId} batch ${batchIndex} processed (${processedCount} recipients).`,
      metadata: {
        campaignId,
        batchIndex,
        processedCount,
        sentCount: campaign.stats.sentCount,
        failedCount: campaign.stats.failedCount,
        status: campaign.status,
      },
    });
  } catch (error: any) {
    SystemLogBuffer.record({
      level: "critical",
      source: "sales:campaign:worker",
      eventType: "CAMPAIGN_BATCH_ERROR",
      description: `Error executing batch ${batchIndex} for campaign ${campaignId}: ${error.message}`,
      metadata: { campaignId, batchIndex, error: error.message },
    });
    throw error;
  }
}

export default processCampaignBatchJob;
