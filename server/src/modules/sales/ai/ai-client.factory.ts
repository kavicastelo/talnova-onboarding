import mongoose from "mongoose";
import {
  IAISalesProvider,
  ProviderNotConfiguredError,
} from "./ai-provider.interface.js";
import { OpenAISalesDriver } from "./openai.driver.js";
import { GeminiSalesDriver } from "./gemini.driver.js";
import { MockAISalesDriver } from "./mock-ai.driver.js";
import SalesIntegration from "../models/sales-integration.model.js";
import { SalesIntegrationService } from "../services/sales-integration.service.js";

export type SupportedAIProvider = "openai" | "gemini" | "mock";

export class AIClientFactory {
  private static cachedProviders = new Map<string, IAISalesProvider>();
  private static integrationService = new SalesIntegrationService();

  /**
   * Clear cached provider instances
   */
  public static clearCache(): void {
    this.cachedProviders.clear();
  }

  /**
   * Get the singleton mock driver instance
   */
  public static getMockDriver(): MockAISalesDriver {
    let mock = this.cachedProviders.get("mock") as MockAISalesDriver;
    if (!mock) {
      mock = new MockAISalesDriver();
      this.cachedProviders.set("mock", mock);
    }
    return mock;
  }

  /**
   * Get active AI provider from database configuration, environment variables, or mock fallback
   */
  public static async getActiveProvider(): Promise<IAISalesProvider> {
    // 0. Force unconfigured for testing/simulation
    if (process.env.SALES_AI_DRIVER === "none" || process.env.SALES_AI_FORCE_UNCONFIGURED === "true") {
      throw new ProviderNotConfiguredError(
        "ai",
        "No active AI sales provider is configured. Please enable and configure OpenAI or Google Gemini in Sales Integrations."
      );
    }

    // 1. Explicit mock override via environment
    if (process.env.SALES_AI_DRIVER === "mock") {
      return this.getMockDriver();
    }

    // 2. Query configured and enabled integration from database
    if (mongoose.connection.readyState === 1) {
      try {
        const activeIntegration = await SalesIntegration.findOne({
          category: "ai",
          enabled: true,
          status: { $in: ["valid", "configured"] },
        }).sort({ updatedAt: -1 });

        if (activeIntegration && ["openai", "gemini"].includes(activeIntegration.provider)) {
          return this.getProvider(activeIntegration.provider as SupportedAIProvider);
        }
      } catch {
        // Fall through to environment checks
      }
    }

    // 3. Fallback to direct environment variables if available
    if (process.env.OPENAI_API_KEY && process.env.SALES_AI_DRIVER !== "gemini") {
      return this.getProvider("openai");
    }
    if (process.env.GEMINI_API_KEY) {
      return this.getProvider("gemini");
    }

    // 4. In test mode without external keys, return mock driver
    if (process.env.NODE_ENV === "test") {
      return this.getMockDriver();
    }

    // 5. If no provider configured at all, throw typed error
    throw new ProviderNotConfiguredError(
      "ai",
      "No active AI sales provider is configured. Please enable and configure OpenAI or Google Gemini in Sales Integrations."
    );
  }

  /**
   * Check if any valid AI provider is currently configured
   */
  public static async getConfigurationStatus(): Promise<{ configured: boolean; provider: string | null }> {
    if (process.env.SALES_AI_DRIVER === "none" || process.env.SALES_AI_FORCE_UNCONFIGURED === "true") {
      return { configured: false, provider: null };
    }

    if (process.env.SALES_AI_DRIVER === "mock") {
      return { configured: true, provider: "mock" };
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const activeIntegration = await SalesIntegration.findOne({
          category: "ai",
          enabled: true,
          status: { $in: ["valid", "configured"] },
        }).sort({ updatedAt: -1 });

        if (activeIntegration && ["openai", "gemini"].includes(activeIntegration.provider)) {
          return { configured: true, provider: activeIntegration.provider };
        }
      } catch {
        // Fall through
      }
    }

    if (process.env.OPENAI_API_KEY && process.env.SALES_AI_DRIVER !== "gemini") {
      return { configured: true, provider: "openai" };
    }
    if (process.env.GEMINI_API_KEY) {
      return { configured: true, provider: "gemini" };
    }

    if (process.env.NODE_ENV === "test") {
      return { configured: true, provider: "mock" };
    }

    return { configured: false, provider: null };
  }

  /**
   * Instantiate or return cached provider instance
   */
  public static async getProvider(
    providerName: SupportedAIProvider,
    overrideConfig?: {
      publicConfig?: Record<string, any>;
      secrets?: Record<string, string>;
    }
  ): Promise<IAISalesProvider> {
    const cacheKey = overrideConfig
      ? `${providerName}-${JSON.stringify(overrideConfig)}`
      : providerName;

    if (this.cachedProviders.has(cacheKey) && !overrideConfig) {
      return this.cachedProviders.get(cacheKey)!;
    }

    if (providerName === "mock") {
      return this.getMockDriver();
    }

    let publicConfig = overrideConfig?.publicConfig || {};
    let secrets = overrideConfig?.secrets || {};

    if (!overrideConfig) {
      try {
        const integration = await SalesIntegration.findOne({
          category: "ai",
          provider: providerName,
        });

        if (integration) {
          publicConfig = integration.publicConfig || {};
          const decrypted = await this.integrationService.getDecryptedSecrets("ai", providerName);
          secrets = decrypted || {};
        }
      } catch {
        // Fallback to environment defaults
      }
    }

    let driver: IAISalesProvider;

    switch (providerName) {
      case "openai": {
        const apiKey = secrets.apiKey || process.env.OPENAI_API_KEY;
        const model = publicConfig.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
        const baseUrl = publicConfig.baseUrl || process.env.OPENAI_BASE_URL;
        driver = new OpenAISalesDriver({ apiKey, model, baseUrl });
        break;
      }

      case "gemini": {
        const apiKey = secrets.apiKey || process.env.GEMINI_API_KEY;
        const model = publicConfig.model || process.env.GEMINI_MODEL || "gemini-1.5-flash";
        const baseUrl = publicConfig.baseUrl || process.env.GEMINI_BASE_URL;
        driver = new GeminiSalesDriver({ apiKey, model, baseUrl });
        break;
      }

      default:
        throw new ProviderNotConfiguredError(providerName, `Unsupported AI provider '${providerName}'`);
    }

    if (!overrideConfig) {
      this.cachedProviders.set(cacheKey, driver);
    }

    return driver;
  }
}
