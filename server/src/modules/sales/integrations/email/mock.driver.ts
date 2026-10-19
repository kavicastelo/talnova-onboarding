import {
  IEmailProvider,
  EmailSendPayload,
  EmailSendResult,
  ConnectionTestResult,
  EmailRecipient,
} from './email-provider.interface.js';

export interface MockSentEmail {
  payload: EmailSendPayload;
  result: EmailSendResult;
  sentAt: Date;
}

export class MockEmailDriver implements IEmailProvider {
  public readonly providerName = 'mock';

  private static sentEmails: MockSentEmail[] = [];
  private shouldFailNext = false;
  private failMessage = 'Simulated email provider failure';
  private rateLimitRemaining = 1000;
  private defaultFrom: string;
  private defaultFromName: string;

  constructor(config?: {
    defaultFrom?: string;
    defaultFromName?: string;
  }) {
    this.defaultFrom = config?.defaultFrom || 'sales@talnova.com';
    this.defaultFromName = config?.defaultFromName || 'Talnova Sales';
  }

  /**
   * Send mail implementation for mock driver
   */
  async sendMail(payload: EmailSendPayload): Promise<EmailSendResult> {
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      return {
        success: false,
        messageId: '',
        provider: 'mock',
        status: 'failed',
        timestamp: new Date().toISOString(),
        error: this.failMessage,
      };
    }

    if (this.rateLimitRemaining <= 0) {
      return {
        success: false,
        messageId: '',
        provider: 'mock',
        status: 'failed',
        timestamp: new Date().toISOString(),
        error: 'Rate limit exceeded: 429 Too Many Requests',
      };
    }

    this.rateLimitRemaining -= 1;

    const messageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@talnova.internal`;
    const fromAddress = payload.from || this.defaultFrom;
    const fromName = payload.fromName || this.defaultFromName;

    const result: EmailSendResult = {
      success: true,
      messageId,
      provider: 'mock',
      status: 'sent',
      timestamp: new Date().toISOString(),
      rawResponse: {
        envelope: {
          from: `${fromName} <${fromAddress}>`,
          to: Array.isArray(payload.to) ? payload.to : [payload.to],
        },
        messageId,
      },
    };

    MockEmailDriver.sentEmails.push({
      payload,
      result,
      sentAt: new Date(),
    });

    return result;
  }

  /**
   * Validate mock connection
   */
  async testConnection(): Promise<ConnectionTestResult> {
    return {
      success: true,
      message: 'Mock email provider is ready and connected for local execution.',
      details: {
        driver: 'mock',
        totalSentCount: MockEmailDriver.sentEmails.length,
        defaultFrom: this.defaultFrom,
      },
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Validate incoming webhook
   */
  async validateWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: any
  ): Promise<boolean> {
    // In mock mode, if body is provided and valid object, accept
    return !!body && typeof body === 'object';
  }

  // --- Testing & Debugging Utility Helpers ---

  public static getSentEmails(): MockSentEmail[] {
    return [...MockEmailDriver.sentEmails];
  }

  public static getLastSentEmail(): MockSentEmail | undefined {
    return MockEmailDriver.sentEmails[MockEmailDriver.sentEmails.length - 1];
  }

  public static clearSentEmails(): void {
    MockEmailDriver.sentEmails = [];
  }

  public simulateNextSendFailure(message = 'Simulated provider error'): void {
    this.shouldFailNext = true;
    this.failMessage = message;
  }

  public setRateLimitRemaining(remaining: number): void {
    this.rateLimitRemaining = remaining;
  }
}
