import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminShell } from '../../../components/super-admin/SuperAdminShell';
import { SalesFunnelChart } from '../../../components/super-admin/sales/analytics/SalesFunnelChart';
import { RevenueForecastChart } from '../../../components/super-admin/sales/analytics/RevenueForecastChart';
import { RepPerformanceTable } from '../../../components/super-admin/sales/analytics/RepPerformanceTable';
import { CampaignRoiComparison } from '../../../components/super-admin/sales/analytics/CampaignRoiComparison';
import {
  salesAnalyticsService,
  FunnelMetricsData,
  RevenueForecastData,
  RepLeaderboardData,
} from '../../../services/salesAnalytics.service';
import {
  salesCampaignService,
  CampaignItem,
} from '../../../services/salesCampaign.service';
import {
  Filter,
  Users,
  Megaphone,
  RefreshCw,
  Sparkles,
  LayoutDashboard,
  Calendar,
  AlertCircle,
  Target,
} from 'lucide-react';

export interface SalesAnalyticsPageProps {
  initialFunnel?: FunnelMetricsData | null;
  initialForecast?: RevenueForecastData | null;
  initialReps?: RepLeaderboardData | null;
  initialCampaigns?: CampaignItem[];
}

export type AnalyticsTab = 'all' | 'funnel' | 'forecast' | 'reps' | 'campaigns';

