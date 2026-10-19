import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SalesFunnelChart } from '../components/super-admin/sales/analytics/SalesFunnelChart';
import { RevenueForecastChart } from '../components/super-admin/sales/analytics/RevenueForecastChart';
import { RepPerformanceTable } from '../components/super-admin/sales/analytics/RepPerformanceTable';
import { CampaignRoiComparison } from '../components/super-admin/sales/analytics/CampaignRoiComparison';
import { SalesAnalyticsPage } from '../pages/super-admin/sales/SalesAnalyticsPage';
import {
  FunnelMetricsData,
  RevenueForecastData,
  RepLeaderboardData,
  salesAnalyticsService,
} from '../services/salesAnalytics.service';
import { CampaignItem, salesCampaignService } from '../services/salesCampaign.service';
import { SuperAdminFilterProvider } from '../context/SuperAdminFilterContext';

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
      getFunnelMetrics: vi.fn(),
      getRevenueForecast: vi.fn(),
      getRepPerformance: vi.fn(),
    },
  };
});

vi.mock('../services/salesCampaign.service', async () => {
  const actual = await vi.importActual<any>('../services/salesCampaign.service');
  return {
    ...actual,
    salesCampaignService: {
      getCampaigns: vi.fn(),
    },
  };
});

// Mock Data Fixtures
const mockFunnelData: FunnelMetricsData = {
  period: {
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-10-31T23:59:59.999Z',
  },
  stages: [
    {
      stageKey: 'lead_created',
      stageName: 'Lead Created',
      count: 200,
      value: 1200000,
      conversionRateFromTop: 100,
      stageToStageConversionRate: 100,
      dropOffRate: 40,
    },
    {
      stageKey: 'qualified',
      stageName: 'Qualified Lead',
      count: 120,
      value: 850000,
      conversionRateFromTop: 60,
      stageToStageConversionRate: 60,
      dropOffRate: 33.3,
    },
    {
      stageKey: 'deal_created',
      stageName: 'Opportunity / Deal',
      count: 80,
      value: 620000,
      conversionRateFromTop: 40,
      stageToStageConversionRate: 66.7,
      dropOffRate: 37.5,
    },
    {
      stageKey: 'proposal',
      stageName: 'Proposal / Demo',
      count: 50,
      value: 410000,
      conversionRateFromTop: 25,
      stageToStageConversionRate: 62.5,
      dropOffRate: 40,
    },
    {
      stageKey: 'closed_won',
      stageName: 'Closed Won',
      count: 30,
      value: 280000,
      conversionRateFromTop: 15,
      stageToStageConversionRate: 60,
      dropOffRate: 0,
    },
  ],
  overallConversionRate: 15.0,
  averageSalesCycleDays: 22.4,
  timeInStage: {
    lead_created: 3.2,
    qualified: 5.1,
    deal_created: 6.4,
    proposal: 7.7,
  },
};

const mockForecastData: RevenueForecastData = {
  period: 'quarter',
  dateWindow: {
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-12-31T23:59:59.999Z',
  },
  quotaTarget: 350000,
  scenarios: {
    closedWonActual: 140000,
    committed: 210000,
    weightedExpected: 285000,
    bestCase: 420000,
    openPipelineTotal: 580000,
    dealsClosingInPeriodCount: 18,
  },
  projectedQuotaAttainment: 81.4,
  pipelineCoverageRatio: 1.66,
  monthlyBreakdown: [
    {
      month: '2026-10',
      closedWon: 70000,
      committed: 95000,
      weightedExpected: 120000,
      bestCase: 150000,
    },
    {
      month: '2026-11',
      closedWon: 70000,
      committed: 115000,
      weightedExpected: 165000,
      bestCase: 270000,
    },
  ],
};

