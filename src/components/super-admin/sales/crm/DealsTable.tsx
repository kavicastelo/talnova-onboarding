import React from 'react';
import {
  Building2,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Sparkles,
  Trash2,
  Layers,
  Search,
  CheckCircle2,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../../components/Table';
import { Button } from '../../../../components/Button';
import { Input } from '../../../../components/Input';
import { DealItem } from '../../../../services/sales.service';

export interface DealsTableProps {
  deals: DealItem[];
  isLoading: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onLimitChange?: (newLimit: number) => void;
  onSelectDeal: (deal: DealItem) => void;
  onInitiateHandoff?: (deal: DealItem) => void;
  onDeleteDeal?: (deal: DealItem) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (column: string) => void;
  // Filters
  selectedStage: string;
  onStageChange: (stage: string) => void;
  searchValue: string;
  onSearchChange: (search: string) => void;
  stages?: { key: string; name: string }[];
}

const STAGE_BADGES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  qualification: {
    label: 'Qualification',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  discovery_completed: {
    label: 'Discovery',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/20',
  },
  demo_completed: {
    label: 'Demo Completed',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
  },
  proposal_sent: {
    label: 'Proposal Sent',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  negotiation: {
    label: 'Negotiation',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
  },
  closed_won: {
    label: 'Closed Won',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  closed_lost: {
    label: 'Closed Lost',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
  },
};

export const DealsTable: React.FC<DealsTableProps> = ({
  deals,
  isLoading,
  total,
  page,
  limit,
  totalPages,
  onPageChange,
  onSelectDeal,
  onInitiateHandoff,
  onDeleteDeal,
  sortBy,
  sortOrder,
  onSortChange,
  selectedStage,
  onStageChange,
  searchValue,
  onSearchChange,
  stages = [],
}) => {
  const renderSortIndicator = (columnKey: string) => {
    if (sortBy !== columnKey) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-40 ml-1.5" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-indigo-400 ml-1.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-indigo-400 ml-1.5" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Table Filters Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex flex-1 items-center gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              id="deals-table-search-input"
              data-testid="deals-table-search-input"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search deals by title or company..."
              className="pl-9 bg-slate-950/80 border-slate-700/80 text-xs text-slate-200 placeholder:text-slate-400 h-9"
            />
          </div>

          {/* Stage Dropdown Filter */}
          <select
            aria-label="Filter by Stage"
            value={selectedStage}
            onChange={(e) => onStageChange(e.target.value)}
            className="h-9 rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Stages</option>
            {stages.length > 0
              ? stages.map((st) => (
                  <option key={st.key} value={st.key}>
                    {st.name}
                  </option>
                ))
              : Object.entries(STAGE_BADGES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
          </select>
        </div>

        {(searchValue || selectedStage) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange('');
              onStageChange('');
            }}
            className="text-xs text-slate-400 hover:text-slate-200 h-8 self-end sm:self-auto"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Main Table Container */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-lg backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-slate-950/80 border-b border-slate-800">
            <TableRow className="border-slate-800 hover:bg-transparent">
              {/* Deal Title */}
              <TableHead
                onClick={() => onSortChange('name')}
                className="cursor-pointer text-xs font-semibold text-slate-300 hover:text-indigo-400 transition-colors py-3 pl-4"
              >
                <div className="flex items-center">
                  <span>Deal Title</span>
                  {renderSortIndicator('name')}
                </div>
              </TableHead>

              {/* Company */}
              <TableHead className="text-xs font-semibold text-slate-300 py-3">
                Associated Company
              </TableHead>

              {/* Stage */}
              <TableHead className="text-xs font-semibold text-slate-300 py-3">
                Stage
              </TableHead>

              {/* Value */}
              <TableHead
                onClick={() => onSortChange('value')}
                className="cursor-pointer text-xs font-semibold text-slate-300 hover:text-indigo-400 transition-colors py-3 text-right"
              >
                <div className="flex items-center justify-end">
                  <span>Deal Value</span>
                  {renderSortIndicator('value')}
                </div>
              </TableHead>

              {/* Win Probability */}
              <TableHead
                onClick={() => onSortChange('probability')}
                className="cursor-pointer text-xs font-semibold text-slate-300 hover:text-indigo-400 transition-colors py-3 text-center"
              >
                <div className="flex items-center justify-center">
                  <span>Probability</span>
                  {renderSortIndicator('probability')}
                </div>
              </TableHead>

              {/* Weighted Value */}
              <TableHead className="text-xs font-semibold text-slate-300 py-3 text-right">
                Weighted Value
              </TableHead>

              {/* Expected Close */}
              <TableHead
                onClick={() => onSortChange('expectedCloseDate')}
                className="cursor-pointer text-xs font-semibold text-slate-300 hover:text-indigo-400 transition-colors py-3"
              >
                <div className="flex items-center">
                  <span>Expected Close</span>
                  {renderSortIndicator('expectedCloseDate')}
                </div>
              </TableHead>

              {/* Owner */}
              <TableHead className="text-xs font-semibold text-slate-300 py-3">
                Owner
              </TableHead>

              {/* Actions */}
              <TableHead className="text-xs font-semibold text-slate-300 py-3 text-right pr-4">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              // Loading Skeleton Slices
              [1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i} className="border-slate-800/80">
                  <TableCell colSpan={9} className="py-4">
                    <div className="h-5 w-full rounded bg-slate-800/40 animate-pulse" />
                  </TableCell>
                </TableRow>
              ))
            ) : deals.length === 0 ? (
              // Empty State (Zero-Mock clean display)
              <TableRow className="border-none hover:bg-transparent">
                <TableCell colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-2.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/50 text-slate-400 border border-slate-700/50">
                      <Layers className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-200">No Deals Found</h3>
                    <p className="text-xs text-slate-400 text-center leading-relaxed">
                      {searchValue || selectedStage
                        ? 'No deals match your current search and filter criteria.'
                        : 'Your deals pipeline is currently clear. Create or convert qualified leads to start tracking opportunities.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => {
                const currency = deal.currency || 'USD';
                const formattedVal = new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency,
                  maximumFractionDigits: 0,
                }).format(deal.value || 0);

                const weightedVal =
                  deal.weightedValue !== undefined
                    ? deal.weightedValue
                    : (deal.value || 0) * (deal.probability || 0);
                const formattedWeighted = new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency,
                  maximumFractionDigits: 0,
                }).format(weightedVal);

                const companyName =
                  typeof deal.companyId === 'object' && deal.companyId?.name
                    ? deal.companyId.name
                    : 'Customer Organization';

                const ownerName =
                  typeof deal.ownerId === 'object' && deal.ownerId?.name
                    ? deal.ownerId.name
                    : typeof deal.ownerId === 'object' && deal.ownerId?.email
                    ? deal.ownerId.email
                    : 'Unassigned';

                const stageCfg =
                  STAGE_BADGES[deal.stage] || {
                    label: deal.stage.replace('_', ' '),
                    bg: 'bg-slate-800',
                    text: 'text-slate-300',
                    border: 'border-slate-700',
                  };

                const isWon = deal.stage === 'closed_won';
                const isHandedOff = deal.wonDetails?.onboardingHandedOff;

                return (
                  <TableRow
                    key={deal._id}
                    className="border-slate-800/80 hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectDeal(deal)}
                  >
                    {/* Deal Title */}
                    <TableCell className="pl-4 py-3 font-medium text-slate-200">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors">
                          {deal.name}
                        </span>
                        {deal.nextAction && (
                          <span className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                            Next: {deal.nextAction}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Company */}
                    <TableCell className="py-3 text-xs text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[160px]">{companyName}</span>
                      </div>
                    </TableCell>

                    {/* Stage Badge */}
                    <TableCell className="py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${stageCfg.bg} ${stageCfg.text} ${stageCfg.border}`}
                      >
                        {stageCfg.label}
                      </span>
                    </TableCell>

                    {/* Deal Value */}
                    <TableCell className="py-3 text-right font-bold text-slate-100 text-xs tabular-nums">
                      {formattedVal}
                    </TableCell>

                    {/* Probability */}
                    <TableCell className="py-3 text-center text-xs">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {Math.round((deal.probability || 0) * 100)}%
                      </span>
                    </TableCell>

                    {/* Weighted Value */}
                    <TableCell className="py-3 text-right text-xs font-semibold text-emerald-400 tabular-nums">
                      {formattedWeighted}
                    </TableCell>

                    {/* Expected Close */}
                    <TableCell className="py-3 text-xs text-slate-400">
                      {deal.expectedCloseDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          <span>
                            {new Date(deal.expectedCloseDate).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </TableCell>

                    {/* Owner */}
                    <TableCell className="py-3 text-xs text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-[10px]">
                          {ownerName.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[120px]">{ownerName}</span>
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell
                      className="py-3 text-right pr-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Handoff CTA if won and not yet handed off */}
                        {isWon && !isHandedOff && onInitiateHandoff && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onInitiateHandoff(deal)}
                            className="h-7 text-[11px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 gap-1 px-2"
                            title="Initiate Enterprise Onboarding Handoff"
                          >
                            <Sparkles className="h-3 w-3 text-emerald-400" />
                            Handoff
                          </Button>
                        )}

                        {isWon && isHandedOff && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            title="Onboarding Provisioned"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Provisioned
                          </span>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSelectDeal(deal)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
                          title="View Deal 360"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>

                        {onDeleteDeal && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDeleteDeal(deal)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-400"
                            title="Delete Deal"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        {total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-950/60 border-t border-slate-800 text-xs text-slate-400">
            <div>
              Showing{' '}
              <span className="font-medium text-slate-200">
                {(page - 1) * limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium text-slate-200">
                {Math.min(page * limit, total)}
              </span>{' '}
              of <span className="font-medium text-slate-200">{total}</span> deals
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="h-7 px-2.5 text-xs border-slate-700 bg-slate-900 text-slate-300 disabled:opacity-40"
              >
                Previous
              </Button>

              <span className="px-2 font-mono text-[11px] text-slate-300">
                {page} / {totalPages || 1}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="h-7 px-2.5 text-xs border-slate-700 bg-slate-900 text-slate-300 disabled:opacity-40"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
