import mongoose from "mongoose";
import AppError from "../../../common/errors/app-error.js";
import { KioskJourneyRepository } from "../repositories/kiosk-journey.repository.js";
import { KioskDeviceRepository } from "../repositories/kiosk-device.repository.js";
import { KioskAnalyticsRepository } from "../repositories/kiosk-analytics.repository.js";
import { KioskSecurityService } from "./kiosk-security.service.js";
import { KioskJourneySchema } from "../validation/journey.schema.js";
import { KioskDeviceStatus } from "../types/common.types.js";
import { KioskTelemetry } from "../types/device.types.js";
import { KioskJourneyModel, IKioskJourney } from "../models/kiosk-journey.model.js";

export class KioskService {
  constructor(
    private readonly journeyRepo: KioskJourneyRepository,
    private readonly deviceRepo: KioskDeviceRepository,
    private readonly analyticsRepo: KioskAnalyticsRepository,
    private readonly securityService: KioskSecurityService,
    private readonly jwt: {
      sign: (payload: any, options?: any) => string;
    }
  ) {}

  async createJourney(orgId: string, data: any, userId: string): Promise<IKioskJourney> {
    const journeyData = {
      ...data,
      organizationId: new mongoose.Types.ObjectId(orgId),
      createdBy: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
      publishing: {
        status: "draft",
        version: 1
      }
    };
    return this.journeyRepo.create(journeyData);
  }

  async updateJourney(id: string, orgId: string, data: any, userId: string): Promise<IKioskJourney> {
    const journey = await this.journeyRepo.findByIdAndOrg(id, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    const updated = await this.journeyRepo.update(id, data, userId);
    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    return updated;
  }

  async publishJourney(id: string, orgId: string, userId: string): Promise<IKioskJourney> {
    const journey = await this.journeyRepo.findByIdAndOrg(id, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }

    // Trigger refinement validation before marking as published
    const json = JSON.parse(JSON.stringify(journey.toJSON()));
    delete json.__v;
    const validationResult = KioskJourneySchema.safeParse(json);
    if (!validationResult.success) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        `Cannot publish journey due to validation errors: ${validationResult.error.issues[0].message}`
      );
    }

    const published = await this.journeyRepo.publish(id, userId);
    if (!published) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    return published;
  }

  async getJourney(id: string, orgId: string): Promise<IKioskJourney> {
    const journey = await this.journeyRepo.findByIdAndOrg(id, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    return journey;
  }

  async deleteJourney(id: string, orgId: string, userId: string): Promise<void> {
    const journey = await this.journeyRepo.findByIdAndOrg(id, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    await this.journeyRepo.softDelete(id, userId);
  }

  async listJourneys(filter: any, pagination: any) {
    return this.journeyRepo.find(filter, pagination);
  }

  // --- Device Management ---

  async generatePairingCode(orgId: string, deviceId: string): Promise<string> {
    // 5-minute activation window
    return this.securityService.generatePairingCode(orgId, deviceId, 300000);
  }

  async pairDevice(code: string, deviceId: string, name: string, location: string) {
    const pairingData = this.securityService.verifyPairingCode(code);
    if (!pairingData) {
      throw new AppError(400, "INVALID_CODE", "Invalid or expired pairing code");
    }

    const { orgId } = pairingData;
    let device = await this.deviceRepo.findByFingerprint(deviceId);

    if (device) {
      // Re-activate or re-pair existing device
      device = await this.deviceRepo.register({
        _id: device._id,
        organizationId: new mongoose.Types.ObjectId(orgId),
        deviceId,
        name: name || device.name,
        location: location || device.location,
        status: "online",
        pairedAt: new Date(),
        lastSeen: new Date()
      } as any);
    } else {
      // Register new device
      device = await this.deviceRepo.register({
        organizationId: new mongoose.Types.ObjectId(orgId),
        deviceId,
        name,
        location,
        status: "online",
        pairedAt: new Date(),
        lastSeen: new Date(),
        currentContentVersion: 0,
        telemetry: {}
      } as any);
    }

    // Sign long-lived token for physical device (e.g. 10 years expiry)
    const token = this.jwt.sign(
      {
        deviceId,
        organizationId: orgId,
        role: "kiosk_device"
      },
      { expiresIn: "3650d" }
    );

    return { device, token };
  }

  async heartbeat(deviceId: string, orgId: string, contentVersion: number, telemetry: KioskTelemetry) {
    const device = await this.deviceRepo.findByFingerprint(deviceId);
    if (!device) {
      throw new AppError(404, "NOT_FOUND", "Device registration not found");
    }

    if (device.organizationId.toString() !== orgId) {
      throw new AppError(403, "FORBIDDEN", "Tenant mismatch for device");
    }

    return this.deviceRepo.heartbeat(device._id as mongoose.Types.ObjectId, contentVersion, telemetry);
  }

  async listDevices(filter: any, pagination: any) {
    return this.deviceRepo.find(filter, pagination);
  }

  async updateDeviceStatus(id: string, orgId: string, status: KioskDeviceStatus) {
    const device = await this.deviceRepo.findByIdAndOrg(id, orgId);
    if (!device) {
      throw new AppError(404, "NOT_FOUND", "Device not found");
    }
    return this.deviceRepo.updateStatus(id, status);
  }

  async pairJourneyToDevice(id: string, orgId: string, journeyId: string | null) {
    const device = await this.deviceRepo.findByIdAndOrg(id, orgId);
    if (!device) {
      throw new AppError(404, "NOT_FOUND", "Device not found");
    }
    if (journeyId) {
      const journey = await this.journeyRepo.findByIdAndOrg(journeyId, orgId);
      if (!journey) {
        throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
      }
    }
    return this.deviceRepo.pairJourney(id, journeyId);
  }

  // --- Analytics Sync ---

  async syncAnalytics(orgId: string, sessions: any[]) {
    // Verify all sessions belong to journeys owned by this organization
    const journeyIds = [...new Set(sessions.map((s) => s.journeyId))];
    const journeys = await KioskJourneyModel.find({
      _id: { $in: journeyIds },
      organizationId: orgId,
      isDeleted: false
    });

    if (journeys.length !== journeyIds.length) {
      throw new AppError(400, "BAD_REQUEST", "Tenant crossover or invalid journeys detected in sync batch");
    }

    const sessionsWithTenant = sessions.map((s) => ({
      ...s,
      organizationId: new mongoose.Types.ObjectId(orgId),
      deviceId: s.deviceId ? new mongoose.Types.ObjectId(s.deviceId) : undefined,
      journeyId: new mongoose.Types.ObjectId(s.journeyId)
    }));
    return this.analyticsRepo.bulkSync(sessionsWithTenant);
  }

  async getJourneyAnalyticsSummary(journeyId: string, orgId: string, startDate?: string, endDate?: string) {
    const journey = await this.journeyRepo.findByIdAndOrg(journeyId, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    return this.analyticsRepo.getSummary(orgId, journeyId, startDate, endDate);
  }
}

export default KioskService;
