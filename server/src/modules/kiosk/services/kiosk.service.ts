import crypto from "crypto";
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

  async generatePairingCode(orgId: string, deviceId: string): Promise<{ code: string; expiresInSeconds: number }> {
    // 15-minute activation window (900 seconds)
    const code = this.securityService.generatePairingCode(orgId, deviceId, 900000);
    return { code, expiresInSeconds: 900 };
  }

  async pairDevice(code: string, deviceId: string, name: string, location: string) {
    const pairingData = this.securityService.verifyPairingCode(code);
    if (!pairingData) {
      throw new AppError(400, "INVALID_OR_EXPIRED_PAIRING_CODE", "Invalid or expired pairing code");
    }

    const { orgId } = pairingData;
    if (pairingData.deviceId && pairingData.deviceId !== deviceId) {
      throw new AppError(400, "DEVICE_MISMATCH", "Pairing code was generated for a different hardware GUID");
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

    const tokenRef = crypto.createHash("sha256").update(token).digest("hex");

    let device = await this.deviceRepo.findByFingerprint(deviceId);

    if (device) {
      // Re-activate or re-pair existing device
      device = await this.deviceRepo.register({
        _id: device._id,
        organizationId: new mongoose.Types.ObjectId(orgId),
        deviceId,
        hardwareGuid: deviceId,
        name: name || device.name,
        location: location || device.location,
        status: "online",
        paired: true,
        tokenRef,
        pairedAt: new Date(),
        lastSeen: new Date()
      } as any);
    } else {
      // Register new device
      device = await this.deviceRepo.register({
        organizationId: new mongoose.Types.ObjectId(orgId),
        deviceId,
        hardwareGuid: deviceId,
        name,
        location,
        status: "online",
        paired: true,
        tokenRef,
        pairedAt: new Date(),
        lastSeen: new Date(),
        currentContentVersion: 0,
        telemetry: {}
      } as any);
    }

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

  async syncAnalytics(orgId: string, payload: any, hardwareDeviceId?: string) {
    const rawItems = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.events) ? payload.events : (Array.isArray(payload?.sessions) ? payload.sessions : []));

    if (!rawItems || rawItems.length === 0) {
      throw new AppError(400, "BAD_REQUEST", "No events or sessions provided for sync");
    }

    // Resolve device ObjectId if hardwareDeviceId is available
    let deviceObjectId: mongoose.Types.ObjectId | undefined;
    if (hardwareDeviceId) {
      const device = await this.deviceRepo.findByFingerprint(hardwareDeviceId);
      if (device) {
        deviceObjectId = device._id as mongoose.Types.ObjectId;
      }
    }

    // Extract journey identifiers (can be ObjectId or journeyCode)
    const rawJourneyIds: string[] = Array.from(
      new Set(
        rawItems
          .map((item: any) => String(item.journeyId || ""))
          .filter((id: string): id is string => Boolean(id))
      )
    );
    const validObjectIds = rawJourneyIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id) && id.length === 24);

    const journeys = await KioskJourneyModel.find({
      $or: [
        { _id: { $in: validObjectIds } },
        { journeyCode: { $in: rawJourneyIds } }
      ],
      organizationId: orgId,
      isDeleted: false
    });

    if (journeys.length === 0) {
      throw new AppError(400, "BAD_REQUEST", "No matching active journeys found for specified journey identifiers");
    }

    // Map each item to a standardized KioskAnalytics document
    const dateKey = new Date().toISOString().split("T")[0];
    const normalizedDocs = rawItems.map((item: any) => {
      const matchedJourney = journeys.find(
        (j) => j._id.toString() === item.journeyId || j.journeyCode === item.journeyId
      );
      if (!matchedJourney) {
        throw new AppError(400, "BAD_REQUEST", `Tenant crossover or invalid journey detected: ${item.journeyId}`);
      }

      const journeyId = matchedJourney._id as mongoose.Types.ObjectId;
      const journeyVersion = matchedJourney.publishing?.version || 1;
      const languageUsed = item.languageUsed || matchedJourney.languages?.[0] || (matchedJourney.settings as any)?.defaultLanguage || "en";
      const eventType = item.eventType || item.interactions?.[0]?.eventType || "STEP_VIEWED";
      const stepId = item.stepId || item.interactions?.[0]?.stepId || "step-01";
      const durationSeconds = item.durationSeconds || item.metrics?.durationSeconds || 0;
      const completedCount = (eventType && eventType.toUpperCase().includes("COMPLETED")) ? 1 : (item.metrics?.completedCount || 0);

      const metrics = item.metrics || {
        launchesCount: 1,
        completedCount,
        durationSeconds,
        abortedStepId: item.abortedStepId
      };

      const interactions = Array.isArray(item.interactions) && item.interactions.length > 0
        ? item.interactions
        : [
            {
              stepId,
              elementClicked: item.elementClicked || stepId,
              eventType,
              timestamp: new Date()
            }
          ];

      return {
        organizationId: new mongoose.Types.ObjectId(orgId),
        deviceId: deviceObjectId || (item.deviceId && mongoose.Types.ObjectId.isValid(item.deviceId) ? new mongoose.Types.ObjectId(item.deviceId) : undefined),
        journeyId,
        journeyVersion,
        languageUsed,
        stepId,
        eventType,
        metrics,
        interactions,
        dateKey: item.dateKey || dateKey
      };
    });

    return this.analyticsRepo.bulkSync(normalizedDocs);
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