const mockRepData: RepLeaderboardData = {
  period: {
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-10-31T23:59:59.999Z',
  },
  reps: [
    {
      repId: 'usr-1',
      repName: 'Sarah Jenkins',
      repEmail: 'sarah@talnova.com',
      avatarUrl: undefined,
      totalBookings: 180000,
      quotaTarget: 150000,
      quotaAttainment: 120.0,
      dealsWon: 12,
      dealsLost: 2,
      dealsClosed: 14,
      winRate: 85.7,
      averageDealSize: 15000,
      activePipelineValue: 95000,
      openDealsCount: 7,
    },
    {
      repId: 'usr-2',
      repName: 'Alex Rivera',
      repEmail: 'alex@talnova.com',
      avatarUrl: undefined,
      totalBookings: 100000,
      quotaTarget: 150000,
      quotaAttainment: 66.7,
      dealsWon: 6,
      dealsLost: 4,
      dealsClosed: 10,
      winRate: 60.0,
      averageDealSize: 16666,
      activePipelineValue: 140000,
      openDealsCount: 9,
    },
  ],
  teamSummary: {
    totalBookings: 280000,
    totalDealsWon: 18,
    teamWinRate: 75.0,
    averageDealSize: 15555,
    totalActivePipeline: 235000,
  },
};

const mockCampaigns: CampaignItem[] = [
  {
    _id: 'cmp-1',
    name: 'Enterprise Q4 Email Blast',
    channel: 'email',
    status: 'completed',
    createdBy: 'usr-super',
    stats: {
      totalRecipients: 500,
      sentCount: 500,
      deliveredCount: 480,
      openedCount: 220,
      clickedCount: 85,
      bouncedCount: 20,
      repliedCount: 35,
      failedCount: 0,
    },
    recipients: [],
    tags: ['enterprise', 'q4'],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  },
  {
    _id: 'cmp-2',
    name: 'High Intent Lead WhatsApp Drop',
    channel: 'whatsapp',
    status: 'sending',
    createdBy: 'usr-super',
    stats: {
      totalRecipients: 200,
      sentCount: 200,
      deliveredCount: 195,
      openedCount: 170, // mapped as read
      clickedCount: 0,
      bouncedCount: 0,
      repliedCount: 65,
      failedCount: 5,
    },
    recipients: [],
    tags: ['whatsapp', 'followup'],
    createdAt: '2026-10-05T00:00:00.000Z',
    updatedAt: '2026-10-12T00:00:00.000Z',
  },
];

