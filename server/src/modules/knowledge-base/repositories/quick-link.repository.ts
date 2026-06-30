import { QuickLink, IQuickLink } from "../models/quick-link.model.js";
import mongoose from "mongoose";

export class QuickLinkRepository {
  async findByOrg(orgId: string | mongoose.Types.ObjectId): Promise<IQuickLink[]> {
    return QuickLink.find({ organizationId: orgId, isDeleted: false }).sort({ order: 1, createdAt: 1 });
  }

  async findByIdAndOrg(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IQuickLink | null> {
    return QuickLink.findOne({ _id: id, organizationId: orgId, isDeleted: false });
  }

  async create(data: Partial<IQuickLink>): Promise<IQuickLink> {
    const quickLink = new QuickLink(data);
    return quickLink.save();
  }

  async update(
    id: string | mongoose.Types.ObjectId,
    updateData: Partial<IQuickLink>
  ): Promise<IQuickLink | null> {
    return QuickLink.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updateData },
      { new: true }
    );
  }

  async softDelete(id: string | mongoose.Types.ObjectId): Promise<IQuickLink | null> {
    return QuickLink.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
  }
}

export default QuickLinkRepository;
