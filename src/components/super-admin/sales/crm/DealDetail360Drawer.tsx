import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Building2,
  User,
  Mail,
  Phone,
  DollarSign,
  Calendar,
  Clock,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ListTodo,
  History,
  ChevronRight,
} from 'lucide-react';
import { Sheet, SheetContent } from '../../../../components/Sheet';
import { Tabs, TabsList, TabsTrigger } from '../../../../components/Tabs';
import { Button } from '../../../../components/Button';
import {
  salesService,
  DealItem,
  TaskItem,
} from '../../../../services/sales.service';

export interface DealDetail360DrawerProps {
  deal: DealItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDealUpdated?: (updated: DealItem) => void;
  onInitiateHandoff?: (deal: DealItem) => void;
}

const DEFAULT_STAGES = [
  { key: 'qualification', name: 'Qualification', probability: 0.1 },
  { key: 'discovery_completed', name: 'Discovery', probability: 0.25 },
  { key: 'demo_completed', name: 'Demo Completed', probability: 0.5 },
  { key: 'proposal_sent', name: 'Proposal Sent', probability: 0.7 },
  { key: 'negotiation', name: 'Negotiation', probability: 0.85 },
  { key: 'closed_won', name: 'Closed Won', probability: 1.0 },
  { key: 'closed_lost', name: 'Closed Lost', probability: 0.0 },
];

