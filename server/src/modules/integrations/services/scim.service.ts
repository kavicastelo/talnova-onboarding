import mongoose from "mongoose";
import { User, IUser } from "../../auth/models/user.model.js";
import AppError from "../../../common/errors/app-error.js";

export const SCIM_CORE_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_ENTERPRISE_USER_SCHEMA = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";
export const SCIM_TALNOVA_USER_SCHEMA = "urn:ietf:params:scim:schemas:extension:talnova:2.0:User";

export class ScimService {
  /**
   * Extract Frontline Worker Badge ID from various SCIM payload representations
   */
  extractBadgeId(payload: any): string | undefined {
    if (!payload) return undefined;
    const badgeId =
      payload["urn:ietf:params:scim:schemas:extension:talnova:2.0:User:badgeId"] ||
      payload[SCIM_TALNOVA_USER_SCHEMA]?.badgeId ||
      payload.badgeId ||
      payload.badge;
    return badgeId ? String(badgeId).trim() : undefined;
  }

  /**
   * Extract Employee Number / Employee ID from SCIM payload
   */
  extractEmployeeNumber(payload: any): string | undefined {
    if (!payload) return undefined;
    const empNum =
      payload["urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:employeeNumber"] ||
      payload[SCIM_ENTERPRISE_USER_SCHEMA]?.employeeNumber ||
      payload[SCIM_ENTERPRISE_USER_SCHEMA]?.employeeId ||
      payload.employeeNumber ||
      payload.employeeId ||
      payload.externalId;
    return empNum ? String(empNum).trim() : undefined;
  }

  /**
   * Extract National ID from SCIM payload
   */
  extractNationalId(payload: any): string | undefined {
    if (!payload) return undefined;
    const natId =
      payload["urn:ietf:params:scim:schemas:extension:talnova:2.0:User:nationalId"] ||
      payload[SCIM_TALNOVA_USER_SCHEMA]?.nationalId ||
      payload.nationalId;
    return natId ? String(natId).trim() : undefined;
  }

  /**
   * Extract Primary Email / Username
   */
  extractEmail(payload: any): string {
    if (!payload) return "";
    let email = payload.userName;
    if (payload.emails && Array.isArray(payload.emails) && payload.emails.length > 0) {
      const primary = payload.emails.find((e: any) => e.primary) || payload.emails[0];
      if (primary?.value) {
        email = primary.value;
      }
    }
    if (!email && payload.email) {
      email = payload.email;
    }
    return email ? String(email).trim().toLowerCase() : "";
  }

  /**
   * Extract User Names
   */
  extractName(payload: any): { firstName: string; lastName: string; fullName: string } {
    let firstName = payload?.name?.givenName || payload?.firstName || "";
    let lastName = payload?.name?.familyName || payload?.lastName || "";
    let fullName = payload?.name?.formatted || payload?.displayName || "";

    if (!fullName && (firstName || lastName)) {
      fullName = `${firstName} ${lastName}`.trim();
    } else if (fullName && (!firstName || !lastName)) {
      const parts = fullName.trim().split(/\s+/);
      if (!firstName) firstName = parts[0] || "Employee";
      if (!lastName) lastName = parts.slice(1).join(" ") || "";
    }

    return {
      firstName: firstName || "Employee",
      lastName: lastName || "",
      fullName: fullName || "Employee",
    };
  }

