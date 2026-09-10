import React, { useState } from 'react';
import { Building2, Users, ShieldCheck, Activity, TrendingUp, DollarSign, RefreshCw, Plus, Ban, CheckCircle } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';
import {
  useSuperAdminTelemetry,
  useSuperAdminStats,
  useSuperAdminActivityLogs,
  useSuperAdminOrganizations,
  useCreateOrganization,
  useToggleOrganizationStatus
} from '../hooks/useSuperAdmin';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export function SuperAdminDashboard() {
  const { t } = useTranslation('dashboard');

  // Stats & Telemetry
  const { data: statsData } = useSuperAdminStats();
  const { 
    data: telemetry, 
    isLoading: telemetryLoading, 
    isError: telemetryError, 
    refetch: refetchTelemetry 
  } = useSuperAdminTelemetry();

  const { 
    data: systemLogs = [], 
    isLoading: logsLoading, 
    isError: logsError,
    refetch: refetchLogs 
  } = useSuperAdminActivityLogs();

  // Organizations Roster on Dashboard
  const [orgSearch, setOrgSearch] = useState('');
  const [orgPage, setOrgPage] = useState(1);
  const { data: orgsData, refetch: refetchOrgs } = useSuperAdminOrganizations({
    search: orgSearch || undefined,
    page: orgPage,
    limit: 10
  });

  const createOrgMutation = useCreateOrganization();
  const toggleStatusMutation = useToggleOrganizationStatus();

  // Provision Modal State
  const [showModal, setShowModal] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantDomain, setTenantDomain] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPlan, setTenantPlan] = useState<'Starter' | 'Growth' | 'Enterprise'>('Enterprise');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logsPagination = usePagination({ data: systemLogs, initialPageSize: 5 });

  const isLoading = telemetryLoading || logsLoading;
  const isError = telemetryError || logsError;

  const handleRetry = () => {
    refetchTelemetry();
    refetchLogs();
    refetchOrgs();
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim() || !tenantDomain.trim() || !tenantEmail.trim()) {
      toast.error('Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createOrgMutation.mutateAsync({
        name: tenantName.trim(),
        domain: tenantDomain.trim(),
        adminEmail: tenantEmail.trim(),
        plan: tenantPlan
      });

      toast.success(`Tenant "${tenantName}" provisioned successfully.`);
      setShowModal(false);
      setTenantName('');
      setTenantDomain('');
      setTenantEmail('');
      setTenantPlan('Enterprise');
      refetchOrgs();
      refetchTelemetry();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to provision tenant.';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: 'Active' | 'Suspended') => {
    const nextStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    try {
      await toggleStatusMutation.mutateAsync({ id, status: nextStatus });
      toast.success(`Organization status updated to ${nextStatus}.`);
      refetchOrgs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update organization status.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 text-slate-100 bg-[#0B0F19] -m-4 lg:-m-6 p-4 lg:p-6 min-h-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Super Admin Portal</h1>
          <p className="text-gray-400">System telemetry and tenant management console</p>
        </div>
        
        {/* Loading Skeletons */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-white/5 bg-white/[0.02] p-5 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="h-4 w-4 rounded bg-white/10" />
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <div className="h-8 w-16 rounded bg-white/10" />
                <div className="h-3 w-10 rounded bg-white/10" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center text-slate-100 bg-[#0B0F19] -m-4 lg:-m-6 p-4 lg:p-6 min-h-full">
        <div className="rounded-full bg-rose-500/10 p-3 text-rose-400">
          <Activity className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Telemetry Sync Failed</h2>
          <p className="mt-1 text-sm text-gray-400">Could not retrieve system telemetry statistics from backend APIs.</p>
        </div>
        <Button 
          onClick={handleRetry} 
          className="flex items-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Retry Connection
        </Button>
      </div>
    );
  }

  const stats = telemetry?.stats;
  const growthData = telemetry?.growthData || [];
  const organizations = orgsData?.data || [];
  const totalTenants = statsData?.totalTenants ?? stats?.totalOrganizations?.value ?? organizations.length;
  const systemHealthScore = statsData?.systemHealth ?? stats?.systemHealth?.value ?? 99.8;
  const systemHealthStatus = statsData?.systemHealthStatus ?? stats?.systemHealth?.status ?? 'UP';
  const mrrValue = statsData?.mrr ?? stats?.monthlyRevenue?.value ?? 0;

  return (
    <div className="space-y-6 text-slate-100 bg-[#0B0F19] -m-4 lg:-m-6 p-4 lg:p-6 min-h-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('superAdmin.title')}</h1>
          <p className="text-gray-400">System telemetry and tenant management console</p>
        </div>
        <Button 
          id="provision-tenant-btn"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 font-medium shadow-lg shadow-indigo-500/20"
        >
          <Plus className="h-4 w-4" />
          Provision New Tenant
        </Button>
      </div>

      {/* Grid Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">Total Tenants</span>
            <Building2 className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl font-bold text-white" id="stat-total-tenants">{totalTenants}</span>
            <span className="ml-2 text-xs font-semibold text-emerald-400">{stats?.totalOrganizations?.delta || '+100%'}</span>
          </div>
        </Card>

        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">System Health</span>
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl font-bold text-white" id="stat-system-health">{systemHealthScore}%</span>
            <span className={`ml-2 text-xs font-semibold ${systemHealthStatus === 'UP' ? 'text-cyan-400' : 'text-rose-400'}`}>
              All services {systemHealthStatus}
            </span>
          </div>
        </Card>

        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">MRR</span>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl font-bold text-white" id="stat-mrr">${mrrValue.toLocaleString()}</span>
            <span className="ml-2 text-xs font-semibold text-emerald-400">{stats?.monthlyRevenue?.delta || '+12%'}</span>
          </div>
        </Card>

        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">Platform Users</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl font-bold text-white">{stats?.platformUsers?.value ?? 0}</span>
            <span className="ml-2 text-xs font-semibold text-emerald-400">{stats?.platformUsers?.delta || '+5%'}</span>
          </div>
        </Card>
      </div>

      {/* Organizations Roster Table */}
      <Card className="overflow-hidden border-white/5 bg-white/[0.02]">
        <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Organizations Roster</h3>
            <p className="text-xs text-gray-400">Active and provisioned customer tenant accounts</p>
          </div>
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={orgSearch}
              onChange={(e) => {
                setOrgSearch(e.target.value);
                setOrgPage(1);
              }}
              placeholder="Filter tenants..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-1.5 px-3 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300" id="tenant-table">
            <thead className="bg-white/[0.03] text-xs font-semibold uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-6 py-3.5">Organization</th>
                <th className="px-6 py-3.5">Domain</th>
                <th className="px-6 py-3.5">Plan</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Users</th>
                <th className="px-6 py-3.5">Created</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {organizations.map((org) => (
                <tr key={org.id} id={`tenant-row-${org.id}`} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-white tenant-name-cell">{org.name}</div>
                        <div className="text-xs text-gray-500">{org.supportEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-indigo-300 tenant-domain-cell">
                    {org.domain || `${org.slug}.talnova.app`}
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{org.plan}</td>
                  <td className="px-6 py-4">
                    <Badge className={
                      org.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }>
                      {org.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-gray-400">{org.usersCount}</td>
                  <td className="px-6 py-4 text-gray-400">{org.createdAt}</td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      id={`suspend-tenant-btn-${org.id}`}
                      variant="ghost"
                      size="sm"
                      disabled={toggleStatusMutation.isPending}
                      onClick={() => handleToggleStatus(org.id, org.status)}
                      className={`gap-1.5 px-3 py-1 text-xs ${org.status === 'Active' ? 'text-rose-400 hover:bg-rose-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                    >
                      {org.status === 'Active' ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      {org.status === 'Active' ? 'Suspend' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
              {organizations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No organizations available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Charts & Activity Logs */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="col-span-2 border-white/5 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">System Monthly Growth</h3>
              <p className="text-xs text-gray-400">Comparison of MRR revenue and active users</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>MoM upward trend</span>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: 'white', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="MRR ($)" />
                <Area type="monotone" dataKey="users" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" name="Active Users" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* System logs feed */}
        <Card className="border-white/5 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-semibold text-white">Cross-Tenant Activity</h3>
          </div>
          <div className="space-y-4">
            {logsPagination.paginatedData.map((log) => (
              <div key={log.id} className="flex items-start gap-3 border-b border-white/5 pb-3.5 last:border-0 last:pb-0">
                <div className={`mt-0.5 rounded-full p-1.5 ${
                  log.type === 'finance' ? 'bg-amber-500/10 text-amber-400' :
                  log.type === 'user' ? 'bg-emerald-500/10 text-emerald-400' :
                  log.type === 'journey' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-white/5 text-gray-400'
                }`}>
                  <Activity className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold text-gray-300">{log.org}</span>
                    <span className="shrink-0 text-[10px] text-gray-500">{log.time}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400 leading-snug">{log.event}</p>
                </div>
              </div>
            ))}
            {systemLogs.length === 0 && (
              <div className="text-center text-xs text-gray-500 py-8">
                No activity logs available.
              </div>
            )}

            <SimplePagination
              currentPage={logsPagination.page}
              totalPages={logsPagination.totalPages}
              totalItems={logsPagination.totalItems}
              startIndex={logsPagination.startIndex}
              endIndex={logsPagination.endIndex}
              pageSize={logsPagination.pageSize}
              onPageChange={logsPagination.setPage}
              onPageSizeChange={logsPagination.setPageSize}
              itemLabel="logs"
            />
          </div>
        </Card>
      </div>

      {/* Provision New Tenant Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" id="provision-tenant-modal">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0F131E] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-white">Provision New Tenant</h3>
                <p className="text-xs text-gray-400 mt-0.5">Deploy a new multi-tenant workspace with an administrative root owner.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Organization Name
                </label>
                <input
                  id="tenant-name-input"
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="e.g. Global Logistics Corp"
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 px-3.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Domain
                </label>
                <input
                  id="tenant-domain-input"
                  type="text"
                  required
                  value={tenantDomain}
                  onChange={(e) => setTenantDomain(e.target.value)}
                  placeholder="e.g. globallogistics.test"
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 px-3.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Admin Email
                </label>
                <input
                  id="tenant-admin-email-input"
                  type="email"
                  required
                  value={tenantEmail}
                  onChange={(e) => setTenantEmail(e.target.value)}
                  placeholder="e.g. admin@globallogistics.test"
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 px-3.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Subscription Tier
                </label>
                <select
                  id="tenant-tier-select"
                  value={tenantPlan}
                  onChange={(e) => setTenantPlan(e.target.value as any)}
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-[#161B26] py-2.5 px-3 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Starter">Starter Plan</option>
                  <option value="Growth">Growth Plan</option>
                  <option value="Enterprise">Enterprise Plan</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border-white/10 bg-transparent text-white hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  id="create-tenant-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 font-medium shadow-lg shadow-indigo-500/20"
                >
                  {isSubmitting ? 'Provisioning...' : 'Create Tenant'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
