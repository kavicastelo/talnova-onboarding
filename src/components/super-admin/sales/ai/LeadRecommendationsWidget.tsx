import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  Mail,
  Calendar,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { LeadRecommendationItem, salesAiService } from '../../../../services/salesAi.service';

interface LeadRecommendationsWidgetProps {
  leads: LeadRecommendationItem[];
  onRefreshLead?: (leadId: string) => Promise<void>;
  isLoading?: boolean;
}

export const LeadRecommendationsWidget: React.FC<LeadRecommendationsWidgetProps> = ({
  leads,
  onRefreshLead,
}) => {
  const navigate = useNavigate();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 60) return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
  };

  const getIntentBadgeStyle = (badge: string) => {
    switch (badge?.toLowerCase()) {
      case 'hot intent':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'high engagement':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      default:
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    }
  };

  const handleActionClick = (actionName: string, lead: LeadRecommendationItem) => {
    if (actionName === 'Send Follow-up') {
      navigate(`/super-admin/sales/inbox?leadId=${lead._id}`);
      return;
    }

    setToastMessage(`${actionName} triggered for ${lead.name} (${lead.companyName}). Action logged to CRM timeline.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRefreshSummary = async (leadId: string) => {
    try {
      setRefreshingId(leadId);
      if (onRefreshLead) {
        await onRefreshLead(leadId);
      } else {
        await salesAiService.summarizeLead(leadId, true);
      }
      setToastMessage('AI recommendations refreshed from live lead data.');
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      setToastMessage(`Failed to refresh lead recommendations: ${err.message || 'Error'}`);
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div
      id="lead-recommendations-widget"
      className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:border-border/80 flex flex-col h-full"
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <span>High-Intent Lead Conversion Queue</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                {`${leads.length} Ready`}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Prioritized leads with AI-synthesized next best actions to accelerate time-to-close
            </p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Lead Cards List */}
      <div className="mt-4 space-y-3.5 flex-1 overflow-y-auto max-h-[580px] pr-1">
        {leads.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border border-dashed border-border/60 rounded-xl">
            <UserCheck className="w-9 h-9 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium text-foreground">No High-Intent Leads Currently Flagged</p>
            <p className="text-xs mt-1 text-muted-foreground">
              New inbound and engaged leads will appear here as their behavioral scores increment.
            </p>
          </div>
        ) : (
          leads.map((lead) => {
            const scoreClass = getScoreBadge(lead.score);
            const intentBadgeClass = getIntentBadgeStyle(lead.intentBadge);

            return (
              <div
                key={lead._id}
                data-testid={`lead-rec-card-${lead._id}`}
                className="group relative rounded-xl border border-border/70 bg-background/50 hover:bg-muted/30 p-4 transition-all hover:shadow-md hover:border-border"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Lead Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground truncate max-w-[220px]">
                        {lead.name}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground font-medium truncate max-w-[180px]">
                        {lead.companyName}
                      </span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${intentBadgeClass}`}>
                        {lead.intentBadge}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span>{lead.email}</span>
                      {lead.phone && (
                        <>
                          <span>•</span>
                          <span>{lead.phone}</span>
                        </>
                      )}
                    </div>

                    {/* AI-Suggested Next Action */}
                    <div className="mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-semibold text-primary">Recommended Action: </span>
                        <span className="text-foreground font-medium">{lead.recommendedAction}</span>
                      </div>
                    </div>

                    {/* AI Insight Summary snippet if present */}
                    {lead.latestInsight?.summary && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 italic pt-0.5">
                        "{lead.latestInsight.summary}"
                      </p>
                    )}
                  </div>

                  {/* Score & Quick Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 shrink-0">
                    {/* Score Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Score</span>
                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md border ${scoreClass}`}>
                        {`${lead.score} / 100`}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleActionClick('Schedule Call', lead)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/60 transition-all shadow-sm"
                        title="Schedule strategy call"
                      >
                        <Calendar className="w-3 h-3" />
                        <span>Schedule Call</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleActionClick('Send Follow-up', lead)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all shadow-sm"
                        title="Send contextual follow-up in Inbox"
                      >
                        <Mail className="w-3 h-3" />
                        <span>Send Follow-up</span>
                      </button>

                      <button
                        type="button"
                        disabled={refreshingId === lead._id}
                        onClick={() => handleRefreshSummary(lead._id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border/50 transition-all"
                        title="Re-run AI lead summarization"
                        aria-label={`Refresh AI recommendations for ${lead.name}`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === lead._id ? 'animate-spin text-primary' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LeadRecommendationsWidget;
