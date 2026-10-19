import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Kanban,
  Table as TableIcon,
  Search,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Layers,
  Award,
} from 'lucide-react';
import { SuperAdminShell } from '../../../components/super-admin/SuperAdminShell';
import { Card, CardContent } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { KanbanBoard } from '../../../components/super-admin/sales/KanbanBoard';
import { DealsTable } from '../../../components/super-admin/sales/crm/DealsTable';
import { DealDetail360Drawer } from '../../../components/super-admin/sales/crm/DealDetail360Drawer';
import { DealHandoffModal } from '../../../components/super-admin/sales/crm/DealHandoffModal';
import {
  salesService,
  KanbanBoardData,
  DealItem,
  PipelineItem,
} from '../../../services/sales.service';

export function SalesDealsPage() {
  const queryClient = useQueryClient();

  // View Mode: 'kanban' | 'table'
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Drawer & Modal States
  const [selectedDeal, setSelectedDeal] = useState<DealItem | null>(null);
  const [handoffDeal, setHandoffDeal] = useState<DealItem | null>(null);

  // Search & Filter State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');

  // Table Pagination & Sorting State
  const [tablePage, setTablePage] = useState<number>(1);
  const [tableLimit, setTableLimit] = useState<number>(20);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setTablePage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 1. Fetch Pipelines to allow pipeline switcher
  const { data: pipelines = [] } = useQuery<PipelineItem[]>({
    queryKey: ['sales-pipelines'],
    queryFn: () => salesService.getPipelines(),
  });

  // Automatically select default pipeline when loaded
  useEffect(() => {
    if (!selectedPipelineId && pipelines.length > 0) {
      const defaultPipe = pipelines.find((p) => p.isDefault) || pipelines[0];
      setSelectedPipelineId(defaultPipe._id);
    }
  }, [pipelines, selectedPipelineId]);

  // 2. Fetch Kanban Board Data (also provides summary totals)
  const kanbanQueryKey = [
    'sales-kanban',
    {
      pipelineId: selectedPipelineId || undefined,
      search: debouncedSearch || undefined,
    },
  ];

  const {
    data: kanbanData,
    isLoading: isLoadingKanban,
    isRefetching: isRefetchingKanban,
    refetch: refetchKanban,
  } = useQuery<KanbanBoardData>({
    queryKey: kanbanQueryKey,
    queryFn: () =>
      salesService.getKanbanBoard({
        pipelineId: selectedPipelineId || undefined,
        search: debouncedSearch || undefined,
      }),
    enabled: true,
  });

  // 3. Fetch Table Deals Data
  const dealsTableQueryKey = [
    'sales-deals-table',
    {
      page: tablePage,
      limit: tableLimit,
      pipelineId: selectedPipelineId || undefined,
      stage: selectedStage || undefined,
      search: debouncedSearch || undefined,
      sortBy,
      sortOrder,
    },
  ];

  const {
    data: tableData,
    isLoading: isLoadingTable,
    refetch: refetchTable,
  } = useQuery({
    queryKey: dealsTableQueryKey,
    queryFn: () =>
      salesService.getDeals({
        page: tablePage,
        limit: tableLimit,
        pipelineId: selectedPipelineId || undefined,
        stage: selectedStage || undefined,
        search: debouncedSearch || undefined,
        sortBy: sortBy as any,
        sortOrder,
      }),
    enabled: viewMode === 'table',
  });

  // Handle column sort toggle in table
  const handleSortChange = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('desc');
    }
    setTablePage(1);
  };

  // 4. Stage Transition Mutation with Optimistic Updates & Error Rollback
  const updateStageMutation = useMutation({
    mutationFn: async ({
      dealId,
      targetStage,
      extra,
    }: {
      dealId: string;
      targetStage: string;
      extra?: {
        lossReason?: string;
        lossDetails?: string;
        contractSignedDate?: string;
        triggerHandoff?: boolean;
        organizationName?: string;
      };
    }) => {
      // 1. Update deal stage
      const updatedDeal = await salesService.updateDealStage(dealId, {
        stage: targetStage,
        lossReason: extra?.lossReason,
        lossDetails: extra?.lossDetails,
        wonDetails: extra?.contractSignedDate
          ? {
              contractSignedDate: extra.contractSignedDate,
              onboardingHandedOff: extra.triggerHandoff || false,
            }
          : undefined,
      });

      // 2. Optionally trigger immediate enterprise handoff if requested
      if (targetStage === 'closed_won' && extra?.triggerHandoff) {
        await salesService.handoffDealToOnboarding(dealId, {
          organizationName: extra.organizationName,
        });
      }

      return updatedDeal;
    },
    onMutate: async ({ dealId, targetStage }) => {
      await queryClient.cancelQueries({ queryKey: kanbanQueryKey });
      const previousData = queryClient.getQueryData<KanbanBoardData>(kanbanQueryKey);

      if (previousData) {
        let movedDeal: DealItem | null = null;

        const optimisticStages = previousData.stages.map((st) => {
          const dealIdx = st.deals.findIndex((d) => d._id === dealId);
          if (dealIdx > -1) {
            movedDeal = { ...st.deals[dealIdx], stage: targetStage };
            const nextDeals = [...st.deals];
            nextDeals.splice(dealIdx, 1);
            return {
              ...st,
              dealCount: nextDeals.length,
              deals: nextDeals,
            };
          }
          return st;
        });

        if (movedDeal) {
          const finalStages = optimisticStages.map((st) => {
            if (st.key === targetStage) {
              return {
                ...st,
                dealCount: st.deals.length + 1,
                deals: [movedDeal as DealItem, ...st.deals],
              };
            }
            return st;
          });

          queryClient.setQueryData<KanbanBoardData>(kanbanQueryKey, {
            ...previousData,
            stages: finalStages,
          });
        }
      }

      return { previousData };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(kanbanQueryKey, context.previousData);
      }
      const msg = err.response?.data?.message || err.message || 'Stage transition failed';
      toast.error(msg);
    },
    onSuccess: (updated) => {
      toast.success(`Deal moved to ${updated.stage.replace('_', ' ')}`);
      queryClient.invalidateQueries({ queryKey: ['sales-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['sales-deals'] });
      queryClient.invalidateQueries({ queryKey: ['sales-deals-table'] });
      if (selectedDeal?._id === updated._id) {
        setSelectedDeal(updated);
      }
    },
  });

  // Calculate live KPI metrics across pipeline
  const totalPipelineVal = kanbanData?.totals?.totalValue || 0;
  const totalWeightedVal = kanbanData?.totals?.weightedValue || 0;
  const totalDealsCount = kanbanData?.totals?.dealCount || 0;

  const wonStage = kanbanData?.stages?.find((s) => s.key === 'closed_won');
  const wonValue = wonStage?.totalValue || 0;

  const formattedTotalVal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(totalPipelineVal);

  const formattedWeightedVal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(totalWeightedVal);

  const formattedWonVal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(wonValue);

  // Available stages list for filters
  const stagesSummaryList = kanbanData?.stages
    ? kanbanData.stages.map((st) => ({ key: st.key, name: st.name }))
    : [];

  const handleRefresh = () => {
    if (viewMode === 'kanban') {
      refetchKanban();
    } else {
      refetchTable();
    }
  };

  return (
    <SuperAdminShell>
      <div className="space-y-5 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
              <Kanban className="h-6 w-6 text-indigo-400" />
              Deals & Pipeline
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Interactive B2B sales pipeline with weighted forecasting, stage transitions, and enterprise onboarding handoff.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Mode Toggle Switcher */}
            <div className="flex items-center rounded-lg border border-slate-700/80 bg-slate-800/80 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                data-testid="deals-view-kanban-btn"
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                data-testid="deals-view-table-btn"
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                Table
              </button>
            </div>

            {/* Pipeline Selector */}
            {pipelines.length > 1 && (
              <select
                aria-label="Select Pipeline"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={selectedPipelineId}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
              >
                {pipelines.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} {p.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            )}

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoadingKanban || isRefetchingKanban}
              className="border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5 text-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefetchingKanban ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* KPI Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card className="border-white/5 bg-slate-900/60 shadow-md backdrop-blur-md">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Total Pipeline Value</p>
                <h3 className="text-xl font-bold text-slate-100 mt-0.5 tabular-nums">
                  {formattedTotalVal}
                </h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-slate-900/60 shadow-md backdrop-blur-md">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Weighted Forecast</p>
                <h3 className="text-xl font-bold text-indigo-400 mt-0.5 tabular-nums">
                  {formattedWeightedVal}
                </h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-slate-900/60 shadow-md backdrop-blur-md">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Active Deals</p>
                <h3 className="text-xl font-bold text-slate-100 mt-0.5 tabular-nums">
                  {totalDealsCount}
                </h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Layers className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-slate-900/60 shadow-md backdrop-blur-md">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Closed Won Value</p>
                <h3 className="text-xl font-bold text-emerald-400 mt-0.5 tabular-nums">
                  {formattedWonVal}
                </h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Award className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Content (Kanban vs Table) */}
        {viewMode === 'kanban' ? (
          <div className="space-y-4">
            {/* Search Input for Kanban */}
            <div className="flex items-center gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="deals-search-input"
                  data-testid="deals-search-input"
                  type="text"
                  placeholder="Filter pipeline by deal title or company..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Interactive Kanban Board */}
            {kanbanData ? (
              <KanbanBoard
                kanbanData={kanbanData}
                onStageChange={(dealId, targetStage, extra) =>
                  updateStageMutation.mutate({ dealId, targetStage, extra })
                }
                onDealClick={(deal) => setSelectedDeal(deal)}
                isLoading={isLoadingKanban}
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20">
                <p className="text-xs text-slate-400">Loading Kanban pipeline...</p>
              </div>
            )}
          </div>
        ) : (
          /* Table View */
          <DealsTable
            deals={tableData?.items || []}
            isLoading={isLoadingTable}
            total={tableData?.pagination?.total || 0}
            page={tablePage}
            limit={tableLimit}
            totalPages={tableData?.pagination?.totalPages || 1}
            onPageChange={setTablePage}
            onLimitChange={setTableLimit}
            onSelectDeal={(deal) => setSelectedDeal(deal)}
            onInitiateHandoff={(deal) => setHandoffDeal(deal)}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            selectedStage={selectedStage}
            onStageChange={(st) => {
              setSelectedStage(st);
              setTablePage(1);
            }}
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            stages={stagesSummaryList}
          />
        )}

        {/* Slide-out Deal Detail 360 Drawer */}
        <DealDetail360Drawer
          deal={selectedDeal}
          isOpen={!!selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onInitiateHandoff={(deal) => setHandoffDeal(deal)}
          onDealUpdated={(updated) => {
            queryClient.invalidateQueries({ queryKey: ['sales-kanban'] });
            queryClient.invalidateQueries({ queryKey: ['sales-deals-table'] });
            setSelectedDeal(updated);
          }}
        />

        {/* Enterprise Onboarding Handoff Modal */}
        <DealHandoffModal
          deal={handoffDeal}
          isOpen={!!handoffDeal}
          onClose={() => setHandoffDeal(null)}
          onHandoffSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['sales-kanban'] });
            queryClient.invalidateQueries({ queryKey: ['sales-deals-table'] });
            if (selectedDeal && selectedDeal._id === handoffDeal?._id) {
              salesService.getDealById(selectedDeal._id).then((fresh) => {
                setSelectedDeal(fresh);
              });
            }
          }}
        />
      </div>
    </SuperAdminShell>
  );
}

export default SalesDealsPage;
