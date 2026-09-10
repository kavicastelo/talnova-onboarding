import mongoose from "mongoose";
import SSOConfig from "../models/sso-config.model.js";
import User from "../models/user.model.js";
import SessionRepository from "../repositories/session.repository.js";
import UserRepository from "../repositories/user.repository.js";
import AppError from "../../../common/errors/app-error.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import Organization from "../../organizations/models/organization.model.js";

export class SSOService {
  constructor(
    private readonly userRepository = new UserRepository(),
    private readonly sessionRepository = new SessionRepository(),
    private readonly jwt?: {
      sign: (payload: any, options?: any) => string;
    }
  ) {}

  /**
   * Get SSO Config for Organization (SSO-001)
   */
  async getSSOConfig(orgId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    let config = await SSOConfig.findOne({ organizationId: orgObjectId });

    if (!config) {
      config = await SSOConfig.create({
        organizationId: orgObjectId,
        provider: "okta",
        domains: [],
        enforceSSO: false,
        defaultRole: "employee",
        roleMappings: [],
        status: "disabled",
      });
    }

    return config;
  }

  /**
   * Save / Update SSO Config (SSO-001)
   */
  async saveSSOConfig(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    data: any
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    // Normalize domain / domains
    let targetDomains = data.domains;
    if (!targetDomains && data.domain) {
      targetDomains = [data.domain];
    }

    // Normalize entryPoint / ssoUrl
    const targetSsoUrl = data.ssoUrl !== undefined ? data.ssoUrl : data.entryPoint;

    // Validate URL format for ssoUrl / entryPoint if provided
    if (targetSsoUrl && targetSsoUrl.trim().length > 0) {
      try {
        const parsed = new URL(targetSsoUrl.trim());
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error();
        }
      } catch {
        throw new AppError(400, "BAD_REQUEST", "Invalid IdP Single Sign-On URL format. Must be a valid http or https URL.");
      }
    }

    let config = await SSOConfig.findOne({ organizationId: orgObjectId });

    if (!config) {
      config = new SSOConfig({
        organizationId: orgObjectId,
        createdBy: userObjectId,
      });
    }

    if (data.provider) config.provider = data.provider;
    if (Array.isArray(targetDomains)) {
      config.domains = targetDomains.map((d: string) => d.toLowerCase().trim()).filter(Boolean);
    }
    if (data.issuerUrl !== undefined) config.issuerUrl = data.issuerUrl;
    if (data.issuerId !== undefined && data.issuerUrl === undefined) config.issuerUrl = data.issuerId;
    if (data.clientId !== undefined) config.clientId = data.clientId;
    if (data.issuerId !== undefined && data.clientId === undefined) config.clientId = data.issuerId;
    if (data.clientSecret !== undefined) config.clientSecret = data.clientSecret;
    if (targetSsoUrl !== undefined) config.ssoUrl = targetSsoUrl ? targetSsoUrl.trim() : "";
    if (data.certificate !== undefined) config.certificate = data.certificate;
    if (data.enforceSSO !== undefined) config.enforceSSO = data.enforceSSO;
    if (data.defaultRole) config.defaultRole = data.defaultRole;
    if (Array.isArray(data.roleMappings)) config.roleMappings = data.roleMappings;
    if (data.status) config.status = data.status;
    if (data.enabled !== undefined && data.status === undefined) {
      config.status = data.enabled ? "active" : "disabled";
    }

    await config.save();

    // Synchronize to Organization.ssoConfig in MongoDB for fast queries and integrity
    await Organization.findByIdAndUpdate(orgObjectId, {
      $set: {
        ssoConfig: {
          enabled: config.status === "active",
          provider: config.provider,
          domain: config.domains?.[0] || "",
          domains: config.domains,
          entryPoint: config.ssoUrl || "",
          ssoUrl: config.ssoUrl || "",
          issuerId: config.clientId || config.issuerUrl || "",
          issuerUrl: config.issuerUrl || "",
          certificate: config.certificate || "",
          enforceSSO: config.enforceSSO,
          status: config.status,
        },
      },
    });

