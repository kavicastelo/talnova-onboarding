import mongoose from 'mongoose';
import { IEmailProvider } from './email-provider.interface.js';
import { MockEmailDriver } from './mock.driver.js';
import { SmtpEmailDriver } from './smtp.driver.js';
import { SendGridEmailDriver } from './sendgrid.driver.js';
import { SesEmailDriver } from './ses.driver.js';
import SalesIntegration from '../../models/sales-integration.model.js';
import { SalesIntegrationService } from '../../services/sales-integration.service.js';

export type SupportedEmailProvider = 'mock' | 'smtp' | 'sendgrid' | 'ses';

export class EmailProviderFactory {
  private static cachedProviders = new Map<string, IEmailProvider>();
  private static integrationService = new SalesIntegrationService();

  /**
   * Clear in-memory driver instance cache (useful on config updates or tests)
   */
  public static clearCache(): void {
    this.cachedProviders.clear();
  }

  /**
   * Get the active email provider based on database configuration and environment
   */
  public static async getActiveProvider(): Promise<IEmailProvider> {
    // 1. Force mock mode if explicitly requested via environment variable or in unit test mode without DB
    if (process.env.SALES_EMAIL_DRIVER === 'mock' || mongoose.connection.readyState !== 1) {
      return this.getProvider('mock');
    }

    try {
      // 2. Query enabled and configured email integration from database
      const activeIntegration = await SalesIntegration.findOne({
        category: 'email',
        enabled: true,
        status: { $in: ['valid', 'configured'] },
      }).sort({ updatedAt: -1 });

      if (activeIntegration && ['ses', 'sendgrid', 'smtp'].includes(activeIntegration.provider)) {
        return this.getProvider(activeIntegration.provider as SupportedEmailProvider);
      }
    } catch {
      // Database not ready or query error: fallback safely to mock driver
    }

    // 3. Fallback to mock driver to prevent unhandled email drop
    return this.getProvider('mock');
  }

  /**
   * Instantiate or return cached provider instance
   */
  public static async getProvider(
    providerName: SupportedEmailProvider,
    overrideConfig?: {
      publicConfig?: Record<string, any>;
      secrets?: Record<string, string>;
    }
  ): Promise<IEmailProvider> {
    const cacheKey = overrideConfig
      ? `${providerName}-${JSON.stringify(overrideConfig)}`
      : providerName;

    if (this.cachedProviders.has(cacheKey) && !overrideConfig) {
      return this.cachedProviders.get(cacheKey)!;
    }

    let publicConfig = overrideConfig?.publicConfig || {};
    let secrets = overrideConfig?.secrets || {};

    // If no overrides provided and not mock, fetch stored settings & decrypt secrets
    if (!overrideConfig && providerName !== 'mock') {
      try {
        const integration = await SalesIntegration.findOne({
          category: 'email',
          provider: providerName,
        });

        if (integration) {
          publicConfig = integration.publicConfig || {};
          const decrypted = await this.integrationService.getDecryptedSecrets('email', providerName);
          secrets = decrypted || {};
        }
      } catch {
        // Fallback to empty if DB query fails
      }
    }

    let driver: IEmailProvider;

    switch (providerName) {
      case 'sendgrid': {
        const apiKey = secrets.apiKey || process.env.SENDGRID_API_KEY || '';
        driver = new SendGridEmailDriver({
          apiKey,
          defaultFrom: publicConfig.defaultFrom || process.env.SALES_DEFAULT_FROM,
          defaultFromName: publicConfig.defaultFromName || process.env.SALES_DEFAULT_FROM_NAME,
          sandboxMode: publicConfig.sandboxMode ?? (process.env.NODE_ENV === 'test'),
        });
        break;
      }

      case 'ses': {
        driver = new SesEmailDriver({
          region: publicConfig.region || process.env.AWS_REGION || 'us-east-1',
          accessKeyId: secrets.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: secrets.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
          smtpUser: secrets.smtpUser,
          smtpPassword: secrets.smtpPassword,
          defaultFrom: publicConfig.defaultFrom || process.env.SALES_DEFAULT_FROM,
          defaultFromName: publicConfig.defaultFromName || process.env.SALES_DEFAULT_FROM_NAME,
          configurationSet: publicConfig.configurationSet,
        });
        break;
      }

      case 'smtp': {
        driver = new SmtpEmailDriver({
          host: publicConfig.host || process.env.SMTP_HOST || 'localhost',
          port: Number(publicConfig.port || process.env.SMTP_PORT || 587),
          secure: publicConfig.secure ?? (Number(publicConfig.port) === 465),
          auth: (secrets.user || secrets.pass) ? {
            user: secrets.user || '',
            pass: secrets.pass || '',
          } : undefined,
          defaultFrom: publicConfig.defaultFrom || process.env.SALES_DEFAULT_FROM,
          defaultFromName: publicConfig.defaultFromName || process.env.SALES_DEFAULT_FROM_NAME,
        });
        break;
      }

      case 'mock':
      default: {
        driver = new MockEmailDriver({
          defaultFrom: publicConfig.defaultFrom || 'sales@talnova.com',
          defaultFromName: publicConfig.defaultFromName || 'Talnova Sales',
        });
        break;
      }
    }

    this.cachedProviders.set(cacheKey, driver);
    return driver;
  }
}

export default EmailProviderFactory;
