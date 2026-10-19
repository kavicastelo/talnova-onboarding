import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { KPICard } from '../components/super-admin/sales/KPICard';
import { LeadAcquisitionTrend } from '../components/super-admin/sales/LeadAcquisitionTrend';
import { PipelineStageChart } from '../components/super-admin/sales/PipelineStageChart';
import { ActionCenter } from '../components/super-admin/sales/ActionCenter';
import { SuperAdminSalesOverview } from '../pages/super-admin/sales/SuperAdminSalesOverview';
import {
  salesAnalyticsService,
  SalesOverviewMetricsData,
  ActionCenterSummaryData,
} from '../services/salesAnalytics.service';
import { SuperAdminFilterProvider } from '../context/SuperAdminFilterContext';
import { Users } from 'lucide-react';

// Mock recharts ResponsiveContainer
vi.mock('recharts', async () => {
  const actual: any = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div className="recharts-responsive-container" style={{ width: '100%', height: '300px' }}>
        {children}
      </div>
    ),
  };
});

// Mock external hooks used by SuperAdminShell
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

vi.mock('../hooks/useSuperAdmin', () => ({
  useSuperAdminOrganizations: () => ({
    data: { data: [] },
    isLoading: false,
  }),
}));

vi.mock('../services/salesAnalytics.service', async () => {
  const actual = await vi.importActual<any>('../services/salesAnalytics.service');
  return {
    ...actual,
    salesAnalyticsService: {
      getOverviewMetrics: vi.fn(),
      getActionCenter: vi.fn(),
      getFunnelMetrics: vi.fn(),
      getRevenueForecast: vi.fn(),
      getRepPerformance: vi.fn(),
    },
  };
});

