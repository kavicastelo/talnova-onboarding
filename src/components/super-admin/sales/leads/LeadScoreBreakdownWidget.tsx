import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, Tag, Zap, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../../components/Button';
import { salesService, LeadItem, LeadPriority } from '../../../../services/sales.service';

interface LeadScoreBreakdownWidgetProps {
  lead: LeadItem;
  onScoreUpdated?: (updated: LeadItem) => void;
}

const PRIORITY_BADGES: Record<LeadPriority, { label: string; badge: string }> = {
  urgent: { label: 'Urgent', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
  high: { label: 'High', badge: 'bg-orange-100 text-orange-800 border-orange-300' },
  normal: { label: 'Normal', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  low: { label: 'Low', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
};

export function LeadScoreBreakdownWidget({
  lead,
  onScoreUpdated,
}: LeadScoreBreakdownWidgetProps) {
  const queryClient = useQueryClient();
  const [isRecalculating, setIsRecalculating] = useState(false);

  const recalculateMutation = useMutation({
    mutationFn: () => salesService.recalculateScore(lead._id),
    onMutate: () => setIsRecalculating(true),
    onSettled: () => setIsRecalculating(false),
    onSuccess: (updated) => {
      toast.success(`Score updated to ${updated.score} pts (${updated.priority})`);
      queryClient.invalidateQueries({ queryKey: ['sales-leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales-lead', lead._id] });
      if (onScoreUpdated) onScoreUpdated(updated);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to recalculate score';
      toast.error(msg);
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 70) return { text: 'text-emerald-600', bg: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Sales Ready (Hot)' };
    if (score >= 40) return { text: 'text-amber-600', bg: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Engaged (Warm)' };
    return { text: 'text-rose-600', bg: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Nurture Required (Cold)' };
  };

  const scoreTheme = getScoreColor(lead.score);
  const priorityCfg = PRIORITY_BADGES[lead.priority] || PRIORITY_BADGES.normal;
  const breakdown = lead.scoreBreakdown || [];

  return (
    <div className="space-y-6">
      {/* Score Overview Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Lead Score & Qualification Rating
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-4xl font-extrabold ${scoreTheme.text}`}>
                {lead.score}
              </span>
              <span className="text-sm font-semibold text-slate-400">/ 100</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${scoreTheme.pill}`}>
                {scoreTheme.label}
              </span>
              <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full border ${priorityCfg.badge}`}>
                {priorityCfg.label}
              </span>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={isRecalculating}
            onClick={() => recalculateMutation.mutate()}
            className="text-xs flex items-center gap-1.5 h-8 bg-white border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>
        </div>

        {/* Progress bar gauge */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full mt-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${scoreTheme.bg}`}
            style={{ width: `${Math.min(100, Math.max(0, lead.score))}%` }}
          />
        </div>
      </div>

      {/* Rules Breakdown List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-indigo-600" />
            Applied Scoring Rules Breakdown
          </h4>
          <span className="text-[11px] text-slate-400">
            {breakdown.length} {breakdown.length === 1 ? 'rule' : 'rules'} triggered
          </span>
        </div>

        {breakdown.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Tag className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">No scoring events on record</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Click &quot;Recalculate&quot; above to evaluate all qualification rules against this lead&apos;s current profile.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {breakdown.map((item, idx) => {
              const isPositive = item.points >= 0;
              const formattedDate = item.timestamp
                ? new Date(item.timestamp).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : null;

              return (
                <div
                  key={`${item.rule}-${idx}`}
                  className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs ${
                        isPositive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {isPositive ? `+${item.points}` : item.points}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        {item.rule}
                      </div>
                      {formattedDate && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Triggered: {formattedDate}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Applied</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default LeadScoreBreakdownWidget;
