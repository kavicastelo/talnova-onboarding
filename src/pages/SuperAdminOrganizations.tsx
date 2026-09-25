import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Building2, CheckCircle, Ban, RefreshCw, Edit, Eye } from 'lucide-react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { SimplePagination } from '../components/SimplePagination';
import { SuperAdminShell } from '../components/super-admin/SuperAdminShell';
import { toast } from 'sonner';
import {
  useSuperAdminOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
  useToggleOrganizationStatus
} from '../hooks/useSuperAdmin';
import { OrganizationItem } from '../services/superAdmin.service';

export function SuperAdminOrganizations() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // React Query Hooks
  const { data, isLoading, isError, refetch } = useSuperAdminOrganizations({
    search: searchQuery || undefined,
    page,
    limit,
  });

  const createOrgMutation = useCreateOrganization();
  const updateOrgMutation = useUpdateOrganization();
  const toggleStatusMutation = useToggleOrganizationStatus();

  // Create Modal State
  const [showModal, setShowModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState<'Starter' | 'Growth' | 'Professional' | 'Enterprise'>('Starter');
  const [newOrgEmail, setNewOrgEmail] = useState('');

  // Edit Tenant Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationItem | null>(null);
  const [editPlan, setEditPlan] = useState<'Starter' | 'Growth' | 'Professional' | 'Enterprise'>('Professional');
  const [editSeatQuota, setEditSeatQuota] = useState<number | string>(50);
  const [editStatus, setEditStatus] = useState<'Active' | 'Suspended'>('Active');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleOpenEditModal = (org: OrganizationItem) => {
    setEditingOrg(org);
    setEditPlan(org.plan || 'Professional');
    setEditSeatQuota(org.seatLimit || org.limits?.maxUsers || 50);
    setEditStatus(org.status || 'Active');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;

    const quotaNum = Number(editSeatQuota);
    if (isNaN(quotaNum) || quotaNum < 0) {
      toast.error('Seat quota must be a non-negative number.');
      return;
    }

    setIsUpdating(true);
    try {
      // Dispatch PATCH using slug or id
      const targetId = editingOrg.slug || editingOrg.id;
      await updateOrgMutation.mutateAsync({
        id: targetId,
        data: {
          plan: editPlan,
          seatQuota: quotaNum,
          status: editStatus
        }
      });

      toast.success(`Tenant "${editingOrg.name}" updated successfully.`);
      setShowEditModal(false);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update tenant settings.');
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleOrgStatus = async (id: string, currentStatus: 'Active' | 'Suspended') => {
    const nextStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    try {
      await toggleStatusMutation.mutateAsync({ id, status: nextStatus });
      toast.success(`Organization status updated to ${nextStatus}.`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update organization status.');
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgSlug || !newOrgEmail) {
      toast.error('Please fill in all fields.');
      return;
    }

    try {
      await createOrgMutation.mutateAsync({
        name: newOrgName,
        slug: newOrgSlug,
        plan: newOrgPlan,
        supportEmail: newOrgEmail,
      });

      setShowModal(false);
      toast.success(`Organization "${newOrgName}" provisioned successfully.`);
      
      // Reset form
      setNewOrgName('');
      setNewOrgSlug('');
      setNewOrgEmail('');
      setNewOrgPlan('Starter');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to provision organization.');
    }
  };

  const autoGenerateSlug = (val: string) => {
    setNewOrgName(val);
    setNewOrgSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  };

  const orgs = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <SuperAdminShell
      title="Organizations & Tenants"
      subtitle="Provision, configure quotas, and inspect cross-tenant customer workspaces"
      hideFilterBar={true}
      actions={
        <Button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3.5 py-2 shadow-lg shadow-indigo-500/20"
        >
          <Plus className="h-3.5 w-3.5" />
          Provision Tenant
        </Button>
      }
    >

      {/* Filter and search bar */}
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
              setPage(1); // Reset page to 1 on new search
            }}
            placeholder="Search organizations by name, slug, or email..."
            className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Table Section */}
      {isLoading ? (
        <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm rounded-xl">
          <div className="p-6 text-center animate-pulse space-y-4">
            <div className="h-6 w-1/4 rounded bg-slate-200" />
            <div className="h-32 w-full rounded bg-slate-100" />
          </div>
        </Card>
      ) : isError ? (
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <Ban className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Sync Failed</h3>
          <p className="mt-2 text-sm text-slate-600">Could not sync organization details from API.</p>
          <Button 
            onClick={() => refetch()} 
            className="mt-4 flex mx-auto items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Organization</th>
                    <th className="px-6 py-4">Slug / Domain</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Plan</th>
                    <th className="px-6 py-4">Seat Limit</th>
                    <th className="px-6 py-4">Active Users</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orgs.map((org) => (
                    <tr
                      key={org.id}
                      id={`tenant-row-${org.slug || org.id}`}
                      data-testid={`tenant-row-${org.slug || org.id}`}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 tenant-name-cell">{org.name}</div>
                            <div className="text-xs text-slate-500">{org.supportEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">
                        {org.domain || `${org.slug}.talnova.app`}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={
                          org.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }>
                          {org.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          org.plan === 'Enterprise' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          org.plan === 'Professional' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          org.plan === 'Growth' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {org.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-indigo-600 font-semibold seat-limit-cell">
                        {org.seatLimit || org.limits?.maxUsers || 50} seats
                      </td>
                      <td className="px-6 py-4 text-slate-600">{org.usersCount}</td>
                      <td className="px-6 py-4 text-slate-500">{org.createdAt}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/super-admin/organizations/${org.id}`)}
                            className="gap-1 px-2.5 py-1 text-xs border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            360° View
                          </Button>
                          <Button
                            id={`edit-tenant-btn-${org.slug || org.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditModal(org)}
                            className="gap-1.5 px-2.5 py-1 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          >
                            <Edit className="h-3.5 w-3.5 text-slate-500" />
                            Edit
                          </Button>
                          <Button
                            id={`suspend-tenant-btn-${org.slug || org.id}`}
                            variant="ghost"
                            size="sm"
                            disabled={toggleStatusMutation.isPending}
                            onClick={() => toggleOrgStatus(org.id, org.status)}
                            className={`gap-1 px-2.5 ${org.status === 'Active' ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          >
                            {org.status === 'Active' ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                            {org.status === 'Active' ? 'Suspend' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orgs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                        No organizations matching filter criteria.
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
              itemLabel="organizations"
            />
          </div>
        </>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Provision Workspace</h3>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Organization Name</label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => autoGenerateSlug(e.target.value)}
                  placeholder="Acme Corp"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Workspace URL Slug</label>
                <input
                  type="text"
                  required
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  placeholder="acme-corp"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Billing / Support Email</label>
                <input
                  type="email"
                  required
                  value={newOrgEmail}
                  onChange={(e) => setNewOrgEmail(e.target.value)}
                  placeholder="billing@acme.com"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Subscription Tier</label>
                <select
                  value={newOrgPlan}
                  onChange={(e) => setNewOrgPlan(e.target.value as any)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Starter">Starter Plan</option>
                  <option value="Growth">Growth Plan</option>
                  <option value="Enterprise">Enterprise Plan</option>
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
                  disabled={createOrgMutation.isPending}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  {createOrgMutation.isPending ? 'Provisioning...' : 'Provision Org'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tenant Modal */}
      {showEditModal && editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" id="edit-tenant-modal">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Edit Tenant</h3>
                <p className="text-xs text-slate-500 mt-0.5">{editingOrg.name} ({editingOrg.slug})</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Subscription Plan Tier
                </label>
                <select
                  id="tenant-edit-plan-select"
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value as any)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Starter">Starter</option>
                  <option value="Growth">Growth</option>
                  <option value="Professional">Professional</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Seat Quota / License Limit
                </label>
                <input
                  id="tenant-edit-seat-quota-input"
                  type="number"
                  required
                  min="0"
                  value={editSeatQuota}
                  onChange={(e) => setEditSeatQuota(e.target.value)}
                  placeholder="500"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Tenant Status
                </label>
                <select
                  id="tenant-edit-status-select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button
                  id="edit-tenant-save-btn"
                  type="submit"
                  disabled={isUpdating}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 font-medium shadow-lg shadow-indigo-500/20"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SuperAdminShell>
  );
}
