import nodemailer, { Transporter } from 'nodemailer';
import {
  IEmailProvider,
  EmailSendPayload,
  EmailSendResult,
  ConnectionTestResult,
  EmailRecipient,
} from './email-provider.interface.js';

export interface SesDriverConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  smtpUser?: string;
  smtpPassword?: string;
  defaultFrom?: string;
  defaultFromName?: string;
  configurationSet?: string;
  maxRetries?: number;
  backoffBaseMs?: number;
}

export class SesEmailDriver implements IEmailProvider {
  public readonly providerName = 'ses';

  private region: string;
  private defaultFrom: string;
  private defaultFromName: string;
  private configurationSet?: string;
  private transporter: Transporter;
  private maxRetries: number;
  private backoffBaseMs: number;
  private isConfigured: boolean;

  constructor(config: SesDriverConfig) {
    this.region = config.region || 'us-east-1';
    this.defaultFrom = config.defaultFrom || 'sales@talnova.com';
    this.defaultFromName = config.defaultFromName || 'Talnova';
    this.configurationSet = config.configurationSet;
    this.maxRetries = config.maxRetries ?? 3;
    this.backoffBaseMs = config.backoffBaseMs ?? 500;

    const username = config.smtpUser || config.accessKeyId;
    const password = config.smtpPassword || config.secretAccessKey;

    this.isConfigured = !!(username && password);

    // Amazon SES SMTP endpoint
    const sesHost = `email-smtp.${this.region}.amazonaws.com`;

    this.transporter = nodemailer.createTransport({
      host: sesHost,
      port: 587,
      secure: false, // STARTTLS
      auth: this.isConfigured
        ? {
            user: username,
            pass: password,
          }
        : undefined,
      pool: true,
      maxConnections: 5,
    } as any);
  }

  private formatRecipient(recipient: string | EmailRecipient): string {
    if (typeof recipient === 'string') return recipient;
    if (recipient.name) return `"${recipient.name}" <${recipient.email}>`;
    return recipient.email;
  }

  private normalizeRecipients(
    recipients: string | string[] | EmailRecipient | EmailRecipient[] | undefined
  ): string[] | undefined {
    if (!recipients) return undefined;
    if (Array.isArray(recipients)) {
      return recipients.map((r) => this.formatRecipient(r));
    }
    return [this.formatRecipient(recipients)];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send mail through Amazon SES with retry backoff for SES throttling
   */
  async sendMail(payload: EmailSendPayload): Promise<EmailSendResult> {
    const timestamp = new Date().toISOString();

    if (!this.isConfigured) {
      return {
        success: false,
        messageId: '',
        provider: 'ses',
        status: 'failed',
        timestamp,
        error: 'AWS SES credentials not fully configured (missing key or secret)',
      };
    }

    const fromEmail = payload.from || this.defaultFrom;
    const fromName = payload.fromName || this.defaultFromName;
    const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

    const to = this.normalizeRecipients(payload.to);
    if (!to || to.length === 0) {
      return {
        success: false,
        messageId: '',
        provider: 'ses',
        status: 'failed',
        timestamp,
        error: 'At least one recipient ("to") must be specified',
      };
    }

    const cc = this.normalizeRecipients(payload.cc);
    const bcc = this.normalizeRecipients(payload.bcc);

    const attachments = payload.attachments?.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
      path: att.path,
      cid: att.cid,
    }));

    const headers: Record<string, string> = {
      ...(payload.headers || {}),
    };

    if (this.configurationSet) {
      headers['X-SES-CONFIGURATION-SET'] = this.configurationSet;
    }
    if (payload.campaignId) {
      headers['X-SES-MESSAGE-TAGS'] = `campaignId=${payload.campaignId}`;
    }

    const mailOptions = {
      from,
      to: to.join(', '),
      cc: cc ? cc.join(', ') : undefined,
      bcc: bcc ? bcc.join(', ') : undefined,
      replyTo: payload.replyTo,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments,
      headers,
    };

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        const info = await this.transporter.sendMail(mailOptions);
        const sesMessageId =
          info.messageId ||
          `ses-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@email.amazonses.com`;

        return {
          success: true,
          messageId: sesMessageId,
          provider: 'ses',
          status: 'sent',
          timestamp,
          rawResponse: info,
        };
      } catch (err: any) {
        const isThrottling =
          err.responseCode === 454 ||
          err.code === 'Throttling' ||
          err.message?.includes('Throttling') ||
          err.message?.includes('Maximum sending rate exceeded');

        if (isThrottling && attempt <= this.maxRetries) {
          await this.sleep(this.backoffBaseMs * Math.pow(2, attempt - 1));
          continue;
        }

        if (attempt > this.maxRetries) {
          return {
            success: false,
            messageId: '',
            provider: 'ses',
            status: 'failed',
            timestamp,
            error: err.message || 'Amazon SES send error',
          };
        }
        await this.sleep(this.backoffBaseMs * Math.pow(2, attempt - 1));
      }
    }

    return {
      success: false,
      messageId: '',
      provider: 'ses',
      status: 'failed',
      timestamp,
      error: 'AWS SES maximum retry attempts exceeded',
    };
  }

  /**
   * Test connection to Amazon SES endpoint
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const validatedAt = new Date().toISOString();

    if (!this.isConfigured) {
      return {
        success: false,
        message: 'AWS SES credentials missing or incomplete',
        validatedAt,
      };
    }

    try {
      await this.transporter.verify();
      return {
        success: true,
        message: `Successfully connected to Amazon SES (${this.region})`,
        details: {
          region: this.region,
          host: `email-smtp.${this.region}.amazonaws.com`,
          defaultFrom: this.defaultFrom,
        },
        validatedAt,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Amazon SES connection verification failed: ${err.message}`,
        details: {
          region: this.region,
          error: err.message,
        },
        validatedAt,
      };
    }
  }

  /**
   * Validate incoming AWS SNS / SES Webhook notification
   */
  async validateWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: any
  ): Promise<boolean> {
    // Amazon SNS notifications send specific header
    const snsType =
      headers['x-amz-sns-message-type'] ||
      (typeof body === 'object' && body?.Type);

    if (snsType === 'Notification' || snsType === 'SubscriptionConfirmation') {
      return true;
    }

    // Direct SES event object with notificationType or eventType
    if (typeof body === 'object' && (body?.notificationType || body?.eventType)) {
      return true;
    }

    return false;
  }
}
