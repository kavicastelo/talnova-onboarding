import OrganizationRepository from "../repositories/organization.repository.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";
import { IDepartment, ITeam } from "../models/organization.model.js";
import User from "../../auth/models/user.model.js";
import { Upload } from "../../uploads/models/upload.model.js";
import { Journey } from "../../journeys/models/journey.model.js";
import KioskDeviceModel from "../../kiosk/models/kiosk-device.model.js";
import KioskJourneyModel from "../../kiosk/models/kiosk-journey.model.js";
import { PackageModel } from "../../super-admin/models/package.model.js";

export class OrganizationService {
  constructor(private readonly orgRepository: OrganizationRepository) {}

  async getOrganization(orgId: string | mongoose.Types.ObjectId) {
    const org = await this.orgRepository.findById(orgId);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }
    return org;
  }

  async updateOrganization(orgId: string | mongoose.Types.ObjectId, updateData: any) {
    const org = await this.orgRepository.update(orgId, updateData);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }
    return org;
  }

  async updateBranding(orgId: string | mongoose.Types.ObjectId, branding: any) {
    const org = await this.getOrganization(orgId);
    const updatedBranding = {
      ...(org.branding || {}),
      ...branding,
    };
    return this.updateOrganization(orgId, { branding: updatedBranding });
  }

  async updateSecurity(orgId: string | mongoose.Types.ObjectId, securitySettings: any) {
    const org = await this.getOrganization(orgId);
    const updatedSecurity = {
      ...(org.securitySettings || {}),
      ...securitySettings,
    };
    return this.updateOrganization(orgId, { securitySettings: updatedSecurity });
  }

  // Department services
  async createDepartment(
    orgId: string | mongoose.Types.ObjectId,
    deptData: { name: string; code?: string; description?: string; color?: string }
  ) {
    const org = await this.getOrganization(orgId);

    // Check for duplicate code within tenant
    if (deptData.code) {
      const normalizedCode = deptData.code.trim().toUpperCase();
      const codeExists = org.departments?.some(
        (d) => d.active !== false && d.code?.toUpperCase() === normalizedCode
      );
      if (codeExists) {
        throw new AppError(400, "DEPARTMENT_CODE_EXISTS", `Department with code '${deptData.code}' already exists`);
      }
    }

    // Check for duplicate name within tenant
    const normalizedName = deptData.name.trim().toLowerCase();
    const nameExists = org.departments?.some(
      (d) => d.active !== false && d.name.trim().toLowerCase() === normalizedName
    );
    if (nameExists) {
      throw new AppError(400, "DEPARTMENT_NAME_EXISTS", `Department with name '${deptData.name}' already exists`);
    }

    const dept: Partial<IDepartment> = {
      _id: new mongoose.Types.ObjectId(),
      name: deptData.name.trim(),
      code: deptData.code ? deptData.code.trim().toUpperCase() : deptData.name.trim().substring(0, 3).toUpperCase(),
      description: deptData.description,
      color: deptData.color,
      active: true,
    };
    const updatedOrg = await this.orgRepository.addDepartment(orgId, dept);
    if (!updatedOrg) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }
    return dept;
  }

  async updateDepartment(orgId: string | mongoose.Types.ObjectId, deptId: string | mongoose.Types.ObjectId, updateData: any) {
    const org = await this.orgRepository.updateDepartment(orgId, deptId, updateData);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization or Department not found");
    }
    return org.departments.find((d) => d._id.toString() === deptId.toString());
  }

  async deleteDepartment(orgId: string | mongoose.Types.ObjectId, deptId: string | mongoose.Types.ObjectId) {
    const updatedOrg = await this.orgRepository.deleteDepartment(orgId, deptId);
    if (!updatedOrg) {
      throw new AppError(404, "NOT_FOUND", "Organization or Department not found");
    }
    return true;
  }

  // Team services
  async createTeam(orgId: string | mongoose.Types.ObjectId, teamData: { name: string; departmentId?: string }) {
    const team: Partial<ITeam> = {
      _id: new mongoose.Types.ObjectId(),
      name: teamData.name,
      departmentId: teamData.departmentId ? new mongoose.Types.ObjectId(teamData.departmentId) : undefined,
      active: true,
    };
    const org = await this.orgRepository.addTeam(orgId, team);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }
    return team;
  }

  async updateTeam(orgId: string | mongoose.Types.ObjectId, teamId: string | mongoose.Types.ObjectId, updateData: any) {
    if (updateData.departmentId) {
      updateData.departmentId = new mongoose.Types.ObjectId(updateData.departmentId);
    }
    const org = await this.orgRepository.updateTeam(orgId, teamId, updateData);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization or Team not found");
    }
    return org.teams.find((t) => t._id.toString() === teamId.toString());
  }

  async deleteTeam(orgId: string | mongoose.Types.ObjectId, teamId: string | mongoose.Types.ObjectId) {
    return this.updateTeam(orgId, teamId, { active: false });
  }

  async getOrganizationUsage(orgId: string | mongoose.Types.ObjectId) {
    const org = await this.getOrganization(orgId);
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());

    let packageDetails: any = null;
    const targetPkgId = org.packageId || org.subscription?.packageId;
    if (targetPkgId && mongoose.Types.ObjectId.isValid(targetPkgId)) {
      packageDetails = await PackageModel.findById(targetPkgId).select(
        "name slug tier description billing features limits"
      );
    }

    // Live count queries across tenant domains
    const [userCount, storageAgg, journeyCount, kioskDevicesCount, kioskJourneysCount] = await Promise.all([
      User.countDocuments({ organizationId: orgObjectId, isDeleted: { $ne: true } }),
      Upload.aggregate([
        { $match: { organizationId: orgObjectId, "lifecycle.status": { $ne: "deleted" } } },
        { $group: { _id: null, totalBytes: { $sum: "$fileSizeBytes" }, count: { $sum: 1 } } },
      ]),
      Journey.countDocuments({ organizationId: orgObjectId, isDeleted: false }),
      KioskDeviceModel.countDocuments({
        $or: [
          { organizationId: orgObjectId },
          { organizationId: orgId.toString() as any },
        ],
        status: { $ne: "decommissioned" },
      }),
      KioskJourneyModel.countDocuments({
        $or: [
          { organizationId: orgObjectId },
          { organizationId: orgId.toString() as any },
        ],
        isDeleted: false,
      }),
    ]);

    const kioskCount = Math.max(kioskDevicesCount, kioskJourneysCount);
    const totalStorageBytes = storageAgg[0]?.totalBytes || 0;
    const totalFilesCount = storageAgg[0]?.count || 0;
    const totalStorageGb = Number((totalStorageBytes / (1024 * 1024 * 1024)).toFixed(2));

    // Limits Resolution
    const activeAddOnsList: string[] = org.subscription?.activeAddOns || [];
    const hasKioskAddOn = activeAddOnsList.includes("kiosk_mode");

    const maxUsers = org.limits?.maxUsers ?? org.subscription?.seatLimit ?? packageDetails?.limits?.maxUsers ?? 50;
    const maxStorageGb = org.limits?.maxStorageGb ?? packageDetails?.limits?.maxStorageGb ?? 10;
    const maxJourneys = org.limits?.maxJourneys ?? packageDetails?.limits?.maxJourneys ?? 20;

    let maxKiosks: number = org.limits?.maxKiosks !== undefined
      ? Number(org.limits.maxKiosks)
      : (packageDetails?.limits?.maxKiosks !== undefined ? Number(packageDetails.limits.maxKiosks) : 5);
    if (maxKiosks === 0 && hasKioskAddOn) {
      maxKiosks = 5;
    }

    const aiTokenMonthlyLimit = org.limits?.aiTokenMonthlyLimit ?? packageDetails?.limits?.aiTokenMonthlyLimit ?? 500000;
    const aiTokensUsed = 0;

    const computeMetric = (current: number, limit: number) => {
      const percent = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : (current > 0 ? 100 : 0);
      return {
        current,
        limit,
        available: Math.max(0, limit - current),
        percent,
        isWarning: limit > 0 && percent >= 80 && percent < 100,
        isExceeded: limit > 0 ? current >= limit : current > 0,
      };
    };

    const metrics = {
      users: computeMetric(userCount, maxUsers),
      storage: {
        currentBytes: totalStorageBytes,
        currentGb: totalStorageGb,
        limitGb: maxStorageGb,
        limitBytes: maxStorageGb * 1024 * 1024 * 1024,
        filesCount: totalFilesCount,
        percent: maxStorageGb > 0 ? Math.min(100, Math.round((totalStorageGb / maxStorageGb) * 100)) : 0,
        isWarning: (totalStorageGb / (maxStorageGb || 1)) >= 0.8 && totalStorageGb < maxStorageGb,
        isExceeded: totalStorageGb >= maxStorageGb,
      },
      journeys: computeMetric(journeyCount, maxJourneys),
      kiosks: {
        ...computeMetric(kioskCount, maxKiosks),
        devicesCount: kioskDevicesCount,
        journeysCount: kioskJourneysCount,
      },
      aiTokens: {
        current: aiTokensUsed,
        limit: aiTokenMonthlyLimit,
        available: Math.max(0, aiTokenMonthlyLimit - aiTokensUsed),
        percent: aiTokenMonthlyLimit > 0 ? Math.min(100, Math.round((aiTokensUsed / aiTokenMonthlyLimit) * 100)) : 0,
        isWarning: (aiTokensUsed / (aiTokenMonthlyLimit || 1)) >= 0.8 && aiTokensUsed < aiTokenMonthlyLimit,
        isExceeded: aiTokensUsed >= aiTokenMonthlyLimit,
      },
    };

    const warnings: string[] = [];
    if (metrics.users.isExceeded) warnings.push("User seat limit reached");
    else if (metrics.users.isWarning) warnings.push("User seat limit approaching capacity (>=80%)");

    if (metrics.storage.isExceeded) warnings.push("Storage capacity reached");
    else if (metrics.storage.isWarning) warnings.push("Storage limit approaching capacity (>=80%)");

    if (metrics.journeys.isExceeded) warnings.push("Journey creation limit reached");
    else if (metrics.journeys.isWarning) warnings.push("Journey limit approaching capacity (>=80%)");

    if (metrics.kiosks.isExceeded) warnings.push("Kiosk station limit reached");
    else if (metrics.kiosks.isWarning) warnings.push("Kiosk station limit approaching capacity (>=80%)");

    return {
      organizationId: org._id,
      name: org.name,
      subscription: {
        plan: org.subscription?.plan || org.plan || "Starter",
        status: org.subscription?.status || "active",
        billingCycle: org.subscription?.billingCycle || (org.subscription?.billingInterval === "annual" ? "annual" : "monthly"),
        billingInterval: org.subscription?.billingInterval || (org.subscription?.billingCycle === "annual" ? "annual" : "monthly"),
        currentPeriodStart: org.subscription?.currentPeriodStart,
        currentPeriodEnd: org.subscription?.currentPeriodEnd,
        cancelAtPeriodEnd: org.subscription?.cancelAtPeriodEnd ?? false,
        packageId: org.packageId || org.subscription?.packageId,
        packageName: org.subscription?.packageName || org.plan,
        basePrice: org.subscription?.basePrice,
        addOnPrice: org.subscription?.addOnPrice,
        customPrice: org.subscription?.customPrice,
        finalPrice: org.subscription?.finalPrice,
        customPricePerMonth: org.subscription?.customPricePerMonth,
        customPricePerYear: org.subscription?.customPricePerYear,
        activeAddOns: org.subscription?.activeAddOns || [],
        addOns: org.subscription?.addOns || org.subscription?.activeAddOns || [],
        addOnsTotal: org.subscription?.addOnsTotal || org.subscription?.addOnPrice || 0,
      },
      package: packageDetails,
      limits: org.limits,
      features: org.features || {},
      metrics,
      warnings,
    };
  }
}

export default OrganizationService;
