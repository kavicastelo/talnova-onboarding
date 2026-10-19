import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { FunnelMetricsData } from '../../../../services/salesAnalytics.service';
import { Filter, Clock, TrendingDown, Layers } from 'lucide-react';

export interface SalesFunnelChartProps {
  data: FunnelMetricsData | null;
  loading?: boolean;
}

const FUNNEL_COLORS = [
  '#6366f1', // Indigo (Lead Created)
  '#3b82f6', // Blue (Qualified)
  '#0ea5e9', // Sky (Opportunity / Deal)
  '#f59e0b', // Amber (Proposal)
  '#10b981', // Emerald (Closed Won)
];

export const SalesFunnelChart: React.FC<SalesFunnelChartProps> = ({
  data,
  loading = false,
}) => {
  const stages = data?.stages || [];
  const overallConversion = data?.overallConversionRate ?? 0;
  const avgCycleDays = data?.averageSalesCycleDays ?? 0;
  const timeInStage = data?.timeInStage || {};

  const hasData = stages.some((s) => s.count > 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Header and Summary Velocity Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Filter className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Multi-Stage Conversion Funnel & Velocity
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cohort progression from initial inbound creation to realized closed won revenue
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-indigo-50/70 border border-indigo-100 px-3 py-1.5 rounded-lg text-right">
            <p className="text-[10px] font-semibold uppercase text-indigo-600">Overall Win Rate</p>
            <p className="text-lg font-extrabold text-indigo-950">{`${overallConversion}%`}</p>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-100 px-3 py-1.5 rounded-lg text-right">
            <p className="text-[10px] font-semibold uppercase text-emerald-600 flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3" />
              Avg Sales Cycle
            </p>
            <p className="text-lg font-extrabold text-emerald-950">{`${avgCycleDays} days`}</p>
          </div>
        </div>
      </div>

      {/* Funnel Stage Progression Cards (Horizontal Stepper) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {stages.map((stage, idx) => {
          const isTop = idx === 0;
          const isWon = idx === stages.length - 1;
          return (
            <div
              key={stage.stageKey}
              className={`p-3 rounded-lg border relative transition-all ${
                isWon
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : isTop
                  ? 'bg-indigo-50/40 border-indigo-200'
                  : 'bg-slate-50/50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-semibold text-slate-700">{`Stage ${idx + 1}`}</span>
                {idx > 0 && stage.dropOffRate > 0 && (
                  <span className="text-[10px] font-medium text-rose-600 flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" />
                    {`-${stage.dropOffRate}% drop`}
                  </span>
                )}
              </div>

              <h4 className="text-xs font-bold text-slate-900 truncate" title={stage.stageName}>
                {stage.stageName}
              </h4>

              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-slate-900">
                  {stage.count.toLocaleString()}
                </span>
                {stage.value > 0 && (
                  <span className="text-[11px] font-semibold text-slate-600">
                    {formatCurrency(stage.value)}
                  </span>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">From Top:</span>
                <span className="font-bold text-indigo-700">{`${stage.conversionRateFromTop}%`}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Funnel Volume & Conversion Chart */}
      <div className="h-64 w-full relative">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-slate-50/50 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Calculating conversion cohort…</span>
            </div>
          </div>
        ) : !hasData ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 text-sm bg-slate-50/50 rounded-lg">
            <Layers className="w-8 h-8 text-slate-300 mb-1" />
            <span>No activity in selected date range</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stages}
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="stageName"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as FunnelMetricsData['stages'][0];
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-800">
                      <p className="font-semibold text-slate-200 border-b border-slate-800 pb-1">
                        {item.stageName}
                      </p>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Total Volume:</span>
                        <span className="font-bold text-white">{item.count}</span>
                      </div>
                      {item.value > 0 && (
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Stage Value:</span>
                          <span className="font-bold text-emerald-400">
                            {formatCurrency(item.value)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Conversion from Top:</span>
                        <span className="font-bold text-indigo-400">{item.conversionRateFromTop}%</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Stage-to-Stage:</span>
                        <span className="font-bold text-indigo-300">
                          {item.stageToStageConversionRate}%
                        </span>
                      </div>
                      {item.dropOffRate > 0 && (
                        <div className="flex justify-between gap-4 text-rose-400">
                          <span>Stage Drop-off:</span>
                          <span className="font-bold">{item.dropOffRate}%</span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {stages.map((_, index) => (
                  <Cell
                    key={`funnel-cell-${index}`}
                    fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Average Time in Stage (Velocity) Pills */}
      {Object.keys(timeInStage).length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 font-semibold">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Stage Velocity Duration (Days spent in previous stage before advancement)
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(timeInStage).map(([stageKey, days]) => (
              <span
                key={stageKey}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium"
              >
                <span className="capitalize">{stageKey.replace('_', ' ')}:</span>
                <span className="font-bold text-slate-900">{days}d</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesFunnelChart;