    return config;
  }

  /**
   * Domain Discovery (SSO-002)
   */
  async discoverDomainSSO(emailOrDomain: string) {
    const domain = (emailOrDomain.includes("@")
      ? emailOrDomain.split("@")[1]
      : emailOrDomain
    )?.toLowerCase()?.trim();

    if (!domain) {
      return { ssoEnabled: false, enabled: false };
    }

    const config = await SSOConfig.findOne({
      domains: domain,
      status: "active",
    });

    if (!config) {
      return { ssoEnabled: false, enabled: false };
    }

    const entryPoint = config.ssoUrl || (config.issuerUrl ? `${config.issuerUrl}/authorize` : "");

    return {
      ssoEnabled: true,
      enabled: true,
      provider: config.provider,
      ssoUrl: entryPoint,
      entryPoint,
      enforceSSO: config.enforceSSO,
      organizationId: config.organizationId.toString(),
    };
  }

  /**
   * Initiate SSO Redirect Auth (SSO-002)
   */
  async initiateSSOLogin(emailOrDomain: string) {
    const discovery = await this.discoverDomainSSO(emailOrDomain);

    if (!discovery.ssoEnabled) {
      throw new AppError(404, "NOT_FOUND", "No SSO provider configured for this domain");
    }

    const state = Buffer.from(JSON.stringify({ identifier: emailOrDomain, orgId: discovery.organizationId, ts: Date.now() })).toString("base64");
    const baseUrl = discovery.entryPoint || discovery.ssoUrl;
    const authUrl = `${baseUrl}${baseUrl?.includes("?") ? "&" : "?"}client_id=talnova&response_type=code&scope=openid+profile+email&state=${state}`;

    return {
      authUrl,
      redirectUrl: authUrl,
      state,
      provider: discovery.provider,
      entryPoint: baseUrl,
    };
  }

  /**
   * Handle SSO Assertion Callback with JIT Provisioning & Group Role Mapping (SSO-003, SSO-004, SSO-005)
   */
  async handleSSOCallback(
    orgId: string | mongoose.Types.ObjectId,
    ssoPayload: {
      email: string;
      firstName: string;
      lastName: string;
      ssoId: string;
      idpGroups?: string[];
    },
    ipAddress?: string,
    deviceInfo?: string
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const config = await SSOConfig.findOne({ organizationId: orgObjectId });

    let role: "admin" | "manager" | "employee" = config?.defaultRole || "employee";

    // Group-to-Role Mapping (SSO-004)
    if (config && config.roleMappings && ssoPayload.idpGroups && ssoPayload.idpGroups.length > 0) {
      for (const mapping of config.roleMappings) {
        if (ssoPayload.idpGroups.includes(mapping.idpGroup)) {
          role = mapping.role;
          break; // First matching group rule takes precedence
        }
      }
    }

    // Account Discovery or JIT Provisioning (SSO-003, SSO-005)
    let user = await User.findOne({
      organizationId: orgObjectId,
      "auth.email": ssoPayload.email.toLowerCase(),
    });

    if (!user) {
      // Just-In-Time (JIT) Provisioning (SSO-003)
      user = await User.create({
        organizationId: orgObjectId,
        auth: {
          email: ssoPayload.email.toLowerCase(),
          passwordHash: "SSO_AUTHENTICATED_NO_PASSWORD",
        },
        profile: {
          firstName: ssoPayload.firstName || "SSO",
          lastName: ssoPayload.lastName || "User",
        },
        employment: {
          department: "General",
          jobTitle: "Team Member",
          onboardingState: "active",
        },
        permissions: {
          role,
        },
      });
    } else {
      // Account Linking (SSO-005)
      user.permissions.role = role; // Update role from IdP
      await user.save();
    }

    // Issue active session and token (SSO-005)
    const session = await this.sessionRepository.create({
      userId: user._id,
      organizationId: user.organizationId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: ipAddress || "127.0.0.1",
      deviceInfo: deviceInfo || "SSO Client",
    });

    const tokenPayload = {
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      role: user.permissions.role,
      sessionId: session._id.toString(),
      tokenVersion: 1,
    };

    const token = this.jwt ? this.jwt.sign(tokenPayload) : "dummy_sso_token";

    // Integration check: Record SAML/SSO authentication event in audit trail
    await AuditLog.create({
      organizationId: user.organizationId,
      actorUserId: user._id,
      actorType: "user",
      eventCategory: "authentication",
      eventType: "SSO_SAML_ASSERTION_PROCESSED",
      resourceType: "User",
      resourceId: user._id,
      action: "login",
      description: `SSO SAML authentication successful for ${ssoPayload.email} with provider ${config?.provider || 'saml2'}`,
      metadata: {
        email: ssoPayload.email,
        ssoId: ssoPayload.ssoId,
        provider: config?.provider || "saml2",
        idpGroups: ssoPayload.idpGroups || [],
        assignedRole: role,
      },
      request: {
        ipAddress: ipAddress || "127.0.0.1",
        userAgent: deviceInfo || "SSO Client",
        endpoint: "/api/v1/auth/sso/callback",
      },
      severity: "info",
    }).catch(() => undefined);

    return {
      user,
      token,
      session,
    };
  }
}
