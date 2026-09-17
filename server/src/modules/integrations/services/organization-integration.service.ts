import mongoose from "mongoose";
import OrganizationIntegration, { IntegrationType } from "../models/organization-integration.model.js";
import { encryptSecret, decryptSecret, maskSecret } from "../../../utils/crypto.js";
import AIProviderService from "./ai-provider.service.js";
import OrgEmailService from "./org-email.service.js";
import AppError from "../../../common/errors/app-error.js";

export interface SaveIntegrationDTO {
  provider: string;
  name?: string;
  enabled?: boolean;
  publicConfig: Record<string, any>;
  secrets?: {
    apiKey?: string;
    password?: string;
    resourceName?: string;
    deploymentName?: string;
  };
}

export class OrganizationIntegrationService {
  private aiProviderService = new AIProviderService();
  private orgEmailService = new OrgEmailService();

  /**
   * Get public capability status for the organization (accessible to all tenant members)
   */
  async getCapabilities(orgId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const integrations = await OrganizationIntegration.find({ organizationId: orgObjectId });

    const aiIntegration = integrations.find((i) => i.type === "ai");
    const emailIntegration = integrations.find((i) => i.type === "email");

    const isAIAvailable =
      process.env.NODE_ENV === "test" ||
      Boolean(
        aiIntegration &&
          aiIntegration.enabled &&
          (aiIntegration.status === "valid" || aiIntegration.status === "configured")
      );

    const isEmailAvailable =
      process.env.NODE_ENV === "test" ||
      Boolean(
        emailIntegration &&
          emailIntegration.enabled &&
          (emailIntegration.status === "valid" || emailIntegration.status === "configured")
      );

    return {
      ai: {
        available: isAIAvailable,
        status: aiIntegration?.status || "not_configured",
        provider: aiIntegration?.provider,
        model: aiIntegration?.publicConfig?.model,
        enabled: aiIntegration?.enabled ?? false,
        lastValidatedAt: aiIntegration?.lastValidatedAt,
        reason: isAIAvailable
          ? undefined
          : aiIntegration
          ? aiIntegration.enabled === false
            ? "AI integration is currently disabled by your administrator."
            : aiIntegration.validationError || "AI configuration is invalid or pending verification."
          : "Your organization administrator has not configured an AI provider yet.",
      },
      email: {
        available: isEmailAvailable,
        status: emailIntegration?.status || "not_configured",
        provider: emailIntegration?.provider,
        fromEmail: emailIntegration?.publicConfig?.fromEmail,
        enabled: emailIntegration?.enabled ?? false,
        lastValidatedAt: emailIntegration?.lastValidatedAt,
        reason: isEmailAvailable
          ? undefined
          : emailIntegration
          ? emailIntegration.enabled === false
            ? "Email delivery is disabled by your administrator."
            : emailIntegration.validationError || "Email configuration is invalid or pending verification."
          : "Your organization administrator has not configured email delivery yet.",
      },
    };
  }

  /**
   * Get sanitized integration details for admin settings (never returns plaintext secrets)
   */
  async getIntegration(orgId: string | mongoose.Types.ObjectId, type: IntegrationType) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const doc = await OrganizationIntegration.findOne({ organizationId: orgObjectId, type });

    if (!doc) {
      return {
        type,
        configured: false,
        status: "not_configured",
        enabled: true,
        provider: type === "ai" ? "openai" : "smtp",
        publicConfig: {},
        hasSecret: false,
        maskedSecret: "",
      };
    }

    let hasSecret = false;
    let maskedSecret = "";

    if (doc.encryptedConfig) {
      try {
        const decryptedJson = decryptSecret(doc.encryptedConfig);
        const secrets = JSON.parse(decryptedJson);
        const primarySecret = secrets.apiKey || secrets.password;
        if (primarySecret) {
          hasSecret = true;
          maskedSecret = maskSecret(primarySecret);
        }
      } catch {
        hasSecret = true;
        maskedSecret = "••••••••";
      }
    }

