import mongoose from "mongoose";
import KnowledgeGap, { IKnowledgeGap } from "../models/knowledge-gap.model.js";
import User from "../../auth/models/user.model.js";
import { NotificationService } from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import OrganizationIntegrationService from "../../integrations/services/organization-integration.service.js";
import KnowledgeIndexingService from "./knowledge-indexing.service.js";

export class KnowledgeGapService {
  private notificationService: NotificationService;
  private integrationService: OrganizationIntegrationService;
  private indexingService: KnowledgeIndexingService;

  constructor() {
    this.notificationService = new NotificationService(new NotificationRepository());
    this.integrationService = new OrganizationIntegrationService();
    this.indexingService = new KnowledgeIndexingService();
  }

  /**
   * Normalize user question string to detect semantic duplicate questions.
   */
  normalizeQuestion(text: string): string {
    const STOP_WORDS = new Set([
      "what", "is", "the", "for", "our", "company", "policy", "guidelines", "rules",
      "tell", "me", "about", "how", "do", "does", "can", "we", "i", "a", "an", "of",
      "in", "at", "to", "on", "please"
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    return words.sort().join(" ") || text.toLowerCase().trim();
  }

  /**
   * Record a missing knowledge query, deduplicating identical questions and alerting administrators.
   */
  async recordGap(data: {
    organizationId: string | mongoose.Types.ObjectId;
    userId: string | mongoose.Types.ObjectId;
    question: string;
    category?: string;
  }): Promise<IKnowledgeGap> {
    const orgObjectId = new mongoose.Types.ObjectId(data.organizationId.toString());
    const userObjectId = new mongoose.Types.ObjectId(data.userId.toString());
    const normalized = this.normalizeQuestion(data.question);

    // Check for existing unresolved gap
    let gap = await KnowledgeGap.findOne({
      organizationId: orgObjectId,
      status: "unresolved",
      normalizedQuestion: normalized,
    });

    if (gap) {
      gap.occurrenceCount += 1;
      if (!gap.requestedBy.some((id) => id.toString() === userObjectId.toString())) {
        gap.requestedBy.push(userObjectId);
      }
      gap.lastAskedAt = new Date();
      await gap.save();
      return gap;
    }

    // New Knowledge Gap
    gap = await KnowledgeGap.create({
      organizationId: orgObjectId,
      question: data.question,
      normalizedQuestion: normalized,
      category: data.category || "Company Policy",
      occurrenceCount: 1,
      requestedBy: [userObjectId],
      status: "unresolved",
      priority: "medium",
      lastAskedAt: new Date(),
    });

    // Alert organization administrators
    this.notifyAdminsOfGap(orgObjectId, data.question).catch((err) => {
      console.warn("[KnowledgeGapService] Admin notification failed:", err.message);
    });

    return gap;
  }

  /**
   * Dispatch in-app notifications and tenant-configured email to organization admins.
   */
  private async notifyAdminsOfGap(orgId: mongoose.Types.ObjectId, question: string) {
    const admins = await User.find({
      organizationId: orgId,
      "permissions.role": { $in: ["admin", "owner"] },
      isDeleted: { $ne: true },
    }).select("auth.email profile.firstName");

    for (const admin of admins) {
      // 1. In-App Notification
      await this.notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: admin._id,
        type: "knowledge_update",
        channel: "in_app",
        title: "Missing Knowledge Gap Flagged",
        message: `A team member asked: "${question}". No matching company policy was found. Click to review and add an answer.`,
        priority: "medium",
        data: { deepLink: "/kb" },
      });

      // 2. Tenant Email Delivery (if configured)
      try {
        const emailClient = await this.integrationService.getActiveEmailClient(orgId);
        if (emailClient && admin.auth?.email) {
          const subject = "Talnova: Team Question Needs Company Policy";
          const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #4f46e5;">Missing Knowledge Identified</h2>
              <p>Hello ${admin.profile?.firstName || "Admin"},</p>
              <p>An employee recently asked the following question, but no approved company resource was found:</p>
              <blockquote style="background: #f8fafc; border-left: 4px solid #4f46e5; margin: 16px 0; padding: 12px 16px; font-style: italic;">
                "${question}"
              </blockquote>
              <p>You can quickly provide an answer or publish a policy article in your Knowledge Base to make this information accessible to all employees.</p>
              <div style="margin: 25px 0;">
                <a href="http://localhost:5173/kb" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Resolve in Knowledge Base</a>
              </div>
            </div>
          `;
          await emailClient.service.sendEmail(emailClient.config, emailClient.secrets, admin.auth.email, subject, html);
        }
      } catch {
        // Email capability not configured or disabled; gracefully continue
      }
    }
  }

  /**
   * List knowledge gaps with filters and pagination
   */
  async listGaps(
    orgId: string | mongoose.Types.ObjectId,
    options: { status?: string; page?: number; limit?: number } = {}
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const query: Record<string, any> = { organizationId: orgObjectId };

    if (options.status && options.status !== "all") {
      query.status = options.status;
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, options.limit || 10);
    const skip = (page - 1) * limit;

    const total = await KnowledgeGap.countDocuments(query);
    const gaps = await KnowledgeGap.find(query)
      .sort({ status: 1, occurrenceCount: -1, lastAskedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("requestedBy", "profile.firstName profile.lastName auth.email")
      .populate("resolvedBy", "profile.firstName profile.lastName");

    return { gaps, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Resolve gap with a Quick Answer (immediately indexes answer as active chunk)
   */
  async resolveWithQuickAnswer(
    orgId: string | mongoose.Types.ObjectId,
    gapId: string | mongoose.Types.ObjectId,
    answerText: string,
    userId: string | mongoose.Types.ObjectId
  ) {
    const gap = await KnowledgeGap.findOne({
      _id: gapId,
      organizationId: orgId,
    });

    if (!gap) {
      throw new Error("Knowledge gap record not found");
    }

    // Index the quick answer as an authoritative knowledge chunk
    await this.indexingService.indexQuickAnswer(orgId, gap._id, gap.question, answerText);

    gap.status = "resolved";
    gap.resolutionType = "quick_answer";
    gap.resolutionNotes = answerText;
    gap.resolvedBy = new mongoose.Types.ObjectId(userId.toString());
    gap.resolvedAt = new Date();
    await gap.save();

    return gap;
  }

  /**
   * Resolve gap by linking to a published knowledge base article
   */
  async resolveWithArticle(
    orgId: string | mongoose.Types.ObjectId,
    gapId: string | mongoose.Types.ObjectId,
    articleId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ) {
    const gap = await KnowledgeGap.findOne({
      _id: gapId,
      organizationId: orgId,
    });

    if (!gap) {
      throw new Error("Knowledge gap record not found");
    }

    gap.status = "resolved";
    gap.resolutionType = "article";
    gap.resolutionResourceId = new mongoose.Types.ObjectId(articleId.toString());
    gap.resolvedBy = new mongoose.Types.ObjectId(userId.toString());
    gap.resolvedAt = new Date();
    await gap.save();

    return gap;
  }

  /**
   * Dismiss gap
   */
  async dismissGap(
    orgId: string | mongoose.Types.ObjectId,
    gapId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ) {
    const gap = await KnowledgeGap.findOne({
      _id: gapId,
      organizationId: orgId,
    });

    if (!gap) {
      throw new Error("Knowledge gap record not found");
    }

    gap.status = "dismissed";
    gap.resolvedBy = new mongoose.Types.ObjectId(userId.toString());
    gap.resolvedAt = new Date();
    await gap.save();

    return gap;
  }
}

export default KnowledgeGapService;
