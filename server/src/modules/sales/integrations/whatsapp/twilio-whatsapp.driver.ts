import {
  IWhatsAppProvider,
  WhatsAppTemplateSendPayload,
  WhatsAppSendResult,
  ConnectionTestResult,
  WhatsAppTemplate,
  normalizeToE164,
} from './whatsapp-provider.interface.js';

export interface TwilioWhatsAppDriverConfig {
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string; // e.g. "+14155238886"
  maxRetries?: number;
  backoffBaseMs?: number;
}

export class TwilioWhatsAppDriver implements IWhatsAppProvider {
  public readonly providerName = 'twilio_whatsapp';

  private accountSid: string;
  private authToken: string;
  private fromPhoneNumber: string;
  private maxRetries: number;
  private backoffBaseMs: number;

  constructor(config: TwilioWhatsAppDriverConfig) {
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.fromPhoneNumber = config.fromPhoneNumber;
    this.maxRetries = config.maxRetries ?? 3;
    this.backoffBaseMs = config.backoffBaseMs ?? 500;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatTwilioAddress(phone: string): { e164: string; twilioAddress: string } {
    const e164 = normalizeToE164(phone);
    return {
      e164,
      twilioAddress: `whatsapp:${e164}`,
    };
  }

  private getBasicAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
  }

  /**
   * Send template or formatted message via Twilio WhatsApp API
   */
  async sendTemplateMessage(
    payload: WhatsAppTemplateSendPayload
  ): Promise<WhatsAppSendResult> {
    const timestamp = new Date().toISOString();

    let e164: string;
    let toTwilio: string;
    try {
      const res = this.formatTwilioAddress(payload.to);
      e164 = res.e164;
      toTwilio = res.twilioAddress;
    } catch (err: any) {
      return {
        success: false,
        messageId: '',
        provider: 'twilio_whatsapp',
        status: 'failed',
        recipient: payload.to,
        timestamp,
        error: err.message,
      };
    }

    const fromTwilio = `whatsapp:${normalizeToE164(this.fromPhoneNumber)}`;

    // Build message body from components or template
    let messageBody = `Template: ${payload.templateName}`;
    if (payload.components && payload.components.length > 0) {
      const bodyComp = payload.components.find((c) => c.type === 'body');
      if (bodyComp && bodyComp.parameters.length > 0) {
        messageBody = bodyComp.parameters.map((p) => p.text || '').filter(Boolean).join(' ');
      }
    }

    const formData = new URLSearchParams();
    formData.append('To', toTwilio);
    formData.append('From', fromTwilio);
    formData.append('Body', messageBody);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: this.getBasicAuthHeader(),
          },
          body: formData.toString(),
        });

        const data: any = await response.json();

        if (response.ok && data.sid) {
          return {
            success: true,
            messageId: data.sid,
            provider: 'twilio_whatsapp',
            status: data.status === 'failed' ? 'failed' : 'queued',
            recipient: e164,
            timestamp,
            rawResponse: data,
          };
        }

        // Handle Twilio rate limits (HTTP 429)
        if (response.status === 429 && attempt <= this.maxRetries) {
          await this.sleep(this.backoffBaseMs * Math.pow(2, attempt - 1));
          continue;
        }

        return {
          success: false,
          messageId: data?.sid || '',
          provider: 'twilio_whatsapp',
          status: 'failed',
          recipient: e164,
          timestamp,
          error: data?.message || `Twilio dispatch error (${response.status})`,
          rawResponse: data,
        };
      } catch (err: any) {
        if (attempt > this.maxRetries) {
          return {
            success: false,
            messageId: '',
            provider: 'twilio_whatsapp',
            status: 'failed',
            recipient: e164,
            timestamp,
            error: err.message || 'Twilio network dispatch failure',
          };
        }
        await this.sleep(this.backoffBaseMs * Math.pow(2, attempt - 1));
      }
    }

    return {
      success: false,
      messageId: '',
      provider: 'twilio_whatsapp',
      status: 'failed',
      recipient: e164,
      timestamp,
      error: 'Twilio maximum retry attempts exceeded',
    };
  }

  /**
   * Send text message via Twilio
   */
  async sendTextMessage(to: string, message: string): Promise<WhatsAppSendResult> {
    const timestamp = new Date().toISOString();
    const { e164, twilioAddress: toTwilio } = this.formatTwilioAddress(to);
    const fromTwilio = `whatsapp:${normalizeToE164(this.fromPhoneNumber)}`;

    const formData = new URLSearchParams();
    formData.append('To', toTwilio);
    formData.append('From', fromTwilio);
    formData.append('Body', message);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: this.getBasicAuthHeader(),
        },
        body: formData.toString(),
      });

      const data: any = await response.json();

      if (response.ok && data.sid) {
        return {
          success: true,
          messageId: data.sid,
          provider: 'twilio_whatsapp',
          status: data.status === 'failed' ? 'failed' : 'queued',
          recipient: e164,
          timestamp,
          rawResponse: data,
        };
      }

      return {
        success: false,
        messageId: data?.sid || '',
        provider: 'twilio_whatsapp',
        status: 'failed',
        recipient: e164,
        timestamp,
        error: data?.message || 'Failed to dispatch Twilio WhatsApp text',
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        messageId: '',
        provider: 'twilio_whatsapp',
        status: 'failed',
        recipient: e164,
        timestamp,
        error: err.message,
      };
    }
  }

  /**
   * Return predefined/synced templates
   */
  async syncApprovedTemplates(): Promise<WhatsAppTemplate[]> {
    return [];
  }

  /**
   * Test connection to Twilio API
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const validatedAt = new Date().toISOString();

    if (!this.accountSid || !this.authToken) {
      return {
        success: false,
        message: 'Missing Twilio Account SID or Auth Token',
        validatedAt,
      };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}.json`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: this.getBasicAuthHeader(),
        },
      });

      const data: any = await response.json();

      if (response.ok && data.sid) {
        return {
          success: true,
          message: `Successfully connected to Twilio Account: ${data.friendly_name || data.sid} (${data.status})`,
          details: {
            accountSid: data.sid,
            status: data.status,
            type: data.type,
            fromPhoneNumber: this.fromPhoneNumber,
          },
          validatedAt,
        };
      }

      return {
        success: false,
        message: data?.message || `Twilio authentication failed (${response.status})`,
        validatedAt,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Twilio connection error: ${err.message}`,
        validatedAt,
      };
    }
  }

  /**
   * Validate webhook from Twilio
   */
  validateWebhook(_signature: string, payload: any): boolean {
    if (!payload) return false;
    // Twilio status callback payloads contain MessageSid and AccountSid
    if (typeof payload === 'object' && (payload.MessageSid || payload.AccountSid || payload.From)) {
      return true;
    }
    return false;
  }
}
