import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Ban,
  TrendingUp,
  DollarSign,
  Layers,
  Users,
  PieChart as PieChartIcon,
  ArrowUpRight,
  CreditCard,
  BarChart3
} from 'lucide-react';
import { SuperAdminShell } from '../components/super-admin/SuperAdminShell';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { SimplePagination } from '../components/SimplePagination';
import { toast } from 'sonner';
import {
  useSuperAdminInvoices,
  useCreateInvoice,
  useSuperAdminFinance,
  useSuperAdminPayments,
  useRecordPayment,
  useSuperAdminExpenses,
  useRecordExpense,
  useSuperAdminOrganizations
} from '../hooks/useSuperAdmin';
import { superAdminService } from '../services/superAdmin.service';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

type FinanceTab = 'overview' | 'invoices' | 'payments' | 'expenses' | 'accounts';

export function SuperAdminFinance() {
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromPath = (path: string): FinanceTab => {
    if (path.includes('/invoices')) return 'invoices';
    if (path.includes('/payments')) return 'payments';
    if (path.includes('/expenses')) return 'expenses';
    if (path.includes('/accounts')) return 'accounts';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<FinanceTab>(getTabFromPath(location.pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  const handleTabChange = (tab: FinanceTab) => {
    setActiveTab(tab);
    if (tab === 'overview') {
      navigate('/super-admin/finance');
    } else {
      navigate(`/super-admin/finance/${tab}`);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // React Query Hooks
  const {
    data: financeData,
    isLoading: financeLoading,
    isError: financeError,
    refetch: refetchFinance
  } = useSuperAdminFinance();

  const {
    data: invoiceData,
    isLoading: invoicesLoading,
    isError: invoicesError,
    refetch: refetchInvoices
  } = useSuperAdminInvoices({
    search: searchQuery || undefined,
    page,
    limit,
  });

  const { data: paymentsData, isLoading: paymentsLoading, refetch: refetchPayments } = useSuperAdminPayments();
  const { data: expensesData, isLoading: expensesLoading, refetch: refetchExpenses } = useSuperAdminExpenses();
  const { data: orgsData } = useSuperAdminOrganizations({ limit: 50 });

  const createInvoiceMutation = useCreateInvoice();
  const recordPaymentMutation = useRecordPayment();
  const recordExpenseMutation = useRecordExpense();

  // Invoice Modal State
  const [showModal, setShowModal] = useState(false);
  const [newOrg, setNewOrg] = useState('Talnova Labs');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'Invoice' | 'Receipt'>('Invoice');
  const [newStatus, setNewStatus] = useState<'Paid' | 'Pending' | 'Overdue'>('Pending');
  const [newDesc, setNewDesc] = useState('');

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payOrgId, setPayOrgId] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payMethod, setPayMethod] = useState('wire');
  const [payNotes, setPayNotes] = useState('');

  // Expense Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('hosting');
  const [expVendor, setExpVendor] = useState('Cloudflare / AWS');
  const [expNotes, setExpNotes] = useState('');

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmount || !newDesc) {
      toast.error('Please fill in amount and description.');
      return;
    }

    try {
      await createInvoiceMutation.mutateAsync({
        organization: newOrg,
        amount: parseFloat(newAmount),
        type: newType,
        status: newStatus,
        description: newDesc,
      });

      setShowModal(false);
      toast.success(`${newType} issued successfully.`);
      setNewAmount('');
      setNewDesc('');
      setNewStatus('Pending');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to issue billing record.');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || !payOrgId || !payRef) {
      toast.error('Please fill in organization, amount, and reference code.');
      return;
    }
    try {
      await recordPaymentMutation.mutateAsync({
        organizationId: payOrgId,
        amount: parseFloat(payAmount),
        reference: payRef,
        method: payMethod,
        notes: payNotes,
      });
      setShowPaymentModal(false);
      toast.success('B2B manual payment receipt recorded successfully.');
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record payment.');
    }
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle || !expAmount) {
      toast.error('Please fill in expense title and amount.');
      return;
    }
    try {
      await recordExpenseMutation.mutateAsync({
        title: expTitle,
        amount: parseFloat(expAmount),
        category: expCategory,
        vendor: expVendor,
        notes: expNotes,
      });
      setShowExpenseModal(false);
      toast.success('Operating expense logged successfully.');
      setExpTitle('');
      setExpAmount('');
      setExpNotes('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to log expense.');
    }
  };

  const handleExportBillingSummary = async () => {
    try {
      await superAdminService.exportFinance();
      toast.success('Billing report summary exported successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to export billing report summary.');
    }
  };

  const handleExportInvoices = async () => {
    try {
      await superAdminService.exportInvoices();
      toast.success('Invoices directory exported successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to export financial directory.');
    }
  };

  const invoices = invoiceData?.invoices?.data || [];
  const total = invoiceData?.invoices?.total || 0;
  const totalPages = invoiceData?.invoices?.totalPages || 1;
  const invoiceSummary = invoiceData?.summary || { totalRevenue: 0, pendingRevenue: 0, overdueRevenue: 0 };

  const summary = financeData?.summary || {
    totalArr: 0,
    totalMrr: 0,
    activeSubscriptions: 0,
    arpu: 0,
    platformUsers: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
    overdueRevenue: 0
  };

  const tierDistribution = financeData?.tierDistribution || [
    { tier: 'Starter', name: 'Starter', count: 0, mrr: 0, arr: 0, percentage: 0, color: '#3B82F6' },
    { tier: 'Pro', name: 'Pro / Growth', count: 0, mrr: 0, arr: 0, percentage: 0, color: '#8B5CF6' },
    { tier: 'Enterprise', name: 'Enterprise', count: 0, mrr: 0, arr: 0, percentage: 0, color: '#10B981' }
  ];

  const monthlyGrowth = financeData?.monthlyGrowth || [];

  const isLoading = financeLoading || invoicesLoading;
  const isError = financeError || invoicesError;

  const handleRetry = () => {
    refetchFinance();
    refetchInvoices();
    refetchPayments();
    refetchExpenses();
  };

  return (
    <SuperAdminShell
      title="Cross-Tenant Finance & Billing"
      description="Global revenue metrics, Annual Recurring Revenue (ARR), internal manual payments, and operating margins."
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-xl">
          <button
            onClick={() => handleTabChange('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Finance Overview
          </button>
          <button
            onClick={() => handleTabChange('invoices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'invoices'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Invoices & Receivables
          </button>
          <button
            onClick={() => handleTabChange('payments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'payments'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Payment Ledger
          </button>
          <button
            onClick={() => handleTabChange('expenses')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'expenses'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Operating Expenses
          </button>
          <button
            onClick={() => handleTabChange('accounts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'accounts'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            Customer Accounts
          </button>
        </div>

        {/* Global Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
          <div>
            <span className="text-xs uppercase font-mono tracking-wider text-slate-500">Financial Execution Mode</span>
            <p className="text-sm font-semibold text-slate-900">Internal B2B Manual Ledger & Deterministic Margin</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              data-testid="export-finance-btn"
              onClick={handleExportBillingSummary}
              className="flex items-center gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Export Billing Summary
            </Button>
            <Button
              variant="outline"
              onClick={handleExportInvoices}
              className="flex items-center gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4 text-indigo-600" />
              Export Invoices
            </Button>
            <Button
              data-testid="create-invoice-btn"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Issue Custom Billing
            </Button>
          </div>
        </div>

        {isError ? (
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <Ban className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Financial Telemetry Sync Failed</h3>
            <p className="mt-2 text-sm text-slate-600">Could not aggregate cross-tenant subscription finance data.</p>
            <Button
              onClick={handleRetry}
              className="mt-4 flex mx-auto items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Sync
            </Button>
          </Card>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Top KPI Metrics Row */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Total ARR */}
                  <Card data-testid="total-arr-card" className="border border-slate-200 bg-white shadow-sm rounded-xl p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Total ARR</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                        ${(summary.totalArr || 0).toLocaleString()}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        <span>Annual Recurring Revenue Run Rate</span>
                      </div>
                    </div>
                  </Card>

                  {/* Total MRR */}
                  <Card data-testid="total-mrr-card" className="border border-slate-200 bg-white shadow-sm rounded-xl p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">Monthly Revenue (MRR)</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                        <DollarSign className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                        ${(summary.totalMrr || 0).toLocaleString()}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Active monthly tenant billings
                      </div>
                    </div>
                  </Card>

                  {/* Active Subscriptions */}
                  <Card data-testid="active-subscriptions-card" className="border border-slate-200 bg-white shadow-sm rounded-xl p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Active Subscriptions</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Layers className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                        {summary.activeSubscriptions || 0}
                      </div>
                      <div className="mt-1 text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Across verified customer workspaces</span>
                      </div>
                    </div>
                  </Card>

                  {/* Average Revenue Per User (ARPU) */}
                  <Card data-testid="arpu-card" className="border border-slate-200 bg-white shadow-sm rounded-xl p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600">Avg Revenue Per User</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
                        <Users className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                        ${(summary.arpu || 0).toFixed(2)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Calculated over {summary.platformUsers || 0} active users
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Subscription Breakdown & Trajectory Section */}
                <div data-testid="tier-breakdown-section" className="grid gap-6 lg:grid-cols-12">
                  {/* Plan Breakdown Distribution */}
                  <Card data-testid="tier-distribution-chart" className="lg:col-span-5 border border-slate-200 bg-white shadow-sm rounded-xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">Subscription Tier Distribution</h2>
                        <p className="text-xs text-slate-500">Distribution of Starter, Pro, and Enterprise tiers</p>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <PieChartIcon className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Progress Stack Bar */}
                    <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex mb-6">
                      {tierDistribution.map((item) => (
                        <div
                          key={item.tier}
                          style={{
                            width: `${item.percentage > 0 ? item.percentage : 0}%`,
                            backgroundColor: item.color
                          }}
                          className="h-full transition-all duration-500"
                          title={`${item.name}: ${item.percentage}%`}
                        />
                      ))}
                    </div>

                    {/* Tiers List */}
                    <div className="space-y-3.5">
                      {tierDistribution.map((item) => (
                        <div
                          key={item.tier}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5 hover:border-slate-200 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                              <div className="text-xs text-slate-500">
                                {item.count} {item.count === 1 ? 'workspace' : 'workspaces'} ({item.percentage}%)
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-900">${item.mrr.toLocaleString()} / mo</div>
                            <div className="text-xs text-slate-500">${item.arr.toLocaleString()} ARR</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* 6-Month Revenue Run Rate Trajectory */}
                  <Card className="lg:col-span-7 border border-slate-200 bg-white shadow-sm rounded-xl p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">Revenue Trajectory & Run-Rate</h2>
                        <p className="text-xs text-slate-500">6-Month historical MRR & subscription expansion trend</p>
                      </div>
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5">
                        Growth Steady
                      </Badge>
                    </div>

                    <div className="h-64 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyGrowth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="financeMrrGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366F1" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={12} tickLine={false} tickFormatter={(val) => `$${val}`} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '0.5rem',
                              fontSize: '12px',
                              color: '#0f172a',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'MRR Run Rate']}
                          />
                          <Area
                            type="monotone"
                            dataKey="mrr"
                            stroke="#6366F1"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#financeMrrGrad)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* INVOICES TAB */}
            {activeTab === 'invoices' && (
              <div className="space-y-6">
                {/* Invoice Collections & Billing Health Summary Panel */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-5">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-sm font-medium">Platform Received Payments</span>
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="mt-2.5">
                      <span className="text-2xl font-bold text-slate-900">${(invoiceSummary.totalRevenue || 0).toLocaleString()}</span>
                    </div>
                  </Card>

                  <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-5">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-sm font-medium">Pending Custom Invoices</span>
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="mt-2.5">
                      <span className="text-2xl font-bold text-slate-900">${(invoiceSummary.pendingRevenue || 0).toLocaleString()}</span>
                    </div>
                  </Card>

                  <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-5">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-sm font-medium">Overdue Invoice Balances</span>
                      <AlertCircle className="h-4 w-4 text-rose-500" />
                    </div>
                    <div className="mt-2.5">
                      <span className="text-2xl font-bold text-slate-900">${(invoiceSummary.overdueRevenue || 0).toLocaleString()}</span>
                    </div>
                  </Card>
                </div>

                {/* Search bar and billing records directory */}
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Search className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search billing records by invoice number, tenant name, or notes..."
                      className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                {/* Billing directory table */}
                {isLoading ? (
                  <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm rounded-xl">
                    <div className="p-8 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading live invoices...
                    </div>
                  </Card>
                ) : (
                  <>
                    <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm rounded-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-700">
                          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-4">Document Details</th>
                              <th className="px-6 py-4">Tenant / Organization</th>
                              <th className="px-6 py-4">Description</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4">Due Date</th>
                              <th className="px-6 py-4">Amount</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {invoices.map((inv) => (
                              <tr key={inv.id} data-testid={`invoice-row-${inv.id}`} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                      <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                      <div className="font-semibold text-slate-900">{inv.invoiceNo}</div>
                                      <div className="text-xs text-slate-500">{inv.type}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-semibold text-slate-900">{inv.organization}</td>
                                <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{inv.description}</td>
                                <td className="px-6 py-4">
                                  <Badge className={
                                    inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                      inv.status === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }>
                                    {inv.status}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 text-slate-500">{inv.dueDate}</td>
                                <td className="px-6 py-4 font-semibold text-slate-900">${inv.amount.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toast.success(`Receipt document downloaded for ${inv.invoiceNo}.`)}
                                    className="text-indigo-600 hover:bg-indigo-50 p-2"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {invoices.length === 0 && (
                              <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                  No billing documents found matching query.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    {/* Pagination Controls */}
                    <div className="mt-4">
                      <SimplePagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={total}
                        startIndex={total > 0 ? (page - 1) * limit + 1 : 0}
                        endIndex={Math.min(page * limit, total)}
                        pageSize={limit}
                        onPageChange={setPage}
                        onPageSizeChange={(newSize) => {
                          setLimit(newSize);
                          setPage(1);
                        }}
                        itemLabel="invoices"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Manual Payment Receipts Ledger</h3>
                    <p className="text-xs text-slate-500">Reconciled bank wires, direct ACH transfers, and physical checks.</p>
                  </div>
                  <Button
                    onClick={() => setShowPaymentModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Record Manual Payment
                  </Button>
                </div>

                <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm rounded-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4">Receipt Date</th>
                          <th className="px-6 py-4">Tenant / Org</th>
                          <th className="px-6 py-4">Method</th>
                          <th className="px-6 py-4">Reference Code</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paymentsLoading ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                              Loading verified payment ledger...
                            </td>
                          </tr>
                        ) : paymentsData?.payments?.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                              No manual payment records registered yet.
                            </td>
                          </tr>
                        ) : (
                          paymentsData?.payments?.map((pay: any) => (
                            <tr key={pay._id || pay.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                {pay.createdAt ? new Date(pay.createdAt).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="px-6 py-4 font-semibold text-slate-900">
                                {pay.organizationId?.name || 'Customer Organization'}
                              </td>
                              <td className="px-6 py-4">
                                <span className="uppercase text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {pay.method || 'wire'}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-indigo-600 font-semibold">
                                {pay.reference}
                              </td>
                              <td className="px-6 py-4 font-bold text-emerald-600">
                                +${pay.amount?.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                                {pay.notes || '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* EXPENSES TAB */}
            {activeTab === 'expenses' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Platform Operating Expenses</h3>
                    <p className="text-xs text-slate-500">Track cloud infrastructure, Gemini token bills, and operational vendor costs.</p>
                  </div>
                  <Button
                    onClick={() => setShowExpenseModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Log Operating Expense
                  </Button>
                </div>

                <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm rounded-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Expense Title</th>
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4">Vendor</th>
                          <th className="px-6 py-4">Amount (USD)</th>
                          <th className="px-6 py-4">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {expensesLoading ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                              Loading operating expenses...
                            </td>
                          </tr>
                        ) : expensesData?.expenses?.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                              No operating expenses recorded yet.
                            </td>
                          </tr>
                        ) : (
                          expensesData?.expenses?.map((exp: any) => (
                            <tr key={exp._id || exp.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                {exp.date ? new Date(exp.date).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="px-6 py-4 font-semibold text-slate-900">
                                {exp.title}
                              </td>
                              <td className="px-6 py-4">
                                <span className="uppercase text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {exp.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-700 font-medium">
                                {exp.vendor || 'Third Party'}
                              </td>
                              <td className="px-6 py-4 font-bold text-rose-600">
                                -${exp.amount?.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                                {exp.notes || '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* CUSTOMER ACCOUNTS TAB */}
            {activeTab === 'accounts' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Customer Account Balances & Tiers</h3>
                  <p className="text-xs text-slate-500">Cross-tenant billing status and contractual tier quotas.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {orgsData?.data?.map((org: any) => (
                    <Card key={org._id || org.id} className="p-5 border border-slate-200 bg-white shadow-sm rounded-xl">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">{org.name}</h4>
                          <span className="text-xs font-mono text-slate-500">/{org.slug}</span>
                        </div>
                        <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs">
                          {org.plan || 'Pro'}
                        </Badge>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Account Status</span>
                        <span className="font-semibold text-emerald-600 capitalize">{org.status || 'Active'}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Action</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/super-admin/organizations/${org._id}`)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 p-0"
                        >
                          View 360° Profile &rarr;
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Manual invoice/receipt creation modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Issue Custom Invoice / Receipt</h3>
              <form onSubmit={handleCreateInvoice} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Target Organization</label>
                  <input
                    type="text"
                    required
                    value={newOrg}
                    onChange={(e) => setNewOrg(e.target.value)}
                    placeholder="Talnova Labs"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Document Type</label>
                  <div className="mt-1 flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-900 cursor-pointer">
                      <input
                        type="radio"
                        name="docType"
                        checked={newType === 'Invoice'}
                        onChange={() => setNewType('Invoice')}
                        className="accent-indigo-600"
                      />
                      Invoice
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-900 cursor-pointer">
                      <input
                        type="radio"
                        name="docType"
                        checked={newType === 'Receipt'}
                        onChange={() => setNewType('Receipt')}
                        className="accent-indigo-600"
                      />
                      Receipt
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Amount (USD)</label>
                  <div className="relative mt-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">$</span>
                    <input
                      type="number"
                      required
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="1500"
                      className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Description / Billing Notes</label>
                  <textarea
                    required
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Billing details (e.g. Annual Growth plan setup fee)"
                    rows={3}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Payment Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="Paid">Paid (Complete)</option>
                    <option value="Pending">Pending Approval</option>
                    <option value="Overdue">Overdue Balance</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createInvoiceMutation.isPending}
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                    {createInvoiceMutation.isPending ? 'Issuing...' : 'Issue Record'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Record Manual Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Record Verified B2B Payment</h3>
              <form onSubmit={handleRecordPayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Customer Organization</label>
                  <select
                    required
                    value={payOrgId}
                    onChange={(e) => setPayOrgId(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Select an organization...</option>
                    {orgsData?.data?.map((org: any) => (
                      <option key={org._id || org.id} value={org._id || org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Amount Collected (USD)</label>
                  <input
                    type="number"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="5000"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="wire">Bank Wire Transfer</option>
                    <option value="ach">Direct ACH</option>
                    <option value="check">Physical Check</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Transaction Reference / Wire ID</label>
                  <input
                    type="text"
                    required
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="WIRE-2026-9821A"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 font-mono placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Reconciliation Notes</label>
                  <textarea
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional bank statement notes"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPaymentModal(false)}
                    className="rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={recordPaymentMutation.isPending}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    {recordPaymentMutation.isPending ? 'Recording...' : 'Save Receipt'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Log Operating Expense Modal */}
        {showExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Log Operating Expense</h3>
              <form onSubmit={handleRecordExpense} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Expense Title</label>
                  <input
                    type="text"
                    required
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    placeholder="Monthly Cloud Infrastructure Bill"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="hosting">Cloud Hosting & Compute</option>
                    <option value="ai">Gemini / AI Foundation Tokens</option>
                    <option value="tools">SaaS Tools & Monitoring</option>
                    <option value="hardware">Employee Hardware Stock</option>
                    <option value="other">Miscellaneous Operating Cost</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Vendor</label>
                  <input
                    type="text"
                    required
                    value={expVendor}
                    onChange={(e) => setExpVendor(e.target.value)}
                    placeholder="Google Cloud / Cloudflare"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Amount (USD)</label>
                  <input
                    type="number"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="850"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Notes</label>
                  <textarea
                    value={expNotes}
                    onChange={(e) => setExpNotes(e.target.value)}
                    rows={2}
                    placeholder="Invoice ID or budget line notes"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowExpenseModal(false)}
                    className="rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={recordExpenseMutation.isPending}
                    className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                  >
                    {recordExpenseMutation.isPending ? 'Logging...' : 'Save Expense'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}

export default SuperAdminFinance;
