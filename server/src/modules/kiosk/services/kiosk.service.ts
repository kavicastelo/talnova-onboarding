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
import KioskDeviceModel, { IKioskDevice } from "../models/kiosk-device.model.js";
import { KioskDeviceAssignmentModel } from "../models/kiosk-assignment.model.js";
import User from "../../auth/models/user.model.js";
import { Organization } from "../../organizations/models/organization.model.js";
import { PackageModel } from "../../super-admin/models/package.model.js";
import { KioskJourneyVersionRepository } from "../repositories/kiosk-journey-version.repository.js";
import { IKioskJourneyVersion } from "../models/kiosk-journey-version.model.js";
import { KioskDeviceGroupModel, IKioskDeviceGroup } from "../models/kiosk-device-group.model.js";
import { KioskDeviceGroupRepository } from "../repositories/kiosk-device-group.repository.js";
import { KioskSessionRepository } from "../repositories/kiosk-session.repository.js";
import { KioskSessionModel, IKioskSession } from "../models/kiosk-session.model.js";
import { computeCanonicalStepsChecksum } from "../utils/checksum.util.js";
import { validateJourneyForPublish } from "../validation/journey-publish.validator.js";
import { ValidationReport } from "../types/validation.types.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import { KioskEmergencyModel, IKioskEmergency } from "../models/kiosk-emergency.model.js";
import { KioskDeviceTelemetryModel } from "../models/kiosk-device-telemetry.model.js";
import kioskEmergencyStream from "./kiosk-emergency-stream.js";
import Notification from "../../notifications/models/notification.model.js";
import kioskWebhookService, { KioskWebhookService } from "./kiosk-webhook.service.js";

export class KioskService {
  private readonly journeyVersionRepo: KioskJourneyVersionRepository;
  private readonly deviceGroupRepo: KioskDeviceGroupRepository;
  private readonly sessionRepo: KioskSessionRepository;
  private readonly webhookService: KioskWebhookService;

  constructor(
    private readonly journeyRepo: KioskJourneyRepository,
    private readonly deviceRepo: KioskDeviceRepository,
    private readonly analyticsRepo: KioskAnalyticsRepository,
    private readonly securityService: KioskSecurityService,
    private readonly jwt?: {
      sign: (payload: any, options?: any) => string;
    },
    journeyVersionRepo?: KioskJourneyVersionRepository,
    deviceGroupRepo?: KioskDeviceGroupRepository,
    sessionRepo?: KioskSessionRepository
  ) {
    this.journeyVersionRepo = journeyVersionRepo || new KioskJourneyVersionRepository();
    this.deviceGroupRepo = deviceGroupRepo || new KioskDeviceGroupRepository();
    this.sessionRepo = sessionRepo || new KioskSessionRepository();
    this.webhookService = kioskWebhookService;
  }

  getDeviceRepo(): KioskDeviceRepository {
    return this.deviceRepo;
  }

