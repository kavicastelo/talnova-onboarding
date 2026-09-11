import React, { useState } from 'react';
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
  ArrowUpRight
} from 'lucide-react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { SimplePagination } from '../components/SimplePagination';
import { toast } from 'sonner';
import { useSuperAdminInvoices, useCreateInvoice, useSuperAdminFinance } from '../hooks/useSuperAdmin';
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

export function SuperAdminFinance() {
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

  const createInvoiceMutation = useCreateInvoice();

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newOrg, setNewOrg] = useState('Northwind Labs');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'Invoice' | 'Receipt'>('Invoice');
  const [newStatus, setNewStatus] = useState<'Paid' | 'Pending' | 'Overdue'>('Pending');
  const [newDesc, setNewDesc] = useState('');

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
      
      // Reset Form
      setNewAmount('');
      setNewDesc('');
      setNewStatus('Pending');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to issue billing record.');
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
  };

  return (
    <div className="space-y-8 text-slate-100 bg-[#0B0F19] -m-4 lg:-m-6 p-4 lg:p-6 min-h-full">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight text-white">Cross-Tenant Finance & Billing</h1>
            <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs px-2.5 py-0.5">
              SuperAdmin Executive
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Global revenue metrics, Annual Recurring Revenue (ARR), subscription tier breakdown, and billing health
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            data-testid="export-finance-btn"
            onClick={handleExportBillingSummary}
            className="flex items-center gap-2 border-white/10 text-white hover:bg-white/5"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            Export Billing Summary
          </Button>
          <Button
            variant="outline"
            onClick={handleExportInvoices}
            className="flex items-center gap-2 border-white/10 text-gray-300 hover:bg-white/5"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            Export Invoices
          </Button>
          <Button
            data-testid="create-invoice-btn"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
          >
            <Plus className="h-4 w-4" />
            Issue Custom Billing
          </Button>
        </div>
      </div>

      {isError ? (
        <Card className="border-white/5 bg-white/[0.01] p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
            <Ban className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">Financial Telemetry Sync Failed</h3>
          <p className="mt-2 text-sm text-gray-400">Could not aggregate cross-tenant subscription finance data.</p>
          <Button
            onClick={handleRetry}
            className="mt-4 flex mx-auto items-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Sync
          </Button>
        </Card>
      ) : (
        <>
          {/* Top KPI Metrics Row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total ARR */}
            <Card data-testid="total-arr-card" className="border-white/5 bg-gradient-to-br from-indigo-950/20 via-white/[0.02] to-white/[0.01] p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Total ARR</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  ${(summary.totalArr || 0).toLocaleString()}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>Annual Recurring Revenue Run Rate</span>
                </div>
              </div>
            </Card>

            {/* Total MRR */}
            <Card data-testid="total-mrr-card" className="border-white/5 bg-white/[0.02] p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">Monthly Revenue (MRR)</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  ${(summary.totalMrr || 0).toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  Active monthly tenant billings
                </div>
              </div>
            </Card>

            {/* Active Subscriptions */}
            <Card data-testid="active-subscriptions-card" className="border-white/5 bg-white/[0.02] p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Active Subscriptions</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  {summary.activeSubscriptions || 0}
                </div>
                <div className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Across verified customer workspaces</span>
                </div>
              </div>
            </Card>

            {/* Average Revenue Per User (ARPU) */}
            <Card data-testid="arpu-card" className="border-white/5 bg-white/[0.02] p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Avg Revenue Per User</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  ${(summary.arpu || 0).toFixed(2)}
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  Calculated over {summary.platformUsers || 0} active users
                </div>
              </div>
            </Card>
          </div>

          {/* Subscription Breakdown & Trajectory Section */}
          <div data-testid="tier-breakdown-section" className="grid gap-6 lg:grid-cols-12">
            {/* Plan Breakdown Distribution */}
            <Card data-testid="tier-distribution-chart" className="lg:col-span-5 border-white/5 bg-white/[0.015] p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-semibold text-white">Subscription Tier Distribution</h2>
                  <p className="text-xs text-gray-400">Distribution of Starter, Pro, and Enterprise tiers</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                  <PieChartIcon className="h-4 w-4" />
                </div>
              </div>

              {/* Progress Stack Bar */}
              <div className="h-3 w-full rounded-full bg-white/5 overflow-hidden flex mb-6">
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
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3.5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <div>
                        <div className="text-sm font-semibold text-white">{item.name}</div>
                        <div className="text-xs text-gray-400">
                          {item.count} {item.count === 1 ? 'workspace' : 'workspaces'} ({item.percentage}%)
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">${item.mrr.toLocaleString()} / mo</div>
                      <div className="text-xs text-gray-400">${item.arr.toLocaleString()} ARR</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 6-Month Revenue Run Rate Trajectory */}
            <Card className="lg:col-span-7 border-white/5 bg-white/[0.015] p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-white">Revenue Trajectory & Run-Rate</h2>
                  <p className="text-xs text-gray-400">6-Month historical MRR & subscription expansion trend</p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5">
                  Growth Steady
                </Badge>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyGrowth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="financeMrrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} />
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F131E',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                        color: '#fff'
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

          {/* Invoice Collections & Billing Health Summary Panel */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-white/5 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-sm font-medium">Platform Received Payments</span>
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-bold text-white">${(invoiceSummary.totalRevenue || 0).toLocaleString()}</span>
              </div>
            </Card>

            <Card className="border-white/5 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-sm font-medium">Pending Custom Invoices</span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-bold text-white">${(invoiceSummary.pendingRevenue || 0).toLocaleString()}</span>
              </div>
            </Card>

            <Card className="border-white/5 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-sm font-medium">Overdue Invoice Balances</span>
                <AlertCircle className="h-4 w-4 text-rose-400" />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-bold text-white">${(invoiceSummary.overdueRevenue || 0).toLocaleString()}</span>
              </div>
            </Card>
          </div>

          {/* Search bar and billing records directory */}
          <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.01] p-3.5">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
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
                className="block w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none hover:border-white/20 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Billing directory table */}
          {isLoading ? (
            <Card className="overflow-hidden border-white/5 bg-white/[0.01]">
              <div className="p-6 text-center animate-pulse space-y-4">
                <div className="h-6 w-1/4 rounded bg-white/10" />
                <div className="h-32 w-full rounded bg-white/5" />
              </div>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden border-white/5 bg-white/[0.01]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-300">
                    <thead className="bg-white/[0.03] text-xs font-semibold uppercase tracking-wider text-gray-400">
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
                    <tbody className="divide-y divide-white/5">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="font-semibold text-white">{inv.invoiceNo}</div>
                                <div className="text-xs text-gray-500">{inv.type}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-white">{inv.organization}</td>
                          <td className="px-6 py-4 text-gray-400 max-w-xs truncate">{inv.description}</td>
                          <td className="px-6 py-4">
                            <Badge className={
                              inv.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400' :
                              inv.status === 'Pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                            }>
                              {inv.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-gray-400">{inv.dueDate}</td>
                          <td className="px-6 py-4 font-semibold text-white">${inv.amount.toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toast.success(`Receipt document downloaded for ${inv.invoiceNo}.`)}
                              className="text-indigo-400 hover:bg-indigo-500/10 p-2"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {invoices.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
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
        </>
      )}

      {/* Manual invoice/receipt creation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0F131E] p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Issue Custom Invoice / Receipt</h3>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Target Organization</label>
                <input
                  type="text"
                  required
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  placeholder="Northwind Labs"
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2 px-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Document Type</label>
                <div className="mt-1 flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                    <input
                      type="radio"
                      name="docType"
                      checked={newType === 'Invoice'}
                      onChange={() => setNewType('Invoice')}
                      className="accent-indigo-500"
                    />
                    Invoice
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                    <input
                      type="radio"
                      name="docType"
                      checked={newType === 'Receipt'}
                      onChange={() => setNewType('Receipt')}
                      className="accent-indigo-500"
                    />
                    Receipt
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Amount (USD)</label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">$</span>
                  <input
                    type="number"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="1500"
                    className="block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2 pl-8 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Description / Billing Notes</label>
                <textarea
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Billing details (e.g. Annual Growth plan setup fee)"
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2 px-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Payment Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-[#0F131E] py-2 px-3 text-sm text-white outline-none focus:border-indigo-500"
                >
                  <option value="Paid">Paid (Complete)</option>
                  <option value="Pending">Pending Approval</option>
                  <option value="Overdue">Overdue Balance</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border-white/10 bg-transparent text-white hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createInvoiceMutation.isPending}
                  className="rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white"
                >
                  {createInvoiceMutation.isPending ? 'Issuing...' : 'Issue Record'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
