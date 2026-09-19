import { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  AlertCircle,
  Clock,
  ExternalLink,
  Search,
  CheckCircle2,
  RefreshCw,
  Building2,
  Lock,
  GraduationCap,
  CheckSquare
} from 'lucide-react';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { useSuperAdminAlerts } from '../../hooks/useSuperAdmin';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function SuperAdminAlerts() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useSuperAdminAlerts();

  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [acknowledgedIds, setAcknowledgedIds] = useState<Record<string, boolean>>({});

  const alerts = data?.alerts || [];
  const summary = data?.summary || { critical: 0, high: 0, warning: 0, total: 0 };

  const filteredAlerts = alerts.filter((alert: any) => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (categoryFilter !== 'all' && alert.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = alert.title?.toLowerCase().includes(q);
      const matchDesc = alert.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  const handleAcknowledge = (id: string) => {
    setAcknowledgedIds(prev => ({ ...prev, [id]: true }));
    toast.success('Alert marked as acknowledged for this session');
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'tenant':
        return <Building2 className="w-4 h-4 text-rose-600" />;
      case 'security':
        return <Lock className="w-4 h-4 text-red-600" />;
      case 'onboarding':
        return <GraduationCap className="w-4 h-4 text-amber-600" />;
      case 'operations':
        return <CheckSquare className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="uppercase font-mono text-[10px] tracking-wider bg-rose-50 text-rose-700 border border-rose-200">Critical</Badge>;
      case 'high':
        return <Badge className="uppercase font-mono text-[10px] tracking-wider bg-amber-50 text-amber-700 border border-amber-200">High</Badge>;
      case 'warning':
        return <Badge className="uppercase font-mono text-[10px] tracking-wider bg-yellow-50 text-yellow-700 border border-yellow-200">Warning</Badge>;
      default:
        return <Badge className="uppercase font-mono text-[10px] tracking-wider bg-slate-100 text-slate-700 border border-slate-200">Info</Badge>;
    }
  };

  const getDestinationUrl = (alert: any) => {
    switch (alert.category) {
      case 'tenant':
        return `/super-admin/organizations/${alert.sourceId}`;
      case 'security':
        return `/super-admin/audit`;
      case 'onboarding':
        return `/super-admin/onboarding`;
      case 'operations':
        return `/super-admin/tasks-ops`;
      default:
        return `/super-admin`;
    }
  };

  return (
    <SuperAdminShell
      title="Platform Incident & Alert Center"
      description="Live multi-tenant incident monitoring, SLA breach alerts, and security anomaly triage."
    >
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-white border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Active Alerts</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Aggregated across all platform vectors</p>
          </Card>

          <Card className="p-4 bg-white border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-rose-600 uppercase tracking-wider">Critical Severity</p>
                <h3 className="text-2xl font-bold text-rose-600 mt-1">{summary.critical}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Immediate platform intervention required</p>
          </Card>

          <Card className="p-4 bg-white border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">High Severity</p>
                <h3 className="text-2xl font-bold text-amber-600 mt-1">{summary.high}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Pipeline failures & degraded states</p>
          </Card>

          <Card className="p-4 bg-white border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">Warning & SLAs</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{summary.warning}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Overdue hardware & pending tasks</p>
          </Card>
        </div>

        {/* Filter Controls */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm rounded-xl">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search alerts by incident or title..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-500 px-2 font-medium">Severity:</span>
                {(['all', 'critical', 'high', 'warning'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverityFilter(s)}
                    className={`px-2.5 py-1 text-xs rounded-md capitalize font-medium transition-all ${
                      severityFilter === s
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-500 px-2 font-medium">Category:</span>
                {(['all', 'tenant', 'security', 'onboarding', 'operations'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`px-2.5 py-1 text-xs rounded-md capitalize font-medium transition-all ${
                      categoryFilter === c
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        {/* Alerts Stream */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading real-time platform alerts...
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-rose-700 bg-rose-50 rounded-xl border border-rose-200 shadow-sm">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-600" />
              Failed to load platform incident stream. Check permissions or backend connection.
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-16 text-center text-slate-600 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900">Zero Active Incidents</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-1">
                All platform services, tenants, onboarding pipelines, and operational tasks are running within nominal parameters.
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert: any) => {
              const isAcked = acknowledgedIds[alert.id];
              return (
                <Card
                  key={alert.id}
                  className={`p-4 transition-all duration-200 border rounded-xl shadow-sm ${
                    isAcked
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : alert.severity === 'critical'
                      ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                      : alert.severity === 'high'
                      ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 rounded-lg bg-slate-100 border border-slate-200">
                        {getCategoryIcon(alert.category)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-slate-900">{alert.title}</h4>
                          {getSeverityBadge(alert.severity)}
                          <span className="text-[10px] font-mono text-slate-600 uppercase px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            {alert.category}
                          </span>
                          {isAcked && (
                            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              Acknowledged
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{alert.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'N/A'}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-slate-400">ID: {alert.id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {!isAcked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                          className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                        >
                          Ack
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(getDestinationUrl(alert))}
                        className="text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
                      >
                        Investigate
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </SuperAdminShell>
  );
}
export default SuperAdminAlerts;
