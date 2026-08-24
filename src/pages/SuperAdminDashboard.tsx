import { Building2, Users, ShieldCheck, Activity, TrendingUp, DollarSign, RefreshCw } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';
import { useSuperAdminTelemetry, useSuperAdminActivityLogs } from '../hooks/useSuperAdmin';
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

export function SuperAdminDashboard() {
  const { t } = useTranslation('dashboard');
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

  const logsPagination = usePagination({ data: systemLogs, initialPageSize: 5 });

  const isLoading = telemetryLoading || logsLoading;
  const isError = telemetryError || logsError;

  const handleRetry = () => {
    refetchTelemetry();
    refetchLogs();
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

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="col-span-2 border-white/5 bg-white/[0.02] p-6 animate-pulse h-96">
            <div className="h-full w-full rounded bg-white/5" />
          </Card>
          <Card className="border-white/5 bg-white/[0.02] p-6 animate-pulse h-96">
            <div className="h-full w-full rounded bg-white/5" />
          </Card>
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

  return (
    <div className="space-y-6 text-slate-100 bg-[#0B0F19] -m-4 lg:-m-6 p-4 lg:p-6 min-h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{t('superAdmin.title')}</h1>
        <p className="text-gray-400">System telemetry and tenant management console</p>
      </div>

      {/* Grid Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">{t('superAdmin.stats.totalOrgs')}</span>
            <Building2 className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl font-bold text-white">{stats?.totalOrganizations?.value ?? 0}</span>
            <span className="ml-2 text-xs font-semibold text-emerald-400">{stats?.totalOrganizations?.delta}</span>
          </div>
        </Card>

        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">{t('superAdmin.stats.totalUsers')}</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl font-bold text-white">{stats?.platformUsers?.value ?? 0}</span>
            <span className="ml-2 text-xs font-semibold text-emerald-400">{stats?.platformUsers?.delta}</span>
          </div>
        </Card>

        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">{t('superAdmin.stats.totalRevenue')}</span>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl font-bold text-white">${(stats?.monthlyRevenue?.value ?? 0).toLocaleString()}</span>
            <span className="ml-2 text-xs font-semibold text-emerald-400">{stats?.monthlyRevenue?.delta}</span>
          </div>
        </Card>

        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">System Health</span>
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl font-bold text-white">{stats?.systemHealth?.value ?? 0}%</span>
            <span className={`ml-2 text-xs font-semibold ${stats?.systemHealth?.status === 'UP' ? 'text-cyan-400' : 'text-rose-400'}`}>
              All services {stats?.systemHealth?.status ?? 'DOWN'}
            </span>
          </div>
        </Card>
      </div>

      {/* Charts section */}
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
    </div>
  );
}
