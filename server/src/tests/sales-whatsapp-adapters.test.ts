import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import {
  MockWhatsAppDriver,
  MetaCloudWhatsAppDriver,
  TwilioWhatsAppDriver,
  WhatsAppProviderFactory,
  WhatsAppTemplateSendPayload,
  normalizeToE164,
} from '../modules/sales/integrations/whatsapp/index.js';

describe('CAMP-002: WhatsApp Cloud API Adapters (Meta, Twilio, Mock)', () => {
  beforeEach(() => {
    MockWhatsAppDriver.clearSentMessages();
    WhatsAppProviderFactory.clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Phone Number E.164 Normalizer', () => {
    it('should normalize international numbers with various formatting', () => {
      expect(normalizeToE164('+14155552671')).toBe('+14155552671');
      expect(normalizeToE164('+1 (415) 555-2671')).toBe('+14155552671');
      expect(normalizeToE164('14155552671')).toBe('+14155552671');
      expect(normalizeToE164('00447911123456')).toBe('+447911123456');
      expect(normalizeToE164('+91 98765-43210')).toBe('+919876543210');
    });

    it('should throw error on invalid phone numbers', () => {
      expect(() => normalizeToE164('')).toThrow();
      expect(() => normalizeToE164('123')).toThrow(/Invalid phone number/);
      expect(() => normalizeToE164('invalid-phone')).toThrow(/Invalid phone number/);
      expect(() => normalizeToE164('+0123456789')).toThrow(/Invalid phone number/);
    });
  });

  describe('2. MockWhatsAppDriver', () => {
    it('should dispatch pre-approved template message and record it in buffer', async () => {
      const driver = new MockWhatsAppDriver();

      const payload: WhatsAppTemplateSendPayload = {
        to: '+1 (415) 555-0199',
        templateName: 'welcome_onboarding',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: 'Acme Enterprise' }],
          },
        ],
        campaignId: 'camp-wa-1',
      };

      const result = await driver.sendTemplateMessage(payload);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('mock');
      expect(result.recipient).toBe('+14155550199');
      expect(result.messageId).toContain('wamid.mock_');
      expect(result.status).toBe('sent');

      const sent = MockWhatsAppDriver.getSentMessages();
      expect(sent).toHaveLength(1);
      expect(sent[0].payload.templateName).toBe('welcome_onboarding');
      expect(sent[0].payload.to).toBe('+14155550199');
    });

    it('should reject unapproved templates with error', async () => {
      const driver = new MockWhatsAppDriver();

      const result = await driver.sendTemplateMessage({
        to: '+14155550199',
        templateName: 'unregistered_custom_promo_xyz',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('not pre-approved');
    });

    it('should reject invalid phone numbers', async () => {
      const driver = new MockWhatsAppDriver();

      const result = await driver.sendTemplateMessage({
        to: 'not-a-number',
        templateName: 'welcome_onboarding',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number');
    });

    it('should support session text messages and return synced templates', async () => {
      const driver = new MockWhatsAppDriver();

      const textResult = await driver.sendTextMessage('+14155550199', 'Hello from sales agent');
      expect(textResult.success).toBe(true);
      expect(textResult.status).toBe('sent');

      const templates = await driver.syncApprovedTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.map((t) => t.name)).toContain('welcome_onboarding');
    });

    it('should test connection successfully and validate webhooks', async () => {
      const driver = new MockWhatsAppDriver();

      const testRes = await driver.testConnection();
      expect(testRes.success).toBe(true);
      expect(testRes.message).toContain('Mock WhatsApp Cloud');

      const isHookValid = driver.validateWebhook('', { object: 'whatsapp_business_account' });
      expect(isHookValid).toBe(true);
    });

    it('should simulate failure and rate limit states', async () => {
      const driver = new MockWhatsAppDriver();

      driver.simulateNextSendFailure('Meta API Gateway Timeout');
      const failRes = await driver.sendTemplateMessage({
        to: '+14155550199',
        templateName: 'welcome_onboarding',
      });
      expect(failRes.success).toBe(false);
      expect(failRes.error).toBe('Meta API Gateway Timeout');

      driver.setRateLimitRemaining(0);
      const rateLimitRes = await driver.sendTemplateMessage({
        to: '+14155550199',
        templateName: 'welcome_onboarding',
      });
      expect(rateLimitRes.success).toBe(false);
      expect(rateLimitRes.error).toContain('rate limit exceeded');
    });
  });

  describe('3. MetaCloudWhatsAppDriver', () => {
    it('should dispatch template message via Meta Graph API v18.0 endpoint', async () => {
      const driver = new MetaCloudWhatsAppDriver({
        accessToken: 'EAAB_TEST_TOKEN',
        phoneNumberId: '10987654321',
        wabaId: 'WABA_123',
        apiVersion: 'v18.0',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: '14155552671', wa_id: '14155552671' }],
          messages: [{ id: 'wamid.HBgLMTA5ODc2NTQzMjEF' }],
        }),
      } as any);

      const payload: WhatsAppTemplateSendPayload = {
        to: '+1 (415) 555-2671',
        templateName: 'welcome_onboarding',
        languageCode: 'en_US',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: 'Acme Corp' }],
          },
        ],
      };

      const result = await driver.sendTemplateMessage(payload);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/10987654321/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer EAAB_TEST_TOKEN',
          }),
          body: expect.stringContaining('"to":"14155552671"'),
        })
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('meta_whatsapp');
      expect(result.messageId).toBe('wamid.HBgLMTA5ODc2NTQzMjEF');
      expect(result.recipient).toBe('+14155552671');
    });

    it('should retry on Meta 429 rate limit with exponential backoff', async () => {
      const driver = new MetaCloudWhatsAppDriver({
        accessToken: 'EAAB_TOKEN',
        phoneNumberId: '10987654321',
        maxRetries: 2,
        backoffBaseMs: 10,
      });

      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            status: 429,
            ok: false,
            json: async () => ({
              error: { message: 'Rate limit hit', code: 130429 },
            }),
          } as any;
        }
        return {
          status: 200,
          ok: true,
          json: async () => ({
            messages: [{ id: 'wamid.retried_success' }],
          }),
        } as any;
      });

      const result = await driver.sendTemplateMessage({
        to: '+14155552671',
        templateName: 'demo_followup',
      });

      expect(callCount).toBe(2);
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.retried_success');
    });

    it('should test connection against Meta Phone Number endpoint', async () => {
      const driver = new MetaCloudWhatsAppDriver({
        accessToken: 'EAAB_VALID',
        phoneNumberId: '10987654321',
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: '10987654321',
          display_phone_number: '+1 555-0199',
          verified_name: 'Talnova Enterprise',
          quality_rating: 'GREEN',
        }),
      } as any);

      const testRes = await driver.testConnection();

      expect(testRes.success).toBe(true);
      expect(testRes.message).toContain('+1 555-0199');
      expect(testRes.details?.qualityRating).toBe('GREEN');
    });

    it('should validate X-Hub-Signature-256 with appSecret', () => {
      const appSecret = 'secret_meta_app_key_123';
      const driver = new MetaCloudWhatsAppDriver({
        accessToken: 'EAAB_TEST',
        phoneNumberId: '10987654321',
        appSecret,
      });

      const rawPayload = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{ id: '123' }],
      });

      const hash = crypto.createHmac('sha256', appSecret).update(rawPayload).digest('hex');
      const signature = `sha256=${hash}`;

      expect(driver.validateWebhook(signature, rawPayload)).toBe(true);
      expect(driver.validateWebhook('sha256=invalid_tampered_hash', rawPayload)).toBe(false);
    });

    it('should sync approved templates from WABA ID', async () => {
      const driver = new MetaCloudWhatsAppDriver({
        accessToken: 'EAAB_VALID',
        phoneNumberId: '10987654321',
        wabaId: 'WABA_ACCOUNT_888',
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              name: 'enterprise_onboarding_welcome',
              language: 'en_US',
              status: 'APPROVED',
              category: 'UTILITY',
            },
          ],
        }),
      } as any);

      const templates = await driver.syncApprovedTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('enterprise_onboarding_welcome');
    });
  });

  describe('4. TwilioWhatsAppDriver', () => {
    it('should dispatch message with whatsapp: prefix to Twilio API', async () => {
      const driver = new TwilioWhatsAppDriver({
        accountSid: 'AC_TEST_ACCOUNT_SID',
        authToken: 'AUTH_TOKEN_TEST',
        fromPhoneNumber: '+14155238886',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          sid: 'SM1234567890abcdef',
          status: 'queued',
          to: 'whatsapp:+14155552671',
          from: 'whatsapp:+14155238886',
        }),
      } as any);

      const payload: WhatsAppTemplateSendPayload = {
        to: '+1 (415) 555-2671',
        templateName: 'demo_followup',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: 'Thank you for attending!' }],
          },
        ],
      };

      const result = await driver.sendTemplateMessage(payload);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/AC_TEST_ACCOUNT_SID/Messages.json',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic '),
          }),
          body: expect.stringContaining('To=whatsapp%3A%2B14155552671'),
        })
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('twilio_whatsapp');
      expect(result.messageId).toBe('SM1234567890abcdef');
      expect(result.recipient).toBe('+14155552671');
    });

    it('should test connection against Twilio Accounts API', async () => {
      const driver = new TwilioWhatsAppDriver({
        accountSid: 'AC_VALID',
        authToken: 'AUTH_VALID',
        fromPhoneNumber: '+14155238886',
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          sid: 'AC_VALID',
          friendly_name: 'Talnova Communications',
          status: 'active',
          type: 'Full',
        }),
      } as any);

      const testRes = await driver.testConnection();

      expect(testRes.success).toBe(true);
      expect(testRes.message).toContain('Talnova Communications');
      expect(testRes.details?.status).toBe('active');
    });

    it('should validate Twilio webhook payload', () => {
      const driver = new TwilioWhatsAppDriver({
        accountSid: 'AC_VALID',
        authToken: 'AUTH_VALID',
        fromPhoneNumber: '+14155238886',
      });

      expect(
        driver.validateWebhook('', {
          MessageSid: 'SM999',
          AccountSid: 'AC_VALID',
          From: 'whatsapp:+14155552671',
        })
      ).toBe(true);
      expect(driver.validateWebhook('', null)).toBe(false);
    });
  });

  describe('5. WhatsAppProviderFactory', () => {
    it('should return MockWhatsAppDriver on mock provider request', async () => {
      const provider = await WhatsAppProviderFactory.getProvider('mock');
      expect(provider.providerName).toBe('mock');
      expect(provider).toBeInstanceOf(MockWhatsAppDriver);
    });

    it('should instantiate MetaCloudWhatsAppDriver with override configuration', async () => {
      const provider = await WhatsAppProviderFactory.getProvider('meta_whatsapp', {
        publicConfig: { phoneNumberId: '987654321', apiVersion: 'v18.0' },
        secrets: { accessToken: 'TEST_ACCESS_TOKEN' },
      });

      expect(provider.providerName).toBe('meta_whatsapp');
      expect(provider).toBeInstanceOf(MetaCloudWhatsAppDriver);
    });

    it('should instantiate TwilioWhatsAppDriver with override configuration', async () => {
      const provider = await WhatsAppProviderFactory.getProvider('twilio_whatsapp', {
        publicConfig: { fromPhoneNumber: '+14155238886' },
        secrets: { accountSid: 'AC_TEST', authToken: 'AUTH_TEST' },
      });

      expect(provider.providerName).toBe('twilio_whatsapp');
      expect(provider).toBeInstanceOf(TwilioWhatsAppDriver);
    });

    it('should reuse cached instance across matching requests', async () => {
      const p1 = await WhatsAppProviderFactory.getProvider('mock');
      const p2 = await WhatsAppProviderFactory.getProvider('mock');
      expect(p1).toBe(p2);
    });

    it('should fallback safely to MockWhatsAppDriver on getActiveProvider when disconnected', async () => {
      const active = await WhatsAppProviderFactory.getActiveProvider();
      expect(active).toBeDefined();
      expect(active.providerName).toBe('mock');
    });
  });
});
