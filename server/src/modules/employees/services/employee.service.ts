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

export class EmployeeService {
  private integrationService = new OrganizationIntegrationService();
  constructor(private readonly employeeRepository: EmployeeRepository) { }

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
      email: string;
      firstName: string;
      lastName: string;
      role: "owner" | "admin" | "manager" | "employee";
      departmentId?: string;
      teamId?: string;
      jobTitleId?: string;
      designation?: string;
      payrollCategory?: string;
      managerId?: string;
      employmentType: "full_time" | "part_time" | "contractor" | "intern";
      hireDate?: string | Date;
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
        department: (invitationData as any).department || (!mongoose.Types.ObjectId.isValid(invitationData.departmentId || "") ? invitationData.departmentId : undefined),
        departmentId: invitationData.departmentId && mongoose.Types.ObjectId.isValid(invitationData.departmentId) ? new mongoose.Types.ObjectId(invitationData.departmentId) : undefined,
        teamId: invitationData.teamId && mongoose.Types.ObjectId.isValid(invitationData.teamId) ? new mongoose.Types.ObjectId(invitationData.teamId) : undefined,
        jobTitleId: invitationData.jobTitleId && mongoose.Types.ObjectId.isValid(invitationData.jobTitleId) ? new mongoose.Types.ObjectId(invitationData.jobTitleId) : undefined,
        designation: invitationData.designation,
        payrollCategory: invitationData.payrollCategory,
        managerId: invitationData.managerId && mongoose.Types.ObjectId.isValid(invitationData.managerId) ? new mongoose.Types.ObjectId(invitationData.managerId) : undefined,
        employmentType: invitationData.employmentType,
        hireDate: invitationData.hireDate ? new Date(invitationData.hireDate) : new Date(),
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

    // Instantiate OnboardingCase and OutboxEvent for transactional state tracking
    let onboardingCase: any = null;
    try {
      const caseResult = await onboardingCaseService.createCase({
        organizationId: orgId.toString(),
        employeeId: createdUser._id.toString(),
        source: "invite",
        idempotencyKey: `user_invite_${createdUser._id}`,
        createdBy: invitedBy.toString(),
      });
      onboardingCase = caseResult.case;
    } catch (caseErr: any) {
      console.warn("[EmployeeService] OnboardingCase creation handled:", caseErr?.message);
    }

    // Fetch organization info to personalize the email
    const org = await Organization.findById(orgId);
    const orgName = org?.name || "Talnova Workspace";

    // Send invitation email using organization email service
    const activeEmail = await this.integrationService.getActiveEmailClient(orgId);
    await activeEmail.service.sendInvitationEmail(activeEmail.config, activeEmail.secrets, email, rawToken, orgName);

