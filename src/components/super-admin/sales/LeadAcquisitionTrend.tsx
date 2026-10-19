import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TimeSeriesDataPoint } from '../../../services/salesAnalytics.service';
import { Users, DollarSign, TrendingUp } from 'lucide-react';

export interface LeadAcquisitionTrendProps {
  series: TimeSeriesDataPoint[];
  loading?: boolean;
}

export const LeadAcquisitionTrend: React.FC<LeadAcquisitionTrendProps> = ({
  series,
  loading = false,
}) => {
  const [activeMetric, setActiveMetric] = useState<'all' | 'leads' | 'revenue'>('all');

  const hasData = series && series.length > 0;
  const totalLeads = series.reduce((sum, pt) => sum + (pt.newLeads || 0), 0);
  const totalRevenue = series.reduce((sum, pt) => sum + (pt.wonRevenue || 0), 0);
  const allZero = totalLeads === 0 && totalRevenue === 0;

  // Format short date for X-axis (e.g., 'Oct 14')
  const formatXAxisDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      {/* Header and Toggle Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            Lead Acquisition & Won Revenue Velocity
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily inbound generation vs realized revenue conversion over time
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveMetric('all')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              activeMetric === 'all'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Combined
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('leads')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
              activeMetric === 'leads'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3 h-3" />
            Leads
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('revenue')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
              activeMetric === 'revenue'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3 h-3" />
            Revenue
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full relative">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-slate-50/50 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Calculating trend line…</span>
            </div>
          </div>
        ) : !hasData ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 text-sm bg-slate-50/50 rounded-lg">
            <Users className="w-8 h-8 text-slate-300 mb-1" />
            <span>No sales records recorded in this period</span>
          </div>
        ) : (
          <>
            {allZero && (
              <div className="absolute top-2 right-2 bg-slate-100/90 text-slate-600 px-2.5 py-1 rounded text-[11px] font-medium z-10 border border-slate-200">
                0 leads / 0 revenue recorded in this period
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="pipelineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatXAxisDate}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                {(activeMetric === 'all' || activeMetric === 'revenue') && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(val) => (val >= 1000 ? `$${Math.round(val / 1000)}k` : `$${val}`)}
                    tick={{ fontSize: 11, fill: '#10b981' }}
                    tickLine={false}
                    axisLine={false}
                  />
                )}
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-800">
                        <p className="font-semibold text-slate-300 border-b border-slate-800 pb-1">
                          {formatXAxisDate(String(label))}
                        </p>
                        {payload.map((entry: any, index: number) => {
                          const isRev = entry.dataKey === 'wonRevenue' || entry.dataKey === 'pipelineCreated';
                          return (
                            <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                {entry.name}:
                              </span>
                              <span className="font-bold">
                                {isRev ? formatCurrency(entry.value) : entry.value}
                              </span>
                            </div>
                          );
                        })}
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

                {(activeMetric === 'all' || activeMetric === 'leads') && (
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="newLeads"
                    name="New Leads"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#leadGradient)"
                  />
                )}

                {(activeMetric === 'all' || activeMetric === 'revenue') && (
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="wonRevenue"
                    name="Won Revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#revenueGradient)"
                  />
                )}

                {activeMetric === 'all' && (
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="pipelineCreated"
                    name="Pipeline Created"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#pipelineGradient)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  );
};

export default LeadAcquisitionTrend;