describe('Super Admin Advanced Sales & Campaign Analytics UI (ANL-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (salesAnalyticsService.getFunnelMetrics as any).mockResolvedValue(mockFunnelData);
    (salesAnalyticsService.getRevenueForecast as any).mockResolvedValue(mockForecastData);
    (salesAnalyticsService.getRepPerformance as any).mockResolvedValue(mockRepData);
    (salesCampaignService.getCampaigns as any).mockResolvedValue({
      items: mockCampaigns,
      pagination: { total: 2, page: 1, limit: 20, totalPages: 1 },
    });
  });

  describe('1. SalesFunnelChart Component', () => {
    it('renders conversion funnel stages with counts, values, and drop-off percentages', () => {
      const html = renderToString(<SalesFunnelChart data={mockFunnelData} />);

      expect(html).toContain('Multi-Stage Conversion Funnel &amp; Velocity');
      expect(html).toContain('Overall Win Rate');
      expect(html).toContain('15%');
      expect(html).toContain('Avg Sales Cycle');
      expect(html).toContain('22.4 days');

      // Stage names
      expect(html).toContain('Lead Created');
      expect(html).toContain('Qualified Lead');
      expect(html).toContain('Opportunity / Deal');
      expect(html).toContain('Proposal / Demo');
      expect(html).toContain('Closed Won');

      // Drop-off rates
      expect(html).toContain('-40% drop');
      expect(html).toContain('-33.3% drop');
    });

    it('renders zero baseline gracefully when funnel data has zero activity', () => {
      const emptyFunnel: FunnelMetricsData = {
        period: {},
        stages: [
          {
            stageKey: 'lead_created',
            stageName: 'Lead Created',
            count: 0,
            value: 0,
            conversionRateFromTop: 0,
            stageToStageConversionRate: 0,
            dropOffRate: 0,
          },
        ],
        overallConversionRate: 0,
        averageSalesCycleDays: 0,
        timeInStage: {},
      };

      const html = renderToString(<SalesFunnelChart data={emptyFunnel} />);
      expect(html).toContain('No activity in selected date range');
      expect(html).toContain('0%');
    });
  });

  describe('2. RevenueForecastChart Component', () => {
    it('renders 4 forecast scenarios: Actual, Committed, Weighted Expected, Best Case', () => {
      const html = renderToString(<RevenueForecastChart data={mockForecastData} />);

      expect(html).toContain('Revenue Forecast &amp; Scenario Modeling');
      expect(html).toContain('Closed Won Actual');
      expect(html).toContain('$140,000');
      expect(html).toContain('Committed');
      expect(html).toContain('$210,000');
      expect(html).toContain('Weighted / Expected');
      expect(html).toContain('$285,000');
      expect(html).toContain('Best Case');
      expect(html).toContain('$420,000');

      // Quota target and coverage
      expect(html).toContain('Quota Target');
      expect(html).toContain('$350,000');
      expect(html).toContain('81.4%');
      expect(html).toContain('1.66x');
    });

    it('renders scenario toggles and line chart container', () => {
      const html = renderToString(<RevenueForecastChart data={mockForecastData} />);

      // Line scenario toggles
      expect(html).toContain('Closed Won Actual');
      expect(html).toContain('Committed');
      expect(html).toContain('Weighted Expected');
      expect(html).toContain('Best Case');

      expect(html).toContain('recharts-responsive-container');
    });

    it('handles zero baseline for empty forecast periods cleanly', () => {
      const emptyForecast: RevenueForecastData = {
        period: 'quarter',
        dateWindow: {
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-12-31T23:59:59.999Z',
        },
        quotaTarget: 100000,
        scenarios: {
          closedWonActual: 0,
          committed: 0,
          weightedExpected: 0,
          bestCase: 0,
          openPipelineTotal: 0,
          dealsClosingInPeriodCount: 0,
        },
        projectedQuotaAttainment: 0,
        pipelineCoverageRatio: 0,
        monthlyBreakdown: [],
      };

      const html = renderToString(<RevenueForecastChart data={emptyForecast} />);
      expect(html).toContain('No activity in selected date range');
      expect(html).toContain('$0');
      expect(html).toContain('0%');
    });
  });

  describe('3. RepPerformanceTable Component', () => {
    it('renders team summary metrics strip', () => {
      const html = renderToString(<RepPerformanceTable data={mockRepData} />);

      expect(html).toContain('Sales Representative Performance Leaderboard');
      expect(html).toContain('Total Bookings');
      expect(html).toContain('$280,000');
      expect(html).toContain('Deals Won');
      expect(html).toContain('18 deals');
      expect(html).toContain('Team Win Rate');
      expect(html).toContain('75%');
      expect(html).toContain('Active Pipeline');
      expect(html).toContain('$235,000');
    });

    it('renders individual sales reps with quota progress bars and win rates', () => {
      const html = renderToString(<RepPerformanceTable data={mockRepData} />);

      expect(html).toContain('Sarah Jenkins');
      expect(html).toContain('sarah@talnova.com');
      expect(html).toContain('$180,000');
      expect(html).toContain('120%');
      expect(html).toContain('85.7%');

      expect(html).toContain('Alex Rivera');
      expect(html).toContain('alex@talnova.com');
      expect(html).toContain('$100,000');
      expect(html).toContain('66.7%');
      expect(html).toContain('60%');
    });

    it('handles empty rep roster gracefully', () => {
      const emptyRepData: RepLeaderboardData = {
        period: {},
        reps: [],
        teamSummary: {
          totalBookings: 0,
          totalDealsWon: 0,
          teamWinRate: 0,
          averageDealSize: 0,
          totalActivePipeline: 0,
        },
      };

      const html = renderToString(<RepPerformanceTable data={emptyRepData} />);
      expect(html).toContain('No sales representatives recorded in this period');
    });
  });

  describe('4. CampaignRoiComparison Component', () => {
    it('renders side-by-side Email vs. WhatsApp performance metrics cards', () => {
      const html = renderToString(<CampaignRoiComparison campaigns={mockCampaigns} />);

      expect(html).toContain('Marketing Campaign Channel ROI Comparison');
      expect(html).toContain('Email Marketing (SES / SendGrid / SMTP)');
      expect(html).toContain('WhatsApp Cloud API (Meta / Twilio)');

      // Email numbers
      expect(html).toContain('500'); // total sent
      expect(html).toContain('480'); // delivered
      expect(html).toContain('35');  // replies

      // WhatsApp numbers
      expect(html).toContain('200'); // sent
      expect(html).toContain('195'); // delivered
      expect(html).toContain('65');  // replies
    });

    it('renders comparative grouped bar chart container and breakdown table', () => {
      const html = renderToString(<CampaignRoiComparison campaigns={mockCampaigns} />);

      expect(html).toContain('recharts-responsive-container');
      expect(html).toContain('500');
      expect(html).toContain('200');
    });

    it('handles zero campaigns gracefully with zero baselines', () => {
      const html = renderToString(<CampaignRoiComparison campaigns={[]} />);
      expect(html).toContain('No activity in selected date range');
    });
  });

  describe('5. SalesAnalyticsPage Integration Page', () => {
    it('renders page layout with SuperAdminShell, tabs, and top summary strip', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/super-admin/sales/analytics']}>
          <SuperAdminFilterProvider>
            <Routes>
              <Route
                path="/super-admin/sales/analytics"
                element={
                  <SalesAnalyticsPage
                    initialFunnel={mockFunnelData}
                    initialForecast={mockForecastData}
                    initialReps={mockRepData}
                    initialCampaigns={mockCampaigns}
                  />
                }
              />
            </Routes>
          </SuperAdminFilterProvider>
        </MemoryRouter>
      );

      // Page Title & Subtitle
      expect(html).toContain('Advanced Sales &amp; Campaign Analytics');
      expect(html).toContain('Cross-pipeline conversion funnel drop-offs');

      // Top Quick Navigation and Action buttons
      expect(html).toContain('Overview');
      expect(html).toContain('AI Intelligence');
      expect(html).toContain('Refresh');

      // Date Presets
      expect(html).toContain('7 Days');
      expect(html).toContain('30 Days');
      expect(html).toContain('90 Days');
      expect(html).toContain('1 Year');

      // Top summary strip
      expect(html).toContain('Funnel Conversion');
      expect(html).toContain('15.0%');
      expect(html).toContain('Forecast Quota');
      expect(html).toContain('81%');
      expect(html).toContain('Team Bookings');
      expect(html).toContain('$280,000');
      expect(html).toContain('Active Campaigns');
      expect(html).toContain('2');

      // Section Tabs
      expect(html).toContain('All Analytics');
      expect(html).toContain('Conversion Funnel');
      expect(html).toContain('Revenue Forecast');
      expect(html).toContain('Rep Leaderboard');
      expect(html).toContain('Campaign ROI');

      // Embedded sections
      expect(html).toContain('Multi-Stage Conversion Funnel &amp; Velocity');
      expect(html).toContain('Revenue Forecast &amp; Scenario Modeling');
      expect(html).toContain('Sales Representative Performance Leaderboard');
      expect(html).toContain('Marketing Campaign Channel ROI Comparison');
    });

    it('renders clean empty state notice when all datasets have zero activity', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/super-admin/sales/analytics']}>
          <SuperAdminFilterProvider>
            <Routes>
              <Route
                path="/super-admin/sales/analytics"
                element={
                  <SalesAnalyticsPage
                    initialFunnel={{
                      period: {},
                      stages: [],
                      overallConversionRate: 0,
                      averageSalesCycleDays: 0,
                      timeInStage: {},
                    }}
                    initialForecast={{
                      period: 'quarter',
                      dateWindow: {
                        startDate: '2026-10-01T00:00:00.000Z',
                        endDate: '2026-12-31T23:59:59.999Z',
                      },
                      quotaTarget: 0,
                      scenarios: {
                        closedWonActual: 0,
                        committed: 0,
                        weightedExpected: 0,
                        bestCase: 0,
                        openPipelineTotal: 0,
                        dealsClosingInPeriodCount: 0,
                      },
                      projectedQuotaAttainment: 0,
                      pipelineCoverageRatio: 0,
                      monthlyBreakdown: [],
                    }}
                    initialReps={{
                      period: {},
                      reps: [],
                      teamSummary: {
                        totalBookings: 0,
                        totalDealsWon: 0,
                        teamWinRate: 0,
                        averageDealSize: 0,
                        totalActivePipeline: 0,
                      },
                    }}
                    initialCampaigns={[]}
                  />
                }
              />
            </Routes>
          </SuperAdminFilterProvider>
        </MemoryRouter>
      );

      expect(html).toContain('No activity in selected date range.');
      expect(html).toContain('Expand to 1 Year');
    });
  });
});