    // Publish USER_CREATED event to trigger workflows, auto-enrollment, documents, milestones, buddy, calendar
    await eventBus.publish({
      eventName: "USER_CREATED",
      organizationId: orgId,
      actorId: createdUser._id,
      entityId: createdUser._id,
      payload: {
        userId: createdUser._id.toString(),
        caseId: onboardingCase?._id?.toString(),
        email: createdUser.auth.email,
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
          source: "invite",
          userId: createdUser._id.toString(),
          email: createdUser.auth.email,
          role: createdUser.permissions.role,
          department: invitationData.departmentId || createdUser.employment?.department,
        },
      });
    }

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
    if (updateData.designation !== undefined) updateObj["employment.designation"] = updateData.designation;
    if (updateData.payrollCategory !== undefined) updateObj["employment.payrollCategory"] = updateData.payrollCategory;
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
      email: string;
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

    // 2. Pre-fetch existing emails in organization for O(1) duplicate checks
    const targetEmails = usersData
      .map((u) => u.email?.toLowerCase().trim())
      .filter(Boolean);

    const existingUsers = await User.find(
      { "auth.email": { $in: targetEmails }, organizationId: orgId, isDeleted: false },
      { "auth.email": 1, "profile.fullName": 1, "profile.firstName": 1, "profile.lastName": 1, "permissions.role": 1, "employment.department": 1 }
    );
    const existingUserMap = new Map<string, any>();
    existingUsers.forEach((u) => existingUserMap.set(u.auth.email.toLowerCase(), u));

    // 3. Pre-fetch candidate managers
    const candidateManagerEmails = usersData
      .map((u) => u.managerEmail?.toLowerCase().trim())
      .filter(Boolean) as string[];
    const candidateManagerEmpIds = usersData
      .map((u) => u.managerEmployeeId?.trim())
      .filter(Boolean) as string[];

    const existingManagers = await User.find(
      {
        organizationId: orgId,
        isDeleted: false,
        $or: [
          { "auth.email": { $in: candidateManagerEmails } },
          { "employment.employeeId": { $in: candidateManagerEmpIds } },
        ],
      },
      { "auth.email": 1, "employment.employeeId": 1, "profile.fullName": 1 }
    );
    const existingManagerEmails = new Set(existingManagers.map((m) => m.auth.email.toLowerCase()));
    const existingManagerEmpIds = new Set(existingManagers.map((m) => m.employment?.employeeId).filter(Boolean));

    const inBatchEmailSet = new Set<string>();
    let willUpdateCount = 0;
    let willCreateCount = 0;

    usersData.forEach((row, index) => {
      const rowNum = index + 1;
      const rawEmail = row.email?.trim() || "";
      const email = rawEmail.toLowerCase();

      // Email validation
      if (!email) {
        errors.push({ row: rowNum, email: "", field: "email", reason: "Email address is required" });
        return;
      }

      if (!emailRegex.test(email)) {
        errors.push({ row: rowNum, email: rawEmail, field: "email", reason: "Invalid email address format" });
        return;
      }

      // In-batch duplicate check
      if (inBatchEmailSet.has(email)) {
        errors.push({ row: rowNum, email: rawEmail, field: "email", reason: "Duplicate email in the same import file" });
        return;
      }
      inBatchEmailSet.add(email);

      // Name validation
      const hasName = Boolean(row.name?.trim() || row.fullName?.trim() || row.firstName?.trim());
      if (!hasName) {
        errors.push({ row: rowNum, email: rawEmail, field: "fullName", reason: "Employee full name or first name is required" });
      }

      // Existing user conflict check
      if (existingUserMap.has(email)) {
        const existing = existingUserMap.get(email);
        if (options?.updateExisting) {
          willUpdateCount++;
        } else {
          conflicts.push({
            row: rowNum,
            email: rawEmail,
            reason: "User already exists in this organization",
            existingUser: {
              name: existing?.profile?.fullName || `${existing?.profile?.firstName || ""} ${existing?.profile?.lastName || ""}`.trim() || "User",
              role: existing?.permissions?.role || "employee",
              department: existing?.employment?.department || "General",
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
            email: rawEmail,
            field: "managerEmail",
            message: `Designated manager email "${row.managerEmail}" is not yet registered in organization`,
          });
        }
      } else if (row.managerEmployeeId) {
        const mEmpId = row.managerEmployeeId.trim();
        const isManagerKnown = existingManagerEmpIds.has(mEmpId);
        if (!isManagerKnown) {
          warnings.push({
            row: rowNum,
            email: rawEmail,
            field: "managerEmployeeId",
            message: `Designated manager employee ID "${row.managerEmployeeId}" not found in organization`,
          });
        }
      }
    });

    const fatalRows = new Set(errors.map((e) => e.row));
    const conflictRows = new Set(conflicts.map((c) => c.row));
    const invalidCount = options?.updateExisting
      ? fatalRows.size
      : new Set([...fatalRows, ...conflictRows]).size;
    const validCount = Math.max(0, usersData.length - invalidCount);

    return {
      totalRows: usersData.length,
      validCount,
      invalidCount,
      errorCount: errors.length,
      conflictCount: conflicts.length,
      warningCount: warnings.length,
      willCreateCount,
      willUpdateCount,
      errors,
      conflicts,
      warnings,
      newDepartments: Array.from(newDepartmentsSet),
    };
  }

  async bulkImportEmployees(
    orgId: string | mongoose.Types.ObjectId,
    usersData: Array<{
      email: string;
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

    const defaultPasswordHash = await hashPassword("Welcome@2026!");
    const shouldTriggerWorkflows = options?.triggerWorkflows !== false;

    // 1. Pre-fetch existing emails for fast duplicate and upsert checks
    const targetEmails = usersData
      .map((u) => u.email?.toLowerCase().trim())
      .filter(Boolean);
    const existingUsers = await User.find(
      { "auth.email": { $in: targetEmails }, organizationId: orgId, isDeleted: false }
    );
    const existingUserMap = new Map<string, any>();
    existingUsers.forEach((u) => existingUserMap.set(u.auth.email.toLowerCase(), u));
    const inFlightEmailSet = new Set<string>();

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
      .map((u) => u.managerEmployeeId?.trim())
      .filter(Boolean) as string[];

    const existingManagers = await User.find(
      {
        organizationId: orgId,
        isDeleted: false,
        $or: [
          { "auth.email": { $in: candidateManagerEmails } },
          { "employment.employeeId": { $in: candidateManagerEmpIds } },
        ],
      },
      { "auth.email": 1, "employment.employeeId": 1, _id: 1 }
    );
    const managerMap = new Map<string, mongoose.Types.ObjectId>();
    existingManagers.forEach((m) => {
      managerMap.set(m.auth.email.toLowerCase(), m._id);
      if (m.employment?.employeeId) {
        managerMap.set(m.employment.employeeId, m._id);
      }
    });

    let orgModified = false;
    const documentsToInsert: any[] = [];
    const updatesToExecute: Array<{ filter: any; update: any; userDoc: any }> = [];

    for (const data of usersData) {
      const email = data.email?.toLowerCase().trim() || "";
      if (!email) {
        results.failures.push({ email: "", reason: "Email is required" });
        continue;
      }

      if (inFlightEmailSet.has(email)) {
        results.failures.push({ email, reason: "Duplicate email in import batch." });
        continue;
      }
      inFlightEmailSet.add(email);

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
      } else if (data.managerEmployeeId && managerMap.has(data.managerEmployeeId.trim())) {
        resolvedManagerId = managerMap.get(data.managerEmployeeId.trim());
      }

      const designation = data.designation || data.jobTitle || undefined;
      const jobTitle = data.jobTitle || data.designation || undefined;

      // Check if user already exists
      if (existingUserMap.has(email)) {
        if (options?.updateExisting) {
          const existingUser = existingUserMap.get(email);
          const updateFields: Record<string, any> = {
            "profile.firstName": firstName || existingUser.profile?.firstName,
            "profile.lastName": lastName || existingUser.profile?.lastName,
            "profile.fullName": fullName || existingUser.profile?.fullName,
          };
          if (data.phone) updateFields["profile.phone"] = data.phone;
          if (data.location) updateFields["profile.location"] = data.location;
          if (data.timezone) updateFields["profile.timezone"] = data.timezone;
          if (data.employeeId) updateFields["employment.employeeId"] = data.employeeId;
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
          results.failures.push({ email, reason: "A user with this email address already exists." });
          continue;
        }
      }

      // Construct user document to insert
      const newDocId = new mongoose.Types.ObjectId();
      if (data.employeeId) {
        managerMap.set(data.employeeId, newDocId);
      }
      managerMap.set(email, newDocId);

      documentsToInsert.push({
        _id: newDocId,
        organizationId: new mongoose.Types.ObjectId(orgId),
        auth: {
          email,
          passwordHash: defaultPasswordHash,
          emailVerified: true,
        },
        profile: {
          firstName: firstName || "Employee",
          lastName: lastName || "",
          fullName,
          phone: data.phone || undefined,
          location: data.location || undefined,
          timezone: data.timezone || undefined,
          customAttributes: data.customAttributes || undefined,
        },
        employment: {
          employeeId: data.employeeId || undefined,
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
          customRoles: [],
        },
        security: {
          mfaEnabled: false,
          failedLoginAttempts: 0,
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
        results.failures.push({ email: item.userDoc.auth.email, reason: err.message || "Failed to update existing user" });
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
                email: userDoc.auth.email,
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
                email: userDoc.auth.email,
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

          if (options?.sendInvites) {
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
              const activeEmail = await this.integrationService.getActiveEmailClient(userDoc.organizationId);
              activeEmail.service.sendInvitationEmail(activeEmail.config, activeEmail.secrets, userDoc.auth.email, rawToken, org.name).catch((err) => {
                console.warn(`[EmployeeService] Failed to send invite email to ${userDoc.auth.email}:`, err);
              });
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
                  email: userDoc.auth.email,
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
                  email: userDoc.auth.email,
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
            results.failures.push({
              email: failedDoc?.auth?.email || "",
              reason: we.errmsg || "Insert failed",
            });
          }
        } else {
          for (const item of batch) {
            results.failures.push({ email: item.auth.email, reason: err.message || "Batch insert error" });
          }
        }
      }
    }

    return results;
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

export default EmployeeService;