export const SalesAnalyticsPage: React.FC<SalesAnalyticsPageProps> = ({
  initialFunnel = null,
  initialForecast = null,
  initialReps = null,
  initialCampaigns = [],
}) => {
  const navigate = useNavigate();

  // Filter and view state
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('all');
  const [datePreset, setDatePreset] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [forecastPeriod, setForecastPeriod] = useState<'month' | 'quarter' | 'year'>('quarter');

  // Data states
  const [funnelData, setFunnelData] = useState<FunnelMetricsData | null>(initialFunnel);
  const [forecastData, setForecastData] = useState<RevenueForecastData | null>(initialForecast);
  const [repData, setRepData] = useState<RepLeaderboardData | null>(initialReps);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>(initialCampaigns);

  // Status states
  const [loading, setLoading] = useState<boolean>(
    !initialFunnel && !initialForecast && !initialReps && initialCampaigns.length === 0
  );
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate start/end date
  const getDateRange = useCallback(() => {
    const end = new Date();
    let days = 30;
    if (datePreset === '7d') days = 7;
    if (datePreset === '90d') days = 90;
    if (datePreset === '1y') days = 365;

    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [datePreset]);

  // Load all analytics data
  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const dates = getDateRange();

    try {
      const [fData, fcData, rData, cData] = await Promise.allSettled([
        salesAnalyticsService.getFunnelMetrics(dates),
        salesAnalyticsService.getRevenueForecast({
          period: forecastPeriod,
          startDate: dates.startDate,
          endDate: dates.endDate,
        }),
        salesAnalyticsService.getRepPerformance(dates),
        salesCampaignService.getCampaigns(),
      ]);

      if (fData.status === 'fulfilled') setFunnelData(fData.value);
      if (fcData.status === 'fulfilled') setForecastData(fcData.value);
      if (rData.status === 'fulfilled') setRepData(rData.value);
      if (cData.status === 'fulfilled') setCampaigns(cData.value.items || []);
    } catch (err: any) {
      console.error('Failed to load advanced sales analytics:', err);
      setError('Unable to load full sales analytics data. Some metrics may be unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getDateRange, forecastPeriod]);

  // Initial load if not provided
  useEffect(() => {
    if (!initialFunnel && !initialForecast && !initialReps && initialCampaigns.length === 0) {
      loadData();
    }
  }, [loadData, initialFunnel, initialForecast, initialReps, initialCampaigns]);

  // Check if everything is completely empty (Zero Mock Data notice)
  const isAllEmpty =
    (!funnelData || funnelData.stages.every((s) => s.count === 0)) &&
    (!forecastData || forecastData.monthlyBreakdown.length === 0) &&
    (!repData || repData.reps.length === 0) &&
    campaigns.length === 0;

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <SuperAdminShell
      title="Advanced Sales & Campaign Analytics"
      subtitle="Cross-pipeline conversion funnel drop-offs, multi-scenario revenue forecasting, sales rep leaderboards, and omnichannel campaign performance"
      showTenant={false}
      showDateRange={false}
      showEnvironment={false}
      showRefresh={false}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Date Presets */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
            <button
              type="button"
              onClick={() => setDatePreset('7d')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                datePreset === '7d'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('30d')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                datePreset === '30d'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('90d')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                datePreset === '90d'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              90 Days
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('1y')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                datePreset === '1y'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1 Year
            </button>
          </div>

          {/* Quick Navigation Links */}
          <button
            type="button"
            onClick={() => navigate('/super-admin/sales')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-slate-500" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/super-admin/sales/ai')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI Intelligence</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      }
    >
      <div id="sales-analytics-page" className="space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-center justify-between text-xs text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => loadData(true)}
              className="font-semibold underline hover:text-red-800"
            >
              Retry
            </button>
          </div>
        )}

        {/* Top Analytics Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Funnel Conversion</p>
              <p className="text-lg font-bold text-slate-900">
                {`${funnelData?.overallConversionRate?.toFixed(1) ?? '0.0'}%`}
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Forecast Quota</p>
              <p className="text-lg font-bold text-slate-900">
                {`${forecastData?.projectedQuotaAttainment?.toFixed(0) ?? '0'}%`}
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Team Bookings</p>
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(repData?.teamSummary?.totalBookings || 0)}
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Active Campaigns</p>
              <p className="text-lg font-bold text-slate-900">{`${campaigns.length}`}</p>
            </div>
          </div>
        </div>

        {/* View / Tab Navigation & Forecast Period selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All Analytics
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('funnel')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                activeTab === 'funnel'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Conversion Funnel
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('forecast')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                activeTab === 'forecast'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Revenue Forecast
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reps')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                activeTab === 'reps'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Rep Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('campaigns')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                activeTab === 'campaigns'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Campaign ROI
            </button>
          </div>

          {/* Forecast period selection toggle */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-slate-500 font-medium">Forecast Horizon:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setForecastPeriod('month')}
                className={`px-2 py-0.5 font-medium rounded-md transition-colors ${
                  forecastPeriod === 'month'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setForecastPeriod('quarter')}
                className={`px-2 py-0.5 font-medium rounded-md transition-colors ${
                  forecastPeriod === 'quarter'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Quarter
              </button>
              <button
                type="button"
                onClick={() => setForecastPeriod('year')}
                className={`px-2 py-0.5 font-medium rounded-md transition-colors ${
                  forecastPeriod === 'year'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Year
              </button>
            </div>
          </div>
        </div>

        {/* Global Empty State Banner when no activity in date range */}
        {isAllEmpty && !loading && (
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>No activity in selected date range.</strong> Baseline zeros are displayed across pipeline funnels, revenue projections, and rep quotas.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDatePreset('1y')}
              className="text-xs font-semibold text-amber-900 underline hover:text-amber-950"
            >
              Expand to 1 Year
            </button>
          </div>
        )}

        {/* Component Views */}
        <div className="space-y-6">
          {/* Conversion Funnel Section */}
          {(activeTab === 'all' || activeTab === 'funnel') && (
            <SalesFunnelChart data={funnelData} loading={loading} />
          )}

          {/* Revenue Forecast Section */}
          {(activeTab === 'all' || activeTab === 'forecast') && (
            <RevenueForecastChart data={forecastData} loading={loading} />
          )}

          {/* Rep Performance Table Section */}
          {(activeTab === 'all' || activeTab === 'reps') && (
            <RepPerformanceTable data={repData} loading={loading} />
          )}

          {/* Campaign ROI Section */}
          {(activeTab === 'all' || activeTab === 'campaigns') && (
            <CampaignRoiComparison campaigns={campaigns} loading={loading} />
          )}
        </div>
      </div>
    </SuperAdminShell>
  );
};

export default SalesAnalyticsPage;
