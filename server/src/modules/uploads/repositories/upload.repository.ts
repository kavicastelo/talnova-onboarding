import { Upload, IUpload } from "../models/upload.model.js";
import mongoose from "mongoose";

export interface UploadFilter {
  organizationId: string | mongoose.Types.ObjectId;
  type?: "video" | "image" | "audio" | "document" | "other";
  status?: "active" | "archived" | "deleted";
  uploadedBy?: string | mongoose.Types.ObjectId;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export class UploadRepository {
  async findById(id: string | mongoose.Types.ObjectId): Promise<IUpload | null> {
    return Upload.findOne({ _id: id, "lifecycle.status": { $ne: "deleted" } });
  }

  async findByIdAndOrg(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IUpload | null> {
    return Upload.findOne({
      _id: id,
      organizationId: orgId,
      "lifecycle.status": { $ne: "deleted" },
    });
  }

  async find(
    filter: UploadFilter,
    pagination: PaginationOptions
  ): Promise<{ uploads: IUpload[]; total: number }> {
    const query: Record<string, any> = {
      organizationId: filter.organizationId,
      "lifecycle.status": filter.status || { $ne: "deleted" },
    };

    if (filter.type) {
      query.type = filter.type;
    }
    if (filter.uploadedBy) {
      query["ownership.uploadedBy"] = new mongoose.Types.ObjectId(filter.uploadedBy);
    }

    const total = await Upload.countDocuments(query);

    const page = Math.max(1, pagination.page);
    const limit = Math.max(1, pagination.limit);
    const skip = (page - 1) * limit;

    const sortField = pagination.sortBy || "createdAt";
    const sortOrder = pagination.sortOrder === "asc" ? 1 : -1;

    const uploads = await Upload.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

    return { uploads, total };
  }

  async create(uploadData: Partial<IUpload>): Promise<IUpload> {
    const upload = new Upload(uploadData);
    return upload.save();
  }

  async update(
    id: string | mongoose.Types.ObjectId,
    updateData: Partial<IUpload>
  ): Promise<IUpload | null> {
    return Upload.findOneAndUpdate(
      { _id: id },
      { $set: updateData },
      { new: true }
    );
  }

  async softDelete(id: string | mongoose.Types.ObjectId): Promise<IUpload | null> {
    return Upload.findOneAndUpdate(
      { _id: id },
      { $set: { "lifecycle.status": "deleted" } },
      { new: true }
    );
  }

  async incrementUsage(
    id: string | mongoose.Types.ObjectId,
    entityType: "journey" | "knowledge_base" | "user_avatar" | "certificate" | "organization",
    entityId: string | mongoose.Types.ObjectId
  ): Promise<IUpload | null> {
    return Upload.findOneAndUpdate(
      { _id: id },
      {
        $inc: { "usage.usageCount": 1 },
        $set: {
          "usage.entityType": entityType,
          "usage.entityId": new mongoose.Types.ObjectId(entityId),
        },
      },
      { new: true }
    );
  }
}

export default UploadRepository;
