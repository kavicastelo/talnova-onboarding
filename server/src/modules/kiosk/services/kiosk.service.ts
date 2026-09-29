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
import KioskDeviceModel from "../models/kiosk-device.model.js";
import { KioskDeviceAssignmentModel } from "../models/kiosk-assignment.model.js";
import User from "../../auth/models/user.model.js";
import { Organization } from "../../organizations/models/organization.model.js";
import { PackageModel } from "../../super-admin/models/package.model.js";
import { KioskJourneyVersionRepository } from "../repositories/kiosk-journey-version.repository.js";
import { IKioskJourneyVersion } from "../models/kiosk-journey-version.model.js";
import { computeCanonicalStepsChecksum } from "../utils/checksum.util.js";
import { validateJourneyForPublish } from "../validation/journey-publish.validator.js";
import { ValidationReport } from "../types/validation.types.js";

export class KioskService {
  private readonly journeyVersionRepo: KioskJourneyVersionRepository;

  constructor(
    private readonly journeyRepo: KioskJourneyRepository,
    private readonly deviceRepo: KioskDeviceRepository,
    private readonly analyticsRepo: KioskAnalyticsRepository,
    private readonly securityService: KioskSecurityService,
    private readonly jwt?: {
      sign: (payload: any, options?: any) => string;
    },
    journeyVersionRepo?: KioskJourneyVersionRepository
  ) {
    this.journeyVersionRepo = journeyVersionRepo || new KioskJourneyVersionRepository();
  }

  getDeviceRepo(): KioskDeviceRepository {
    return this.deviceRepo;
  }

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