  async createJourney(orgId: string, data: any, userId: string): Promise<IKioskJourney> {
    if (data.settings?.security?.requireSupervisorWitness !== undefined) {
      if (data.settings.requireSupervisorWitness === undefined) {
        data.settings.requireSupervisorWitness = data.settings.security.requireSupervisorWitness;
      }
      delete data.settings.security.requireSupervisorWitness;
    }
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
    if (data.settings?.security?.requireSupervisorWitness !== undefined) {
      if (data.settings.requireSupervisorWitness === undefined) {
        data.settings.requireSupervisorWitness = data.settings.security.requireSupervisorWitness;
      }
      delete data.settings.security.requireSupervisorWitness;
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

    try {
      await AuditLog.create({
        organizationId: new mongoose.Types.ObjectId(journey.organizationId),
        actorUserId: userId && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : undefined,
        actorType: "user",
        eventCategory: "kiosk",
        eventType: "KIOSK_JOURNEY_PUBLISHED",
        resourceType: "kiosk_journey",
        resourceId: journey._id,
        action: "publish",
        description: `Kiosk journey "${journey.title}" version ${nextVersion} published`,
        metadata: {
          journeyId: journey._id.toString(),
          versionSnapshot: nextVersion,
          version: nextVersion,
          publisherId: userId?.toString(),
          contentChecksum,
          title: journey.title,
          status: targetStatus,
          changelog: changelog || undefined
        },
        severity: "info"
      });
    } catch (auditErr) {
      console.warn("[KioskService] Failed to create audit log for journey publish:", auditErr);
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

  private isAssignmentInSchedulingWindow(assignment: any, now: Date): boolean {
    const scheduling = assignment.scheduling;
  if (!scheduling || !scheduling.enabled) {
    return true;
  }

  if (scheduling.startDate && new Date(scheduling.startDate) > now) {
    return false;
  }

  if (scheduling.endDate && new Date(scheduling.endDate) < now) {
    return false;
  }

  if (Array.isArray(scheduling.daysOfWeek) && scheduling.daysOfWeek.length > 0) {
    const dayOfWeek = now.getUTCDay();
    if (!scheduling.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }
  }

  if (scheduling.startTimeUtc || scheduling.endTimeUtc) {
    const hours = now.getUTCHours().toString().padStart(2, "0");
    const minutes = now.getUTCMinutes().toString().padStart(2, "0");
    const currentUtcTime = `${hours}:${minutes}`;

    const start = scheduling.startTimeUtc;
    const end = scheduling.endTimeUtc;

    if (start && end) {
      if (start <= end) {
        if (currentUtcTime < start || currentUtcTime >= end) {
          return false;
        }
      } else {
        // Overnight window (e.g. 22:00 to 06:00)
        if (currentUtcTime < start && currentUtcTime >= end) {
          return false;
        }
      }
    } else if (start && currentUtcTime < start) {
      return false;
    } else if (end && currentUtcTime >= end) {
      return false;
    }
  }

  return true;
}

  async getDeviceManifest(
    deviceIdOrGuid: string,
    orgId: string,
    now = new Date(),
    requestUser?: any
  ): Promise<{
    deviceId: string;
    organizationId: string;
    device: any;
    launchMode: "launcher" | "autoplay";
    journeys: any[];
    settings: any;
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
      // Check if this device belongs to a different organization (Zero Trust tenant boundary)
      const foreignDevice = isObjectId
        ? await KioskDeviceModel.findById(deviceIdOrGuid)
        : await this.deviceRepo.findByFingerprint(deviceIdOrGuid);

      if (foreignDevice && foreignDevice.organizationId.toString() !== orgId.toString()) {
        if (requestUser?.role === "kiosk_device") {
          throw new AppError(
            403,
            "TENANT_MISMATCH",
            "Cross-tenant access forbidden: Device belongs to another organization."
          );
        }
      }

      throw new AppError(404, "NOT_FOUND", "Device not found");
    }

    // Zero Trust device identity assertion: device token cannot request manifest of a different terminal
    if (requestUser?.role === "kiosk_device") {
      const isSelf =
        device.deviceId === requestUser.deviceId ||
        device.hardwareGuid === requestUser.deviceId ||
        device._id.toString() === requestUser.deviceId;

      if (!isSelf) {
        throw new AppError(
          403,
          "FORBIDDEN",
          "Zero Trust violation: Device token cannot request manifest of a different terminal."
        );
      }
    }

    if (device.status === "suspended" || device.status === "decommissioned") {
      throw new AppError(403, "FORBIDDEN", `Device is ${device.status}. Manifest access denied.`);
    }

    // Fast-path for synthetic fleet health probe terminals (K-REL-003)
    if (device.deviceId.startsWith("SYNTHETIC-PROBE")) {
      const sampleJourney = await KioskJourneyModel.findOne({
        organizationId: new mongoose.Types.ObjectId(orgId),
        isDeleted: false
      }).lean();
      return {
        deviceId: device.deviceId,
        organizationId: orgId,
        device: {
          id: device._id,
          deviceId: device.deviceId,
          name: device.name,
          location: device.location,
          status: device.status,
          paired: device.paired,
          pairedAt: device.pairedAt,
          deviceGroupId: device.deviceGroupId,
          siteId: device.siteId
        },
        launchMode: "autoplay",
        journeys: sampleJourney ? [sampleJourney] : [],
        settings: {
          sessionTimeoutSeconds: 300,
          allowWorkerSelfRegistration: true,
          offlineSyncIntervalSeconds: 60
        }
      };
    }

    // Step 1: Query explicit assignments for device, device_group, and site (ADR-005, K-ASN-003)
    // Find all device groups this device belongs to (both direct membership in group.deviceIds and device.deviceGroupId)
    const groupOrConditions: any[] = [{ deviceIds: device._id }];
    if (device.deviceGroupId) {
      const groupIdStr = device.deviceGroupId.toString();
      if (mongoose.Types.ObjectId.isValid(groupIdStr) && groupIdStr.length === 24) {
        groupOrConditions.push({ _id: new mongoose.Types.ObjectId(groupIdStr) });
      }
    }

    const matchingGroups = await KioskDeviceGroupModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
      $or: groupOrConditions
    });

    const groupIds = new Set<string>();
    const siteIds = new Set<string>();

    if (device.deviceGroupId) {
      groupIds.add(device.deviceGroupId.toString());
    }
    if (device.siteId) {
      siteIds.add(device.siteId.toString());
    }

    for (const group of matchingGroups) {
      groupIds.add(group._id.toString());
      if (group.siteId) {
        siteIds.add(group.siteId.toString());
      }
    }

    const targetConditions: any[] = [
      { targetType: "device", targetId: device._id }
    ];

    for (const gId of groupIds) {
      const isObj = mongoose.Types.ObjectId.isValid(gId) && gId.length === 24;
      targetConditions.push({
        targetType: "device_group",
        targetId: isObj ? new mongoose.Types.ObjectId(gId) : gId
      });
    }

    for (const sId of siteIds) {
      const isObj = mongoose.Types.ObjectId.isValid(sId) && sId.length === 24;
      targetConditions.push({
        targetType: "site",
        targetId: isObj ? new mongoose.Types.ObjectId(sId) : sId
      });
    }

    const explicitAssignments = await KioskDeviceAssignmentModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isActive: true,
      $or: targetConditions
    }).sort({ priority: 1, createdAt: 1 });

    const hasExplicitAssignments = explicitAssignments.length > 0 || !!device.currentJourneyId;

    let candidateJourneys: any[] = [];
    const assignmentMetaByJourneyId = new Map<string, { priority: number; isMandatory: boolean; scheduling?: any }>();

    if (hasExplicitAssignments) {
      // Filter explicit assignments by active status & scheduling window
      const activeScheduledAssignments = explicitAssignments.filter((a) =>
        this.isAssignmentInSchedulingWindow(a, now)
      );

      const candidateJourneyIds = new Set<string>();

      // Target type ranking: device (0) > device_group (100) > site (200)
      for (const a of activeScheduledAssignments) {
        const jId = a.journeyId.toString();
        candidateJourneyIds.add(jId);

        const rankOffset = a.targetType === "device" ? 0 : a.targetType === "device_group" ? 100 : 200;
        const computedPriority = (a.priority ?? 0) + rankOffset;

        if (!assignmentMetaByJourneyId.has(jId)) {
          assignmentMetaByJourneyId.set(jId, {
            priority: computedPriority,
            isMandatory: !!a.isMandatory,
            scheduling: a.scheduling
          });
        } else {
          // If the journey is assigned at multiple levels (e.g. site and device), the lower priority number (higher priority rank) wins
          const existing = assignmentMetaByJourneyId.get(jId)!;
          if (computedPriority < existing.priority) {
            assignmentMetaByJourneyId.set(jId, {
              priority: computedPriority,
              isMandatory: existing.isMandatory || !!a.isMandatory,
              scheduling: a.scheduling || existing.scheduling
            });
          }
        }
      }

      // Legacy fallback if no explicit assignment records exist but currentJourneyId is set
      if (device.currentJourneyId && candidateJourneyIds.size === 0 && explicitAssignments.length === 0) {
        const legacyId = device.currentJourneyId.toString();
        candidateJourneyIds.add(legacyId);
        if (!assignmentMetaByJourneyId.has(legacyId)) {
          assignmentMetaByJourneyId.set(legacyId, {
            priority: 0,
            isMandatory: false
          });
        }
      }

      if (candidateJourneyIds.size > 0) {
        candidateJourneys = await KioskJourneyModel.find({
          _id: { $in: Array.from(candidateJourneyIds).map((id) => new mongoose.Types.ObjectId(id)) },
          organizationId: new mongoose.Types.ObjectId(orgId),
          isDeleted: false
        });
      }
    } else {
      // Step 2 & 3: Fallback rule (ADR-005) - When zero explicit assignments exist,
      // query all published journeys belonging to the organization or site.
      candidateJourneys = await KioskJourneyModel.find({
        organizationId: new mongoose.Types.ObjectId(orgId),
        isDeleted: false,
        "publishing.status": "published"
      }).sort({ createdAt: -1 });
    }

    // Filter candidate journeys by publishing status and journey scheduling rules
    const eligibleJourneys = candidateJourneys.filter((journey) => {
      if (journey.publishing?.status !== "published") {
        return false;
      }
      const scheduling = journey.publishing?.scheduling;
      if (scheduling?.publishAt && new Date(scheduling.publishAt) > now) {
        return false;
      }
      if (scheduling?.expiresAt && new Date(scheduling.expiresAt) <= now) {
        return false;
      }
      return true;
    });

    // Enrich journeys with assignment metadata (priority, isMandatory)
    const enrichedJourneys = eligibleJourneys.map((journey, index) => {
      const jObj = journey.toObject ? journey.toObject() : { ...journey };
      const meta = assignmentMetaByJourneyId.get(journey._id.toString());
      return {
        ...jObj,
        priority: meta ? meta.priority : index,
        isMandatory: meta ? meta.isMandatory : false,
        assignmentScheduling: meta?.scheduling
      };
    });

    // Sort enriched journeys by priority ascending
    enrichedJourneys.sort((a, b) => a.priority - b.priority);

    // Determine launchMode: 'autoplay' if exactly 1 journey and autoPlay is true, else 'launcher'
    const isSingle = enrichedJourneys.length === 1;
    const isAutoPlay = isSingle && (
      enrichedJourneys[0].settings?.autoPlay === true ||
      (device as any).autoPlay === true ||
      (device as any).settings?.autoPlay === true
    );
    const launchMode: "launcher" | "autoplay" = isAutoPlay ? "autoplay" : "launcher";

    // Standard kiosk defaults merged with journey settings if single journey
    const defaultKioskSettings = {
      autoPlay: false,
      loopForever: false,
      idleTimeoutSeconds: 60,
      autoReturnHome: true,
      hideNavigation: false,
      disableExit: true,
      security: { protectionType: "none" }
    };

    const resolvedSettings = isSingle && enrichedJourneys[0].settings
      ? { ...defaultKioskSettings, ...enrichedJourneys[0].settings }
      : defaultKioskSettings;

    const deviceSummary = {
      _id: device._id,
      deviceId: device.deviceId,
      name: device.name,
      location: device.location,
      status: device.status,
      siteId: device.siteId,
      deviceGroupId: device.deviceGroupId,
      paired: device.paired,
      pairedAt: device.pairedAt,
      lastSeen: device.lastSeen,
      telemetry: device.telemetry,
      currentContentVersion: device.currentContentVersion
    };

    return {
      deviceId: device.deviceId,
      organizationId: orgId,
      device: deviceSummary,
      launchMode,
      journeys: enrichedJourneys,
      settings: resolvedSettings
    };
  }

  async resolveManifest(
    deviceIdOrGuid: string,
    orgId: string,
    now: Date = new Date()
  ) {
    return this.getDeviceManifest(deviceIdOrGuid, orgId, now);
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

  async generatePairingCode(orgId: string, deviceId: string, userId?: string): Promise<{ code: string; expiresInSeconds: number }> {
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
    const code = await this.securityService.generatePairingCode(orgId, deviceId, 900000, userId);
    return { code, expiresInSeconds: 900 };
  }

  async pairDevice(code: string, deviceId: string, name: string, location: string, pairedByUserId?: string) {
    const pairingData = await this.securityService.verifyPairingCode(code, deviceId);
    if (!pairingData) {
      throw new AppError(400, "INVALID_OR_EXPIRED_PAIRING_CODE", "Invalid or expired pairing code");
    }

    const { orgId } = pairingData;
    const pairedBy = pairedByUserId || pairingData.createdBy;
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

    try {
      await AuditLog.create({
        organizationId: new mongoose.Types.ObjectId(orgId),
        actorUserId: pairedBy && mongoose.Types.ObjectId.isValid(pairedBy) ? new mongoose.Types.ObjectId(pairedBy) : undefined,
        actorType: "user",
        eventCategory: "kiosk",
        eventType: "KIOSK_DEVICE_PAIRED",
        resourceType: "kiosk_device",
        resourceId: device._id,
        action: "pair",
        description: `Kiosk device ${device.name || deviceId} paired with hardware GUID ${device.hardwareGuid || deviceId}`,
        metadata: {
          deviceId: device.deviceId,
          hardwareGuid: device.hardwareGuid || device.deviceId,
          pairedBy: pairedBy?.toString() || "system",
          name: device.name,
          location: device.location,
          pairedAt: device.pairedAt || new Date()
        },
        severity: "info"
      });
    } catch (auditErr) {
      console.warn("[KioskService] Failed to create audit log for device pairing:", auditErr);
    }

    return { device, token };
  }

  /**
   * K-ENT-002: Mobile Device Management (MDM) Zero-Touch Bulk Enrollment
   * Enrolls tablet/terminal fleets using MDM-injected Managed AppConfig enrollment secrets
   * without requiring manual 6-digit pairing codes.
   */
  async enrollMdmDevice(params: {
    organizationSlug: string;
    enrollmentSecret: string;
    deviceId: string;
    name?: string;
    location?: string;
    deviceModel?: string;
    osVersion?: string;
    appVersion?: string;
  }) {
    const slug = (params.organizationSlug || "").trim().toLowerCase();
    const secret = (params.enrollmentSecret || "").trim();
    const deviceId = (params.deviceId || "").trim();

    if (!slug) {
      throw new AppError(400, "BAD_REQUEST", "organizationSlug is required for MDM enrollment");
    }
    if (!secret) {
      throw new AppError(400, "BAD_REQUEST", "enrollmentSecret is required for MDM enrollment");
    }
    if (!deviceId) {
      throw new AppError(400, "BAD_REQUEST", "deviceHardwareId or deviceId is required for MDM enrollment");
    }

    const org = await Organization.findOne({ slug, isDeleted: false });
    if (!org) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", `Organization with slug '${slug}' not found`);
    }

    // Verify MDM enrollment secret
    const configuredSecret =
      (org.kioskSettings as any)?.mdmEnrollmentSecret ||
      (org.kioskSettings as any)?.enrollmentSecret ||
      (org.integrations as any)?.mdmEnrollmentSecret ||
      (org.integrations as any)?.enrollmentSecret;

    if (!configuredSecret || configuredSecret !== secret) {
      throw new AppError(401, "INVALID_ENROLLMENT_SECRET", "Invalid or expired MDM enrollment secret");
    }

    // Sign token for physical device (90 days expiry, K-DEV-003)
    const token = this.jwt
      ? this.jwt.sign(
          {
            deviceId,
            organizationId: org._id.toString(),
            role: "kiosk_device",
            jti: crypto.randomUUID(),
            enrollmentType: "mdm_appconfig",
          },
          { expiresIn: "90d" }
        )
      : "";

    const tokenRef = crypto.createHash("sha256").update(token).digest("hex");
    const tokenExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    let device = await this.deviceRepo.findByFingerprint(deviceId);
    const deviceName = params.name || device?.name || `MDM Kiosk - ${deviceId.slice(-6).toUpperCase()}`;
    const location = params.location || device?.location || "Enterprise Facility";

    if (device) {
      // Re-enroll / update existing device
      device = await this.deviceRepo.register({
        _id: device._id,
        organizationId: org._id,
        deviceId,
        hardwareGuid: deviceId,
        name: deviceName,
        location,
        status: "online",
        paired: true,
        tokenRef,
        tokenExpiresAt,
        pairedAt: new Date(),
        lastSeen: new Date(),
        deviceModel: params.deviceModel || (device as any).deviceModel,
        osVersion: params.osVersion || (device as any).osVersion,
        appVersion: params.appVersion || (device as any).appVersion,
      } as any);
    } else {
      // Check quota
      const maxKiosks = await this.resolveMaxKiosks(org);
      const currentKiosksCount = await KioskDeviceModel.countDocuments({
        $or: [
          { organizationId: org._id },
          { organizationId: org._id.toString() as any },
        ],
        status: { $ne: "decommissioned" },
      });

      if (currentKiosksCount >= maxKiosks) {
        throw new AppError(
          403,
          "KIOSK_LIMIT_REACHED",
          `Organization kiosk device limit reached (${currentKiosksCount}/${maxKiosks}). Please upgrade your plan to enroll more MDM kiosks.`
        );
      }

      device = await this.deviceRepo.register({
        organizationId: org._id,
        deviceId,
        hardwareGuid: deviceId,
        name: deviceName,
        location,
        status: "online",
        paired: true,
        tokenRef,
        tokenExpiresAt,
        pairedAt: new Date(),
        lastSeen: new Date(),
        currentContentVersion: 0,
        deviceModel: params.deviceModel,
        osVersion: params.osVersion,
        appVersion: params.appVersion,
        telemetry: {},
      } as any);
    }

    try {
      await AuditLog.create({
        organizationId: org._id,
        actorType: "system",
        eventCategory: "kiosk",
        eventType: "KIOSK_MDM_ZERO_TOUCH_ENROLLED",
        resourceType: "kiosk_device",
        resourceId: device._id,
        action: "pair",
        description: `Kiosk device ${device.name} auto-enrolled via MDM Managed AppConfig with hardware ID ${deviceId}`,
        metadata: {
          deviceId,
          organizationSlug: slug,
          hardwareGuid: deviceId,
          deviceModel: params.deviceModel,
          name: device.name,
          location: device.location,
          pairedAt: device.pairedAt || new Date(),
        },
        severity: "info",
      });
    } catch (auditErr) {
      console.warn("[KioskService] Failed to create audit log for MDM enrollment:", auditErr);
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

  async heartbeat(
    deviceId: string,
    orgId: string,
    contentVersion: number,
    telemetry: KioskTelemetry
  ): Promise<{
    success: boolean;
    serverTime: number;
    commands: any[];
    device: IKioskDevice | null;
  }> {
    const device = await this.deviceRepo.findByFingerprint(deviceId);
    if (!device) {
      throw new AppError(404, "NOT_FOUND", "Device registration not found");
    }

    if (device.organizationId.toString() !== orgId.toString()) {
      throw new AppError(403, "TENANT_MISMATCH", "Cross-tenant access forbidden: Tenant mismatch for device");
    }

    const rawExisting = device.telemetry;
    const existingTelemetry: Record<string, any> =
      rawExisting && typeof (rawExisting as any).toObject === "function"
        ? (rawExisting as any).toObject()
        : (rawExisting && (rawExisting as any)._doc
            ? { ...(rawExisting as any)._doc }
            : { ...(rawExisting || {}) });

    delete existingTelemetry.$__;
    delete existingTelemetry.$isNew;
    delete existingTelemetry._doc;

    const cleanIncoming: Record<string, any> = {};
    for (const [key, val] of Object.entries(telemetry || {})) {
      if (val !== undefined) {
        cleanIncoming[key] = val;
      }
    }

    const mergedTelemetry = {
      ...existingTelemetry,
      ...cleanIncoming
    };

    const updatedDevice = await this.deviceRepo.heartbeat(
      device._id as mongoose.Types.ObjectId,
      contentVersion,
      mergedTelemetry
    );

    // K-ANA-001: Record operational time-series telemetry log (30-day rolling TTL)
    try {
      await KioskDeviceTelemetryModel.create({
        organizationId: device.organizationId,
        deviceId: device._id,
        hardwareGuid: device.deviceId || device.hardwareGuid,
        batteryLevel: mergedTelemetry.batteryLevel,
        isCharging: mergedTelemetry.isCharging,
        storageUsedBytes: mergedTelemetry.storageUsedBytes,
        storageFreeBytes: mergedTelemetry.storageFreeBytes,
        storageTotalBytes: mergedTelemetry.storageTotalBytes,
        networkLatencyMs: mergedTelemetry.networkLatencyMs,
        screenResolution: mergedTelemetry.screenResolution,
        orientation: mergedTelemetry.orientation,
        appVersion: mergedTelemetry.appVersion,
        contentVersion,
        ipAddress: (telemetry as any)?.ipAddress || (device as any)?.ipAddress,
        recordedAt: new Date(),
        createdAt: new Date()
      });
    } catch (telemetryErr) {
      console.warn("[KioskService] Error recording device time-series telemetry:", telemetryErr);
    }

    const pendingCommands: any[] = [];
    const currentDevice = await KioskDeviceModel.findById(device._id);

    if (currentDevice?.pendingCommands && currentDevice.pendingCommands.length > 0) {
      for (const cmd of currentDevice.pendingCommands) {
        if (!cmd.status || cmd.status === "pending") {
          pendingCommands.push({
            id: cmd.id,
            type: cmd.type,
            command: cmd.command || cmd.type,
            payload: cmd.payload,
            status: "pending",
            createdAt: cmd.createdAt
          });
        }
      }

      if (pendingCommands.length > 0) {
        await KioskDeviceModel.updateOne(
          { _id: device._id },
          {
            $set: {
              "pendingCommands.$[elem].status": "dispatched",
              "pendingCommands.$[elem].dispatchedAt": new Date()
            }
          },
          {
            arrayFilters: [{ "elem.status": "pending" }]
          }
        );
      }
    }

    const activeEmergency = await this.getActiveEmergency(orgId);
    if (activeEmergency) {
      pendingCommands.push({
        id: `cmd-emergency-${activeEmergency._id}`,
        type: "emergency_override",
        createdAt: activeEmergency.triggeredAt,
        payload: activeEmergency
      });
    }

    return {
      success: true,
      serverTime: Date.now(),
      commands: pendingCommands,
      device: updatedDevice || currentDevice || device
    };
  }

  async queueCommand(
    deviceIdOrGuid: string,
    orgId: string,
    commandData: { type: string; payload?: any; command?: string }
  ): Promise<any> {
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

    const commandType = (commandData.type || commandData.command || "UNKNOWN").trim();
    const commandName = (commandData.command || commandData.type || commandType).trim();

    const newCommand = {
      id: `cmd-${crypto.randomUUID()}`,
      type: commandType,
      command: commandName,
      payload: commandData.payload || {},
      status: "pending",
      createdAt: new Date()
    };

    const updateDoc: any = {
      $push: { pendingCommands: newCommand }
    };

    const upperType = commandType.toUpperCase();
    if (upperType === "ENTER_MAINTENANCE") {
      updateDoc.$set = { status: "maintenance" };
    } else if (upperType === "EXIT_MAINTENANCE") {
      updateDoc.$set = { status: "online" };
    }

    await KioskDeviceModel.updateOne(
      { _id: device._id },
      updateDoc
    );

    return newCommand;
  }

  async getDeviceCommands(deviceIdOrGuid: string, orgId: string, requestUser?: any) {
    const isObjectId = mongoose.Types.ObjectId.isValid(deviceIdOrGuid) && deviceIdOrGuid.length === 24;
    const device = isObjectId
      ? await KioskDeviceModel.findOne({
          _id: new mongoose.Types.ObjectId(deviceIdOrGuid),
          organizationId: new mongoose.Types.ObjectId(orgId),
          isDeleted: false
        })
      : await this.deviceRepo.findByFingerprint(deviceIdOrGuid);

    if (!device || device.organizationId.toString() !== orgId.toString() || device.isDeleted) {
      const foreignDevice = isObjectId
        ? await KioskDeviceModel.findById(deviceIdOrGuid)
        : await this.deviceRepo.findByFingerprint(deviceIdOrGuid);

      if (foreignDevice && foreignDevice.organizationId.toString() !== orgId.toString()) {
        throw new AppError(
          403,
          "TENANT_MISMATCH",
          "Cross-tenant access forbidden: Device belongs to another organization."
        );
      }

      throw new AppError(404, "NOT_FOUND", "Device not found");
    }

    if (requestUser?.role === "kiosk_device") {
      const isSelf =
        device.deviceId === requestUser.deviceId ||
        device.hardwareGuid === requestUser.deviceId ||
        device._id.toString() === requestUser.deviceId;

      if (!isSelf) {
        throw new AppError(
          403,
          "FORBIDDEN",
          "Zero Trust violation: Device token cannot request commands of a different terminal."
        );
      }
    }

    if (device.status === "suspended" || device.status === "decommissioned") {
      throw new AppError(403, "FORBIDDEN", `Device is ${device.status}. Command access denied.`);
    }

    const commands: any[] = [];
    if (device.pendingCommands && device.pendingCommands.length > 0) {
      for (const cmd of device.pendingCommands) {
        if (!cmd.status || cmd.status === "pending") {
          commands.push({
            id: cmd.id,
            type: cmd.type,
            command: cmd.command || cmd.type,
            payload: cmd.payload,
            status: "pending",
            createdAt: cmd.createdAt
          });
        }
      }
    }

    const activeEmergency = await this.getActiveEmergency(orgId);
    if (activeEmergency) {
      commands.push({
        id: `cmd-emergency-${activeEmergency._id}`,
        type: "emergency_override",
        createdAt: activeEmergency.triggeredAt,
        payload: activeEmergency
      });
    }

    return commands;
  }

  async listDevices(filter: any, pagination: any) {
    const result = await this.deviceRepo.find(filter, pagination);
    if (!result.devices || result.devices.length === 0) {
      return result;
    }

    const deviceIds = result.devices.map((d) => d._id);
    const assignments = await KioskDeviceAssignmentModel.find({
      targetId: { $in: deviceIds },
      targetType: "device",
      isActive: true,
    }).sort({ priority: 1, createdAt: 1 });

    const assignmentsByDeviceId = new Map<string, any[]>();
    for (const a of assignments) {
      const key = a.targetId.toString();
      if (!assignmentsByDeviceId.has(key)) {
        assignmentsByDeviceId.set(key, []);
      }
      assignmentsByDeviceId.get(key)!.push(a);
    }

    const enrichedDevices = result.devices.map((device: any) => {
      const devObj = device.toObject ? device.toObject() : { ...device };
      devObj.assignments = assignmentsByDeviceId.get(device._id.toString()) || [];
      return devObj;
    });

    return {
      devices: enrichedDevices,
      total: result.total,
    };
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
      // Keep KioskDeviceAssignmentModel synchronized
      await KioskDeviceAssignmentModel.deleteMany({
        organizationId: new mongoose.Types.ObjectId(orgId),
        targetType: "device",
        targetId: device._id,
      });
      await KioskDeviceAssignmentModel.create({
        organizationId: new mongoose.Types.ObjectId(orgId),
        targetType: "device",
        targetId: device._id,
        journeyId: new mongoose.Types.ObjectId(journeyId),
        priority: 0,
        isMandatory: false,
        scheduling: { enabled: false },
        isActive: true,
        assignedBy: (device as any).registeredBy || device._id,
      });
    } else {
      await KioskDeviceAssignmentModel.deleteMany({
        organizationId: new mongoose.Types.ObjectId(orgId),
        targetType: "device",
        targetId: device._id,
      });
    }
    return this.deviceRepo.pairJourney(id, journeyId);
  }

  async getDeviceAssignments(deviceIdOrGuid: string, orgId: string) {
    const isObjectId = mongoose.Types.ObjectId.isValid(deviceIdOrGuid) && deviceIdOrGuid.length === 24;
    const device = isObjectId
      ? await KioskDeviceModel.findOne({
          _id: new mongoose.Types.ObjectId(deviceIdOrGuid),
          organizationId: new mongoose.Types.ObjectId(orgId),
          isDeleted: false,
        })
      : await this.deviceRepo.findByFingerprint(deviceIdOrGuid);

    if (!device || device.organizationId.toString() !== orgId.toString() || device.isDeleted) {
      throw new AppError(404, "NOT_FOUND", "Device not found");
    }

    const assignments = await KioskDeviceAssignmentModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      targetType: "device",
      targetId: device._id,
      isActive: true,
    }).sort({ priority: 1, createdAt: 1 });

    const journeyIds = assignments.map((a) => a.journeyId);
    const journeys = await KioskJourneyModel.find({
      _id: { $in: journeyIds },
      organizationId: new mongoose.Types.ObjectId(orgId),
    });
    const journeyMap = new Map(journeys.map((j) => [j._id.toString(), j]));

    return assignments.map((assignment) => {
      const journey = journeyMap.get(assignment.journeyId.toString());
      const plain = assignment.toObject ? assignment.toObject() : assignment;
      return {
        ...plain,
        journey: journey ? (journey.toObject ? journey.toObject() : journey) : null,
        title: journey?.title || "",
        journeyTitle: journey?.title || "",
      };
    });
  }

  async setDeviceAssignments(
    deviceIdOrGuid: string,
    orgId: string,
    userId: string,
    payload: any
  ) {
    const isObjectId = mongoose.Types.ObjectId.isValid(deviceIdOrGuid) && deviceIdOrGuid.length === 24;
    const device = isObjectId
      ? await KioskDeviceModel.findOne({
          _id: new mongoose.Types.ObjectId(deviceIdOrGuid),
          organizationId: new mongoose.Types.ObjectId(orgId),
          isDeleted: false,
        })
      : await this.deviceRepo.findByFingerprint(deviceIdOrGuid);

    if (!device || device.organizationId.toString() !== orgId.toString() || device.isDeleted) {
      throw new AppError(404, "NOT_FOUND", "Device not found");
    }

    // Normalize raw payload into structured items
    let rawItems: any[] = [];
    if (Array.isArray(payload)) {
      rawItems = payload;
    } else if (payload && typeof payload === "object") {
      if (Array.isArray(payload.assignments)) {
        rawItems = payload.assignments;
      } else if (Array.isArray(payload.journeyIds)) {
        rawItems = payload.journeyIds.map((id: string, index: number) => ({
          journeyId: id,
          priority: index,
        }));
      } else if (Array.isArray(payload.items)) {
        rawItems = payload.items;
      }
    }

    const items = rawItems.map((item, index) => {
      if (typeof item === "string") {
        return {
          journeyId: item,
          priority: index,
          isMandatory: false,
          scheduling: { enabled: false },
          isActive: true,
        };
      }
      return {
        journeyId: item.journeyId?.toString() || item.id?.toString() || "",
        priority: typeof item.priority === "number" ? item.priority : index,
        isMandatory: typeof item.isMandatory === "boolean" ? item.isMandatory : false,
        scheduling: item.scheduling || { enabled: false },
        isActive: item.isActive !== undefined ? !!item.isActive : true,
      };
    });

    // Validate that all specified journey IDs belong to the same organizationId
    if (items.length > 0) {
      for (const item of items) {
        if (!item.journeyId || !mongoose.Types.ObjectId.isValid(item.journeyId)) {
          throw new AppError(400, "BAD_REQUEST", `Invalid journey ID format: ${item.journeyId}`);
        }
      }

      const distinctJourneyIds = Array.from(new Set(items.map((i) => i.journeyId)));
      const foundJourneys = await KioskJourneyModel.find({
        _id: { $in: distinctJourneyIds.map((id) => new mongoose.Types.ObjectId(id)) },
        organizationId: new mongoose.Types.ObjectId(orgId),
        isDeleted: false,
      });

      if (foundJourneys.length !== distinctJourneyIds.length) {
        throw new AppError(
          400,
          "BAD_REQUEST",
          "One or more journeys are invalid or belong to another organization"
        );
      }
    }

    // Prepare documents to insert
    const assignedBy = userId && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : ((device as any).registeredBy || device._id);

    const docsToInsert = items.map((item, idx) => ({
      organizationId: new mongoose.Types.ObjectId(orgId),
      targetType: "device" as const,
      targetId: device._id,
      journeyId: new mongoose.Types.ObjectId(item.journeyId),
      priority: typeof item.priority === "number" ? item.priority : idx,
      isMandatory: !!item.isMandatory,
      scheduling: item.scheduling || { enabled: false },
      isActive: item.isActive !== undefined ? item.isActive : true,
      assignedBy,
    }));

    // Atomically synchronize assignment documents for the target device
    const session = await mongoose.startSession().catch(() => null);
    if (session) {
      try {
        await session.withTransaction(async () => {
          await KioskDeviceAssignmentModel.deleteMany(
            {
              organizationId: new mongoose.Types.ObjectId(orgId),
              targetType: "device",
              targetId: device._id,
            },
            { session }
          );
          if (docsToInsert.length > 0) {
            await KioskDeviceAssignmentModel.insertMany(docsToInsert, { session });
          }
        });
      } catch {
        await KioskDeviceAssignmentModel.deleteMany({
          organizationId: new mongoose.Types.ObjectId(orgId),
          targetType: "device",
          targetId: device._id,
        });
        if (docsToInsert.length > 0) {
          await KioskDeviceAssignmentModel.insertMany(docsToInsert);
        }
      } finally {
        await session.endSession();
      }
    } else {
      await KioskDeviceAssignmentModel.deleteMany({
        organizationId: new mongoose.Types.ObjectId(orgId),
        targetType: "device",
        targetId: device._id,
      });
      if (docsToInsert.length > 0) {
        await KioskDeviceAssignmentModel.insertMany(docsToInsert);
      }
    }

    // Maintain backward compatibility on device.currentJourneyId
    if (docsToInsert.length > 0) {
      const sortedByPriority = [...docsToInsert].sort((a, b) => a.priority - b.priority);
      await KioskDeviceModel.updateOne(
        { _id: device._id },
        { $set: { currentJourneyId: sortedByPriority[0].journeyId } }
      );
    } else {
      await KioskDeviceModel.updateOne(
        { _id: device._id },
        { $unset: { currentJourneyId: 1 } }
      );
    }

    return this.getDeviceAssignments(deviceIdOrGuid, orgId);
  }

  async revokeDevice(id: string, orgId: string, userId?: string, reason?: string) {
    const revoked = await this.deviceRepo.revoke(id, orgId, userId);
    if (!revoked) {
      throw new AppError(404, "NOT_FOUND", "Kiosk device not found");
    }

    try {
      await AuditLog.create({
        organizationId: new mongoose.Types.ObjectId(orgId),
        actorUserId: userId && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : undefined,
        actorType: "user",
        eventCategory: "kiosk",
        eventType: "KIOSK_DEVICE_REVOKED",
        resourceType: "kiosk_device",
        resourceId: revoked._id,
        action: "revoke",
        description: `Kiosk device ${revoked.name || revoked.deviceId} revoked. Reason: ${reason || "Administrative revocation"}`,
        metadata: {
          deviceId: revoked.deviceId,
          hardwareGuid: revoked.hardwareGuid || revoked.deviceId,
          reason: reason || "Administrative revocation",
          adminId: userId?.toString() || "system",
          name: revoked.name,
          location: revoked.location,
          revokedAt: new Date()
        },
        severity: "warning"
      });
    } catch (auditErr) {
      console.warn("[KioskService] Failed to create audit log for device revocation:", auditErr);
    }

    return revoked;
  }

  // --- Device Group Management (K-ASN-003) ---

  async createDeviceGroup(orgId: string, userId: string, data: any) {
    if (!data || !data.name || typeof data.name !== "string" || !data.name.trim()) {
      throw new AppError(400, "BAD_REQUEST", "Device group name is required");
    }

    let validDeviceIds: mongoose.Types.ObjectId[] = [];
    if (Array.isArray(data.deviceIds) && data.deviceIds.length > 0) {
      for (const devId of data.deviceIds) {
        if (!mongoose.Types.ObjectId.isValid(devId.toString())) {
          throw new AppError(400, "BAD_REQUEST", `Invalid device ID: ${devId}`);
        }
      }
      const deviceObjectIds = data.deviceIds.map((id: string) => new mongoose.Types.ObjectId(id.toString()));
      const count = await KioskDeviceModel.countDocuments({
        _id: { $in: deviceObjectIds },
        organizationId: new mongoose.Types.ObjectId(orgId),
        isDeleted: false
      });
      if (count !== deviceObjectIds.length) {
        throw new AppError(400, "BAD_REQUEST", "One or more devices do not exist or belong to another organization");
      }
      validDeviceIds = deviceObjectIds;
    }

    const group = await this.deviceGroupRepo.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      name: data.name.trim(),
      description: data.description ? data.description.trim() : undefined,
      siteId: data.siteId ? data.siteId.trim() : null,
      deviceIds: validDeviceIds,
      createdBy: userId && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : undefined,
      isDeleted: false
    });

    return group;
  }

  async getDeviceGroups(orgId: string, filter?: { siteId?: string; search?: string }) {
    const groups = await this.deviceGroupRepo.findByOrg(orgId, filter);
    const groupIds = groups.map((g) => g._id);

    const assignmentCounts = await KioskDeviceAssignmentModel.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(orgId),
          targetType: "device_group",
          targetId: { $in: groupIds },
          isActive: true
        }
      },
      {
        $group: {
          _id: "$targetId",
          count: { $sum: 1 }
        }
      }
    ]);
    const countMap = new Map(assignmentCounts.map((c) => [c._id.toString(), c.count]));

    return groups.map((g) => {
      const plain = g.toObject ? g.toObject() : g;
      return {
        ...plain,
        deviceCount: plain.deviceIds?.length || 0,
        assignmentCount: countMap.get(g._id.toString()) || 0
      };
    });
  }

  async getDeviceGroupById(id: string, orgId: string) {
    const group = await this.deviceGroupRepo.findById(id, orgId);
    if (!group) {
      throw new AppError(404, "NOT_FOUND", "Device group not found");
    }

    const devices = await KioskDeviceModel.find({
      _id: { $in: group.deviceIds },
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false
    });

    const assignments = await this.getGroupAssignments(id, orgId);
    const plain = group.toObject ? group.toObject() : group;

    return {
      ...plain,
      devices,
      deviceCount: group.deviceIds.length,
      assignments
    };
  }

  async updateDeviceGroup(id: string, orgId: string, data: any) {
    const group = await this.deviceGroupRepo.findById(id, orgId);
    if (!group) {
      throw new AppError(404, "NOT_FOUND", "Device group not found");
    }

    const updates: any = {};
    if (data.name !== undefined) {
      if (typeof data.name !== "string" || !data.name.trim()) {
        throw new AppError(400, "BAD_REQUEST", "Device group name cannot be empty");
      }
      updates.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updates.description = data.description ? data.description.trim() : "";
    }
    if (data.siteId !== undefined) {
      updates.siteId = data.siteId ? data.siteId.trim() : null;
    }
    if (data.deviceIds !== undefined) {
      if (!Array.isArray(data.deviceIds)) {
        throw new AppError(400, "BAD_REQUEST", "deviceIds must be an array");
      }
      for (const devId of data.deviceIds) {
        if (!mongoose.Types.ObjectId.isValid(devId.toString())) {
          throw new AppError(400, "BAD_REQUEST", `Invalid device ID: ${devId}`);
        }
      }
      const deviceObjectIds = data.deviceIds.map((devId: string) => new mongoose.Types.ObjectId(devId.toString()));
      if (deviceObjectIds.length > 0) {
        const count = await KioskDeviceModel.countDocuments({
          _id: { $in: deviceObjectIds },
          organizationId: new mongoose.Types.ObjectId(orgId),
          isDeleted: false
        });
        if (count !== deviceObjectIds.length) {
          throw new AppError(400, "BAD_REQUEST", "One or more devices do not exist or belong to another organization");
        }
      }
      updates.deviceIds = deviceObjectIds;
    }

    const updated = await this.deviceGroupRepo.update(id, orgId, updates);
    return updated;
  }

  async deleteDeviceGroup(id: string, orgId: string) {
    const group = await this.deviceGroupRepo.findById(id, orgId);
    if (!group) {
      throw new AppError(404, "NOT_FOUND", "Device group not found");
    }
    await this.deviceGroupRepo.delete(id, orgId);
    await KioskDeviceAssignmentModel.deleteMany({
      organizationId: new mongoose.Types.ObjectId(orgId),
      targetType: "device_group",
      targetId: group._id
    });
    return { success: true };
  }

  async getGroupAssignments(groupId: string, orgId: string) {
    const group = await this.deviceGroupRepo.findById(groupId, orgId);
    if (!group) {
      throw new AppError(404, "NOT_FOUND", "Device group not found");
    }

    const assignments = await KioskDeviceAssignmentModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      targetType: "device_group",
      targetId: group._id,
      isActive: true
    }).sort({ priority: 1, createdAt: 1 });

    const journeyIds = assignments.map((a) => a.journeyId);
    const journeys = await KioskJourneyModel.find({
      _id: { $in: journeyIds },
      organizationId: new mongoose.Types.ObjectId(orgId)
    });
    const journeyMap = new Map(journeys.map((j) => [j._id.toString(), j]));

    return assignments.map((assignment) => {
      const journey = journeyMap.get(assignment.journeyId.toString());
      const plain = assignment.toObject ? assignment.toObject() : assignment;
      return {
        ...plain,
        journey: journey ? (journey.toObject ? journey.toObject() : journey) : null,
        title: journey?.title || "",
        journeyTitle: journey?.title || ""
      };
    });
  }

  async setGroupAssignments(groupId: string, orgId: string, userId: string, payload: any) {
    const group = await this.deviceGroupRepo.findById(groupId, orgId);
    if (!group) {
      throw new AppError(404, "NOT_FOUND", "Device group not found");
    }

    let rawItems: any[] = [];
    if (Array.isArray(payload)) {
      rawItems = payload;
    } else if (payload && typeof payload === "object") {
      if (Array.isArray(payload.assignments)) {
        rawItems = payload.assignments;
      } else if (Array.isArray(payload.journeyIds)) {
        rawItems = payload.journeyIds.map((id: string, index: number) => ({
          journeyId: id,
          priority: index
        }));
      } else if (Array.isArray(payload.items)) {
        rawItems = payload.items;
      }
    }

    const items = rawItems.map((item, index) => {
      if (typeof item === "string") {
        return {
          journeyId: item,
          priority: index,
          isMandatory: false,
          scheduling: { enabled: false },
          isActive: true
        };
      }
      return {
        journeyId: item.journeyId?.toString() || item.id?.toString() || "",
        priority: typeof item.priority === "number" ? item.priority : index,
        isMandatory: typeof item.isMandatory === "boolean" ? item.isMandatory : false,
        scheduling: item.scheduling || { enabled: false },
        isActive: item.isActive !== undefined ? !!item.isActive : true
      };
    });

    if (items.length > 0) {
      for (const item of items) {
        if (!item.journeyId || !mongoose.Types.ObjectId.isValid(item.journeyId)) {
          throw new AppError(400, "BAD_REQUEST", `Invalid journey ID format: ${item.journeyId}`);
        }
      }

      const distinctJourneyIds = Array.from(new Set(items.map((i) => i.journeyId)));
      const foundJourneys = await KioskJourneyModel.find({
        _id: { $in: distinctJourneyIds.map((id) => new mongoose.Types.ObjectId(id)) },
        organizationId: new mongoose.Types.ObjectId(orgId),
        isDeleted: false
      });

      if (foundJourneys.length !== distinctJourneyIds.length) {
        throw new AppError(
          400,
          "BAD_REQUEST",
          "One or more journeys are invalid or belong to another organization"
        );
      }
    }

    const assignedBy = userId && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : group._id;

    const docsToInsert = items.map((item, idx) => ({
      organizationId: new mongoose.Types.ObjectId(orgId),
      targetType: "device_group" as const,
      targetId: group._id,
      journeyId: new mongoose.Types.ObjectId(item.journeyId),
      priority: typeof item.priority === "number" ? item.priority : idx,
      isMandatory: !!item.isMandatory,
      scheduling: item.scheduling || { enabled: false },
      isActive: item.isActive !== undefined ? item.isActive : true,
      assignedBy
    }));

    await KioskDeviceAssignmentModel.deleteMany({
      organizationId: new mongoose.Types.ObjectId(orgId),
      targetType: "device_group",
      targetId: group._id
    });

    if (docsToInsert.length > 0) {
      await KioskDeviceAssignmentModel.insertMany(docsToInsert);
    }

    return this.getGroupAssignments(groupId, orgId);
  }

  // --- Analytics Sync ---

  async syncAnalytics(orgId: string, payload: any, hardwareDeviceId?: string) {
    const rawItems = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.events)
          ? payload.events
          : (Array.isArray(payload?.sessions)
              ? payload.sessions
              : (Array.isArray(payload?.completedSessions)
                  ? payload.completedSessions
                  : [])));

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

    // Check if any individual event payload has an organizationId that doesn't match
    for (const item of rawItems) {
      if (item.organizationId && item.organizationId.toString() !== orgId.toString()) {
        throw new AppError(
          403,
          "TENANT_MISMATCH",
          "Cross-tenant access forbidden: Analytics payload item specifies a different organization."
        );
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

    // Assert that none of the specified journeys belong to a different organization (Zero Trust tenant boundary)
    const crossTenantJourneys = await KioskJourneyModel.find({
      $or: [
        { _id: { $in: validObjectIds.map((id) => new mongoose.Types.ObjectId(id)) } },
        { journeyCode: { $in: rawJourneyIds } }
      ],
      organizationId: { $ne: new mongoose.Types.ObjectId(orgId) },
      isDeleted: false
    });

    if (crossTenantJourneys.length > 0) {
      throw new AppError(
        403,
        "TENANT_MISMATCH",
        `Cross-tenant access forbidden: Journey ${crossTenantJourneys[0]._id} belongs to another organization.`
      );
    }

    const journeys = await KioskJourneyModel.find({
      $or: [
        { _id: { $in: validObjectIds.map((id) => new mongoose.Types.ObjectId(id)) } },
        { journeyCode: { $in: rawJourneyIds } }
      ],
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false
    });

    if (journeys.length === 0) {
      throw new AppError(400, "BAD_REQUEST", "No matching active journeys found for specified journey identifiers");
    }

    let syncedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    const syncedSessions: any[] = [];
    const normalizedDocs: any[] = [];

    const dateKey = new Date().toISOString().split("T")[0];

    for (const item of rawItems) {
      const matchedJourney = journeys.find(
        (j) => j._id.toString() === item.journeyId || j.journeyCode === item.journeyId
      );

      if (!matchedJourney) {
        failedCount++;
        continue;
      }

      const journeyId = matchedJourney._id as mongoose.Types.ObjectId;
      const journeyVersion = matchedJourney.publishing?.version || 1;
      const languageUsed = item.languageUsed || matchedJourney.languages?.[0] || (matchedJourney.settings as any)?.defaultLanguage || "en";
      const eventType = item.eventType || item.interactions?.[0]?.eventType || "COMPLETED";
      const stepId = item.stepId || item.currentStepId || item.interactions?.[0]?.stepId || "step-finish";
      const durationSeconds = item.durationSeconds || item.metrics?.durationSeconds || 0;
      const completedCount = (eventType && eventType.toUpperCase().includes("COMPLETED")) ? 1 : (item.metrics?.completedCount || 1);

      // K-OFF-003: Idempotent session sync handling for offline completed sessions
      if (item.clientSessionId) {
        // 1. Check if clientSessionId already exists in KioskSessionModel
        const existingSession = await KioskSessionModel.findOne({
          organizationId: new mongoose.Types.ObjectId(orgId),
          clientSessionId: item.clientSessionId
        });

        if (existingSession) {
          // 2. If exists: skip insertion (idempotent no-op)
          duplicateCount++;
          continue;
        }

        try {
          // 3. If new: insert KioskSession
          const sessionDeviceId =
            deviceObjectId ||
            (item.deviceId && mongoose.Types.ObjectId.isValid(item.deviceId)
              ? new mongoose.Types.ObjectId(item.deviceId)
              : matchedJourney.organizationId);

          const newSession = await KioskSessionModel.create({
            organizationId: new mongoose.Types.ObjectId(orgId),
            deviceId: sessionDeviceId,
            journeyId: matchedJourney._id,
            journeyVersionId:
              item.journeyVersionId && mongoose.Types.ObjectId.isValid(item.journeyVersionId)
                ? new mongoose.Types.ObjectId(item.journeyVersionId)
                : undefined,
            versionNumber: item.versionNumber || matchedJourney.publishing?.version || 1,
            userId:
              item.userId && mongoose.Types.ObjectId.isValid(item.userId)
                ? new mongoose.Types.ObjectId(item.userId)
                : undefined,
            clientSessionId: item.clientSessionId,
            sessionToken: item.sessionToken || `offline_${item.clientSessionId}`,
            status: item.status || "completed",
            startedAt: item.startedAt ? new Date(item.startedAt) : new Date(),
            completedAt: item.completedAt ? new Date(item.completedAt) : new Date(),
            durationSeconds,
            currentStepId: item.currentStepId || stepId,
            completedStepIds: Array.isArray(item.completedStepIds) ? item.completedStepIds : [],
            ppeItemsVerified: Array.isArray(item.ppeItemsVerified) ? item.ppeItemsVerified : [],
            quizScore: typeof item.quizScore === "number" ? item.quizScore : undefined,
            supervisorWitness: item.supervisorWitness,
            verificationChecksum: item.verificationChecksum,
            isOfflineSync: true
          });

          // 3b. Create completion audit record
          try {
            await AuditLog.create({
              organizationId: new mongoose.Types.ObjectId(orgId),
              actorUserId: newSession.userId,
              actorType: "api",
              eventCategory: "journey",
              eventType: "KIOSK_OFFLINE_SESSION_SYNCED",
              resourceType: "KioskSession",
              resourceId: newSession._id,
              action: "complete",
              description: `Synchronized offline completed kiosk session for journey "${matchedJourney.title}"`,
              metadata: {
                clientSessionId: item.clientSessionId,
                journeyId: matchedJourney._id,
                durationSeconds: newSession.durationSeconds,
                quizScore: newSession.quizScore,
                ppeItemsVerified: newSession.ppeItemsVerified,
                isOfflineSync: true
              },
              severity: "info"
            });

            // Kiosk compliance audit event
            await AuditLog.create({
              organizationId: new mongoose.Types.ObjectId(orgId),
              actorUserId: newSession.userId,
              actorType: newSession.userId ? "user" : "system",
              eventCategory: "kiosk",
              eventType: "KIOSK_COMPLETION_RECORDED",
              resourceType: "kiosk_session",
              resourceId: newSession._id,
              action: "complete",
              description: `Kiosk completion recorded (offline sync) for employee ${newSession.userId || "anonymous"} on journey version ${matchedJourney.publishing?.version || 1}`,
              metadata: {
                employeeId: newSession.userId?.toString() || "",
                journeyId: matchedJourney._id?.toString(),
                journeyVersion: matchedJourney.publishing?.version || 1,
                verificationChecksum: item.verificationChecksum,
                sessionId: newSession._id.toString(),
                deviceId: item.deviceId,
                isOfflineSync: true
              },
              severity: "info"
            });
          } catch (auditErr) {
            console.warn("[KioskService] Failed to create audit log for offline sync:", auditErr);
          }

          // 3c. Update employee onboarding roadmap progress
          if (newSession.userId) {
            try {
              const UserModel = mongoose.models.User || (mongoose.modelNames().includes("User") ? mongoose.model("User") : null);
              if (UserModel) {
                await UserModel.updateOne(
                  { _id: newSession.userId },
                  {
                    $inc: { "statistics.completedJourneys": 1 },
                    $set: { "statistics.lastActiveAt": new Date() },
                    $addToSet: { completedKioskJourneys: matchedJourney._id }
                  }
                );
              }

              const AssignmentModel =
                mongoose.models.Assignment ||
                (mongoose.modelNames().includes("Assignment") ? mongoose.model("Assignment") : null);
              if (AssignmentModel) {
                await AssignmentModel.updateMany(
                  {
                    employeeId: newSession.userId,
                    journeyId: matchedJourney._id,
                    status: { $ne: "completed" }
                  },
                  {
                    $set: {
                      status: "completed",
                      completedAt: new Date(),
                      "progress.completionPercentage": 100,
                      "progress.status": "completed"
                    }
                  }
                );
              }
            } catch (userErr) {
              console.warn("[KioskService] Failed to update employee roadmap progress for offline sync:", userErr);
            }
          }

          syncedCount++;
          syncedSessions.push(newSession);
        } catch (insertErr) {
          console.error("[KioskService] Failed to insert offline session:", insertErr);
          failedCount++;
          continue;
        }
      } else {
        // Legacy event without clientSessionId
        syncedCount++;
      }

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

      normalizedDocs.push({
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
      });
    }

    if (normalizedDocs.length > 0) {
      try {
        await this.analyticsRepo.bulkSync(normalizedDocs);
      } catch (err) {
        console.warn("[KioskService] Analytics bulkSync aggregate warning:", err);
      }
    }

    return {
      syncedCount,
      duplicateCount,
      failedCount,
      sessions: syncedSessions,
      items: syncedSessions
    };
  }

  async getJourneyAnalyticsSummary(journeyId: string, orgId: string, startDate?: string, endDate?: string) {
    const journey = await this.journeyRepo.findByIdAndOrg(journeyId, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    return this.analyticsRepo.getSummary(orgId, journeyId, startDate, endDate);
  }

  /**
   * K-ANA-001: Step Funnel Drop-off Analysis (Aggregated, PII-Free)
   */
  async getJourneyDropOffFunnel(journeyId: string, orgId: string, startDate?: string, endDate?: string) {
    const journey = await this.journeyRepo.findByIdAndOrg(journeyId, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }
    return this.analyticsRepo.getStepDropOffFunnel(orgId, journeyId, startDate, endDate);
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
      name: worker.profile.fullName || `${worker.profile.firstName} ${worker.profile.lastName}`.trim(),
      email: worker.auth?.email,
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
   * Frontline supervisor PIN authorization verification (UQ-01 Resolution, K-SUP-001)
   */
  async verifySupervisorPin(
    firstArg:
      | string
      | undefined
      | {
          orgId?: string;
          organizationId?: string;
          supervisorIdentifier?: string;
          supervisorId?: string;
          pin: string;
          sessionId?: string;
        },
    secondArg?: string,
    thirdArg?: string,
    fourthArg?: string
  ) {
    let orgId: string | undefined;
    let supervisorIdentifier: string;
    let pin: string;
    let sessionId: string | undefined;

    if (typeof firstArg === "object" && firstArg !== null) {
      orgId = firstArg.orgId || firstArg.organizationId;
      supervisorIdentifier = (firstArg.supervisorIdentifier || firstArg.supervisorId || "") as string;
      pin = firstArg.pin;
      sessionId = firstArg.sessionId;
    } else {
      orgId = firstArg;
      supervisorIdentifier = secondArg || "";
      pin = thirdArg || "";
      sessionId = fourthArg;
    }

    if (!supervisorIdentifier || !pin) {
      throw new AppError(400, "BAD_REQUEST", "Supervisor identifier and 4-digit PIN are required");
    }

    // If orgId wasn't passed directly, attempt resolution via sessionId
    let targetOrgId = orgId;
    let session: IKioskSession | null = null;
    if (sessionId) {
      session = await this.sessionRepo.findById(sessionId);
      if (!session) {
        throw new AppError(404, "NOT_FOUND", "Kiosk session not found");
      }
      if (!targetOrgId && session.organizationId) {
        targetOrgId = session.organizationId.toString();
      }
    }

    if (!targetOrgId) {
      throw new AppError(400, "BAD_REQUEST", "organizationId is required for supervisor authorization");
    }

    const cleanId = supervisorIdentifier.trim();
    const isHexObjectId = /^[0-9a-fA-F]{24}$/.test(cleanId);

    // Requirement 1: Assert supervisor has role in ['owner', 'admin', 'manager', 'supervisor', 'super_admin']
    const allowedRoles = ["owner", "admin", "manager", "supervisor", "super_admin"];

    const supervisor = await User.findOne({
      organizationId: new mongoose.Types.ObjectId(targetOrgId),
      isDeleted: false,
      "permissions.role": { $in: allowedRoles },
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

    const now = new Date();

    // K-SUP-003: Rate Limiting & Account Lockout Enforcement
    const lockedUntil = supervisor.security?.supervisorPinLockedUntil;
    if (lockedUntil && lockedUntil > now) {
      const remainingMs = lockedUntil.getTime() - now.getTime();
      const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
      throw new AppError(
        429,
        "TOO_MANY_REQUESTS",
        `Supervisor witness capability is locked due to excessive failed attempts. Please retry in ${remainingSeconds} seconds.`,
        { remainingSeconds, retryAfter: remainingSeconds, lockedUntil: lockedUntil.toISOString() }
      );
    }

    // Auto-clear expired lockout window
    if (lockedUntil && lockedUntil <= now && (supervisor.security?.failedSupervisorPinAttempts || 0) > 0) {
      await User.findByIdAndUpdate(supervisor._id, {
        $set: {
          "security.failedSupervisorPinAttempts": 0,
          "security.supervisorPinLockedUntil": null,
        },
      });
    }

    // Requirement 2: Timing-safe PIN hash comparison using crypto.timingSafeEqual
    const pinStr = pin.trim();
    const pinHashHex = crypto.createHash("sha256").update(pinStr).digest("hex");
    const stored = supervisor.security?.supervisorPinHash;

    let isMatch = false;
    if (stored) {
      if (/^[0-9a-fA-F]{64}$/.test(stored)) {
        const storedBuf = Buffer.from(stored.toLowerCase(), "hex");
        const pinBuf = Buffer.from(pinHashHex.toLowerCase(), "hex");
        if (storedBuf.length === pinBuf.length && crypto.timingSafeEqual(storedBuf, pinBuf)) {
          isMatch = true;
        }
      } else {
        const storedBuf = Buffer.from(stored);
        const pinBuf = Buffer.from(pinStr);
        if (storedBuf.length === pinBuf.length && crypto.timingSafeEqual(storedBuf, pinBuf)) {
          isMatch = true;
        }
      }
    }

    if (!isMatch) {
      // Calculate consecutive failed PIN attempts
      const previousFailures = supervisor.security?.failedSupervisorPinAttempts || 0;
      const newFailures = previousFailures + 1;

      // If 3 consecutive incorrect PINs are reached: lock account for 5 minutes (300s) and log audit alert
      if (newFailures >= 3) {
        const lockoutDurationMs = 5 * 60 * 1000;
        const newLockedUntil = new Date(Date.now() + lockoutDurationMs);

        await User.findByIdAndUpdate(supervisor._id, {
          $set: {
            "security.supervisorPinLockedUntil": newLockedUntil,
            "security.failedSupervisorPinAttempts": newFailures,
          },
          $inc: { "security.failedLoginAttempts": 1 },
        });

        // Log security alert in audit log (SUPERVISOR_PIN_LOCKOUT)
        await AuditLog.create({
          organizationId: supervisor.organizationId,
          actorUserId: supervisor._id,
          actorType: "user",
          eventCategory: "security",
          eventType: "SUPERVISOR_PIN_LOCKOUT",
          resourceType: "user",
          resourceId: supervisor._id,
          action: "status_change",
          description: `Supervisor witness capability locked for 5 minutes after ${newFailures} consecutive failed PIN attempts`,
          metadata: {
            supervisorId: supervisor._id.toString(),
            failedAttempts: newFailures,
            lockedUntil: newLockedUntil.toISOString(),
            lockoutDurationSeconds: 300,
            sessionId: sessionId || session?._id?.toString() || null,
          },
          severity: "critical",
        });

        // K-ENT-003: Dispatch kiosk.device.tampered enterprise webhook
        try {
          await this.webhookService.publishEvent(supervisor.organizationId, "kiosk.device.tampered", {
            tamperType: "pin_lockout",
            consecutiveFailedAttempts: newFailures,
            lockedUntil: newLockedUntil.toISOString(),
            lockoutDurationSeconds: 300,
            supervisorId: supervisor._id.toString(),
            sessionId: sessionId || session?._id?.toString() || null,
            deviceId: session?.deviceId || undefined,
            description: `Supervisor witness capability locked for 5 minutes after ${newFailures} consecutive failed PIN attempts`,
            detectedAt: new Date().toISOString(),
          });
        } catch (tamperErr) {
          console.warn("[KioskService] Error dispatching device.tampered webhook:", tamperErr);
        }

        throw new AppError(
          401,
          "INVALID_SUPERVISOR_PIN",
          "Invalid supervisor authorization PIN. Account has been locked for 5 minutes due to 3 consecutive failed attempts."
        );
      }

      // Less than 3 failures: atomically increment failure counters
      await User.findByIdAndUpdate(supervisor._id, {
        $set: { "security.failedSupervisorPinAttempts": newFailures },
        $inc: { "security.failedLoginAttempts": 1 },
      });
      throw new AppError(401, "INVALID_SUPERVISOR_PIN", "Invalid supervisor authorization PIN");
    }

    // Reset failed attempts and clear lockout on successful PIN verification
    await User.findByIdAndUpdate(supervisor._id, {
      $set: {
        "security.failedSupervisorPinAttempts": 0,
        "security.failedLoginAttempts": 0,
        "security.supervisorPinLockedUntil": null,
      },
    });

    let updatedSession: IKioskSession | null = null;

    // When sessionId is provided:
    // 1. Bind supervisorWitness attestation to KioskSession
    // 2. Transition session status from 'awaiting_supervisor' back to 'active' or unlock completion
    // 3. Log audit event KIOSK_SUPERVISOR_WITNESS_CONFIRMED
    if (session) {
      const supervisorWitness = {
        supervisorId: supervisor._id,
        witnessedAt: now,
        method: "pin" as const,
      };

      const updateSet: Record<string, any> = {
        supervisorWitness,
      };

      if (session.status === "awaiting_supervisor") {
        updateSet.status = "active";
      }

      updatedSession = await KioskSessionModel.findByIdAndUpdate(
        session._id,
        { $set: updateSet },
        { new: true }
      );

      // Audit event KIOSK_SUPERVISOR_WITNESS_CONFIRMED
      await AuditLog.create({
        organizationId: supervisor.organizationId,
        actorUserId: supervisor._id,
        actorType: "user",
        eventCategory: "security",
        eventType: "KIOSK_SUPERVISOR_WITNESS_CONFIRMED",
        resourceType: "kiosk_session",
        resourceId: session._id,
        action: "update",
        description: `Supervisor ${supervisor.profile?.fullName || supervisor.auth?.email} confirmed witness attestation for kiosk session ${session._id}`,
        metadata: {
          sessionId: session._id.toString(),
          supervisorId: supervisor._id.toString(),
          supervisorRole: supervisor.permissions.role,
          method: "pin",
          witnessedAt: now,
          previousStatus: session.status,
          newStatus: updateSet.status || session.status,
        },
        severity: "info",
      });

      // Compliance Audit event: KIOSK_SUPERVISOR_WITNESSED
      try {
        await AuditLog.create({
          organizationId: supervisor.organizationId,
          actorUserId: supervisor._id,
          actorType: "user",
          eventCategory: "kiosk",
          eventType: "KIOSK_SUPERVISOR_WITNESSED",
          resourceType: "kiosk_session",
          resourceId: session._id,
          action: "witness",
          description: `Supervisor ${supervisor.profile?.fullName || supervisor.auth?.email} witnessed kiosk session for employee ${session.userId || "anonymous"}`,
          metadata: {
            supervisorId: supervisor._id.toString(),
            employeeId: session.userId?.toString() || "",
            sessionId: session._id.toString(),
            deviceId: session.deviceId,
            method: "pin",
            witnessedAt: now
          },
          severity: "info",
        });
      } catch (auditErr) {
        console.warn("[KioskService] Failed to create audit log for supervisor witness:", auditErr);
      }
    }

    // Requirement 3: Return signed witness verification token or session update confirmation
    const witnessToken = this.jwt ? this.jwt.sign({
      sub: supervisor._id.toString(),
      sessionId: session ? session._id.toString() : undefined,
      supervisorId: supervisor._id.toString(),
      role: supervisor.permissions.role,
      method: "pin",
      type: "kiosk_supervisor_witness",
      witnessedAt: now.toISOString(),
    }, { expiresIn: "15m" }) : undefined;

    return {
      success: true,
      verified: true,
      witnessToken,
      supervisor: {
        id: supervisor._id.toString(),
        fullName: supervisor.profile.fullName || `${supervisor.profile.firstName} ${supervisor.profile.lastName}`.trim(),
        role: supervisor.permissions.role,
        department: supervisor.employment?.department || "Operations",
      },
      session: updatedSession ? {
        _id: updatedSession._id.toString(),
        status: updatedSession.status,
        supervisorWitness: updatedSession.supervisorWitness,
        currentStepId: updatedSession.currentStepId,
        completedStepIds: updatedSession.completedStepIds,
      } : undefined,
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
   * Autonomous Kiosk Fleet Health Sentinel (K-ANA-002)
   * Detects:
   * 1. Terminals offline for >15 minutes during operational shift hours
   * 2. Battery levels <15% on battery-operated tablets
   * 3. Network latency spikes exceeding 5000ms
   * Dispatches alerts via NotificationModel (in-app, webhook) and tenant webhooks.
   */
  async scanKioskFleetHealth(
    orgId?: string,
    options?: {
      offlineThresholdMinutes?: number;
      lowBatteryThreshold?: number;
      highLatencyThresholdMs?: number;
      webhookUrl?: string;
    }
  ) {
    const offlineMins = options?.offlineThresholdMinutes ?? 15;
    const lowBatteryThreshold = options?.lowBatteryThreshold ?? 15;
    const highLatencyThresholdMs = options?.highLatencyThresholdMs ?? 5000;
    const threshold = new Date(Date.now() - offlineMins * 60 * 1000);

    const orgFilter = orgId ? { organizationId: new mongoose.Types.ObjectId(orgId) } : {};

    // 1. Detect Offline Terminals (>15 minutes without heartbeat)
    const offlineQuery: Record<string, any> = {
      ...orgFilter,
      isDeleted: { $ne: true },
      status: "online",
      $or: [
        { lastHeartbeatAt: { $lt: threshold } },
        { lastHeartbeatAt: { $exists: false }, lastSeen: { $lt: threshold } },
        { lastHeartbeatAt: null, lastSeen: { $lt: threshold } },
      ],
    };

    const staleDevices = await KioskDeviceModel.find(offlineQuery);
    const offlineFlagged: any[] = [];

    for (const device of staleDevices) {
      (device as any).status = "offline";
      await device.save();

      await this.dispatchFleetAlert({
        organizationId: device.organizationId,
        alertType: "terminal_offline",
        title: "Kiosk Terminal Offline Alert",
        message: `Kiosk Terminal ${device.name} in ${device.location} has been offline for ${offlineMins} minutes. Shift safety briefings may be impacted.`,
        priority: "high",
        device,
        overrideWebhookUrl: options?.webhookUrl,
      });

      offlineFlagged.push({
        deviceId: device.deviceId,
        name: device.name,
        location: device.location,
        status: "offline",
        alertType: "terminal_offline",
        lastHeartbeatAt: device.lastHeartbeatAt || device.lastSeen,
      });

      // K-ENT-003: Dispatch kiosk.device.offline enterprise webhook
      try {
        await this.webhookService.publishEvent(device.organizationId, "kiosk.device.offline", {
          deviceId: device.deviceId,
          name: device.name,
          location: device.location,
          deviceType: device.deviceType,
          status: "offline",
          lastHeartbeatAt: (device.lastHeartbeatAt || device.lastSeen)?.toISOString?.() || new Date(device.lastHeartbeatAt || device.lastSeen).toISOString(),
          offlineThresholdMinutes: offlineMins,
          detectedAt: new Date().toISOString(),
        });
      } catch (offlineErr) {
        console.warn("[KioskService] Error dispatching device.offline webhook:", offlineErr);
      }
    }

    // 2. Detect Tablets with Low Battery (<15%)
    // Check tablets or active devices reporting batteryLevel < 15 and not charging
    const tabletQuery: Record<string, any> = {
      ...orgFilter,
      isDeleted: { $ne: true },
      status: { $ne: "decommissioned" },
      $or: [
        { deviceType: { $in: ["countertop_tablet", "rugged_handheld", "tablet"] } },
        { "telemetry.batteryLevel": { $exists: true } },
      ],
    };

    const candidateTablets = await KioskDeviceModel.find(tabletQuery);
    const lowBatteryFlagged: any[] = [];

    for (const device of candidateTablets) {
      const rawBattery = (device as any).telemetry?.batteryLevel;
      if (rawBattery === undefined || rawBattery === null) continue;

      // Normalize battery to 0-100 percentage
      const batteryPct = rawBattery <= 1 && rawBattery > 0 ? Math.round(rawBattery * 100) : rawBattery;
      const isCharging = (device as any).telemetry?.isCharging === true;

      if (batteryPct < lowBatteryThreshold && !isCharging) {
        await this.dispatchFleetAlert({
          organizationId: device.organizationId,
          alertType: "low_battery",
          title: "Kiosk Tablet Low Battery Alert",
          message: `Kiosk Tablet ${device.name} in ${device.location} has critical battery level (${batteryPct}%). Connect to power immediately.`,
          priority: "high",
          device,
          details: { batteryLevel: batteryPct },
          overrideWebhookUrl: options?.webhookUrl,
        });

        lowBatteryFlagged.push({
          deviceId: device.deviceId,
          name: device.name,
          location: device.location,
          status: device.status,
          alertType: "low_battery",
          batteryLevel: batteryPct,
          lastHeartbeatAt: device.lastHeartbeatAt || device.lastSeen,
        });
      }
    }

    // 3. Detect Severe Network Latency Spikes (> 5000ms)
    const latencyQuery: Record<string, any> = {
      ...orgFilter,
      isDeleted: { $ne: true },
      status: { $ne: "decommissioned" },
      "telemetry.networkLatencyMs": { $gt: highLatencyThresholdMs },
    };

    const highLatencyDevices = await KioskDeviceModel.find(latencyQuery);
    const latencySpikeFlagged: any[] = [];

    for (const device of highLatencyDevices) {
      const latencyMs = (device as any).telemetry?.networkLatencyMs;
      await this.dispatchFleetAlert({
        organizationId: device.organizationId,
        alertType: "latency_spike",
        title: "Kiosk Network Latency Spike Alert",
        message: `Kiosk Terminal ${device.name} in ${device.location} is experiencing severe network latency (${latencyMs}ms). Offline sync may be degraded.`,
        priority: "high",
        device,
        details: { networkLatencyMs: latencyMs },
        overrideWebhookUrl: options?.webhookUrl,
      });

      latencySpikeFlagged.push({
        deviceId: device.deviceId,
        name: device.name,
        location: device.location,
        status: device.status,
        alertType: "latency_spike",
        networkLatencyMs: latencyMs,
        lastHeartbeatAt: device.lastHeartbeatAt || device.lastSeen,
      });
    }

    return {
      scannedAt: new Date(),
      offlineCount: offlineFlagged.length,
      lowBatteryCount: lowBatteryFlagged.length,
      latencySpikeCount: latencySpikeFlagged.length,
      flaggedDevices: [...offlineFlagged, ...lowBatteryFlagged, ...latencySpikeFlagged],
      offlineDevices: offlineFlagged,
      lowBatteryDevices: lowBatteryFlagged,
      latencySpikeDevices: latencySpikeFlagged,
    };
  }

  /**
   * Helper: Multi-channel Alert Dispatcher (in-app notifications + webhooks)
   */
  private async dispatchFleetAlert(params: {
    organizationId: mongoose.Types.ObjectId | string;
    alertType: "terminal_offline" | "low_battery" | "latency_spike";
    title: string;
    message: string;
    priority: "high" | "critical";
    device: any;
    details?: Record<string, any>;
    overrideWebhookUrl?: string;
  }) {
    try {
      const orgIdObj = new mongoose.Types.ObjectId(params.organizationId);

      // 1. Locate Admin / Manager Users for this Tenant
      const admins = await User.find({
        organizationId: orgIdObj,
        $or: [
          { "permissions.role": { $in: ["admin", "owner", "superadmin", "it_admin"] } },
          { "permissions.roles": { $in: ["admin", "owner", "superadmin", "it_admin"] } },
          { role: { $in: ["admin", "owner", "superadmin", "it_admin"] } },
        ],
        isDeleted: false,
      });

      let targetAdmins = admins;
      if (targetAdmins.length === 0) {
        const fallbackUser = await User.findOne({ organizationId: orgIdObj, isDeleted: false });
        if (fallbackUser) {
          targetAdmins = [fallbackUser];
        }
      }

      const alertData = {
        deviceId: params.device.deviceId,
        deviceName: params.device.name,
        location: params.device.location,
        deviceType: params.device.deviceType,
        alertType: params.alertType,
        timestamp: new Date().toISOString(),
        ...params.details,
      };

      // 2. Dispatch in-app notifications to admins
      for (const admin of targetAdmins) {
        try {
          await Notification.create({
            organizationId: orgIdObj,
            recipientUserId: admin._id,
            type: "manager_alert",
            channel: "in_app",
            title: params.title,
            message: params.message,
            priority: params.priority,
            status: "sent",
            isRead: false,
            data: alertData,
          });
        } catch (err) {
          console.warn(`[KioskService] Error creating admin alert notification:`, err);
        }
      }

      // 3. Resolve Tenant Configured Webhook
      let webhookUrl = params.overrideWebhookUrl;
      if (!webhookUrl) {
        try {
          const org = await Organization.findById(orgIdObj);
          webhookUrl =
            (org as any)?.integrations?.kioskAlertWebhookUrl ||
            (org as any)?.integrations?.webhookUrl ||
            (org as any)?.kioskSettings?.alertWebhookUrl ||
            (org as any)?.kioskSettings?.webhookUrl ||
            (org as any)?.alertWebhookUrl ||
            process.env.KIOSK_ALERT_WEBHOOK_URL;
        } catch (orgErr) {
          console.warn("[KioskService] Error resolving organization webhook:", orgErr);
        }
      }

      // 4. Dispatch outbound HTTP webhook if configured
      if (webhookUrl) {
        const webhookPayload = {
          event: "kiosk_fleet_alert",
          alertType: params.alertType,
          severity: params.priority,
          timestamp: new Date().toISOString(),
          organizationId: orgIdObj.toString(),
          device: {
            id: params.device._id ? params.device._id.toString() : undefined,
            deviceId: params.device.deviceId,
            name: params.device.name,
            location: params.device.location,
            deviceType: params.device.deviceType,
            status: params.device.status,
            telemetry: params.device.telemetry,
          },
          message: params.message,
          details: params.details,
        };

        try {
          await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "Talnova-Kiosk-Sentinel/1.0",
            },
            body: JSON.stringify(webhookPayload),
            signal: AbortSignal.timeout(3000),
          });
        } catch (fetchErr) {
          console.warn(`[KioskService] Failed to dispatch alert webhook to ${webhookUrl}:`, fetchErr);
        }

        // Record a webhook channel notification record for auditability
        if (targetAdmins.length > 0) {
          try {
            await Notification.create({
              organizationId: orgIdObj,
              recipientUserId: targetAdmins[0]._id,
              type: "manager_alert",
              channel: "webhook",
              title: params.title,
              message: params.message,
              priority: params.priority,
              status: "sent",
              isRead: false,
              data: { ...alertData, webhookUrl, webhookPayload },
            });
          } catch (webhookNotifErr) {
            console.warn("[KioskService] Error recording webhook notification log:", webhookNotifErr);
          }
        }
      }
    } catch (e) {
      console.warn("[KioskService] Error in dispatchFleetAlert:", e);
    }
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

  /**
   * =========================================================================
   * K-EMP-002: Ephemeral Session Lifecycle State Machine Methods
   * =========================================================================
   */

  /**
   * Start / instantiate a new formal KioskSession entity (ADR-001, ADR-007).
   */
  async createSession(
    data: {
      deviceId: string;
      journeyId: string;
      journeyVersionId?: string | null;
      versionNumber?: number;
      userId?: string | null;
      organizationId?: string;
      currentStepId?: string;
      sessionToken?: string;
      isOfflineSync?: boolean;
    },
    callerUser?: any
  ): Promise<IKioskSession> {
    const journey = await this.journeyRepo.findById(data.journeyId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }

    const orgId = data.organizationId || callerUser?.organizationId || journey.organizationId.toString();

    // Resolve userId:
    // If callerUser has a userId (e.g. from verified frontline worker token), bind to that verified userId
    // Else if data.userId is passed, use that
    // Else null / undefined (anonymous mode)
    let resolvedUserId: mongoose.Types.ObjectId | undefined = undefined;
    const rawUserId = callerUser?.userId || callerUser?.id || data.userId;
    if (rawUserId && rawUserId !== "null" && rawUserId !== "anonymous" && mongoose.Types.ObjectId.isValid(rawUserId)) {
      resolvedUserId = new mongoose.Types.ObjectId(rawUserId);
    }

    // Resolve deviceId:
    let resolvedDeviceId: mongoose.Types.ObjectId;
    const rawDeviceId = data.deviceId;
    if (mongoose.Types.ObjectId.isValid(rawDeviceId)) {
      resolvedDeviceId = new mongoose.Types.ObjectId(rawDeviceId);
    } else {
      const device = await KioskDeviceModel.findOne({
        $or: [{ deviceId: rawDeviceId }, { hardwareGuid: rawDeviceId }],
      });
      if (device) {
        resolvedDeviceId = device._id;
      } else {
        resolvedDeviceId = new mongoose.Types.ObjectId();
      }
    }

    // Resolve journeyVersionId:
    let resolvedVersionId: mongoose.Types.ObjectId | undefined = undefined;
    if (data.journeyVersionId && mongoose.Types.ObjectId.isValid(data.journeyVersionId)) {
      resolvedVersionId = new mongoose.Types.ObjectId(data.journeyVersionId);
    } else if ((journey.publishing as any)?.activeVersionId) {
      resolvedVersionId = new mongoose.Types.ObjectId(String((journey.publishing as any).activeVersionId));
    } else {
      try {
        const latestVer = await this.journeyVersionRepo.findByJourneyAndVersion(
          data.journeyId,
          journey.publishing?.version || 1
        );
        if (latestVer) {
          resolvedVersionId = latestVer._id;
        }
      } catch {
        // ignore
      }
    }

    const sessionToken = data.sessionToken || crypto.randomUUID();
    const versionNumber = data.versionNumber || journey.publishing?.version || 1;
    const currentStepId = data.currentStepId || journey.steps?.[0]?.id || "s1";

    const session = await this.sessionRepo.createSession({
      organizationId: new mongoose.Types.ObjectId(orgId),
      deviceId: resolvedDeviceId,
      journeyId: new mongoose.Types.ObjectId(data.journeyId),
      journeyVersionId: resolvedVersionId,
      versionNumber,
      userId: resolvedUserId,
      sessionToken,
      status: "active",
      currentStepId,
      completedStepIds: [],
      ppeItemsVerified: [],
      durationSeconds: 0,
      isOfflineSync: Boolean(data.isOfflineSync),
      startedAt: new Date(),
    });

    return session;
  }

  /**
   * Update active session progress: completed step IDs and dwell times.
   */
  async updateSessionProgress(
    sessionId: string,
    data: {
      stepId?: string;
      currentStepId?: string;
      completedStepId?: string;
      completedStepIds?: string[];
      durationIncrement?: number;
      durationSeconds?: number;
      ppeItemsVerified?: string[];
    },
    orgId?: string
  ): Promise<IKioskSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new AppError(404, "NOT_FOUND", "Kiosk session not found");
    }

    const currentStepId = data.currentStepId || data.stepId;
    const completedSteps: string[] = [];
    if (data.completedStepId) completedSteps.push(data.completedStepId);
    if (Array.isArray(data.completedStepIds)) completedSteps.push(...data.completedStepIds);

    const updated = await this.sessionRepo.updateStepProgress(
      session._id,
      currentStepId,
      data.durationIncrement || 0,
      orgId,
      completedSteps,
      data.durationSeconds
    );

    if (data.ppeItemsVerified && data.ppeItemsVerified.length > 0) {
      await KioskSessionModel.findByIdAndUpdate(session._id, {
        $addToSet: { ppeItemsVerified: { $each: data.ppeItemsVerified } },
      });
    }

    return (await this.sessionRepo.findById(session._id)) || updated!;
  }

  /**
   * Complete session with server-authoritative completion check, progression rule
   * validation, minimum dwell time enforcement, and tamper-proof verification checksum (ADR-007).
   */
  async completeSession(
    sessionId: string,
    data?: {
      durationSeconds?: number;
      quizScore?: number;
      ppeItemsVerified?: string[];
      verificationChecksum?: string;
      completedStepIds?: string[];
      completedStepId?: string;
    },
    orgId?: string
  ): Promise<IKioskSession> {
    // 1. Retrieve KioskSession
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new AppError(404, "NOT_FOUND", "Kiosk session not found");
    }

    if (session.status === "completed") {
      return session;
    }

    // 1b. Retrieve bound KioskJourneyVersion snapshot or fallback to KioskJourney
    let journeyVersion: IKioskJourneyVersion | null = null;
    if (session.journeyVersionId) {
      journeyVersion = await this.journeyVersionRepo.findById(session.journeyVersionId.toString());
    }
    if (!journeyVersion && session.journeyId) {
      journeyVersion = await this.journeyVersionRepo.findByJourneyAndVersion(
        session.journeyId.toString(),
        session.versionNumber || 1
      );
    }

    const journey = await this.journeyRepo.findById(session.journeyId.toString());
    if (!journey && !journeyVersion) {
      throw new AppError(404, "NOT_FOUND", "Bound kiosk journey not found");
    }

    const steps = (journeyVersion?.steps && journeyVersion.steps.length > 0)
      ? journeyVersion.steps
      : (journey?.steps || []);
    const settings = journeyVersion?.settings || journey?.settings || ({} as any);

    // 2. Validate that every mandatory step was visited
    const visitedStepIds = new Set<string>([
      ...(session.completedStepIds || []),
      ...(data?.completedStepIds || []),
      ...(data?.completedStepId ? [data.completedStepId] : []),
    ]);

    const hasExplicitFlags = steps.some(
      (s: any) => typeof s.isMandatory === "boolean" || typeof s.isOptional === "boolean"
    );
    const enforceAll = Boolean(
      (settings as any)?.enforceMandatorySteps ||
      (settings as any)?.enforceStepProgression ||
      (journey as any)?.settings?.enforceMandatorySteps ||
      (journey as any)?.settings?.enforceStepProgression
    );

    let mandatorySteps: any[] = [];
    if (hasExplicitFlags) {
      mandatorySteps = steps.filter(
        (s: any) => s.isMandatory === true || (s.isOptional === false && s.isMandatory !== false)
      );
    } else if (enforceAll) {
      mandatorySteps = steps.filter((s: any) => s.isOptional !== true && s.isMandatory !== false);
    }

    const missingSteps = mandatorySteps.filter((s: any) => !visitedStepIds.has(s.id));
    const missingStepIds = missingSteps.map((s: any) => s.id);

    if (missingStepIds.length > 0) {
      throw new AppError(
        400,
        "COMPLETION_GATE_VIOLATION",
        `Session completion rejected: Mandatory steps incomplete (${missingStepIds.join(", ")})`,
        {
          gate: "mandatory_steps",
          missingStepIds,
          missingSteps: missingStepIds,
        }
      );
    }

    // 3. Validate total session duration >= journey.settings.minimumDurationSeconds
    const minDurationSeconds =
      (settings as any)?.minimumDurationSeconds ??
      (journey as any)?.settings?.minimumDurationSeconds ??
      0;

    const recordedDuration =
      typeof data?.durationSeconds === "number"
        ? data.durationSeconds
        : (session.durationSeconds || 0);

    const elapsedSeconds = session.startedAt
      ? Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
      : 0;

    const effectiveDuration = Math.max(recordedDuration, elapsedSeconds);

    if (minDurationSeconds > 0 && effectiveDuration < minDurationSeconds) {
      throw new AppError(
        400,
        "COMPLETION_GATE_VIOLATION",
        `Session completion rejected: Minimum dwell time of ${minDurationSeconds}s not satisfied (recorded: ${effectiveDuration}s)`,
        {
          gate: "minimum_duration",
          requiredDurationSeconds: minDurationSeconds,
          actualDurationSeconds: effectiveDuration,
        }
      );
    }

    // 4. Validate that quiz scores meet or exceed passing threshold
    let requiredPassingScore: number | null = null;
    if (typeof (settings as any)?.passingScorePercentage === "number") {
      requiredPassingScore = (settings as any).passingScorePercentage;
    }
    const quizSteps = steps.filter((s: any) => s.quiz?.passingScore || s.interaction?.quiz?.passingScore);
    if (quizSteps.length > 0) {
      const stepMax = Math.max(
        ...quizSteps.map((s: any) => s.quiz?.passingScore || s.interaction?.quiz?.passingScore || 80)
      );
      requiredPassingScore = requiredPassingScore !== null ? Math.max(requiredPassingScore, stepMax) : stepMax;
    }

    if (requiredPassingScore !== null) {
      const effectiveQuizScore = typeof data?.quizScore === "number" ? data.quizScore : session.quizScore;
      if (effectiveQuizScore === undefined || effectiveQuizScore === null || effectiveQuizScore < requiredPassingScore) {
        throw new AppError(
          400,
          "COMPLETION_GATE_VIOLATION",
          `Session completion rejected: Quiz score of ${effectiveQuizScore ?? "N/A"} does not meet minimum passing threshold of ${requiredPassingScore}%`,
          {
            gate: "quiz_passing_score",
            requiredScore: requiredPassingScore,
            actualScore: effectiveQuizScore ?? null,
          }
        );
      }
    }

    // 5. Validate that supervisor witness attestation exists if required
    const requiresWitness = Boolean(
      (journey as any)?.requireSupervisorWitness ||
      (journey?.settings as any)?.requireSupervisorWitness ||
      (journey?.settings?.security as any)?.requireSupervisorWitness ||
      (settings as any)?.requireSupervisorWitness ||
      (settings?.security as any)?.requireSupervisorWitness ||
      steps?.some((s: any) => s.requireSupervisorWitness || s.interaction?.requireSupervisorWitness)
    );

    if (requiresWitness && !session.supervisorWitness?.supervisorId) {
      const awaitingMetadata: any = {
        durationIncrement: 0,
      };
      if (typeof data?.durationSeconds === "number") {
        awaitingMetadata.durationSeconds = data.durationSeconds;
      }
      if (typeof data?.quizScore === "number") {
        awaitingMetadata.quizScore = data.quizScore;
      }
      if (data?.ppeItemsVerified) {
        awaitingMetadata.ppeItemsVerified = data.ppeItemsVerified;
      }
      if (visitedStepIds.size > 0) {
        awaitingMetadata.completedStepIds = Array.from(visitedStepIds);
      }

      const updated = await this.sessionRepo.transitionStatus(
        session._id,
        "awaiting_supervisor",
        awaitingMetadata,
        orgId
      );
      return (await this.sessionRepo.findById(session._id)) || updated!;
    }

    // 6. Compute SHA-256 HMAC verificationChecksum
    const completedAt = new Date();
    const secret =
      process.env.COMPLIANCE_SIGNING_SECRET ||
      process.env.COOKIE_SECRET ||
      process.env.JWT_SECRET ||
      "talnova-kiosk-compliance-secret";

    const payload = `${session._id}:${session.organizationId}:${session.userId || "anonymous"}:${session.journeyId}:${session.versionNumber || 1}:${completedAt.toISOString()}`;
    const verificationChecksum = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    // 7. Transition session status to 'completed'
    const metadata: any = {
      completedAt,
      durationIncrement: 0,
      verificationChecksum,
    };
    if (typeof data?.durationSeconds === "number") {
      metadata.durationSeconds = data.durationSeconds;
    }
    if (typeof data?.quizScore === "number") {
      metadata.quizScore = data.quizScore;
    }
    if (data?.ppeItemsVerified) {
      metadata.ppeItemsVerified = data.ppeItemsVerified;
    }
    if (visitedStepIds.size > 0) {
      metadata.completedStepIds = Array.from(visitedStepIds);
    }

    const updated = await this.sessionRepo.transitionStatus(
      session._id,
      "completed",
      metadata,
      orgId
    );

    // Persist all fields directly on KioskSession document
    await KioskSessionModel.findByIdAndUpdate(session._id, {
      $set: {
        status: "completed",
        completedAt,
        verificationChecksum,
        ...(typeof data?.durationSeconds === "number" ? { durationSeconds: data.durationSeconds } : {}),
        ...(typeof data?.quizScore === "number" ? { quizScore: data.quizScore } : {}),
        ...(visitedStepIds.size > 0 ? { completedStepIds: Array.from(visitedStepIds) } : {}),
      },
    });

    const refreshedSession = (await this.sessionRepo.findById(session._id)) || updated!;

    // 8. Record audit log & update employee user profile and roadmap tasks
    try {
      await AuditLog.create({
        organizationId: session.organizationId,
        actorUserId: session.userId || undefined,
        actorType: session.userId ? "user" : "system",
        eventCategory: "journey",
        eventType: "KIOSK_SESSION_COMPLETED",
        resourceType: "KioskSession",
        resourceId: session._id,
        action: "complete",
        description: `Kiosk session ${session._id} completed and verified for journey "${journey?.title || session.journeyId}"`,
        metadata: {
          sessionId: session._id,
          deviceId: session.deviceId,
          journeyId: session.journeyId,
          versionNumber: session.versionNumber,
          verificationChecksum,
          durationSeconds: data?.durationSeconds ?? session.durationSeconds,
          quizScore: data?.quizScore ?? session.quizScore,
          completedAt,
        },
        severity: "info",
      });

      // Compliance Audit Event: KIOSK_COMPLETION_RECORDED
      await AuditLog.create({
        organizationId: session.organizationId,
        actorUserId: session.userId || undefined,
        actorType: session.userId ? "user" : "system",
        eventCategory: "kiosk",
        eventType: "KIOSK_COMPLETION_RECORDED",
        resourceType: "kiosk_session",
        resourceId: session._id,
        action: "complete",
        description: `Kiosk completion recorded for employee ${session.userId || "anonymous"} on journey version ${session.versionNumber}`,
        metadata: {
          employeeId: session.userId?.toString() || "",
          journeyId: session.journeyId?.toString(),
          journeyVersion: session.versionNumber,
          verificationChecksum,
          sessionId: session._id.toString(),
          deviceId: session.deviceId,
          completedAt
        },
        severity: "info",
      });
    } catch (auditErr) {
      console.warn("[KioskService] Failed to create audit log for session completion:", auditErr);
    }

    if (session.userId) {
      try {
        const UserModel =
          mongoose.models.User ||
          (mongoose.modelNames().includes("User") ? mongoose.model("User") : null);
        if (UserModel) {
          await UserModel.updateOne(
            { _id: session.userId },
            {
              $inc: { "statistics.completedJourneys": 1 },
              $set: { "statistics.lastActiveAt": new Date() },
              $addToSet: { completedKioskJourneys: session.journeyId },
            }
          );
        }

        const AssignmentModel =
          mongoose.models.Assignment ||
          mongoose.models.EmployeeAssignment ||
          (mongoose.modelNames().includes("EmployeeAssignment") ? mongoose.model("EmployeeAssignment") : null) ||
          (mongoose.modelNames().includes("Assignment") ? mongoose.model("Assignment") : null);
        if (AssignmentModel) {
          await AssignmentModel.updateMany(
            {
              employeeId: session.userId,
              $or: [
                { journeyId: session.journeyId },
                { "journey.journeyId": session.journeyId }
              ],
              status: { $ne: "completed" },
            },
            {
              $set: {
                status: "completed",
                completedAt,
                "progress.completionPercentage": 100,
                "progress.status": "completed",
              },
            }
          );
        }

        const TaskModel =
          mongoose.models.Task ||
          (mongoose.modelNames().includes("Task") ? mongoose.model("Task") : null);
        if (TaskModel) {
          await TaskModel.updateMany(
            {
              organizationId: session.organizationId,
              employeeId: session.userId,
              status: { $nin: ["completed", "verified"] },
              $or: [
                { "autoVerification.linkedEntityId": session.journeyId },
                { taskCode: `JOURNEY_${session.journeyId}` },
                { title: new RegExp(journey?.title || "Safety", "i") },
              ],
            },
            {
              $set: {
                status: "completed",
                completedAt,
                completedBy: session.userId,
              },
            }
          );
        }
      } catch (userErr) {
        console.warn("[KioskService] Failed to update employee roadmap records:", userErr);
      }
    }

    // K-ENT-003: Dispatch kiosk.session.completed enterprise webhook
    try {
      let workerBadgeId: string | undefined;
      if (session.userId) {
        const workerUser = await User.findById(session.userId);
        workerBadgeId = (workerUser as any)?.employment?.badgeId || (workerUser as any)?.badgeId;
      }

      await this.webhookService.publishEvent(
        session.organizationId,
        "kiosk.session.completed",
        {
          sessionId: session._id.toString(),
          workerId: session.userId ? session.userId.toString() : "anonymous",
          employeeId: session.userId ? session.userId.toString() : undefined,
          badgeId: workerBadgeId,
          journeyId: session.journeyId ? session.journeyId.toString() : "",
          journeyVersion: session.versionNumber || 1,
          supervisorWitness: session.supervisorWitness
            ? {
                supervisorId: session.supervisorWitness.supervisorId?.toString(),
                supervisorName: (session.supervisorWitness as any)?.supervisorName,
                witnessedAt: session.supervisorWitness.witnessedAt,
                method: session.supervisorWitness.method || "pin",
              }
            : null,
          verificationChecksum,
          completedAt: completedAt.toISOString(),
          durationSeconds: data?.durationSeconds ?? session.durationSeconds,
          quizScore: data?.quizScore ?? session.quizScore,
          deviceId: session.deviceId,
        }
      );
    } catch (webhookErr) {
      console.warn("[KioskService] Error dispatching session.completed webhook:", webhookErr);
    }

    return refreshedSession;
  }

  /**
   * Abort session upon manual restart or exit.
   */
  async abortSession(
    sessionId: string,
    data?: {
      abortedStepId?: string;
      reason?: string;
      durationSeconds?: number;
    },
    orgId?: string
  ): Promise<IKioskSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new AppError(404, "NOT_FOUND", "Kiosk session not found");
    }

    const metadata: any = {};
    if (typeof data?.durationSeconds === "number") {
      metadata.durationSeconds = data.durationSeconds;
    }

    const updated = await this.sessionRepo.transitionStatus(
      session._id,
      "aborted",
      metadata,
      orgId
    );

    const setFields: Record<string, any> = {};
    if (data?.abortedStepId) {
      setFields.currentStepId = data.abortedStepId;
    }
    if (typeof data?.durationSeconds === "number") {
      setFields.durationSeconds = data.durationSeconds;
    }
    if (Object.keys(setFields).length > 0) {
      await KioskSessionModel.findByIdAndUpdate(session._id, { $set: setFields });
    }

    return (await this.sessionRepo.findById(session._id)) || updated!;
  }

  /**
   * Timeout session upon idle expiration or privacy reset.
   */
  async timeoutSession(
    sessionId: string,
    data?: {
      abortedStepId?: string;
      reason?: string;
      durationSeconds?: number;
    },
    orgId?: string
  ): Promise<IKioskSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new AppError(404, "NOT_FOUND", "Kiosk session not found");
    }

    const metadata: any = {};
    if (typeof data?.durationSeconds === "number") {
      metadata.durationSeconds = data.durationSeconds;
    }

    const updated = await this.sessionRepo.transitionStatus(
      session._id,
      "timed_out",
      metadata,
      orgId
    );

    const setFields: Record<string, any> = {};
    if (data?.abortedStepId) {
      setFields.currentStepId = data.abortedStepId;
    }
    if (typeof data?.durationSeconds === "number") {
      setFields.durationSeconds = data.durationSeconds;
    }
    if (Object.keys(setFields).length > 0) {
      await KioskSessionModel.findByIdAndUpdate(session._id, { $set: setFields });
    }

    return (await this.sessionRepo.findById(session._id)) || updated!;
  }

  /**
   * =========================================================================
   * K-SEC-004: Emergency Kiosk Mode Override & Broadcast Engine
   * =========================================================================
   */

  /**
   * Broadcast an emergency evacuation override across all online terminals of an organization
   */
  async broadcastEmergency(
    orgId: string,
    data: {
      type: "fire" | "gas_leak" | "toxic_spill" | "weather" | "security_threat" | "general";
      severity?: "warning" | "critical" | "evacuate";
      title: string;
      message: string;
      evacuationMapUrl?: string;
      primaryExit?: string;
      secondaryExit?: string;
      assemblyZone?: string;
      emergencyContacts?: Array<{ name: string; phone: string; role?: string }>;
      soundSiren?: boolean;
      siteId?: string;
      deviceIds?: string[];
    },
    triggeredBy?: string
  ): Promise<IKioskEmergency> {
    if (!orgId) {
      throw new AppError(400, "BAD_REQUEST", "Organization ID is required for emergency broadcast");
    }

    // 1. Deactivate existing active emergency broadcasts for this organization
    await KioskEmergencyModel.updateMany(
      { organizationId: new mongoose.Types.ObjectId(orgId), isActive: true },
      { $set: { isActive: false, clearedAt: new Date(), clearedBy: triggeredBy || "SYSTEM_OVERRIDE" } }
    );

    // 2. Persist new active emergency record
    const emergency = await KioskEmergencyModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      type: data.type,
      severity: data.severity || "evacuate",
      title: data.title,
      message: data.message,
      evacuationMapUrl: data.evacuationMapUrl,
      primaryExit: data.primaryExit || "North Emergency Stairwell A",
      secondaryExit: data.secondaryExit || "East Ground Level Exit 2",
      assemblyZone: data.assemblyZone || "Muster Point B - Main Parking Lot",
      emergencyContacts: data.emergencyContacts || [],
      soundSiren: data.soundSiren !== false,
      siteId: data.siteId,
      deviceIds: data.deviceIds || [],
      isActive: true,
      triggeredBy: triggeredBy || "safety_officer",
      triggeredAt: new Date()
    });

    // 3. Dispatch real-time SSE broadcast to online terminals
    kioskEmergencyStream.broadcastEmergency(orgId, emergency);

    // 4. Log immutable security audit event
    await AuditLog.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      actorUserId: triggeredBy && mongoose.Types.ObjectId.isValid(triggeredBy) ? new mongoose.Types.ObjectId(triggeredBy) : undefined,
      actorType: "user",
      eventCategory: "security",
      eventType: "EMERGENCY_BROADCAST_TRIGGERED",
      resourceType: "kiosk_emergency",
      resourceId: emergency._id,
      action: "create",
      description: `Active ${emergency.severity.toUpperCase()} Emergency Broadcast: ${emergency.title} triggered. All physical terminals overridden.`,
      metadata: {
        emergencyId: emergency._id.toString(),
        type: emergency.type,
        severity: emergency.severity,
        title: emergency.title,
        triggeredBy
      },
      severity: "critical"
    });

    // K-ENT-003: Dispatch kiosk.emergency.activated enterprise webhook
    try {
      await this.webhookService.publishEvent(orgId, "kiosk.emergency.activated", {
        emergencyId: emergency._id.toString(),
        type: emergency.type,
        severity: emergency.severity,
        title: emergency.title,
        message: emergency.message,
        primaryExit: emergency.primaryExit,
        secondaryExit: emergency.secondaryExit,
        assemblyPoint: emergency.assemblyZone || emergency.primaryExit,
        emergencyContacts: emergency.emergencyContacts,
        triggeredAt: emergency.triggeredAt?.toISOString?.() || new Date().toISOString(),
        triggeredBy: emergency.triggeredBy?.toString?.(),
      });
    } catch (emergencyErr) {
      console.warn("[KioskService] Error dispatching emergency.activated webhook:", emergencyErr);
    }

    return emergency;
  }

  /**
   * Cancel and clear an active emergency broadcast
   */
  async clearEmergency(orgId: string, clearedBy?: string, reason?: string) {
    if (!orgId) {
      throw new AppError(400, "BAD_REQUEST", "Organization ID is required");
    }

    const activeEmergencies = await KioskEmergencyModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isActive: true
    });

    if (activeEmergencies.length === 0) {
      return { success: true, message: "No active emergency found for this organization" };
    }

    const now = new Date();
    await KioskEmergencyModel.updateMany(
      { organizationId: new mongoose.Types.ObjectId(orgId), isActive: true },
      { $set: { isActive: false, clearedAt: now, clearedBy: clearedBy || "admin" } }
    );

    // Dispatch real-time SSE clear event to online terminals
    kioskEmergencyStream.broadcastClear(orgId, {
      clearedBy: clearedBy || "admin",
      reason: reason || "All clear signaled by emergency responder",
      timestamp: now.toISOString()
    });

    // Log audit log
    await AuditLog.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      actorUserId: clearedBy && mongoose.Types.ObjectId.isValid(clearedBy) ? new mongoose.Types.ObjectId(clearedBy) : undefined,
      actorType: "user",
      eventCategory: "security",
      eventType: "EMERGENCY_BROADCAST_CLEARED",
      resourceType: "kiosk_emergency",
      action: "update",
      description: `Emergency Broadcast cleared for organization ${orgId}. Reason: ${reason || "All clear"}`,
      metadata: {
        clearedBy,
        reason,
        clearedAt: now
      },
      severity: "info"
    });

    return { success: true, message: "Emergency broadcast cleared successfully" };
  }

  /**
   * Retrieve currently active emergency for an organization
   */
  /**
   * Retrieve currently active emergency for an organization
   */
  async getActiveEmergency(orgId: string): Promise<IKioskEmergency | null> {
    if (!orgId) return null;
    return await KioskEmergencyModel.findOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isActive: true
    }).sort({ triggeredAt: -1 });
  }

  /**
   * =========================================================================
   * K-ANA-003: Enterprise Safety Compliance Reporting & Audit Packet Engine
   * =========================================================================
   */

  /**
   * Overall Compliance Reporting Summary
   */
  async getComplianceSummary(
    orgId: string,
    filters?: { journeyId?: string; startDate?: string; endDate?: string }
  ) {
    const orgObjId = new mongoose.Types.ObjectId(orgId);
    const matchQuery: Record<string, any> = { organizationId: orgObjId };

    if (filters?.journeyId && mongoose.Types.ObjectId.isValid(filters.journeyId)) {
      matchQuery.journeyId = new mongoose.Types.ObjectId(filters.journeyId);
    }

    if (filters?.startDate || filters?.endDate) {
      matchQuery.startedAt = {};
      if (filters.startDate) matchQuery.startedAt.$gte = new Date(filters.startDate);
      if (filters.endDate) matchQuery.startedAt.$lte = new Date(filters.endDate);
    }

    const totalSessions = await KioskSessionModel.countDocuments(matchQuery);
    const completedSessions = await KioskSessionModel.countDocuments({ ...matchQuery, status: "completed" });
    const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    const certifiedUserIds = await KioskSessionModel.distinct("userId", {
      ...matchQuery,
      status: "completed",
      userId: { $exists: true, $ne: null }
    });
    const certifiedWorkersCount = certifiedUserIds.length;

    const dbWorkersCount = await User.countDocuments({
      organizationId: orgObjId,
      isDeleted: false,
      "employment.status": { $ne: "inactive" }
    });
    const totalWorkersCount = Math.max(dbWorkersCount, certifiedWorkersCount);

    const supervisorSignOffsCount = await KioskSessionModel.countDocuments({
      ...matchQuery,
      status: "completed",
      "supervisorWitness.supervisorId": { $exists: true, $ne: null }
    });

    const durationAgg = await KioskSessionModel.aggregate([
      { $match: { ...matchQuery, status: "completed" } },
      { $group: { _id: null, avgDuration: { $avg: "$durationSeconds" } } }
    ]);
    const averageDurationSeconds = durationAgg[0]?.avgDuration ? Math.round(durationAgg[0].avgDuration) : 0;

    const complianceStatus =
      completionRate >= 85 ? "compliant" : completionRate >= 70 ? "needs_attention" : "at_risk";

    // Recent 10 verified completions with full metadata
    const recentDocs = await KioskSessionModel.find({ ...matchQuery, status: "completed" })
      .sort({ completedAt: -1, updatedAt: -1 })
      .limit(10)
      .populate("userId", "profile.fullName profile.firstName profile.lastName auth.email employment.department employment.jobTitle")
      .populate("deviceId", "name location")
      .populate("journeyId", "title")
      .populate("supervisorWitness.supervisorId", "profile.fullName profile.firstName profile.lastName");

    const recentCompletions = recentDocs.map((s: any) => ({
      sessionId: s._id.toString(),
      workerName: s.userId?.profile?.fullName || `${s.userId?.profile?.firstName || ""} ${s.userId?.profile?.lastName || ""}`.trim() || "Frontline Worker",
      workerEmail: s.userId?.auth?.email || "worker@enterprise.com",
      department: s.userId?.employment?.department || "Operations",
      jobTitle: s.userId?.employment?.jobTitle || "Operator",
      journeyTitle: s.journeyId?.title || "Safety Briefing",
      deviceName: s.deviceId?.name || "Kiosk Terminal",
      deviceLocation: s.deviceId?.location || "Facility Floor",
      startedAt: s.startedAt,
      completedAt: s.completedAt || s.updatedAt,
      durationSeconds: s.durationSeconds,
      quizScore: s.quizScore,
      ppeItemsVerified: s.ppeItemsVerified || [],
      supervisorWitness: s.supervisorWitness ? {
        supervisorName: s.supervisorWitness.supervisorId?.profile?.fullName || "Shift Supervisor",
        method: s.supervisorWitness.method,
        witnessedAt: s.supervisorWitness.witnessedAt
      } : undefined,
      verificationChecksum: s.verificationChecksum || ""
    }));

    // Historical 6-week trend data
    const now = new Date();
    const historicalTrends = [];
    for (let i = 5; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekLabel = `W-${weekStart.toISOString().substring(5, 10)}`;

      const wTotal = await KioskSessionModel.countDocuments({
        organizationId: orgObjId,
        startedAt: { $gte: weekStart, $lt: weekEnd }
      });
      const wCompleted = await KioskSessionModel.countDocuments({
        organizationId: orgObjId,
        status: "completed",
        completedAt: { $gte: weekStart, $lt: weekEnd }
      });
      const wRate = wTotal > 0 ? Math.round((wCompleted / wTotal) * 100) : (wCompleted > 0 ? 100 : 0);

      historicalTrends.push({
        period: weekLabel,
        totalSessions: wTotal,
        completedSessions: wCompleted,
        completionRate: wRate,
        targetRate: 85
      });
    }

    return {
      totalSessions,
      completedSessions,
      completionRate,
      certifiedWorkersCount,
      totalWorkersCount,
      supervisorSignOffsCount,
      averageDurationSeconds,
      complianceStatus,
      historicalTrends,
      recentCompletions
    };
  }

  /**
   * Compliance Breakdown by Department and Shift
   */
  async getComplianceByDepartment(
    orgId: string,
    filters?: { journeyId?: string; startDate?: string; endDate?: string }
  ) {
    const orgObjId = new mongoose.Types.ObjectId(orgId);
    const org = await Organization.findById(orgObjId);

    // Collect departments from Organization settings, or distinct from existing Users
    let deptNames: string[] = (org?.departments || []).map((d: any) => d.name).filter(Boolean);
    if (deptNames.length === 0) {
      const userDepts = await User.distinct("employment.department", { organizationId: orgObjId, isDeleted: false });
      deptNames = userDepts.filter(Boolean);
    }
    if (deptNames.length === 0) {
      deptNames = ["Operations", "Logistics", "Manufacturing", "Maintenance", "Safety"];
    }

    const sessionMatch: Record<string, any> = { organizationId: orgObjId };
    if (filters?.journeyId && mongoose.Types.ObjectId.isValid(filters.journeyId)) {
      sessionMatch.journeyId = new mongoose.Types.ObjectId(filters.journeyId);
    }
    if (filters?.startDate || filters?.endDate) {
      sessionMatch.startedAt = {};
      if (filters.startDate) sessionMatch.startedAt.$gte = new Date(filters.startDate);
      if (filters.endDate) sessionMatch.startedAt.$lte = new Date(filters.endDate);
    }

    const departmentsData = [];

    for (const dept of deptNames) {
      const deptUsers = await User.find({
        organizationId: orgObjId,
        "employment.department": dept,
        isDeleted: false
      }).select("_id");
      const userIds = deptUsers.map((u: any) => u._id);

      const deptSessionMatch = { ...sessionMatch, userId: { $in: userIds } };
      const totalSessions = await KioskSessionModel.countDocuments(deptSessionMatch);
      const completedSessions = await KioskSessionModel.countDocuments({ ...deptSessionMatch, status: "completed" });
      const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

      const certifiedUsers = await KioskSessionModel.distinct("userId", {
        ...deptSessionMatch,
        status: "completed"
      });
      const certifiedWorkers = certifiedUsers.length;

      const supervisorSignOffs = await KioskSessionModel.countDocuments({
        ...deptSessionMatch,
        status: "completed",
        "supervisorWitness.supervisorId": { $exists: true, $ne: null }
      });

      const dropouts = await KioskSessionModel.countDocuments({
        ...deptSessionMatch,
        status: { $in: ["abandoned", "timed_out"] }
      });

      // Shift distribution for completed sessions
      const completedDocs = await KioskSessionModel.find({ ...deptSessionMatch, status: "completed" }).select("completedAt startedAt");
      let morning = 0;
      let afternoon = 0;
      let night = 0;

      for (const doc of completedDocs) {
        const date = doc.completedAt || doc.startedAt;
        if (date) {
          const hour = new Date(date).getHours();
          if (hour >= 6 && hour < 14) morning++;
          else if (hour >= 14 && hour < 22) afternoon++;
          else night++;
        }
      }

      departmentsData.push({
        department: dept,
        totalWorkers: Math.max(userIds.length, certifiedWorkers),
        certifiedWorkers,
        totalSessions,
        completedSessions,
        completionRate,
        supervisorSignOffs,
        dropouts,
        shiftBreakdown: [
          { shift: "Morning", completions: morning },
          { shift: "Afternoon", completions: afternoon },
          { shift: "Night", completions: night }
        ]
      });
    }

    return {
      departments: departmentsData
    };
  }

  /**
   * Export Compliance Audit Packet (CSV / JSON)
   */
  async exportComplianceAuditPacket(
    orgId: string,
    filters?: { journeyId?: string; startDate?: string; endDate?: string; department?: string; format?: "csv" | "json" }
  ) {
    const orgObjId = new mongoose.Types.ObjectId(orgId);
    const org = await Organization.findById(orgObjId);

    const sessionMatch: Record<string, any> = {
      organizationId: orgObjId,
      status: "completed"
    };

    if (filters?.journeyId && mongoose.Types.ObjectId.isValid(filters.journeyId)) {
      sessionMatch.journeyId = new mongoose.Types.ObjectId(filters.journeyId);
    }
    if (filters?.startDate || filters?.endDate) {
      sessionMatch.startedAt = {};
      if (filters.startDate) sessionMatch.startedAt.$gte = new Date(filters.startDate);
      if (filters.endDate) sessionMatch.startedAt.$lte = new Date(filters.endDate);
    }

    const sessions = await KioskSessionModel.find(sessionMatch)
      .sort({ completedAt: -1 })
      .populate("userId", "profile.fullName profile.firstName profile.lastName auth.email employment.department employment.jobTitle")
      .populate("deviceId", "name location")
      .populate("journeyId", "title")
      .populate("supervisorWitness.supervisorId", "profile.fullName profile.firstName profile.lastName");

    // Filter by department if specified
    const filteredSessions = filters?.department
      ? sessions.filter((s: any) => s.userId?.employment?.department?.toLowerCase() === filters.department?.toLowerCase())
      : sessions;

    const records = filteredSessions.map((s: any) => {
      const workerName = s.userId?.profile?.fullName || `${s.userId?.profile?.firstName || ""} ${s.userId?.profile?.lastName || ""}`.trim() || "Frontline Worker";
      const workerEmail = s.userId?.auth?.email || "worker@enterprise.com";
      const department = s.userId?.employment?.department || "Operations";
      const jobTitle = s.userId?.employment?.jobTitle || "Operator";
      const journeyTitle = s.journeyId?.title || "Safety Briefing";
      const deviceName = s.deviceId?.name || "Kiosk Terminal";
      const deviceLocation = s.deviceId?.location || "Facility Floor";
      const supervisorWitnessed = s.supervisorWitness ? "Yes" : "No";
      const supervisorName = s.supervisorWitness?.supervisorId?.profile?.fullName || (s.supervisorWitness ? "Shift Supervisor" : "N/A");
      const witnessMethod = s.supervisorWitness?.method || "N/A";
      const durationMins = s.durationSeconds ? (s.durationSeconds / 60).toFixed(1) : "0.0";

      return {
        sessionId: s._id.toString(),
        workerName,
        workerEmail,
        department,
        jobTitle,
        journeyTitle,
        deviceName,
        deviceLocation,
        startedAt: s.startedAt ? new Date(s.startedAt).toISOString() : "",
        completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : (s.updatedAt ? new Date(s.updatedAt).toISOString() : ""),
        durationMinutes: durationMins,
        quizScore: s.quizScore !== undefined ? String(s.quizScore) : "N/A",
        supervisorWitnessed,
        supervisorName,
        witnessMethod,
        verificationChecksum: s.verificationChecksum || ""
      };
    });

    if (filters?.format === "json") {
      return {
        exportDate: new Date().toISOString(),
        organization: org?.name || "Enterprise Safety Network",
        totalRecords: records.length,
        records
      };
    }

    // CSV Format
    const escapeCsv = (val: string) => {
      if (!val) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      "Session ID",
      "Worker Name",
      "Worker Email",
      "Department",
      "Job Title",
      "Journey Title",
      "Terminal Device",
      "Location",
      "Started At",
      "Completed At",
      "Duration (Minutes)",
      "Quiz Score",
      "Supervisor Witnessed",
      "Supervisor Name",
      "Witness Method",
      "Verification Checksum"
    ];

    const csvRows = [headers.join(",")];
    for (const r of records) {
      csvRows.push([
        escapeCsv(r.sessionId),
        escapeCsv(r.workerName),
        escapeCsv(r.workerEmail),
        escapeCsv(r.department),
        escapeCsv(r.jobTitle),
        escapeCsv(r.journeyTitle),
        escapeCsv(r.deviceName),
        escapeCsv(r.deviceLocation),
        escapeCsv(r.startedAt),
        escapeCsv(r.completedAt),
        escapeCsv(r.durationMinutes),
        escapeCsv(r.quizScore),
        escapeCsv(r.supervisorWitnessed),
        escapeCsv(r.supervisorName),
        escapeCsv(r.witnessMethod),
        escapeCsv(r.verificationChecksum)
      ].join(","));
    }

    return csvRows.join("\r\n");
  }

  // =========================================================================
  // K-ENT-003: Enterprise Webhook Management
  // =========================================================================

  async createWebhookSubscription(orgId: string, input: any) {
    return this.webhookService.createSubscription(orgId, input);
  }

  async getWebhookSubscriptions(orgId: string) {
    return this.webhookService.getSubscriptions(orgId);
  }

  async getWebhookSubscriptionById(orgId: string, subscriptionId: string) {
    return this.webhookService.getSubscriptionById(orgId, subscriptionId);
  }

  async updateWebhookSubscription(orgId: string, subscriptionId: string, input: any) {
    return this.webhookService.updateSubscription(orgId, subscriptionId, input);
  }

  async deleteWebhookSubscription(orgId: string, subscriptionId: string) {
    return this.webhookService.deleteSubscription(orgId, subscriptionId);
  }

  async getWebhookDeliveries(orgId: string, filter?: any) {
    return this.webhookService.getDeliveries(orgId, filter);
  }

  async publishLifecycleWebhook(orgId: string, topic: string, data: any) {
    return this.webhookService.publishEvent(orgId, topic, data);
  }

  async testWebhookDispatch(orgId: string, topic: string, customPayload?: any) {
    return this.webhookService.publishEvent(orgId, topic, customPayload || {
      test: true,
      timestamp: new Date().toISOString(),
      message: "Test webhook dispatch from Talnova Kiosk Platform",
    });
  }
}

export default KioskService;

