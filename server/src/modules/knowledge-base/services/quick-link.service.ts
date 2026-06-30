import QuickLinkRepository from "../repositories/quick-link.repository.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";
import { IQuickLink } from "../models/quick-link.model.js";

export class QuickLinkService {
  constructor(private readonly repository: QuickLinkRepository) {}

  async getQuickLinks(orgId: string | mongoose.Types.ObjectId): Promise<IQuickLink[]> {
    return this.repository.findByOrg(orgId);
  }

  async createQuickLink(
    orgId: string | mongoose.Types.ObjectId,
    data: { title: string; url: string; icon?: string; order?: number }
  ): Promise<IQuickLink> {
    return this.repository.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      title: data.title,
      url: data.url,
      icon: data.icon || "Link",
      order: data.order ?? 0,
      isDeleted: false,
    });
  }

  async updateQuickLink(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    data: { title?: string; url?: string; icon?: string; order?: number }
  ): Promise<IQuickLink> {
    const quickLink = await this.repository.findByIdAndOrg(id, orgId);
    if (!quickLink) {
      throw new AppError(404, "NOT_FOUND", "Quick link not found");
    }
    const updated = await this.repository.update(id, data);
    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "Quick link not found");
    }
    return updated;
  }

  async deleteQuickLink(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const quickLink = await this.repository.findByIdAndOrg(id, orgId);
    if (!quickLink) {
      throw new AppError(404, "NOT_FOUND", "Quick link not found");
    }
    await this.repository.softDelete(id);
  }
}

export default QuickLinkService;