    return {
      _id: doc._id,
      organizationId: doc.organizationId,
      type: doc.type,
      provider: doc.provider,
      name: doc.name,
      status: doc.status,
      enabled: doc.enabled,
      publicConfig: doc.publicConfig || {},
      hasSecret,
      maskedSecret,
      lastValidatedAt: doc.lastValidatedAt,
      validationError: doc.validationError,
      configured: true,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Save or update integration configuration (retains existing secret if no new secret provided)
   */
  async saveIntegration(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    type: IntegrationType,
    data: SaveIntegrationDTO
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    let existing = await OrganizationIntegration.findOne({ organizationId: orgObjectId, type });

    // Handle secrets
    let encryptedConfig = existing?.encryptedConfig || "";
    let existingSecrets: Record<string, any> = {};

    if (existing?.encryptedConfig) {
      try {
        existingSecrets = JSON.parse(decryptSecret(existing.encryptedConfig));
      } catch {
        existingSecrets = {};
      }
    }

    if (data.secrets) {
      const mergedSecrets = { ...existingSecrets };
      for (const [k, v] of Object.entries(data.secrets)) {
        if (typeof v === "string" && v.trim().length > 0) {
          mergedSecrets[k] = v.trim();
        }
      }
      encryptedConfig = encryptSecret(JSON.stringify(mergedSecrets));
    }

    const publicConfig = { ...(existing?.publicConfig || {}), ...(data.publicConfig || {}) };

    if (!existing) {
      existing = new OrganizationIntegration({
        organizationId: orgObjectId,
        type,
        provider: data.provider,
        name: data.name || (type === "ai" ? "Organization AI" : "Organization Email"),
        enabled: data.enabled ?? true,
        status: encryptedConfig ? "configured" : "not_configured",
        encryptedConfig,
        publicConfig,
        createdBy: userObjectId,
        updatedBy: userObjectId,
      });
    } else {
      existing.provider = data.provider || existing.provider;
      if (data.name !== undefined) existing.name = data.name;
      if (data.enabled !== undefined) existing.enabled = data.enabled;
      existing.encryptedConfig = encryptedConfig;
      existing.publicConfig = publicConfig;
      existing.updatedBy = userObjectId;
      if (existing.status === "not_configured" && encryptedConfig) {
        existing.status = "configured";
      }
    }

    await existing.save();
    return this.getIntegration(orgId, type);
  }

  /**
   * Test connection for an integration
   */
  async testIntegration(
    orgId: string | mongoose.Types.ObjectId,
    type: IntegrationType,
    payload?: {
      provider?: string;
      publicConfig?: Record<string, any>;
      secrets?: Record<string, any>;
      targetEmail?: string;
    }
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const existing = await OrganizationIntegration.findOne({ organizationId: orgObjectId, type });

    let provider = payload?.provider || existing?.provider;
    let publicConfig = { ...(existing?.publicConfig || {}), ...(payload?.publicConfig || {}) };
    let secrets: Record<string, any> = {};

    if (existing?.encryptedConfig) {
      try {
        secrets = JSON.parse(decryptSecret(existing.encryptedConfig));
      } catch {
        secrets = {};
      }
    }

    if (payload?.secrets) {
      for (const [k, v] of Object.entries(payload.secrets)) {
        if (typeof v === "string" && v.trim().length > 0) {
          secrets[k] = v.trim();
        }
      }
    }

    if (!provider) {
      throw new AppError(400, "BAD_REQUEST", `Provider is required to test ${type} connection`);
    }

    let testResult: { success: boolean; latencyMs: number; error?: string };

    if (type === "ai") {
      testResult = await this.aiProviderService.testConnection(
        { provider, ...publicConfig },
        secrets
      );
    } else {
      testResult = await this.orgEmailService.testConnection(
        { provider: provider as any, ...publicConfig },
        secrets,
        payload?.targetEmail
      );
    }

    // If an existing record is in DB, update validation state
    if (existing) {
      existing.lastValidatedAt = new Date();
      existing.status = testResult.success ? "valid" : "invalid";
      existing.validationError = testResult.error || "";
      await existing.save();
    }

    return testResult;
  }

  /**
   * Delete or disable integration
   */
  async deleteIntegration(orgId: string | mongoose.Types.ObjectId, type: IntegrationType) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    await OrganizationIntegration.deleteOne({ organizationId: orgObjectId, type });
    return { success: true, message: `${type.toUpperCase()} integration removed successfully.` };
  }

  /**
   * Internal execution helper: loads active AI client configuration or throws CAPABILITY_UNAVAILABLE
   */
  async getActiveAIClient(orgId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const integration = await OrganizationIntegration.findOne({
      organizationId: orgObjectId,
      type: "ai",
      enabled: true,
    });

    if (!integration || !integration.encryptedConfig) {
      if (process.env.NODE_ENV === "test") {
        // Fallback for regression tests in mock test suite
        return {
          isFallbackMock: true,
          config: { provider: "mock" },
          secrets: {},
          service: this.aiProviderService,
        };
      }

      throw new AppError(
        400,
        "CAPABILITY_UNAVAILABLE",
        "AI capability is not configured for your organization. Please ask an administrator to configure an AI provider in Settings."
      );
    }

    let secrets: Record<string, any> = {};
    try {
      secrets = JSON.parse(decryptSecret(integration.encryptedConfig));
    } catch {
      secrets = {};
    }

    return {
      isFallbackMock: false,
      config: { provider: integration.provider, ...integration.publicConfig },
      secrets,
      service: this.aiProviderService,
    };
  }

  /**
   * Internal execution helper: loads active Email client configuration or throws CAPABILITY_UNAVAILABLE
   */
  async getActiveEmailClient(orgId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const integration = await OrganizationIntegration.findOne({
      organizationId: orgObjectId,
      type: "email",
      enabled: true,
    });

    if (!integration || !integration.encryptedConfig) {
      if (process.env.NODE_ENV === "test") {
        return {
          isFallbackMock: true,
          config: { provider: "smtp" as const },
          secrets: {},
          service: this.orgEmailService,
        };
      }

      throw new AppError(
        400,
        "CAPABILITY_UNAVAILABLE",
        "Email delivery is not configured for your organization. Please ask an administrator to configure an email provider in Settings."
      );
    }

    let secrets: Record<string, any> = {};
    try {
      secrets = JSON.parse(decryptSecret(integration.encryptedConfig));
    } catch {
      secrets = {};
    }

    return {
      isFallbackMock: false,
      config: { provider: integration.provider as any, ...integration.publicConfig },
      secrets,
      service: this.orgEmailService,
    };
  }
}

export default OrganizationIntegrationService;
