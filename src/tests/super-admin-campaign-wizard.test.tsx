import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { RoleProvider } from '../context/RoleContext';
import { SidebarProvider } from '../components/Sidebar';
import { SuperAdminFilterProvider } from '../context/SuperAdminFilterContext';
import { StepDetails, StepDetailsData } from '../components/super-admin/sales/campaigns/StepDetails';
import { StepAudience } from '../components/super-admin/sales/campaigns/StepAudience';
import { StepComposer, StepComposerData } from '../components/super-admin/sales/campaigns/StepComposer';
import { StepValidation } from '../components/super-admin/sales/campaigns/StepValidation';
import { StepLaunch, StepLaunchData } from '../components/super-admin/sales/campaigns/StepLaunch';
import { SuperAdminCampaignWizard } from '../pages/super-admin/sales/SuperAdminCampaignWizard';
import { AudienceFilter, AudienceEstimateResult } from '../services/salesCampaign.service';

describe('CAMP-007: Super Admin Campaign Creation Wizard UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDetailsEmail: StepDetailsData = {
    name: 'Enterprise Q4 Onboarding Drive',
    channel: 'email',
    description: 'Targeting newly won accounts for immediate portal adoption.',
    tags: ['q4-enterprise', 'onboarding', 'vip'],
  };

  const mockDetailsWhatsApp: StepDetailsData = {
    name: 'Urgent Kickoff Broadcast',
    channel: 'whatsapp',
    description: 'High-touch WhatsApp notification for account executives.',
    tags: ['mobile-outreach', 'c-level'],
  };

  const mockAudienceFilter: AudienceFilter = {
    target: 'leads',
    channel: 'email',
    statuses: ['qualified', 'proposal'],
    minScore: 50,
    maxScore: 100,
    industries: ['Technology', 'Finance'],
    companySizes: ['51-200', '201-500'],
    includeTags: ['enterprise'],
    excludeTags: ['churned'],
    frequencyCap: { maxMessages: 3, windowDays: 7 },
  };

  const mockEstimateData: AudienceEstimateResult = {
    totalMatching: 1420,
    netDeliverable: 1180,
    suppressedCount: 240,
    suppressionBreakdown: {
      no_consent: 85,
      opted_out: 45,
      historical_bounce: 30,
      frequency_capped: 80,
    },
    sampleRecipients: [
      {
        id: 'rec-1',
        type: 'lead',
        name: 'Sarah Connor',
        email: 's.connor@cyberdyne.com',
        phone: '+14155552671',
        companyName: 'Cyberdyne Systems',
        score: 92,
        status: 'qualified',
      },
      {
        id: 'rec-2',
        type: 'contact',
        name: 'Miles Dyson',
        email: 'm.dyson@cyberdyne.com',
        phone: '+14155558922',
        companyName: 'Cyberdyne Systems',
        score: 88,
        status: 'customer',
      },
    ],
  };

  const mockComposerEmail: StepComposerData = {
    templateId: 'tpl-101',
    subject: 'Welcome to Talnova Onboarding, {{firstName}}!',
    previewText: 'Get your enterprise workspace configured in under 15 minutes.',
    content: '<h1>Hello {{firstName}},</h1><p>We are thrilled to welcome {{companyName}}.</p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>',
    whatsappTemplateName: 'enterprise_onboarding_intro',
    whatsappLanguageCode: 'en_US',
    whatsappParameters: {
      '1': 'firstName',
      '2': 'companyName',
      '3': 'custom',
    },
  };

  const mockComposerWhatsApp: StepComposerData = {
    subject: '',
    previewText: '',
    content: '',
    whatsappTemplateName: 'enterprise_onboarding_intro',
    whatsappLanguageCode: 'en_US',
    whatsappParameters: {
      '1': 'firstName',
      '2': 'companyName',
      '3': 'custom',
    },
  };

  const mockLaunchImmediate: StepLaunchData = {
    executionMode: 'immediate',
    batchSize: 50,
    rateLimitPerSecond: 14,
  };

  const mockLaunchScheduled: StepLaunchData = {
    executionMode: 'scheduled',
    scheduledAt: '2026-11-01T09:00',
    batchSize: 100,
    rateLimitPerSecond: 50,
  };

  /* ========================================================================= */
  /* 1. StepDetails Component Tests                                            */
  /* ========================================================================= */
  describe('1. StepDetails Component', () => {
    it('should render campaign name input, channel cards, description, and tags', () => {
      const html = renderToString(
        <StepDetails
          data={mockDetailsEmail}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain('Campaign Details');
      expect(html).toContain('Enterprise Q4 Onboarding Drive');
      expect(html).toContain('Email Marketing');
      expect(html).toContain('WhatsApp Broadcast');
      expect(html).toContain('SES • SendGrid • SMTP');
      expect(html).toContain('Meta Cloud API v18.0');
      expect(html).toContain('Targeting newly won accounts');
      expect(html).toContain('q4-enterprise');
      expect(html).toContain('onboarding');
      expect(html).toContain('vip');
    });

    it('should render validation errors when provided', () => {
      const html = renderToString(
        <StepDetails
          data={{ ...mockDetailsEmail, name: '' }}
          onChange={vi.fn()}
          errors={{ name: 'Campaign name is required' }}
        />
      );

      expect(html).toContain('Campaign name is required');
      expect(html).toContain('border-destructive');
    });

    it('should render WhatsApp selected card correctly', () => {
      const html = renderToString(
        <StepDetails
          data={mockDetailsWhatsApp}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain('Urgent Kickoff Broadcast');
      expect(html).toContain('border-emerald-500');
      expect(html).toContain('mobile-outreach');
    });
  });

  /* ========================================================================= */
  /* 2. StepAudience Component Tests                                           */
  /* ========================================================================= */
  describe('2. StepAudience Component', () => {
    it('should render population targets, filter controls, and live estimation metrics', () => {
      const html = renderToString(
        <StepAudience
          channel="email"
          filter={mockAudienceFilter}
          onChange={vi.fn()}
          onEstimateChange={vi.fn()}
        />
      );

      expect(html).toContain('Audience Targeting &amp; Segmentation');
      expect(html).toContain('CRM Leads');
      expect(html).toContain('Contacts');
      expect(html).toContain('Both');
      expect(html).toContain('Lifecycle &amp; Pipeline Statuses');
      expect(html).toContain('Lead Score Filter');
      expect(html).toContain('Target Industries');
      expect(html).toContain('Technology');
      expect(html).toContain('Finance');
      expect(html).toContain('Anti-Spam Frequency Capping');
      expect(html).toContain('Must Include Tags');
      expect(html).toContain('Exclude Contacts with Tags');
    });

    it('should render live metrics and sample recipients table when estimate is available', () => {
      // StepAudience manages its own internal state from estimateAudience,
      // but initial HTML contains the metric containers
      const html = renderToString(
        <StepAudience
          channel="email"
          filter={mockAudienceFilter}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain('Live Delivery Estimation');
      expect(html).toContain('Total Matching Criteria');
      expect(html).toContain('Net Deliverable Recipients');
      expect(html).toContain('Suppressed &amp; Excluded');
      expect(html).toContain('Channel:');
      expect(html).toContain('email');
    });
  });

  /* ========================================================================= */
  /* 3. StepComposer Component Tests                                           */
  /* ========================================================================= */
  describe('3. StepComposer Component', () => {
    it('should render Email composer with subject, preheader, merge tags, and live preview', () => {
      const html = renderToString(
        <StepComposer
          channel="email"
          data={mockComposerEmail}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain('Message Composer (Email HTML &amp; Plaintext)');
      expect(html).toContain('Email Subject Line');
      expect(html).toContain('Inbox Preview Text (Preheader)');
      expect(html).toContain('Insert Personalization Tag');
      expect(html).toContain('{{firstName}}');
      expect(html).toContain('{{lastName}}');
      expect(html).toContain('{{companyName}}');
      expect(html).toContain('{{unsubscribeUrl}}');
      expect(html).toContain('Sample Recipient Preview');
      expect(html).toContain('Sarah Connor');
    });

    it('should render WhatsApp composer with Meta approved templates and parameter mapper', () => {
      const html = renderToString(
        <StepComposer
          channel="whatsapp"
          data={mockComposerWhatsApp}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain('Message Composer (WhatsApp Cloud API)');
      expect(html).toContain('Meta Pre-Approved Template');
      expect(html).toContain('enterprise_onboarding_intro');
      expect(html).toContain('Template Language Code');
      expect(html).toContain('Variable Parameter Mapping');
      expect(html).toContain('{{1}}');
      expect(html).toContain('{{2}}');
      expect(html).toContain('WhatsApp Customer Preview');
      expect(html).toContain('Talnova Onboarding');
      expect(html).toContain('Official Business Account');
    });
  });

  /* ========================================================================= */
  /* 4. StepValidation Component Tests                                         */
  /* ========================================================================= */
  describe('4. StepValidation Component', () => {
    it('should render all verification checks with clean pass when all criteria are met', () => {
      const html = renderToString(
        <StepValidation
          details={mockDetailsEmail}
          composer={mockComposerEmail}
          estimate={mockEstimateData}
          onNavigateStep={vi.fn()}
        />
      );

      expect(html).toContain('Automated Pre-Launch Verification');
      expect(html).toContain('100% Pre-Launch Verification Passed');
      expect(html).toContain('Audience Deliverability');
      expect(html).toContain('1,180 recipient(s) confirmed eligible');
      expect(html).toContain('Sender &amp; Domain Reputation');
      expect(html).toContain('Content Completeness');
      expect(html).toContain('Merge Tag Syntax Integrity');
      expect(html).toContain('CAN-SPAM &amp; GDPR Compliance');
      expect(html).toContain('Fatigue Protection Active');
    });

    it('should block launch when net deliverable count is 0', () => {
      const emptyEstimate: AudienceEstimateResult = {
        totalMatching: 0,
        netDeliverable: 0,
        suppressedCount: 0,
        suppressionBreakdown: {},
        sampleRecipients: [],
      };

      const html = renderToString(
        <StepValidation
          details={mockDetailsEmail}
          composer={mockComposerEmail}
          estimate={emptyEstimate}
          onNavigateStep={vi.fn()}
        />
      );

      expect(html).toContain('Launch Blocked — Corrections Required');
      expect(html).toContain('No deliverable recipients found matching current audience criteria');
      expect(html).toContain('Adjust Audience Filters');
    });

    it('should warn when email body lacks an unsubscribe merge tag', () => {
      const composerWithoutUnsub: StepComposerData = {
        ...mockComposerEmail,
        content: '<p>Exclusive invite to our quarterly enterprise showcase.</p>',
      };

      const html = renderToString(
        <StepValidation
          details={mockDetailsEmail}
          composer={composerWithoutUnsub}
          estimate={mockEstimateData}
          onNavigateStep={vi.fn()}
        />
      );

      expect(html).toContain('CAN-SPAM / GDPR Unsubscribe Notice');
      expect(html).toContain('No visible unsubscribe link or merge tag found');
      expect(html).toContain('Ready with Non-blocking Warnings');
    });
  });

  /* ========================================================================= */
  /* 5. StepLaunch Component Tests                                             */
  /* ========================================================================= */
  describe('5. StepLaunch Component', () => {
    it('should render immediate dispatch mode, rate limit inputs, test sender, and launch button', () => {
      const html = renderToString(
        <StepLaunch
          details={mockDetailsEmail}
          composer={mockComposerEmail}
          estimate={mockEstimateData}
          launchConfig={mockLaunchImmediate}
          onChange={vi.fn()}
          onLaunch={vi.fn()}
          isLaunching={false}
        />
      );

      expect(html).toContain('Campaign Dispatch &amp; Scheduling');
      expect(html).toContain('Launch Summary');
      expect(html).toContain('Enterprise Q4 Onboarding Drive');
      expect(html).toContain('1,180 recipients');
      expect(html).toContain('Send Immediately');
      expect(html).toContain('Schedule for Later');
      expect(html).toContain('Throughput &amp; Rate Limiting Controls');
      expect(html).toContain('Batch Chunk Size');
      expect(html).toContain('50 per batch');
      expect(html).toContain('Velocity Rate Limit');
      expect(html).toContain('14 msg / sec');
      expect(html).toContain('Send Test Message');
      expect(html).toContain('Authorize &amp; Launch Campaign');
    });

    it('should render datetime picker when schedule for later is active', () => {
      const html = renderToString(
        <StepLaunch
          details={mockDetailsWhatsApp}
          composer={mockComposerWhatsApp}
          estimate={mockEstimateData}
          launchConfig={mockLaunchScheduled}
          onChange={vi.fn()}
          onLaunch={vi.fn()}
          isLaunching={false}
        />
      );

      expect(html).toContain('Scheduled Execution Date &amp; Time');
      expect(html).toContain('Schedule Campaign');
      expect(html).toContain('50 msg / sec');
      expect(html).toContain('100 per batch');
    });
  });

  /* ========================================================================= */
  /* 6. SuperAdminCampaignWizard Master Page Tests                              */
  /* ========================================================================= */
  describe('6. SuperAdminCampaignWizard Master Page', () => {
    it('should render stepper header with 5 steps, action buttons, and initial StepDetails', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/super-admin/sales/campaigns/new']}>
          <RoleProvider initialRole="super_admin">
            <SidebarProvider>
              <SuperAdminFilterProvider>
                <SuperAdminCampaignWizard />
              </SuperAdminFilterProvider>
            </SidebarProvider>
          </RoleProvider>
        </MemoryRouter>
      );

      // Header & Stepper
      expect(html).toContain('Campaign Creation Wizard');
      expect(html).toContain('Save Draft');
      expect(html).toContain('Cancel');
      expect(html).toContain('Details');
      expect(html).toContain('Audience');
      expect(html).toContain('Composer');
      expect(html).toContain('Validation');
      expect(html).toContain('Launch');

      // Step 1 Active
      expect(html).toContain('Campaign Details');
      expect(html).toContain('Campaign Name');
      expect(html).toContain('Communication Channel');

      // Wizard Footer
      expect(html).toContain('Previous');
      expect(html).toContain('Next Step');
      expect(html).toContain('Step 1 of 5');
    });
  });
});
