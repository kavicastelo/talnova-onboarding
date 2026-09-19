import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  KeyRound,
  Eye,
  LogOut,
  Building2,
  RefreshCw
} from 'lucide-react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { SimplePagination } from '../../components/SimplePagination';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { useSuperAdminFilter } from '../../context/SuperAdminFilterContext';
import {
  useSuperAdminUsers,
  useForceLogoutUser
} from '../../hooks/useSuperAdmin';
import { toast } from 'sonner';

function SuperAdminUsersContent() {
  const navigate = useNavigate();
  const { selectedOrgId } = useSuperAdminFilter();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  const { data, isLoading, refetch } = useSuperAdminUsers({
    search: search || undefined,
    organizationId: selectedOrgId !== 'all' ? selectedOrgId : undefined,
    role: roleFilter !== 'all' ? roleFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    page,
    limit
  });

  const forceLogoutMutation = useForceLogoutUser();

  const handleForceLogout = async (user: any) => {
    try {
      await forceLogoutMutation.mutateAsync(user.id);
      toast.success(`All active sessions revoked for ${user.email}.`);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to revoke sessions.');
    }
  };

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Search & Filter Header Card */}
      <Card className="border border-slate-200 bg-white shadow-sm p-4 rounded-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email, employee ID, or department…"
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="all">All Roles</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="hr_admin">HR Admin</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
              <option value="super_admin">Super Admin</option>
              <option value="it_admin">IT Admin</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="onboarding">Onboarding</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </select>

            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              className="border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Users Directory Table */}
      <Card className="border border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 uppercase tracking-wider text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="px-4 py-3">User & Contact</th>
                <th className="px-4 py-3">Tenant / Workspace</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading cross-tenant directory…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No users found matching query criteria.
                  </td>
                </tr>
              ) : (
                users.map((u: any) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => navigate(`/super-admin/users/${u.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{u.name}</div>
                          <div className="text-[11px] font-mono text-indigo-600">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {u.organization ? (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {u.organization.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Platform Root</span>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      <Badge className="bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px]">
                        {u.role?.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.department || 'General'}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          u.status?.toLowerCase() === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }
                      >
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/super-admin/users/${u.id}`)}
                          className="h-7 px-2 text-xs border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          360°
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleForceLogout(u)}
                          title="Revoke all active sessions"
                          className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50"
                        >
                          <LogOut className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100">
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
            itemLabel="users"
          />
        </div>
      </Card>
    </div>
  );
}

export function SuperAdminUsers() {
  const navigate = useNavigate();
  return (
    <SuperAdminShell
      title="Cross-Tenant User Directory"
      subtitle="Global identity governance, role administration, active session revocation, and security posture"
      actions={
        <Button
          onClick={() => navigate('/super-admin/users/sessions')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Active Sessions Hub
        </Button>
      }
    >
      <SuperAdminUsersContent />
    </SuperAdminShell>
  );
}

export default SuperAdminUsers;
