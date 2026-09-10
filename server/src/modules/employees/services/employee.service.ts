import EmployeeRepository, { EmployeeFilter, PaginationOptions } from "../repositories/employee.repository.js";
import AppError from "../../../common/errors/app-error.js";
import { hashPassword, verifyPassword } from "../../../utils/crypto.js";
import mongoose from "mongoose";
import { User } from "../../auth/models/user.model.js";
import crypto from "crypto";
import { EmailService } from "../../../shared/email/email.service.js";
import { Organization } from "../../organizations/models/organization.model.js";
import eventBus from "../../../infrastructure/events/event-bus.js";

export class EmployeeService {
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

    // Fetch organization info to personalize the email
    const org = await Organization.findById(orgId);
    const orgName = org?.name || "Talnova Workspace";

    // Send invitation email using EmailService
    const emailService = new EmailService();
    await emailService.sendInvitationEmail(email, rawToken, orgName);

    // Publish USER_CREATED event to trigger workflows, auto-enrollment, documents, milestones, buddy, calendar
    await eventBus.publish({
      eventName: "USER_CREATED",
      organizationId: orgId,
      actorId: createdUser._id,
      entityId: createdUser._id,
      payload: {
        userId: createdUser._id.toString(),
        email: createdUser.auth.email,
        role: createdUser.permissions.role,
        department: invitationData.departmentId || createdUser.employment?.department,
        firstName: createdUser.profile.firstName,
        lastName: createdUser.profile.lastName,
        invitedBy: invitedBy.toString(),
      },
    });

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
    if (updateData.designation !== undefined) updateObj["employment.designation"] = updateData.designation;
    if (updateData.payrollCategory !== undefined) updateObj["employment.payrollCategory"] = updateData.payrollCategory;
    if (updateData.hireDate !== undefined) {
      updateObj["employment.hireDate"] = updateData.hireDate ? new Date(updateData.hireDate) : null;
    }

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

  async bulkImportEmployees(
    orgId: string | mongoose.Types.ObjectId,
    usersData: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
      department?: string;
      departmentId?: string;
      jobTitle?: string;
      role?: string;
      employeeId?: string;
      designation?: string;
      payrollCategory?: string;
      employmentType?: "full_time" | "part_time" | "contractor" | "intern";
      hireDate?: string | Date;
      phone?: string;
      location?: string;
      timezone?: string;
    }>,
    creatorId: string | mongoose.Types.ObjectId
  ) {
    const results = {
      successCount: 0,
      failures: [] as Array<{ email: string; reason: string }>,
    };

    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const defaultPasswordHash = await hashPassword("Welcome@2026!");

    // 1. Pre-fetch existing emails for fast O(1) duplicate checks
    const targetEmails = usersData
      .map((u) => u.email?.toLowerCase().trim())
      .filter(Boolean);
    const existingUsers = await User.find(
      { "auth.email": { $in: targetEmails }, isDeleted: false },
      { "auth.email": 1 }
    );
    const existingEmailSet = new Set(existingUsers.map((u) => u.auth.email.toLowerCase()));
    const inFlightEmailSet = new Set<string>();

    // 2. Pre-index existing departments by ID and lower-case Name
    const deptMap = new Map<string, mongoose.Types.ObjectId>();
    org.departments.forEach((d) => {
      deptMap.set(d._id.toString(), d._id);
      deptMap.set(d.name.toLowerCase(), d._id);
    });

    let orgModified = false;
    const documentsToInsert: any[] = [];

    for (const data of usersData) {
      const email = data.email?.toLowerCase().trim() || "";
      if (!email) {
        results.failures.push({ email: "", reason: "Email is required" });
        continue;
      }

      if (existingEmailSet.has(email) || inFlightEmailSet.has(email)) {
        results.failures.push({ email, reason: "A user with this email address already exists." });
        continue;
      }
      inFlightEmailSet.add(email);

      // Name resolution
      let firstName = data.firstName?.trim() || "";
      let lastName = data.lastName?.trim() || "";
      const rawFullName = data.fullName?.trim() || "";

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

      const designation = data.designation || data.jobTitle || undefined;
      const jobTitle = data.jobTitle || data.designation || undefined;

      documentsToInsert.push({
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
        },
        employment: {
          employeeId: data.employeeId || undefined,
          department: cleanDeptName,
          departmentId: resolvedDeptId,
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

    // 3. Batch insert users in chunks of 250 and emit events
    const BATCH_SIZE = 250;
    for (let i = 0; i < documentsToInsert.length; i += BATCH_SIZE) {
      const batch = documentsToInsert.slice(i, i + BATCH_SIZE);
      try {
        const inserted = await User.insertMany(batch, { ordered: false });
        results.successCount += inserted.length;
        for (const userDoc of inserted) {
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
        }
      } catch (err: any) {
        if (err.insertedDocs && Array.isArray(err.insertedDocs)) {
          results.successCount += err.insertedDocs.length;
          for (const userDoc of err.insertedDocs) {
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
}

export default EmployeeService;
