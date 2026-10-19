import React from 'react';
import {
  User,
  Building2,
  Mail,
  Phone,
  TrendingUp,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ICommThread } from '../../../../services/salesInbox.service';

interface LeadContextSidebarProps {
  thread: ICommThread;
  isOpen: boolean;
  onToggle: () => void;
}

export const LeadContextSidebar: React.FC<LeadContextSidebarProps> = ({
  thread,
  isOpen,
  onToggle,
}) => {
  const navigate = useNavigate();

  const lead = thread.leadId;
  const contact = thread.contactId;
  const company = thread.companyId;
  const deal = thread.dealId;

  // Resolve best contact details
  const displayName =
    contact?.fullName ||
    (contact?.firstName && `${contact.firstName} ${contact.lastName}`) ||
    lead?.fullName ||
    (lead?.firstName && `${lead.firstName} ${lead.lastName}`) ||
    thread.messages.find((m) => m.direction === 'inbound')?.from ||
    'Customer Inquiry';

  const displayEmail = contact?.email || lead?.email || 'N/A';
  const displayPhone = contact?.phone || lead?.phone || 'N/A';
  const displayCompany = company?.name || lead?.companyName || 'Unknown Organization';
  const displayJobTitle = contact?.jobTitle || 'Executive Contact';

  // Lead score calculation
  const leadScore = lead?.leadScore ?? 0;
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 40) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
  };

  const formatCurrency = (val: number, curr = 'USD') => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: curr,
        maximumFractionDigits: 0,
      }).format(val);
    } catch {
      return `$${val.toLocaleString()}`;
    }
  };

  if (!isOpen) {
    return (
      <div className="hidden lg:flex flex-col items-center py-4 px-2 border-l border-border bg-card/40 w-12 shrink-0">
        <button
          onClick={onToggle}
          title="Expand Customer 360 Context"
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <User className="w-5 h-5 text-primary" />
        </button>
      </div>
    );
  }

  return (
    <aside
      id="inbox-lead-context-sidebar"
      className="w-80 shrink-0 border-l border-border bg-card/60 backdrop-blur-md flex flex-col h-full overflow-y-auto"
    >
      {/* Header */}
      <div className="p-4 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Customer 360</h3>
        </div>
        <button
          onClick={onToggle}
          className="text-xs text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
          title="Collapse Sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Profile Card */}
        <div className="text-center p-4 rounded-xl bg-background/80 border border-border/60 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-primary/20 to-primary/40 text-primary font-bold text-lg flex items-center justify-center mx-auto mb-3 shadow-inner border border-primary/20">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <h4 className="font-bold text-foreground text-sm leading-tight">{displayName}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{displayJobTitle}</p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/40">
            <Building2 className="w-3 h-3" />
            <span className="truncate max-w-[180px]">{displayCompany}</span>
          </div>
        </div>

        {/* Lead Qualification & Score */}
        {lead && (
          <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Lead Intel
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold border ${getScoreColor(
                  leadScore
                )}`}
              >
                Score {leadScore}
              </span>
            </div>

            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, leadScore))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground">Status:</span>
              <span className="capitalize font-medium text-foreground px-2 py-0.5 rounded bg-muted/80">
                {lead.status || 'New'}
              </span>
            </div>

            <button
              type="button"
              id="view-lead-profile-btn"
              onClick={() => navigate(`/super-admin/sales/leads?search=${encodeURIComponent(displayName)}`)}
              className="w-full mt-2 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 border border-primary/20 transition-colors"
            >
              <span>View Full Lead Record</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Linked Deal Card */}
        {deal ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Active Deal
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold uppercase tracking-wider text-[10px]">
                {deal.stage}
              </span>
            </div>
            <div className="text-sm font-bold text-foreground truncate">{deal.name}</div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Deal Value:</span>
              <span className="font-bold text-emerald-600">
                {formatCurrency(deal.value, deal.currency)}
              </span>
            </div>

            <button
              type="button"
              id="view-deal-btn"
              onClick={() => navigate(`/super-admin/sales/deals?dealId=${deal._id}`)}
              className="w-full mt-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 border border-emerald-500/30 transition-colors"
            >
              <span>Open in Pipeline Kanban</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 p-3 text-center bg-background/30">
            <p className="text-xs text-muted-foreground">No deal associated with this thread.</p>
          </div>
        )}

        {/* Contact Information */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-2.5 text-xs">
          <span className="font-semibold text-foreground">Communication Channels</span>
          <div className="space-y-2 pt-1 text-muted-foreground">
            <div className="flex items-center gap-2 truncate">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate text-foreground font-mono text-[11px]">{displayEmail}</span>
            </div>
            <div className="flex items-center gap-2 truncate">
              <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate text-foreground font-mono text-[11px]">{displayPhone}</span>
            </div>
          </div>
        </div>

        {/* Assigned Agent */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-2 text-xs">
          <span className="font-semibold text-foreground">Ownership</span>
          <div className="flex items-center gap-2 pt-1">
            <div className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground font-bold flex items-center justify-center text-xs">
              {thread.assignedTo?.name ? thread.assignedTo.name.slice(0, 2).toUpperCase() : 'SA'}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-foreground truncate">
                {thread.assignedTo?.name || 'Super Admin Team'}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {thread.assignedTo?.email || 'admin@talnova.io'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default LeadContextSidebar;
