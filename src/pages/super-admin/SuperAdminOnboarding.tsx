import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  RefreshCw
} from 'lucide-react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { SimplePagination } from '../../components/SimplePagination';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { useSuperAdminFilter } from '../../context/SuperAdminFilterContext';
import { useSuperAdminOnboardingCases } from '../../hooks/useSuperAdmin';

function SuperAdminOnboardingContent() {
  const navigate = useNavigate();
  const { selectedOrgId } = useSuperAdminFilter();
  const [stateFilter, setStateFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  const { data, isLoading, refetch } = useSuperAdminOnboardingCases({
    organizationId: selectedOrgId !== 'all' ? selectedOrgId : undefined,
    state: stateFilter !== 'all' ? stateFilter : undefined,
    page,
    limit
  });

  const cases = data?.cases || [];
  const summary = data?.summary || {
    totalCases: 0,
    activeCases: 0,
    readyForHandover: 0,
    completedCases: 0,
    failedCases: 0
  };
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Onboarding Pipeline Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border border-slate-200 bg-white shadow-sm p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Cases</span>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{summary.totalCases}</div>
          <span className="text-[11px] text-slate-500">Cross-tenant pipeline</span>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">In Progress</span>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-600">{summary.activeCases}</div>
          <span className="text-[11px] text-amber-600">Active onboarding</span>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Pending Handover</span>
          <div className="mt-2 text-2xl font-bold font-mono text-indigo-600">{summary.readyForHandover}</div>
          <span className="text-[11px] text-indigo-600">Ready for team lead</span>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Completed</span>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-600">{summary.completedCases}</div>
          <span className="text-[11px] text-emerald-600">Successfully graduated</span>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Failed / Blocked</span>
          <div className="mt-2 text-2xl font-bold font-mono text-rose-600">{summary.failedCases}</div>
          <span className="text-[11px] text-rose-600">Provisioning exceptions</span>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border border-slate-200 bg-white shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-medium">State Filter:</span>
          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          >
            <option value="all">All States</option>
            <option value="active">Active</option>
            <option value="ready">Ready</option>
            <option value="provisioning">Provisioning</option>
            <option value="ready_for_handover">Ready for Handover</option>
            <option value="completed">Completed</option>
            <option value="provisioning_failed">Provisioning Failed</option>
          </select>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          className="border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50 gap-1.5 shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Pipeline
        </Button>
      </Card>

      {/* Cases Table */}
      <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 uppercase tracking-wider text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Tenant / Organization</th>
                <th className="px-4 py-3">Source Channel</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Audit Transitions</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading onboarding cases…
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No onboarding cases match filter criteria.
                  </td>
                </tr>
              ) : (
                cases.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      {c.employee ? (
                        <div>
                          <span
                            onClick={() => navigate(`/super-admin/users/${c.employee.id}`)}
                            className="font-semibold text-slate-900 hover:text-indigo-600 cursor-pointer"
                          >
                            {c.employee.name}
                          </span>
                          <span className="block font-mono text-[11px] text-slate-500">{c.employee.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned Candidate</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {c.organization ? (
                        <span
                          onClick={() => navigate(`/super-admin/organizations/${c.organization.id}`)}
                          className="hover:text-indigo-600 cursor-pointer flex items-center gap-1"
                        >
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {c.organization.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Platform Default</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block font-semibold">
                        {c.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`capitalize font-mono text-[10px] ${
                          c.state === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.state === 'provisioning_failed'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {c.state?.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {c.transitionsCount} steps
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                      {new Date(c.createdAt).toLocaleDateString()}
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
            itemLabel="cases"
          />
        </div>
      </Card>
    </div>
  );
}

export function SuperAdminOnboarding() {
  return (
    <SuperAdminShell
      title="Cross-Tenant Onboarding Monitor"
      subtitle="Universal onboarding case lifecycle tracking, transition audits, drop-off detection, and handover status"
    >
      <SuperAdminOnboardingContent />
    </SuperAdminShell>
  );
}

export default SuperAdminOnboarding;