  /**
   * Format MongoDB User document into standard RFC 7643 / RFC 7644 SCIM 2.0 User representation
   */
  toScimUser(user: any, baseUrl = "/api/v1/scim/v2"): any {
    const userId = user._id.toString();
    const isActive =
      user.employment?.status !== "inactive" &&
      user.employment?.status !== "terminated" &&
      !user.isDeleted;

    return {
      schemas: [
        SCIM_CORE_USER_SCHEMA,
        SCIM_ENTERPRISE_USER_SCHEMA,
        SCIM_TALNOVA_USER_SCHEMA,
      ],
      id: userId,
      externalId: user.employment?.employeeId || userId,
      meta: {
        resourceType: "User",
        created: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
        lastModified: user.updatedAt ? new Date(user.updatedAt).toISOString() : new Date().toISOString(),
        location: `${baseUrl}/Users/${userId}`,
      },
      userName: user.auth?.email || "",
      name: {
        givenName: user.profile?.firstName || "",
        familyName: user.profile?.lastName || "",
        formatted: user.profile?.fullName || `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim(),
      },
      displayName: user.profile?.fullName || "",
      active: isActive,
      emails: [
        {
          value: user.auth?.email || "",
          type: "work",
          primary: true,
        },
      ],
      [SCIM_ENTERPRISE_USER_SCHEMA]: {
        employeeNumber: user.employment?.employeeId || undefined,
        department: user.employment?.department || undefined,
      },
      [SCIM_TALNOVA_USER_SCHEMA]: {
        badgeId: user.employment?.badgeId || undefined,
        nationalId: user.employment?.nationalId || undefined,
      },
    };
  }

  /**
   * SCIM 2.0: Create User (POST /Users)
   */
  async createUser(orgId: string, payload: any, baseUrl?: string): Promise<{ user: any; statusCode: number }> {
    const orgObjId = new mongoose.Types.ObjectId(orgId);
    const email = this.extractEmail(payload);

    if (!email) {
      throw new AppError(400, "BAD_REQUEST", "userName or primary email is required for SCIM user creation");
    }

    const badgeId = this.extractBadgeId(payload);
    const employeeNumber = this.extractEmployeeNumber(payload);
    const nationalId = this.extractNationalId(payload);
    const name = this.extractName(payload);
    const department =
      payload[SCIM_ENTERPRISE_USER_SCHEMA]?.department ||
      payload.department ||
      "Operations";
    const jobTitle = payload.title || payload.jobTitle || "Frontline Worker";
    const isActive = payload.active !== false;

    // Check if user already exists in this tenant
    let user = await User.findOne({
      organizationId: orgObjId,
      "auth.email": email,
      isDeleted: false,
    });

    if (user) {
      // Idempotent update on existing user
      if (name.firstName) user.profile.firstName = name.firstName;
      if (name.lastName) user.profile.lastName = name.lastName;
      if (name.fullName) user.profile.fullName = name.fullName;
      if (department) user.employment.department = department;
      if (jobTitle) user.employment.jobTitle = jobTitle;
      if (badgeId) user.employment.badgeId = badgeId;
      if (employeeNumber) user.employment.employeeId = employeeNumber;
      if (nationalId) user.employment.nationalId = nationalId;
      user.employment.status = isActive ? "active" : "inactive";

      await user.save();
      return { user: this.toScimUser(user, baseUrl), statusCode: 200 };
    }

    // Create new frontline employee
    user = await User.create({
      organizationId: orgObjId,
      auth: {
        email,
        passwordHash: "SCIM_PROVISIONED_ACCOUNT",
        emailVerified: true,
        authProvider: "oidc",
      },
      profile: {
        firstName: name.firstName,
        lastName: name.lastName,
        fullName: name.fullName,
      },
      employment: {
        employeeId: employeeNumber,
        badgeId,
        nationalId,
        department,
        jobTitle,
        status: isActive ? "active" : "inactive",
        onboardingState: "active",
        employmentType: "full_time",
      },
      permissions: {
        role: "employee",
        roles: ["employee"],
        customRoles: [],
      },
      security: {
        mfaEnabled: false,
        failedLoginAttempts: 0,
        mustChangePassword: true,
      },
    });

    return { user: this.toScimUser(user, baseUrl), statusCode: 201 };
  }

  /**
   * SCIM 2.0: Get User by ID (GET /Users/:id)
   */
  async getUser(orgId: string, id: string, baseUrl?: string): Promise<any> {
    const orgObjId = new mongoose.Types.ObjectId(orgId);
    let user: IUser | null = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      user = await User.findOne({
        _id: new mongoose.Types.ObjectId(id),
        organizationId: orgObjId,
        isDeleted: false,
      });
    }

    if (!user) {
      user = await User.findOne({
        organizationId: orgObjId,
        isDeleted: false,
        $or: [
          { "auth.email": id.toLowerCase() },
          { "employment.employeeId": id },
          { "employment.badgeId": id },
        ],
      });
    }

    if (!user) {
      throw new AppError(404, "NOT_FOUND", `SCIM resource with ID ${id} not found.`);
    }

    return this.toScimUser(user, baseUrl);
  }

  /**
   * SCIM 2.0: List Users (GET /Users)
   */
  async listUsers(
    orgId: string,
    params: { filter?: string; startIndex?: number; count?: number } = {},
    baseUrl?: string
  ): Promise<any> {
    const orgObjId = new mongoose.Types.ObjectId(orgId);
    const query: Record<string, any> = { organizationId: orgObjId, isDeleted: false };

    // Basic SCIM filter parsing
    if (params.filter) {
      const filter = params.filter;
      // Match userName eq "..."
      const userNameMatch = filter.match(/userName\s+eq\s+["']?([^"']+)["']?/i);
      if (userNameMatch) {
        query["auth.email"] = userNameMatch[1].toLowerCase().trim();
      }
      // Match badgeId eq "..."
      const badgeMatch = filter.match(/badgeId\s+eq\s+["']?([^"']+)["']?/i);
      if (badgeMatch) {
        query["employment.badgeId"] = badgeMatch[1].trim();
      }
      // Match employeeNumber eq "..."
      const empMatch = filter.match(/employeeNumber\s+eq\s+["']?([^"']+)["']?/i);
      if (empMatch) {
        query["employment.employeeId"] = empMatch[1].trim();
      }
    }

    const startIndex = Math.max(Number(params.startIndex) || 1, 1);
    const count = Math.min(Math.max(Number(params.count) || 100, 1), 500);
    const skip = startIndex - 1;

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query).skip(skip).limit(count).sort({ createdAt: -1 }),
    ]);

    return {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: total,
      startIndex,
      itemsPerPage: users.length,
      Resources: users.map((u) => this.toScimUser(u, baseUrl)),
    };
  }

  /**
   * SCIM 2.0: Replace User (PUT /Users/:id)
   */
  async updateUser(orgId: string, id: string, payload: any, baseUrl?: string): Promise<any> {
    const orgObjId = new mongoose.Types.ObjectId(orgId);
    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: orgObjId,
      isDeleted: false,
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", `SCIM user ${id} not found.`);
    }

    const email = this.extractEmail(payload);
    const badgeId = this.extractBadgeId(payload);
    const employeeNumber = this.extractEmployeeNumber(payload);
    const nationalId = this.extractNationalId(payload);
    const name = this.extractName(payload);
    const department =
      payload[SCIM_ENTERPRISE_USER_SCHEMA]?.department || payload.department;
    const jobTitle = payload.title || payload.jobTitle;

    if (email) user.auth.email = email;
    if (name.firstName) user.profile.firstName = name.firstName;
    if (name.lastName) user.profile.lastName = name.lastName;
    if (name.fullName) user.profile.fullName = name.fullName;
    if (department) user.employment.department = department;
    if (jobTitle) user.employment.jobTitle = jobTitle;
    if (badgeId !== undefined) user.employment.badgeId = badgeId;
    if (employeeNumber !== undefined) user.employment.employeeId = employeeNumber;
    if (nationalId !== undefined) user.employment.nationalId = nationalId;

    if (payload.active !== undefined) {
      user.employment.status = payload.active ? "active" : "inactive";
    }

    await user.save();
    return this.toScimUser(user, baseUrl);
  }

  /**
   * SCIM 2.0: Patch User (PATCH /Users/:id)
   */
  async patchUser(orgId: string, id: string, patchBody: any, baseUrl?: string): Promise<any> {
    const orgObjId = new mongoose.Types.ObjectId(orgId);
    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: orgObjId,
      isDeleted: false,
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", `SCIM user ${id} not found.`);
    }

    const operations = Array.isArray(patchBody.Operations)
      ? patchBody.Operations
      : Array.isArray(patchBody.operations)
      ? patchBody.operations
      : [];

    for (const op of operations) {
      const path = (op.path || "").toLowerCase();
      const value = op.value;

      if (path === "active") {
        user.employment.status = value ? "active" : "inactive";
      } else if (
        path.includes("badgeid") ||
        (typeof value === "object" && value?.badgeId)
      ) {
        const val = typeof value === "object" ? value.badgeId : value;
        user.employment.badgeId = val ? String(val).trim() : undefined;
      } else if (
        path.includes("employeenumber") ||
        path.includes("employeeid") ||
        (typeof value === "object" && (value?.employeeNumber || value?.employeeId))
      ) {
        const val = typeof value === "object" ? value.employeeNumber || value.employeeId : value;
        user.employment.employeeId = val ? String(val).trim() : undefined;
      } else if (
        path.includes("nationalid") ||
        (typeof value === "object" && value?.nationalId)
      ) {
        const val = typeof value === "object" ? value.nationalId : value;
        user.employment.nationalId = val ? String(val).trim() : undefined;
      } else if (path.includes("department")) {
        const val = typeof value === "object" ? value.department : value;
        user.employment.department = val ? String(val).trim() : undefined;
      } else if (typeof value === "object") {
        if (value.active !== undefined) user.employment.status = value.active ? "active" : "inactive";
        if (value.badgeId !== undefined) user.employment.badgeId = String(value.badgeId).trim();
        if (value.employeeNumber !== undefined) user.employment.employeeId = String(value.employeeNumber).trim();
        if (value.employeeId !== undefined) user.employment.employeeId = String(value.employeeId).trim();
        if (value.department !== undefined) user.employment.department = String(value.department).trim();
      }
    }

    await user.save();
    return this.toScimUser(user, baseUrl);
  }

  /**
   * SCIM 2.0: Delete / Deactivate User (DELETE /Users/:id)
   */
  async deleteUser(orgId: string, id: string): Promise<void> {
    const orgObjId = new mongoose.Types.ObjectId(orgId);
    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: orgObjId,
      isDeleted: false,
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", `SCIM user ${id} not found.`);
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.employment.status = "terminated";
    await user.save();
  }
}

export const scimService = new ScimService();
export default scimService;
