import mongoose from "mongoose";
import { KioskDeviceModel, IKioskDevice } from "../models/kiosk-device.model.js";
import { KioskTelemetry } from "../types/device.types.js";
import { KioskDeviceStatus } from "../types/common.types.js";

export interface KioskDeviceFilter {
  organizationId: string | mongoose.Types.ObjectId;
  status?: KioskDeviceStatus;
}

import { PaginationOptions } from "./kiosk-journey.repository.js";

export class KioskDeviceRepository {
  async findById(id: string | mongoose.Types.ObjectId): Promise<IKioskDevice | null> {
    return KioskDeviceModel.findById(id);
  }

  async findByFingerprint(deviceId: string): Promise<IKioskDevice | null> {
    return KioskDeviceModel.findOne({ deviceId });
  }

  async findByIdAndOrg(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IKioskDevice | null> {
    return KioskDeviceModel.findOne({ _id: id, organizationId: orgId });
  }

  async find(
    filter: KioskDeviceFilter,
    pagination: PaginationOptions
  ): Promise<{ devices: IKioskDevice[]; total: number }> {
    const query: Record<string, any> = {
      organizationId: filter.organizationId
    };

    if (filter.status) {
      query.status = filter.status;
    }

    const total = await KioskDeviceModel.countDocuments(query);

    const page = Math.max(1, pagination.page);
    const limit = Math.max(1, pagination.limit);
    const skip = (page - 1) * limit;

    const sortField = pagination.sortBy || "lastSeen";
    const sortOrder = pagination.sortOrder === "asc" ? 1 : -1;

    const devices = await KioskDeviceModel.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

    return { devices, total };
  }

  async register(deviceData: Partial<IKioskDevice>): Promise<IKioskDevice> {
    const device = new KioskDeviceModel(deviceData);
    return device.save();
  }

  async heartbeat(
    id: string | mongoose.Types.ObjectId,
    contentVersion: number,
    telemetry: KioskTelemetry
  ): Promise<IKioskDevice | null> {
    return KioskDeviceModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "online",
          lastSeen: new Date(),
          currentContentVersion: contentVersion,
          telemetry
        }
      },
      { new: true }
    );
  }

  async updateStatus(
    id: string | mongoose.Types.ObjectId,
    status: KioskDeviceStatus
  ): Promise<IKioskDevice | null> {
    return KioskDeviceModel.findByIdAndUpdate(
      id,
      {
        $set: { status }
      },
      { new: true }
    );
  }

  async pairJourney(
    id: string | mongoose.Types.ObjectId,
    journeyId: string | mongoose.Types.ObjectId | null
  ): Promise<IKioskDevice | null> {
    return KioskDeviceModel.findByIdAndUpdate(
      id,
      {
        $set: {
          currentJourneyId: journeyId ? new mongoose.Types.ObjectId(journeyId) : undefined
        }
      },
      { new: true }
    );
  }
}

export default KioskDeviceRepository;
