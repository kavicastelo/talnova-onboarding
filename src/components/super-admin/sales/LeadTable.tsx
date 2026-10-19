import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../Table';
import { Button } from '../../Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../../DropdownMenu';
import {
  MoreHorizontal,
  RefreshCw,
  Trash2,
  ExternalLink,
  Building,
  User,
  Mail,
  Phone,
} from 'lucide-react';
import {
  salesService,
  LeadItem,
  LeadStatus,
  LeadPriority,
} from '../../../services/sales.service';

interface LeadTableProps {
  leads: LeadItem[];
  isLoading: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onSelectLead?: (lead: LeadItem) => void;
  onCreateLeadClick?: () => void;
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

const PRIORITY_VARIANTS: Record<LeadPriority, { label: string; badge: string }> = {
  urgent: { label: 'Urgent', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
  high: { label: 'High', badge: 'bg-orange-100 text-orange-800 border-orange-300' },
  normal: { label: 'Normal', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  low: { label: 'Low', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
};

export function LeadTable({
  leads,
  isLoading,
  total,
  page,
  limit,
  totalPages,
  onPageChange,
  onSelectLead,
  onCreateLeadClick,
}: LeadTableProps) {
  const queryClient = useQueryClient();
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);

  // Recalculate score mutation
  const recalculateMutation = useMutation({
    mutationFn: (leadId: string) => salesService.recalculateScore(leadId),
    onMutate: (id) => setRecalculatingId(id),
    onSettled: () => setRecalculatingId(null),
    onSuccess: (updated) => {
      toast.success(`Score updated: ${updated.score} pts (${updated.priority})`);
      queryClient.invalidateQueries({ queryKey: ['sales-leads'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to recalculate score');
    },
  });

  // Status transition mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      salesService.updateLeadStatus(id, { status }),
    onSuccess: (updated) => {
      toast.success(`Lead status moved to ${STATUS_VARIANTS[updated.status]?.label || updated.status}`);
      queryClient.invalidateQueries({ queryKey: ['sales-leads'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Illegal status transition';
      toast.error(msg);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesService.deleteLead(id),
    onSuccess: () => {
      toast.success('Lead deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-leads'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete lead');
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-purple-600 bg-purple-500';
    if (score >= 50) return 'text-emerald-600 bg-emerald-500';
    if (score >= 25) return 'text-blue-600 bg-blue-500';
    return 'text-slate-500 bg-slate-400';
  };

  const formatSource = (source: string) => {
    return source.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
        <div className="space-y-4">
          <div className="h-6 bg-slate-100 rounded w-1/4 animate-pulse" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-50 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
        <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
          <User className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No leads found</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
          No prospective leads match your current search and filter criteria. You can create a new lead or import a CSV batch.
        </p>
        {onCreateLeadClick && (
          <Button
            onClick={onCreateLeadClick}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Create New Lead
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHead className="py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Lead / Contact
              </TableHead>
              <TableHead className="py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Company & Role
              </TableHead>
              <TableHead className="py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Status
              </TableHead>
              <TableHead className="py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Score & Priority
              </TableHead>
              <TableHead className="py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Source
              </TableHead>
              <TableHead className="py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Created
              </TableHead>
              <TableHead className="py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right pr-6">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const statusCfg = STATUS_VARIANTS[lead.status] || STATUS_VARIANTS.new;
              const priorityCfg = PRIORITY_VARIANTS[lead.priority] || PRIORITY_VARIANTS.normal;
              const initials = lead.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <TableRow
                  key={lead._id}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  onClick={() => onSelectLead && onSelectLead(lead)}
                >
                  {/* Lead / Contact */}
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-medium text-xs flex items-center justify-center shadow-sm">
                        {initials}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                          {lead.name}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {lead.email}
                          </span>
                          {lead.phone && (
                            <span className="flex items-center gap-1 text-slate-400">
                              • <Phone className="w-3 h-3" /> {lead.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Company & Role */}
                  <TableCell className="py-3.5">
                    <div className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      {lead.companyName}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {lead.jobTitle || 'Decision Maker'}
                      {lead.companySize && ` • ${lead.companySize} emp`}
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-3.5" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.bg} ${statusCfg.text} hover:opacity-80 transition-opacity`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                          {statusCfg.label}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44 bg-white shadow-xl border border-slate-200">
                        <DropdownMenuLabel className="text-xs text-slate-400 uppercase font-semibold">
                          Update Status
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {(['new', 'contacted', 'engaged', 'qualified', 'opportunity', 'nurturing', 'disqualified', 'lost'] as LeadStatus[]).map(
                          (targetStatus) => {
                            const isCurrent = lead.status === targetStatus;
                            return (
                              <DropdownMenuItem
                                key={targetStatus}
                                onClick={() => {
                                  if (!isCurrent) {
                                    statusMutation.mutate({ id: lead._id, status: targetStatus });
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
                  </TableCell>

                  {/* Score & Priority */}
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-14">
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                          <span className={getScoreColor(lead.score).split(' ')[0]}>
                            {lead.score}
                          </span>
                          <span className="text-[10px] text-slate-400">/100</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getScoreColor(lead.score).split(' ')[1]}`}
                            style={{ width: `${Math.min(100, Math.max(0, lead.score))}%` }}
                          />
                        </div>
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${priorityCfg.badge}`}
                      >
                        {priorityCfg.label}
                      </span>
                    </div>
                  </TableCell>

                  {/* Source */}
                  <TableCell className="py-3.5 text-xs text-slate-600 font-medium">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px]">
                      {formatSource(lead.source)}
                    </span>
                  </TableCell>

                  {/* Created Date */}
                  <TableCell className="py-3.5 text-xs text-slate-500">
                    {new Date(lead.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>

                  {/* Actions Dropdown */}
                  <TableCell className="py-3.5 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-white shadow-xl border border-slate-200">
                        <DropdownMenuItem
                          onClick={() => onSelectLead && onSelectLead(lead)}
                          className="text-xs flex items-center gap-2 cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                          View Lead 360
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => {
                            if (recalculatingId !== lead._id) {
                              recalculateMutation.mutate(lead._id);
                            }
                          }}
                          className={`text-xs flex items-center gap-2 cursor-pointer ${
                            recalculatingId === lead._id ? 'opacity-50 pointer-events-none' : ''
                          }`}
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 text-slate-500 ${
                              recalculatingId === lead._id ? 'animate-spin' : ''
                            }`}
                          />
                          Recalculate Score
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete lead '${lead.name}'?`)) {
                              deleteMutation.mutate(lead._id);
                            }
                          }}
                          className="text-xs flex items-center gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          Delete Lead
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Bar */}
      <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs text-slate-600">
        <div>
          Showing <span className="font-semibold">{(page - 1) * limit + 1}</span> to{' '}
          <span className="font-semibold">{Math.min(total, page * limit)}</span> of{' '}
          <span className="font-semibold">{total}</span> leads
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="h-8 px-2.5 text-xs"
          >
            Previous
          </Button>
          <span className="text-xs text-slate-500 px-1">
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="h-8 px-2.5 text-xs"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export default LeadTable;
