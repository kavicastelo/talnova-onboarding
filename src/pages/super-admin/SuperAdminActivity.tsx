import { useState } from 'react';
import {
  Clock,
  Search,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  Info,
  Building2,
  User,
  Download,
  Terminal,
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

export function SuperAdminActivity() {
  const { selectedOrgId } = useSuperAdminFilter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const { data, isLoading, isError, refetch } = useSuperAdminActivityEvents({
    organizationId: selectedOrgId || undefined,
    category: category !== 'all' ? category : undefined,
    severity: severity !== 'all' ? severity : undefined,
    search: search || undefined,
    page,
    limit: 20,
  });

  const events = data?.events || [];
  const summary = data?.summary || { total: 0, criticalCount: 0, highCount: 0, warningCount: 0, infoCount: 0 };
  const pagination = data?.pagination || { page: 1, limit: 20, totalPages: 1 };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <Badge className="bg-rose-50 text-rose-700 border border-rose-200 uppercase font-mono text-[10px]">Critical</Badge>;
      case 'high':
        return <Badge className="bg-amber-50 text-amber-700 border border-amber-200 uppercase font-mono text-[10px]">High</Badge>;
      case 'warning':
        return <Badge className="bg-amber-50 text-amber-700 border border-amber-200 uppercase font-mono text-[10px]">Warning</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border border-slate-200 uppercase font-mono text-[10px]">Info</Badge>;
    }
  };

  const handleExportJson = () => {
    if (!events.length) {
      toast.error('No events to export');
      return;
    }
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talnova-activity-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast.success('Activity stream exported as JSON');
  };

  return (
    <SuperAdminShell
      title="Activity & Event Stream"
      description="Immutable multi-tenant audit events, platform mutations, and system telemetry records."
    >
      <div className="space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filtered Records</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Active query window</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Critical Events</p>
                <h3 className="text-2xl font-bold text-rose-600 mt-1">{summary.criticalCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Immediate security triggers</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">High / Warning</p>
                <h3 className="text-2xl font-bold text-amber-600 mt-1">{summary.highCount + summary.warningCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Degradations & SLA misses</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Operational / Info</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{summary.infoCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Info className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Standard platform transactions</p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by action, actor, resource, description..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-500 px-2 font-medium">Category:</span>
                {(['all', 'security', 'tenant', 'onboarding', 'finance', 'system'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCategory(c);
                      setPage(1);
                    }}
                    className={`px-2 py-1 text-xs rounded-md capitalize font-medium transition-all ${
                      category === c
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-500 px-2 font-medium">Severity:</span>
                {(['all', 'critical', 'high', 'warning', 'info'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSeverity(s);
                      setPage(1);
                    }}
                    className={`px-2 py-1 text-xs rounded-md capitalize font-medium transition-all ${
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
                onClick={handleExportJson}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export
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

        {/* Event Table */}
        <Card className="overflow-hidden bg-white border border-slate-200 shadow-sm rounded-xl">
          {isLoading ? (
            <div className="p-16 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading real audit activity records...
            </div>
          ) : isError ? (
            <div className="p-16 text-center text-rose-600">
              Failed to load activity stream. Please check network and permissions.
            </div>
          ) : events.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <Clock className="w-10 h-10 mx-auto mb-3 text-slate-400" />
              <p className="font-semibold text-slate-800">No activity events found</p>
              <p className="text-xs text-slate-500 mt-1">Try broadening your search query or severity filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Severity</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Action / Event</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Organization</th>
                    <th className="py-3.5 px-4">Actor</th>
                    <th className="py-3.5 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((ev: any) => (
                    <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-xs font-mono text-slate-500">
                        {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getSeverityBadge(ev.severity)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-[11px] font-mono uppercase bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                          {ev.category || 'general'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 font-mono text-xs whitespace-nowrap">
                        {ev.eventType || ev.action}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-xs text-slate-600" title={ev.description}>
                        {ev.description}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate max-w-[120px]">{ev.organization?.name || 'Platform Root'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate max-w-[120px]">{ev.actor?.name || 'System'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEvent(ev)}
                          className="text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-100 p-1.5"
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

          {/* Pagination */}
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
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Event Detail Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <Card className="w-full max-w-2xl bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 relative">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Event Inspector</h3>
                  {getSeverityBadge(selectedEvent.severity)}
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] font-mono font-semibold">Description</span>
                  <p className="text-slate-800 text-sm mt-0.5">{selectedEvent.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-mono font-semibold">Action / Event Type</span>
                    <p className="font-mono text-slate-800 mt-0.5">{selectedEvent.eventType || selectedEvent.action}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-mono font-semibold">Category</span>
                    <p className="font-mono text-slate-800 mt-0.5">{selectedEvent.category || 'general'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-mono font-semibold">Resource Type & ID</span>
                    <p className="font-mono text-slate-800 mt-0.5">{selectedEvent.resourceType || 'N/A'}: {selectedEvent.resourceId || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-mono font-semibold">Timestamp</span>
                    <p className="font-mono text-slate-800 mt-0.5">{selectedEvent.createdAt ? new Date(selectedEvent.createdAt).toISOString() : 'N/A'}</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-60 overflow-y-auto">
                  <pre>{JSON.stringify(selectedEvent, null, 2)}</pre>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setSelectedEvent(null)}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  Close Inspector
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
export default SuperAdminActivity;