export const DealDetail360Drawer: React.FC<DealDetail360DrawerProps> = ({
  deal: initialDeal,
  isOpen,
  onClose,
  onDealUpdated: _onDealUpdated,
  onInitiateHandoff,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'history'>('overview');

  // Fetch fresh deal data
  const { data: freshDeal } = useQuery<DealItem | null>({
    queryKey: ['sales-deal', initialDeal?._id],
    queryFn: () => (initialDeal ? salesService.getDealById(initialDeal._id) : null),
    enabled: !!initialDeal?._id && isOpen,
    initialData: initialDeal || undefined,
  });

  const deal = freshDeal || initialDeal;

  // Fetch linked tasks for this deal
  const { data: tasksData, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['sales-deal-tasks', deal?._id],
    queryFn: () => (deal ? salesService.getTasks({ dealId: deal._id, limit: 50 }) : null),
    enabled: !!deal?._id && isOpen,
  });

  const tasks: TaskItem[] = tasksData?.items || [];

  if (!deal) return null;

  // Financial Formatting
  const currency = deal.currency || 'USD';
  const formattedTCV = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(deal.value || 0);

  const formattedARR = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(deal.annualRecurringRevenue || 0);

  const formattedImplementation = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(deal.oneTimeImplementationFee || 0);

  const weightedVal =
    deal.weightedValue !== undefined
      ? deal.weightedValue
      : (deal.value || 0) * (deal.probability || 0);
  const formattedWeighted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(weightedVal);

  // Compute days in stage
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

  // Associated Entities
  const companyName =
    typeof deal.companyId === 'object' && deal.companyId?.name
      ? deal.companyId.name
      : 'Customer Company';
  const companyDomain =
    typeof deal.companyId === 'object' && deal.companyId?.domain
      ? deal.companyId.domain
      : null;

  const contactName =
    typeof deal.primaryContactId === 'object' && deal.primaryContactId?.fullName
      ? deal.primaryContactId.fullName
      : null;
  const contactEmail =
    typeof deal.primaryContactId === 'object' && deal.primaryContactId?.email
      ? deal.primaryContactId.email
      : null;
  const contactPhone =
    typeof deal.primaryContactId === 'object' && deal.primaryContactId?.phone
      ? deal.primaryContactId.phone
      : null;
  const contactTitle =
    typeof deal.primaryContactId === 'object' && deal.primaryContactId?.jobTitle
      ? deal.primaryContactId.jobTitle
      : null;

  const ownerName =
    typeof deal.ownerId === 'object' && deal.ownerId?.name
      ? deal.ownerId.name
      : typeof deal.ownerId === 'object' && deal.ownerId?.email
      ? deal.ownerId.email
      : 'Unassigned';

  // AI Deal Risk Calculations (Heuristic-based)
  const isWon = deal.stage === 'closed_won';
  const isLost = deal.stage === 'closed_lost';
  const isStagnant = !isWon && !isLost && daysInStage > 18;
  const hasCompetitors = deal.competitors && deal.competitors.length > 0;
  const overdueTasksCount = tasks.filter(
    (t) => t.status === 'pending' && new Date(t.dueDate).getTime() < Date.now()
  ).length;

  let healthScore = isWon ? 100 : isLost ? 0 : 85;
  if (isStagnant) healthScore -= 20;
  if (hasCompetitors) healthScore -= 10;
  if (overdueTasksCount > 0) healthScore -= 15;
  healthScore = Math.max(10, Math.min(100, healthScore));

  const healthColor =
    healthScore >= 75
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : healthScore >= 45
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';

  const healthLabel =
    healthScore >= 75 ? 'Healthy & On Track' : healthScore >= 45 ? 'Attention Required' : 'High Risk';

  // Current stage progression index
  const activeStageIndex = DEFAULT_STAGES.findIndex((s) => s.key === deal.stage);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl bg-white border-l border-slate-200 text-slate-900 p-0 flex flex-col h-full shadow-2xl z-50 overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/90 backdrop-blur-md flex items-start justify-between">
          <div className="space-y-1 pr-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                {deal.stage.replace('_', ' ')}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {daysInStage} {daysInStage === 1 ? 'day' : 'days'} in stage
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
              {deal.name}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5">
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                {companyName}
              </span>
              {companyDomain && (
                <span className="text-slate-400">({companyDomain})</span>
              )}
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1 text-slate-600">
                <User className="h-3.5 w-3.5 text-slate-400" />
                {ownerName}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close drawer"
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg -mr-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Stage Progression Stepper */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-[560px]">
            {DEFAULT_STAGES.filter(s => s.key !== 'closed_lost' || deal.stage === 'closed_lost').map((st, idx) => {
              const isCurrent = st.key === deal.stage;
              const isPast =
                !isLost &&
                activeStageIndex >= 0 &&
                idx < activeStageIndex;

              return (
                <div key={st.key} className="flex items-center gap-1.5 flex-1">
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all w-full justify-center border ${
                      isCurrent
                        ? isWon
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                          : isLost
                          ? 'bg-rose-50 text-rose-700 border-rose-300 font-bold'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold shadow-xs'
                        : isPast
                        ? 'bg-white text-slate-700 border-slate-200'
                        : 'bg-slate-100/70 text-slate-400 border-slate-200/60'
                    }`}
                  >
                    {isPast && <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />}
                    {isCurrent && isWon && <Sparkles className="h-3 w-3 text-emerald-600 shrink-0" />}
                    {isCurrent && isLost && <XCircle className="h-3 w-3 text-rose-600 shrink-0" />}
                    <span className="truncate">{st.name}</span>
                  </div>
                  {idx < 5 && (
                    <ChevronRight className="h-3 w-3 text-slate-400 shrink-0 -mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="border-b border-slate-200 px-6 pt-2 bg-white">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="bg-transparent border-b-0 p-0 gap-6">
              <TabsTrigger
                value="overview"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-2 py-2 text-xs font-semibold text-slate-500 data-[state=active]:text-indigo-600"
              >
                Overview & Financials
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-2 py-2 text-xs font-semibold text-slate-500 data-[state=active]:text-indigo-600 flex items-center gap-1.5"
              >
                Tasks & Activities
                {tasks.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
                    {tasks.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-2 py-2 text-xs font-semibold text-slate-500 data-[state=active]:text-indigo-600"
              >
                Stage History
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Closed Won & Enterprise Onboarding Action Banner */}
              {isWon && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <span>Closed Won Deal</span>
                    </div>
                    {deal.wonDetails?.onboardingHandedOff ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Onboarding Handed Off
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Pending Onboarding
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {deal.wonDetails?.onboardingHandedOff
                      ? `Enterprise organization provisioned. Linked Organization ID: ${deal.wonDetails.organizationId || 'Provisioned'}`
                      : 'Contract has been executed. Initiate automated provisioning to launch tenant workspace and finance customer account.'}
                  </p>

                  {!deal.wonDetails?.onboardingHandedOff && onInitiateHandoff && (
                    <Button
                      size="sm"
                      onClick={() => onInitiateHandoff(deal)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm gap-1.5 w-full sm:w-auto"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Initiate Enterprise Onboarding Handoff
                    </Button>
                  )}
                </div>
              )}

              {/* Closed Lost Banner */}
              {isLost && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2 text-rose-800">
                  <div className="flex items-center gap-2 font-semibold text-sm text-rose-700">
                    <XCircle className="h-4 w-4" />
                    <span>{`Closed Lost Reason: ${deal.lossReason || 'Unspecified'}`}</span>
                  </div>
                  {deal.lossDetails && (
                    <p className="text-xs text-rose-700/80 leading-relaxed pl-6">
                      "{deal.lossDetails}"
                    </p>
                  )}
                </div>
              )}

              {/* Financial Breakdown Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Financial & Contract Quote
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    Currency: <strong className="text-slate-800">{currency}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-xs">
                    <p className="text-[11px] text-slate-500 font-medium">Deal Value (TCV)</p>
                    <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                      {formattedTCV}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-xs">
                    <p className="text-[11px] text-slate-500 font-medium">ARR</p>
                    <p className="text-lg font-bold text-indigo-600 mt-1 tabular-nums">
                      {formattedARR}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-xs">
                    <p className="text-[11px] text-slate-500 font-medium">Win Probability</p>
                    <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                      {Math.round((deal.probability || 0) * 100)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-xs">
                    <p className="text-[11px] text-slate-500 font-medium">Weighted Forecast</p>
                    <p className="text-lg font-bold text-emerald-600 mt-1 tabular-nums">
                      {formattedWeighted}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-200">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Implementation Fee:</span>
                    <span className="text-slate-800 font-mono font-medium">
                      {formattedImplementation}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Expected Close:</span>
                    <span className="text-slate-800 font-medium">
                      {deal.expectedCloseDate
                        ? new Date(deal.expectedCloseDate).toLocaleDateString()
                        : 'Not specified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Deal Risk & Intelligence Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    AI Deal Health & Signals
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${healthColor}`}
                  >
                    Health: {healthScore}/100 • {healthLabel}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Signals List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-start gap-2 shadow-xs">
                      <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-800 font-medium block">
                          Stage Velocity
                        </span>
                        <span className="text-slate-500">
                          {daysInStage > 18
                            ? `Stalled in current stage (${daysInStage} days)`
                            : `Healthy velocity (${daysInStage} days in stage)`}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-start gap-2 shadow-xs">
                      <ShieldAlert className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-800 font-medium block">
                          Competitor Threat
                        </span>
                        <span className="text-slate-500">
                          {hasCompetitors
                            ? `Active against: ${deal.competitors?.join(', ')}`
                            : 'No direct competitors tagged'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recommended Next Action */}
                  <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 flex items-start gap-2.5">
                    <ArrowRight className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-indigo-900 block">
                        Recommended Next Action
                      </span>
                      <p className="text-xs text-indigo-700/90 mt-0.5">
                        {deal.nextAction ||
                          (isWon
                            ? 'Initiate Enterprise Onboarding Handoff to provision workspace.'
                            : isLost
                            ? 'Schedule customer loss follow-up in 90 days.'
                            : daysInStage > 14
                            ? 'Schedule alignment call with decision makers to resolve deal stalling.'
                            : 'Send proposal follow-up and schedule review meeting.')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Linked Decision Maker & Key Entities */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 pb-2 border-b border-slate-200">
                  <User className="h-4 w-4 text-slate-400" />
                  Primary Decision Maker
                </span>

                {contactName ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-xs">
                          {contactName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{contactName}</p>
                          {contactTitle && (
                            <p className="text-slate-500 text-[11px]">{contactTitle}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-slate-700">
                      {contactEmail && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{contactEmail}</span>
                        </div>
                      )}
                      {contactPhone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{contactPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">
                    No primary contact linked to this deal yet.
                  </p>
                )}
              </div>
            </>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Linked Tasks & Activities ({tasks.length})
                </h4>
              </div>

              {isLoadingTasks ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-lg bg-slate-100 animate-pulse border border-slate-200"
                    />
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-2 bg-slate-50/50">
                  <ListTodo className="h-8 w-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-medium text-slate-500">
                    No sales activities or tasks linked to this deal.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {tasks.map((task) => {
                    const isCompleted = task.status === 'completed';
                    const isOverdue =
                      !isCompleted && new Date(task.dueDate).getTime() < Date.now();

                    return (
                      <div
                        key={task._id}
                        className={`rounded-xl border p-3.5 text-xs transition-colors ${
                          isCompleted
                            ? 'border-slate-200 bg-slate-50 text-slate-500'
                            : isOverdue
                            ? 'border-rose-200 bg-rose-50/40 text-slate-800'
                            : 'border-slate-200 bg-white text-slate-800 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isCompleted
                                  ? 'bg-slate-400'
                                  : isOverdue
                                  ? 'bg-rose-500'
                                  : 'bg-indigo-600'
                              }`}
                            />
                            <span
                              className={`font-semibold ${
                                isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                              }`}
                            >
                              {task.title}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 uppercase font-mono">
                              {task.type}
                            </span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              isCompleted
                                ? 'bg-slate-100 text-slate-600'
                                : isOverdue
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            {isCompleted ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-slate-500 mt-1 pl-4 text-[11px]">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-100 pl-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                          {task.completedAt && (
                            <span className="text-emerald-600 font-mono">
                              Done on: {new Date(task.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Stage Transition Timeline
              </h4>

              {(!deal.stageHistory || deal.stageHistory.length === 0) ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-2 bg-slate-50/50">
                  <History className="h-8 w-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-medium text-slate-500">
                    No stage transitions recorded yet.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {deal.stageHistory.map((item, idx) => {
                    const toStageName = item.toStage?.replace('_', ' ') || 'Stage';
                    const fromStageName = item.fromStage?.replace('_', ' ') || 'Initial';
                    const changedByName =
                      typeof item.changedBy === 'object' && item.changedBy?.name
                        ? item.changedBy.name
                        : 'Sales Rep';

                    return (
                      <div key={idx} className="relative text-xs space-y-1">
                        <span className="absolute -left-[19px] top-1 h-3 w-3 rounded-full bg-indigo-600 border-2 border-white shadow-xs" />
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 capitalize">
                            {fromStageName} → {toStageName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {new Date(item.changedAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                          <span>By: {changedByName}</span>
                          {item.daysInPreviousStage !== undefined && (
                            <span>• Days in previous stage: {item.daysInPreviousStage}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
