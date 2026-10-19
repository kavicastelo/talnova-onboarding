import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Inbox,
  Megaphone,
} from 'lucide-react';
import UnifiedInboxLayout from '../../../components/super-admin/sales/inbox/UnifiedInboxLayout';

export const SalesInboxPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const threadId = searchParams.get('threadId');

  return (
    <div id="sales-inbox-page" className="p-4 md:p-6 space-y-4 max-w-[1700px] mx-auto h-full flex flex-col">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Platform Control</span>
        <span>/</span>
        <span>Sales & Acquisition</span>
        <span>/</span>
        <span className="text-foreground font-semibold">Unified Inbox</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Unified Communication Inbox
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aggregate inbound customer conversations across Email & WhatsApp with contextual replies
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="inbox-new-campaign-btn"
            onClick={() => navigate('/super-admin/sales/campaigns/new')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60 transition-all shadow-sm"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* 3-Pane Unified Inbox Workspace */}
      <UnifiedInboxLayout initialThreadId={threadId} />
    </div>
  );
};

export default SalesInboxPage;
