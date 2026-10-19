import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { RoleProvider } from '../context/RoleContext';
import { SidebarProvider } from '../components/Sidebar';
import { SuperAdminFilterProvider } from '../context/SuperAdminFilterContext';
import { CampaignFunnelChart } from '../components/super-admin/sales/campaigns/CampaignFunnelChart';
import { CampaignRecipientTable } from '../components/super-admin/sales/campaigns/CampaignRecipientTable';
import { CampaignDeliveryMonitor } from '../components/super-admin/sales/campaigns/CampaignDeliveryMonitor';
import { SuperAdminCampaigns } from '../pages/super-admin/sales/SuperAdminCampaigns';
import { CampaignItem, CampaignStats } from '../services/salesCampaign.service';

describe('CAMP-008: Campaign Delivery Monitor & Analytics UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockStatsEmail: CampaignStats = {
    totalRecipients: 1000,
    sentCount: 950,
    deliveredCount: 900,
    openedCount: 450,
    clickedCount: 180,
    bouncedCount: 50,
    repliedCount: 45,
    failedCount: 5,
  };

  const mockStatsWhatsApp: CampaignStats = {
    totalRecipients: 500,
    sentCount: 500,
    deliveredCount: 480,
    openedCount: 380,
    clickedCount: 120,
    bouncedCount: 20,
    repliedCount: 96,
    failedCount: 0,
  };

  const mockRecipients = [
    {
      _id: 'rec-1',
      recipientName: 'Alex Mercer',
      recipientEmail: 'alex.m@gentek.com',
      recipientPhone: '+14155550111',
      status: 'delivered' as const,
      sentAt: '2026-10-18T10:00:00.000Z',
      deliveredAt: '2026-10-18T10:01:00.000Z',
    },
    {
      _id: 'rec-2',
      recipientName: 'Dana Mercer',
      recipientEmail: 'dana.m@gentek.com',
      recipientPhone: '+14155550222',
      status: 'opened' as const,
      sentAt: '2026-10-18T10:00:00.000Z',
      deliveredAt: '2026-10-18T10:01:30.000Z',
    },
    {
      _id: 'rec-3',
      recipientName: 'Bradley Ragland',
      recipientEmail: 'b.ragland@blackwatch.org',
      recipientPhone: '+14155550333',
      status: 'clicked' as const,
      sentAt: '2026-10-18T10:00:00.000Z',
      deliveredAt: '2026-10-18T10:01:45.000Z',
    },
    {
      _id: 'rec-4',
      recipientName: 'Robert Cross',
      recipientEmail: 'cross@blackwatch.org',
      recipientPhone: '+14155550444',
      status: 'bounced' as const,
      sentAt: '2026-10-18T10:00:00.000Z',
      errorMessage: '550 5.1.1 User unknown / Mailbox does not exist',
    },
    {
      _id: 'rec-5',
      recipientName: 'Karen Parker',
      recipientEmail: 'karen.p@gentek.com',
      recipientPhone: '+14155550555',
      status: 'pending' as const,
    },
  ];

  const mockCampaignActive: CampaignItem = {
    _id: 'camp-101',
    name: 'Enterprise Q4 Onboarding Acceleration',
    description: 'High-touch outreach for executive buyers.',
    channel: 'email',
    status: 'sending',
    stats: mockStatsEmail,
    recipients: mockRecipients,
    tags: ['q4-enterprise', 'onboarding'],
    createdBy: 'usr-admin-1',
    createdAt: '2026-10-18T09:00:00.000Z',
    updatedAt: '2026-10-18T10:30:00.000Z',
    startedAt: '2026-10-18T10:00:00.000Z',
  };

  const mockCampaignCompletedWhatsApp: CampaignItem = {
    _id: 'camp-102',
    name: 'VIP Executive Kickoff Invite',
    description: 'WhatsApp broadcast for C-level contacts.',
    channel: 'whatsapp',
    status: 'completed',
    stats: mockStatsWhatsApp,
    recipients: mockRecipients,
    tags: ['vip', 'whatsapp'],
    createdBy: 'usr-admin-1',
    createdAt: '2026-10-17T08:00:00.000Z',
    updatedAt: '2026-10-17T11:00:00.000Z',
    startedAt: '2026-10-17T09:00:00.000Z',
    completedAt: '2026-10-17T10:30:00.000Z',
  };

  /* ========================================================================= */
  /* 1. CampaignFunnelChart Component Tests                                    */
  /* ========================================================================= */
  describe('1. CampaignFunnelChart Component', () => {
    it('should render all funnel stages with conversion metrics for Email', () => {
      const html = renderToString(
        <CampaignFunnelChart stats={mockStatsEmail} channel="email" />
      );

      expect(html).toContain('Outreach Conversion Funnel');
      expect(html).toContain('Base: 950 Sent');
      expect(html).toContain('Messages Sent');
      expect(html).toContain('Delivered');
      expect(html).toContain('Opened');
      expect(html).toContain('Link Clicks');
      expect(html).toContain('Inbound Replies');

      // Conversion rates: delivered (900/950 = 94.7%), opened (450/900 = 50%), clicked (180/450 = 40%)
      expect(html).toContain('94.7% conv');
      expect(html).toContain('50% conv');
      expect(html).toContain('40% conv');
    });

    it('should adapt label to Read Receipts for WhatsApp channel', () => {
      const html = renderToString(
        <CampaignFunnelChart stats={mockStatsWhatsApp} channel="whatsapp" />
      );

      expect(html).toContain('Read Receipts');
      expect(html).toContain('Base: 500 Sent');
      expect(html).toContain('96% conv'); // 480/500 = 96%
    });

    it('should render empty state when sent count is 0', () => {
      const emptyStats: CampaignStats = {
        totalRecipients: 0,
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        bouncedCount: 0,
        repliedCount: 0,
        failedCount: 0,
      };

      const html = renderToString(
        <CampaignFunnelChart stats={emptyStats} channel="email" />
      );

      expect(html).toContain('No messages have been dispatched yet for this campaign.');
    });
  });

  /* ========================================================================= */
  /* 2. CampaignRecipientTable Component Tests                                 */
  /* ========================================================================= */
  describe('2. CampaignRecipientTable Component', () => {
    it('should render recipient table rows, status badges, and error diagnostics', () => {
      const html = renderToString(
        <CampaignRecipientTable
          recipients={mockRecipients}
          channel="email"
          campaignName="Enterprise Q4 Onboarding Acceleration"
        />
      );

      expect(html).toContain('Recipient Delivery Log');
      expect(html).toContain('Alex Mercer');
      expect(html).toContain('alex.m@gentek.com');
      expect(html).toContain('Delivered');

      expect(html).toContain('Dana Mercer');
      expect(html).toContain('Opened');

      expect(html).toContain('Bradley Ragland');
      expect(html).toContain('Clicked');

      expect(html).toContain('Robert Cross');
      expect(html).toContain('Bounced');
      expect(html).toContain('550 5.1.1 User unknown / Mailbox does not exist');

      expect(html).toContain('Export CSV');
      expect(html).toContain('Showing 1 to 5 of 5 recipients');
    });

    it('should render phone numbers when channel is WhatsApp', () => {
      const html = renderToString(
        <CampaignRecipientTable
          recipients={mockRecipients}
          channel="whatsapp"
          campaignName="VIP Executive Kickoff Invite"
        />
      );

      expect(html).toContain('+14155550111');
      expect(html).toContain('+14155550222');
      expect(html).toContain('+14155550444');
    });

    it('should render empty table row when recipients array is empty', () => {
      const html = renderToString(
        <CampaignRecipientTable
          recipients={[]}
          channel="email"
          campaignName="Empty Campaign"
        />
      );

      expect(html).toContain('No recipients found matching current search and filter criteria.');
    });
  });

  /* ========================================================================= */
  /* 3. CampaignDeliveryMonitor Component Tests                                */
  /* ========================================================================= */
  describe('3. CampaignDeliveryMonitor Component', () => {
    it('should render campaign header, live controls, KPI strip, and progress bar for sending campaign', () => {
      const html = renderToString(
        <MemoryRouter>
          <CampaignDeliveryMonitor initialCampaign={mockCampaignActive} />
        </MemoryRouter>
      );

      // Header & Status
      expect(html).toContain('Enterprise Q4 Onboarding Acceleration');
      expect(html).toContain('In Progress (Sending)');
      expect(html).toContain('email');
      expect(html).toContain('Pause');
      expect(html).toContain('Cancel');
      expect(html).toContain('Clone');
      expect(html).toContain('Export Report');

      // Live Progress
      expect(html).toContain('Live Dispatching Progress');
      expect(html).toContain('950 of 1,000 processed (95%)');

      // Zero-mock KPI Metrics
      // 1. Delivered & Delivery Rate (900 delivered, 900/950 = 94.7%)
      expect(html).toContain('900');
      expect(html).toContain('94.7% rate');

      // 2. Opens & Open Rate (450 opens, 450/900 = 50%)
      expect(html).toContain('450');
      expect(html).toContain('50% rate');

      // 3. Clicks & CTR (180 clicks, 180/450 = 40%)
      expect(html).toContain('180');
      expect(html).toContain('40% rate');

      // 4. Replies & Reply Rate (45 replies, 45/900 = 5%)
      expect(html).toContain('45');
      expect(html).toContain('5% rate');

      // 5. Bounces & Bounce Rate (50 bounces, 50/950 = 5.3%)
      expect(html).toContain('50');
      expect(html).toContain('5.3% rate');

      // Embedded visualizations
      expect(html).toContain('Outreach Conversion Funnel');
      expect(html).toContain('Recipient Delivery Log');
    });

    it('should render completed WhatsApp campaign with Read Receipts and Resume/Completed controls', () => {
      const html = renderToString(
        <MemoryRouter>
          <CampaignDeliveryMonitor initialCampaign={mockCampaignCompletedWhatsApp} />
        </MemoryRouter>
      );

      expect(html).toContain('VIP Executive Kickoff Invite');
      expect(html).toContain('Completed');
      expect(html).toContain('whatsapp');
      expect(html).toContain('Read Receipts');

      // Delivered (480/500 = 96%)
      expect(html).toContain('480');
      expect(html).toContain('96% rate');

      // Read Rate (380/480 = 79.2%)
      expect(html).toContain('380');
      expect(html).toContain('79.2% rate');

      // Replies (96/480 = 20%)
      expect(html).toContain('96');
      expect(html).toContain('20% rate');
    });
  });

  /* ========================================================================= */
  /* 4. SuperAdminCampaigns Overview Page Tests                                 */
  /* ========================================================================= */
  describe('4. SuperAdminCampaigns Overview Page', () => {
    it('should render aggregate KPI metrics, search filter, and New Campaign button', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/super-admin/sales/campaigns']}>
          <RoleProvider initialRole="super_admin">
            <SidebarProvider>
              <SuperAdminFilterProvider>
                <SuperAdminCampaigns />
              </SuperAdminFilterProvider>
            </SidebarProvider>
          </RoleProvider>
        </MemoryRouter>
      );

      // Header
      expect(html).toContain('Campaigns &amp; Outreach');
      expect(html).toContain('New Campaign Wizard');

      // Top KPI strip titles
      expect(html).toContain('Total Campaigns');
      expect(html).toContain('Total Dispatches');
      expect(html).toContain('Avg Delivery Rate');
      expect(html).toContain('Inbound Responses');

      // Search & Filters
      expect(html).toContain('Search campaigns...');
      expect(html).toContain('All Channels');
      expect(html).toContain('All Statuses');
    });
  });
});
