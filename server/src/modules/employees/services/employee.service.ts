import EmployeeRepository, { EmployeeFilter, PaginationOptions } from "../repositories/employee.repository.js";
import AppError from "../../../common/errors/app-error.js";
import { hashPassword, verifyPassword } from "../../../utils/crypto.js";
import mongoose from "mongoose";
import { User } from "../../auth/models/user.model.js";
import crypto from "crypto";
import { EmailService } from "../../../shared/email/email.service.js";
import { Organization } from "../../organizations/models/organization.model.js";
import eventBus from "../../../infrastructure/events/event-bus.js";
import onboardingCaseService from "../../onboarding/services/onboarding-case.service.js";
import OutboxEvent from "../../onboarding/models/outbox-event.model.js";
import roleChecklistService from "../../tasks/services/role-checklist.service.js";
import OrganizationIntegrationService from "../../integrations/services/organization-integration.service.js";

export const DEFAULT_EMPLOYEE_TEMPORARY_PASSWORD = process.env.DEFAULT_EMPLOYEE_PASSWORD || "Password@123!";

export class EmployeeService {
  private integrationService = new OrganizationIntegrationService();
  constructor(private readonly employeeRepository: EmployeeRepository = new EmployeeRepository()) { }

  async getProfile(userId: string | mongoose.Types.ObjectId) {
    const employee = await this.employeeRepository.findById(userId);
    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "User profile not found");
    }
    return employee;
  }

  async updateProfile(userId: string | mongoose.Types.ObjectId, profileData: { firstName: string; lastName: string; phone?: string; location?: string; timezone?: string; avatar?: { uploadId: string; fileName: string; publicUrl?: string } }) {
    const employee = await this.employeeRepository.findById(userId);
    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "User profile not found");
    }

    const updateObj: Record<string, any> = {
      "profile.firstName": profileData.firstName,
      "profile.lastName": profileData.lastName,
      "profile.phone": profileData.phone,
      "profile.location": profileData.location,
      "profile.timezone": profileData.timezone,
    };

    if (profileData.avatar) {
      updateObj["profile.avatar"] = profileData.avatar;
    }

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
      email?: string;
      employeeId?: string;
      phone?: string;
      badgeId?: string;
      initialPassword?: string;
      firstName: string;
      lastName: string;
      role: "owner" | "admin" | "manager" | "employee" | "super_admin" | "it_admin" | "hr_admin";
      roles?: string[];
      customRoles?: string[];
      department?: string;
      departmentId?: string;
      teamId?: string;
      jobTitleId?: string;
      designation?: string;
      payrollCategory?: string;
      managerId?: string;
      employmentType?: "full_time" | "part_time" | "contractor" | "intern";
      hireDate?: string | Date;
    },
    invitedBy: string | mongoose.Types.ObjectId
  ) {
    const email = invitationData.email ? invitationData.email.toLowerCase().trim() : undefined;
    const employeeId = invitationData.employeeId ? invitationData.employeeId.trim() : undefined;
    const phone = invitationData.phone ? invitationData.phone.trim() : undefined;
    const badgeId = invitationData.badgeId ? invitationData.badgeId.trim() : undefined;

    if (!email) {
      throw new AppError(400, "BAD_REQUEST", "Email address is required to send an employee invitation.");
    }

    // 1. Uniqueness checks per identifier
    if (email) {
      const existingEmail = await User.findOne({ "auth.email": email, isDeleted: false });
      if (existingEmail) {
        throw new AppError(409, "CONFLICT", "A user with this email address already exists.");
      }
    }

    if (employeeId) {
      const existingEmpId = await User.findOne({
        organizationId: new mongoose.Types.ObjectId(orgId),
        "employment.employeeId": employeeId,
        isDeleted: false,
      });
      if (existingEmpId) {
        throw new AppError(409, "CONFLICT", "A user with this employee ID already exists in this organization.");
      }
    }

    if (phone) {
      const existingPhone = await User.findOne({
        organizationId: new mongoose.Types.ObjectId(orgId),
        "profile.phone": phone,
        isDeleted: false,
      });
      if (existingPhone) {
        throw new AppError(409, "CONFLICT", "A user with this phone number already exists in this organization.");
      }
    }

    // 2. Verify email client configuration ONLY if email delivery is required
    let activeEmail: any = null;
    if (email) {
      activeEmail = await this.integrationService.getActiveEmailClient(orgId);
    }

    // 3. Fetch organization info to verify existence and check seat quota
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const maxUsers = org.limits?.maxUsers ?? org.subscription?.seatLimit ?? 50;
    const currentUserCount = await User.countDocuments({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: { $ne: true },
    });

    if (currentUserCount >= maxUsers) {
      throw new AppError(
        403,
        "SEAT_LIMIT_REACHED",
        `Organization user seat limit reached (${currentUserCount}/${maxUsers}). Please upgrade your plan to invite more members.`
      );
    }

    // 4. Password and Invitation Tokens
    // For email invitations: generate temporary password and invite token to complete registration
    // For non-email workers (e.g. ground workers, kiosk users): use initialPassword if provided or generate an initial temporary password
    const rawTempPassword = invitationData.initialPassword || (Math.random().toString(36).slice(-8) + "Temp1!");
    const tempPasswordHash = await hashPassword(rawTempPassword);

    const rawToken = email ? crypto.randomBytes(32).toString("hex") : undefined;
    const hashedToken = rawToken ? crypto.createHash("sha256").update(rawToken).digest("hex") : undefined;
    const expires = rawToken ? new Date(Date.now() + 24 * 3600000) : undefined; // 24 hours expiry

    const employeeObj: any = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      auth: {
        passwordHash: tempPasswordHash,
        emailVerified: false,
      },
      profile: {
        firstName: invitationData.firstName,
        lastName: invitationData.lastName,
        fullName: `${invitationData.firstName} ${invitationData.lastName}`.trim(),
        phone: phone,
      },
      employment: {
        employeeId: employeeId, // if undefined, UserSchema.pre('validate') will auto-generate EMP-XXXXXX!
        badgeId: badgeId,
        department: (invitationData as any).department || (!mongoose.Types.ObjectId.isValid(invitationData.departmentId || "") ? invitationData.departmentId : undefined),
        departmentId: invitationData.departmentId && mongoose.Types.ObjectId.isValid(invitationData.departmentId) ? new mongoose.Types.ObjectId(invitationData.departmentId) : undefined,
        teamId: invitationData.teamId && mongoose.Types.ObjectId.isValid(invitationData.teamId) ? new mongoose.Types.ObjectId(invitationData.teamId) : undefined,
        jobTitleId: invitationData.jobTitleId && mongoose.Types.ObjectId.isValid(invitationData.jobTitleId) ? new mongoose.Types.ObjectId(invitationData.jobTitleId) : undefined,
        designation: invitationData.designation,
        payrollCategory: invitationData.payrollCategory,
        managerId: invitationData.managerId && mongoose.Types.ObjectId.isValid(invitationData.managerId) ? new mongoose.Types.ObjectId(invitationData.managerId) : undefined,
        employmentType: invitationData.employmentType || "full_time",
        hireDate: invitationData.hireDate ? new Date(invitationData.hireDate) : new Date(),
        status: email ? ("invited" as const) : ("active" as const),
      },
      permissions: {
        role: invitationData.role,
        roles: invitationData.roles && invitationData.roles.length > 0 ? invitationData.roles : [invitationData.role],
        customRoles: invitationData.customRoles || [],
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

    if (email) {
      employeeObj.auth.email = email;
    }

    const createdUser = await this.employeeRepository.create(employeeObj as any);

    // Instantiate OnboardingCase and OutboxEvent for transactional state tracking
    let onboardingCase: any = null;
    try {
      const caseResult = await onboardingCaseService.createCase({
        organizationId: orgId.toString(),
        employeeId: createdUser._id.toString(),
        source: email ? "invite" : "manual",
        idempotencyKey: `user_invite_${createdUser._id}`,
        createdBy: invitedBy.toString(),
      });
      onboardingCase = caseResult.case;
    } catch (caseErr: any) {
      console.warn("[EmployeeService] OnboardingCase creation handled:", caseErr?.message);
    }

    // Send invitation email using organization email service if email was provided
    if (email && activeEmail && rawToken) {
      const orgName = org?.name || "Talnova Workspace";
      await activeEmail.service.sendInvitationEmail(activeEmail.config, activeEmail.secrets, email, rawToken, orgName);
    }

    // Publish USER_CREATED event to trigger workflows, auto-enrollment, documents, milestones, buddy, calendar
    await eventBus.publish({
      eventName: "USER_CREATED",
      organizationId: orgId,
      actorId: createdUser._id,
      entityId: createdUser._id,
      payload: {
        userId: createdUser._id.toString(),
        caseId: onboardingCase?._id?.toString(),
        email: createdUser.auth?.email,
        employeeId: createdUser.employment?.employeeId,
        phone: createdUser.profile?.phone,
        role: createdUser.permissions.role,
        department: invitationData.departmentId || createdUser.employment?.department,
        firstName: createdUser.profile.firstName,
        lastName: createdUser.profile.lastName,
        invitedBy: invitedBy.toString(),
      },
    });

    if (onboardingCase) {
      await eventBus.publish({
        eventName: "ONBOARDING_CASE_CREATED",
        organizationId: orgId,
        actorId: createdUser._id,
        entityId: onboardingCase._id,
        payload: {
          caseId: onboardingCase._id.toString(),
          employeeId: createdUser._id.toString(),
          source: email ? "invite" : "manual",
          userId: createdUser._id.toString(),
          email: createdUser.auth?.email,
          role: createdUser.permissions.role,
          department: invitationData.departmentId || createdUser.employment?.department,
        },
      });
    }

    const result = (createdUser as any).toObject ? (createdUser as any).toObject() : { ...createdUser };
    result.temporaryPassword = rawTempPassword;
    result.employeeId = createdUser.employment?.employeeId;
    return result;
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

    const previousValues = {
      department: employee.employment?.department,
      departmentId: employee.employment?.departmentId?.toString(),
      role: employee.permissions?.role,
      managerId: employee.employment?.managerId?.toString(),
      status: employee.employment?.status,
    };

    // Map properties securely
    const updateObj: Record<string, any> = {};
    if (updateData.firstName !== undefined) updateObj["profile.firstName"] = updateData.firstName;
    if (updateData.lastName !== undefined) updateObj["profile.lastName"] = updateData.lastName;
    if (updateData.phone !== undefined) updateObj["profile.phone"] = updateData.phone;
    if (updateData.employeeId !== undefined) updateObj["employment.employeeId"] = updateData.employeeId;
    if (updateData.badgeId !== undefined) updateObj["employment.badgeId"] = updateData.badgeId;
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
    if (updateData.roles !== undefined) updateObj["permissions.roles"] = updateData.roles;
    if (updateData.customRoles !== undefined) updateObj["permissions.customRoles"] = updateData.customRoles;
    if (updateData.designation !== undefined) {
      updateObj["employment.designation"] = updateData.designation;
      updateObj["profile.title"] = updateData.designation;
    }
    if (updateData.payrollCategory !== undefined) updateObj["employment.payrollCategory"] = updateData.payrollCategory;
    if ((updateData as any).employmentType !== undefined) updateObj["employment.employmentType"] = (updateData as any).employmentType;
    if (updateData.hireDate !== undefined) {
      updateObj["employment.hireDate"] = updateData.hireDate ? new Date(updateData.hireDate) : null;
    }

    const updatedEmployee = await this.employeeRepository.update(employeeId, updateObj);

    // Detect mutations and publish domain events
    const departmentChanged = updateData.departmentId !== undefined && String(updateData.departmentId) !== String(previousValues.departmentId);
    const roleChanged = updateData.role !== undefined && updateData.role !== previousValues.role;
    const managerChanged = updateData.managerId !== undefined && String(updateData.managerId) !== String(previousValues.managerId);

    if (departmentChanged || roleChanged || managerChanged || updateData.status !== undefined) {
      const deltaPayload = {
        userId: employeeId.toString(),
        organizationId: orgId.toString(),
        previousValues,
        updatedValues: {
          departmentId: updateData.departmentId,
          role: updateData.role,
          managerId: updateData.managerId,
          status: updateData.status,
        },
      };

      // Record in Transactional Outbox
      try {
        await OutboxEvent.create({
          organizationId: new mongoose.Types.ObjectId(orgId),
          aggregateType: "employee",
          aggregateId: new mongoose.Types.ObjectId(employeeId),
          eventName: "employee.profile_updated",
          eventVersion: 1,
          correlationId: crypto.randomUUID(),
          payload: deltaPayload,
          status: "published",
          publishedAt: new Date(),
        });
      } catch (outboxErr) {
        console.warn("[EmployeeService] OutboxEvent write for profile update:", outboxErr);
      }

      await eventBus.publish({
        eventName: "USER_UPDATED",
        organizationId: orgId,
        actorId: employeeId,
        entityId: employeeId,
        payload: deltaPayload,
      });

      if (departmentChanged) {
        await eventBus.publish({
          eventName: "USER_DEPARTMENT_CHANGED",
          organizationId: orgId,
          actorId: employeeId,
          entityId: employeeId,
          payload: deltaPayload,
        });
      }

      if (roleChanged) {
        await eventBus.publish({
          eventName: "USER_ROLE_CHANGED",
          organizationId: orgId,
          actorId: employeeId,
          entityId: employeeId,
          payload: deltaPayload,
        });
      }
    }

    return updatedEmployee;
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

  async validateBulkImport(
    orgId: string | mongoose.Types.ObjectId,
    usersData: Array<{
      email?: string | null;
      name?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      fullName?: string | null;
      department?: string | null;
      departmentId?: string | null;
      jobTitle?: string | null;
      role?: string | null;
      employeeId?: string | null;
      managerEmail?: string | null;
      managerEmployeeId?: string | null;
      designation?: string | null;
      payrollCategory?: string | null;
      employmentType?: "full_time" | "part_time" | "contractor" | "intern" | null;
      hireDate?: string | Date | null;
      phone?: string | null;
      location?: string | null;
      timezone?: string | null;
      badgeId?: string | null;
      nationalId?: string | null;
      customAttributes?: Record<string, any> | null;
    }>,
    options?: {
      updateExisting?: boolean;
      triggerWorkflows?: boolean;
      autoAssignRoleChecklists?: boolean;
      sendInvites?: boolean;
      defaultJourneyId?: string | null;
    }
  ) {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors: Array<{ row: number; email: string; field: string; reason: string }> = [];
    const warnings: Array<{ row: number; email: string; field: string; message: string }> = [];
    const conflicts: Array<{ row: number; email: string; reason: string; existingUser?: any }> = [];
    const newDepartmentsSet = new Set<string>();

    // 1. Pre-index existing organization departments
    const orgDeptNames = new Set((org.departments || []).map((d) => d.name.toLowerCase()));
    const orgDeptIds = new Set((org.departments || []).map((d) => d._id.toString()));

    // 2. Pre-fetch existing users in organization by email, employeeId, and phone for O(1) duplicate checks
    const targetEmails = usersData
      .map((u) => u.email?.toLowerCase().trim())
      .filter(Boolean) as string[];
    const targetEmpIds = usersData
      .map((u) => (u.employeeId ? String(u.employeeId).trim() : ""))
      .filter(Boolean) as string[];
    const targetPhones = usersData
      .map((u) => (u.phone ? String(u.phone).trim() : ""))
      .filter(Boolean) as string[];

    const lookupOr: any[] = [];
    if (targetEmails.length > 0) lookupOr.push({ "auth.email": { $in: targetEmails } });
    if (targetEmpIds.length > 0) lookupOr.push({ "employment.employeeId": { $in: targetEmpIds } });
    if (targetPhones.length > 0) lookupOr.push({ "profile.phone": { $in: targetPhones } });

    const existingUsers = lookupOr.length > 0
      ? await User.find(
        { organizationId: orgId, isDeleted: false, $or: lookupOr },
        {
          "auth.email": 1,
          "employment.employeeId": 1,
          "profile.phone": 1,
          "profile.fullName": 1,
          "profile.firstName": 1,
          "profile.lastName": 1,
          "permissions.role": 1,
          "employment.department": 1,
        }
      )
      : [];

    const existingEmailMap = new Map<string, any>();
    const existingEmpIdMap = new Map<string, any>();
    const existingPhoneMap = new Map<string, any>();
    existingUsers.forEach((u) => {
      if (u.auth?.email) existingEmailMap.set(u.auth.email.toLowerCase(), u);
      if (u.employment?.employeeId) existingEmpIdMap.set(u.employment.employeeId, u);
      if (u.profile?.phone) existingPhoneMap.set(u.profile.phone, u);
    });

    // 3. Pre-fetch candidate managers
    const candidateManagerEmails = usersData
      .map((u) => u.managerEmail?.toLowerCase().trim())
      .filter(Boolean) as string[];
    const candidateManagerEmpIds = usersData
      .map((u) => (u.managerEmployeeId ? String(u.managerEmployeeId).trim() : ""))
      .filter(Boolean) as string[];

    const managerLookupOr: any[] = [];
    if (candidateManagerEmails.length > 0) managerLookupOr.push({ "auth.email": { $in: candidateManagerEmails } });
    if (candidateManagerEmpIds.length > 0) managerLookupOr.push({ "employment.employeeId": { $in: candidateManagerEmpIds } });

    const existingManagers = managerLookupOr.length > 0
      ? await User.find(
        {
          organizationId: orgId,
          isDeleted: false,
          $or: managerLookupOr,
        },
        { "auth.email": 1, "employment.employeeId": 1, "profile.fullName": 1 }
      )
      : [];
    const existingManagerEmails = new Set(existingManagers.map((m) => m.auth?.email?.toLowerCase()).filter(Boolean) as string[]);
    const existingManagerEmpIds = new Set(existingManagers.map((m) => m.employment?.employeeId).filter(Boolean));

    const inBatchEmailSet = new Set<string>();
    const inBatchEmpIdSet = new Set<string>();
    const inBatchPhoneSet = new Set<string>();
    const inBatchBadgeSet = new Set<string>();
    let willUpdateCount = 0;
    let willCreateCount = 0;

    usersData.forEach((row, index) => {
      const rowNum = index + 1;
      const rawEmail = (row.email || "").trim();
      const email = rawEmail.toLowerCase();
      const rawEmpId = row.employeeId ? String(row.employeeId).trim() : "";
      const rawPhone = row.phone ? String(row.phone).trim() : "";
      const rowIdentifier = rawEmail || rawEmpId || rawPhone || "";

      // Tri-Factor Identifier Validation: At least one of email, employeeId, or phone
      if (!email && !rawEmpId && !rawPhone) {
        errors.push({
          row: rowNum,
          email: "",
          field: "identifier",
          reason: "Row must include at least one identifier (email, employee ID, or phone number)",
        });
        return;
      }

      // Email format & duplicate validation (if email provided)
      if (email) {
        if (!emailRegex.test(email)) {
          errors.push({ row: rowNum, email: rowIdentifier, field: "email", reason: "Invalid email address format" });
          return;
        }
        if (inBatchEmailSet.has(email)) {
          errors.push({ row: rowNum, email: rowIdentifier, field: "email", reason: "Duplicate email in the same import file" });
          return;
        }
        inBatchEmailSet.add(email);
      }

      // Employee ID duplicate check (if provided)
      if (rawEmpId) {
        if (inBatchEmpIdSet.has(rawEmpId)) {
          errors.push({ row: rowNum, email: rowIdentifier, field: "employeeId", reason: "Duplicate employee ID in the same import file" });
          return;
        }
        inBatchEmpIdSet.add(rawEmpId);
      }

      // Phone duplicate check (if provided)
      if (rawPhone) {
        if (inBatchPhoneSet.has(rawPhone)) {
          errors.push({ row: rowNum, email: rowIdentifier, field: "phone", reason: "Duplicate phone number in the same import file" });
          return;
        }
        inBatchPhoneSet.add(rawPhone);
      }

      // Name validation
      const hasName = Boolean(row.name?.trim() || row.fullName?.trim() || row.firstName?.trim());
      if (!hasName) {
        errors.push({ row: rowNum, email: rowIdentifier, field: "fullName", reason: "Employee full name or first name is required" });
      }

      // Existing user conflict check
      let matchedExistingUser: any = null;
      let conflictField = "";
      if (email && existingEmailMap.has(email)) {
        matchedExistingUser = existingEmailMap.get(email);
        conflictField = "email address";
      } else if (rawEmpId && existingEmpIdMap.has(rawEmpId)) {
        matchedExistingUser = existingEmpIdMap.get(rawEmpId);
        conflictField = "employee ID";
      } else if (rawPhone && existingPhoneMap.has(rawPhone)) {
        matchedExistingUser = existingPhoneMap.get(rawPhone);
        conflictField = "phone number";
      }

      if (matchedExistingUser) {
        if (options?.updateExisting) {
          willUpdateCount++;
        } else {
          conflicts.push({
            row: rowNum,
            email: rowIdentifier,
            reason: `User with this ${conflictField} already exists in this organization`,
            existingUser: {
              name: matchedExistingUser?.profile?.fullName || `${matchedExistingUser?.profile?.firstName || ""} ${matchedExistingUser?.profile?.lastName || ""}`.trim() || "User",
              role: matchedExistingUser?.permissions?.role || "employee",
              department: matchedExistingUser?.employment?.department || "General",
            },
          });
        }
      } else {
        willCreateCount++;
      }

      // Department check
      const dept = (row.department || row.departmentId || "").trim();
      if (dept) {
        const isKnown = orgDeptIds.has(dept) || orgDeptNames.has(dept.toLowerCase());
        if (!isKnown) {
          newDepartmentsSet.add(dept);
        }
      }

      // Manager check
      if (row.managerEmail) {
        const mEmail = row.managerEmail.trim().toLowerCase();
        const isManagerKnown = existingManagerEmails.has(mEmail) || inBatchEmailSet.has(mEmail);
        if (!isManagerKnown) {
          warnings.push({
            row: rowNum,
            email: rowIdentifier,
            field: "managerEmail",
            message: `Designated manager email "${row.managerEmail}" is not yet registered in organization`,
          });
        }
      } else if (row.managerEmployeeId) {
        const mEmpId = String(row.managerEmployeeId).trim();
        const isManagerKnown = existingManagerEmpIds.has(mEmpId) || inBatchEmpIdSet.has(mEmpId);
        if (!isManagerKnown) {
          warnings.push({
            row: rowNum,
            email: rowIdentifier,
            field: "managerEmployeeId",
            message: `Designated manager employee ID "${row.managerEmployeeId}" not found in organization`,
          });
        }
      }

      // Frontline Worker Badge ID check (K-ENT-001)
      if (row.badgeId) {
        const cleanBadge = String(row.badgeId).trim();
        if (cleanBadge) {
          if (inBatchBadgeSet.has(cleanBadge)) {
            errors.push({
              row: rowNum,
              email: rowIdentifier,
              field: "badgeId",
              reason: `Duplicate badge ID "${cleanBadge}" within import batch`,
            });
          } else {
            inBatchBadgeSet.add(cleanBadge);
          }
        }
      }
    });

    const fatalRows = new Set(errors.map((e) => e.row));
    const conflictRows = new Set(conflicts.map((c) => c.row));
    const invalidCount = options?.updateExisting
      ? fatalRows.size
      : new Set([...fatalRows, ...conflictRows]).size;
    const validCount = Math.max(0, usersData.length - invalidCount);

    const maxUsers = org.limits?.maxUsers ?? 50;
    const currentUserCount = await User.countDocuments({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: { $ne: true },
    });

    if (currentUserCount + willCreateCount > maxUsers) {
      warnings.push({
        row: 0,
        email: "BATCH_OVERFLOW",
        field: "seats",
        message: `Import batch will exceed organization seat limit (${currentUserCount + willCreateCount}/${maxUsers}). Users beyond available seats will be rejected.`,
      });
    }

    return {
      totalRows: usersData.length,
      validCount,
      invalidCount,
      errorCount: errors.length,
      conflictCount: conflicts.length,
      warningCount: warnings.length,
      willCreateCount,
      willUpdateCount,
      seatCapacity: {
        current: currentUserCount,
        limit: maxUsers,
        available: Math.max(0, maxUsers - currentUserCount),
      },
      errors,
      conflicts,
      warnings,
      newDepartments: Array.from(newDepartmentsSet),
    };
  }

  async bulkImportEmployees(
    orgId: string | mongoose.Types.ObjectId,
    usersData: Array<{
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      fullName?: string | null;
      department?: string | null;
      departmentId?: string | null;
      jobTitle?: string | null;
      role?: string | null;
      employeeId?: string | null;
      managerEmail?: string | null;
      managerEmployeeId?: string | null;
      designation?: string | null;
      payrollCategory?: string | null;
      employmentType?: "full_time" | "part_time" | "contractor" | "intern" | null;
      hireDate?: string | Date | null;
      phone?: string | null;
      location?: string | null;
      timezone?: string | null;
      badgeId?: string | null;
      nationalId?: string | null;
      customAttributes?: Record<string, any> | null;
    }>,
    creatorId: string | mongoose.Types.ObjectId,
    options?: {
      updateExisting?: boolean;
      triggerWorkflows?: boolean;
      autoAssignRoleChecklists?: boolean;
      sendInvites?: boolean;
      defaultJourneyId?: string | null;
    }
  ) {
    const results = {
      successCount: 0,
      updatedCount: 0,
      failures: [] as Array<{ email: string; reason: string }>,
    };

    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const maxUsers = org.limits?.maxUsers ?? org.subscription?.seatLimit ?? 50;
    const currentUserCount = await User.countDocuments({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: { $ne: true },
    });

    const defaultPasswordHash = await hashPassword(DEFAULT_EMPLOYEE_TEMPORARY_PASSWORD);
    const shouldTriggerWorkflows = options?.triggerWorkflows !== false;

    // Verify active email configuration if invitations are requested
    let activeEmailClient: any = null;
    if (options?.sendInvites) {
      activeEmailClient = await this.integrationService.getActiveEmailClient(orgId).catch(() => null);
    }

    // 1. Pre-fetch existing users by email, employeeId, and phone for fast duplicate and upsert checks
    const targetEmails = usersData
      .map((u) => u.email?.toLowerCase().trim())
      .filter(Boolean) as string[];
    const targetEmpIds = usersData
      .map((u) => (u.employeeId ? String(u.employeeId).trim() : ""))
      .filter(Boolean) as string[];
    const targetPhones = usersData
      .map((u) => (u.phone ? String(u.phone).trim() : ""))
      .filter(Boolean) as string[];

    const lookupOr: any[] = [];
    if (targetEmails.length > 0) lookupOr.push({ "auth.email": { $in: targetEmails } });
    if (targetEmpIds.length > 0) lookupOr.push({ "employment.employeeId": { $in: targetEmpIds } });
    if (targetPhones.length > 0) lookupOr.push({ "profile.phone": { $in: targetPhones } });

    const existingUsers = lookupOr.length > 0
      ? await User.find(
        { organizationId: orgId, isDeleted: false, $or: lookupOr }
      )
      : [];

    const existingEmailMap = new Map<string, any>();
    const existingEmpIdMap = new Map<string, any>();
    const existingPhoneMap = new Map<string, any>();
    existingUsers.forEach((u) => {
      if (u.auth?.email) existingEmailMap.set(u.auth.email.toLowerCase(), u);
      if (u.employment?.employeeId) existingEmpIdMap.set(u.employment.employeeId, u);
      if (u.profile?.phone) existingPhoneMap.set(u.profile.phone, u);
    });

    const inFlightEmailSet = new Set<string>();
    const inFlightEmpIdSet = new Set<string>();
    const inFlightPhoneSet = new Set<string>();
    const inFlightBadgeSet = new Set<string>();

    // 2. Pre-index existing departments
    const deptMap = new Map<string, mongoose.Types.ObjectId>();
    org.departments.forEach((d) => {
      deptMap.set(d._id.toString(), d._id);
      deptMap.set(d.name.toLowerCase(), d._id);
    });

    // 3. Pre-fetch managers for reporting hierarchy
    const candidateManagerEmails = usersData
      .map((u) => u.managerEmail?.toLowerCase().trim())
      .filter(Boolean) as string[];
    const candidateManagerEmpIds = usersData
      .map((u) => (u.managerEmployeeId ? String(u.managerEmployeeId).trim() : ""))
      .filter(Boolean) as string[];

    const managerLookupOr: any[] = [];
    if (candidateManagerEmails.length > 0) managerLookupOr.push({ "auth.email": { $in: candidateManagerEmails } });
    if (candidateManagerEmpIds.length > 0) managerLookupOr.push({ "employment.employeeId": { $in: candidateManagerEmpIds } });

    const existingManagers = managerLookupOr.length > 0
      ? await User.find(
        {
          organizationId: orgId,
          isDeleted: false,
          $or: managerLookupOr,
        },
        { "auth.email": 1, "employment.employeeId": 1, _id: 1 }
      )
      : [];

    const managerMap = new Map<string, mongoose.Types.ObjectId>();
    existingManagers.forEach((m) => {
      if (m.auth?.email) {
        managerMap.set(m.auth.email.toLowerCase(), m._id);
      }
      if (m.employment?.employeeId) {
        managerMap.set(m.employment.employeeId, m._id);
      }
    });

    let orgModified = false;
    const documentsToInsert: any[] = [];
    const updatesToExecute: Array<{ filter: any; update: any; userDoc: any }> = [];

    for (const data of usersData) {
      const rawEmail = (data.email || "").trim();
      const email = rawEmail.toLowerCase();
      const rawEmpId = data.employeeId ? String(data.employeeId).trim() : "";
      const rawPhone = data.phone ? String(data.phone).trim() : "";
      const rawBadge = data.badgeId ? String(data.badgeId).trim() : "";
      const rowIdentifier = rawEmail || rawEmpId || rawPhone || "";

      if (!rowIdentifier) {
        results.failures.push({ email: "", reason: "Row must include at least one identifier (email, employee ID, or phone)" });
        continue;
      }

      if (email) {
        if (inFlightEmailSet.has(email)) {
          results.failures.push({ email: rowIdentifier, reason: "Duplicate email in import batch." });
          continue;
        }
        inFlightEmailSet.add(email);
      }

      if (rawEmpId) {
        if (inFlightEmpIdSet.has(rawEmpId)) {
          results.failures.push({ email: rowIdentifier, reason: "Duplicate employee ID in import batch." });
          continue;
        }
        inFlightEmpIdSet.add(rawEmpId);
      }

      if (rawPhone) {
        if (inFlightPhoneSet.has(rawPhone)) {
          results.failures.push({ email: rowIdentifier, reason: "Duplicate phone number in import batch." });
          continue;
        }
        inFlightPhoneSet.add(rawPhone);
      }

      if (rawBadge) {
        if (inFlightBadgeSet.has(rawBadge)) {
          results.failures.push({ email: rowIdentifier, reason: "Duplicate badge ID in import batch." });
          continue;
        }
        inFlightBadgeSet.add(rawBadge);
      }

      // Name resolution
      let firstName = data.firstName?.trim() || "";
      let lastName = data.lastName?.trim() || "";
      const rawFullName = (data as any).name?.trim() || data.fullName?.trim() || "";

      if (!firstName && rawFullName) {
        const parts = rawFullName.split(/\s+/);
        firstName = parts[0] || "Employee";
        lastName = parts.slice(1).join(" ") || "";
      } else if (!rawFullName && (firstName || lastName)) {
        // keep firstName & lastName
      }
      const fullName = rawFullName || `${firstName} ${lastName}`.trim() || "Employee";

      // Department resolution
      const deptCandidate = (data.department || data.departmentId || "").trim();
      let resolvedDeptId: mongoose.Types.ObjectId | undefined = undefined;
      let cleanDeptName: string | undefined = undefined;

      if (deptCandidate) {
        if (mongoose.Types.ObjectId.isValid(deptCandidate) && deptMap.has(deptCandidate)) {
          resolvedDeptId = deptMap.get(deptCandidate);
          const found = org.departments.find((d) => d._id.toString() === deptCandidate);
          cleanDeptName = found?.name || deptCandidate;
        } else if (deptMap.has(deptCandidate.toLowerCase())) {
          resolvedDeptId = deptMap.get(deptCandidate.toLowerCase());
          const found = org.departments.find((d) => d.name.toLowerCase() === deptCandidate.toLowerCase());
          cleanDeptName = found?.name || deptCandidate;
        } else {
          // Create new department on the fly
          const newDeptId = new mongoose.Types.ObjectId();
          org.departments.push({
            _id: newDeptId,
            name: deptCandidate,
            active: true,
          } as any);
          deptMap.set(deptCandidate.toLowerCase(), newDeptId);
          deptMap.set(newDeptId.toString(), newDeptId);
          resolvedDeptId = newDeptId;
          cleanDeptName = deptCandidate;
          orgModified = true;
        }
      }

      // Manager resolution
      let resolvedManagerId: mongoose.Types.ObjectId | undefined = undefined;
      if (data.managerEmail && managerMap.has(data.managerEmail.toLowerCase().trim())) {
        resolvedManagerId = managerMap.get(data.managerEmail.toLowerCase().trim());
      } else if (data.managerEmployeeId && managerMap.has(String(data.managerEmployeeId).trim())) {
        resolvedManagerId = managerMap.get(String(data.managerEmployeeId).trim());
      }

      const designation = data.designation || data.jobTitle || undefined;
      const jobTitle = data.jobTitle || data.designation || undefined;

      // Check if user already exists
      let existingUser: any = null;
      if (email && existingEmailMap.has(email)) {
        existingUser = existingEmailMap.get(email);
      } else if (rawEmpId && existingEmpIdMap.has(rawEmpId)) {
        existingUser = existingEmpIdMap.get(rawEmpId);
      } else if (rawPhone && existingPhoneMap.has(rawPhone)) {
        existingUser = existingPhoneMap.get(rawPhone);
      }

      if (existingUser) {
        if (options?.updateExisting) {
          const updateFields: Record<string, any> = {
            "profile.firstName": firstName || existingUser.profile?.firstName,
            "profile.lastName": lastName || existingUser.profile?.lastName,
            "profile.fullName": fullName || existingUser.profile?.fullName,
          };
          if (rawPhone) updateFields["profile.phone"] = rawPhone;
          if (data.location) updateFields["profile.location"] = data.location;
          if (data.timezone) updateFields["profile.timezone"] = data.timezone;
          if (rawEmpId) updateFields["employment.employeeId"] = rawEmpId;
          if (rawBadge) updateFields["employment.badgeId"] = rawBadge;
          if (data.nationalId) updateFields["employment.nationalId"] = String(data.nationalId).trim();
          if (cleanDeptName) updateFields["employment.department"] = cleanDeptName;
          if (resolvedDeptId) updateFields["employment.departmentId"] = resolvedDeptId;
          if (jobTitle) updateFields["employment.jobTitle"] = jobTitle;
          if (designation) updateFields["employment.designation"] = designation;
          if (data.employmentType) updateFields["employment.employmentType"] = data.employmentType;
          if (resolvedManagerId) updateFields["employment.managerId"] = resolvedManagerId;
          if (data.role) updateFields["permissions.role"] = data.role;

          updatesToExecute.push({
            filter: { _id: existingUser._id },
            update: { $set: updateFields },
            userDoc: existingUser,
          });
          continue;
        } else {
          results.failures.push({ email: rowIdentifier, reason: "A user with this identifier already exists in this organization." });
          continue;
        }
      }

      // Enforce organization seat limit
      if (currentUserCount + documentsToInsert.length >= maxUsers) {
        results.failures.push({
          email: rowIdentifier,
          reason: `Organization seat limit reached (${maxUsers} seats maximum). Upgrade plan to add more members.`,
        });
        continue;
      }

      // Frontline Fallback: Auto-provision EMP-XXXXXX if both email and employeeId are absent
      const employeeId = rawEmpId || (!email ? `EMP-${crypto.randomBytes(3).toString("hex").toUpperCase()}` : undefined);

      // Construct user document to insert
      const newDocId = new mongoose.Types.ObjectId();
      if (employeeId) {
        managerMap.set(employeeId, newDocId);
      }
      if (email) {
        managerMap.set(email, newDocId);
      }

      documentsToInsert.push({
        _id: newDocId,
        organizationId: new mongoose.Types.ObjectId(orgId),
        auth: {
          ...(email ? { email } : {}),
          passwordHash: defaultPasswordHash,
          emailVerified: Boolean(email),
        },
        profile: {
          firstName: firstName || "Employee",
          lastName: lastName || "",
          fullName,
          phone: rawPhone || undefined,
          location: data.location || undefined,
          timezone: data.timezone || undefined,
          customAttributes: data.customAttributes || undefined,
        },
        employment: {
          employeeId: employeeId || undefined,
          badgeId: rawBadge || undefined,
          nationalId: data.nationalId ? String(data.nationalId).trim() : undefined,
          department: cleanDeptName,
          departmentId: resolvedDeptId,
          managerId: resolvedManagerId,
          status: "active" as const,
          employmentType: data.employmentType || ("full_time" as const),
          designation,
          jobTitle,
          payrollCategory: data.payrollCategory || undefined,
          hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
        },
        permissions: {
          role: (data.role || "employee") as any,
          roles: Array.isArray((data as any).roles) && (data as any).roles.length > 0 ? (data as any).roles : [data.role || "employee"],
          customRoles: [],
        },
        security: {
          mfaEnabled: false,
          failedLoginAttempts: 0,
          mustChangePassword: true,
        },
        createdBy: new mongoose.Types.ObjectId(creatorId),
        isDeleted: false,
      });
    }

    // Save updated departments once if new departments were added
    if (orgModified) {
      await Organization.updateOne(
        { _id: org._id },
        { $set: { departments: org.departments } }
      );
    }

    // Execute bulk updates for existing users if any
    for (const item of updatesToExecute) {
      try {
        await User.updateOne(item.filter, item.update);
        results.updatedCount++;
      } catch (err: any) {
        const docIdentifier = item.userDoc.auth?.email || item.userDoc.employment?.employeeId || item.userDoc.profile?.phone || "User";
        results.failures.push({ email: docIdentifier, reason: err.message || "Failed to update existing user" });
      }
    }

    // Batch insert users in chunks of 250 and emit events
    const BATCH_SIZE = 250;
    for (let i = 0; i < documentsToInsert.length; i += BATCH_SIZE) {
      const batch = documentsToInsert.slice(i, i + BATCH_SIZE);
      try {
        const inserted = await User.insertMany(batch, { ordered: false });
        results.successCount += inserted.length;

        for (const userDoc of inserted) {
          if (shouldTriggerWorkflows) {
            onboardingCaseService.createCase({
              organizationId: orgId.toString(),
              employeeId: userDoc._id.toString(),
              source: "bulk_import",
              idempotencyKey: `bulk_import_${userDoc._id}`,
              createdBy: creatorId.toString(),
            }).catch((e) => console.warn("[EmployeeService] Bulk import OnboardingCase create error:", e));

            eventBus.publish({
              eventName: "USER_CREATED",
              organizationId: orgId,
              actorId: userDoc._id,
              entityId: userDoc._id,
              payload: {
                userId: userDoc._id.toString(),
                email: userDoc.auth?.email,
                role: userDoc.permissions.role,
                department: userDoc.employment?.departmentId?.toString() || userDoc.employment?.department,
                jobTitle: userDoc.employment?.designation || userDoc.employment?.jobTitle,
              },
            }).catch((err) => console.error("Event publish error:", err));

            eventBus.publish({
              eventName: "ONBOARDING_CASE_CREATED",
              organizationId: orgId,
              actorId: userDoc._id,
              entityId: userDoc._id,
              payload: {
                employeeId: userDoc._id.toString(),
                source: "bulk_import",
                userId: userDoc._id.toString(),
                email: userDoc.auth?.email,
                role: userDoc.permissions.role,
                department: userDoc.employment?.departmentId?.toString() || userDoc.employment?.department,
              },
            }).catch((err) => console.error("Event publish error:", err));
          }

          if (options?.autoAssignRoleChecklists !== false) {
            try {
              await roleChecklistService.autoAssignRoleChecklistsToNewHire(
                orgId,
                userDoc._id,
                { hireDate: userDoc.employment?.hireDate, creatorId }
              );
            } catch (e) {
              console.warn("[EmployeeService] Role checklist auto-assign error:", e);
            }
          }

          // Only attempt to dispatch email invitation if the user account has a corporate email address
          if (options?.sendInvites && userDoc.auth?.email) {
            try {
              const rawToken = crypto.randomBytes(32).toString("hex");
              const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
              const expires = new Date(Date.now() + 24 * 3600000);
              await User.updateOne(
                { _id: userDoc._id },
                {
                  $set: {
                    "security.passwordResetToken": hashedToken,
                    "security.passwordResetExpires": expires,
                    "employment.status": "invited",
                  },
                }
              );
              const activeEmail = activeEmailClient || (await this.integrationService.getActiveEmailClient(userDoc.organizationId).catch(() => null));
              if (activeEmail) {
                activeEmail.service.sendInvitationEmail(activeEmail.config, activeEmail.secrets, userDoc.auth.email, rawToken, org.name).catch((err: any) => {
                  console.warn(`[EmployeeService] Failed to send invite email to ${userDoc.auth.email}:`, err);
                });
              }
            } catch (invErr) {
              console.warn("[EmployeeService] Bulk sendInvites processing error:", invErr);
            }
          }
        }
      } catch (err: any) {
        if (err.insertedDocs && Array.isArray(err.insertedDocs)) {
          results.successCount += err.insertedDocs.length;
          for (const userDoc of err.insertedDocs) {
            if (shouldTriggerWorkflows) {
              onboardingCaseService.createCase({
                organizationId: orgId.toString(),
                employeeId: userDoc._id.toString(),
                source: "bulk_import",
                idempotencyKey: `bulk_import_${userDoc._id}`,
                createdBy: creatorId.toString(),
              }).catch((e) => console.warn("[EmployeeService] Bulk import OnboardingCase create error:", e));

              eventBus.publish({
                eventName: "USER_CREATED",
                organizationId: orgId,
                actorId: userDoc._id,
                entityId: userDoc._id,
                payload: {
                  userId: userDoc._id.toString(),
                  email: userDoc.auth?.email,
                  role: userDoc.permissions.role,
                  department: userDoc.employment?.departmentId?.toString() || userDoc.employment?.department,
                  jobTitle: userDoc.employment?.designation || userDoc.employment?.jobTitle,
                },
              }).catch((e) => console.error("Event publish error:", e));

              eventBus.publish({
                eventName: "ONBOARDING_CASE_CREATED",
                organizationId: orgId,
                actorId: userDoc._id,
                entityId: userDoc._id,
                payload: {
                  employeeId: userDoc._id.toString(),
                  source: "bulk_import",
                  userId: userDoc._id.toString(),
                  email: userDoc.auth?.email,
                  role: userDoc.permissions.role,
                  department: userDoc.employment?.departmentId?.toString() || userDoc.employment?.department,
                },
              }).catch((e) => console.error("Event publish error:", e));
            }

            if (options?.autoAssignRoleChecklists !== false) {
              roleChecklistService.autoAssignRoleChecklistsToNewHire(
                orgId,
                userDoc._id,
                { hireDate: userDoc.employment?.hireDate, creatorId }
              ).catch((e) => console.warn("[EmployeeService] Role checklist auto-assign error:", e));
            }
          }
        }
        if (err.writeErrors && Array.isArray(err.writeErrors)) {
          for (const we of err.writeErrors) {
            const failedDoc = batch[we.index];
            const docIdentifier = failedDoc?.auth?.email || failedDoc?.employment?.employeeId || failedDoc?.profile?.phone || "Row " + we.index;
            results.failures.push({
              email: docIdentifier,
              reason: we.errmsg || "Insert failed",
            });
          }
        } else {
          for (const item of batch) {
            const docIdentifier = item?.auth?.email || item?.employment?.employeeId || item?.profile?.phone || "Row";
            results.failures.push({ email: docIdentifier, reason: err.message || "Batch insert error" });
          }
        }
      }
    }

    return {
      ...results,
      defaultCredentials: {
        temporaryPassword: DEFAULT_EMPLOYEE_TEMPORARY_PASSWORD,
        mustChangePassword: true,
        loginUrl: "/login",
      },
    };
  }

  async setLegalHold(
    orgId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    legalHold: boolean,
    reason?: string,
    actorUserId?: string | mongoose.Types.ObjectId
  ) {
    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(employeeId.toString()),
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      isDeleted: false,
    });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "Employee not found");
    }

    user.compliance = user.compliance || {};
    user.compliance.legalHold = legalHold;
    user.compliance.legalHoldReason = reason;
    user.compliance.legalHoldPlacedAt = legalHold ? new Date() : undefined;
    user.compliance.legalHoldPlacedBy = legalHold && actorUserId ? new mongoose.Types.ObjectId(actorUserId.toString()) : undefined;

    await user.save();
    return user;
  }
}

export const employeeService = new EmployeeService();
export default EmployeeService;