describe('ANL-003: Super Admin Sales Overview Dashboard UI', () => {
  const mockOverviewData: SalesOverviewMetricsData = {
    period: {
      startDate: '2026-09-18T00:00:00.000Z',
      endDate: '2026-10-18T00:00:00.000Z',
      priorStartDate: '2026-08-19T00:00:00.000Z',
      priorEndDate: '2026-09-18T00:00:00.000Z',
      durationDays: 30,
    },
    leads: {
      totalLeads: 120,
      periodNewLeads: { current: 45, prior: 30, delta: 15, percentageChange: 50.0 },
      qualifiedLeads: { current: 30, prior: 20, delta: 10, percentageChange: 50.0 },
      qualificationRate: { current: 66.7, prior: 66.7, delta: 0, percentageChange: 0 },
    },
    deals: {
      openDealsCount: { current: 18, prior: 15, delta: 3, percentageChange: 20.0 },
      openPipelineValue: { current: 450000, prior: 380000, delta: 70000, percentageChange: 18.4 },
      weightedPipelineValue: { current: 210000, prior: 175000, delta: 35000, percentageChange: 20.0 },
      closedWonRevenue: { current: 180000, prior: 140000, delta: 40000, percentageChange: 28.6 },
      dealsWonCount: { current: 6, prior: 5, delta: 1, percentageChange: 20.0 },
      dealsLostCount: { current: 2, prior: 3, delta: -1, percentageChange: -33.3 },
      winRate: { current: 75.0, prior: 62.5, delta: 12.5, percentageChange: 20.0 },
      averageDealCycleDays: 14.5,
    },
    stageBreakdown: [
      { stageKey: 'qualification', stageName: 'Qualification', dealCount: 8, totalValue: 120000, weightedValue: 36000 },
      { stageKey: 'proposal', stageName: 'Proposal', dealCount: 6, totalValue: 180000, weightedValue: 90000 },
      { stageKey: 'negotiation', stageName: 'Negotiation', dealCount: 4, totalValue: 150000, weightedValue: 120000 },
    ],
    chartSeries: [
      { date: '2026-10-01', newLeads: 3, wonRevenue: 25000, pipelineCreated: 40000 },
      { date: '2026-10-02', newLeads: 5, wonRevenue: 0, pipelineCreated: 30000 },
      { date: '2026-10-03', newLeads: 2, wonRevenue: 50000, pipelineCreated: 20000 },
    ],
  };

  const mockActionCenterData: ActionCenterSummaryData = {
    totalActionableCount: 3,
    categoryCounts: {
      staleLeads: 1,
      overdueTasks: 1,
      closingSoonDeals: 1,
      failedCampaigns: 0,
    },
    items: [
      {
        id: 'stale-lead-1',
        category: 'stale_lead',
        priority: 'urgent',
        title: 'Stale High-Intent Lead: Acme Corp',
        subtitle: 'No contact recorded in 4 days',
        urgencyReason: 'Lead score 85 with 0 outreach attempts',
        actionUrl: '/super-admin/sales/leads?filter=stale',
        actionLabel: 'Assign & Contact',
        metadata: { leadId: 'lead-123' },
        createdAt: '2026-10-18T10:00:00.000Z',
      },
      {
        id: 'overdue-task-1',
        category: 'overdue_task',
        priority: 'high',
        title: 'Overdue Demo: Beta Industries',
        subtitle: 'Due 2 days ago',
        urgencyReason: 'Follow-up scheduled with VP of Engineering',
        actionUrl: '/super-admin/sales/deals?dealId=deal-456',
        actionLabel: 'Open Deal',
        metadata: { taskId: 'task-789' },
        createdAt: '2026-10-17T12:00:00.000Z',
      },
      {
        id: 'closing-soon-deal-1',
        category: 'closing_soon_deal',
        priority: 'high',
        title: 'Stalled Enterprise Deal: Gamma Tech',
        subtitle: 'Closing in 3 days with no updates',
        urgencyReason: '$75,000 contract pending security review',
        actionUrl: '/super-admin/sales/deals?dealId=deal-789',
        actionLabel: 'Inspect Deal',
        metadata: { dealId: 'deal-789' },
        createdAt: '2026-10-18T08:00:00.000Z',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salesAnalyticsService.getOverviewMetrics).mockResolvedValue(mockOverviewData);
    vi.mocked(salesAnalyticsService.getActionCenter).mockResolvedValue(mockActionCenterData);
  });

  describe('1. KPICard Component', () => {
    it('renders metric card with formatted value, delta badge, and icon', () => {
      const html = renderToString(
        <KPICard
          id="test-card"
          title="Total Leads"
          value="120"
          delta={{ current: 120, prior: 100, delta: 20, percentageChange: 20.0 }}
          subValue="45 new this period"
          icon={Users}
          variant="primary"
        />
      );

      expect(html).toContain('Total Leads');
      expect(html).toContain('120');
      expect(html).toContain('+20%');
      expect(html).toContain('vs prior period');
    });

    it('renders explore affordance when onClick handler is provided', () => {
      const html = renderToString(
        <KPICard
          title="Active Pipeline"
          value="$450,000"
          icon={Users}
          onClick={() => {}}
        />
      );

      expect(html).toContain('Explore →');
    });
  });

  describe('2. LeadAcquisitionTrend Component', () => {
    it('renders acquisition chart container with metric toggle buttons', () => {
      const html = renderToString(
        <LeadAcquisitionTrend series={mockOverviewData.chartSeries} />
      );

      expect(html).toContain('Lead Acquisition &amp; Won Revenue Velocity');
      expect(html).toContain('Combined');
      expect(html).toContain('Leads');
      expect(html).toContain('Revenue');
      expect(html).toContain('recharts-responsive-container');
    });

    it('renders clean zero state message when series is empty', () => {
      const html = renderToString(<LeadAcquisitionTrend series={[]} />);

      expect(html).toContain('No sales records recorded in this period');
    });
  });

  describe('3. PipelineStageChart Component', () => {
    it('renders pipeline stage distribution with total pipeline summary', () => {
      const html = renderToString(
        <PipelineStageChart stages={mockOverviewData.stageBreakdown} />
      );

      expect(html).toContain('Pipeline Distribution by Stage');
      expect(html).toContain('Total Pipeline');
      expect(html).toContain('$450,000');
      expect(html).toContain('recharts-responsive-container');
    });

    it('renders clean zero deal notice when all stages have 0 deals', () => {
      const html = renderToString(
        <PipelineStageChart
          stages={[
            { stageKey: 'qualification', stageName: 'Qualification', dealCount: 0, totalValue: 0, weightedValue: 0 },
          ]}
        />
      );

      expect(html).toContain('No active deals in pipeline for this period');
    });
  });

  describe('4. ActionCenter Component', () => {
    it('renders prioritized risk items, category badges, and actionable drill-down buttons', () => {
      const html = renderToString(
        <MemoryRouter>
          <ActionCenter summary={mockActionCenterData} />
        </MemoryRouter>
      );

      expect(html).toContain('Prioritized Action Center');
      expect(html).toContain('3 Require Attention');
      expect(html).toContain('Stale High-Intent Lead: Acme Corp');
      expect(html).toContain('Overdue Demo: Beta Industries');
      expect(html).toContain('Stalled Enterprise Deal: Gamma Tech');
      expect(html).toContain('URGENT');
      expect(html).toContain('Assign &amp; Contact');
      expect(html).toContain('Open Deal');
      expect(html).toContain('Inspect Deal');
    });

    it('renders healthy status banner when 0 operational risks exist', () => {
      const emptyActionCenter: ActionCenterSummaryData = {
        totalActionableCount: 0,
        categoryCounts: { staleLeads: 0, overdueTasks: 0, closingSoonDeals: 0, failedCampaigns: 0 },
        items: [],
      };

      const html = renderToString(
        <MemoryRouter>
          <ActionCenter summary={emptyActionCenter} />
        </MemoryRouter>
      );

      expect(html).toContain('All operational areas healthy');
    });
  });

  describe('5. SuperAdminSalesOverview Dashboard Page', () => {
    it('mounts inside SuperAdminShell with period selector, KPI grid, and Action Center', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/super-admin/sales']}>
          <SuperAdminFilterProvider>
            <Routes>
              <Route
                path="/super-admin/sales"
                element={
                  <SuperAdminSalesOverview
                    initialMetrics={mockOverviewData}
                    initialActionCenter={mockActionCenterData}
                  />
                }
              />
            </Routes>
          </SuperAdminFilterProvider>
        </MemoryRouter>
      );

      // Shell title & actions
      expect(html).toContain('Sales &amp; Revenue Overview');
      expect(html).toContain('New Lead');
      expect(html).toContain('Launch Campaign');
      expect(html).toContain('AI Co-Pilot');

      // Period presets
      expect(html).toContain('7 Days');
      expect(html).toContain('30 Days');
      expect(html).toContain('Quarter');
      expect(html).toContain('Year');

      // KPI Cards
      expect(html).toContain('Total Leads');
      expect(html).toContain('Qualified Leads');
      expect(html).toContain('Active Pipeline');
      expect(html).toContain('Weighted Pipeline');
      expect(html).toContain('Won Revenue');
      expect(html).toContain('Win Rate');

      // Section titles
      expect(html).toContain('Lead Acquisition &amp; Won Revenue Velocity');
      expect(html).toContain('Pipeline Distribution by Stage');
      expect(html).toContain('Prioritized Action Center');
    });

    it('renders zero mock data notice when period has zero activity', () => {
      const zeroMetrics: SalesOverviewMetricsData = {
        period: {
          startDate: '2030-01-01T00:00:00.000Z',
          endDate: '2030-01-31T00:00:00.000Z',
          priorStartDate: '2029-12-01T00:00:00.000Z',
          priorEndDate: '2029-12-31T00:00:00.000Z',
          durationDays: 30,
        },
        leads: {
          totalLeads: 0,
          periodNewLeads: { current: 0, prior: 0, delta: 0, percentageChange: 0 },
          qualifiedLeads: { current: 0, prior: 0, delta: 0, percentageChange: 0 },
          qualificationRate: { current: 0, prior: 0, delta: 0, percentageChange: 0 },
        },
        deals: {
          openDealsCount: { current: 0, prior: 0, delta: 0, percentageChange: 0 },
          openPipelineValue: { current: 0, prior: 0, delta: 0, percentageChange: 0 },
          weightedPipelineValue: { current: 0, prior: 0, delta: 0, percentageChange: 0 },
          closedWonRevenue: { current: 0, prior: 0, delta: 0, percentageChange: 0 },
          dealsWonCount: { current: 0, prior: 0, delta: 0, percentageChange: 0 },
          dealsLostCount: { current: 0, prior: 0, delta: 0, percentageChange: 0 },
          winRate: { current: 0, prior: 0, delta: 0, percentageChange: 0 },
          averageDealCycleDays: 0,
        },
        stageBreakdown: [],
        chartSeries: [],
      };

      const html = renderToString(
        <MemoryRouter initialEntries={['/super-admin/sales']}>
          <SuperAdminFilterProvider>
            <Routes>
              <Route
                path="/super-admin/sales"
                element={
                  <SuperAdminSalesOverview
                    initialMetrics={zeroMetrics}
                    initialActionCenter={{
                      totalActionableCount: 0,
                      categoryCounts: { staleLeads: 0, overdueTasks: 0, closingSoonDeals: 0, failedCampaigns: 0 },
                      items: [],
                    }}
                  />
                }
              />
            </Routes>
          </SuperAdminFilterProvider>
        </MemoryRouter>
      );

      expect(html).toContain('No sales records recorded in this period');
    });
  });
});
