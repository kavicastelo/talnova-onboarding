import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  KeyRound,
  LogOut,
  Building2,
  RefreshCw,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SimplePagination } from '../../components/SimplePagination';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { useSuperAdminFilter } from '../../context/SuperAdminFilterContext';
import {
  useSuperAdminSessions,
  useRevokeSession
} from '../../hooks/useSuperAdmin';
import { toast } from 'sonner';

function SuperAdminSessionsContent() {
  const navigate = useNavigate();
  const { selectedOrgId, refreshKey } = useSuperAdminFilter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading, refetch } = useSuperAdminSessions({
    organizationId: selectedOrgId !== 'all' ? selectedOrgId : undefined,
    page,
    limit
  });

  // Refetch when universal filter refreshKey triggers
  useEffect(() => {
    if (refreshKey > 0) {
      refetch();
    }
  }, [refreshKey, refetch]);

  const revokeMutation = useRevokeSession();

  const handleRevoke = async (sessionId: string, userEmail?: string) => {
    try {
      await revokeMutation.mutateAsync(sessionId);
      toast.success(`Session for ${userEmail || 'user'} revoked.`);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to revoke session.');
    }
  };

  const sessions = data?.sessions || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Sessions Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Platform Sessions</span>
            <KeyRound className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {total}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Valid JWT session records across all tenants
          </p>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Security State</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-600">
            Enforced
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Token reuse detection & automatic invalidation enabled
          </p>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Default Session TTL</span>
            <Clock className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            30 Days
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            With MongoDB native TTL automatic index pruning
          </p>
        </Card>
      </div>

      {/* Active Sessions Table */}
      <Card className="border border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-indigo-600" />
              Real-Time Active Sessions ({total})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live token bindings with client user-agent metadata and remote IP addresses.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Sessions
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 uppercase tracking-wider text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="px-4 py-3">User & Contact</th>
                <th className="px-4 py-3">Tenant / Workspace</th>
                <th className="px-4 py-3">Client Device / OS</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3 text-right">Revoke Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Inspecting active session store…
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No active sessions currently open.
                  </td>
                </tr>
              ) : (
                sessions.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      {s.user ? (
                        <div>
                          <span
                            onClick={() => navigate(`/super-admin/users/${s.user.id}`)}
                            className="font-semibold text-slate-900 hover:text-indigo-600 cursor-pointer block"
                          >
                            {s.user.name}
                          </span>
                          <span className="font-mono text-indigo-600 text-[11px]">{s.user.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">System Identity</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {s.organization ? (
                        <span
                          onClick={() => navigate(`/super-admin/organizations/${s.organization.id}`)}
                          className="flex items-center gap-1 hover:text-indigo-600 cursor-pointer"
                        >
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {s.organization.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Platform Root</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-[11px]">
                      {s.deviceInfo || 'Browser Session'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {s.ipAddress || 'Internal'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                      {new Date(s.lastActivityAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevoke(s.id, s.user?.email)}
                        className="h-7 px-2.5 text-xs text-rose-600 hover:bg-rose-50 gap-1 font-medium"
                      >
                        <LogOut className="h-3 w-3" />
                        Revoke Token
                      </Button>
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
            itemLabel="sessions"
          />
        </div>
      </Card>
    </div>
  );
}

export function SuperAdminSessions() {
  const navigate = useNavigate();
  return (
    <SuperAdminShell
      title="Active Sessions Hub"
      subtitle="Real-time cross-tenant JWT token tracking, device inspection, and one-click security revocation"
      actions={
        <Button
          variant="outline"
          onClick={() => navigate('/super-admin/users')}
          className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs gap-1.5"
        >
          User Directory
        </Button>
      }
    >
      <SuperAdminSessionsContent />
    </SuperAdminShell>
  );
}

export default SuperAdminSessions;
