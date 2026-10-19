import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockEmailDriver,
  SmtpEmailDriver,
  SendGridEmailDriver,
  SesEmailDriver,
  EmailProviderFactory,
  EmailSendPayload,
} from '../modules/sales/integrations/email/index.js';

describe('CAMP-001: Email Provider Adapters (SES, SendGrid, SMTP, Mock)', () => {
  beforeEach(() => {
    MockEmailDriver.clearSentEmails();
    EmailProviderFactory.clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. MockEmailDriver', () => {
    it('should dispatch emails and record them in buffer without external calls', async () => {
      const driver = new MockEmailDriver({
        defaultFrom: 'campaigns@talnova.com',
        defaultFromName: 'Talnova Campaigns',
      });

      const payload: EmailSendPayload = {
        to: 'lead@acme.com',
        subject: 'Welcome to Talnova',
        html: '<p>Hello Acme team</p>',
        campaignId: 'camp-101',
      };

      const result = await driver.sendMail(payload);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('mock');
      expect(result.status).toBe('sent');
      expect(result.messageId).toContain('mock-');

      const sent = MockEmailDriver.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0].payload.to).toBe('lead@acme.com');
      expect(sent[0].payload.campaignId).toBe('camp-101');
    });

    it('should test connection successfully', async () => {
      const driver = new MockEmailDriver();
      const testResult = await driver.testConnection();

      expect(testResult.success).toBe(true);
      expect(testResult.message).toContain('Mock email provider');
      expect(testResult.validatedAt).toBeDefined();
    });

    it('should simulate failure and rate limits when instructed', async () => {
      const driver = new MockEmailDriver();

      // Test simulated error
      driver.simulateNextSendFailure('Provider timeout');
      const failResult = await driver.sendMail({
        to: 'test@example.com',
        subject: 'Test',
      });

      expect(failResult.success).toBe(false);
      expect(failResult.error).toBe('Provider timeout');

      // Next send should succeed
      const okResult = await driver.sendMail({
        to: 'test@example.com',
        subject: 'Test 2',
      });
      expect(okResult.success).toBe(true);

      // Test rate limit simulation
      driver.setRateLimitRemaining(0);
      const rateLimitResult = await driver.sendMail({
        to: 'test@example.com',
        subject: 'Test 3',
      });
      expect(rateLimitResult.success).toBe(false);
      expect(rateLimitResult.error).toContain('429');
    });

    it('should validate simulated webhooks', async () => {
      const driver = new MockEmailDriver();
      const isValid = await driver.validateWebhook({}, { event: 'delivered', id: '123' });
      expect(isValid).toBe(true);
    });
  });

  describe('2. SmtpEmailDriver', () => {
    it('should format recipients and send mail through transport', async () => {
      const driver = new SmtpEmailDriver({
        host: 'smtp.mailtrap.io',
        port: 2525,
        auth: {
          user: 'test-user',
          pass: 'test-pass',
        },
        defaultFrom: 'sales@talnova.com',
        defaultFromName: 'Talnova Sales',
      });

      // Mock nodemailer transporter sendMail
      const sendMailSpy = vi.spyOn((driver as any).transporter, 'sendMail').mockResolvedValue({
        messageId: '<smtp-msg-999@mailtrap.io>',
        response: '250 2.0.0 Ok',
        accepted: ['ceo@enterprise.com'],
        rejected: [],
      });

      const payload: EmailSendPayload = {
        to: [{ email: 'ceo@enterprise.com', name: 'John Doe' }],
        cc: 'cfo@enterprise.com',
        subject: 'Executive Proposal',
        html: '<p>Attached is the custom proposal.</p>',
        campaignId: 'camp-202',
        attachments: [
          {
            filename: 'proposal.pdf',
            content: 'JVBERi0xLjQK...',
            contentType: 'application/pdf',
          },
        ],
      };

      const result = await driver.sendMail(payload);

      expect(sendMailSpy).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.provider).toBe('smtp');
      expect(result.messageId).toBe('<smtp-msg-999@mailtrap.io>');
      expect(result.status).toBe('sent');
    });

    it('should handle SMTP connection test via transporter.verify', async () => {
      const driver = new SmtpEmailDriver({
        host: 'smtp.example.com',
        port: 587,
      });

      vi.spyOn((driver as any).transporter, 'verify').mockResolvedValue(true);

      const testResult = await driver.testConnection();
      expect(testResult.success).toBe(true);
      expect(testResult.message).toContain('Connected successfully to SMTP server');
    });

    it('should catch SMTP transport error and return failed result', async () => {
      const driver = new SmtpEmailDriver({
        host: 'smtp.example.com',
        port: 587,
      });

      vi.spyOn((driver as any).transporter, 'sendMail').mockRejectedValue(
        new Error('SMTP authentication failed (535 5.7.8)')
      );

      const result = await driver.sendMail({
        to: 'nobody@example.com',
        subject: 'Test Fail',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('SMTP authentication failed');
    });
  });

  describe('3. SendGridEmailDriver', () => {
    it('should format v3 payload and send via fetch with 202 Accepted', async () => {
      const driver = new SendGridEmailDriver({
        apiKey: 'SG.fake_key_1234567890',
        defaultFrom: 'marketing@talnova.com',
        defaultFromName: 'Talnova Marketing',
      });

      // Mock native global fetch
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        status: 202,
        ok: true,
        headers: new Headers({
          'x-message-id': 'sendgrid-msg-abc-123',
        }),
      } as any);

      const payload: EmailSendPayload = {
        to: 'prospect@startup.co',
        subject: 'Talnova Onboarding Demo',
        text: 'Plain text body',
        html: '<strong>HTML body</strong>',
        campaignId: 'camp-303',
        tags: { tier: 'enterprise' },
      };

      const result = await driver.sendMail(payload);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer SG.fake_key_1234567890',
          }),
        })
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('sendgrid');
      expect(result.messageId).toBe('sendgrid-msg-abc-123');
      expect(result.status).toBe('sent');
    });

    it('should handle 429 rate limiting with backoff retry', async () => {
      const driver = new SendGridEmailDriver({
        apiKey: 'SG.fake_key_rate_limit',
        maxRetries: 2,
        backoffBaseMs: 10, // Fast test backoff
      });

      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            status: 429,
            ok: false,
            headers: new Headers({ 'retry-after': '0' }),
            text: async () => 'Rate limit exceeded',
          } as any;
        }
        return {
          status: 202,
          ok: true,
          headers: new Headers({ 'x-message-id': 'sg-retried-success-id' }),
        } as any;
      });

      const result = await driver.sendMail({
        to: 'user@example.com',
        subject: 'Retry Test',
      });

      expect(callCount).toBe(2);
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('sg-retried-success-id');
    });

    it('should test connection via /v3/scopes endpoint', async () => {
      const driver = new SendGridEmailDriver({
        apiKey: 'SG.valid_token_string',
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          scopes: ['mail.send', 'templates.read', 'user.profile.read'],
        }),
      } as any);

      const testResult = await driver.testConnection();
      expect(testResult.success).toBe(true);
      expect(testResult.message).toContain('full mail.send authority');
      expect(testResult.details?.hasMailSend).toBe(true);
    });

    it('should validate SendGrid event webhooks', async () => {
      const driver = new SendGridEmailDriver({
        apiKey: 'SG.test',
      });

      const isValid = await driver.validateWebhook(
        {},
        [
          {
            email: 'user@test.com',
            event: 'open',
            timestamp: 1670000000,
          },
        ]
      );

      expect(isValid).toBe(true);
    });
  });

  describe('4. SesEmailDriver', () => {
    it('should construct SES transport and send email with configuration tags', async () => {
      const driver = new SesEmailDriver({
        region: 'us-west-2',
        accessKeyId: 'AKIA_FAKE_KEY',
        secretAccessKey: 'SECRET_FAKE_KEY',
        configurationSet: 'talnova-prod-events',
        defaultFrom: 'sales@talnova.com',
      });

      const sendMailSpy = vi.spyOn((driver as any).transporter, 'sendMail').mockResolvedValue({
        messageId: '0100018a-fake-ses-message-id@email.amazonses.com',
      });

      const payload: EmailSendPayload = {
        to: 'lead@bigcorp.com',
        subject: 'SES Direct Transmission',
        html: '<p>SES content</p>',
        campaignId: 'camp-ses-1',
      };

      const result = await driver.sendMail(payload);

      expect(sendMailSpy).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.provider).toBe('ses');
      expect(result.messageId).toBe('0100018a-fake-ses-message-id@email.amazonses.com');
    });

    it('should test connection against Amazon SES SMTP verify', async () => {
      const driver = new SesEmailDriver({
        region: 'eu-central-1',
        accessKeyId: 'AKIA_VALID_SES',
        secretAccessKey: 'SECRET_VALID_SES',
      });

      vi.spyOn((driver as any).transporter, 'verify').mockResolvedValue(true);

      const testResult = await driver.testConnection();
      expect(testResult.success).toBe(true);
      expect(testResult.message).toContain('Amazon SES (eu-central-1)');
    });

    it('should fail connection test if credentials missing', async () => {
      const driver = new SesEmailDriver({});
      const testResult = await driver.testConnection();

      expect(testResult.success).toBe(false);
      expect(testResult.message).toContain('AWS SES credentials missing');
    });

    it('should validate incoming AWS SNS/SES webhooks', async () => {
      const driver = new SesEmailDriver({});

      // SNS Notification header
      const snsValid = await driver.validateWebhook(
        { 'x-amz-sns-message-type': 'Notification' },
        { Type: 'Notification', Message: '{"eventType":"Bounce"}' }
      );
      expect(snsValid).toBe(true);

      // Direct SES Event body
      const directValid = await driver.validateWebhook(
        {},
        { eventType: 'Delivery', mail: { messageId: '123' } }
      );
      expect(directValid).toBe(true);
    });
  });

  describe('5. EmailProviderFactory', () => {
    it('should instantiate MockEmailDriver when requested or in mock mode', async () => {
      const provider = await EmailProviderFactory.getProvider('mock');
      expect(provider.providerName).toBe('mock');
      expect(provider).toBeInstanceOf(MockEmailDriver);
    });

    it('should instantiate SmtpEmailDriver with override config', async () => {
      const provider = await EmailProviderFactory.getProvider('smtp', {
        publicConfig: { host: 'mail.server.net', port: 465, secure: true },
        secrets: { user: 'smtp_user', pass: 'smtp_pass' },
      });

      expect(provider.providerName).toBe('smtp');
      expect(provider).toBeInstanceOf(SmtpEmailDriver);
    });

    it('should instantiate SendGridEmailDriver with override config', async () => {
      const provider = await EmailProviderFactory.getProvider('sendgrid', {
        publicConfig: { defaultFrom: 'notifications@talnova.com' },
        secrets: { apiKey: 'SG.test_key_factory' },
      });

      expect(provider.providerName).toBe('sendgrid');
      expect(provider).toBeInstanceOf(SendGridEmailDriver);
    });

    it('should instantiate SesEmailDriver with override config', async () => {
      const provider = await EmailProviderFactory.getProvider('ses', {
        publicConfig: { region: 'ap-southeast-1' },
        secrets: { accessKeyId: 'AKIA_FACTORY', secretAccessKey: 'SECRET_FACTORY' },
      });

      expect(provider.providerName).toBe('ses');
      expect(provider).toBeInstanceOf(SesEmailDriver);
    });

    it('should reuse cached provider instance for matching configurations', async () => {
      const p1 = await EmailProviderFactory.getProvider('mock');
      const p2 = await EmailProviderFactory.getProvider('mock');
      expect(p1).toBe(p2); // strict reference equality from cache
    });

    it('should fallback safely to MockEmailDriver when no DB active integration exists', async () => {
      const active = await EmailProviderFactory.getActiveProvider();
      expect(active).toBeDefined();
      expect(active.providerName).toBe('mock');
    });
  });
});
