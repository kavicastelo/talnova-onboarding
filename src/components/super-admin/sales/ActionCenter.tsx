import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionCenterSummaryData,
  ActionCenterItem,
} from '../../../services/salesAnalytics.service';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  CalendarX,
  Flame,
  ArrowRight,
  TrendingDown,
  Megaphone,
} from 'lucide-react';

export interface ActionCenterProps {
  summary: ActionCenterSummaryData | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export const ActionCenter: React.FC<ActionCenterProps> = ({
  summary,
  loading = false,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const items = summary?.items || [];
  const filteredItems =
    selectedCategory === 'all'
      ? items
      : items.filter((item) => item.category === selectedCategory);

  const counts = summary?.categoryCounts || {
    staleLeads: 0,
    overdueTasks: 0,
    closingSoonDeals: 0,
    failedCampaigns: 0,
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
            <Flame className="w-3 h-3 text-rose-600 animate-pulse" />
            URGENT
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            HIGH
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            NORMAL
          </span>
        );
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'stale_lead':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'overdue_task':
        return <CalendarX className="w-4 h-4 text-rose-600" />;
      case 'closing_soon_deal':
        return <TrendingDown className="w-4 h-4 text-purple-600" />;
      case 'failed_campaign':
        return <Megaphone className="w-4 h-4 text-red-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-600" />;
    }
  };

  const handleActionClick = (item: ActionCenterItem) => {
    if (item.actionUrl) {
      navigate(item.actionUrl);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      {/* Action Center Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-50 rounded-lg text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Prioritized Action Center
            </h3>
            {summary && summary.totalActionableCount > 0 && (
              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold text-xs rounded-full border border-rose-200">
                {`${summary.totalActionableCount} Require Attention`}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Operational bottlenecks, high-risk deals closing soon, overdue tasks, and stale leads
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors self-start sm:self-auto"
          >
            Refresh Queue
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
            selectedCategory === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Items ({summary?.totalActionableCount || 0})
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('stale_lead')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            selectedCategory === 'stale_lead'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Stale Leads ({counts.staleLeads})
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('overdue_task')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            selectedCategory === 'overdue_task'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CalendarX className="w-3.5 h-3.5" />
          Overdue Tasks ({counts.overdueTasks})
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('closing_soon_deal')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            selectedCategory === 'closing_soon_deal'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          Closing Soon Deals ({counts.closingSoonDeals})
        </button>
        {counts.failedCampaigns > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('failed_campaign')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedCategory === 'failed_campaign'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            Failed Campaigns ({counts.failedCampaigns})
          </button>
        )}
      </div>

      {/* Action Items List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="w-6 h-6 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Evaluating operational bottlenecks…</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3 text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                All operational areas healthy
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                No stale leads, overdue tasks, or closing-soon stalled deals detected. Excellent sales pipeline velocity!
              </p>
            </div>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/40 hover:bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs shrink-0 mt-0.5">
                  {getCategoryIcon(item.category)}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                    {getPriorityBadge(item.priority)}
                  </div>
                  <p className="text-xs text-slate-500">{item.subtitle}</p>
                  <p className="text-xs font-medium text-amber-700">
                    &bull; {item.urgencyReason}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleActionClick(item)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 self-end sm:self-auto"
              >
                {item.actionLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActionCenter;
