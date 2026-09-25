import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Download,
  RefreshCw,
  Building2,
  User,
  FileCode,
  Lock,
  ChevronLeft,
  ChevronRight,
  Eye,
  X
} from 'lucide-react';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { useSuperAdminFilter } from '../../context/SuperAdminFilterContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { useSuperAdminActivityEvents } from '../../hooks/useSuperAdmin';
import { toast } from 'sonner';

export function SuperAdminAudit() {
  const { selectedOrgId, severity: contextSeverity, refreshKey } = useSuperAdminFilter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);

  // Sync with context severity if updated via FilterBar
  useEffect(() => {
    if (contextSeverity && contextSeverity !== severity) {
      setSeverity(contextSeverity);
    }
  }, [contextSeverity]);

  const effectiveSeverity = severity !== 'all' ? severity : (contextSeverity !== 'all' ? contextSeverity : undefined);

  const { data, isLoading, isError, refetch } = useSuperAdminActivityEvents({
    organizationId: selectedOrgId !== 'all' ? selectedOrgId : undefined,
    category: 'security',
    severity: effectiveSeverity,
    search: search || undefined,
    page,
    limit: 25,
  });

  // Refetch when universal filter refreshKey triggers
  useEffect(() => {
    if (refreshKey > 0) {
      refetch();
    }
  }, [refreshKey, refetch]);

  const events = data?.events || [];
  const summary = data?.summary || { total: 0, criticalCount: 0, highCount: 0, warningCount: 0, infoCount: 0 };
  const pagination = data?.pagination || { page: 1, limit: 25, totalPages: 1 };

  const handleExportCsv = () => {
    if (!events.length) {
      toast.error('No audit records to export');
      return;
    }
    const headers = ['Timestamp', 'Severity', 'Action', 'Organization', 'Actor', 'Description'];
    const rows = events.map((e: any) => [
      e.createdAt,
      e.severity,
      e.eventType || e.action,
      `"${e.organization?.name || 'Platform'}"`,
      `"${e.actor?.email || 'system'}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talnova-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('Compliance audit log exported as CSV');
  };

  return (
    <SuperAdminShell
      title="Audit & Security Governance"
      description="Zero-trust immutable compliance log, cryptographic integrity verification, and actor mutation stream."
      showSeverity={true}
    >
      <div className="space-y-6">
        {/* Compliance Posture Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Retention Policy</p>
                <h4 className="text-lg font-bold text-slate-900 mt-0.5">7-Year Immutable WORM</h4>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              Compliant with SOC 2 Type II, ISO 27001, and HIPAA append-only storage guarantees.
            </p>
          </Card>

          <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Actor Identity Verification</p>
                <h4 className="text-lg font-bold text-slate-900 mt-0.5">Dual-Factor Authenticated</h4>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              All super-admin mutations record IP, User-Agent, and root administrative token claims.
            </p>
          </Card>

          <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Security Events</p>
                <h4 className="text-lg font-bold text-slate-900 mt-0.5">{summary.total} Records</h4>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              {summary.criticalCount} critical security mutations logged across tenant boundaries.
            </p>
          </Card>
        </div>

        {/* Filter bar */}
        <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by action, email, tenant, or details..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-500 px-2 font-medium">Severity:</span>
                {(['all', 'critical', 'high', 'warning', 'info'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSeverity(s);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md capitalize font-medium transition-all ${
                      severity === s
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export CSV
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        {/* Audit Log Table */}
        <Card className="overflow-hidden bg-white border border-slate-200 shadow-sm rounded-xl">
          {isLoading ? (
            <div className="p-16 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading verified security audit records...
            </div>
          ) : isError ? (
            <div className="p-16 text-center text-rose-600">
              Failed to load security audit log.
            </div>
          ) : events.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-emerald-600" />
              <p className="font-semibold text-slate-800">No security audit events recorded</p>
              <p className="text-xs text-slate-500 mt-1">Platform security parameters are in normal state.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Severity</th>
                    <th className="py-3.5 px-4">Action / Event</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Target Tenant</th>
                    <th className="py-3.5 px-4">Operator / Actor</th>
                    <th className="py-3.5 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((ev: any) => (
                    <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-xs font-mono text-slate-500">
                        {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge
                          className={`uppercase font-mono text-[10px] ${
                            ev.severity === 'critical'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : ev.severity === 'high'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {ev.severity}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 font-mono text-xs whitespace-nowrap">
                        {ev.eventType || ev.action}
                      </td>
                      <td className="py-3 px-4 max-w-sm truncate text-xs text-slate-600" title={ev.description}>
                        {ev.description}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate max-w-[130px]">{ev.organization?.name || 'Global Platform'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate max-w-[130px]">{ev.actor?.name || 'System Operator'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAudit(ev)}
                          className="text-xs text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-1.5 rounded-lg"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <span className="text-xs text-slate-500">
                Page <span className="font-semibold text-slate-800">{pagination.page}</span> of{' '}
                <span className="font-semibold text-slate-800">{pagination.totalPages}</span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p: number) => p + 1)}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Audit Inspector Modal */}
        {selectedAudit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <Card className="w-full max-w-2xl bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 relative">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Cryptographic Audit Entry</h3>
                </div>
                <button
                  onClick={() => setSelectedAudit(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] font-mono font-semibold">Event Summary</span>
                  <p className="text-slate-800 text-sm mt-0.5">{selectedAudit.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-mono font-semibold">Event Type</span>
                    <p className="font-mono text-slate-800 mt-0.5">{selectedAudit.eventType || selectedAudit.action}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-mono font-semibold">Severity</span>
                    <p className="font-mono text-rose-600 font-semibold uppercase mt-0.5">{selectedAudit.severity}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-mono font-semibold">Target Resource</span>
                    <p className="font-mono text-slate-800 mt-0.5">{selectedAudit.resourceType}: {selectedAudit.resourceId}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-mono font-semibold">Timestamp</span>
                    <p className="font-mono text-slate-800 mt-0.5">{new Date(selectedAudit.createdAt).toISOString()}</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-60 overflow-y-auto">
                  <pre>{JSON.stringify(selectedAudit, null, 2)}</pre>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setSelectedAudit(null)}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  Close Record
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}

export default SuperAdminAudit;
