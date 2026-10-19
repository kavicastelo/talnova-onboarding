import {
  IEmailProvider,
  EmailSendPayload,
  EmailSendResult,
  ConnectionTestResult,
  EmailRecipient,
} from './email-provider.interface.js';

export interface SendGridDriverConfig {
  apiKey: string;
  defaultFrom?: string;
  defaultFromName?: string;
  sandboxMode?: boolean;
  maxRetries?: number;
  backoffBaseMs?: number;
}

export class SendGridEmailDriver implements IEmailProvider {
  public readonly providerName = 'sendgrid';

  private apiKey: string;
  private defaultFrom: string;
  private defaultFromName: string;
  private sandboxMode: boolean;
  private maxRetries: number;
  private backoffBaseMs: number;

  constructor(config: SendGridDriverConfig) {
    this.apiKey = config.apiKey;
    this.defaultFrom = config.defaultFrom || 'sales@talnova.com';
    this.defaultFromName = config.defaultFromName || 'Talnova';
    this.sandboxMode = config.sandboxMode ?? false;
    this.maxRetries = config.maxRetries ?? 3;
    this.backoffBaseMs = config.backoffBaseMs ?? 500;
  }

  private formatRecipient(recipient: string | EmailRecipient): { email: string; name?: string } {
    if (typeof recipient === 'string') {
      return { email: recipient };
    }
    return {
      email: recipient.email,
      name: recipient.name,
    };
  }

  private normalizeRecipients(
    recipients: string | string[] | EmailRecipient | EmailRecipient[] | undefined
  ): Array<{ email: string; name?: string }> {
    if (!recipients) return [];
    if (Array.isArray(recipients)) {
      return recipients.map((r) => this.formatRecipient(r));
    }
    return [this.formatRecipient(recipients)];
  }

  /**
   * Helper for exponential sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send mail via SendGrid v3 Web API with exponential backoff on 429
   */
  async sendMail(payload: EmailSendPayload): Promise<EmailSendResult> {
    const timestamp = new Date().toISOString();

    const fromEmail = payload.from || this.defaultFrom;
    const fromName = payload.fromName || this.defaultFromName;

    const toList = this.normalizeRecipients(payload.to);
    if (toList.length === 0) {
      return {
        success: false,
        messageId: '',
        provider: 'sendgrid',
        status: 'failed',
        timestamp,
        error: 'At least one recipient ("to") must be specified',
      };
    }

    const ccList = this.normalizeRecipients(payload.cc);
    const bccList = this.normalizeRecipients(payload.bcc);

    // Personalizations
    const personalization: any = {
      to: toList,
    };
    if (ccList.length > 0) personalization.cc = ccList;
    if (bccList.length > 0) personalization.bcc = bccList;

    // Custom tracking args
    const customArgs: Record<string, string> = {
      ...(payload.tags || {}),
    };
    if (payload.campaignId) customArgs.campaignId = payload.campaignId;
    if (payload.leadId) customArgs.leadId = payload.leadId;
    if (payload.contactId) customArgs.contactId = payload.contactId;

    if (Object.keys(customArgs).length > 0) {
      personalization.custom_args = customArgs;
    }

    // Content array (text and/or html)
    const content: Array<{ type: string; value: string }> = [];
    if (payload.text) {
      content.push({ type: 'text/plain', value: payload.text });
    }
    if (payload.html) {
      content.push({ type: 'text/html', value: payload.html });
    }
    if (content.length === 0) {
      content.push({ type: 'text/plain', value: '' });
    }

    // Attachments
    const attachments = payload.attachments?.map((att) => ({
      content: Buffer.isBuffer(att.content)
        ? att.content.toString('base64')
        : typeof att.content === 'string'
        ? Buffer.from(att.content).toString('base64')
        : '',
      filename: att.filename,
      type: att.contentType || 'application/octet-stream',
      disposition: 'attachment',
      content_id: att.cid,
    }));

    const bodyData: any = {
      personalizations: [personalization],
      from: {
        email: fromEmail,
        name: fromName,
      },
      reply_to: payload.replyTo ? { email: payload.replyTo } : undefined,
      subject: payload.subject,
      content,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      headers: payload.headers,
    };

    if (this.sandboxMode) {
      bodyData.mail_settings = {
        sandbox_mode: { enable: true },
      };
    }

    // Retry loop with exponential backoff on 429 rate limit
    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(bodyData),
        });

        // 202 Accepted is standard SendGrid success
        if (response.status === 200 || response.status === 202) {
          const messageId =
            response.headers.get('x-message-id') ||
            `sg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          return {
            success: true,
            messageId,
            provider: 'sendgrid',
            status: 'sent',
            timestamp,
            rawResponse: {
              statusCode: response.status,
              headers: Object.fromEntries(response.headers.entries()),
            },
          };
        }

        // Rate limit 429: wait with exponential backoff
        if (response.status === 429 && attempt <= this.maxRetries) {
          const retryAfter = response.headers.get('retry-after');
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : this.backoffBaseMs * Math.pow(2, attempt - 1);
          await this.sleep(waitMs);
          continue;
        }

        const errorText = await response.text();
        return {
          success: false,
          messageId: '',
          provider: 'sendgrid',
          status: 'failed',
          timestamp,
          error: `SendGrid error (${response.status}): ${errorText}`,
          rawResponse: { statusCode: response.status, body: errorText },
        };
      } catch (err: any) {
        if (attempt > this.maxRetries) {
          return {
            success: false,
            messageId: '',
            provider: 'sendgrid',
            status: 'failed',
            timestamp,
            error: err.message || 'SendGrid network dispatch failure',
          };
        }
        await this.sleep(this.backoffBaseMs * Math.pow(2, attempt - 1));
      }
    }

    return {
      success: false,
      messageId: '',
      provider: 'sendgrid',
      status: 'failed',
      timestamp,
      error: 'SendGrid maximum retry attempts exceeded',
    };
  }

  /**
   * Validate API Key by querying SendGrid scopes / profile API
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const validatedAt = new Date().toISOString();

    if (!this.apiKey || !this.apiKey.startsWith('SG.')) {
      return {
        success: false,
        message: 'Invalid SendGrid API key format (must start with SG.)',
        validatedAt,
      };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/scopes', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as { scopes?: string[] };
        const hasMailSend = data.scopes?.includes('mail.send');

        return {
          success: true,
          message: hasMailSend
            ? 'SendGrid connection verified with full mail.send authority'
            : 'SendGrid API key valid, but missing mail.send scope',
          details: {
            scopesCount: data.scopes?.length || 0,
            hasMailSend,
            defaultFrom: this.defaultFrom,
            sandboxMode: this.sandboxMode,
          },
          validatedAt,
        };
      }

      const errorText = await response.text();
      return {
        success: false,
        message: `SendGrid authentication rejected (${response.status}): ${errorText}`,
        validatedAt,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `SendGrid connection test failed: ${err.message}`,
        validatedAt,
      };
    }
  }

  /**
   * Validate SendGrid Event Webhook
   */
  async validateWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: any
  ): Promise<boolean> {
    const signature =
      headers['x-twilio-email-event-webhook-signature'] ||
      headers['X-Twilio-Email-Event-Webhook-Signature'];

    if (signature) {
      return true;
    }

    // Check if body is an array of SendGrid event objects
    return Array.isArray(body) && body.length > 0 && typeof body[0]?.event === 'string';
  }
}
