import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { RoleProvider } from '../context/RoleContext';
import { SidebarProvider } from '../components/Sidebar';
import { SuperAdminFilterProvider } from '../context/SuperAdminFilterContext';
import { DealsTable } from '../components/super-admin/sales/crm/DealsTable';
import { DealDetail360Drawer } from '../components/super-admin/sales/crm/DealDetail360Drawer';
import { DealHandoffModal } from '../components/super-admin/sales/crm/DealHandoffModal';
import { SalesDealsPage } from '../pages/super-admin/sales/SalesDealsPage';
import { salesService, DealItem } from '../services/sales.service';

describe('CRM-006: Deals Table & Deal Detail 360 Drawer UI', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    vi.clearAllMocks();
  });

  const mockDealWon: DealItem = {
    _id: 'deal-101',
    name: 'Enterprise Cloud Transformation',
    companyId: {
      _id: 'comp-1',
      name: 'Global Tech Industries',
      domain: 'globaltech.io',
    },
    primaryContactId: {
      _id: 'cont-1',
      fullName: 'Sarah Connor',
      email: 's.connor@globaltech.io',
      phone: '+1 555 0192',
      jobTitle: 'VP of Engineering',
    },
    pipelineId: 'pipe-1',
    stage: 'closed_won',
    ownerId: {
      _id: 'usr-1',
      name: 'Marcus Vance',
      email: 'm.vance@talnova.com',
    },
    value: 180000,
    weightedValue: 180000,
    currency: 'USD',
    annualRecurringRevenue: 150000,
    oneTimeImplementationFee: 30000,
    probability: 1.0,
    expectedCloseDate: '2026-10-31T00:00:00.000Z',
    actualCloseDate: '2026-10-18T00:00:00.000Z',
    competitors: ['ApexSystems', 'CloudCorp'],
    nextAction: 'Finalize onboarding kick-off call',
    wonDetails: {
      contractSignedDate: '2026-10-18T00:00:00.000Z',
      onboardingHandedOff: false,
    },
    stageHistory: [
      {
        fromStage: 'proposal_sent',
        toStage: 'negotiation',
        changedBy: { _id: 'usr-1', name: 'Marcus Vance' },
        changedAt: '2026-10-10T12:00:00.000Z',
        daysInPreviousStage: 5,
      },
      {
        fromStage: 'negotiation',
        toStage: 'closed_won',
        changedBy: { _id: 'usr-1', name: 'Marcus Vance' },
        changedAt: '2026-10-18T10:00:00.000Z',
        daysInPreviousStage: 8,
      },
    ],
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-10-18T10:00:00.000Z',
  };

  const mockDealLost: DealItem = {
    _id: 'deal-102',
    name: 'Mid-Market HR Portal',
    companyId: {
      _id: 'comp-2',
      name: 'Alpha Logistics',
      domain: 'alphalogistics.com',
    },
    primaryContactId: {
      _id: 'cont-2',
      fullName: 'John Miller',
      email: 'jmiller@alphalogistics.com',
      phone: '+1 555 4422',
      jobTitle: 'Head of People Operations',
    },
    pipelineId: 'pipe-1',
    stage: 'closed_lost',
    ownerId: {
      _id: 'usr-2',
      name: 'Rachel Zane',
      email: 'r.zane@talnova.com',
    },
    value: 45000,
    weightedValue: 0,
    currency: 'USD',
    annualRecurringRevenue: 45000,
    oneTimeImplementationFee: 0,
    probability: 0.0,
    expectedCloseDate: '2026-11-15T00:00:00.000Z',
    lossReason: 'competitor',
    lossDetails: 'Selected incumbent vendor due to pre-existing multi-year master contract.',
    stageHistory: [
      {
        fromStage: 'negotiation',
        toStage: 'closed_lost',
        changedBy: { _id: 'usr-2', name: 'Rachel Zane' },
        changedAt: '2026-10-15T14:30:00.000Z',
        daysInPreviousStage: 12,
      },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-10-15T14:30:00.000Z',
  };

  const mockDealNegotiation: DealItem = {
    _id: 'deal-103',
    name: 'Healthcare Compliance Suite',
    companyId: {
      _id: 'comp-3',
      name: 'MediHealth Group',
    },
    pipelineId: 'pipe-1',
    stage: 'negotiation',
    value: 95000,
    weightedValue: 80750,
    currency: 'USD',
    annualRecurringRevenue: 95000,
    oneTimeImplementationFee: 15000,
    probability: 0.85,
    expectedCloseDate: '2026-11-20T00:00:00.000Z',
    stageHistory: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
  };

  describe('1. DealsTable Component Rendering & Interactions', () => {
    it('should render table columns and deal items with values, probability, and company name', () => {
      const html = renderToString(
        <DealsTable
          deals={[mockDealWon, mockDealLost, mockDealNegotiation]}
          isLoading={false}
          total={3}
          page={1}
          limit={20}
          totalPages={1}
          onPageChange={vi.fn()}
          onSelectDeal={vi.fn()}
          onInitiateHandoff={vi.fn()}
          sortBy="name"
          sortOrder="asc"
          onSortChange={vi.fn()}
          selectedStage=""
          onStageChange={vi.fn()}
          searchValue=""
          onSearchChange={vi.fn()}
        />
      );

      // Check Table Column Headers
      expect(html).toContain('Deal Title');
      expect(html).toContain('Associated Company');
      expect(html).toContain('Stage');
      expect(html).toContain('Deal Value');
      expect(html).toContain('Probability');
      expect(html).toContain('Weighted Value');
      expect(html).toContain('Expected Close');
      expect(html).toContain('Owner');
      expect(html).toContain('Actions');

      // Check Rendered Deals
      expect(html).toContain('Enterprise Cloud Transformation');
      expect(html).toContain('Global Tech Industries');
      expect(html).toContain('$180,000');
      expect(html).toContain('Closed Won');

      expect(html).toContain('Mid-Market HR Portal');
      expect(html).toContain('Alpha Logistics');
      expect(html).toContain('$45,000');
      expect(html).toContain('Closed Lost');

      expect(html).toContain('Healthcare Compliance Suite');
      expect(html).toContain('MediHealth Group');
      expect(html).toContain('$95,000');
      expect(html).toContain('Negotiation');

      // Check pagination counters
      expect(html).toContain('Showing');
      expect(html).toContain('3');
      expect(html).toContain('deals');
    });

    it('should render zero-mock clean empty state when no deals match filter criteria', () => {
      const html = renderToString(
        <DealsTable
          deals={[]}
          isLoading={false}
          total={0}
          page={1}
          limit={20}
          totalPages={1}
          onPageChange={vi.fn()}
          onSelectDeal={vi.fn()}
          sortBy="name"
          sortOrder="asc"
          onSortChange={vi.fn()}
          selectedStage=""
          onStageChange={vi.fn()}
          searchValue="non-existent"
          onSearchChange={vi.fn()}
        />
      );

      expect(html).toContain('No Deals Found');
      expect(html).toContain('No deals match your current search and filter criteria');
    });
  });

  describe('2. DealDetail360Drawer Component Architecture', () => {
    it('should render stage stepper, financial breakdown card, and AI Deal Health score', () => {
      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <DealDetail360Drawer
            deal={mockDealWon}
            isOpen={true}
            onClose={vi.fn()}
            onInitiateHandoff={vi.fn()}
          />
        </QueryClientProvider>
      );

      // Drawer Header & Stage
      expect(html).toContain('Enterprise Cloud Transformation');
      expect(html).toContain('Global Tech Industries');
      expect(html.toLowerCase()).toContain('closed won');

      // Stage Stepper
      expect(html).toContain('Qualification');
      expect(html).toContain('Discovery');
      expect(html).toContain('Demo Completed');
      expect(html).toContain('Proposal Sent');
      expect(html).toContain('Negotiation');
      expect(html).toContain('Closed Won');

      // Financials
      expect(html).toContain('Financial &amp; Contract Quote');
      expect(html).toContain('Deal Value (TCV)');
      expect(html).toContain('$180,000');
      expect(html).toContain('ARR');
      expect(html).toContain('$150,000');
      expect(html).toContain('$30,000'); // implementation fee

      // AI Health Card
      expect(html).toContain('AI Deal Health &amp; Signals');
      expect(html).toContain('Stage Velocity');
      expect(html).toContain('Competitor Threat');

      // Primary Decision Maker
      expect(html).toContain('Primary Decision Maker');
      expect(html).toContain('Sarah Connor');
      expect(html).toContain('s.connor@globaltech.io');
      expect(html).toContain('VP of Engineering');

      // Closed Won Onboarding CTA
      expect(html).toContain('Initiate Enterprise Onboarding Handoff');
    });

    it('should render loss reason and details banner when deal is closed_lost', () => {
      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <DealDetail360Drawer
            deal={mockDealLost}
            isOpen={true}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );

      expect(html).toContain('Mid-Market HR Portal');
      expect(html).toContain('Closed Lost Reason: competitor');
      expect(html).toContain('Selected incumbent vendor due to pre-existing multi-year master contract');
    });
  });

  describe('3. DealHandoffModal Component & Enterprise Onboarding Action', () => {
    it('should render configuration modal with deal values and organization provisioning fields', () => {
      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <DealHandoffModal
            deal={mockDealWon}
            isOpen={true}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );

      expect(html).toContain('Enterprise Onboarding Handoff');
      expect(html).toContain('Global Tech Industries');
      expect(html).toContain('$180,000');
      expect(html).toContain('Target Organization Name');
      expect(html).toContain('Initial Admin / Owner Email');
      expect(html).toContain('s.connor@globaltech.io');
      expect(html).toContain('Initiate Handoff Now');
    });

    it('should render already provisioned status banner if deal is already handed off', () => {
      const handedOffDeal: DealItem = {
        ...mockDealWon,
        wonDetails: {
          contractSignedDate: '2026-10-18T00:00:00.000Z',
          onboardingHandedOff: true,
          organizationId: 'org-enterprise-999',
        },
      };

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <DealHandoffModal
            deal={handedOffDeal}
            isOpen={true}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );

      expect(html).toContain('Onboarding Provisioning Confirmed');
      expect(html).toContain('org-enterprise-999');
      expect(html).toContain('The enterprise organization and customer account have been successfully created');
    });
  });

  describe('4. SalesDealsPage with Kanban / Table View Switcher & Live KPI Strip', () => {
    it('should render page with view switcher toggle, pipeline selector, and live KPI summary', () => {
      const mockKanban = {
        stages: [
          {
            key: 'qualification',
            name: 'Qualification',
            order: 0,
            probability: 0.1,
            dealCount: 1,
            totalValue: 50000,
            weightedValue: 5000,
            deals: [mockDealNegotiation],
          },
          {
            key: 'closed_won',
            name: 'Closed Won',
            order: 5,
            probability: 1.0,
            dealCount: 1,
            totalValue: 180000,
            weightedValue: 180000,
            deals: [mockDealWon],
          },
        ],
        totals: {
          dealCount: 2,
          totalValue: 230000,
          weightedValue: 185000,
        },
      };

      queryClient.setQueryData(['sales-pipelines'], [
        { _id: 'pipe-1', name: 'Default Enterprise Pipeline', isDefault: true, stages: [] },
      ]);
      queryClient.setQueryData(
        ['sales-kanban', { pipelineId: undefined, search: undefined }],
        mockKanban
      );

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/super-admin/sales/deals']}>
            <RoleProvider initialRole="super_admin">
              <SidebarProvider>
                <SuperAdminFilterProvider>
                  <SalesDealsPage />
                </SuperAdminFilterProvider>
              </SidebarProvider>
            </RoleProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Page Header & Switcher
      expect(html).toContain('Deals &amp; Pipeline');
      expect(html).toContain('deals-view-kanban-btn');
      expect(html).toContain('deals-view-table-btn');

      // Live KPI Strip
      expect(html).toContain('Total Pipeline Value');
      expect(html).toContain('$230,000');
      expect(html).toContain('Weighted Forecast');
      expect(html).toContain('$185,000');
      expect(html).toContain('Active Deals');
      expect(html).toContain('2');
      expect(html).toContain('Closed Won Value');
      expect(html).toContain('$180,000');
    });
  });
});
