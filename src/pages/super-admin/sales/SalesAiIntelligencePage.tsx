import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Kanban,
  Inbox,
} from 'lucide-react';
import AISalesCommandCenter from '../../../components/super-admin/sales/ai/AISalesCommandCenter';

export const SalesAiIntelligencePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div id="sales-ai-intelligence-page" className="p-4 md:p-6 space-y-6 max-w-[1700px] mx-auto min-h-full">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Platform Control</span>
        <span>/</span>
        <span>Sales & Acquisition</span>
        <span>/</span>
        <span className="text-foreground font-semibold">AI Intelligence</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/20 via-indigo-500/20 to-purple-500/20 text-primary flex items-center justify-center border border-primary/30 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                AI Sales Intelligence Command Center
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time pipeline diagnostics, objection rescue playbooks, lead acceleration, and sales co-pilot
              </p>
            </div>
          </div>
        </div>

        {/* Quick Navigation Links */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/super-admin/sales/deals')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60 transition-all shadow-sm"
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Deals Pipeline</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/super-admin/sales/inbox')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60 transition-all shadow-sm"
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Unified Inbox</span>
          </button>
        </div>
      </div>

      {/* AI Command Center Main Workspace */}
      <AISalesCommandCenter />
    </div>
  );
};

export default SalesAiIntelligencePage;
