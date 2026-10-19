import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminShell } from '../../../components/super-admin/SuperAdminShell';
import { KPICard } from '../../../components/super-admin/sales/KPICard';
import { LeadAcquisitionTrend } from '../../../components/super-admin/sales/LeadAcquisitionTrend';
import { PipelineStageChart } from '../../../components/super-admin/sales/PipelineStageChart';
import { ActionCenter } from '../../../components/super-admin/sales/ActionCenter';
import {
  salesAnalyticsService,
  SalesOverviewMetricsData,
  ActionCenterSummaryData,
} from '../../../services/salesAnalytics.service';
import {
  Users,
  Target,
  DollarSign,
  Briefcase,
  TrendingUp,
  Percent,
  Sparkles,
  Megaphone,
  Plus,
  RefreshCw,
  AlertCircle,
  FileQuestion,
  BarChart3,
} from 'lucide-react';

export interface SuperAdminSalesOverviewProps {
  initialMetrics?: SalesOverviewMetricsData | null;
  initialActionCenter?: ActionCenterSummaryData | null;
}

export const SuperAdminSalesOverview: React.FC<SuperAdminSalesOverviewProps> = ({
  initialMetrics = null,
  initialActionCenter = null,
}) => {
  const navigate = useNavigate();

  // State
  const [periodPreset, setPeriodPreset] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [loading, setLoading] = useState<boolean>(!initialMetrics);
  const [actionCenterLoading, setActionCenterLoading] = useState<boolean>(!initialActionCenter);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<SalesOverviewMetricsData | null>(initialMetrics);
  const [actionCenterSummary, setActionCenterSummary] = useState<ActionCenterSummaryData | null>(
    initialActionCenter
  );

  // Compute date range based on period preset
  const getDateRange = useCallback(() => {
    const end = new Date();
    let days = 30;
    if (periodPreset === '7d') days = 7;
    if (periodPreset === '90d') days = 90;
    if (periodPreset === '1y') days = 365;

    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [periodPreset]);

  // Load Overview Metrics
  const loadOverviewMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dates = getDateRange();
      const data = await salesAnalyticsService.getOverviewMetrics(dates);
      setMetrics(data);
    } catch (err: any) {
      console.error('Failed to load sales overview metrics:', err);
      setError('Unable to load authoritative sales metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  // Load Action Center Items
  const loadActionCenter = useCallback(async () => {
    setActionCenterLoading(true);
    try {
      const summary = await salesAnalyticsService.getActionCenter(15);
      setActionCenterSummary(summary);
    } catch (err) {
      console.error('Failed to load Action Center:', err);
    } finally {
      setActionCenterLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialMetrics) {
      loadOverviewMetrics();
    }
    if (!initialActionCenter) {
      loadActionCenter();
    }
  }, [loadOverviewMetrics, loadActionCenter, initialMetrics, initialActionCenter]);

  // Format currency helper
  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Determine if period has absolutely zero activity
  const isPeriodEmpty =
    metrics &&
    metrics.leads.totalLeads === 0 &&
    metrics.leads.periodNewLeads.current === 0 &&
    metrics.deals.openDealsCount.current === 0 &&
    metrics.deals.closedWonRevenue.current === 0;

  return (
    <SuperAdminShell
      title="Sales & Revenue Overview"
      subtitle="Authoritative cross-pipeline KPIs, multi-stage velocity trends, and prioritized operational action items"
      showTenant={false}
      showDateRange={false}
      showEnvironment={false}
      showRefresh={false}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Period Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
            <button
              type="button"
              onClick={() => setPeriodPreset('7d')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                periodPreset === '7d'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('30d')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                periodPreset === '30d'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('90d')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                periodPreset === '90d'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quarter
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('1y')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                periodPreset === '1y'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Year
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              loadOverviewMetrics();
              loadActionCenter();
            }}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Direct Creation Shortcut Buttons */}
          <button
            type="button"
            onClick={() => navigate('/super-admin/sales/leads')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Lead
          </button>
          <button
            type="button"
            onClick={() => navigate('/super-admin/sales/campaigns/new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <Megaphone className="w-3.5 h-3.5 text-indigo-600" />
            Launch Campaign
          </button>
          <button
            type="button"
            onClick={() => navigate('/super-admin/sales/ai')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            AI Co-Pilot
          </button>
          <button
            type="button"
            onClick={() => navigate('/super-admin/sales/analytics')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            Analytics
          </button>
        </div>
      }
    >
      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Analytics Error</p>
            <p className="text-xs text-rose-700">{error}</p>
          </div>
          <button
            type="button"
            onClick={loadOverviewMetrics}
            className="px-3 py-1 bg-white border border-rose-300 rounded-md text-xs font-bold text-rose-700 hover:bg-rose-100/50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Flagship Top-Level KPI Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Total Leads & Period Inbound */}
        <KPICard
          id="kpi-total-leads"
          title="Total Leads"
          value={metrics ? metrics.leads.totalLeads : 0}
          delta={metrics?.leads.periodNewLeads}
          subValue={metrics ? `${metrics.leads.periodNewLeads.current} new this period` : undefined}
          icon={Users}
          variant="primary"
          loading={loading}
          onClick={() => navigate('/super-admin/sales/leads')}
          tooltip="View complete directory of all sales leads"
        />

        {/* 2. Qualified Leads */}
        <KPICard
          id="kpi-qualified-leads"
          title="Qualified Leads"
          value={metrics ? metrics.leads.qualifiedLeads.current : 0}
          delta={metrics?.leads.qualifiedLeads}
          subValue={
            metrics
              ? `${metrics.leads.qualificationRate.current}% qualification rate`
              : undefined
          }
          icon={Target}
          variant="info"
          loading={loading}
          onClick={() => navigate('/super-admin/sales/leads?status=qualified')}
          tooltip="View leads with Qualified or Opportunity status"
        />

        {/* 3. Active Pipeline Value */}
        <KPICard
          id="kpi-active-pipeline"
          title="Active Pipeline"
          value={formatCurrency(metrics?.deals.openPipelineValue.current)}
          delta={metrics?.deals.openPipelineValue}
          subValue={
            metrics
              ? `${metrics.deals.openDealsCount.current} open active deals`
              : undefined
          }
          icon={Briefcase}
          variant="purple"
          loading={loading}
          onClick={() => navigate('/super-admin/sales/deals')}
          tooltip="View active Kanban pipeline board"
        />

        {/* 4. Weighted Pipeline Value */}
        <KPICard
          id="kpi-weighted-pipeline"
          title="Weighted Pipeline"
          value={formatCurrency(metrics?.deals.weightedPipelineValue.current)}
          delta={metrics?.deals.weightedPipelineValue}
          subValue="Expected probability sum"
          icon={DollarSign}
          variant="warning"
          loading={loading}
          onClick={() => navigate('/super-admin/sales/deals')}
          tooltip="View probability-weighted pipeline projection"
        />

        {/* 5. Closed-Won Revenue */}
        <KPICard
          id="kpi-closed-won"
          title="Won Revenue"
          value={formatCurrency(metrics?.deals.closedWonRevenue.current)}
          delta={metrics?.deals.closedWonRevenue}
          subValue={
            metrics
              ? `${metrics.deals.dealsWonCount.current} deals closed won`
              : undefined
          }
          icon={TrendingUp}
          variant="success"
          loading={loading}
          onClick={() => navigate('/super-admin/sales/deals?stage=closed_won')}
          tooltip="View successfully closed won deals"
        />

        {/* 6. Win Rate & Average Cycle Length */}
        <KPICard
          id="kpi-win-rate"
          title="Win Rate"
          value={metrics ? `${metrics.deals.winRate.current}%` : '0%'}
          delta={metrics?.deals.winRate}
          subValue={
            metrics && metrics.deals.averageDealCycleDays > 0
              ? `${metrics.deals.averageDealCycleDays}d avg sales cycle`
              : 'Closed deals win ratio'
          }
          icon={Percent}
          variant="primary"
          loading={loading}
          onClick={() => navigate('/super-admin/sales/deals')}
          tooltip="Closed won / total closed deals conversion percentage"
        />
      </div>

      {/* Empty State Banner (Zero Mock Data Notice) */}
      {isPeriodEmpty && !loading && (
        <div className="p-6 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-amber-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-lg text-amber-800 shrink-0">
              <FileQuestion className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                No sales records recorded in this period
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                All metrics and charts are currently displaying zero baselines. Create your first lead or deal to populate live velocity metrics!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/super-admin/sales/leads')}
              className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 hover:bg-amber-50 shadow-2xs"
            >
              Go to Leads Table
            </button>
            <button
              type="button"
              onClick={() => navigate('/super-admin/sales/deals')}
              className="px-3 py-1.5 bg-amber-800 text-white rounded-lg text-xs font-semibold hover:bg-amber-900 shadow-2xs"
            >
              Open Pipeline Kanban
            </button>
          </div>
        </div>
      )}

      {/* Charts Section: Inbound Acquisition & Pipeline by Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Acquisition & Won Revenue Velocity Trend */}
        <div className="lg:col-span-7">
          <LeadAcquisitionTrend
            series={metrics?.chartSeries || []}
            loading={loading}
          />
        </div>

        {/* Right Column: Pipeline Stage Distribution */}
        <div className="lg:col-span-5">
          <PipelineStageChart
            stages={metrics?.stageBreakdown || []}
            loading={loading}
            onStageClick={(stageKey) => {
              navigate(`/super-admin/sales/deals?stage=${stageKey}`);
            }}
          />
        </div>
      </div>

      {/* Action Center Section */}
      <div>
        <ActionCenter
          summary={actionCenterSummary}
          loading={actionCenterLoading}
          onRefresh={loadActionCenter}
        />
      </div>
    </SuperAdminShell>
  );
};

export default SuperAdminSalesOverview;
