import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserCheck,
  Flame,
  Globe,
  Plus,
  Search,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react';
import { SuperAdminShell } from '../../../components/super-admin/SuperAdminShell';
import { Card, CardContent } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { LeadTable } from '../../../components/super-admin/sales/LeadTable';
import { CreateLeadModal } from '../../../components/super-admin/sales/CreateLeadModal';
import { LeadProfile360Drawer } from '../../../components/super-admin/sales/leads/LeadProfile360Drawer';
import {
  salesService,
  LeadItem,
} from '../../../services/sales.service';

export function SuperAdminLeads() {
  const queryClient = useQueryClient();

  // Search & Filter State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'score' | 'priority' | 'name' | 'companyName'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Query Leads with TanStack Query
  const {
    data: leadsData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: [
      'sales-leads',
      {
        page,
        limit,
        search: debouncedSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        source: sourceFilter !== 'all' ? sourceFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        sortBy,
        sortOrder,
      },
    ],
    queryFn: () =>
      salesService.getLeads({
        page,
        limit,
        search: debouncedSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        source: sourceFilter !== 'all' ? sourceFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        sortBy,
        sortOrder,
      }),
  });

  const leads: LeadItem[] = leadsData?.items || [];
  const total = leadsData?.pagination?.total || 0;
  const totalPages = leadsData?.pagination?.totalPages || 1;

  // Compute live KPI metrics from query data
  const qualifiedCount = leads.filter((l: LeadItem) => ['qualified', 'opportunity', 'converted'].includes(l.status)).length;
  const highPotentialCount = leads.filter((l: LeadItem) => l.score >= 50).length;
  const avgScore = leads.length > 0 ? Math.round(leads.reduce((acc: number, l: LeadItem) => acc + (l.score || 0), 0) / leads.length) : 0;

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setSourceFilter('all');
    setPriorityFilter('all');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  return (
    <SuperAdminShell
      title="Lead Management"
      subtitle="Enterprise sales pipeline, automated prospect scoring, and CRM lead routing."
      showTenant={false}
      showSeverity={false}
      showEnvironment={false}
      actions={
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 text-xs bg-white text-slate-700 hover:bg-slate-50 border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setIsCreateModalOpen(true)}
            size="sm"
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Lead
          </Button>
        </div>
      }
    >
      {/* 4 Top KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leads */}
        <Card className="border border-slate-200 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Pipeline Leads
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{total}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Database records</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Qualified Leads */}
        <Card className="border border-slate-200 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Qualified / Opps
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                {qualifiedCount}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Sales-ready prospects</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* High Potential (Hot) */}
        <Card className="border border-slate-200 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                High Potential (≥50 pts)
              </p>
              <h3 className="text-2xl font-bold text-purple-600 mt-1">
                {highPotentialCount}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Scored by AI & rules</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Avg Lead Score */}
        <Card className="border border-slate-200 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Avg Lead Score
              </p>
              <h3 className="text-2xl font-bold text-blue-600 mt-1">
                {avgScore} <span className="text-sm font-normal text-slate-400">/ 100</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Across active page</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar Card */}
      <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                type="text"
                placeholder="Search leads by name, company, email, or job title..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs bg-slate-50/50 border-slate-300 w-full"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-medium text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="engaged">Engaged</option>
                  <option value="qualified">Qualified</option>
                  <option value="opportunity">Opportunity</option>
                  <option value="converted">Converted</option>
                  <option value="nurturing">Nurturing</option>
                  <option value="disqualified">Disqualified</option>
                  <option value="unresponsive">Unresponsive</option>
                  <option value="lost">Lost</option>
                </select>
              </div>

              {/* Source Filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-medium text-slate-500">Source:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Sources</option>
                  <option value="website">Website</option>
                  <option value="product_demo">Product Demo</option>
                  <option value="referral">Referral</option>
                  <option value="campaign">Campaign</option>
                  <option value="inbound_email">Inbound Email</option>
                  <option value="import">CSV Import</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-medium text-slate-500">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={`${sortBy}:${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split(':');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="createdAt:desc">Newest First</option>
                  <option value="createdAt:asc">Oldest First</option>
                  <option value="score:desc">Highest Score</option>
                  <option value="score:asc">Lowest Score</option>
                  <option value="name:asc">Name (A-Z)</option>
                  <option value="companyName:asc">Company (A-Z)</option>
                </select>
              </div>

              {/* Reset Filters */}
              {(searchInput ||
                statusFilter !== 'all' ||
                sourceFilter !== 'all' ||
                priorityFilter !== 'all' ||
                sortBy !== 'createdAt') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <LeadTable
        leads={leads}
        isLoading={isLoading}
        total={total}
        page={page}
        limit={limit}
        totalPages={totalPages}
        onPageChange={(newPage) => setPage(newPage)}
        onSelectLead={(lead) => setSelectedLead(lead)}
        onCreateLeadClick={() => setIsCreateModalOpen(true)}
      />

      {/* Create Lead Modal */}
      <CreateLeadModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['sales-leads'] });
        }}
      />

      {/* Lead Profile 360 Drawer */}
      <LeadProfile360Drawer
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onLeadUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['sales-leads'] });
        }}
      />
    </SuperAdminShell>
  );
}

export default SuperAdminLeads;
