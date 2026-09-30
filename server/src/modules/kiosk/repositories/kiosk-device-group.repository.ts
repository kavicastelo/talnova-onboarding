import mongoose from "mongoose";
import {
  KioskDeviceGroupModel,
  IKioskDeviceGroup,
} from "../models/kiosk-device-group.model.js";

export interface KioskDeviceGroupFilter {
  siteId?: string | mongoose.Types.ObjectId;
  search?: string;
}

export class KioskDeviceGroupRepository {
  /**
   * Create a new kiosk device group.
   */
  async create(data: Partial<IKioskDeviceGroup>): Promise<IKioskDeviceGroup> {
    const doc = new KioskDeviceGroupModel(data);
    return doc.save();
  }

  /**
   * Find a device group by ID, enforcing tenant isolation.
   */
  async findById(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IKioskDeviceGroup | null> {
    if (!mongoose.Types.ObjectId.isValid(id.toString())) {
      return null;
    }
    return KioskDeviceGroupModel.findOne({
      _id: new mongoose.Types.ObjectId(id.toString()),
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      isDeleted: false,
    });
  }

  /**
   * Find all device groups for an organization, with optional siteId and search filter.
   */
  async findByOrg(
    orgId: string | mongoose.Types.ObjectId,
    filter?: KioskDeviceGroupFilter
  ): Promise<IKioskDeviceGroup[]> {
    const query: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      isDeleted: false,
    };

    if (filter?.siteId) {
      const siteIdStr = filter.siteId.toString();
      const isSiteObj = mongoose.Types.ObjectId.isValid(siteIdStr) && siteIdStr.length === 24;
      query.siteId = isSiteObj ? new mongoose.Types.ObjectId(siteIdStr) : siteIdStr;
    }

    if (filter?.search) {
      query.name = { $regex: filter.search, $options: "i" };
    }

    return KioskDeviceGroupModel.find(query).sort({ name: 1 });
  }

  /**
   * Find all groups to which a specific device belongs.
   */
  async findByDeviceId(
    deviceId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IKioskDeviceGroup[]> {
    if (!mongoose.Types.ObjectId.isValid(deviceId.toString())) {
      return [];
    }
    const devObjId = new mongoose.Types.ObjectId(deviceId.toString());
    return KioskDeviceGroupModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      deviceIds: devObjId,
      isDeleted: false,
    });
  }

  /**
   * Update a device group.
   */
  async update(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    updates: Partial<IKioskDeviceGroup>
  ): Promise<IKioskDeviceGroup | null> {
    if (!mongoose.Types.ObjectId.isValid(id.toString())) {
      return null;
    }
    return KioskDeviceGroupModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id.toString()),
        organizationId: new mongoose.Types.ObjectId(orgId.toString()),
        isDeleted: false,
      },
      { $set: updates },
      { new: true, runValidators: true }
    );
  }

  /**
   * Soft delete a device group.
   */
  async delete(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id.toString())) {
      return false;
    }
    const res = await KioskDeviceGroupModel.updateOne(
      {
        _id: new mongoose.Types.ObjectId(id.toString()),
        organizationId: new mongoose.Types.ObjectId(orgId.toString()),
        isDeleted: false,
      },
      { $set: { isDeleted: true } }
    );
    return res.modifiedCount > 0;
  }

  /**
   * Add a device to a group (atomic $addToSet).
   */
  async addDeviceToGroup(
    groupId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    deviceId: string | mongoose.Types.ObjectId
  ): Promise<IKioskDeviceGroup | null> {
    if (!mongoose.Types.ObjectId.isValid(groupId.toString()) || !mongoose.Types.ObjectId.isValid(deviceId.toString())) {
      return null;
    }
    return KioskDeviceGroupModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(groupId.toString()),
        organizationId: new mongoose.Types.ObjectId(orgId.toString()),
        isDeleted: false,
      },
      { $addToSet: { deviceIds: new mongoose.Types.ObjectId(deviceId.toString()) } },
      { new: true }
    );
  }

  /**
   * Remove a device from a group (atomic $pull).
   */
  async removeDeviceFromGroup(
    groupId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    deviceId: string | mongoose.Types.ObjectId
  ): Promise<IKioskDeviceGroup | null> {
    if (!mongoose.Types.ObjectId.isValid(groupId.toString()) || !mongoose.Types.ObjectId.isValid(deviceId.toString())) {
      return null;
    }
    return KioskDeviceGroupModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(groupId.toString()),
        organizationId: new mongoose.Types.ObjectId(orgId.toString()),
        isDeleted: false,
      },
      { $pull: { deviceIds: new mongoose.Types.ObjectId(deviceId.toString()) } },
      { new: true }
    );
  }
}

export default KioskDeviceGroupRepository;
