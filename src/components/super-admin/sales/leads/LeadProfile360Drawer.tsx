import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  X,
  Mail,
  Phone,
  MessageCircle,
  Building,
  Tag,
  DollarSign,
  TrendingUp,
  User,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Sheet, SheetContent } from '../../../Sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../Tabs';
import { Button } from '../../../Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../../../DropdownMenu';
import { LeadTimeline } from './LeadTimeline';
import { LeadNotesWidget } from './LeadNotesWidget';
import { LeadScoreBreakdownWidget } from './LeadScoreBreakdownWidget';
import {
  salesService,
  LeadItem,
  LeadStatus,
} from '../../../../services/sales.service';

interface LeadProfile360DrawerProps {
  lead: LeadItem | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated?: (updated: LeadItem) => void;
}

const STATUS_VARIANTS: Record<
  LeadStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  new: { label: 'New', bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700', dot: 'bg-sky-500' },
  contacted: { label: 'Contacted', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  engaged: { label: 'Engaged', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  qualified: { label: 'Qualified', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  opportunity: { label: 'Opportunity', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  converted: { label: 'Converted', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-800', dot: 'bg-teal-600' },
  nurturing: { label: 'Nurturing', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  disqualified: { label: 'Disqualified', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
  unresponsive: { label: 'Unresponsive', bg: 'bg-slate-100 border-slate-300', text: 'text-slate-600', dot: 'bg-slate-400' },
  lost: { label: 'Lost', bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  duplicate: { label: 'Duplicate', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-600', dot: 'bg-zinc-400' },
};

export function LeadProfile360Drawer({
  lead: initialLead,
  isOpen,
  onClose,
  onLeadUpdated,
}: LeadProfile360DrawerProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // Keep lead data fresh via real-time query
  const { data: freshLead } = useQuery({
    queryKey: ['sales-lead', initialLead?._id],
    queryFn: () => (initialLead ? salesService.getLeadById(initialLead._id) : null),
    enabled: !!initialLead?._id && isOpen,
    initialData: initialLead || undefined,
  });

  const lead = freshLead || initialLead;

  // Status transition mutation
  const statusMutation = useMutation({
    mutationFn: (targetStatus: LeadStatus) => {
      if (!lead) throw new Error('No lead selected');
      return salesService.updateLeadStatus(lead._id, { status: targetStatus });
    },
    onSuccess: (updated) => {
      toast.success(`Lead moved to ${STATUS_VARIANTS[updated.status]?.label || updated.status}`);
      queryClient.invalidateQueries({ queryKey: ['sales-leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales-lead', lead?._id] });
      if (onLeadUpdated) onLeadUpdated(updated);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Status transition failed';
      toast.error(msg);
    },
  });

  if (!lead) return null;

  const statusCfg = STATUS_VARIANTS[lead.status] || STATUS_VARIANTS.new;
  const initials = lead.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 40) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-2xl bg-white p-0 border-l border-slate-200 shadow-2xl flex flex-col h-full overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-base flex items-center justify-center shadow-md">
                {initials}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  {lead.name}
                </h2>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span className="font-medium text-slate-700 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    {lead.companyName}
                  </span>
                  {lead.jobTitle && <span>• {lead.jobTitle}</span>}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Badges & Scores */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200/60">
            {/* Status Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.text} hover:opacity-85 shadow-2xs transition-all`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                  {statusCfg.label}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-white shadow-xl border border-slate-200">
                <DropdownMenuLabel className="text-xs text-slate-400 uppercase font-semibold">
                  Transition Status
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['new', 'contacted', 'engaged', 'qualified', 'opportunity', 'converted', 'nurturing', 'disqualified', 'lost'] as LeadStatus[]).map(
                  (targetStatus) => {
                    const isCurrent = lead.status === targetStatus;
                    return (
                      <DropdownMenuItem
                        key={targetStatus}
                        onClick={() => {
                          if (!isCurrent) {
                            statusMutation.mutate(targetStatus);
                          }
                        }}
                        className={`text-xs font-medium cursor-pointer ${
                          isCurrent ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        {STATUS_VARIANTS[targetStatus].label}
                      </DropdownMenuItem>
                    );
                  }
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Score & Priority */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${getScoreColor(
                  lead.score
                )}`}
              >
                <Sparkles className="w-3 h-3" />
                Score: {lead.score} / 100
              </span>

              <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-300">
                {lead.priority}
              </span>
            </div>
          </div>

          {/* Quick Action Buttons Toolbar */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors shadow-2xs"
              >
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                Email
              </a>
            )}

            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors shadow-2xs"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                Call
              </a>
            )}

            {(lead.whatsapp || lead.phone) && (
              <a
                href={`https://wa.me/${(lead.whatsapp || lead.phone || '').replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors shadow-2xs"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                WhatsApp
              </a>
            )}

            {lead.status !== 'opportunity' && lead.status !== 'converted' && (
              <Button
                size="sm"
                onClick={() => statusMutation.mutate('opportunity')}
                disabled={statusMutation.isPending}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 h-7.5 px-3 ml-auto shadow-2xs"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Convert to Deal
              </Button>
            )}
          </div>
        </div>

        {/* Tabbed Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full bg-slate-100 p-1 rounded-xl mb-6">
              <TabsTrigger value="overview" className="text-xs font-semibold py-1.5">
                Overview
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs font-semibold py-1.5">
                Timeline
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs font-semibold py-1.5">
                Notes ({lead.notes?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="score" className="text-xs font-semibold py-1.5">
                Scoring
              </TabsTrigger>
            </TabsList>

            {/* 1. OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-6">
              {/* Contact Information */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Work Email</span>
                    <span className="font-semibold text-slate-900">{lead.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Direct Phone</span>
                    <span className="font-semibold text-slate-900">{lead.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">WhatsApp</span>
                    <span className="font-semibold text-slate-900">{lead.whatsapp || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Location</span>
                    <span className="font-semibold text-slate-900">
                      {[lead.country, lead.region].filter(Boolean).join(', ') || 'Not specified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Company Information */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-indigo-600" />
                  Company & Organization
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Company Name</span>
                    <span className="font-semibold text-slate-900">{lead.companyName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Industry</span>
                    <span className="font-semibold text-slate-900">{lead.industry || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Company Size</span>
                    <span className="font-semibold text-slate-900">
                      {lead.companySize ? `${lead.companySize} employees` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Target Role</span>
                    <span className="font-semibold text-slate-900">{lead.jobTitle || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Sales Attribution & Budget */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                  Sales Attribution & Pipeline
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Acquisition Source</span>
                    <span className="font-semibold text-slate-900 capitalize">
                      {lead.source.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Estimated Budget</span>
                    <span className="font-semibold text-slate-900">
                      {lead.estimatedBudget
                        ? `${lead.currency || 'USD'} ${lead.estimatedBudget.toLocaleString()}`
                        : 'Not provided'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Assigned Owner</span>
                    <span className="font-semibold text-slate-900">
                      {lead.assignedOwnerId?.name || lead.assignedOwnerId?.email || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Expected Purchase</span>
                    <span className="font-semibold text-slate-900">
                      {lead.expectedPurchaseDate
                        ? new Date(lead.expectedPurchaseDate).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                {lead.tags && lead.tags.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-400 block text-[11px] mb-1.5">Assigned Tags</span>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.tags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5 text-slate-400" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Lifecycle Timestamps */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" /> Created Date
                  </span>
                  <span className="font-semibold">
                    {new Date(lead.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" /> Last Updated
                  </span>
                  <span className="font-semibold">
                    {new Date(lead.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </TabsContent>

            {/* 2. TIMELINE TAB */}
            <TabsContent value="timeline">
              <LeadTimeline lead={lead} />
            </TabsContent>

            {/* 3. NOTES TAB */}
            <TabsContent value="notes">
              <LeadNotesWidget lead={lead} />
            </TabsContent>

            {/* 4. SCORE BREAKDOWN TAB */}
            <TabsContent value="score">
              <LeadScoreBreakdownWidget lead={lead} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default LeadProfile360Drawer;
