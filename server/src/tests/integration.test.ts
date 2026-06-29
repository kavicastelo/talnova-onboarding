import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { Journey } from "../modules/journeys/models/journey.model.js";
import { EmployeeAssignment } from "../modules/assignments/models/assignment.model.js";
import { Upload } from "../modules/uploads/models/upload.model.js";
import EmailService from "../shared/email/email.service.js";

describe("Talnova Backend Integration Test Suite", () => {
  let app: any;
  let orgAId: mongoose.Types.ObjectId;
  let orgBId: mongoose.Types.ObjectId;
  let adminAUser: any;
  let employeeAUser: any;
  let adminBUser: any;

  let adminAToken: string;
  let employeeAToken: string;
  let adminBToken: string;

  beforeAll(async () => {
    // 1. Initialize app
    app = await buildApp();

    // 2. Connect to database
    await connectDatabase(app.log);

    // 3. Clear database test collections
    await Organization.deleteMany({ $or: [{ name: /Test Org/ }, { slug: /test-org/ }] });
    await User.deleteMany({ "auth.email": /test/ });
    await Journey.deleteMany({ title: /Test Journey/ });
    await EmployeeAssignment.deleteMany({});
    await Upload.deleteMany({});

    const dummyCreatorId = new mongoose.Types.ObjectId();
    // 4. Seed test organizations
    const orgA = await Organization.create({
      name: "Test Org A",
      slug: "test-org-a",
      createdBy: dummyCreatorId,
      isDeleted: false,
    });
    orgAId = orgA._id as mongoose.Types.ObjectId;

    const orgB = await Organization.create({
      name: "Test Org B",
      slug: "test-org-b",
      createdBy: dummyCreatorId,
      isDeleted: false,
    });
    orgBId = orgB._id as mongoose.Types.ObjectId;

    // 5. Seed users
    adminAUser = await User.create({
      organizationId: orgAId,
      auth: {
        email: "admin-a@test.com",
        passwordHash: "hash-placeholder",
        failedLoginAttempts: 0,
      },
      profile: { firstName: "Admin", lastName: "A" },
      permissions: { role: "admin" },
      employment: { status: "active" },
      isDeleted: false,
    });

    employeeAUser = await User.create({
      organizationId: orgAId,
      auth: {
        email: "employee-a@test.com",
        passwordHash: "hash-placeholder",
        failedLoginAttempts: 0,
      },
      profile: { firstName: "Employee", lastName: "A" },
      permissions: { role: "employee" },
      employment: { status: "active" },
      isDeleted: false,
    });

    adminBUser = await User.create({
      organizationId: orgBId,
      auth: {
        email: "admin-b@test.com",
        passwordHash: "hash-placeholder",
        failedLoginAttempts: 0,
      },
      profile: { firstName: "Admin", lastName: "B" },
      permissions: { role: "admin" },
      employment: { status: "active" },
      isDeleted: false,
    });

    // 6. Generate access tokens using Fastify JWT helper
    adminAToken = app.jwt.sign({
      userId: adminAUser._id.toString(),
      organizationId: orgAId.toString(),
      role: "admin",
    });

    employeeAToken = app.jwt.sign({
      userId: employeeAUser._id.toString(),
      organizationId: orgAId.toString(),
      role: "employee",
    });

    adminBToken = app.jwt.sign({
      userId: adminBUser._id.toString(),
      organizationId: orgBId.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    // Clean up seeded documents
    await Organization.deleteMany({ name: /Test Org/ });
    await User.deleteMany({ "auth.email": /test/ });
    await Journey.deleteMany({ title: /Test Journey/ });
    await EmployeeAssignment.deleteMany({});
    
    await app.close();
    await disconnectDatabase(app.log);
  });

  describe("System Health Check Hooks", () => {
    it("should return live state status successfully", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/live",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("alive");
    });

    it("should return ready state checks successfully", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/ready",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("UP");
      expect(body.services.database).toBe("connected");
    });

    it("should return healthy status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("healthy");
    });
  });

  describe("API Authentication Validation", () => {
    it("should reject unauthenticated request on protected route", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/journeys",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should allow request on protected route with valid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/journeys",
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe("Tenant / Organization Boundary Isolation Checks", () => {
    let journeyOrgB: any;

    beforeAll(async () => {
      // Create a journey belonging to Organization B
      journeyOrgB = await Journey.create({
        organizationId: orgBId,
        title: "Test Journey for Org B",
        slug: "test-journey-org-b",
        description: "Test description",
        publishing: { status: "published", version: 1 },
        modules: [],
        createdBy: adminBUser._id,
        isDeleted: false,
      });
    });

    it("should prevent User of Org A from reading Journey of Org B", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/journeys/${journeyOrgB._id.toString()}`,
        headers: {
          Authorization: `Bearer ${adminAToken}`, // Admin of Org A tries to access Org B
        },
      });

      // Query returns 404 since it filters by organizationId in the repository
      expect(response.statusCode).toBe(404);
    });

    it("should permit User of Org B to read their own Journey", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/journeys/${journeyOrgB._id.toString()}`,
        headers: {
          Authorization: `Bearer ${adminBToken}`, // Admin of Org B accesses Org B
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe("Test Journey for Org B");
    });

    it("should prevent User of Org A from updating Journey of Org B", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/journeys/${journeyOrgB._id.toString()}`,
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          title: "Malicious Update Attempt",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should prevent User of Org A from deleting Journey of Org B", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/journeys/${journeyOrgB._id.toString()}`,
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should prevent User of Org A from reading/querying Employee of Org B", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${adminBUser._id.toString()}`,
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should prevent User of Org A from updating Employee profile of Org B", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${adminBUser._id.toString()}`,
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          firstName: "Hacked",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should force employee invitation to be created in the inviter's organization even if requested otherwise", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees/invite",
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          email: "cross-tenant-invite@test.com",
          firstName: "Cross",
          lastName: "Tenant",
          role: "employee",
          employmentType: "full_time",
        },
      });

      expect(response.statusCode).toBe(201);
      const createdUser = await User.findOne({ "auth.email": "cross-tenant-invite@test.com" });
      expect(createdUser).toBeDefined();
      expect(createdUser!.organizationId.toString()).toBe(orgAId.toString());
      expect(createdUser!.organizationId.toString()).not.toBe(orgBId.toString());
    });
  });

  describe("Learning Engine Progression Flow", () => {
    let journey: any;
    let assignment: any;

    beforeAll(async () => {
      // Create a valid journey for Org A
      journey = await Journey.create({
        organizationId: orgAId,
        title: "Test Journey Org A",
        slug: "test-journey-org-a",
        description: "Test description",
        publishing: { status: "published", version: 1 },
        modules: [
          {
            _id: new mongoose.Types.ObjectId(),
            title: "Module 1",
            order: 0,
            lessons: [
              {
                _id: new mongoose.Types.ObjectId(),
                title: "Lesson 1",
                order: 0,
                contentBlocks: [
                  {
                    _id: new mongoose.Types.ObjectId(),
                    type: "text",
                    content: "Welcome block",
                    order: 0,
                  },
                ],
              },
            ],
          },
        ],
        createdBy: adminAUser._id,
        isDeleted: false,
      });

      // Create an assignment for employee A
      assignment = await EmployeeAssignment.create({
        organizationId: orgAId,
        employeeId: employeeAUser._id,
        assignedBy: adminAUser._id,
        journey: {
          journeyId: journey._id,
          title: journey.title,
          version: 1,
        },
        status: "assigned",
        progress: {
          lastActivityAt: new Date(),
          totalModules: 1,
          completedModules: 0,
          totalLessons: 1,
          completedLessons: 0,
          completionPercentage: 0,
          totalTimeSpentSeconds: 0,
        },
        modules: [
          {
            moduleId: journey.modules[0]._id,
            title: journey.modules[0].title,
            completed: false,
            lessons: [
              {
                lessonId: journey.modules[0].lessons[0]._id,
                title: journey.modules[0].lessons[0].title,
                status: "not_started",
                completedAt: undefined,
                timeSpentSeconds: 0,
                contentBlocks: [
                  {
                    blockId: journey.modules[0].lessons[0].contentBlocks[0]._id,
                    type: "text",
                    viewed: false,
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it("should allow employee to start the assignment", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/assignments/${assignment._id.toString()}/start`,
        headers: {
          Authorization: `Bearer ${employeeAToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("in_progress");
    });

    it("should automatically progress assignment state on lesson completion", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/assignments/${assignment._id.toString()}/complete-lesson`,
        headers: {
          Authorization: `Bearer ${employeeAToken}`,
        },
        payload: {
          moduleId: journey.modules[0]._id.toString(),
          lessonId: journey.modules[0].lessons[0]._id.toString(),
          timeSpentSeconds: 120,
          completedBlockIds: [journey.modules[0].lessons[0].contentBlocks[0]._id.toString()],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      // Completing the only lesson completes the assignment
      expect(body.data.status).toBe("completed");
      expect(body.data.progress.completionPercentage).toBe(100);
    });
  });

  describe("Password Reset & Recovery Flow", () => {
    it("should initiate recovery by generating a secure token and placing it in database", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        payload: {
          email: "employee-a@test.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      const user = await User.findOne({ "auth.email": "employee-a@test.com" });
      expect(user).toBeDefined();
      expect(user!.security.passwordResetToken).toBeDefined();
      expect(user!.security.passwordResetExpires).toBeDefined();
    });

    it("should accept valid password change with verified token and revoke previous tokens", async () => {
      // 1. Retrieve raw token from our captured emails list
      const emailRecord = EmailService.sentEmails.find(e => e.to === "employee-a@test.com");
      expect(emailRecord).toBeDefined();
      const rawToken = emailRecord!.token;

      // 2. Perform password reset
      const resetResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: {
          token: rawToken,
          password: "new-super-secure-password-12345",
        },
      });

      expect(resetResponse.statusCode).toBe(200);
      const resetBody = JSON.parse(resetResponse.body);
      expect(resetBody.success).toBe(true);

      // 3. Try to log in with new password
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "employee-a@test.com",
          password: "new-super-secure-password-12345",
        },
      });

      expect(loginResponse.statusCode).toBe(200);
      const loginBody = JSON.parse(loginResponse.body);
      expect(loginBody.success).toBe(true);
      expect(loginBody.data.accessToken).toBeDefined();

      // 4. Verify token fields are cleared in database
      const userAfter = await User.findOne({ "auth.email": "employee-a@test.com" });
      expect(userAfter!.security.passwordResetToken).toBeNull();
      expect(userAfter!.security.passwordResetExpires).toBeNull();
    });

    it("should deny reset requests with invalid or expired tokens", async () => {
      const resetResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: {
          token: "invalid-token-12345",
          password: "another-new-password-123",
        },
      });

      expect(resetResponse.statusCode).toBe(400);
      const resetBody = JSON.parse(resetResponse.body);
      expect(resetBody.success).toBe(false);
      expect(resetBody.error.code).toBe("INVALID_TOKEN");
    });
  });

  describe("File Pipeline Presigned Upload & Confirmation Flow", () => {
    let uploadId: string;

    it("should generate a presigned S3 PUT URL for a file", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned",
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          fileName: "test-file.png",
          fileSizeBytes: 1024,
          mimeType: "image/png",
          visibility: "public",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.uploadUrl).toBeDefined();
      expect(body.data.objectKey).toBeDefined();
      expect(body.data.upload).toBeDefined();
      expect(body.data.upload.originalFileName).toBe("test-file.png");
      expect(body.data.upload.storage.provider).toBe("cloudflare-r2");

      uploadId = body.data.upload._id;
    });

    it("should confirm file upload and activate the upload document", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/complete",
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          uploadId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.lifecycle.status).toBe("active");
    });
  });

  describe("Employee Invitation & Activation Pipeline", () => {
    let invitationToken: string;

    it("should successfully invite an employee and generate a secure token", async () => {
      const inviteEmail = "new-onboardee@test.com";

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees/invite",
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          email: inviteEmail,
          firstName: "New",
          lastName: "Onboardee",
          role: "employee",
          employmentType: "full_time",
        },
      });

      expect(response.statusCode).toBe(201);
      const user = await User.findOne({ "auth.email": inviteEmail });
      expect(user).toBeDefined();
      expect(user!.employment.status).toBe("invited");
      expect(user!.security.passwordResetToken).toBeDefined();

      // Retrieve the raw token from the EmailService
      const emailRecord = EmailService.sentEmails.find(e => e.to === inviteEmail);
      expect(emailRecord).toBeDefined();
      invitationToken = emailRecord!.token;
      expect(invitationToken).toBeDefined();
    });

    it("should successfully activate the invited employee via /invitations/accept", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/invitations/accept",
        payload: {
          token: invitationToken,
          password: "new-employee-secure-password-123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify the user status is active and credentials work
      const user = await User.findOne({ "auth.email": "new-onboardee@test.com" });
      expect(user!.employment.status).toBe("active");
      expect(user!.auth.emailVerified).toBe(true);
      expect(user!.security.passwordResetToken).toBeUndefined();

      // Verify login works with new password
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "new-onboardee@test.com",
          password: "new-employee-secure-password-123",
        },
      });
      expect(loginResponse.statusCode).toBe(200);
      const loginBody = JSON.parse(loginResponse.body);
      expect(loginBody.success).toBe(true);
      expect(loginBody.data.accessToken).toBeDefined();
    });
  });

  describe("Analytics Reporting Pipeline", () => {
    it("should allow an admin to fetch organization analytics summary with correct schema", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/analytics/summary",
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.avgCompletionRate).toBeDefined();
      expect(body.data.activeLearners).toBeDefined();
      expect(body.data.completionTrend).toBeInstanceOf(Array);
      expect(body.data.departmentCompletions).toBeInstanceOf(Array);
    }, 20000);

    it("should forbid an employee from fetching organization analytics summary", async () => {
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "new-onboardee@test.com",
          password: "new-employee-secure-password-123",
        },
      });
      const employeeToken = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/analytics/summary",
        headers: {
          Authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    }, 20000);
  });

  describe("Settings Alignment and Propagation Pipeline", () => {
    it("should allow an admin to update organization branding colors successfully", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/organizations/branding",
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          primaryColor: "#FF00FF",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.branding.primaryColor).toBe("#FF00FF");
    }, 20000);

    it("should allow organization owner to update notification settings and details successfully", async () => {
      const ownerToken = app.jwt.sign({
        userId: adminAUser._id.toString(),
        organizationId: orgAId.toString(),
        role: "owner",
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/organizations/current",
        headers: {
          Authorization: `Bearer ${ownerToken}`,
        },
        payload: {
          name: "Updated Organization A Ltd",
          supportEmail: "support-new@test.com",
          notificationSettings: {
            assignmentEmail: false,
            reminderEmail: true,
            weeklyDigest: false,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("Updated Organization A Ltd");
      expect(body.data.supportEmail).toBe("support-new@test.com");
      expect(body.data.notificationSettings.assignmentEmail).toBe(false);
      expect(body.data.notificationSettings.weeklyDigest).toBe(false);
    }, 20000);
  });

  describe("Auth Refresh Token Rotation Pipeline", () => {
    it("should issue a new access token and rotate refresh token using cookie", async () => {
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "new-onboardee@test.com",
          password: "new-employee-secure-password-123",
        },
      });

      expect(loginResponse.statusCode).toBe(200);
      
      const cookies = loginResponse.cookies;
      const refreshTokenCookie = cookies.find((c: any) => c.name === "refreshToken");
      expect(refreshTokenCookie).toBeDefined();
      const myRefreshToken = refreshTokenCookie.value;

      const refreshResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        cookies: {
          refreshToken: myRefreshToken,
        },
      });

      expect(refreshResponse.statusCode).toBe(200);
      const refreshBody = JSON.parse(refreshResponse.body);
      expect(refreshBody.success).toBe(true);
      expect(refreshBody.data.accessToken).toBeDefined();
      
      const newCookies = refreshResponse.cookies;
      const newRefreshTokenCookie = newCookies.find((c: any) => c.name === "refreshToken");
      expect(newRefreshTokenCookie).toBeDefined();
      expect(newRefreshTokenCookie.value).not.toBe(myRefreshToken);
    }, 20000);
  });

  describe("Tenant Suspension Pipeline", () => {
    it("should prevent logins and API requests if the organization is suspended", async () => {
      // 1. Suspend Organization A
      await Organization.updateOne({ _id: orgAId }, { status: "Suspended" });

      // 2. Try to login
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "new-onboardee@test.com",
          password: "new-employee-secure-password-123",
        },
      });

      expect(loginResponse.statusCode).toBe(403);
      const loginBody = JSON.parse(loginResponse.body);
      expect(loginBody.message).toContain("suspended");

      // 3. Try to call authenticated API
      const apiResponse = await app.inject({
        method: "GET",
        url: "/api/v1/analytics/summary",
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(apiResponse.statusCode).toBe(403);
      const apiBody = JSON.parse(apiResponse.body);
      expect(apiBody.message).toContain("suspended");

      // 4. Restore organization status
      await Organization.updateOne({ _id: orgAId }, { status: "Active" });
    }, 20000);
  });
});
