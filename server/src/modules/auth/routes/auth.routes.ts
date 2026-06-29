import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller.js";
import { AuthService } from "../services/auth.service.js";
import crypto from "crypto";
import UserRepository from "../repositories/user.repository.js";
import SessionRepository from "../repositories/session.repository.js";
import loginSchema from "../schemas/login.schema.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { z } from "zod";
import mongoose from "mongoose";
import AppError from "../../../common/errors/app-error.js";
import { hashPassword } from "../../../utils/crypto.js";
import { User } from "../models/user.model.js";
import { Organization } from "../../organizations/models/organization.model.js";

const registerSchema = z.object({
  orgName: z.string().min(1, "Organization name is required"),
  orgSlug: z.string().min(1, "Workspace slug is required"),
  supportEmail: z.string().email("Invalid support email address").optional().or(z.literal("")),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function authRoutes(app: FastifyInstance) {
  const userRepository = new UserRepository();
  const sessionRepository = new SessionRepository();
  const authService = new AuthService(userRepository, sessionRepository, app.jwt);
  const controller = new AuthController(authService);

  // POST /api/v1/auth/login
  app.post(
    "/login",
    {
      schema: {
        body: loginSchema,
      },
    },
    controller.login
  );

  // POST /api/v1/auth/register
  app.post(
    "/register",
    {
      schema: {
        body: registerSchema,
      },
    },
    async (request, reply) => {
      const { orgName, orgSlug, supportEmail, firstName, lastName, email, password } = request.body as any;

      const slugLower = orgSlug.toLowerCase().trim();
      const emailLower = email.toLowerCase().trim();

      // 1. Check if organization slug is taken
      const existingOrg = await Organization.findOne({ slug: slugLower, isDeleted: false });
      if (existingOrg) {
        throw new AppError(400, "BAD_REQUEST", "Workspace URL slug is already taken.");
      }

      // 2. Check if user email is registered
      const existingUser = await User.findOne({ "auth.email": emailLower, isDeleted: false });
      if (existingUser) {
        throw new AppError(400, "BAD_REQUEST", "Email address is already registered.");
      }

      // 3. Hash password
      const passwordHash = await hashPassword(password);

      // 4. Create Organization
      const orgId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const newOrg = new Organization({
        _id: orgId,
        name: orgName.trim(),
        slug: slugLower,
        supportEmail: supportEmail ? supportEmail.toLowerCase().trim() : emailLower,
        createdBy: userId,
        branding: {
          primaryColor: "#4F46E5",
          secondaryColor: "#10B981",
          accentColor: "#F59E0B"
        },
        workspace: {
          timezone: "UTC",
          locale: "en-US",
          dateFormat: "YYYY-MM-DD",
          firstDayOfWeek: 0
        },
        departments: [
          { _id: new mongoose.Types.ObjectId(), name: "Engineering", active: true },
          { _id: new mongoose.Types.ObjectId(), name: "Product", active: true },
          { _id: new mongoose.Types.ObjectId(), name: "Design", active: true }
        ],
        analytics: {
          totalEmployees: 1,
          activeEmployees: 1,
          journeys: 0,
          completionRate: 0
        }
      });

      await newOrg.save();

      // 5. Create Owner User
      const newUser = new User({
        _id: userId,
        organizationId: orgId,
        auth: {
          email: emailLower,
          passwordHash,
          emailVerified: true,
        },
        profile: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          fullName: `${firstName} ${lastName}`.trim()
        },
        employment: {
          employmentType: "full_time",
          status: "active"
        },
        permissions: {
          role: "owner",
          customRoles: []
        },
        preferences: {
          language: "en",
          theme: "dark",
          emailNotifications: true
        },
        statistics: {
          assignedJourneys: 0,
          completedJourneys: 0,
          certificates: 0,
          completionRate: 0
        },
        security: {
          mfaEnabled: false,
          failedLoginAttempts: 0
        },
        createdBy: userId
      });

      await newUser.save();

      return reply.status(201).send({
        success: true,
        message: "Organization workspace launched successfully",
        data: {
          organization: {
            id: orgId,
            name: newOrg.name,
            slug: newOrg.slug,
          },
          user: {
            id: userId,
            email: newUser.auth.email,
            role: newUser.permissions.role,
          }
        }
      });
    }
  );

  // POST /api/v1/auth/refresh
  app.post("/refresh", controller.refresh);

  // POST /api/v1/auth/logout
  app.post(
    "/logout",
    {
      onRequest: [authenticate],
    },
    controller.logout
  );

  const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email address"),
  });

  const resetPasswordSchema = z.object({
    token: z.string().min(1, "Reset token is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  });

  // POST /api/v1/auth/forgot-password
  app.post(
    "/forgot-password",
    {
      schema: {
        body: forgotPasswordSchema,
      },
    },
    controller.forgotPassword
  );

  // POST /api/v1/auth/reset-password
  app.post(
    "/reset-password",
    {
      schema: {
        body: resetPasswordSchema,
      },
    },
    controller.resetPassword
  );

  // POST /api/v1/auth/invitations/accept
  app.post(
    "/invitations/accept",
    {
      schema: {
        body: z.object({
          token: z.string().min(1, "Token is required"),
          password: z.string().min(8, "Password must be at least 8 characters"),
        }),
      },
    },
    async (request, reply) => {
      const { token, password } = request.body as any;
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

      const user = await User.findOne({
        "security.passwordResetToken": hashedToken,
        "security.passwordResetExpires": { $gt: new Date() },
        isDeleted: false,
      });

      if (!user) {
        throw new AppError(400, "INVALID_TOKEN", "Invitation token is invalid or has expired.");
      }

      const passwordHash = await hashPassword(password);

      user.auth.passwordHash = passwordHash;
      user.auth.emailVerified = true;
      user.employment.status = "active";
      user.security.passwordResetToken = undefined;
      user.security.passwordResetExpires = undefined;
      user.auth.passwordChangedAt = new Date();

      await user.save();

      return reply.status(200).send({
        success: true,
        message: "Invitation accepted successfully. Account activated.",
        data: null,
      });
    }
  );
}

export default authRoutes;
