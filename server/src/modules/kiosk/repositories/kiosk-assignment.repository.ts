import mongoose from "mongoose";
import {
  KioskDeviceAssignmentModel,
  IKioskDeviceAssignment,
} from "../models/kiosk-assignment.model.js";
import { AssignmentTargetType } from "../types/assignment.types.js";

export interface KioskAssignmentFilter {
  targetType?: AssignmentTargetType;
  targetId?: string | mongoose.Types.ObjectId;
  journeyId?: string | mongoose.Types.ObjectId;
  isActive?: boolean;
}

export class KioskDeviceAssignmentRepository {
  /**
   * Create a new device-journey assignment rule.
   */
  async create(data: Partial<IKioskDeviceAssignment>): Promise<IKioskDeviceAssignment> {
    const doc = new KioskDeviceAssignmentModel(data);
    return doc.save();
  }

  /**
   * Find an assignment by ID, enforcing tenant isolation.
   */
  async findById(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IKioskDeviceAssignment | null> {
    return KioskDeviceAssignmentModel.findOne({
      _id: id,
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
    });
  }

  /**
   * Find all assignments for a target (device, group, or site) within an organization.
   */
  async findByTarget(
    targetId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    targetType?: AssignmentTargetType
  ): Promise<IKioskDeviceAssignment[]> {
    const query: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      targetId: new mongoose.Types.ObjectId(targetId.toString()),
    };

    if (targetType) {
      query.targetType = targetType;
    }

    return KioskDeviceAssignmentModel.find(query).sort({ priority: 1, createdAt: -1 });
  }

  /**
   * Find all active assignments for a target within an organization.
   */
  async findActiveByTarget(
    targetId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IKioskDeviceAssignment[]> {
    return KioskDeviceAssignmentModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      targetId: new mongoose.Types.ObjectId(targetId.toString()),
      isActive: true,
    }).sort({ priority: 1, createdAt: -1 });
  }

  /**
   * Find all assignments referencing a specific journey within an organization.
   */
  async findByJourney(
    journeyId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IKioskDeviceAssignment[]> {
    return KioskDeviceAssignmentModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      journeyId: new mongoose.Types.ObjectId(journeyId.toString()),
    }).sort({ priority: 1, createdAt: -1 });
  }

  /**
   * List assignments within an organization with optional filtering.
   */
  async list(
    orgId: string | mongoose.Types.ObjectId,
    filter?: KioskAssignmentFilter
  ): Promise<IKioskDeviceAssignment[]> {
    const query: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
    };

    if (filter?.targetType) {
      query.targetType = filter.targetType;
    }
    if (filter?.targetId) {
      query.targetId = new mongoose.Types.ObjectId(filter.targetId.toString());
    }
    if (filter?.journeyId) {
      query.journeyId = new mongoose.Types.ObjectId(filter.journeyId.toString());
    }
    if (typeof filter?.isActive === "boolean") {
      query.isActive = filter.isActive;
    }

    return KioskDeviceAssignmentModel.find(query).sort({ priority: 1, createdAt: -1 });
  }

  /**
   * Update an existing assignment document within an organization.
   */
  async update(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    updates: Partial<IKioskDeviceAssignment>
  ): Promise<IKioskDeviceAssignment | null> {
    return KioskDeviceAssignmentModel.findOneAndUpdate(
      {
        _id: id,
        organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      },
      { $set: updates },
      { new: true, runValidators: true }
    );
  }

  /**
   * Delete an assignment rule within an organization.
   */
  async delete(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    const res = await KioskDeviceAssignmentModel.deleteOne({
      _id: id,
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
    });
    return res.deletedCount > 0;
  }
}

export default KioskDeviceAssignmentRepository;
