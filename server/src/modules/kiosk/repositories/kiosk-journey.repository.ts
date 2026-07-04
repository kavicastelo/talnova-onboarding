import mongoose from "mongoose";
import { KioskJourneyModel, IKioskJourney } from "../models/kiosk-journey.model.js";

export interface KioskJourneyFilter {
  organizationId: string | mongoose.Types.ObjectId;
  status?: "draft" | "published" | "archived";
  search?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export class KioskJourneyRepository {
  async findById(id: string | mongoose.Types.ObjectId): Promise<IKioskJourney | null> {
    return KioskJourneyModel.findOne({ _id: id, isDeleted: false });
  }

  async findByIdAndOrg(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IKioskJourney | null> {
    return KioskJourneyModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
  }

  async find(
    filter: KioskJourneyFilter,
    pagination: PaginationOptions
  ): Promise<{ journeys: IKioskJourney[]; total: number }> {
    const query: Record<string, any> = {
      organizationId: filter.organizationId,
      isDeleted: false
    };

    if (filter.status) {
      query["publishing.status"] = filter.status;
    }
    if (filter.search) {
      query.title = new RegExp(filter.search, "i");
    }

    const total = await KioskJourneyModel.countDocuments(query);

    const page = Math.max(1, pagination.page);
    const limit = Math.max(1, pagination.limit);
    const skip = (page - 1) * limit;

    const sortField = pagination.sortBy || "createdAt";
    const sortOrder = pagination.sortOrder === "asc" ? 1 : -1;

    const journeys = await KioskJourneyModel.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

    return { journeys, total };
  }

  async create(journeyData: Partial<IKioskJourney>): Promise<IKioskJourney> {
    const journey = new KioskJourneyModel(journeyData);
    return journey.save();
  }

  async update(
    id: string | mongoose.Types.ObjectId,
    updateData: Partial<IKioskJourney>,
    updatedBy: string | mongoose.Types.ObjectId
  ): Promise<IKioskJourney | null> {
    return KioskJourneyModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        $set: {
          ...updateData,
          updatedBy: new mongoose.Types.ObjectId(updatedBy)
        }
      },
      { new: true }
    );
  }

  async softDelete(
    id: string | mongoose.Types.ObjectId,
    deletedBy: string | mongoose.Types.ObjectId
  ): Promise<IKioskJourney | null> {
    return KioskJourneyModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedBy: new mongoose.Types.ObjectId(deletedBy)
        }
      },
      { new: true }
    );
  }

  async publish(
    id: string | mongoose.Types.ObjectId,
    publishedBy: string | mongoose.Types.ObjectId
  ): Promise<IKioskJourney | null> {
    const journey = await this.findById(id);
    if (!journey) return null;

    const currentVersion = journey.publishing.version;
    const nextVersion = journey.publishing.status === "published" ? currentVersion : currentVersion + 1;

    return KioskJourneyModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        $set: {
          "publishing.status": "published",
          "publishing.version": nextVersion,
          "publishing.publishedAt": new Date(),
          updatedBy: new mongoose.Types.ObjectId(publishedBy)
        }
      },
      { new: true }
    );
  }
}

export default KioskJourneyRepository;
