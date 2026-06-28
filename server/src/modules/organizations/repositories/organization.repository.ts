import { Organization, IOrganization, IDepartment, ITeam } from "../models/organization.model.js";
import mongoose from "mongoose";

export class OrganizationRepository {
  async findById(id: string | mongoose.Types.ObjectId): Promise<IOrganization | null> {
    return Organization.findOne({ _id: id, isDeleted: false });
  }

  async findBySlug(slug: string): Promise<IOrganization | null> {
    return Organization.findOne({ slug: slug.toLowerCase(), isDeleted: false });
  }

  async create(orgData: Partial<IOrganization>): Promise<IOrganization> {
    const org = new Organization(orgData);
    return org.save();
  }

  async update(id: string | mongoose.Types.ObjectId, updateData: Partial<IOrganization>): Promise<IOrganization | null> {
    return Organization.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updateData },
      { new: true }
    );
  }

  // Department sub-document operations
  async addDepartment(orgId: string | mongoose.Types.ObjectId, department: Partial<IDepartment>): Promise<IOrganization | null> {
    return Organization.findOneAndUpdate(
      { _id: orgId, isDeleted: false },
      { $push: { departments: department } },
      { new: true }
    );
  }

  async updateDepartment(orgId: string | mongoose.Types.ObjectId, deptId: string | mongoose.Types.ObjectId, updateData: Partial<IDepartment>): Promise<IOrganization | null> {
    // Map fields to $set operators
    const updateObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(updateData)) {
      updateObj[`departments.$.${key}`] = value;
    }
    return Organization.findOneAndUpdate(
      { _id: orgId, "departments._id": deptId, isDeleted: false },
      { $set: updateObj },
      { new: true }
    );
  }

  // Team sub-document operations
  async addTeam(orgId: string | mongoose.Types.ObjectId, team: Partial<ITeam>): Promise<IOrganization | null> {
    return Organization.findOneAndUpdate(
      { _id: orgId, isDeleted: false },
      { $push: { teams: team } },
      { new: true }
    );
  }

  async updateTeam(orgId: string | mongoose.Types.ObjectId, teamId: string | mongoose.Types.ObjectId, updateData: Partial<ITeam>): Promise<IOrganization | null> {
    const updateObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(updateData)) {
      updateObj[`teams.$.${key}`] = value;
    }
    return Organization.findOneAndUpdate(
      { _id: orgId, "teams._id": teamId, isDeleted: false },
      { $set: updateObj },
      { new: true }
    );
  }
}

export default OrganizationRepository;
