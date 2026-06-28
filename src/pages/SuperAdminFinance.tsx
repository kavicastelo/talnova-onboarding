import React, { useState } from 'react';
import { Search, Plus, FileText, CheckCircle, Clock, AlertCircle, Download, FileSpreadsheet } from 'lucide-react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { toast } from 'sonner';

interface InvoiceItem {
  id: string;
  invoiceNo: string;
  organization: string;
  amount: number;
  type: 'Invoice' | 'Receipt';
  status: 'Paid' | 'Pending' | 'Overdue';
  dueDate: string;
  description: string;
}

const initialInvoices: InvoiceItem[] = [
  { id: '1', invoiceNo: 'INV-8890', organization: 'Northwind Labs', amount: 8400, type: 'Invoice', status: 'Paid', dueDate: '2026-06-15', description: 'Enterprise Plan - Q2 2026' },
  { id: '2', invoiceNo: 'RCT-1209', organization: 'Globex Inc', amount: 2450, type: 'Receipt', status: 'Paid', dueDate: '2026-06-01', description: 'Growth Plan Monthly Fee' },
  { id: '3', invoiceNo: 'INV-8891', organization: 'Acme Corp', amount: 1200, type: 'Invoice', status: 'Pending', dueDate: '2026-07-05', description: 'Starter Plan - Annual' },
  { id: '4', invoiceNo: 'INV-8892', organization: 'Initech', amount: 3500, type: 'Invoice', status: 'Overdue', dueDate: '2026-05-20', description: 'Growth Plan Renewal' },
  { id: '5', invoiceNo: 'RCT-1210', organization: 'Umbrella Corp', amount: 15200, type: 'Receipt', status: 'Paid', dueDate: '2026-05-15', description: 'Enterprise Custom SLA Addon' },
];

export function SuperAdminFinance() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newOrg, setNewOrg] = useState('Northwind Labs');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'Invoice' | 'Receipt'>('Invoice');
  const [newStatus, setNewStatus] = useState<'Paid' | 'Pending' | 'Overdue'>('Pending');
  const [newDesc, setNewDesc] = useState('');

  // Calculations
  const totalRevenue = invoices
    .filter(i => i.status === 'Paid')
    .reduce((sum, i) => sum + i.amount, 0);

  const pendingRevenue = invoices
    .filter(i => i.status === 'Pending')
    .reduce((sum, i) => sum + i.amount, 0);

  const overdueRevenue = invoices
    .filter(i => i.status === 'Overdue')
    .reduce((sum, i) => sum + i.amount, 0);

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmount || !newDesc) {
      toast.error('Please fill in amount and description.');
      return;
    }

    const docPrefix = newType === 'Invoice' ? 'INV' : 'RCT';
    const randNo = Math.floor(1000 + Math.random() * 9000);

    const newItem: InvoiceItem = {
      id: (invoices.length + 1).toString(),
      invoiceNo: `${docPrefix}-${randNo}`,
      organization: newOrg,
      amount: parseFloat(newAmount),
      type: newType,
      status: newStatus,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days out
      description: newDesc
    };

    setInvoices([newItem, ...invoices]);
    setShowModal(false);
    toast.success(`${newType} ${newItem.invoiceNo} issued successfully.`);
    
    // Reset Form
    setNewAmount('');
    setNewDesc('');
    setNewStatus('Pending');
  };

  const handleExport = () => {
    toast.success('Financial directory data exported to CSV format.');
  };

  const filteredInvoices = invoices.filter(i => 
    i.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.organization.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Manual Finance & Billing</h1>
          <p className="text-gray-400">Issue custom tenant invoices, receipts, and track incoming payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={handleExport}
            className="flex items-center gap-2 border-white/10 text-white hover:bg-white/5"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            Export Directory
          </Button>
          <Button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            <Plus className="h-4 w-4" />
            Issue Custom Billing
          </Button>
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-sm font-medium">Platform Received Payments</span>
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</span>
          </div>
        </Card>

        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-sm font-medium">Pending Custom Invoices</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-white">${pendingRevenue.toLocaleString()}</span>
          </div>
        </Card>

        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-sm font-medium">Overdue Invoice Balances</span>
            <AlertCircle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-white">${overdueRevenue.toLocaleString()}</span>
          </div>
        </Card>
      </div>

      {/* Filter and search bar */}
      <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.01] p-3.5">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search billing records by number, tenant name, or notes..."
            className="block w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none hover:border-white/20 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Billing directory table */}
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
              {filteredInvoices.map((inv) => (
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
              {filteredInvoices.length === 0 && (
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

      {/* Manual invoice/receipt creation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0F131E] p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Issue Custom Invoice / Receipt</h3>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Target Organization</label>
                <select
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-[#0F131E] py-2 px-3 text-sm text-white outline-none focus:border-indigo-500"
                >
                  <option value="Northwind Labs">Northwind Labs</option>
                  <option value="Globex Inc">Globex Inc</option>
                  <option value="Acme Corp">Acme Corp</option>
                  <option value="Initech">Initech</option>
                  <option value="Umbrella Corp">Umbrella Corp</option>
                </select>
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
                  className="rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white"
                >
                  Issue Record
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
