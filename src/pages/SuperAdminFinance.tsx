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
  BarChart3,
  Eye,
  Trash2,
  Building2,
  Edit3
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
  useInvoiceDetail,
  useSuperAdminFinance,
  useSuperAdminPayments,
  useRecordPayment,
  useSuperAdminExpenses,
  useRecordExpense,
  useSuperAdminOrganizations,
  useSuperAdminCustomerAccounts,
  useUpdateCustomerAccount
} from '../hooks/useSuperAdmin';
import {
  superAdminService,
  CustomerAccountItem,
  CustomerAccountStatus,
  BillingCycle
} from '../services/superAdmin.service';
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

  // Invoice Modal & Itemized State
  const [showModal, setShowModal] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [newOrg, setNewOrg] = useState('Talnova Labs');
  const [newCurrency, setNewCurrency] = useState('USD');
  const [newType, setNewType] = useState<'Invoice' | 'Receipt'>('Invoice');
  const [newStatus, setNewStatus] = useState<string>('issued');
  const [newIssueDate, setNewIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newDueDate, setNewDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [lineItems, setLineItems] = useState<Array<{ description: string; quantity: number; unitPrice: number }>>([
    { description: 'Enterprise Platform Seat Licenses', quantity: 10, unitPrice: 49 },
  ]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [newNotes, setNewNotes] = useState('');

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState('');
  const [payInvoiceNo, setPayInvoiceNo] = useState('');
  const [payOrgId, setPayOrgId] = useState('');
  const [payOrgName, setPayOrgName] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payMethod, setPayMethod] = useState('wire');
  const [payNotes, setPayNotes] = useState('');

  // Expense Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('infrastructure');
  const [expVendor, setExpVendor] = useState('Cloudflare');
  const [expNotes, setExpNotes] = useState('');

  // Customer Accounts State
  const [accountStatusFilter, setAccountStatusFilter] = useState<'all' | CustomerAccountStatus>('all');
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [editingAccount, setEditingAccount] = useState<CustomerAccountItem | null>(null);

  // Edit Account Terms Form State
  const [editStatus, setEditStatus] = useState<CustomerAccountStatus>('good_standing');
  const [editBillingCycle, setEditBillingCycle] = useState<BillingCycle>('monthly');
  const [editCreditLimit, setEditCreditLimit] = useState<string>('0');
  const [editCurrency, setEditCurrency] = useState<string>('USD');
  const [editContactName, setEditContactName] = useState<string>('');
  const [editContactEmail, setEditContactEmail] = useState<string>('');
  const [editContactPhone, setEditContactPhone] = useState<string>('');
  const [editContactAddress, setEditContactAddress] = useState<string>('');
  const [editCommercialNotes, setEditCommercialNotes] = useState<string>('');

  const {
    data: customerAccounts,
    isLoading: customerAccountsLoading,
    refetch: refetchCustomerAccounts
  } = useSuperAdminCustomerAccounts({
    status: accountStatusFilter !== 'all' ? accountStatusFilter : undefined,
    search: accountSearchQuery || undefined
  });

  const updateAccountMutation = useUpdateCustomerAccount();

  const handleOpenEditAccount = (acc: CustomerAccountItem) => {
    setEditingAccount(acc);
    setEditStatus(acc.accountStatus || 'good_standing');
    setEditBillingCycle(acc.billingCycle || 'monthly');
    setEditCreditLimit(String(acc.creditLimit ?? 0));
    setEditCurrency(acc.preferredCurrency || 'USD');
    setEditContactName(acc.billingContact?.name || '');
    setEditContactEmail(acc.billingContact?.email || '');
    setEditContactPhone(acc.billingContact?.phone || '');
    setEditContactAddress(acc.billingContact?.address || '');
    setEditCommercialNotes(acc.commercialNotes || '');
  };

  const handleSaveAccountTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    try {
      await updateAccountMutation.mutateAsync({
        id: editingAccount.id || (editingAccount as any)._id,
        data: {
          accountStatus: editStatus,
          billingCycle: editBillingCycle,
          creditLimit: parseFloat(editCreditLimit) || 0,
          preferredCurrency: editCurrency,
          billingContact: {
            name: editContactName,
            email: editContactEmail,
            phone: editContactPhone,
            address: editContactAddress
          },
          commercialNotes: editCommercialNotes
        }
      });

      toast.success(`Account terms updated for ${editingAccount.organization?.name || 'organization'}`);
      setEditingAccount(null);
      refetchCustomerAccounts();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update customer account terms');
    }
  };

  // Invoice Detail / Dossier State
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);
  const { data: invoiceDetail, isLoading: invoiceDetailLoading } = useInvoiceDetail(viewingInvoiceId);

  // Dynamic calculations for creation modal
  const computedSubtotal = Math.round(
    lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0) * 100
  ) / 100;
  const computedTotal = Math.round(
    Math.max(0, computedSubtotal - (Number(discountAmount) || 0) + (Number(taxAmount) || 0)) * 100
  ) / 100;

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 1) {
      toast.error('Invoice must contain at least one line item.');
      return;
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, field: 'description' | 'quantity' | 'unitPrice', val: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: val };
    setLineItems(updated);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrg.trim() && !selectedOrgId) {
      toast.error('Please specify target organization.');
      return;
    }

    if (lineItems.length === 0) {
      toast.error('At least one line item is required.');
      return;
    }

    for (let i = 0; i < lineItems.length; i++) {
      if (!lineItems[i].description.trim()) {
        toast.error(`Line item #${i + 1} must have a description.`);
        return;
      }
      if (Number(lineItems[i].quantity) <= 0) {
        toast.error(`Line item #${i + 1} quantity must be greater than 0.`);
        return;
      }
      if (Number(lineItems[i].unitPrice) < 0) {
        toast.error(`Line item #${i + 1} unit price cannot be negative.`);
        return;
      }
    }

    if (new Date(newDueDate).getTime() < new Date(newIssueDate).getTime()) {
      toast.error('Due date cannot be earlier than issue date.');
      return;
    }

    try {
      await createInvoiceMutation.mutateAsync({
        organizationId: selectedOrgId || undefined,
        organization: newOrg.trim(),
        customerName: newOrg.trim(),
        currency: newCurrency,
        issueDate: newIssueDate,
        dueDate: newDueDate,
        lineItems: lineItems.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          amount: Math.round((Number(item.quantity) * Number(item.unitPrice) + Number.EPSILON) * 100) / 100,
        })),
        discountAmount: Number(discountAmount) || 0,
        taxAmount: Number(taxAmount) || 0,
        type: newType,
        status: newStatus as any,
        notes: newNotes.trim(),
        description: lineItems[0]?.description.trim() || 'Platform Invoicing',
      });

      setShowModal(false);
      toast.success(`${newType} issued successfully.`);
      setLineItems([{ description: 'Enterprise Platform Seat Licenses', quantity: 10, unitPrice: 49 }]);
      setDiscountAmount(0);
      setTaxAmount(0);
      setNewNotes('');
      setNewStatus('issued');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to issue billing record.');
    }
  };

  const invoices = invoiceData?.invoices?.data || [];
  const total = invoiceData?.invoices?.total || 0;
  const totalPages = invoiceData?.invoices?.totalPages || 1;
  const invoiceSummary = invoiceData?.summary || { totalRevenue: 0, pendingRevenue: 0, overdueRevenue: 0 };

  const selectedPaymentInvoice = invoices.find(i => i.id === payInvoiceId || (i as any)._id === payInvoiceId);
  const selectedInvoiceBalance = selectedPaymentInvoice
    ? (selectedPaymentInvoice.balanceDue ?? (selectedPaymentInvoice.status === 'Paid' || selectedPaymentInvoice.status === 'paid' ? 0 : (selectedPaymentInvoice.totalAmount ?? selectedPaymentInvoice.amount ?? 0)))
    : 0;
  const numPayAmount = parseFloat(payAmount) || 0;
  const isOverpayment = !!selectedPaymentInvoice && numPayAmount > selectedInvoiceBalance + 0.001;
  const projectedRemainingBalance = Math.max(0, Math.round((selectedInvoiceBalance - numPayAmount) * 100) / 100);

  const handleSelectInvoiceForPayment = (invId: string) => {
    setPayInvoiceId(invId);
    const chosen = invoices.find(i => i.id === invId || (i as any)._id === invId);
    if (chosen) {
      setPayInvoiceNo(chosen.invoiceNo);
      setPayOrgId(chosen.organizationId || '');
      setPayOrgName(chosen.customerName || chosen.organization || '');
      const bal = chosen.balanceDue ?? (chosen.status === 'Paid' || chosen.status === 'paid' ? 0 : (chosen.totalAmount ?? chosen.amount ?? 0));
      setPayAmount(bal > 0 ? bal.toFixed(2) : '');
    } else {
      setPayInvoiceNo('');
      setPayOrgId('');
      setPayOrgName('');
      setPayAmount('');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payInvoiceId && !payInvoiceNo) {
      toast.error('Please select an invoice to apply payment against.');
      return;
    }
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast.error('Please enter a valid positive payment amount.');
      return;
    }
    if (isOverpayment) {
      toast.error(`Payment amount ($${parseFloat(payAmount).toFixed(2)}) exceeds invoice balance due ($${selectedInvoiceBalance.toFixed(2)}).`);
      return;
    }
    if (!payRef.trim()) {
      toast.error('Please enter transaction reference or wire confirmation code.');
      return;
    }

    try {
      await recordPaymentMutation.mutateAsync({
        invoiceId: payInvoiceId,
        invoiceNo: payInvoiceNo,
        organizationId: payOrgId || undefined,
        organizationName: payOrgName,
        amount: parseFloat(payAmount),
        referenceNumber: payRef.trim(),
        reference: payRef.trim(),
        paymentMethod: payMethod,
        method: payMethod,
        notes: payNotes.trim(),
      });
      setShowPaymentModal(false);
      toast.success('B2B manual payment receipt recorded successfully.');
      setPayInvoiceId('');
      setPayInvoiceNo('');
      setPayOrgId('');
      setPayOrgName('');
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
        title: expTitle.trim(),
        description: expTitle.trim(),
        amount: parseFloat(expAmount),
        category: expCategory,
        vendor: expVendor.trim(),
        notes: expNotes.trim(),
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
                              <th className="px-6 py-4">Total Amount</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {invoices.map((inv) => {
                              const currSymbol = (inv.currency === 'EUR' ? '€' : inv.currency === 'GBP' ? '£' : '$');
                              const totalAmt = inv.totalAmount ?? inv.amount ?? 0;
                              const balDue = inv.balanceDue ?? (inv.status === 'Paid' || inv.status === 'paid' ? 0 : totalAmt);
                              const formattedDueDate = inv.dueDate
                                ? (inv.dueDate.toString().includes('T') ? inv.dueDate.toString().split('T')[0] : inv.dueDate.toString())
                                : '—';
                              const lineItemCount = Array.isArray(inv.lineItems) && inv.lineItems.length > 0 ? inv.lineItems.length : 1;

                              const s = (inv.status || '').toLowerCase();
                              const statusBadge = s === 'paid' ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">Paid</Badge>
                              ) : s === 'partially_paid' ? (
                                <Badge className="bg-blue-50 text-blue-700 border border-blue-200">Partially Paid</Badge>
                              ) : s === 'draft' ? (
                                <Badge className="bg-slate-100 text-slate-700 border border-slate-200">Draft</Badge>
                              ) : s === 'overdue' ? (
                                <Badge className="bg-rose-50 text-rose-700 border border-rose-200">Overdue</Badge>
                              ) : (
                                <Badge className="bg-amber-50 text-amber-700 border border-amber-200">{inv.status}</Badge>
                              );

                              return (
                                <tr
                                  key={inv.id}
                                  data-testid={`invoice-row-${inv.id}`}
                                  className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                                  onClick={() => setViewingInvoiceId(inv.id)}
                                >
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                        <FileText className="h-5 w-5" />
                                      </div>
                                      <div>
                                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                          {inv.invoiceNo}
                                          {lineItemCount > 1 && (
                                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                              {lineItemCount} items
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs text-slate-500">{inv.type} • {inv.currency || 'USD'}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 font-semibold text-slate-900">{inv.customerName || inv.organization}</td>
                                  <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{inv.description || inv.notes || '—'}</td>
                                  <td className="px-6 py-4">{statusBadge}</td>
                                  <td className="px-6 py-4 text-slate-500">{formattedDueDate}</td>
                                  <td className="px-6 py-4">
                                    <div className="font-semibold text-slate-900">
                                      {currSymbol} {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    {balDue > 0 && balDue !== totalAmt && (
                                      <div className="text-[11px] text-amber-600 font-medium">
                                        Bal: {currSymbol} {balDue.toFixed(2)}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        title="Inspect Invoice Dossier"
                                        onClick={() => setViewingInvoiceId(inv.id)}
                                        className="text-indigo-600 hover:bg-indigo-50 p-2"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        title="Download Receipt"
                                        onClick={() => toast.success(`Receipt document downloaded for ${inv.invoiceNo}.`)}
                                        className="text-slate-600 hover:bg-slate-100 p-2"
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
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
                        ) : (expensesData?.expenses?.length ?? 0) === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                              No operating expenses recorded yet.
                            </td>
                          </tr>
                        ) : (
                          expensesData?.expenses?.map((exp: any) => {
                            const cat = (exp.category || 'other').toLowerCase();
                            const catBadgeClass =
                              cat === 'infrastructure' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              cat === 'ai_compute' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              cat === 'software_licenses' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              cat === 'salaries' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              cat === 'marketing' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              cat === 'office' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              cat === 'legal' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-slate-100 text-slate-700 border-slate-200';

                            const expDate = exp.expenseDate || exp.date || exp.incurredAt;
                            const formattedDate = expDate ? new Date(expDate).toLocaleDateString() : 'N/A';

                            return (
                              <tr key={exp._id || exp.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-semibold text-slate-900 text-xs font-mono">
                                    {exp.expenseNo || 'EXP-RECORD'}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {formattedDate}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-semibold text-slate-900">
                                    {exp.description || exp.title}
                                  </div>
                                  {exp.isRecurring && (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                      Recurring
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`uppercase text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${catBadgeClass}`}>
                                    {exp.category}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-700 font-medium">
                                  {exp.vendor || 'Third Party'}
                                </td>
                                <td className="px-6 py-4 font-bold text-rose-600 font-mono">
                                  -${Number(exp.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                                  {exp.recordedBy ? <span className="text-[11px] text-slate-400 block">By: {exp.recordedBy}</span> : null}
                                  {exp.notes || exp.description || '—'}
                                </td>
                              </tr>
                            );
                          })
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                      Customer Commercial Accounts & Balances
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cross-tenant receivables, credit standing, billing cycles, and commercial terms.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchCustomerAccounts()}
                      className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm text-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${customerAccountsLoading ? 'animate-spin text-indigo-600' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Filters & Search Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {(['all', 'good_standing', 'delinquent', 'credit_hold', 'vip'] as const).map((statusKey) => {
                      const isActive = accountStatusFilter === statusKey;
                      const labels: Record<string, string> = {
                        all: 'All Accounts',
                        good_standing: 'Good Standing',
                        delinquent: 'Delinquent',
                        credit_hold: 'Credit Hold',
                        vip: 'VIP Accounts'
                      };
                      return (
                        <button
                          key={statusKey}
                          onClick={() => setAccountStatusFilter(statusKey)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {statusKey === 'good_standing' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          {statusKey === 'delinquent' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
                          {statusKey === 'credit_hold' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                          {statusKey === 'vip' && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                          {labels[statusKey]}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search accounts or contacts..."
                      value={accountSearchQuery}
                      onChange={(e) => setAccountSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                {/* Accounts Grid */}
                {customerAccountsLoading ? (
                  <div className="py-16 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading customer commercial accounts...
                  </div>
                ) : !customerAccounts || customerAccounts.length === 0 ? (
                  <Card className="p-12 text-center border border-dashed border-slate-300 bg-white rounded-xl">
                    <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-slate-900 mb-1">No customer accounts found</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      No customer billing accounts match your current status filter or search parameters.
                    </p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {customerAccounts.map((acc) => {
                      const org = acc.organization || (typeof acc.organizationId === 'object' ? acc.organizationId : {});
                      const balanceDue = acc.totalBalanceDue ?? 0;
                      const hasBalanceDue = balanceDue > 0;

                      // Status Badge configuration
                      let statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      let statusLabel = 'Good Standing';
                      if (acc.accountStatus === 'delinquent') {
                        statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                        statusLabel = 'Delinquent';
                      } else if (acc.accountStatus === 'credit_hold') {
                        statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                        statusLabel = 'Credit Hold';
                      } else if (acc.accountStatus === 'vip') {
                        statusBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                        statusLabel = 'VIP Partner';
                      }

                      return (
                        <Card
                          key={acc.id || (acc as any)._id}
                          className="p-5 border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow rounded-xl flex flex-col justify-between"
                        >
                          <div>
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div>
                                <h4 className="text-sm font-bold text-slate-900 leading-tight">
                                  {org.name || 'Unnamed Tenant'}
                                </h4>
                                <span className="text-xs font-mono text-slate-500">
                                  /{org.slug || 'no-slug'}
                                </span>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold py-0.5">
                                  {org.plan || 'Enterprise'}
                                </Badge>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadgeClass}`}>
                                  {statusLabel}
                                </span>
                              </div>
                            </div>

                            {/* Financial Balances */}
                            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/80 rounded-lg border border-slate-100 my-3">
                              <div>
                                <div className="text-[11px] font-medium text-slate-500">Current Balance Due</div>
                                <div className={`text-base font-bold font-mono ${hasBalanceDue ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  ${balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] font-medium text-slate-500">Credit Limit</div>
                                <div className="text-base font-bold font-mono text-slate-900">
                                  ${Number(acc.creditLimit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>

                            {/* Terms & Contacts */}
                            <div className="space-y-1.5 text-xs text-slate-600">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Billing Cycle:</span>
                                <span className="font-semibold text-slate-800 capitalize bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                  {acc.billingCycle || 'monthly'} ({acc.preferredCurrency || 'USD'})
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Invoiced / Paid:</span>
                                <span className="font-mono text-slate-700 text-[11px]">
                                  ${(acc.totalPaid || 0).toLocaleString()} / ${(acc.totalInvoiced || 0).toLocaleString()}
                                </span>
                              </div>

                              {acc.billingContact?.name && (
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500 truncate max-w-[120px]">
                                    Contact: {acc.billingContact.name}
                                  </span>
                                  {acc.billingContact.email && (
                                    <a
                                      href={`mailto:${acc.billingContact.email}`}
                                      className="text-indigo-600 hover:text-indigo-700 truncate max-w-[140px]"
                                    >
                                      {acc.billingContact.email}
                                    </a>
                                  )}
                                </div>
                              )}

                              {acc.commercialNotes && (
                                <p className="text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded border border-amber-100/60 mt-2 line-clamp-2">
                                  "{acc.commercialNotes}"
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Card Footer Actions */}
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditAccount(acc)}
                              className="text-xs text-slate-700 hover:text-indigo-600 border-slate-200 flex items-center gap-1.5 py-1 px-2.5"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit Terms
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/super-admin/organizations/${org.id || org._id}`)}
                              className="text-xs text-indigo-600 hover:text-indigo-700 p-0 font-medium"
                            >
                              360° Profile &rarr;
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Dynamic Itemized Invoice Creation Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Issue B2B Enterprise Invoice</h3>
                  <p className="text-xs text-slate-500">Configure itemized line items, contractual terms, taxes, and discounts.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateInvoice} className="space-y-5 overflow-y-auto pr-1 py-4 flex-1">
                {/* Organization & Currency Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Target Organization / Customer <span className="text-rose-500">*</span>
                    </label>
                    {orgsData?.data && orgsData.data.length > 0 ? (
                      <div className="space-y-1.5">
                        <select
                          value={selectedOrgId}
                          onChange={(e) => {
                            const found = orgsData.data.find((o: any) => o._id === e.target.value);
                            setSelectedOrgId(e.target.value);
                            if (found) setNewOrg(found.name);
                          }}
                          className="block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        >
                          <option value="">-- Select Active Organization --</option>
                          {orgsData.data.map((org: any) => (
                            <option key={org._id || org.id} value={org._id || org.id}>
                              {org.name} ({org.plan || 'Standard'})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          required
                          value={newOrg}
                          onChange={(e) => setNewOrg(e.target.value)}
                          placeholder="Or type customer name..."
                          className="block w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500"
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        required
                        value={newOrg}
                        onChange={(e) => setNewOrg(e.target.value)}
                        placeholder="Talnova Labs, Inc."
                        className="block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Currency</label>
                    <select
                      value={newCurrency}
                      onChange={(e) => setNewCurrency(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="USD">USD ($ - US Dollar)</option>
                      <option value="EUR">EUR (€ - Euro)</option>
                      <option value="GBP">GBP (£ - British Pound)</option>
                    </select>
                  </div>
                </div>

                {/* Document Type, Status, & Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Doc Type</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as any)}
                      className="block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500"
                    >
                      <option value="Invoice">Invoice</option>
                      <option value="Receipt">Receipt</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500"
                    >
                      <option value="issued">Issued</option>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent to Customer</option>
                      <option value="partially_paid">Partially Paid</option>
                      <option value="paid">Paid (Complete)</option>
                      <option value="overdue">Overdue Balance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Issue Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={newIssueDate}
                      onChange={(e) => setNewIssueDate(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Due Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={newDueDate}
                      min={newIssueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Dynamic Itemized Line Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                  <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Itemized Line Items</span>
                      <span className="text-xs text-slate-500 ml-2">({lineItems.length} items configured)</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddLineItem}
                      className="text-xs h-7 gap-1 bg-white hover:bg-slate-50 text-indigo-600 border-indigo-200"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Line
                    </Button>
                  </div>

                  <div className="p-3 space-y-3">
                    {lineItems.map((item, idx) => {
                      const itemTotal = Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) * 100) / 100;
                      return (
                        <div key={idx} className="flex flex-col sm:flex-row items-center gap-2.5 bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-xs font-bold text-slate-400 w-5 text-center">{idx + 1}.</span>
                          <div className="flex-1 w-full">
                            <input
                              type="text"
                              required
                              placeholder="Line item description (e.g. 50 Seat Licenses @ Growth Tier)"
                              value={item.description}
                              onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                              className="w-full text-xs rounded-md border border-slate-300 py-1.5 px-2 text-slate-900 outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="w-20">
                              <label className="text-[10px] text-slate-500 sm:hidden block">Qty</label>
                              <input
                                type="number"
                                min="1"
                                required
                                placeholder="Qty"
                                value={item.quantity}
                                onChange={(e) => handleLineItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full text-xs rounded-md border border-slate-300 py-1.5 px-2 text-slate-900 outline-none focus:border-indigo-500 text-center"
                              />
                            </div>
                            <div className="w-28">
                              <label className="text-[10px] text-slate-500 sm:hidden block">Unit Price</label>
                              <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-[10px] text-slate-400">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  required
                                  placeholder="0.00"
                                  value={item.unitPrice}
                                  onChange={(e) => handleLineItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  className="w-full text-xs rounded-md border border-slate-300 py-1.5 pl-5 pr-2 text-slate-900 outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>
                            <div className="w-24 text-right">
                              <label className="text-[10px] text-slate-500 sm:hidden block">Total</label>
                              <span className="text-xs font-semibold text-slate-900 font-mono">
                                ${itemTotal.toFixed(2)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(idx)}
                              disabled={lineItems.length <= 1}
                              className="text-slate-400 hover:text-rose-600 p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Subtotal, Tax, Discount & Total Breakdown Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Billing Notes & Contract References
                    </label>
                    <textarea
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="e.g. Master Services Agreement #MSA-2026-04 • Net 30 Terms"
                      rows={4}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white py-2 px-3 text-slate-900 outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Calculated Subtotal:</span>
                      <span className="font-mono font-semibold text-slate-900">${computedSubtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Discount Amount (-):</span>
                      <div className="w-28">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full text-right text-xs rounded border border-slate-300 py-1 px-2 text-slate-900 outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Tax / VAT Amount (+):</span>
                      <div className="w-28">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={taxAmount}
                          onChange={(e) => setTaxAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full text-right text-xs rounded border border-slate-300 py-1 px-2 text-slate-900 outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                      <span>Net Total ({newCurrency}):</span>
                      <span className="text-base text-indigo-600 font-mono">${computedTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
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
                    {createInvoiceMutation.isPending ? 'Issuing Invoice...' : `Issue ${newType}`}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Invoice Itemized Dossier & Payment History Modal */}
        {viewingInvoiceId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      {invoiceDetail?.invoice?.invoiceNo || 'Invoice Dossier'}
                      {invoiceDetail?.invoice && (
                        <Badge className={
                          invoiceDetail.invoice.status === 'paid' || invoiceDetail.invoice.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : invoiceDetail.invoice.status === 'partially_paid'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }>
                          {invoiceDetail.invoice.status}
                        </Badge>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {invoiceDetail?.invoice?.type || 'Invoice'} • Currency: {invoiceDetail?.invoice?.currency || 'USD'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingInvoiceId(null)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100"
                >
                  &times;
                </button>
              </div>

              {invoiceDetailLoading ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
                  Loading invoice itemized dossier and payments...
                </div>
              ) : !invoiceDetail?.invoice ? (
                <div className="p-8 text-center text-rose-500">Invoice not found.</div>
              ) : (
                <div className="space-y-6 overflow-y-auto pr-1 py-4 flex-1 text-sm">
                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block font-medium">Customer / Tenant</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {invoiceDetail.invoice.customerName || invoiceDetail.invoice.organization}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Issue Date</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {invoiceDetail.invoice.issueDate
                          ? new Date(invoiceDetail.invoice.issueDate).toISOString().split('T')[0]
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Due Date</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {invoiceDetail.invoice.dueDate
                          ? new Date(invoiceDetail.invoice.dueDate).toISOString().split('T')[0]
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Balance Due</span>
                      <span className="font-semibold text-rose-600 mt-0.5 block font-mono">
                        ${(invoiceDetail.invoice.balanceDue ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Itemized Line Items Table */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Itemized Line Items</h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                          <tr>
                            <th className="px-4 py-2.5">#</th>
                            <th className="px-4 py-2.5">Description</th>
                            <th className="px-4 py-2.5 text-center">Qty</th>
                            <th className="px-4 py-2.5 text-right">Unit Price</th>
                            <th className="px-4 py-2.5 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {invoiceDetail.invoice.lineItems && invoiceDetail.invoice.lineItems.length > 0 ? (
                            invoiceDetail.invoice.lineItems.map((li, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="px-4 py-2.5 font-medium text-slate-900">{li.description}</td>
                                <td className="px-4 py-2.5 text-center text-slate-700">{li.quantity}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                                  ${Number(li.unitPrice).toFixed(2)}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                                  ${Number(li.amount).toFixed(2)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="px-4 py-2.5 text-slate-400 font-mono">1</td>
                              <td className="px-4 py-2.5 font-medium text-slate-900">
                                {invoiceDetail.invoice.description || 'Professional Services'}
                              </td>
                              <td className="px-4 py-2.5 text-center text-slate-700">1</td>
                              <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                                ${(invoiceDetail.invoice.totalAmount ?? invoiceDetail.invoice.amount).toFixed(2)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                                ${(invoiceDetail.invoice.totalAmount ?? invoiceDetail.invoice.amount).toFixed(2)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Financial Breakdown Card */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-1 text-xs text-slate-500">
                      {invoiceDetail.invoice.notes && (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-700 block mb-1">Contract Notes:</span>
                          <p>{invoiceDetail.invoice.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          ${(invoiceDetail.invoice.subtotal ?? invoiceDetail.invoice.amount ?? 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Discount:</span>
                        <span className="font-mono text-slate-900">
                          -${(invoiceDetail.invoice.discountAmount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Tax / VAT:</span>
                        <span className="font-mono text-slate-900">
                          +${(invoiceDetail.invoice.taxAmount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                        <span>Total Amount:</span>
                        <span className="font-mono text-indigo-600">
                          ${(invoiceDetail.invoice.totalAmount ?? invoiceDetail.invoice.amount ?? 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Amount Paid:</span>
                        <span className="font-mono text-emerald-600 font-semibold">
                          ${(invoiceDetail.invoice.amountPaid || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold">
                        <span className="text-slate-900">Balance Due:</span>
                        <span className={`font-mono ${(invoiceDetail.invoice.balanceDue || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          ${(invoiceDetail.invoice.balanceDue ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Records Section */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Verified Payment Receipts ({invoiceDetail.payments?.length || 0})
                    </h4>
                    {invoiceDetail.payments && invoiceDetail.payments.length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                            <tr>
                              <th className="px-4 py-2">Receipt No</th>
                              <th className="px-4 py-2">Date</th>
                              <th className="px-4 py-2">Method</th>
                              <th className="px-4 py-2">Reference</th>
                              <th className="px-4 py-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {invoiceDetail.payments.map((p, pIdx) => (
                              <tr key={pIdx} className="hover:bg-slate-50/50">
                                <td className="px-4 py-2 font-mono font-semibold text-slate-900">{p.receiptNo}</td>
                                <td className="px-4 py-2 text-slate-600">
                                  {p.recordedAt ? new Date(p.recordedAt).toISOString().split('T')[0] : '—'}
                                </td>
                                <td className="px-4 py-2 text-slate-700">{p.method}</td>
                                <td className="px-4 py-2 font-mono text-slate-500">{p.reference}</td>
                                <td className="px-4 py-2 text-right font-mono font-semibold text-emerald-600">
                                  ${Number(p.amount).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                        No manual payment receipts linked to this invoice number yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  onClick={() => setViewingInvoiceId(null)}
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs px-4"
                >
                  Close Dossier
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Record Manual Payment Modal with Deterministic Balance Reconciliation */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Record Verified B2B Payment</h3>
                  <p className="text-xs text-slate-500">Apply manual bank receipt against outstanding customer invoices.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-4">
                {/* Invoice Dropdown */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Select Target Invoice <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={payInvoiceId}
                    onChange={(e) => handleSelectInvoiceForPayment(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">-- Select Outstanding Invoice --</option>
                    {invoices
                      .filter((inv) => {
                        const bal = inv.balanceDue ?? (inv.status === 'Paid' || inv.status === 'paid' ? 0 : (inv.totalAmount ?? inv.amount ?? 0));
                        return bal > 0 && inv.status !== 'Paid' && inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'written_off';
                      })
                      .map((inv) => {
                        const bal = inv.balanceDue ?? (inv.totalAmount ?? inv.amount ?? 0);
                        const curr = inv.currency === 'EUR' ? '€' : inv.currency === 'GBP' ? '£' : '$';
                        return (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoiceNo} — {inv.customerName || inv.organization} (Balance Due: {curr}{bal.toFixed(2)})
                          </option>
                        );
                      })}
                  </select>
                  {invoices.filter(i => (i.balanceDue ?? 1) > 0 && i.status !== 'paid' && i.status !== 'Paid').length === 0 && (
                    <p className="text-[11px] text-slate-500 mt-1">No outstanding invoices with unpaid balances currently found.</p>
                  )}
                </div>

                {/* Selected Invoice Details & Live Balance Breakdown */}
                {selectedPaymentInvoice && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Customer / Tenant:</span>
                      <span className="font-semibold text-slate-900">
                        {selectedPaymentInvoice.customerName || selectedPaymentInvoice.organization}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Invoice Total Amount:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        ${(selectedPaymentInvoice.totalAmount ?? selectedPaymentInvoice.amount ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Already Paid:</span>
                      <span className="font-mono text-emerald-600">
                        ${(selectedPaymentInvoice.amountPaid || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold">
                      <span className="text-slate-800">Current Balance Due:</span>
                      <span className="font-mono text-rose-600">
                        ${selectedInvoiceBalance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Payment Amount Input */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Payment Amount (USD) <span className="text-rose-500">*</span>
                    </label>
                    {selectedInvoiceBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setPayAmount(selectedInvoiceBalance.toFixed(2))}
                        className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Pay Full Balance (${selectedInvoiceBalance.toFixed(2)})
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0.00"
                      className={`block w-full rounded-lg border py-2 pl-8 pr-4 text-sm font-mono text-slate-900 outline-none ${
                        isOverpayment
                          ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-slate-300 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                      }`}
                    />
                  </div>

                  {/* Real-time Status / Error Indicator */}
                  {selectedPaymentInvoice && (
                    <div className="mt-1.5">
                      {isOverpayment ? (
                        <p className="text-xs text-rose-600 font-medium">
                          ⚠️ Overpayment Error: Amount ($
                          {parseFloat(payAmount || '0').toFixed(2)}) exceeds invoice balance due ($
                          {selectedInvoiceBalance.toFixed(2)}).
                        </p>
                      ) : numPayAmount === selectedInvoiceBalance && numPayAmount > 0 ? (
                        <p className="text-xs text-emerald-600 font-medium">
                          ✓ Full balance payment: Invoice will transition to fully <strong>Paid</strong>.
                        </p>
                      ) : numPayAmount > 0 && numPayAmount < selectedInvoiceBalance ? (
                        <p className="text-xs text-blue-600">
                          ℹ️ Partial installment: Projected remaining balance will be{' '}
                          <strong>${projectedRemainingBalance.toFixed(2)}</strong> (<strong>Partially Paid</strong>).
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Payment Method <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="wire">Bank Wire Transfer (SWIFT / Fedwire)</option>
                    <option value="bank_transfer">Direct ACH / SEPA Transfer</option>
                    <option value="check">Physical Corporate Check</option>
                    <option value="manual_card">Manual Corporate Card</option>
                    <option value="other">Other / Custom Channel</option>
                  </select>
                </div>

                {/* Transaction Reference Number */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Transaction Reference / Wire Confirmation <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="e.g. WIRE-2026-9821A or CHK-4491"
                    className="block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 font-mono placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Reconciliation Notes
                  </label>
                  <textarea
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional notes from bank reconciliation..."
                    className="block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
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
                    disabled={recordPaymentMutation.isPending || isOverpayment || !payInvoiceId || !payAmount || numPayAmount <= 0}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {recordPaymentMutation.isPending ? 'Recording Receipt...' : 'Record Payment Receipt'}
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
                    <option value="infrastructure">Cloud Hosting & Infrastructure</option>
                    <option value="ai_compute">Gemini / AI Foundation Tokens</option>
                    <option value="software_licenses">SaaS Tools & Software Licenses</option>
                    <option value="salaries">Salaries & Contractor Fees</option>
                    <option value="marketing">Marketing & Growth Operations</option>
                    <option value="office">Office & Hardware Equipment</option>
                    <option value="legal">Legal, Accounting & Compliance</option>
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

        {/* Edit Customer Account Terms Modal */}
        {editingAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Commercial Terms — {editingAccount.organization?.name || 'Customer Account'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure billing status, credit limits, contractual terms, and primary billing contact.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <Ban className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAccountTerms} className="space-y-4 mt-4 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Account Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as CustomerAccountStatus)}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="good_standing">Good Standing</option>
                      <option value="delinquent">Delinquent</option>
                      <option value="credit_hold">Credit Hold</option>
                      <option value="vip">VIP Partner</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Billing Cycle
                    </label>
                    <select
                      value={editBillingCycle}
                      onChange={(e) => setEditBillingCycle(e.target.value as BillingCycle)}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Credit Limit (USD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={editCreditLimit}
                      onChange={(e) => setEditCreditLimit(e.target.value)}
                      placeholder="0"
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Preferred Currency
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value.toUpperCase())}
                      placeholder="USD"
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 uppercase"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                    Primary Billing Contact
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500">Contact Name</label>
                      <input
                        type="text"
                        value={editContactName}
                        onChange={(e) => setEditContactName(e.target.value)}
                        placeholder="John Doe"
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">Contact Email</label>
                      <input
                        type="email"
                        value={editContactEmail}
                        onChange={(e) => setEditContactEmail(e.target.value)}
                        placeholder="billing@company.com"
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">Phone</label>
                      <input
                        type="text"
                        value={editContactPhone}
                        onChange={(e) => setEditContactPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">Billing Address</label>
                      <input
                        type="text"
                        value={editContactAddress}
                        onChange={(e) => setEditContactAddress(e.target.value)}
                        placeholder="100 Enterprise Way, Suite 400"
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Commercial Terms & Notes
                  </label>
                  <textarea
                    value={editCommercialNotes}
                    onChange={(e) => setEditCommercialNotes(e.target.value)}
                    rows={2}
                    placeholder="Custom payment SLA terms, purchase order references, or executive notes"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingAccount(null)}
                    className="rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateAccountMutation.isPending}
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                    {updateAccountMutation.isPending ? 'Saving Terms...' : 'Update Account Terms'}
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
