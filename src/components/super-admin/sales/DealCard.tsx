import React from 'react';
import {
  Building2,
  Calendar,
  Clock,
  TrendingUp,
  User,
  Sparkles,
} from 'lucide-react';
import { DealItem } from '../../../services/sales.service';

interface DealCardProps {
  deal: DealItem;
  stages?: { key: string; name: string }[];
  onStageSelect?: (deal: DealItem, targetStageKey: string) => void;
  onClick?: (deal: DealItem) => void;
  isDragging?: boolean;
}

export const DealCard: React.FC<DealCardProps> = ({
  deal,
  stages = [],
  onStageSelect,
  onClick,
  isDragging = false,
}) => {
  // Format monetary value
  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: deal.currency || 'USD',
    maximumFractionDigits: 0,
  }).format(deal.value || 0);

  // Compute weighted value
  const weightedVal =
    deal.weightedValue !== undefined
      ? deal.weightedValue
      : (deal.value || 0) * (deal.probability || 0);
  const formattedWeighted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: deal.currency || 'USD',
    maximumFractionDigits: 0,
  }).format(weightedVal);

  // Calculate days in current stage
  const lastHistoryEntry =
    deal.stageHistory && deal.stageHistory.length > 0
      ? deal.stageHistory[deal.stageHistory.length - 1]
      : null;
  const stageSinceDate = lastHistoryEntry?.changedAt
    ? new Date(lastHistoryEntry.changedAt)
    : new Date(deal.createdAt || Date.now());
  const daysInStage = Math.max(
    0,
    Math.floor((Date.now() - stageSinceDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Format close date if present
  const formattedCloseDate = deal.expectedCloseDate
    ? new Date(deal.expectedCloseDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  // Resolve company name
  const companyName =
    typeof deal.companyId === 'object' && deal.companyId?.name
      ? deal.companyId.name
      : 'Enterprise Prospect';

  // Resolve owner display
  const ownerName =
    typeof deal.ownerId === 'object' && deal.ownerId?.name
      ? deal.ownerId.name
      : typeof deal.ownerId === 'object' && deal.ownerId?.profile?.fullName
      ? deal.ownerId.profile.fullName
      : 'Unassigned';
  const ownerInitials = ownerName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Color-code probability badge
  const probPercent = Math.round((deal.probability || 0) * 100);
  const getProbabilityBadgeStyle = (prob: number) => {
    if (prob >= 70) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (prob >= 40) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', deal._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      id={`deal-card-${deal._id}`}
      data-deal-id={deal._id}
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick && onClick(deal)}
      className={`group relative flex flex-col gap-2.5 rounded-xl border border-white/5 bg-slate-900/80 p-3.5 shadow-md backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:bg-slate-900 hover:shadow-indigo-500/10 hover:shadow-lg cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''
      }`}
    >
      {/* Top Header: Deal Name & Value */}
      <div className="flex items-start justify-between gap-2">
        <h4
          className="font-medium text-sm text-slate-100 line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors"
          title={deal.name}
        >
          {deal.name}
        </h4>
        <span className="font-semibold text-sm text-slate-100 shrink-0 tabular-nums">
          {formattedValue}
        </span>
      </div>

      {/* Company Name */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate" title={companyName}>
          {companyName}
        </span>
      </div>

      {/* Metadata Badges: Probability & Weighted Value */}
      <div className="flex items-center justify-between gap-1.5 pt-1 text-xs">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium tabular-nums ${getProbabilityBadgeStyle(
            probPercent
          )}`}
          title={`Probability: ${probPercent}%`}
        >
          <TrendingUp className="h-3 w-3" />
          {probPercent}%
        </span>

        <span
          className="text-[11px] text-slate-400 tabular-nums"
          title={`Weighted Value: ${formattedWeighted}`}
        >
          wt. {formattedWeighted}
        </span>
      </div>

      {/* Bottom Footer: Days in Stage, Close Date, Owner Avatar, Stage Select */}
      <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          {/* Days in stage indicator */}
          <span
            className="inline-flex items-center gap-1 text-slate-400"
            title={`${daysInStage} day(s) in current stage`}
          >
            <Clock className="h-3 w-3 text-slate-400" />
            <span>{daysInStage}d</span>
          </span>

          {/* Close date if present */}
          {formattedCloseDate && (
            <span
              className="inline-flex items-center gap-1 text-slate-400"
              title={`Expected Close: ${formattedCloseDate}`}
            >
              <Calendar className="h-3 w-3 text-slate-400" />
              <span>{formattedCloseDate}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Stage Transition Dropdown */}
          {stages.length > 0 && onStageSelect && (
            <div
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <select
                aria-label="Quick Move Stage"
                className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300 hover:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                value={deal.stage}
                onChange={(e) => {
                  const targetKey = e.target.value;
                  if (targetKey !== deal.stage) {
                    onStageSelect(deal, targetKey);
                  }
                }}
              >
                {stages.map((st) => (
                  <option key={st.key} value={st.key}>
                    Move to: {st.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Owner Avatar / Initials */}
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-semibold text-indigo-300 ring-1 ring-white/10"
            title={`Owner: ${ownerName}`}
          >
            {ownerInitials || <User className="h-3 w-3" />}
          </div>
        </div>
      </div>

      {/* Won Indicator / Onboarding Badge if already handed off */}
      {deal.wonDetails?.onboardingHandedOff && (
        <div className="mt-1 flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
          <Sparkles className="h-2.5 w-2.5" />
          <span>Handed Off to Onboarding</span>
        </div>
      )}
    </div>
  );
};

export default DealCard;
