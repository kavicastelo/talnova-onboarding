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
import { StageBreakdownItem } from '../../../services/salesAnalytics.service';
import { Kanban, Layers } from 'lucide-react';

export interface PipelineStageChartProps {
  stages: StageBreakdownItem[];
  loading?: boolean;
  onStageClick?: (stageKey: string) => void;
}

const STAGE_COLORS = [
  '#6366f1', // Indigo (Discovery / Lead)
  '#3b82f6', // Blue (Qualification)
  '#0ea5e9', // Sky (Proposal)
  '#f59e0b', // Amber (Negotiation)
  '#10b981', // Emerald (Closed Won)
  '#64748b', // Slate
];

export const PipelineStageChart: React.FC<PipelineStageChartProps> = ({
  stages,
  loading = false,
  onStageClick,
}) => {
  const hasData = stages && stages.length > 0;
  const totalValue = stages.reduce((sum, s) => sum + (s.totalValue || 0), 0);
  const totalDeals = stages.reduce((sum, s) => sum + (s.dealCount || 0), 0);
  const allZero = totalDeals === 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Kanban className="w-4 h-4 text-indigo-600" />
            Pipeline Distribution by Stage
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Active pipeline deal volume and total pipeline value per stage
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Total Pipeline</p>
          <p className="text-sm font-bold text-slate-900">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      <div className="h-72 w-full relative">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-slate-50/50 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading pipeline stages…</span>
            </div>
          </div>
        ) : !hasData || allZero ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 text-sm bg-slate-50/50 rounded-lg">
            <Layers className="w-8 h-8 text-slate-300 mb-1" />
            <span>No active deals in pipeline for this period</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stages}
              margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
              onClick={(state) => {
                if (state && state.activePayload && state.activePayload.length) {
                  const clickedItem = state.activePayload[0].payload as StageBreakdownItem;
                  if (onStageClick && clickedItem.stageKey) {
                    onStageClick(clickedItem.stageKey);
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="stageName"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                tickFormatter={(val) => (val >= 1000 ? `$${Math.round(val / 1000)}k` : `$${val}`)}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as StageBreakdownItem;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-800">
                      <p className="font-semibold text-slate-300 border-b border-slate-800 pb-1">
                        {item.stageName}
                      </p>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Total Value:</span>
                        <span className="font-bold text-emerald-400">
                          {formatCurrency(item.totalValue)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Weighted Value:</span>
                        <span className="font-bold text-indigo-400">
                          {formatCurrency(item.weightedValue)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Deals Count:</span>
                        <span className="font-bold text-white">{item.dealCount}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 text-center">
                        Click bar to inspect stage deals &rarr;
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="totalValue" radius={[4, 4, 0, 0]} className="cursor-pointer">
                {stages.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={STAGE_COLORS[index % STAGE_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default PipelineStageChart;
