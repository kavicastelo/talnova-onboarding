import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { DealRiskAlertsWidget } from '../components/super-admin/sales/ai/DealRiskAlertsWidget';
import { LeadRecommendationsWidget } from '../components/super-admin/sales/ai/LeadRecommendationsWidget';
import { SalesAiChatDrawer } from '../components/super-admin/sales/ai/SalesAiChatDrawer';
import { AISalesCommandCenter } from '../components/super-admin/sales/ai/AISalesCommandCenter';
import { SalesAiIntelligencePage } from '../pages/super-admin/sales/SalesAiIntelligencePage';
import {
  DealRiskOverviewItem,
  LeadRecommendationItem,
  AIInsightItem,
  salesAiService,
} from '../services/salesAi.service';

describe('AI-004: Super Admin AI Sales Intelligence Dashboard & Chat UI Suite', () => {
  const mockDeals: DealRiskOverviewItem[] = [
    {
      _id: 'deal-risk-1',
      name: 'OmniCorp Global ERP Overhaul',
      value: 120000,
      currency: 'USD',
      stage: 'negotiation',
      healthScore: 35,
      riskFlags: ['Budget authority stalled', 'Competitor offering discount', 'Decision maker unverified'],
      daysInCurrentStage: 22,
      latestInsight: {
        summary: 'Deal stalled in negotiation due to C-suite budget freeze.',
        detectedObjections: ['Pricing scrutiny', 'Vendor consolidation'],
        rescuePlaybook: {
          targetStakeholder: 'Chief Technology Officer',
          recommendedStrategy: 'Schedule executive alignment session focused on 30-day ROI.',
          talkingPoints: [
            'Highlight pre-built migration accelerators.',
            'Demonstrate lower total cost of ownership over 24 months.',
          ],
          fallbackOffer: 'Offer complimentary enterprise onboarding pilot.',
        },
      },
    },
    {
      _id: 'deal-risk-2',
      name: 'Stark Logistics Platform Tier 1',
      value: 65000,
      currency: 'USD',
      stage: 'proposal',
      healthScore: 52,
      riskFlags: ['Procurement approval pending'],
      daysInCurrentStage: 16,
      latestInsight: {
        summary: 'Pending security review and compliance certification.',
        detectedObjections: ['Security compliance sign-off'],
        rescuePlaybook: {
          targetStakeholder: 'CISO / Head of Security',
          recommendedStrategy: 'Provide SOC2 and ISO compliance documentation directly to InfoSec team.',
          talkingPoints: ['Highlight end-to-end encryption standards.'],
          fallbackOffer: 'Sign custom data processing addendum.',
        },
      },
    },
  ];

  const mockLeads: LeadRecommendationItem[] = [
    {
      _id: 'lead-rec-1',
      name: 'Dr. Evelyn Reed',
      companyName: 'Apex Health Systems',
      email: 'evelyn.reed@apexhealth.test',
      phone: '+1 555-0199',
      score: 92,
      priority: 'urgent',
      status: 'qualified',
      intentBadge: 'Hot Intent',
      recommendedAction: 'Schedule Executive Demo with Chief Medical Officer',
      latestInsight: {
        title: 'High-Velocity Conversion Signal',
        summary: 'Lead visited enterprise pricing page 4 times in the past 48 hours.',
        confidence: 0.94,
      },
    },
    {
      _id: 'lead-rec-2',
      name: 'Marcus Vance',
      companyName: 'Nexus FinTech Labs',
      email: 'm.vance@nexusfin.test',
      score: 74,
      priority: 'high',
      status: 'engaged',
      intentBadge: 'High Engagement',
      recommendedAction: 'Send Custom Financial Security Whitepaper',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. DealRiskAlertsWidget', () => {
    it('renders widget header and alert counter badge', () => {
      const html = renderToString(
        <MemoryRouter>
          <DealRiskAlertsWidget deals={mockDeals} />
        </MemoryRouter>
      );

      expect(html).toContain('id="deal-risk-alerts-widget"');
      expect(html).toContain('Deal Risk Alerts &amp; Playbooks');
      expect(html).toContain('2 Alert');
    });

    it('renders deal cards with health scores, risk badges, and objection chips', () => {
      const html = renderToString(
        <MemoryRouter>
          <DealRiskAlertsWidget deals={mockDeals} />
        </MemoryRouter>
      );

      expect(html).toContain('OmniCorp Global ERP Overhaul');
      expect(html).toContain('$120,000 USD');
      expect(html).toContain('22 days in stage');
      expect(html).toContain('Critical Risk');
      expect(html).toContain('35/100');
      expect(html).toContain('Pricing scrutiny');

      // Second deal
      expect(html).toContain('Stark Logistics Platform Tier 1');
      expect(html).toContain('High Risk');
      expect(html).toContain('52/100');
    });

    it('renders 1-click View Playbook trigger button with proper accessible label', () => {
      const html = renderToString(
        <MemoryRouter>
          <DealRiskAlertsWidget deals={mockDeals} />
        </MemoryRouter>
      );

      expect(html).toContain('aria-label="View playbook for OmniCorp Global ERP Overhaul"');
      expect(html).toContain('View Playbook');
    });

    it('renders empty state when zero high risk deals exist', () => {
      const html = renderToString(
        <MemoryRouter>
          <DealRiskAlertsWidget deals={[]} />
        </MemoryRouter>
      );

      expect(html).toContain('Zero Critical Deal Risks');
      expect(html).toContain('All active deals are progressing within expected stage velocity thresholds.');
    });
  });

  describe('2. LeadRecommendationsWidget', () => {
    it('renders widget header and ready counter badge', () => {
      const html = renderToString(
        <MemoryRouter>
          <LeadRecommendationsWidget leads={mockLeads} />
        </MemoryRouter>
      );

      expect(html).toContain('id="lead-recommendations-widget"');
      expect(html).toContain('High-Intent Lead Conversion Queue');
      expect(html).toContain('2 Ready');
    });

    it('renders high-intent leads with scores, company name, and intent badges', () => {
      const html = renderToString(
        <MemoryRouter>
          <LeadRecommendationsWidget leads={mockLeads} />
        </MemoryRouter>
      );

      expect(html).toContain('Dr. Evelyn Reed');
      expect(html).toContain('Apex Health Systems');
      expect(html).toContain('Hot Intent');
      expect(html).toContain('92 / 100');
      expect(html).toContain('evelyn.reed@apexhealth.test');

      // Second lead
      expect(html).toContain('Marcus Vance');
      expect(html).toContain('Nexus FinTech Labs');
      expect(html).toContain('High Engagement');
      expect(html).toContain('74 / 100');
    });

    it('renders AI-suggested next actions and quick-action buttons', () => {
      const html = renderToString(
        <MemoryRouter>
          <LeadRecommendationsWidget leads={mockLeads} />
        </MemoryRouter>
      );

      expect(html).toContain('Recommended Action:');
      expect(html).toContain('Schedule Executive Demo with Chief Medical Officer');
      expect(html).toContain('Schedule Call');
      expect(html).toContain('Send Follow-up');
    });

    it('renders empty state when no high-intent leads are queued', () => {
      const html = renderToString(
        <MemoryRouter>
          <LeadRecommendationsWidget leads={[]} />
        </MemoryRouter>
      );

      expect(html).toContain('No High-Intent Leads Currently Flagged');
      expect(html).toContain('New inbound and engaged leads will appear here');
    });
  });

  describe('3. SalesAiChatDrawer', () => {
    it('does not render drawer when isOpen is false', () => {
      const html = renderToString(
        <SalesAiChatDrawer isOpen={false} onClose={() => {}} isAiConfigured={true} />
      );

      expect(html).toBe('');
    });

    it('renders drawer with CRM grounding badge and greeting when open', () => {
      const html = renderToString(
        <SalesAiChatDrawer isOpen={true} onClose={() => {}} isAiConfigured={true} />
      );

      expect(html).toContain('id="sales-ai-chat-drawer"');
      expect(html).toContain('Sales Data AI Assistant');
      expect(html).toContain('Live CRM');
      expect(html).toContain('Grounded on real-time deals &amp; pipeline data');
      expect(html).toContain('Hello! I am your AI Sales Intelligence Co-Pilot');
    });

    it('renders default suggested sales inquiries prompt chips', () => {
      const html = renderToString(
        <SalesAiChatDrawer isOpen={true} onClose={() => {}} isAiConfigured={true} />
      );

      expect(html).toContain('Suggested Sales Inquiries');
      expect(html).toContain('Which deals haven&#x27;t progressed this month?');
      expect(html).toContain('Summarize leads from healthcare industry');
      expect(html).toContain('What is our current at-risk pipeline value?');
    });

    it('renders chat input and send button with accessible attributes', () => {
      const html = renderToString(
        <SalesAiChatDrawer isOpen={true} onClose={() => {}} isAiConfigured={true} />
      );

      expect(html).toContain('id="sales-ai-chat-input"');
      expect(html).toContain('id="sales-ai-chat-submit"');
      expect(html).toContain('aria-label="Send query"');
      expect(html).toContain('aria-label="Close assistant drawer"');
    });

    it('displays offline note when isAiConfigured is false', () => {
      const html = renderToString(
        <SalesAiChatDrawer isOpen={true} onClose={() => {}} isAiConfigured={false} />
      );

      expect(html).toContain('AI Provider credentials are offline');
    });
  });

  describe('4. AISalesCommandCenter', () => {
    it('renders command center container with co-pilot header and chat launcher button', () => {
      const html = renderToString(
        <MemoryRouter>
          <AISalesCommandCenter />
        </MemoryRouter>
      );

      expect(html).toContain('id="ai-sales-command-center"');
      expect(html).toContain('AI Intelligence Co-Pilot');
      expect(html).toContain('id="open-sales-ai-chat-btn"');
      expect(html).toContain('Chat with Sales Data');
      expect(html).toContain('Refresh Intelligence');
    });

    it('renders top KPI cards and recent insights table structure', () => {
      const html = renderToString(
        <MemoryRouter>
          <AISalesCommandCenter />
        </MemoryRouter>
      );

      expect(html).toContain('At-Risk Pipeline');
      expect(html).toContain('High Risk Deals');
      expect(html).toContain('High-Intent Leads');
      expect(html).toContain('Pending AI Insights');
      expect(html).toContain('Recent Executive AI Insights');
    });

    it('renders offline warning banner with direct CTA button when AI is unconfigured', () => {
      // Default state in initial render before fetch fulfills or when unconfigured
      const html = renderToString(
        <MemoryRouter>
          <AISalesCommandCenter />
        </MemoryRouter>
      );

      expect(html).toContain('id="ai-offline-banner"');
      expect(html).toContain('AI Intelligence Offline');
      expect(html).toContain('id="configure-sales-integrations-btn"');
      expect(html).toContain('Configure Sales Integrations');
    });
  });

  describe('5. SalesAiIntelligencePage', () => {
    it('renders page layout with breadcrumbs and navigation shortcuts', () => {
      const html = renderToString(
        <MemoryRouter>
          <SalesAiIntelligencePage />
        </MemoryRouter>
      );

      expect(html).toContain('id="sales-ai-intelligence-page"');
      expect(html).toContain('Platform Control');
      expect(html).toContain('Sales &amp; Acquisition');
      expect(html).toContain('AI Intelligence');
      expect(html).toContain('AI Sales Intelligence Command Center');
      expect(html).toContain('Deals Pipeline');
      expect(html).toContain('Unified Inbox');
      expect(html).toContain('id="ai-sales-command-center"');
    });
  });
});
