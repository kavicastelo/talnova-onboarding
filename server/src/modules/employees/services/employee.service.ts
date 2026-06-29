import EmployeeRepository, { EmployeeFilter, PaginationOptions } from "../repositories/employee.repository.js";
import AppError from "../../../common/errors/app-error.js";
import { hashPassword, verifyPassword } from "../../../utils/crypto.js";
import mongoose from "mongoose";
import { User } from "../../auth/models/user.model.js";
import crypto from "crypto";
import { EmailService } from "../../../shared/email/email.service.js";
import { Organization } from "../../organizations/models/organization.model.js";

export class EmployeeService {
  constructor(private readonly employeeRepository: EmployeeRepository) {}

  async getProfile(userId: string | mongoose.Types.ObjectId) {
    const employee = await this.employeeRepository.findById(userId);
    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "User profile not found");
    }
    return employee;
  }

  async updateProfile(userId: string | mongoose.Types.ObjectId, profileData: { firstName: string; lastName: string; phone?: string; location?: string; timezone?: string }) {
    const employee = await this.employeeRepository.findById(userId);
    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "User profile not found");
    }

    const updateObj = {
      "profile.firstName": profileData.firstName,
      "profile.lastName": profileData.lastName,
      "profile.phone": profileData.phone,
      "profile.location": profileData.location,
      "profile.timezone": profileData.timezone,
    };

    return this.employeeRepository.update(userId, updateObj as any);
  }

  async updatePreferences(userId: string | mongoose.Types.ObjectId, preferences: { language?: string; theme?: "light" | "dark" | "system"; emailNotifications?: boolean }) {
    const employee = await this.employeeRepository.findById(userId);
    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "User profile not found");
    }

    const updateObj: Record<string, any> = {};
    if (preferences.language !== undefined) updateObj["preferences.language"] = preferences.language;
    if (preferences.theme !== undefined) updateObj["preferences.theme"] = preferences.theme;
    if (preferences.emailNotifications !== undefined) updateObj["preferences.emailNotifications"] = preferences.emailNotifications;

    return this.employeeRepository.update(userId, updateObj);
  }

  async changePassword(userId: string | mongoose.Types.ObjectId, oldPass: string, newPass: string) {
    const employee = await this.employeeRepository.findById(userId);
    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const isValid = await verifyPassword(oldPass, employee.auth.passwordHash);
    if (!isValid) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid current password");
    }

    const newHash = await hashPassword(newPass);
    const updateObj = {
      "auth.passwordHash": newHash,
      "auth.passwordChangedAt": new Date(),
    };

    await this.employeeRepository.update(userId, updateObj as any);
  }

  async listEmployees(filter: EmployeeFilter, pagination: PaginationOptions) {
    return this.employeeRepository.find(filter, pagination);
  }

  async getEmployee(employeeId: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    const employee = await this.employeeRepository.findByIdAndOrg(employeeId, orgId);
    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "Employee not found");
    }
    return employee;
  }

  async inviteEmployee(
    orgId: string | mongoose.Types.ObjectId,
    invitationData: {
      email: string;
      firstName: string;
      lastName: string;
      role: "owner" | "admin" | "manager" | "employee";
      departmentId?: string;
      teamId?: string;
      jobTitleId?: string;
      managerId?: string;
      employmentType: "full_time" | "part_time" | "contractor" | "intern";
    },
    invitedBy: string | mongoose.Types.ObjectId
  ) {
    const email = invitationData.email.toLowerCase();
    const existing = await this.employeeRepository.findById(invitedBy); // check inviter
    const existingEmail = await User.findOne({ "auth.email": email, isDeleted: false });
    if (existingEmail) {
      throw new AppError(409, "CONFLICT", "A user with this email address already exists.");
    }

    // Set temporary password hash (must be updated during invitation accept flow)
    const tempPasswordHash = await hashPassword(Math.random().toString(36).slice(-10) + "Temp123!");

    // Generate random invitation token and hash it
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expires = new Date(Date.now() + 24 * 3600000); // 24 hours expiry

    const employeeObj = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      auth: {
        email,
        passwordHash: tempPasswordHash,
        emailVerified: false,
      },
      profile: {
        firstName: invitationData.firstName,
        lastName: invitationData.lastName,
        fullName: `${invitationData.firstName} ${invitationData.lastName}`.trim(),
      },
      employment: {
        departmentId: invitationData.departmentId ? new mongoose.Types.ObjectId(invitationData.departmentId) : undefined,
        teamId: invitationData.teamId ? new mongoose.Types.ObjectId(invitationData.teamId) : undefined,
        jobTitleId: invitationData.jobTitleId ? new mongoose.Types.ObjectId(invitationData.jobTitleId) : undefined,
        managerId: invitationData.managerId ? new mongoose.Types.ObjectId(invitationData.managerId) : undefined,
        employmentType: invitationData.employmentType,
        status: "invited" as const,
      },
      permissions: {
        role: invitationData.role,
        customRoles: [],
      },
      security: {
        mfaEnabled: false,
        failedLoginAttempts: 0,
        passwordResetToken: hashedToken,
        passwordResetExpires: expires,
      },
      createdBy: new mongoose.Types.ObjectId(invitedBy),
      isDeleted: false,
    };

    const createdUser = await this.employeeRepository.create(employeeObj as any);

    // Fetch organization info to personalize the email
    const org = await Organization.findById(orgId);
    const orgName = org?.name || "Talnova Workspace";

    // Send invitation email using EmailService
    const emailService = new EmailService();
    await emailService.sendInvitationEmail(email, rawToken, orgName);

    return createdUser;
  }

  async updateEmployee(
    employeeId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    updateData: any
  ) {
    const employee = await this.employeeRepository.findByIdAndOrg(employeeId, orgId);
    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "Employee not found");
    }

    // Map properties securely
    const updateObj: Record<string, any> = {};
    if (updateData.firstName !== undefined) updateObj["profile.firstName"] = updateData.firstName;
    if (updateData.lastName !== undefined) updateObj["profile.lastName"] = updateData.lastName;
    if (updateData.departmentId !== undefined) {
      updateObj["employment.departmentId"] = updateData.departmentId ? new mongoose.Types.ObjectId(updateData.departmentId) : null;
    }
    if (updateData.teamId !== undefined) {
      updateObj["employment.teamId"] = updateData.teamId ? new mongoose.Types.ObjectId(updateData.teamId) : null;
    }
    if (updateData.managerId !== undefined) {
      updateObj["employment.managerId"] = updateData.managerId ? new mongoose.Types.ObjectId(updateData.managerId) : null;
    }
    if (updateData.status !== undefined) updateObj["employment.status"] = updateData.status;
    if (updateData.role !== undefined) updateObj["permissions.role"] = updateData.role;

    return this.employeeRepository.update(employeeId, updateObj);
  }

  async deleteEmployee(
    employeeId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    deletedBy: string | mongoose.Types.ObjectId
  ) {
    const employee = await this.employeeRepository.findByIdAndOrg(employeeId, orgId);
    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "Employee not found");
    }
    return this.employeeRepository.softDelete(employeeId, deletedBy);
  }
}

export default EmployeeService;
