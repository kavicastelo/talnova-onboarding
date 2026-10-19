import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Flame,
  BrainCircuit,
  MessageSquare,
  RefreshCw,
  Sliders,
  ArrowRight,
  TrendingDown,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import {
  AISalesOverviewData,
  salesAiService,
  AIInsightItem,
} from '../../../../services/salesAi.service';
import DealRiskAlertsWidget from './DealRiskAlertsWidget';
import LeadRecommendationsWidget from './LeadRecommendationsWidget';
import SalesAiChatDrawer from './SalesAiChatDrawer';

export const AISalesCommandCenter: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<AISalesOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchOverview = async (offline = simulateOffline) => {
    try {
      setIsRefreshing(true);
      const res = await salesAiService.getOverview(offline);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load AI Sales Overview', err);
      // Fallback structured data if network issues occur
      setData({
        configured: false,
        provider: null,
        stats: {
          highRiskDealsCount: 0,
          atRiskPipelineValue: 0,
          highIntentLeadsCount: 0,
          activeInsightsCount: 0,
          totalDealsAnalyzed: 0,
          totalLeadsAnalyzed: 0,
        },
        topRiskDeals: [],
        topIntentLeads: [],
        recentInsights: [],
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview(simulateOffline);
  }, [simulateOffline]);

  const handleUpdateInsightStatus = async (
    insightId: string,
    status: 'reviewed' | 'accepted' | 'dismissed'
  ) => {
    try {
      await salesAiService.updateInsightStatus(insightId, status);
      setStatusMessage(`Insight marked as ${status}.`);
      setTimeout(() => setStatusMessage(null), 3000);
      fetchOverview();
    } catch (err: any) {
      setStatusMessage(`Failed to update insight: ${err.message || 'Error'}`);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const isConfigured = data?.configured ?? false;

  return (
    <div id="ai-sales-command-center" className="space-y-6">
      {/* Top Controls & Co-Pilot Launch Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/20 via-indigo-500/20 to-purple-500/20 text-primary flex items-center justify-center border border-primary/30 shadow-sm">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground">AI Intelligence Co-Pilot</span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                  isConfigured
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                }`}
              >
                {isConfigured
                  ? `Active • ${data?.provider?.toUpperCase() || 'AI'}`
                  : 'AI Offline'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Automated deal risk diagnosis, objection rescue playbooks, and conversion triggers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Offline Simulator Switch for testing */}
          <button
            type="button"
            onClick={() => setSimulateOffline((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 transition-all"
            title="Toggle simulated offline state"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{simulateOffline ? 'Simulating Offline' : 'Live Mode'}</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => fetchOverview()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span>Refresh Intelligence</span>
          </button>

          {/* Chat with Sales AI Button */}
          <button
            type="button"
            id="open-sales-ai-chat-btn"
            onClick={() => setIsChatOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground hover:opacity-95 transition-all shadow-md hover:shadow-primary/20"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat with Sales Data</span>
          </button>
        </div>
      </div>

      {/* Offline Alert Banner */}
      {!isConfigured && (
        <div
          id="ai-offline-banner"
          data-testid="ai-offline-banner"
          className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-sm animate-in fade-in duration-300"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>AI Intelligence Offline</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Configuration Required
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                  No active AI model provider (OpenAI GPT-4o or Google Gemini) credentials have been configured. To
                  unlock live automated deal risk analysis, objection detection, and natural language sales querying,
                  please connect your API keys.
                </p>
              </div>
            </div>

            <button
              type="button"
              id="configure-sales-integrations-btn"
              onClick={() => navigate('/super-admin/sales/integrations')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-all shadow-md shrink-0 self-start sm:self-auto"
            >
              <span>Configure Sales Integrations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Status Feedback Toast */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* At-Risk Pipeline Value */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>At-Risk Pipeline</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">
              ${(data?.stats.atRiskPipelineValue || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-rose-400 mt-1 font-medium flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              <span>Requires proactive tactical intervention</span>
            </p>
          </div>
        </div>

        {/* High Risk Deals */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>High Risk Deals</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">
              {data?.stats.highRiskDealsCount ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Deals stalled &gt; 14 days or health &lt; 60
            </p>
          </div>
        </div>

        {/* High-Intent Conversion Leads */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>High-Intent Leads</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">
              {data?.stats.highIntentLeadsCount ?? 0}
            </div>
            <p className="text-[11px] text-emerald-400 mt-1 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Ready for immediate closing push</span>
            </p>
          </div>
        </div>

        {/* Active Insights */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Pending AI Insights</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">
              {data?.stats.activeInsightsCount ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Synthesized playbooks pending review
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column Grid: Deal Risk Alerts & Lead Conversion Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DealRiskAlertsWidget
          deals={data?.topRiskDeals || []}
          onRefreshDeal={async (dealId) => {
            await salesAiService.analyzeDealRisk(dealId, true);
            await fetchOverview();
          }}
          isLoading={isLoading}
        />

        <LeadRecommendationsWidget
          leads={data?.topIntentLeads || []}
          onRefreshLead={async (leadId) => {
            await salesAiService.summarizeLead(leadId, true);
            await fetchOverview();
          }}
          isLoading={isLoading}
        />
      </div>

      {/* Recent AI Insights Timeline */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                Recent Executive AI Insights
              </h3>
              <p className="text-xs text-muted-foreground">
                Audit history of AI model outputs, recommended actions, and manager review statuses
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {(!data?.recentInsights || data.recentInsights.length === 0) ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No recent AI insights recorded in the database.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                  <th className="pb-3 font-semibold">Target / Type</th>
                  <th className="pb-3 font-semibold">Title & Summary</th>
                  <th className="pb-3 font-semibold">Recommended Action</th>
                  <th className="pb-3 font-semibold">Priority</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {data.recentInsights.map((insight: AIInsightItem) => (
                  <tr key={insight._id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 pr-3 font-medium text-foreground capitalize">
                      <span className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border text-[11px]">
                        {insight.targetType}
                      </span>
                    </td>
                    <td className="py-3 pr-3 max-w-xs">
                      <div className="font-semibold text-foreground truncate">{insight.title}</div>
                      <div className="text-muted-foreground text-[11px] truncate">{insight.summary}</div>
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground text-[11px] max-w-[200px] truncate">
                      {insight.recommendedAction || '—'}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                          insight.priority === 'urgent'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : insight.priority === 'high'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {insight.priority}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                          insight.status === 'accepted'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : insight.status === 'reviewed'
                            ? 'bg-indigo-500/15 text-indigo-400'
                            : insight.status === 'dismissed'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {insight.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {insight.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateInsightStatus(insight._id, 'accepted')}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateInsightStatus(insight._id, 'dismissed')}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:bg-muted border border-border/50 transition-all"
                          >
                            Dismiss
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Slide-Out AI Chat Assistant Drawer */}
      <SalesAiChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        isAiConfigured={isConfigured}
      />
    </div>
  );
};

export default AISalesCommandCenter;
