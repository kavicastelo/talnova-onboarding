import { User, IUser } from "../../auth/models/user.model.js";
import mongoose from "mongoose";

export interface EmployeeFilter {
  organizationId: mongoose.Types.ObjectId | string;
  departmentId?: string;
  teamId?: string;
  managerId?: string;
  status?: string;
  search?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export class EmployeeRepository {
  async findById(id: string | mongoose.Types.ObjectId): Promise<IUser | null> {
    return User.findOne({ _id: id, isDeleted: false });
  }

  async findByIdAndOrg(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IUser | null> {
    return User.findOne({ _id: id, organizationId: orgId, isDeleted: false });
  }

  async find(
    filter: EmployeeFilter,
    pagination: PaginationOptions
  ): Promise<{ employees: IUser[]; total: number }> {
    const query: Record<string, any> = {
      organizationId: filter.organizationId,
      isDeleted: false,
    };

    if (filter.departmentId) {
      query["employment.departmentId"] = new mongoose.Types.ObjectId(filter.departmentId);
    }
    if (filter.teamId) {
      query["employment.teamId"] = new mongoose.Types.ObjectId(filter.teamId);
    }
    if (filter.managerId) {
      query["employment.managerId"] = new mongoose.Types.ObjectId(filter.managerId);
    }
    if (filter.status) {
      query["employment.status"] = filter.status;
    }

    if (filter.search) {
      const searchRegex = new RegExp(filter.search, "i");
      query.$or = [
        { "profile.firstName": searchRegex },
        { "profile.lastName": searchRegex },
        { "auth.email": searchRegex },
        { "employment.employeeId": searchRegex },
      ];
    }

    const total = await User.countDocuments(query);
    
    const page = Math.max(1, pagination.page);
    const limit = Math.max(1, pagination.limit);
    const skip = (page - 1) * limit;

    const sortField = pagination.sortBy || "createdAt";
    const sortOrder = pagination.sortOrder === "asc" ? 1 : -1;

    const employees = await User.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

    return { employees, total };
  }

  async create(employeeData: Partial<IUser>): Promise<IUser> {
    const user = new User(employeeData);
    return user.save();
  }

  async update(
    id: string | mongoose.Types.ObjectId,
    updateData: Partial<IUser>
  ): Promise<IUser | null> {
    return User.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updateData },
      { new: true }
    );
  }

  async softDelete(
    id: string | mongoose.Types.ObjectId,
    deletedBy: string | mongoose.Types.ObjectId
  ): Promise<IUser | null> {
    return User.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: new mongoose.Types.ObjectId(deletedBy),
          "employment.status": "inactive",
        },
      },
      { new: true }
    );
  }
}

export default EmployeeRepository;
