import crypto from 'crypto';
import {
  IWhatsAppProvider,
  WhatsAppTemplateSendPayload,
  WhatsAppSendResult,
  ConnectionTestResult,
  WhatsAppTemplate,
  normalizeToE164,
} from './whatsapp-provider.interface.js';

export interface MetaCloudDriverConfig {
  accessToken: string;
  phoneNumberId: string;
  wabaId?: string;
  appSecret?: string;
  apiVersion?: string;
  maxRetries?: number;
  backoffBaseMs?: number;
}

export class MetaCloudWhatsAppDriver implements IWhatsAppProvider {
  public readonly providerName = 'meta_whatsapp';

  private accessToken: string;
  private phoneNumberId: string;
  private wabaId?: string;
  private appSecret?: string;
  private apiVersion: string;
  private maxRetries: number;
  private backoffBaseMs: number;

  constructor(config: MetaCloudDriverConfig) {
    this.accessToken = config.accessToken;
    this.phoneNumberId = config.phoneNumberId;
    this.wabaId = config.wabaId;
    this.appSecret = config.appSecret;
    this.apiVersion = config.apiVersion || 'v18.0';
    this.maxRetries = config.maxRetries ?? 3;
    this.backoffBaseMs = config.backoffBaseMs ?? 500;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper: format E.164 phone into Meta recipient digits (strips leading +)
   */
  private formatMetaRecipient(phone: string): { e164: string; metaRecipient: string } {
    const e164 = normalizeToE164(phone);
    const metaRecipient = e164.replace('+', '');
    return { e164, metaRecipient };
  }

  /**
   * Send pre-approved template message via Meta WhatsApp Business Cloud API
   */
  async sendTemplateMessage(
    payload: WhatsAppTemplateSendPayload
  ): Promise<WhatsAppSendResult> {
    const timestamp = new Date().toISOString();

    let e164: string;
    let metaRecipient: string;
    try {
      const res = this.formatMetaRecipient(payload.to);
      e164 = res.e164;
      metaRecipient = res.metaRecipient;
    } catch (err: any) {
      return {
        success: false,
        messageId: '',
        provider: 'meta_whatsapp',
        status: 'failed',
        recipient: payload.to,
        timestamp,
        error: err.message,
      };
    }

    const languageCode = payload.languageCode || 'en_US';

    const bodyData: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: metaRecipient,
      type: 'template',
      template: {
        name: payload.templateName,
        language: {
          code: languageCode,
        },
      },
    };

    if (payload.components && payload.components.length > 0) {
      bodyData.template.components = payload.components;
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify(bodyData),
        });

        const data: any = await response.json();

        if (response.ok && data.messages && data.messages.length > 0) {
          const messageId = data.messages[0].id;
          return {
            success: true,
            messageId,
            provider: 'meta_whatsapp',
            status: 'sent',
            recipient: e164,
            timestamp,
            rawResponse: data,
          };
        }

        // Meta Rate Limiting (Error codes 80007, 130429, or HTTP 429)
        const isRateLimit =
          response.status === 429 ||
          data?.error?.code === 80007 ||
          data?.error?.code === 130429;

        if (isRateLimit && attempt <= this.maxRetries) {
          await this.sleep(this.backoffBaseMs * Math.pow(2, attempt - 1));
          continue;
        }

        const errorMsg =
          data?.error?.message ||
          data?.error?.error_user_msg ||
          `Meta Graph API dispatch failure (${response.status})`;

