import OrganizationRepository from "../repositories/organization.repository.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";
import { IDepartment, ITeam } from "../models/organization.model.js";

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
    return this.updateOrganization(orgId, { branding });
  }

  async updateSecurity(orgId: string | mongoose.Types.ObjectId, securitySettings: any) {
    return this.updateOrganization(orgId, { securitySettings });
  }

  // Department services
  async createDepartment(orgId: string | mongoose.Types.ObjectId, deptData: { name: string; description?: string; color?: string }) {
    const dept: Partial<IDepartment> = {
      _id: new mongoose.Types.ObjectId(),
      name: deptData.name,
      description: deptData.description,
      color: deptData.color,
      active: true,
    };
    const org = await this.orgRepository.addDepartment(orgId, dept);
    if (!org) {
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
    return this.updateDepartment(orgId, deptId, { active: false });
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
}

export default OrganizationService;
