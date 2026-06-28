import React, { useState } from 'react';
import { Search, Plus, Building2, CheckCircle, Ban } from 'lucide-react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { toast } from 'sonner';

interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  plan: 'Starter' | 'Growth' | 'Enterprise';
  status: 'Active' | 'Suspended';
  usersCount: number;
  createdAt: string;
  supportEmail: string;
}

const initialOrgs: OrganizationItem[] = [
  { id: '1', name: 'Northwind Labs', slug: 'northwind-labs', plan: 'Enterprise', status: 'Active', usersCount: 142, createdAt: '2026-01-10', supportEmail: 'support@northwind.com' },
  { id: '2', name: 'Globex Inc', slug: 'globex', plan: 'Growth', status: 'Active', usersCount: 68, createdAt: '2026-02-14', supportEmail: 'contact@globex.com' },
  { id: '3', name: 'Acme Corp', slug: 'acme-corp', plan: 'Starter', status: 'Active', usersCount: 22, createdAt: '2026-03-01', supportEmail: 'admin@acme.com' },
  { id: '4', name: 'Initech', slug: 'initech', plan: 'Growth', status: 'Suspended', usersCount: 45, createdAt: '2026-01-20', supportEmail: 'billing@initech.com' },
  { id: '5', name: 'Umbrella Corp', slug: 'umbrella', plan: 'Enterprise', status: 'Active', usersCount: 310, createdAt: '2025-11-15', supportEmail: 'security@umbrella.com' },
];

export function SuperAdminOrganizations() {
  const [orgs, setOrgs] = useState<OrganizationItem[]>(initialOrgs);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create Modal State
  const [showModal, setShowModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState<'Starter' | 'Growth' | 'Enterprise'>('Starter');
  const [newOrgEmail, setNewOrgEmail] = useState('');

  const toggleOrgStatus = (id: string) => {
    setOrgs(prev => prev.map(o => {
      if (o.id === id) {
        const nextStatus = o.status === 'Active' ? 'Suspended' : 'Active';
        toast.success(`Organization "${o.name}" status updated to ${nextStatus}.`);
        return { ...o, status: nextStatus };
      }
      return o;
    }));
  };

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgSlug || !newOrgEmail) {
      toast.error('Please fill in all fields.');
      return;
    }

    const newOrg: OrganizationItem = {
      id: (orgs.length + 1).toString(),
      name: newOrgName,
      slug: newOrgSlug,
      plan: newOrgPlan,
      status: 'Active',
      usersCount: 1, // owner account
      createdAt: new Date().toISOString().split('T')[0],
      supportEmail: newOrgEmail
    };

    setOrgs([newOrg, ...orgs]);
    setShowModal(false);
    toast.success(`Organization "${newOrgName}" provisioned successfully.`);
    
    // Reset form
    setNewOrgName('');
    setNewOrgSlug('');
    setNewOrgEmail('');
    setNewOrgPlan('Starter');
  };

  const autoGenerateSlug = (val: string) => {
    setNewOrgName(val);
    setNewOrgSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  };

  const filteredOrgs = orgs.filter(o => 
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.supportEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Manage Organizations</h1>
          <p className="text-gray-400">Provision and configure tenant settings</p>
        </div>
        <Button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white"
        >
          <Plus className="h-4 w-4" />
          New Organization
        </Button>
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
            placeholder="Search organizations by name, slug, or email..."
            className="block w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none hover:border-white/20 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Organizations Table */}
      <Card className="overflow-hidden border-white/5 bg-white/[0.01]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-white/[0.03] text-xs font-semibold uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-6 py-4">Organization</th>
                <th className="px-6 py-4">Slug / Domain</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Active Users</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOrgs.map((org) => (
                <tr key={org.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{org.name}</div>
                        <div className="text-xs text-gray-500">{org.supportEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-400">
                    {org.slug}.talnova.app
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={
                      org.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }>
                      {org.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{org.plan}</td>
                  <td className="px-6 py-4 text-gray-400">{org.usersCount}</td>
                  <td className="px-6 py-4 text-gray-400">{org.createdAt}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleOrgStatus(org.id)}
                        className={`gap-1 px-2.5 ${org.status === 'Active' ? 'text-rose-400 hover:bg-rose-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                      >
                        {org.status === 'Active' ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        {org.status === 'Active' ? 'Suspend' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrgs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No organizations matching filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0F131E] p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Provision Workspace</h3>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Organization Name</label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => autoGenerateSlug(e.target.value)}
                  placeholder="Acme Corp"
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2 px-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Workspace URL Slug</label>
                <input
                  type="text"
                  required
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  placeholder="acme-corp"
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2 px-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Billing / Support Email</label>
                <input
                  type="email"
                  required
                  value={newOrgEmail}
                  onChange={(e) => setNewOrgEmail(e.target.value)}
                  placeholder="billing@acme.com"
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2 px-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Subscription Tier</label>
                <select
                  value={newOrgPlan}
                  onChange={(e) => setNewOrgPlan(e.target.value as any)}
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-[#0F131E] py-2 px-3 text-sm text-white outline-none focus:border-indigo-500"
                >
                  <option value="Starter">Starter Plan</option>
                  <option value="Growth">Growth Plan</option>
                  <option value="Enterprise">Enterprise Plan</option>
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
                  Provision Org
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