  async publishJourney(
    id: string,
    orgId: string,
    userId: string,
    changelog?: string,
    scheduling?: { publishAt?: Date | string; expiresAt?: Date | string }
  ): Promise<IKioskJourney> {
    const journey = await this.journeyRepo.findByIdAndOrg(id, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }

    // Merge incoming scheduling if provided
    const effectiveScheduling = scheduling || journey.publishing?.scheduling;

    // Validate scheduling constraints
    if (effectiveScheduling?.publishAt && effectiveScheduling?.expiresAt) {
      const pubDate = new Date(effectiveScheduling.publishAt);
      const expDate = new Date(effectiveScheduling.expiresAt);
      if (expDate <= pubDate) {
        throw new AppError(
          400,
          "VALIDATION_FAILED",
          "Expiration date must be after scheduled publication date"
        );
      }
    }

    const now = new Date();
    const isFuturePublish =
      effectiveScheduling?.publishAt && new Date(effectiveScheduling.publishAt) > now;
    const targetStatus = isFuturePublish ? "scheduled" : "published";

    // Trigger refinement validation before marking as published / scheduled
    const json = JSON.parse(JSON.stringify(journey.toJSON()));
    delete json.__v;
    json.publishing.status = targetStatus;
    if (effectiveScheduling) {
      json.publishing.scheduling = effectiveScheduling;
    }

    const validationResult = KioskJourneySchema.safeParse(json);
    if (!validationResult.success) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        `Cannot publish journey due to validation errors: ${validationResult.error.issues[0].message}`
      );
    }

    // Enforce rigorous pre-publish linter rules (K-JRN-003)
    const prepublishReport = await validateJourneyForPublish(journey, {
      organizationId: orgId,
      checkDatabase: true
    });

    if (!prepublishReport.isValid) {
      const summary = prepublishReport.errors.map((e) => e.message).join("; ");
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        `Pre-publish validation failed: ${summary}`,
        {
          errors: prepublishReport.errors,
          warnings: prepublishReport.warnings
        }
      );
    }

    // 1. Determine monotonically incrementing version number based on historical snapshots
    const latestSnapshot = await this.journeyVersionRepo.findLatestVersion(journey._id);
    const nextVersion = (latestSnapshot?.version || 0) + 1;

    // 2. Deep-clone steps and compute deterministic SHA-256 canonical steps checksum
    const clonedSteps = JSON.parse(JSON.stringify(journey.steps || []));
    const contentChecksum = computeCanonicalStepsChecksum(clonedSteps);

    // 3. Deep-clone settings
    const clonedSettings = JSON.parse(JSON.stringify(journey.settings || {}));

    // 4. Create immutable version snapshot record in KioskJourneyVersionModel
    await this.journeyVersionRepo.createSnapshot({
      journeyId: journey._id,
      organizationId: journey.organizationId,
      version: nextVersion,
      title: journey.title,
      description: journey.description,
      languages: [...(journey.languages || [])],
      steps: clonedSteps,
      settings: clonedSettings,
      contentChecksum,
      publishedBy: new mongoose.Types.ObjectId(userId),
      publishedAt: isFuturePublish && effectiveScheduling?.publishAt ? new Date(effectiveScheduling.publishAt) : now,
      status: "published",
      changelog: changelog || undefined
    });

    // 5. Update draft document in KioskJourneyModel
    const published = await this.journeyRepo.publish(id, userId, nextVersion, {
      status: targetStatus,
      scheduling: effectiveScheduling
        ? {
            publishAt: effectiveScheduling.publishAt ? new Date(effectiveScheduling.publishAt) : undefined,
            expiresAt: effectiveScheduling.expiresAt ? new Date(effectiveScheduling.expiresAt) : undefined
          }
        : undefined
    });
    if (!published) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    return published;
  }

  async unpublishJourney(
    id: string,
    orgId: string,
    userId: string
  ): Promise<IKioskJourney> {
    const journey = await this.journeyRepo.findByIdAndOrg(id, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    const unpublished = await this.journeyRepo.unpublish(id, userId);
    if (!unpublished) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    return unpublished;
  }

  async rollbackJourney(
    id: string,
    orgId: string,
    targetVersion: number,
    userId: string
  ): Promise<IKioskJourney> {
    const journey = await this.journeyRepo.findByIdAndOrg(id, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }

    const targetSnapshot = await this.journeyVersionRepo.findByJourneyAndVersion(
      journey._id,
      targetVersion
    );
    if (!targetSnapshot) {
      throw new AppError(404, "NOT_FOUND", `Target journey version ${targetVersion} not found`);
    }

    // 1. Determine next monotonically increasing version number
    const latestSnapshot = await this.journeyVersionRepo.findLatestVersion(journey._id);
    const nextVersion = (latestSnapshot?.version || 0) + 1;

    // 2. Deep-clone content and settings from the target historic snapshot
    const clonedSteps = JSON.parse(JSON.stringify(targetSnapshot.steps || []));
    const contentChecksum = targetSnapshot.contentChecksum || computeCanonicalStepsChecksum(clonedSteps);
    const clonedSettings = JSON.parse(JSON.stringify(targetSnapshot.settings || {}));

    // 3. Create a brand new immutable version snapshot in KioskJourneyVersionModel
    await this.journeyVersionRepo.createSnapshot({
      journeyId: journey._id,
      organizationId: journey.organizationId,
      version: nextVersion,
      title: targetSnapshot.title,
      description: targetSnapshot.description,
      languages: [...(targetSnapshot.languages || [])],
      steps: clonedSteps,
      settings: clonedSettings,
      contentChecksum,
      publishedBy: new mongoose.Types.ObjectId(userId),
      publishedAt: new Date(),
      status: "published",
      changelog: `Rollback to version ${targetVersion}`
    });

    // 4. Update the draft document in KioskJourneyModel with rolled-back content and new version number
    const updated = await KioskJourneyModel.findOneAndUpdate(
      { _id: journey._id, isDeleted: false },
      {
        $set: {
          title: targetSnapshot.title,
          description: targetSnapshot.description,
          languages: targetSnapshot.languages,
          steps: clonedSteps,
          settings: clonedSettings,
          "publishing.status": "published",
          "publishing.version": nextVersion,
          "publishing.publishedAt": new Date(),
          updatedBy: new mongoose.Types.ObjectId(userId)
        }
      },
      { new: true }
    );

    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    return updated;
  }

  async getDeviceManifest(
    deviceIdOrGuid: string,
    orgId: string,
    now = new Date()
  ): Promise<{
    deviceId: string;
    organizationId: string;
    journeys: IKioskJourney[];
  }> {
    const isObjectId = mongoose.Types.ObjectId.isValid(deviceIdOrGuid) && deviceIdOrGuid.length === 24;
    const device = isObjectId
      ? await KioskDeviceModel.findOne({
          _id: new mongoose.Types.ObjectId(deviceIdOrGuid),
          organizationId: new mongoose.Types.ObjectId(orgId),
          isDeleted: false
        })
      : await this.deviceRepo.findByFingerprint(deviceIdOrGuid);

    if (!device || device.organizationId.toString() !== orgId.toString() || device.isDeleted) {
      throw new AppError(404, "NOT_FOUND", "Device not found");
    }

    if (device.status === "suspended" || device.status === "decommissioned") {
      throw new AppError(403, "FORBIDDEN", `Device is ${device.status}. Manifest access denied.`);
    }

    const candidateJourneyIds = new Set<string>();

    if (device.currentJourneyId) {
      candidateJourneyIds.add(device.currentJourneyId.toString());
    }

    // Include multi-journey assignments if present
    const assignments = await KioskDeviceAssignmentModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      targetId: device._id,
      isActive: true
    }).sort({ priority: 1 });

    for (const a of assignments) {
      candidateJourneyIds.add(a.journeyId.toString());
    }

    if (candidateJourneyIds.size === 0) {
      return {
        deviceId: device.deviceId,
        organizationId: orgId,
        journeys: []
      };
    }

    const candidateJourneys = await KioskJourneyModel.find({
      _id: { $in: Array.from(candidateJourneyIds).map((id) => new mongoose.Types.ObjectId(id)) },
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false
    });

    // Filter eligible journeys:
    // - Must be published (not draft, not archived, not scheduled before its time)
    // - Must not be expired (scheduling.expiresAt must be > now)
    const eligibleJourneys = candidateJourneys.filter((journey) => {
      if (journey.publishing.status !== "published") {
        return false;
      }
      const scheduling = journey.publishing.scheduling;
      if (scheduling?.publishAt && new Date(scheduling.publishAt) > now) {
        return false;
      }
      if (scheduling?.expiresAt && new Date(scheduling.expiresAt) <= now) {
        return false;
      }
      return true;
    });

    return {
      deviceId: device.deviceId,
      organizationId: orgId,
      journeys: eligibleJourneys
    };
  }

  async processScheduledPublishing(now = new Date()): Promise<{
    activated: string[];
    expired: string[];
  }> {
    const activated: string[] = [];
    const expired: string[] = [];

    // 1. Activate scheduled journeys where publishAt <= now
    const scheduledToActivate = await KioskJourneyModel.find({
      isDeleted: false,
      "publishing.status": "scheduled",
      "publishing.scheduling.publishAt": { $lte: now },
      $or: [
        { "publishing.scheduling.expiresAt": { $exists: false } },
        { "publishing.scheduling.expiresAt": null },
        { "publishing.scheduling.expiresAt": { $gt: now } }
      ]
    });

    for (const journey of scheduledToActivate) {
      await KioskJourneyModel.updateOne(
        { _id: journey._id },
        {
          $set: {
            "publishing.status": "published",
            "publishing.publishedAt": journey.publishing.scheduling?.publishAt || now
          }
        }
      );
      activated.push(journey._id.toString());
    }

    // 2. Expire journeys where expiresAt <= now
    const toExpire = await KioskJourneyModel.find({
      isDeleted: false,
      "publishing.status": { $in: ["published", "scheduled"] },
      "publishing.scheduling.expiresAt": { $lte: now }
    });

    for (const journey of toExpire) {
      await KioskJourneyModel.updateOne(
        { _id: journey._id },
        {
          $set: {
            "publishing.status": "archived"
          }
        }
      );
      expired.push(journey._id.toString());
    }

    return { activated, expired };
  }

  async listJourneyVersions(
    journeyId: string,
    orgId: string
  ): Promise<IKioskJourneyVersion[]> {
    const journey = await this.journeyRepo.findByIdAndOrg(journeyId, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    return this.journeyVersionRepo.listVersionsByJourney(journey._id, journey.organizationId);
  }

  async getJourneyVersion(
    journeyId: string,
    orgId: string,
    version: number
  ): Promise<IKioskJourneyVersion> {
    const journey = await this.journeyRepo.findByIdAndOrg(journeyId, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    const snapshot = await this.journeyVersionRepo.findByJourneyAndVersion(
      journey._id,
      version
    );
    if (!snapshot) {
      throw new AppError(404, "NOT_FOUND", `Journey version ${version} not found`);
    }
    return snapshot;
  }

  async getJourney(id: string, orgId: string): Promise<IKioskJourney> {
    const journey = await this.journeyRepo.findByIdAndOrg(id, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    return journey;
  }

  async validateJourneyForPublish(
    id: string,
    orgId: string
  ): Promise<ValidationReport> {
    const journey = await this.journeyRepo.findByIdAndOrg(id, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    return validateJourneyForPublish(journey, {
      organizationId: orgId,
      checkDatabase: true
    });
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

  private async resolveMaxKiosks(org: any): Promise<number> {
    let maxKiosks = org?.limits?.maxKiosks;
    if (maxKiosks === undefined || maxKiosks === null) {
      if (org?.packageId) {
        const pkg = await PackageModel.findById(org.packageId);
        maxKiosks = pkg?.limits?.maxKiosks !== undefined ? pkg.limits.maxKiosks : 5;
      } else {
        maxKiosks = 5;
      }
    }
    const hasKioskAddOn = (org?.subscription?.activeAddOns || []).includes("kiosk_mode");
    if (maxKiosks === 0 && hasKioskAddOn) {
      maxKiosks = 5;
    }
    return maxKiosks;
  }

  // --- Device Management ---

  async generatePairingCode(orgId: string, deviceId: string): Promise<{ code: string; expiresInSeconds: number }> {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const maxKiosks = await this.resolveMaxKiosks(org);
    const existing = await this.deviceRepo.findByFingerprint(deviceId);
    if (!existing) {
      const currentKiosksCount = await KioskDeviceModel.countDocuments({
        $or: [
          { organizationId: new mongoose.Types.ObjectId(orgId) },
          { organizationId: orgId.toString() as any },
        ],
        status: { $ne: "decommissioned" }
      });

      if (currentKiosksCount >= maxKiosks) {
        throw new AppError(
          403,
          "KIOSK_LIMIT_REACHED",
          `Organization kiosk device limit reached (${currentKiosksCount}/${maxKiosks}). Please upgrade your plan to pair more kiosks.`
        );
      }
    }

    // 15-minute activation window (900 seconds)
    const code = await this.securityService.generatePairingCode(orgId, deviceId, 900000);
    return { code, expiresInSeconds: 900 };
  }

  async pairDevice(code: string, deviceId: string, name: string, location: string) {
    const pairingData = await this.securityService.verifyPairingCode(code, deviceId);
    if (!pairingData) {
      throw new AppError(400, "INVALID_OR_EXPIRED_PAIRING_CODE", "Invalid or expired pairing code");
    }

    const { orgId } = pairingData;
    if (pairingData.deviceId && pairingData.deviceId !== deviceId) {
      throw new AppError(400, "DEVICE_MISMATCH", "Pairing code was generated for a different hardware GUID");
    }

    // Sign token for physical device (90 days expiry, K-DEV-003)
    const token = this.jwt
      ? this.jwt.sign(
          {
            deviceId,
            organizationId: orgId,
            role: "kiosk_device",
            jti: crypto.randomUUID()
          },
          { expiresIn: "90d" }
        )
      : "";

    const tokenRef = crypto.createHash("sha256").update(token).digest("hex");
    const tokenExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

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
        tokenExpiresAt,
        pairedAt: new Date(),
        lastSeen: new Date()
      } as any);
    } else {
      // Verify quota before registering new kiosk device
      const org = await Organization.findById(orgId);
      const maxKiosks = await this.resolveMaxKiosks(org);
      const currentKiosksCount = await KioskDeviceModel.countDocuments({
        $or: [
          { organizationId: new mongoose.Types.ObjectId(orgId) },
          { organizationId: orgId.toString() as any },
        ],
        status: { $ne: "decommissioned" }
      });

      if (currentKiosksCount >= maxKiosks) {
        throw new AppError(
          403,
          "KIOSK_LIMIT_REACHED",
          `Organization kiosk device limit reached (${currentKiosksCount}/${maxKiosks}). Please upgrade your plan to pair more kiosks.`
        );
      }

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
        tokenExpiresAt,
        pairedAt: new Date(),
        lastSeen: new Date(),
        currentContentVersion: 0,
        telemetry: {}
      } as any);
    }

    return { device, token };
  }

  async refreshDeviceToken(deviceId: string, orgId: string, currentToken?: string) {
    const device = await this.deviceRepo.findByFingerprint(deviceId);
    if (!device) {
      throw new AppError(404, "NOT_FOUND", "Device not found");
    }

    if (device.organizationId.toString() !== orgId.toString()) {
      throw new AppError(403, "FORBIDDEN", "Device does not belong to specified organization");
    }

    if (device.status === "suspended" || device.status === "decommissioned") {
      throw new AppError(403, "FORBIDDEN", `Device is ${device.status}. Token refresh denied.`);
    }

    // Verify current token hash matches tokenRef if token is provided
    if (currentToken && device.tokenRef) {
      const incomingHash = crypto.createHash("sha256").update(currentToken).digest("hex");
      if (incomingHash !== device.tokenRef) {
        throw new AppError(401, "UNAUTHORIZED", "Device token has been revoked or rotated.");
      }
    }

    // Sign new device JWT with 90-day expiry (K-DEV-003)
    const token = this.jwt
      ? this.jwt.sign(
          {
            deviceId,
            organizationId: orgId,
            role: "kiosk_device",
            jti: crypto.randomUUID()
          },
          { expiresIn: "90d" }
        )
      : "";

    const tokenRef = crypto.createHash("sha256").update(token).digest("hex");
    const tokenExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const updatedDevice = await KioskDeviceModel.findByIdAndUpdate(
      device._id,
      {
        $set: {
          tokenRef,
          tokenExpiresAt,
          status: "online",
          paired: true,
          lastSeen: new Date()
        }
      },
      { new: true }
    );

    return {
      device: updatedDevice || device,
      token
    };
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

  async revokeDevice(id: string, orgId: string, userId?: string) {
    const revoked = await this.deviceRepo.revoke(id, orgId, userId);
    if (!revoked) {
      throw new AppError(404, "NOT_FOUND", "Kiosk device not found");
    }
    return revoked;
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

  /**
   * Frontline worker identification and ephemeral session token generation (UQ-01 Resolution)
   */
  async identifyFrontlineWorker(orgId: string, identifier: string, kioskDeviceId?: string) {
    if (!identifier || !identifier.trim()) {
      throw new AppError(400, "BAD_REQUEST", "Worker identification code or badge is required");
    }

    const cleanId = identifier.trim();
    const worker = await User.findOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
      $or: [
        { "employment.badgeId": cleanId },
        { "employment.employeeId": cleanId },
        { "employment.nationalId": cleanId },
        { "auth.email": cleanId.toLowerCase() },
      ],
    });

    if (!worker) {
      throw new AppError(404, "WORKER_NOT_FOUND", "No frontline worker record found matching the provided badge or identity number.");
    }

    // Generate ephemeral 1-hour session token
    let sessionToken: string;
    const payload = {
      userId: worker._id.toString(),
      organizationId: orgId,
      kioskDeviceId: kioskDeviceId || "standalone_terminal",
      tempWorkerId: worker._id.toString(),
      workerId: worker._id.toString(),
      workerName: worker.profile.fullName || `${worker.profile.firstName} ${worker.profile.lastName}`.trim(),
      role: "frontline_worker_kiosk",
      scope: "kiosk_preboarding_execution",
    };

    if (this.jwt && typeof this.jwt.sign === "function") {
      sessionToken = this.jwt.sign(payload, { expiresIn: "1h" });
    } else {
      // Fallback base64 signed token representation
      const payloadStr = JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 });
      const signature = crypto.createHmac("sha256", "talnova_kiosk_secret").update(payloadStr).digest("hex");
      sessionToken = `${Buffer.from(payloadStr).toString("base64")}.${signature}`;
    }

    const pendingComplianceDocsCount = await mongoose.model("DocumentAssignment").countDocuments({
      organizationId: new mongoose.Types.ObjectId(orgId),
      employeeId: worker._id,
      status: { $ne: "signed" },
      isDeleted: false,
    });

    const workerObj = {
      id: worker._id.toString(),
      fullName: worker.profile.fullName || `${worker.profile.firstName} ${worker.profile.lastName}`.trim(),
      firstName: worker.profile.firstName,
      lastName: worker.profile.lastName,
      employeeId: worker.employment?.employeeId,
      badgeId: worker.employment?.badgeId,
      nationalId: worker.employment?.nationalId,
      department: worker.employment?.department || "Operations",
      status: worker.employment?.status,
    };

    return {
      success: true,
      token: sessionToken,
      sessionToken,
      pendingComplianceDocsCount,
      user: workerObj,
      worker: workerObj,
      expiresInSeconds: 3600,
    };
  }

  /**
   * Frontline supervisor PIN authorization verification (UQ-01 Resolution)
   */
  async verifySupervisorPin(orgId: string, supervisorIdentifier: string, pin: string) {
    if (!supervisorIdentifier || !pin) {
      throw new AppError(400, "BAD_REQUEST", "Supervisor identifier and 4-digit PIN are required");
    }

    const cleanId = supervisorIdentifier.trim();
    const isHexObjectId = /^[0-9a-fA-F]{24}$/.test(cleanId);

    const supervisor = await User.findOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
      "permissions.role": { $in: ["manager", "admin", "owner", "super_admin"] },
      $or: [
        ...(isHexObjectId ? [{ _id: new mongoose.Types.ObjectId(cleanId) }] : []),
        { "auth.email": cleanId.toLowerCase() },
        { "employment.employeeId": cleanId },
        { "employment.badgeId": cleanId },
      ],
    });

    if (!supervisor) {
      throw new AppError(404, "SUPERVISOR_NOT_FOUND", "Authorized frontline supervisor record not found");
    }

    const pinHash = crypto.createHash("sha256").update(pin.trim()).digest("hex");
    const stored = supervisor.security?.supervisorPinHash;
    const isMatch = stored ? (stored === pinHash || stored === pin.trim()) : false;

    if (!isMatch) {
      throw new AppError(401, "INVALID_SUPERVISOR_PIN", "Invalid supervisor authorization PIN");
    }

    return {
      success: true,
      verified: true,
      supervisor: {
        id: supervisor._id.toString(),
        fullName: supervisor.profile.fullName || `${supervisor.profile.firstName} ${supervisor.profile.lastName}`.trim(),
        role: supervisor.permissions.role,
        department: supervisor.employment?.department || "Operations",
      },
    };
  }

  /**
   * Set / update supervisor 4-digit PIN
   */
  async setSupervisorPin(orgId: string, supervisorId: string, pin: string) {
    if (!pin || pin.trim().length < 4) {
      throw new AppError(400, "BAD_REQUEST", "Supervisor PIN must be at least 4 digits");
    }

    const pinHash = crypto.createHash("sha256").update(pin.trim()).digest("hex");
    const supervisor = await User.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(supervisorId),
        organizationId: new mongoose.Types.ObjectId(orgId),
        isDeleted: false,
      },
      {
        $set: { "security.supervisorPinHash": pinHash },
      },
      { new: true }
    );

    if (!supervisor) {
      throw new AppError(404, "NOT_FOUND", "Supervisor user not found");
    }

    return { success: true, message: "Supervisor PIN set successfully" };
  }

  /**
   * Autonomous Kiosk Fleet Health Sentinel (Prompt 09 Step 3)
   */
  async scanKioskFleetHealth(orgId?: string) {
    const threshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    const query: Record<string, any> = {
      status: "online",
      $or: [
        { lastHeartbeatAt: { $lt: threshold } },
        { lastHeartbeatAt: { $exists: false }, lastSeen: { $lt: threshold } },
      ],
    };

    if (orgId) {
      query.organizationId = new mongoose.Types.ObjectId(orgId);
    }

    const staleDevices = await KioskDeviceModel.find(query);
    const flagged = [];

    for (const device of staleDevices) {
      (device as any).status = "offline";
      await device.save();

      try {
        const NotificationModel = mongoose.model("Notification");
        const admin = await User.findOne({
          organizationId: device.organizationId,
          "permissions.role": { $in: ["admin", "owner"] },
          isDeleted: false,
        });
        if (admin) {
          await NotificationModel.create({
            organizationId: device.organizationId,
            recipientUserId: admin._id,
            type: "manager_alert",
            channel: "in_app",
            title: "Kiosk Terminal Offline Alert",
            message: `Kiosk Terminal ${device.name} in ${device.location} has been offline for 30 minutes. Shift safety briefings may be impacted.`,
            priority: "high",
            status: "sent",
            isRead: false,
          });
        }
      } catch (e) {
        console.warn("[KioskService] Error dispatching offline notification:", e);
      }

      flagged.push({
        deviceId: device.deviceId,
        name: device.name,
        location: device.location,
        lastHeartbeatAt: device.lastHeartbeatAt || device.lastSeen,
      });
    }

    return {
      scannedAt: new Date(),
      offlineCount: flagged.length,
      flaggedDevices: flagged,
    };
  }

  /**
   * Toggle Kiosk Device Maintenance Mode
   */
  async setDeviceMaintenanceMode(id: string, orgId: string, maintenance: boolean) {
    const device = await this.deviceRepo.findByIdAndOrg(id, orgId);
    if (!device) {
      throw new AppError(404, "NOT_FOUND", "Device not found");
    }
    const newStatus = maintenance ? "maintenance" : "online";
    return this.deviceRepo.updateStatus(id, newStatus as any);
  }
}

export default KioskService;