        return {
          success: false,
          messageId: '',
          provider: 'meta_whatsapp',
          status: 'failed',
          recipient: e164,
          timestamp,
          error: errorMsg,
          rawResponse: data,
        };
      } catch (err: any) {
        if (attempt > this.maxRetries) {
          return {
            success: false,
            messageId: '',
            provider: 'meta_whatsapp',
            status: 'failed',
            recipient: e164,
            timestamp,
            error: err.message || 'Network failure communicating with Meta Graph API',
          };
        }
        await this.sleep(this.backoffBaseMs * Math.pow(2, attempt - 1));
      }
    }

    return {
      success: false,
      messageId: '',
      provider: 'meta_whatsapp',
      status: 'failed',
      recipient: e164,
      timestamp,
      error: 'Meta Graph API maximum retry limit reached',
    };
  }

  /**
   * Send 24-hour session text message
   */
  async sendTextMessage(to: string, message: string): Promise<WhatsAppSendResult> {
    const timestamp = new Date().toISOString();
    const { e164, metaRecipient } = this.formatMetaRecipient(to);

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: metaRecipient,
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        }),
      });

      const data: any = await response.json();

      if (response.ok && data.messages && data.messages.length > 0) {
        return {
          success: true,
          messageId: data.messages[0].id,
          provider: 'meta_whatsapp',
          status: 'sent',
          recipient: e164,
          timestamp,
          rawResponse: data,
        };
      }

      return {
        success: false,
        messageId: '',
        provider: 'meta_whatsapp',
        status: 'failed',
        recipient: e164,
        timestamp,
        error: data?.error?.message || 'Failed to dispatch WhatsApp session text message',
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        messageId: '',
        provider: 'meta_whatsapp',
        status: 'failed',
        recipient: e164,
        timestamp,
        error: err.message,
      };
    }
  }

  /**
   * Sync approved message templates from WhatsApp Business Account
   */
  async syncApprovedTemplates(): Promise<WhatsAppTemplate[]> {
    if (!this.wabaId) {
      return [];
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.wabaId}/message_templates?status=APPROVED&limit=100`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data: any = await response.json();
      const rawTemplates = data.data || [];

      return rawTemplates.map((t: any) => ({
        name: t.name,
        language: t.language,
        status: t.status,
        category: t.category,
        components: t.components,
        id: t.id,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Test connection to Meta Graph API using Phone Number ID
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const validatedAt = new Date().toISOString();

    if (!this.accessToken || !this.phoneNumberId) {
      return {
        success: false,
        message: 'Missing Meta Access Token or Phone Number ID',
        validatedAt,
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const data: any = await response.json();

      if (response.ok && (data.id || data.display_phone_number)) {
        return {
          success: true,
          message: `Successfully connected to Meta WhatsApp Cloud API for ${data.display_phone_number || data.id}`,
          details: {
            phoneNumberId: data.id,
            displayPhoneNumber: data.display_phone_number,
            verifiedName: data.verified_name,
            qualityRating: data.quality_rating,
          },
          validatedAt,
        };
      }

      const errorMsg = data?.error?.message || `Meta Graph API authentication failed (${response.status})`;
      return {
        success: false,
        message: errorMsg,
        details: data?.error,
        validatedAt,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Meta connection test error: ${err.message}`,
        validatedAt,
      };
    }
  }

  /**
   * Validate incoming webhook signature (X-Hub-Signature-256)
   */
  validateWebhook(signature: string, payload: any): boolean {
    if (!payload) return false;

    // If appSecret is configured, verify HMAC SHA-256 signature
    if (this.appSecret && signature) {
      try {
        const expectedPrefix = 'sha256=';
        const signatureHash = signature.startsWith(expectedPrefix)
          ? signature.slice(expectedPrefix.length)
          : signature;

        const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const computedHash = crypto
          .createHmac('sha256', this.appSecret)
          .update(rawBody)
          .digest('hex');

        if (signatureHash.length !== computedHash.length) {
          return false;
        }

        return crypto.timingSafeEqual(
          Buffer.from(signatureHash, 'hex'),
          Buffer.from(computedHash, 'hex')
        );
      } catch {
        return false;
      }
    }

    // Fallback structure validation for WhatsApp webhook payload
    if (typeof payload === 'object' && payload.object === 'whatsapp_business_account') {
      return true;
    }

    return false;
  }
}
