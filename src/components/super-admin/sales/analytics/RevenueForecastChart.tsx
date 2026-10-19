import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { RevenueForecastData } from '../../../../services/salesAnalytics.service';
import {
  TrendingUp,
  Target,
  DollarSign,
  ShieldCheck,
  Zap,
  CheckCircle,
  Layers,
} from 'lucide-react';

export interface RevenueForecastChartProps {
  data: RevenueForecastData | null;
  loading?: boolean;
}

export const RevenueForecastChart: React.FC<RevenueForecastChartProps> = ({
  data,
  loading = false,
}) => {
  // Scenario toggles for chart line visibility
  const [showActual, setShowActual] = useState<boolean>(true);
  const [showCommitted, setShowCommitted] = useState<boolean>(true);
  const [showWeighted, setShowWeighted] = useState<boolean>(true);
  const [showBestCase, setShowBestCase] = useState<boolean>(true);

  const scenarios = data?.scenarios || {
    closedWonActual: 0,
    committed: 0,
    weightedExpected: 0,
    bestCase: 0,
    openPipelineTotal: 0,
    dealsClosingInPeriodCount: 0,
  };

  const quotaTarget = data?.quotaTarget || 0;
  const attainment = data?.projectedQuotaAttainment || 0;
  const coverageRatio = data?.pipelineCoverageRatio || 0;
  const monthlyData = data?.monthlyBreakdown || [];

  const hasData =
    scenarios.closedWonActual > 0 ||
    scenarios.committed > 0 ||
    scenarios.weightedExpected > 0 ||
    scenarios.bestCase > 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Header and Quota Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Revenue Forecast & Scenario Modeling
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Probabilistic revenue projections based on open deal close dates, stage weighting, and commitments
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-right">
            <p className="text-[10px] font-semibold uppercase text-slate-500 flex items-center gap-1 justify-end">
              <Target className="w-3 h-3 text-slate-400" />
              Quota Target
            </p>
            <p className="text-base font-bold text-slate-900">{formatCurrency(quotaTarget)}</p>
          </div>
          <div
            className={`border px-3 py-1.5 rounded-lg text-right ${
              attainment >= 100
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : attainment >= 75
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}
          >
            <p className="text-[10px] font-semibold uppercase opacity-80">Attainment %</p>
            <p className="text-base font-extrabold">{`${attainment}%`}</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-right">
            <p className="text-[10px] font-semibold uppercase text-indigo-700">Coverage Ratio</p>
            <p className="text-base font-bold text-indigo-950">{`${coverageRatio}x`}</p>
          </div>
        </div>
      </div>

      {/* 4-Tier Scenario Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Closed Won Actual */}
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              Closed Won Actual
            </span>
            <span className="text-[10px] bg-emerald-100/80 px-1.5 py-0.5 rounded text-emerald-800">
              Realized
            </span>
          </div>
          <h4 className="text-xl font-extrabold text-emerald-950">
            {formatCurrency(scenarios.closedWonActual)}
          </h4>
          <p className="text-[11px] text-slate-500">Realized revenue in period</p>
        </div>

        {/* Committed */}
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-blue-800 font-semibold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Committed
            </span>
            <span className="text-[10px] bg-blue-100/80 px-1.5 py-0.5 rounded text-blue-800">
              Late Stage
            </span>
          </div>
          <h4 className="text-xl font-extrabold text-blue-950">
            {formatCurrency(scenarios.committed)}
          </h4>
          <p className="text-[11px] text-slate-500">Negotiation &amp; &ge;85% win probability</p>
        </div>

        {/* Weighted Expected */}
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-indigo-800 font-semibold">
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
              Weighted / Expected
            </span>
            <span className="text-[10px] bg-indigo-100/80 px-1.5 py-0.5 rounded text-indigo-800">
              Probabilistic
            </span>
          </div>
          <h4 className="text-xl font-extrabold text-indigo-950">
            {formatCurrency(scenarios.weightedExpected)}
          </h4>
          <p className="text-[11px] text-slate-500">Sum of (dealValue &times; winProbability)</p>
        </div>

        {/* Best Case */}
        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-purple-800 font-semibold">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-purple-600" />
              Best Case
            </span>
            <span className="text-[10px] bg-purple-100/80 px-1.5 py-0.5 rounded text-purple-800">
              Full Upside
            </span>
          </div>
          <h4 className="text-xl font-extrabold text-purple-950">
            {formatCurrency(scenarios.bestCase)}
          </h4>
          <p className="text-[11px] text-slate-500">Total unweighted open pipeline closing in period</p>
        </div>
      </div>

      {/* Chart Scenario Toggles */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
        <p className="text-xs font-semibold text-slate-700">Display Scenario Lines:</p>
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={showActual}
              onChange={(e) => setShowActual(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Closed Won Actual
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={showCommitted}
              onChange={(e) => setShowCommitted(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            Committed
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={showWeighted}
              onChange={(e) => setShowWeighted(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
            Weighted Expected
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={showBestCase}
              onChange={(e) => setShowBestCase(e.target.checked)}
              className="rounded text-purple-600 focus:ring-purple-500"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
            Best Case
          </label>
        </div>
      </div>

      {/* Forecast Line Chart Canvas */}
      <div className="h-72 w-full relative">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-slate-50/50 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Simulating forecast scenarios…</span>
            </div>
          </div>
        ) : !hasData ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 text-sm bg-slate-50/50 rounded-lg">
            <Layers className="w-8 h-8 text-slate-300 mb-1" />
            <span>No activity in selected date range</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={monthlyData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tickFormatter={(val) => (val >= 1000 ? `$${Math.round(val / 1000)}k` : `$${val}`)}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-800">
                      <p className="font-semibold text-slate-300 border-b border-slate-800 pb-1">
                        Month: {label}
                      </p>
                      {payload.map((entry: any, index: number) => (
                        <div key={`forecast-tt-${index}`} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            {entry.name}:
                          </span>
                          <span className="font-bold">{formatCurrency(entry.value)}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={30}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }}
              />

              {showActual && (
                <Line
                  type="monotone"
                  dataKey="closedWon"
                  name="Closed Won Actual"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}

              {showCommitted && (
                <Line
                  type="monotone"
                  dataKey="committed"
                  name="Committed"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={{ r: 3 }}
                />
              )}

              {showWeighted && (
                <Line
                  type="monotone"
                  dataKey="weightedExpected"
                  name="Weighted Expected"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              )}

              {showBestCase && (
                <Line
                  type="monotone"
                  dataKey="bestCase"
                  name="Best Case"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default RevenueForecastChart;
