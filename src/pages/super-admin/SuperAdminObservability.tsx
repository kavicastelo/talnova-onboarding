import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Server,
  FileText,
  Bot,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  Database,
  Cpu,
  Zap,
  TrendingUp,
  Sliders,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { useSuperAdminFilter } from '../../context/SuperAdminFilterContext';
import {
  useSuperAdminApiObservability,
  useSuperAdminInfrastructure,
  useSuperAdminAIObservability,
  useSuperAdminStorage,
  useSuperAdminActivityEvents,
  useUpdateOrganizationStorageLimit
} from '../../hooks/useSuperAdmin';
import { toast } from 'sonner';

type TabType = 'api' | 'logs' | 'infrastructure' | 'ai' | 'storage';

export function SuperAdminObservability() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    selectedOrgId,
    severity,
    refreshKey,
  } = useSuperAdminFilter();

  // Determine initial tab from pathname
  const getTabFromPath = (path: string): TabType => {
    if (path.includes('/logs')) return 'logs';
    if (path.includes('/infrastructure')) return 'infrastructure';
    if (path.includes('/ai')) return 'ai';
    if (path.includes('/storage')) return 'storage';
    return 'api';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getTabFromPath(location.pathname));
  const [logSearch, setLogSearch] = useState('');
  const [editingOrgQuota, setEditingOrgQuota] = useState<any | null>(null);
  const [newQuotaGb, setNewQuotaGb] = useState<number>(10);

  // API Observability State (Pagination, Search, Filter, Sort)
  const [apiPage, setApiPage] = useState<number>(1);
  const [apiLimit, setApiLimit] = useState<number>(10);
  const [apiSearch, setApiSearch] = useState<string>('');
  const [apiStatus, setApiStatus] = useState<string>('all');
  const [apiSortBy, setApiSortBy] = useState<string>('count24h');
  const [apiSortOrder, setApiSortOrder] = useState<'asc' | 'desc'>('desc');
  const [copiedRoute, setCopiedRoute] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`/super-admin/observability/${tab}`);
  };

  const orgParam = selectedOrgId !== 'all' ? selectedOrgId : undefined;

  // Reset API page when org changes
  useEffect(() => {
    setApiPage(1);
  }, [selectedOrgId]);

  // Queries
  const {
    data: apiData,
    isLoading: apiLoading,
    isFetching: apiFetching,
    refetch: refetchApi,
  } = useSuperAdminApiObservability({
    organizationId: orgParam,
    page: apiPage,
    limit: apiLimit,
    search: apiSearch.trim() || undefined,
    status: apiStatus !== 'all' ? apiStatus : undefined,
    sortBy: apiSortBy,
    sortOrder: apiSortOrder,
  });
  const { data: infraData, refetch: refetchInfra } = useSuperAdminInfrastructure();
  const { data: aiData, refetch: refetchAi } = useSuperAdminAIObservability(orgParam);
  const { data: storageData, refetch: refetchStorage } = useSuperAdminStorage(orgParam);
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useSuperAdminActivityEvents({
    organizationId: orgParam,
    category: 'system',
    severity: severity !== 'all' ? severity : undefined,
    limit: 50
  });

  const updateQuotaMutation = useUpdateOrganizationStorageLimit();

  // Refetch when universal filter refreshKey triggers
  useEffect(() => {
    if (refreshKey > 0) {
      refetchApi();
      refetchInfra();
      refetchAi();
      refetchStorage();
      refetchLogs();
    }
  }, [refreshKey, refetchApi, refetchInfra, refetchAi, refetchStorage, refetchLogs]);

  const handleSaveQuota = async () => {
    if (!editingOrgQuota) return;
    try {
      await updateQuotaMutation.mutateAsync({
        id: editingOrgQuota.organizationId,
        maxStorageGb: Number(newQuotaGb),
      });
      toast.success(`Storage quota for ${editingOrgQuota.name} updated to ${newQuotaGb} GB`);
      setEditingOrgQuota(null);
      refetchStorage();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update storage quota');
    }
  };

  // Filter logs by search term
  const systemLogs = (logsData?.events || []).filter((l: any) => {
    if (!logSearch.trim()) return true;
    const term = logSearch.toLowerCase();
    return (
      l.description?.toLowerCase().includes(term) ||
      l.eventType?.toLowerCase().includes(term) ||
      l.action?.toLowerCase().includes(term) ||
      l.resourceType?.toLowerCase().includes(term)
    );
  });

  // API Observability helpers
  const handleCopyRoute = (route: string) => {
    navigator.clipboard.writeText(route);
    setCopiedRoute(route);
    toast.success('Route copied to clipboard');
    setTimeout(() => {
      setCopiedRoute((prev) => (prev === route ? null : prev));
    }, 2000);
  };

  const handleSort = (column: string) => {
    if (apiSortBy === column) {
      setApiSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setApiSortBy(column);
      setApiSortOrder(column === 'route' ? 'asc' : 'desc');
    }
    setApiPage(1);
  };

  const getMethodBadge = (method: string) => {
    const m = (method || 'GET').toUpperCase();
    let colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
    if (m === 'POST') colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    else if (m === 'PUT' || m === 'PATCH') colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
    else if (m === 'DELETE') colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${colorClasses}`}>
        {m}
      </span>
    );
  };

  const getHealthBadge = (status: string) => {
    if (status === 'healthy') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Healthy
        </span>
      );
    }
    if (status === 'degraded') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Degraded
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Critical
      </span>
    );
  };

  const getLatencyColor = (p95: number) => {
    if (p95 < 200) return 'text-emerald-600';
    if (p95 < 500) return 'text-amber-600';
    return 'text-rose-600 font-bold';
  };

  const getErrorRateColor = (rate?: number) => {
    if (!rate || rate === 0) return 'text-slate-500';
    if (rate < 5) return 'text-amber-600 font-medium';
    return 'text-rose-600 font-bold';
  };

  const apiPagination = apiData?.pagination || {
    page: 1,
    limit: apiLimit,
    total: apiData?.endpoints?.length || 0,
    totalPages: 1,
  };

  const startEntry = apiPagination.total === 0 ? 0 : (apiPagination.page - 1) * apiPagination.limit + 1;
  const endEntry = Math.min(apiPagination.page * apiPagination.limit, apiPagination.total);

  return (
    <SuperAdminShell
      title="Observability & Telemetry Suite"
      description="Real-time multi-dimensional cluster telemetry, API latencies, AI tokens, DB health, and tenant storage quotas."
      showSeverity={true}
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-xl">
          <button
            onClick={() => handleTabChange('api')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'api'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            API Observability
          </button>
          <button
            onClick={() => handleTabChange('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            System Logs
          </button>
          <button
            onClick={() => handleTabChange('infrastructure')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'infrastructure'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Server className="w-4 h-4" />
            Infrastructure & DB
          </button>
          <button
            onClick={() => handleTabChange('ai')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ai'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Bot className="w-4 h-4" />
            AI Observability
          </button>
          <button
            onClick={() => handleTabChange('storage')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'storage'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            Storage & Media
          </button>
        </div>

        {/* TAB 1: API Observability */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">P50 Latency</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">
                      {apiData?.latency?.p50 || 0} <span className="text-xs text-slate-500 font-normal">ms</span>
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> High responsiveness
                </p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">P95 Latency</p>
                    <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                      {apiData?.latency?.p95 || 0} <span className="text-xs text-slate-500 font-normal">ms</span>
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">SLA threshold: &lt; 200ms</p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Throughput (RPM)</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">
                      {apiData?.throughput?.rpm || 0}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">Live requests per minute</p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Success Rate</p>
                    <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                      {apiData?.throughput?.successRate || 100}%
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Error rate: {apiData?.throughput?.errorRate || 0}%
                </p>
              </Card>
            </div>

            {/* Endpoints Table */}
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">Critical API Routes & Telemetry</h4>
                    <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-full">
                      {apiPagination.total} {apiPagination.total === 1 ? 'Route' : 'Routes'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time 24h rolling traffic analysis, latency percentiles & SLA compliance
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchApi()}
                    disabled={apiFetching}
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm h-8"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${apiFetching ? 'animate-spin text-indigo-600' : ''}`} />
                    {apiFetching ? 'Refreshing...' : 'Refresh'}
                  </Button>
                </div>
              </div>

              {/* Toolbar: Search, Status Filter, Page Size */}
              <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search routes or methods..."
                      value={apiSearch}
                      onChange={(e) => {
                        setApiSearch(e.target.value);
                        setApiPage(1);
                      }}
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400 text-slate-800"
                    />
                    {apiSearch && (
                      <button
                        onClick={() => {
                          setApiSearch('');
                          setApiPage(1);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        title="Clear search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Status Pills */}
                  <div className="inline-flex items-center p-0.5 bg-slate-200/60 rounded-lg text-xs">
                    {(['all', 'healthy', 'degraded', 'critical'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => {
                          setApiStatus(st);
                          setApiPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-md font-medium capitalize text-xs transition-colors ${
                          apiStatus === st
                            ? 'bg-white text-slate-900 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {/* Reset Filters button if filters are active */}
                  {(apiSearch || apiStatus !== 'all') && (
                    <button
                      onClick={() => {
                        setApiSearch('');
                        setApiStatus('all');
                        setApiPage(1);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline px-1"
                    >
                      Reset filters
                    </button>
                  )}
                </div>

                {/* Page Size Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Show:</span>
                  <select
                    value={apiLimit}
                    onChange={(e) => {
                      setApiLimit(Number(e.target.value));
                      setApiPage(1);
                    }}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto relative">
                {apiLoading && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                      Loading endpoints...
                    </div>
                  </div>
                )}
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200 select-none">
                    <tr>
                      <th
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('route')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Endpoint Route</span>
                          {apiSortBy === 'route' ? (
                            apiSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('p95')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>P95 Latency</span>
                          {apiSortBy === 'p95' ? (
                            apiSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('avgLatency')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Avg Latency</span>
                          {apiSortBy === 'avgLatency' ? (
                            apiSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('count24h')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>24h Calls</span>
                          {apiSortBy === 'count24h' ? (
                            apiSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('errorRate')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Error Rate</span>
                          {apiSortBy === 'errorRate' ? (
                            apiSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Health Status</span>
                          {apiSortBy === 'status' ? (
                            apiSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {apiData?.endpoints && apiData.endpoints.length > 0 ? (
                      apiData.endpoints.map((ep: any, idx: number) => {
                        const [method, ...rest] = (ep.route || '').split(' ');
                        const path = rest.join(' ') || ep.route;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors group">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {getMethodBadge(ep.method || method)}
                                <span className="font-mono text-xs font-medium text-slate-900 select-all">
                                  {ep.path || path}
                                </span>
                                <button
                                  onClick={() => handleCopyRoute(ep.route)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                                  title="Copy route"
                                >
                                  {copiedRoute === ep.route ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs font-mono font-semibold">
                              <span className={getLatencyColor(ep.p95)}>
                                {ep.p95} ms
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs font-mono text-slate-600">
                              {ep.avgLatency !== undefined ? `${ep.avgLatency} ms` : '-'}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-700 font-mono font-medium">
                              {ep.count24h?.toLocaleString() ?? 0} calls
                            </td>
                            <td className="py-3 px-4 text-xs font-mono">
                              <span className={getErrorRateColor(ep.errorRate)}>
                                {ep.errorRate !== undefined ? `${ep.errorRate}%` : '0%'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {getHealthBadge(ep.status)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <div className="max-w-xs mx-auto text-slate-500">
                            <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            <p className="text-sm font-medium text-slate-700">No endpoints found</p>
                            <p className="text-xs text-slate-400 mt-1">
                              No API routes matched the current filters.
                            </p>
                            {(apiSearch || apiStatus !== 'all') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setApiSearch('');
                                  setApiStatus('all');
                                  setApiPage(1);
                                }}
                                className="mt-3 text-xs"
                              >
                                Clear all filters
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="p-3.5 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <div>
                  {apiPagination.total > 0 ? (
                    <span>
                      Showing <strong className="font-semibold text-slate-900">{startEntry}</strong> to{' '}
                      <strong className="font-semibold text-slate-900">{endEntry}</strong> of{' '}
                      <strong className="font-semibold text-slate-900">{apiPagination.total}</strong> routes
                    </span>
                  ) : (
                    <span>No routes available</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApiPage(1)}
                    disabled={apiPagination.page <= 1}
                    className="h-8 w-8 p-0 border-slate-200 bg-white disabled:opacity-40"
                    title="First page"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApiPage((p) => Math.max(1, p - 1))}
                    disabled={apiPagination.page <= 1}
                    className="h-8 px-2.5 border-slate-200 bg-white disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: apiPagination.totalPages }, (_, i) => i + 1)
                      .filter((p) => {
                        return (
                          p === 1 ||
                          p === apiPagination.totalPages ||
                          Math.abs(p - apiPagination.page) <= 1
                        );
                      })
                      .map((p, idx, arr) => {
                        const prev = arr[idx - 1];
                        const showEllipsis = prev && p - prev > 1;
                        return (
                          <div key={p} className="flex items-center gap-1">
                            {showEllipsis && <span className="text-slate-400 px-1">...</span>}
                            <button
                              onClick={() => setApiPage(p)}
                              className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                                p === apiPagination.page
                                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                  : 'text-slate-600 hover:bg-slate-200/60'
                              }`}
                            >
                              {p}
                            </button>
                          </div>
                        );
                      })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApiPage((p) => Math.min(apiPagination.totalPages, p + 1))}
                    disabled={apiPagination.page >= apiPagination.totalPages}
                    className="h-8 px-2.5 border-slate-200 bg-white disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApiPage(apiPagination.totalPages)}
                    disabled={apiPagination.page >= apiPagination.totalPages}
                    className="h-8 w-8 p-0 border-slate-200 bg-white disabled:opacity-40"
                    title="Last page"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: System Logs */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">System Runtime & Operational Logs</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Capturing server errors, database state changes, worker jobs, and security events</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="Filter system logs..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchLogs()}
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-slate-950 font-mono text-xs text-slate-300 space-y-2 max-h-[550px] overflow-y-auto">
                {logsLoading ? (
                  <div className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                    Streaming system runtime logs...
                  </div>
                ) : systemLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No system log events recorded in the current buffer.
                  </div>
                ) : (
                  systemLogs.map((log: any) => (
                    <div key={log.id} className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-start gap-3 hover:bg-slate-850 transition-colors">
                      <span className="text-slate-400 whitespace-nowrap text-[11px]">
                        [{new Date(log.createdAt).toISOString()}]
                      </span>
                      <span className={`uppercase font-bold text-[10px] px-1.5 py-0.5 rounded ${
                        log.severity === 'critical'
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          : log.severity === 'high' || log.severity === 'warning'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {log.severity}
                      </span>
                      <span className="text-indigo-400 font-semibold">{log.eventType || log.action}:</span>
                      <span className="text-slate-200 flex-1">{log.description}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: Infrastructure & DB */}
        {activeTab === 'infrastructure' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Node Process Metrics */}
              <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                  <Cpu className="w-5 h-5 text-indigo-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Node.js Runtime & Memory</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">Node Engine</span>
                    <p className="text-sm font-bold text-slate-900 mt-1">{infraData?.runtime?.nodeVersion || 'v20.x'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">Platform & Arch</span>
                    <p className="text-sm font-bold text-slate-900 mt-1">
                      {infraData?.runtime?.platform} / {infraData?.runtime?.arch}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">System Uptime</span>
                    <p className="text-sm font-bold text-slate-900 mt-1">{infraData?.runtime?.uptimeFormatted || '0h'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">Heap Total / Used</span>
                    <p className="text-sm font-bold text-indigo-600 mt-1">
                      {infraData?.memory?.heapUsedMB || 0} MB / {infraData?.memory?.heapTotalMB || 0} MB
                    </p>
                  </div>
                </div>
              </Card>

              {/* Database Cluster & Demo Isolation */}
              <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                  <Database className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Database Infrastructure & Clusters</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">Primary MongoDB Atlas</span>
                    <p className="text-sm font-bold text-slate-900 mt-1">{infraData?.database?.name || 'talnova'}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {infraData?.database?.state || 'CONNECTED'}
                      </span>
                      <span className="text-slate-500 font-mono">{infraData?.database?.pingMs ?? 0} ms</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">Demo Isolated Database</span>
                    <p className="text-sm font-bold text-slate-900 mt-1">{infraData?.demoDatabase?.name || 'talnova_demo'}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {infraData?.demoDatabase?.state || 'CONNECTED'}
                      </span>
                      <span className="text-slate-500 font-mono">{infraData?.demoDatabase?.pingMs ?? 0} ms</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs font-semibold text-slate-600 mb-2">Core Collection Densities</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {infraData?.database?.collections?.map((col: any) => (
                    <div key={col.name} className="p-2 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[11px] text-slate-500 truncate block font-mono">{col.name}</span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">{col.documents.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 4: AI Observability */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Foundation Engine</p>
                <h3 className="text-base font-bold text-slate-900 mt-1 truncate">{aiData?.model || 'Multi-Provider Engine'}</h3>
                <p className="text-xs text-indigo-600 mt-2">OpenAI / Gemini / Claude BYOK</p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tokens Consumed (30d)</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  {(aiData?.tokensConsumed || 0).toLocaleString()}
                </h3>
                <p className="text-xs text-slate-500 mt-2">Of {(aiData?.monthlyBudget || 0).toLocaleString()} monthly limit</p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Budget Utilization</p>
                <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                  {aiData?.utilizationPct || 0}%
                </h3>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${Math.min(100, aiData?.utilizationPct || 0)}%` }}
                  />
                </div>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Est. AI Cost</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                  ${(aiData?.costEstimateUSD || 0).toFixed(2)}
                </h3>
                <p className="text-xs text-slate-500 mt-2">Token billing & provider attribution</p>
              </Card>
            </div>

            {/* Provider Inventory Strip */}
            {aiData?.providerCounts && (
              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Tenant AI Integration Inventory (BYOK)</h4>
                  <span className="text-xs text-slate-500">Active tenant configurations</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[11px]">OpenAI</span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{aiData.providerCounts.openai || 0}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[11px]">Google Gemini</span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{aiData.providerCounts.gemini || 0}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[11px]">Anthropic Claude</span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{aiData.providerCounts.anthropic || 0}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[11px]">Azure OpenAI</span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{aiData.providerCounts.azure_openai || 0}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[11px]">Custom API</span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{aiData.providerCounts.custom || 0}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[11px]">Not Configured</span>
                    <p className="text-base font-bold text-slate-500 mt-0.5">{aiData.providerCounts.not_configured || 0}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Tenant AI Integrations Table */}
            {aiData?.byOrganization && aiData.byOrganization.length > 0 && (
              <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Tenant AI Integrations & Consumption Attribution</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Isolated tenant-level API key attribution and token utilization</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchAi()}
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Refresh
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Organization</th>
                        <th className="py-3 px-4">AI Provider</th>
                        <th className="py-3 px-4">Model</th>
                        <th className="py-3 px-4">Integration Status</th>
                        <th className="py-3 px-4">30d Requests</th>
                        <th className="py-3 px-4">30d Tokens</th>
                        <th className="py-3 px-4 text-right">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {aiData.byOrganization.map((t: any) => (
                        <tr key={t.organizationId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-900 block">{t.name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{t.slug} • {t.plan}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="capitalize font-medium text-slate-800">{t.provider.replace('_', ' ')}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-indigo-600">
                            {t.model}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                              t.status === 'valid' || t.status === 'configured'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : t.status === 'invalid'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {t.requests.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">
                            {t.tokens.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-emerald-600">
                            ${(t.costEstimateUSD || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Feature Usage Breakdown */}
            <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl">
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Platform Feature AI Breakdown</h4>
              <div className="space-y-4">
                {aiData?.featureBreakdown?.map((fb: any) => (
                  <div key={fb.feature} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{fb.feature}</p>
                      <p className="text-xs text-slate-500">{fb.requests.toLocaleString()} automated prompts executed</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono font-bold text-indigo-600">{fb.tokens.toLocaleString()}</span>
                      <span className="text-xs text-slate-500 ml-1">tokens</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 5: Storage & Media */}
        {activeTab === 'storage' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cloud Storage Provider</p>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{storageData?.provider || 'Cloudflare R2 / S3'}</h3>
                <p className="text-xs text-emerald-600 mt-2 font-medium">Shared multi-tenant bucket with tenant prefixes</p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Consumed Storage</p>
                <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                  {storageData?.totalMB || 0} <span className="text-xs text-slate-500 font-normal">MB ({storageData?.totalGB || 0} GB)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-2">Aggregate across all active organizations</p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Stored Media Objects</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  {(storageData?.totalFiles || 0).toLocaleString()}
                </h3>
                <p className="text-xs text-slate-500 mt-2">Active documents, videos & attachments</p>
              </Card>
            </div>

            {/* Storage By Type */}
            <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl">
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Object Distribution By MIME / Purpose</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {storageData?.byType?.map((st: any) => (
                  <div key={st.type} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs font-mono uppercase text-indigo-700 font-semibold">{st.type}</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-xl font-bold text-slate-900">{st.sizeMB} MB</span>
                      <span className="text-xs text-slate-500 font-mono">{st.count} files</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Tenant Storage Quota & Live Consumption Table */}
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Tenant Storage Quotas & Live Consumption</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Enforced maximum limits per organization with automatic upload blocking on quota exhaustion</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchStorage()}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Refresh
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Organization</th>
                      <th className="py-3 px-4">Plan</th>
                      <th className="py-3 px-4">Consumed Storage</th>
                      <th className="py-3 px-4">Quota Limit</th>
                      <th className="py-3 px-4">Quota Utilization</th>
                      <th className="py-3 px-4">Files</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {storageData?.byOrganization?.map((t: any) => (
                      <tr key={t.organizationId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 block">{t.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{t.slug}</span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className="bg-slate-100 text-slate-700 border border-slate-200">{t.plan}</Badge>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">
                          {t.usedMB} MB <span className="text-[11px] text-slate-500 font-normal">({t.usedGB} GB)</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-indigo-600">
                          {t.maxStorageGb} GB
                        </td>
                        <td className="py-3 px-4">
                          <div className="w-32">
                            <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                              <span>{t.percentUsed}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  t.percentUsed >= 100
                                    ? 'bg-rose-600'
                                    : t.percentUsed >= 80
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, t.percentUsed)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">
                          {t.fileCount}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                            t.storageStatus === 'healthy'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : t.storageStatus === 'warning'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {t.storageStatus === 'healthy' ? 'Normal' : t.storageStatus === 'warning' ? 'Near Quota' : 'Quota Exceeded'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingOrgQuota(t);
                              setNewQuotaGb(t.maxStorageGb || 10);
                            }}
                            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm text-xs h-7 px-2.5"
                          >
                            <Sliders className="w-3 h-3 mr-1" />
                            Adjust Quota
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Edit Storage Quota Modal */}
      {editingOrgQuota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Adjust Tenant Storage Quota</h3>
                <p className="text-xs text-slate-500 mt-0.5">{editingOrgQuota.name} ({editingOrgQuota.slug})</p>
              </div>
              <button
                onClick={() => setEditingOrgQuota(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Currently Consumed:</span>
                  <span className="font-mono font-bold text-slate-800">{editingOrgQuota.usedMB} MB ({editingOrgQuota.usedGB} GB)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Storage Limit:</span>
                  <span className="font-mono font-bold text-indigo-600">{editingOrgQuota.maxStorageGb} GB</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Storage Quota (GB)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={newQuotaGb}
                  onChange={(e) => setNewQuotaGb(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Uploads exceeding this allocation will be blocked with HTTP 413 Quota Exceeded.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingOrgQuota(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveQuota}
                disabled={updateQuotaMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {updateQuotaMutation.isPending ? 'Updating...' : 'Save New Quota'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </SuperAdminShell>
  );
}

export default SuperAdminObservability;
