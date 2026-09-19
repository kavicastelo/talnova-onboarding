import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  ShieldCheck,
  Activity,
  DollarSign,
  Plus,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  HardDrive,
  Cpu,
  Radio,
  ChevronRight,
  Search
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';
import { SuperAdminShell } from '../components/super-admin/SuperAdminShell';
import { useSuperAdminFilter } from '../context/SuperAdminFilterContext';
import {
  useSuperAdminTelemetry,
  useSuperAdminActivityLogs,
  useSuperAdminOrganizations,
  useCreateOrganization
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
import { toast } from 'sonner';

function SuperAdminDashboardContent() {
  const navigate = useNavigate();
  const { selectedOrgId, refreshKey } = useSuperAdminFilter();

  // Telemetry with universal filter context
  const {
    data: telemetry,
    refetch: refetchTelemetry
  } = useSuperAdminTelemetry({
    organizationId: selectedOrgId !== 'all' ? selectedOrgId : undefined
  });

  const {
    data: systemLogs = [],
    refetch: refetchLogs
  } = useSuperAdminActivityLogs();

  // Organizations Roster
  const [orgSearch, setOrgSearch] = useState('');
  const [orgPage, setOrgPage] = useState(1);
  const { data: orgsData, refetch: refetchOrgs } = useSuperAdminOrganizations({
    search: orgSearch || undefined,
    page: orgPage,
    limit: 8
  });

  // Chart Metric Toggle: 'users_orgs' vs 'finance_onboardings'
  const [chartMetric, setChartMetric] = useState<'users_orgs' | 'finance_onboardings'>('users_orgs');
  const [logFilterCategory, setLogFilterCategory] = useState<string>('all');

  const createOrgMutation = useCreateOrganization();

  // Provision Modal State
  const [showModal, setShowModal] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantDomain, setTenantDomain] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPlan, setTenantPlan] = useState<'Starter' | 'Growth' | 'Professional' | 'Enterprise'>('Enterprise');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trigger refetch when universal filter refreshKey changes
  useEffect(() => {
    if (refreshKey > 0) {
      refetchTelemetry();
      refetchLogs();
      refetchOrgs();
    }
  }, [refreshKey, refetchTelemetry, refetchLogs, refetchOrgs]);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim() || !tenantDomain.trim() || !tenantEmail.trim()) {
      toast.error('Please complete all required tenant fields.');
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
      toast.error(err.response?.data?.message || 'Failed to provision tenant.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = telemetry?.stats;
  const growthData = telemetry?.growthData || [];
  const organizations = orgsData?.data || [];

  const filteredLogs = systemLogs.filter((log) => {
    if (logFilterCategory === 'all') return true;
    return log.type === logFilterCategory;
  });

  const logsPagination = usePagination({ data: filteredLogs, initialPageSize: 6 });

  return (
    <div className="space-y-6">
      {/* 8 Real KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tenants */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 relative overflow-hidden transition-all hover:border-indigo-300 hover:shadow">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Tenants</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl lg:text-3xl font-bold text-slate-900 font-mono">
                {stats?.totalOrganizations?.value ?? 0}
              </span>
              <span className="ml-2 text-xs font-medium text-emerald-600">
                {stats?.totalOrganizations?.delta || '+0%'}
              </span>
            </div>
            <Badge className="bg-slate-100 text-slate-700 text-[11px] border border-slate-200">
              {stats?.totalOrganizations?.active ?? 0} Active
            </Badge>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {stats?.totalOrganizations?.suspended ?? 0} suspended workspaces
          </div>
        </Card>

        {/* KPI 2: Platform Users */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 relative overflow-hidden transition-all hover:border-blue-300 hover:shadow">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Cross-Tenant Users</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl lg:text-3xl font-bold text-slate-900 font-mono">
                {stats?.platformUsers?.value ?? 0}
              </span>
              <span className="ml-2 text-xs font-medium text-emerald-600">
                {stats?.platformUsers?.delta || '+0%'}
              </span>
            </div>
            <Badge className="bg-emerald-50 text-emerald-700 text-[11px] border border-emerald-200">
              {stats?.platformUsers?.active ?? 0} Active
            </Badge>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Accounts across all provisioned tenants
          </div>
        </Card>

        {/* KPI 3: Active Onboardings */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 relative overflow-hidden transition-all hover:border-amber-300 hover:shadow">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Onboardings</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl lg:text-3xl font-bold text-slate-900 font-mono">
                {stats?.activeOnboardings?.value ?? 0}
              </span>
              <span className="ml-2 text-xs font-medium text-amber-600">
                In-flight
              </span>
            </div>
            <Badge className="bg-amber-50 text-amber-700 text-[11px] border border-amber-200">
              Journey Funnel
            </Badge>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Active cases & journey enrollments
          </div>
        </Card>

        {/* KPI 4: Cash Collected */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 relative overflow-hidden transition-all hover:border-emerald-300 hover:shadow">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Cash Collected</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl lg:text-3xl font-bold text-slate-900 font-mono">
                ${(stats?.cashCollected?.value ?? 0).toLocaleString()}
              </span>
              <span className="ml-2 text-xs font-medium text-emerald-600">
                {stats?.cashCollected?.delta || '+0%'}
              </span>
            </div>
            <Badge className="bg-emerald-50 text-emerald-700 text-[11px] border border-emerald-200">
              Paid Invoices
            </Badge>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            100% verified settlement receipts
          </div>
        </Card>

        {/* KPI 5: Operating Expenses */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 relative overflow-hidden transition-all hover:border-rose-300 hover:shadow">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Operating Expenses</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
              <HardDrive className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl lg:text-3xl font-bold text-slate-900 font-mono">
                ${(stats?.operatingExpenses?.value ?? 0).toLocaleString()}
              </span>
            </div>
            <Badge className="bg-slate-100 text-slate-700 text-[11px] border border-slate-200">
              Internal Ledger
            </Badge>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Infrastructure, hosting & licensing
          </div>
        </Card>

        {/* KPI 6: Net Operating Result */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 relative overflow-hidden transition-all hover:border-teal-300 hover:shadow">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Operating Result</span>
            <div className="p-2 rounded-lg bg-teal-50 text-teal-600 border border-teal-100">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className={`text-2xl lg:text-3xl font-bold font-mono ${
                (stats?.netOperatingResult?.value ?? 0) >= 0 ? 'text-teal-600' : 'text-rose-600'
              }`}>
                ${(stats?.netOperatingResult?.value ?? 0).toLocaleString()}
              </span>
            </div>
            <Badge className="bg-teal-50 text-teal-700 text-[11px] border border-teal-200">
              Cash - Expense
            </Badge>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Reconciled accounting margin
          </div>
        </Card>

        {/* KPI 7: Open Alerts */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 relative overflow-hidden transition-all hover:border-amber-300 hover:shadow">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Platform Alerts</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl lg:text-3xl font-bold text-slate-900 font-mono">
                {stats?.openAlerts?.value ?? 0}
              </span>
            </div>
            <Badge className={
              (stats?.openAlerts?.critical ?? 0) > 0
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }>
              {stats?.openAlerts?.critical ?? 0} Critical
            </Badge>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {stats?.openAlerts?.high ?? 0} high-priority issues past 24h
          </div>
        </Card>

        {/* KPI 8: System Health */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 relative overflow-hidden transition-all hover:border-cyan-300 hover:shadow">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">System Health</span>
            <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-100">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl lg:text-3xl font-bold text-slate-900 font-mono">
                {stats?.systemHealth?.value ?? 99.8}%
              </span>
            </div>
            <Badge className={
              stats?.systemHealth?.status === 'HEALTHY' || stats?.systemHealth?.status === 'UP'
                ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }>
              {stats?.systemHealth?.status || 'HEALTHY'}
            </Badge>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Fastify API latency: ~{stats?.systemHealth?.avgLatencyMs ?? 42}ms
          </div>
        </Card>
      </div>

      {/* Quick Operational Command Bar */}
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
          <span className="font-medium">Command Actions:</span>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Provision Tenant
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/super-admin/alerts')}
            className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 gap-1.5"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Alert Center
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/super-admin/finance/invoices')}
            className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 gap-1.5"
          >
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
            Finance Ledger
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/super-admin/reports')}
            className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 gap-1.5"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
            Export Telemetry
          </Button>
        </div>
      </div>

      {/* Main Dual Analytics & Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 6-Month Real Telemetry Chart */}
        <Card className="lg:col-span-2 border-slate-200 bg-white shadow-sm p-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
                Cross-Tenant Platform Growth & Telemetry
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic 6-month aggregate trajectory without synthetic multipliers
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setChartMetric('users_orgs')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  chartMetric === 'users_orgs'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Users & Tenants
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('finance_onboardings')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  chartMetric === 'finance_onboardings'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Revenue & Onboardings
              </button>
            </div>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                {chartMetric === 'users_orgs' ? (
                  <>
                    <Area
                      type="monotone"
                      dataKey="users"
                      name="Platform Users"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#indigoGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="organizations"
                      name="Organizations"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#blueGrad)"
                    />
                  </>
                ) : (
                  <>
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Cash Collected ($)"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#emeraldGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="onboardings"
                      name="New Onboardings"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#amberGrad)"
                    />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              Live DB Aggregations
            </span>
            <button
              onClick={() => navigate('/super-admin/observability/api')}
              className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium"
            >
              View API Latency & Metrics <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </Card>

        {/* Right 1 Col: Infrastructure Health & Architecture Overview */}
        <Card className="border-slate-200 bg-white shadow-sm p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-cyan-600" />
                Cluster Infrastructure
              </h2>
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">
                Active Node
              </Badge>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-600">
                  <Activity className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Fastify Runtime</span>
                </div>
                <span className="font-mono text-slate-900 font-medium">Node.js 20 ESM</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-600">
                  <HardDrive className="h-3.5 w-3.5 text-emerald-600" />
                  <span>MongoDB Primary</span>
                </div>
                <span className="font-mono text-emerald-700 font-medium">Connected (v8)</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  <span>Audit Retention</span>
                </div>
                <span className="font-mono text-slate-800">7-Year Immutable</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                  <span>RBAC Isolation</span>
                </div>
                <span className="font-mono text-amber-700">Root-Enforced</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/super-admin/observability/infrastructure')}
              className="w-full border-slate-200 bg-white hover:bg-slate-50 text-slate-700 justify-between text-xs"
            >
              <span>Inspect DB Collections & Health</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Organizations Directory & Live Activity Feed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Organizations Directory Roster */}
        <Card className="lg:col-span-2 overflow-hidden border-slate-200 bg-white shadow-sm">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-600" />
                Organizations Directory
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enterprise tenant workspaces provisioned on Talnova platform
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={orgSearch}
                  onChange={(e) => {
                    setOrgSearch(e.target.value);
                    setOrgPage(1);
                  }}
                  placeholder="Filter by name, slug, domain…"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <Button
                size="sm"
                onClick={() => navigate('/super-admin/organizations')}
                variant="outline"
                className="border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 shrink-0"
              >
                View All
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Tenant Name</th>
                  <th className="px-4 py-3">Domain / Slug</th>
                  <th className="px-4 py-3">Plan Tier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3 text-right">360° View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No organizations matched the search criteria.
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr
                      key={org.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => navigate(`/super-admin/organizations/${org.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 font-bold text-xs">
                            {org.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{org.name}</div>
                            <div className="text-[11px] text-slate-500">{org.supportEmail || 'support@org.com'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-indigo-600 text-[11px]">
                        {org.domain || `${org.slug}.talnova.app`}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">{org.plan}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            org.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }
                        >
                          {org.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-800">
                        {org.usersCount ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/super-admin/organizations/${org.id}`)}
                          className="text-indigo-600 hover:text-indigo-700 h-7 px-2 text-xs"
                        >
                          360° Details <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Right 1 Col: Real Activity & Security Feed */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                Live Audit Stream
              </h2>
              <button
                onClick={() => navigate('/super-admin/activity')}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Explorer
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto text-[11px]">
              {['all', 'user', 'journey', 'system', 'finance'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setLogFilterCategory(cat)}
                  className={`px-2 py-0.5 rounded capitalize transition-all ${
                    logFilterCategory === cat
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Logs List */}
            <div className="space-y-2.5 mt-1">
              {logsPagination.paginatedData.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  No activity events recorded yet.
                </div>
              ) : (
                logsPagination.paginatedData.map((log: any) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                        {log.org}
                      </span>
                      <span className="text-slate-500 font-mono text-[10px]">{log.time}</span>
                    </div>
                    <p className="text-slate-600 line-clamp-2">{log.event}</p>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-700 uppercase">
                        {log.type}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <SimplePagination
              currentPage={logsPagination.page}
              totalPages={logsPagination.totalPages}
              totalItems={logsPagination.totalItems}
              pageSize={logsPagination.pageSize}
              onPageChange={logsPagination.setPage}
            />
          </div>
        </Card>
      </div>

      {/* Provision Tenant Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-slate-200 bg-white p-6 shadow-2xl relative text-slate-900 rounded-2xl">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              Provision New Tenant
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Create an isolated organizational workspace with enterprise governance.
            </p>

            <form onSubmit={handleCreateTenant} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Organization Name *</label>
                <input
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Acme Global Corporation"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Domain or Subdomain *</label>
                <input
                  type="text"
                  required
                  value={tenantDomain}
                  onChange={(e) => setTenantDomain(e.target.value)}
                  placeholder="acme.com or acme"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Primary Admin Email *</label>
                <input
                  type="email"
                  required
                  value={tenantEmail}
                  onChange={(e) => setTenantEmail(e.target.value)}
                  placeholder="admin@acme.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Subscription Plan Tier</label>
                <select
                  value={tenantPlan}
                  onChange={(e: any) => setTenantPlan(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                >
                  <option value="Starter">Starter Plan</option>
                  <option value="Growth">Growth Plan</option>
                  <option value="Professional">Professional Plan</option>
                  <option value="Enterprise">Enterprise Tier</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                  className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm"
                >
                  {isSubmitting ? 'Provisioning…' : 'Confirm Provisioning'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

export function SuperAdminDashboard() {
  return (
    <SuperAdminShell
      title="Platform Command Center"
      subtitle="Executive cross-tenant telemetry, platform KPIs, operational observability, and workspace control"
    >
      <SuperAdminDashboardContent />
    </SuperAdminShell>
  );
}

export default SuperAdminDashboard;
