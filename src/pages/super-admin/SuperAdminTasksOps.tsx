import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  RefreshCw
} from 'lucide-react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { SimplePagination } from '../../components/SimplePagination';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { useSuperAdminFilter } from '../../context/SuperAdminFilterContext';
import { useSuperAdminTasksOps } from '../../hooks/useSuperAdmin';

function SuperAdminTasksOpsContent() {
  const navigate = useNavigate();
  const { selectedOrgId } = useSuperAdminFilter();
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  const { data, isLoading, refetch } = useSuperAdminTasksOps({
    organizationId: selectedOrgId !== 'all' ? selectedOrgId : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    page,
    limit
  });

  const tasks = data?.tasks || [];
  const summary = data?.summary || { total: 0, overdueCount: 0, itHardwareCount: 0 };
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-200 bg-white shadow-sm p-4 rounded-xl">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Operations Tasks</span>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{summary.total}</div>
          <span className="text-[11px] text-slate-500">Across all tenant checklists</span>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm p-4 rounded-xl">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">IT Hardware & Provisioning</span>
          <div className="mt-2 text-2xl font-bold font-mono text-indigo-600">{summary.itHardwareCount}</div>
          <span className="text-[11px] text-indigo-600">Laptops, monitors & credentials</span>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm p-4 rounded-xl">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">SLA Breaches (Overdue)</span>
          <div className={`mt-2 text-2xl font-bold font-mono ${summary.overdueCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {summary.overdueCount}
          </div>
          <span className={`text-[11px] ${summary.overdueCount > 0 ? 'text-rose-600 font-medium' : 'text-emerald-600'}`}>
            {summary.overdueCount > 0 ? 'Immediate attention required' : 'All SLAs healthy'}
          </span>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border border-slate-200 bg-white shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap rounded-xl">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-600 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-600 font-medium">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="all">All Types</option>
              <option value="it_provisioning">IT Provisioning</option>
              <option value="hardware">Hardware</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          className="border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50 gap-1.5 shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Queue
        </Button>
      </Card>

      {/* Tasks Table */}
      <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 uppercase tracking-wider text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="px-4 py-3">Task Title</th>
                <th className="px-4 py-3">Tenant / Organization</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due Date / SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading operations queue…
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No operational tasks match filter criteria.
                  </td>
                </tr>
              ) : (
                tasks.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        {t.isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                        <span>{t.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {t.organization ? (
                        <span
                          onClick={() => navigate(`/super-admin/organizations/${t.organization.id}`)}
                          className="hover:text-indigo-600 cursor-pointer flex items-center gap-1"
                        >
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {t.organization.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Platform Default</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] capitalize text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block font-semibold">
                        {t.type?.replace('_', ' ') || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {t.assignee?.name || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`uppercase text-[10px] font-mono ${
                        t.priority === 'high' || t.priority === 'urgent'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {t.priority || 'medium'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`capitalize text-[10px] font-mono ${
                        t.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {t.dueDate ? (
                        <span className={t.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                          {new Date(t.dueDate).toLocaleDateString()} {t.isOverdue ? '(BREACH)' : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No SLA</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200">
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
            itemLabel="tasks"
          />
        </div>
      </Card>
    </div>
  );
}

export function SuperAdminTasksOps() {
  return (
    <SuperAdminShell
      title="Operations & IT Hardware Queue"
      subtitle="Cross-tenant task orchestration, hardware dispatch, and SLA breach tracking"
    >
      <SuperAdminTasksOpsContent />
    </SuperAdminShell>
  );
}

export default SuperAdminTasksOps;
