import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  X,
  Target,
  Sparkles,
  Clock,
  DollarSign,
  TrendingDown,
} from 'lucide-react';
import { DealRiskOverviewItem, salesAiService } from '../../../../services/salesAi.service';

interface DealRiskAlertsWidgetProps {
  deals: DealRiskOverviewItem[];
  onRefreshDeal?: (dealId: string) => Promise<void>;
  isLoading?: boolean;
}

export const DealRiskAlertsWidget: React.FC<DealRiskAlertsWidgetProps> = ({
  deals,
  onRefreshDeal,
}) => {
  const [selectedDeal, setSelectedDeal] = useState<DealRiskOverviewItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const getHealthScoreColor = (score: number) => {
    if (score < 40) return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    if (score < 60) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    if (score < 80) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  };

  const getRiskLevelBadge = (score: number) => {
    if (score < 40) return { label: 'Critical Risk', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    if (score < 60) return { label: 'High Risk', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    if (score < 80) return { label: 'Moderate Risk', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' };
    return { label: 'Low Risk', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  };

  const handleRefreshAnalysis = async (dealId: string) => {
    try {
      setIsRefreshing(dealId);
      if (onRefreshDeal) {
        await onRefreshDeal(dealId);
      } else {
        await salesAiService.analyzeDealRisk(dealId, true);
      }
      setActionFeedback(`Successfully refreshed risk analysis for deal.`);
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: any) {
      setActionFeedback(`Analysis refresh failed: ${err.message || 'Error'}`);
      setTimeout(() => setActionFeedback(null), 3500);
    } finally {
      setIsRefreshing(null);
    }
  };

  return (
    <div
      id="deal-risk-alerts-widget"
      className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:border-border/80 flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <span>Deal Risk Alerts & Playbooks</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20">
                {`${deals.length} Alert${deals.length === 1 ? '' : 's'}`}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Deals with stalling velocity, detected objections, and AI-generated rescue tactics
            </p>
          </div>
        </div>
      </div>

      {/* Action Feedback Toast */}
      {actionFeedback && (
        <div className="mt-3 p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Deals List */}
      <div className="mt-4 space-y-3.5 flex-1 overflow-y-auto max-h-[580px] pr-1">
        {deals.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border border-dashed border-border/60 rounded-xl">
            <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500/80 mb-2" />
            <p className="text-sm font-medium text-foreground">Zero Critical Deal Risks</p>
            <p className="text-xs mt-1 text-muted-foreground">
              All active deals are progressing within expected stage velocity thresholds.
            </p>
          </div>
        ) : (
          deals.map((deal) => {
            const riskBadge = getRiskLevelBadge(deal.healthScore);
            const scoreColor = getHealthScoreColor(deal.healthScore);
            const objections = deal.latestInsight?.detectedObjections || deal.riskFlags || [];

            return (
              <div
                key={deal._id}
                data-testid={`deal-risk-card-${deal._id}`}
                className="group relative rounded-xl border border-border/70 bg-background/50 hover:bg-muted/30 p-4 transition-all hover:shadow-md hover:border-border"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Deal Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground truncate max-w-[260px]">
                        {deal.name}
                      </span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${riskBadge.color}`}>
                        {riskBadge.label}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-secondary/80 text-secondary-foreground border border-border/40">
                        {deal.stage}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                        {`$${deal.value?.toLocaleString()} ${deal.currency || 'USD'}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {`${deal.daysInCurrentStage} days in stage`}
                      </span>
                    </div>

                    {/* Detected Objections */}
                    {objections.length > 0 && (
                      <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                          Objections:
                        </span>
                        {objections.slice(0, 3).map((obj: string, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          >
                            <TrendingDown className="w-3 h-3 text-rose-500" />
                            {obj}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Health Gauge & Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 shrink-0">
                    {/* Health Score Circular Badge */}
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-[10px] font-semibold uppercase text-muted-foreground">Health</div>
                        <div className={`text-base font-bold font-mono px-2.5 py-0.5 rounded-lg border ${scoreColor}`}>
                          {`${deal.healthScore}/100`}
                        </div>
                      </div>
                    </div>

                    {/* Playbook Trigger Button */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedDeal(deal)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all shadow-sm"
                        title="Open AI rescue playbook"
                        aria-label={`View playbook for ${deal.name}`}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>View Playbook</span>
                      </button>

                      <button
                        type="button"
                        disabled={isRefreshing === deal._id}
                        onClick={() => handleRefreshAnalysis(deal._id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border/50 transition-all"
                        title="Refresh AI risk evaluation"
                        aria-label="Refresh AI risk"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing === deal._id ? 'animate-spin text-primary' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 1-Click Playbook Modal */}
      {selectedDeal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h3 className="text-lg font-bold text-foreground">AI Rescue Playbook</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border">
                    {selectedDeal.stage}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Deal: <span className="font-semibold text-foreground">{selectedDeal.name}</span> • Value:{' '}
                  <span className="font-semibold text-foreground">
                    ${selectedDeal.value?.toLocaleString()} {selectedDeal.currency}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDeal(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent transition-all"
                aria-label="Close playbook modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 text-xs max-h-[60vh] overflow-y-auto pr-1">
              {/* Target Stakeholder */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <span>Target Stakeholder</span>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {selectedDeal.latestInsight?.rescuePlaybook?.targetStakeholder || 'Executive Buyer / VP of Operations'}
                </p>
              </div>

              {/* Strategy */}
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                <div className="font-semibold text-primary uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Recommended Tactical Strategy</span>
                </div>
                <p className="text-foreground leading-relaxed">
                  {selectedDeal.latestInsight?.rescuePlaybook?.recommendedStrategy ||
                    'Schedule an executive alignment session focused on immediate ROI and time-to-value milestones.'}
                </p>
              </div>

              {/* Bulleted Talking Points */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-2">
                <div className="font-semibold text-foreground uppercase text-[10px] tracking-wider">
                  Key Talking Points & Counter-Objections
                </div>
                <ul className="space-y-2">
                  {(
                    selectedDeal.latestInsight?.rescuePlaybook?.talkingPoints || [
                      'Affirm commitment to 30-day initial deployment milestone.',
                      'Provide customer references in similar industry vertical.',
                      'Offer phased billing tied directly to measurable onboarding milestones.',
                    ]
                  ).map((point: string, index: number) => (
                    <li key={index} className="flex items-start gap-2.5 text-foreground leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Fallback Offer */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                <div className="font-semibold text-amber-500 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Concession / Fallback Lever</span>
                </div>
                <p className="text-foreground leading-relaxed">
                  {selectedDeal.latestInsight?.rescuePlaybook?.fallbackOffer ||
                    'Offer a complimentary 30-day executive onboarding package and pilot satisfaction guarantee.'}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <button
                type="button"
                disabled={isRefreshing === selectedDeal._id}
                onClick={() => handleRefreshAnalysis(selectedDeal._id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing === selectedDeal._id ? 'animate-spin text-primary' : ''}`} />
                <span>Re-run AI Analysis</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDeal(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealRiskAlertsWidget;
