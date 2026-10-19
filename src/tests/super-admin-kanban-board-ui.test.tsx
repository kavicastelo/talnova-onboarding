import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DealCard } from '../components/super-admin/sales/DealCard';
import { ClosedLostDialog } from '../components/super-admin/sales/ClosedLostDialog';
import { ClosedWonModal } from '../components/super-admin/sales/ClosedWonModal';
import { KanbanBoard } from '../components/super-admin/sales/KanbanBoard';
import { SuperAdminDeals } from '../pages/super-admin/sales/SuperAdminDeals';
import { salesService, DealItem, KanbanBoardData, PipelineItem } from '../services/sales.service';
import { SuperAdminFilterProvider } from '../context/SuperAdminFilterContext';
import { RoleProvider } from '../context/RoleContext';
import { SidebarProvider } from '../components/Sidebar';
import { AppShell } from '../components/AppShell';

// Mock Sonner toast and Toaster
vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
    Toaster: () => null,
  };
});

// Mock external hooks used by AppShell and SuperAdminShell
vi.mock('../hooks/useAuth', () => ({
  useCurrentUser: () => ({
    data: { id: 'usr-super', name: 'Super Admin', email: 'super@talnova.test', role: 'super_admin' },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../hooks/useSettings', () => ({
  useWorkspaceSettings: () => ({
    data: { orgName: 'Talnova Corp', primaryColor: '#4F46E5' },
    isLoading: false,
  }),
}));

vi.mock('../hooks/useDocuments', () => ({
  useEmployeeDocumentInbox: () => ({ data: [] }),
}));

vi.mock('../hooks/useOnboardingExceptions', () => ({
  useOnboardingExceptions: () => ({ data: { pagination: { total: 0 } } }),
}));

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({ data: [] }),
  useUnreadNotificationCount: () => ({ data: 0 }),
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn() }),
}));

vi.mock('../hooks/useSuperAdmin', () => ({
  useSuperAdminOrganizations: () => ({
    data: { data: [] },
    isLoading: false,
  }),
}));

vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => null,
}));

vi.mock('../components/PWAInstallBanner', () => ({
  PWAInstallBanner: () => null,
}));

vi.mock('../components/CommandPalette', () => ({
  CommandPalette: () => null,
  useCommandPaletteHotkey: () => ({ open: false, setOpen: vi.fn() }),
}));

