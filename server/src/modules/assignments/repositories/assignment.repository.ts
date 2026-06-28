import { EmployeeAssignment, IEmployeeAssignment } from "../models/assignment.model.js";
import mongoose from "mongoose";

export interface AssignmentFilter {
  organizationId: string | mongoose.Types.ObjectId;
  employeeId?: string | mongoose.Types.ObjectId;
  status?: string;
  journeyId?: string | mongoose.Types.ObjectId;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export class EmployeeAssignmentRepository {
  async findById(id: string | mongoose.Types.ObjectId): Promise<IEmployeeAssignment | null> {
    return EmployeeAssignment.findOne({ _id: id });
  }

  async findByIdAndOrg(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IEmployeeAssignment | null> {
    return EmployeeAssignment.findOne({ _id: id, organizationId: orgId });
  }

  async find(
    filter: AssignmentFilter,
    pagination: PaginationOptions
  ): Promise<{ assignments: IEmployeeAssignment[]; total: number }> {
    const query: Record<string, any> = {
      organizationId: filter.organizationId,
    };

    if (filter.employeeId) {
      query.employeeId = new mongoose.Types.ObjectId(filter.employeeId);
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.journeyId) {
      query["journey.journeyId"] = new mongoose.Types.ObjectId(filter.journeyId);
    }

    const total = await EmployeeAssignment.countDocuments(query);

    const page = Math.max(1, pagination.page);
    const limit = Math.max(1, pagination.limit);
    const skip = (page - 1) * limit;

    const sortField = pagination.sortBy || "createdAt";
    const sortOrder = pagination.sortOrder === "asc" ? 1 : -1;

    const assignments = await EmployeeAssignment.find(query)
      .populate("employeeId", "profile.firstName profile.lastName auth.email")
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

    return { assignments, total };
  }

  async create(assignmentData: Partial<IEmployeeAssignment>): Promise<IEmployeeAssignment> {
    const assignment = new EmployeeAssignment(assignmentData);
    return assignment.save();
  }

  async update(
    id: string | mongoose.Types.ObjectId,
    updateData: Partial<IEmployeeAssignment>
  ): Promise<IEmployeeAssignment | null> {
    return EmployeeAssignment.findOneAndUpdate(
      { _id: id },
      { $set: updateData },
      { new: true }
    );
  }
}

export default EmployeeAssignmentRepository;
