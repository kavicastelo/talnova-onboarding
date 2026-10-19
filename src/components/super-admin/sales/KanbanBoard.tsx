import React, { useState } from 'react';
import {
  KanbanBoardData,
  KanbanStageColumn,
  DealItem,
} from '../../../services/sales.service';
import { DealCard } from './DealCard';
import { ClosedLostDialog } from './ClosedLostDialog';
import { ClosedWonModal } from './ClosedWonModal';
import { Layers } from 'lucide-react';

interface KanbanBoardProps {
  kanbanData: KanbanBoardData;
  onStageChange: (
    dealId: string,
    targetStage: string,
    extra?: {
      lossReason?: string;
      lossDetails?: string;
      contractSignedDate?: string;
      triggerHandoff?: boolean;
      organizationName?: string;
    }
  ) => void;
  onDealClick?: (deal: DealItem) => void;
  isLoading?: boolean;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  kanbanData,
  onStageChange,
  onDealClick,
  isLoading = false,
}) => {
  const [dragOverStageKey, setDragOverStageKey] = useState<string | null>(null);

  // Dialog states for Closed Lost and Closed Won
  const [closedLostTarget, setClosedLostTarget] = useState<{
    deal: DealItem;
    targetStageKey: string;
  } | null>(null);

  const [closedWonTarget, setClosedWonTarget] = useState<{
    deal: DealItem;
    targetStageKey: string;
  } | null>(null);

  // Helper to find deal across stages
  const findDealById = (id: string): DealItem | undefined => {
    for (const st of kanbanData.stages) {
      const found = st.deals.find((d) => d._id === id);
      if (found) return found;
    }
    return undefined;
  };

  const handleStageSelect = (deal: DealItem, targetStageKey: string) => {
    if (deal.stage === targetStageKey) return;

    if (targetStageKey === 'closed_lost') {
      setClosedLostTarget({ deal, targetStageKey });
    } else if (targetStageKey === 'closed_won') {
      setClosedWonTarget({ deal, targetStageKey });
    } else {
      onStageChange(deal._id, targetStageKey);
    }
  };

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStageKey !== stageKey) {
      setDragOverStageKey(stageKey);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, stageKey: string) => {
    // Only clear if leaving the current target column
    if (dragOverStageKey === stageKey) {
      setDragOverStageKey(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStageKey: string) => {
    e.preventDefault();
    setDragOverStageKey(null);
    const dealId = e.dataTransfer.getData('text/plain');
    if (!dealId) return;

    const deal = findDealById(dealId);
    if (!deal || deal.stage === targetStageKey) return;

    if (targetStageKey === 'closed_lost') {
      setClosedLostTarget({ deal, targetStageKey });
    } else if (targetStageKey === 'closed_won') {
      setClosedWonTarget({ deal, targetStageKey });
    } else {
      onStageChange(dealId, targetStageKey);
    }
  };

  // Stage column styling accent based on key
  const getStageAccentColor = (key: string) => {
    switch (key) {
      case 'qualification':
        return 'border-t-blue-500 bg-blue-500/5';
      case 'discovery_completed':
        return 'border-t-cyan-500 bg-cyan-500/5';
      case 'demo_completed':
        return 'border-t-indigo-500 bg-indigo-500/5';
      case 'proposal_sent':
      case 'proposal':
        return 'border-t-amber-500 bg-amber-500/5';
      case 'negotiation':
        return 'border-t-purple-500 bg-purple-500/5';
      case 'closed_won':
        return 'border-t-emerald-500 bg-emerald-500/5';
      case 'closed_lost':
        return 'border-t-rose-500 bg-rose-500/5';
      default:
        return 'border-t-slate-500 bg-slate-500/5';
    }
  };

  const stagesSummaryList = kanbanData.stages.map((st) => ({
    key: st.key,
    name: st.name,
  }));

  return (
    <div className="relative w-full">
      {/* Horizontal Scrolling Kanban Column Container */}
      <div
        id="kanban-board-container"
        className="flex w-full items-start gap-4 overflow-x-auto pb-6 pt-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
        style={{ minHeight: 'calc(100vh - 280px)' }}
      >
        {kanbanData.stages.map((column: KanbanStageColumn) => {
          const isOver = dragOverStageKey === column.key;
          const formattedStageTotal = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          }).format(column.totalValue || 0);

          const formattedWeightedTotal = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          }).format(column.weightedValue || 0);

          const probPercent = Math.round((column.probability || 0) * 100);

          return (
            <div
              key={column.key}
              id={`kanban-column-${column.key}`}
              data-stage-key={column.key}
              onDragOver={(e) => handleDragOver(e, column.key)}
              onDragLeave={(e) => handleDragLeave(e, column.key)}
              onDrop={(e) => handleDrop(e, column.key)}
              className={`flex w-80 shrink-0 flex-col rounded-2xl border border-slate-200/80 bg-slate-100/70 p-3 shadow-xs transition-all duration-200 border-t-4 ${getStageAccentColor(
                column.key
              )} ${
                isOver
                  ? 'ring-2 ring-indigo-500 border-dashed border-indigo-400 bg-indigo-50/50 scale-[1.01]'
                  : ''
              }`}
            >
              {/* Column Header */}
              <div className="mb-3 flex flex-col gap-1 border-b border-slate-200/80 pb-2.5 px-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-slate-800 truncate" title={column.name}>
                      {column.name}
                    </h3>
                    <span className="flex h-5 items-center rounded-full bg-white px-2 text-[11px] font-semibold text-slate-700 border border-slate-200 shadow-xs">
                      {column.dealCount !== undefined ? column.dealCount : (column.count || column.deals.length)}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-white/80 border border-slate-200/60 px-1.5 py-0.5 rounded">
                    {probPercent}%
                  </span>
                </div>

                {/* Column Totals */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-bold text-slate-800 tabular-nums">
                    {formattedStageTotal}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums" title="Weighted Stage Value">
                    wt. {formattedWeightedTotal}
                  </span>
                </div>
              </div>

              {/* Deal Cards Container */}
              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto min-h-[160px] max-h-[calc(100vh-360px)] px-0.5 pr-1 scrollbar-thin">
                {column.deals.length === 0 ? (
                  <div
                    className={`flex h-32 flex-col items-center justify-center rounded-xl border border-dashed text-center p-4 transition-colors ${
                      isOver
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                        : 'border-slate-300 bg-white/60 text-slate-400'
                    }`}
                  >
                    <Layers className="h-5 w-5 mb-1.5 opacity-50" />
                    <p className="text-xs font-medium">
                      {isOver ? 'Drop deal here' : 'No deals in this stage'}
                    </p>
                  </div>
                ) : (
                  column.deals.map((deal: DealItem) => (
                    <DealCard
                      key={deal._id}
                      deal={deal}
                      stages={stagesSummaryList}
                      onStageSelect={handleStageSelect}
                      onClick={onDealClick}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Closed Lost Confirmation Dialog */}
      <ClosedLostDialog
        isOpen={!!closedLostTarget}
        deal={closedLostTarget?.deal || null}
        onClose={() => setClosedLostTarget(null)}
        onConfirm={(lossReason, lossDetails) => {
          if (closedLostTarget) {
            onStageChange(closedLostTarget.deal._id, closedLostTarget.targetStageKey, {
              lossReason,
              lossDetails,
            });
            setClosedLostTarget(null);
          }
        }}
        isLoading={isLoading}
      />

      {/* Closed Won Confirmation & Handoff Modal */}
      <ClosedWonModal
        isOpen={!!closedWonTarget}
        deal={closedWonTarget?.deal || null}
        onClose={() => setClosedWonTarget(null)}
        onConfirm={(options) => {
          if (closedWonTarget) {
            onStageChange(closedWonTarget.deal._id, closedWonTarget.targetStageKey, {
              contractSignedDate: options.contractSignedDate,
              triggerHandoff: options.triggerHandoff,
              organizationName: options.organizationName,
            });
            setClosedWonTarget(null);
          }
        }}
        isLoading={isLoading}
      />
    </div>
  );
};

export default KanbanBoard;