describe('CRM-005: Interactive Kanban Pipeline Board UI', () => {
  let queryClient: QueryClient;

  const mockDeal: DealItem = {
    _id: 'deal-101',
    name: 'Enterprise Cloud Transformation',
    companyId: {
      _id: 'comp-1',
      name: 'Global Logistics Inc',
      domain: 'globallogistics.test',
      tier: 'enterprise',
    },
    primaryContactId: {
      _id: 'cont-1',
      fullName: 'Sarah Jenkins',
      email: 's.jenkins@globallogistics.test',
    },
    pipelineId: 'pipe-1',
    stage: 'proposal',
    ownerId: {
      _id: 'usr-1',
      name: 'Alice Sales',
      email: 'alice@talnova.test',
    },
    value: 175000,
    weightedValue: 122500,
    currency: 'USD',
    annualRecurringRevenue: 150000,
    oneTimeImplementationFee: 25000,
    probability: 0.7,
    expectedCloseDate: '2026-11-30T00:00:00.000Z',
    stageHistory: [
      {
        fromStage: 'qualification',
        toStage: 'proposal',
        changedAt: '2026-10-10T12:00:00.000Z',
        daysInPreviousStage: 5,
      },
    ],
    createdAt: '2026-10-05T10:00:00.000Z',
    updatedAt: '2026-10-10T12:00:00.000Z',
  };

  const mockKanbanData: KanbanBoardData = {
    pipeline: {
      _id: 'pipe-1',
      name: 'Standard B2B Pipeline',
      isDefault: true,
    },
    stages: [
      {
        key: 'qualification',
        name: 'Qualification',
        order: 0,
        probability: 0.1,
        dealCount: 1,
        count: 1,
        totalValue: 50000,
        weightedValue: 5000,
        deals: [
          {
            ...mockDeal,
            _id: 'deal-102',
            name: 'Initial Pilot Agreement',
            stage: 'qualification',
            value: 50000,
            probability: 0.1,
          },
        ],
      },
      {
        key: 'proposal',
        name: 'Proposal Sent',
        order: 1,
        probability: 0.7,
        dealCount: 1,
        count: 1,
        totalValue: 175000,
        weightedValue: 122500,
        deals: [mockDeal],
      },
      {
        key: 'closed_won',
        name: 'Closed Won',
        order: 2,
        probability: 1.0,
        dealCount: 0,
        count: 0,
        totalValue: 0,
        weightedValue: 0,
        deals: [],
      },
      {
        key: 'closed_lost',
        name: 'Closed Lost',
        order: 3,
        probability: 0.0,
        dealCount: 0,
        count: 0,
        totalValue: 0,
        weightedValue: 0,
        deals: [],
      },
    ],
    totals: {
      dealCount: 2,
      totalValue: 225000,
      weightedValue: 127500,
    },
  };

  const mockPipelines: PipelineItem[] = [
    {
      _id: 'pipe-1',
      name: 'Standard B2B Pipeline',
      isDefault: true,
      stages: [
        { key: 'qualification', name: 'Qualification', order: 0, probability: 0.1 },
        { key: 'proposal', name: 'Proposal Sent', order: 1, probability: 0.7 },
        { key: 'closed_won', name: 'Closed Won', order: 2, probability: 1.0 },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  describe('1. DealCard Component Rendering & Interactions', () => {
    it('should render deal title, company name, formatted value, and probability badge', () => {
      const html = renderToString(
        <DealCard
          deal={mockDeal}
          stages={[
            { key: 'qualification', name: 'Qualification' },
            { key: 'proposal', name: 'Proposal' },
            { key: 'closed_won', name: 'Closed Won' },
          ]}
        />
      );

      expect(html).toContain('Enterprise Cloud Transformation');
      expect(html).toContain('Global Logistics Inc');
      expect(html).toContain('$175,000');
      expect(html).toContain('70');
      expect(html).toContain('$122,500');
      expect(html).toContain('draggable="true"');
    });

    it('should show onboarding handoff badge if deal won and handed off', () => {
      const wonDeal: DealItem = {
        ...mockDeal,
        stage: 'closed_won',
        wonDetails: {
          onboardingHandedOff: true,
          contractSignedDate: '2026-10-15T00:00:00.000Z',
        },
      };

      const html = renderToString(<DealCard deal={wonDeal} />);
      expect(html).toContain('Handed Off to Onboarding');
    });
  });

  describe('2. ClosedLostDialog Modal', () => {
    it('should render modal dialog with mandatory loss reason select options', () => {
      const html = renderToString(
        <ClosedLostDialog
          isOpen={true}
          deal={mockDeal}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      expect(html).toContain('Mark Deal as Closed Lost');
      expect(html).toContain('Enterprise Cloud Transformation');
      expect(html).toContain('Pricing / Budget Constraints');
      expect(html).toContain('Lost to Competitor');
      expect(html).toContain('Confirm Closed Lost');
    });
  });

  describe('3. ClosedWonModal with Enterprise Onboarding Prompt', () => {
    it('should render congratulations modal and enterprise onboarding handoff checkbox', () => {
      const html = renderToString(
        <ClosedWonModal
          isOpen={true}
          deal={mockDeal}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      expect(html).toContain('Deal Won! Congratulations');
      expect(html).toContain('Initiate Enterprise Onboarding Handoff Now');
      expect(html).toContain('Global Logistics Inc');
      expect(html).toContain('Confirm Won &amp; Proceed');
    });
  });

  describe('4. KanbanBoard Column Architecture', () => {
    it('should render columns for all pipeline stages with header counts and values', () => {
      const html = renderToString(
        <KanbanBoard
          kanbanData={mockKanbanData}
          onStageChange={vi.fn()}
        />
      );

      expect(html).toContain('kanban-column-qualification');
      expect(html).toContain('kanban-column-proposal');
      expect(html).toContain('kanban-column-closed_won');
      expect(html).toContain('kanban-column-closed_lost');

      // Check stage deal values
      expect(html).toContain('$50,000');
      expect(html).toContain('$175,000');

      // Empty column placeholder
      expect(html).toContain('No deals in this stage');
    });
  });

  describe('5. SuperAdminDeals Page & Live KPI Metrics', () => {
    it('should render page with live KPI strip and search input', () => {
      vi.spyOn(salesService, 'getPipelines').mockResolvedValue(mockPipelines);
      vi.spyOn(salesService, 'getKanbanBoard').mockResolvedValue(mockKanbanData);

      queryClient.setQueryData(['sales-pipelines'], mockPipelines);
      queryClient.setQueryData(
        [
          'sales-kanban',
          {
            pipelineId: undefined,
            search: undefined,
          },
        ],
        mockKanbanData
      );

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/super-admin/sales/deals']}>
            <RoleProvider initialRole="super_admin">
              <SidebarProvider>
                <SuperAdminFilterProvider>
                  <SuperAdminDeals />
                </SuperAdminFilterProvider>
              </SidebarProvider>
            </RoleProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(html).toContain('Deals &amp; Pipeline');
      expect(html).toContain('Total Pipeline Value');
      expect(html).toContain('$225,000');
      expect(html).toContain('Weighted Forecast');
      expect(html).toContain('$127,500');
      expect(html).toContain('Active Deals');
      expect(html).toContain('2');
      expect(html).toContain('deals-search-input');
    });
  });

  describe('6. Navigation Link Integration in AppShell', () => {
    it('should render Deals & Pipeline item in Super Admin navigation under Sales & Acquisition', () => {
      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/super-admin/sales/deals']}>
            <RoleProvider initialRole="super_admin">
              <SidebarProvider>
                <SuperAdminFilterProvider>
                  <AppShell />
                </SuperAdminFilterProvider>
              </SidebarProvider>
            </RoleProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(html).toContain('Sales &amp; Acquisition');
      expect(html).toContain('Deals &amp; Pipeline');
      expect(html).toContain('/super-admin/sales/deals');
    });
  });
});
