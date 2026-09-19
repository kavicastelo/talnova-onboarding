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
  CheckSquare,
  Check,
  X,
  RotateCcw
} from 'lucide-react';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { useSuperAdminAlerts, useUpdateAlertStatus } from '../../hooks/useSuperAdmin';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function SuperAdminAlerts() {
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Resolution modal state
  const [resolvingAlert, setResolvingAlert] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  const { data, isLoading, isError, refetch } = useSuperAdminAlerts({
    status: statusFilter === 'all' ? undefined : statusFilter,
    severity: severityFilter === 'all' ? undefined : severityFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    search: searchQuery || undefined,
  });

  const updateAlertStatusMutation = useUpdateAlertStatus();

  const alerts = data?.alerts || [];
  const summary = data?.summary || {
    critical: 0,
    high: 0,
    warning: 0,
    open: 0,
    acknowledged: 0,
    investigating: 0,
    resolved: 0,
    total: 0,
  };

  const handleAcknowledge = (alertId: string) => {
    updateAlertStatusMutation.mutate(
      { id: alertId, status: 'acknowledged' },
      {
        onSuccess: () => {
          toast.success('Alert marked as acknowledged');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || 'Failed to acknowledge alert');
        },
      }
    );
  };

  const handleInvestigate = (alert: any) => {
    if (alert.status === 'open') {
      updateAlertStatusMutation.mutate(
        { id: alert.id, status: 'investigating' },
        {
          onSuccess: () => {
            navigate(getDestinationUrl(alert));
          },
          onError: () => {
            navigate(getDestinationUrl(alert));
          },
        }
      );
    } else {
      navigate(getDestinationUrl(alert));
    }
  };

  const handleOpenResolveModal = (alert: any) => {
    setResolvingAlert(alert);
    setResolutionNotes('');
  };

  const handleConfirmResolve = () => {
    if (!resolvingAlert) return;
    updateAlertStatusMutation.mutate(
      {
        id: resolvingAlert.id,
        status: 'resolved',
        resolutionNotes: resolutionNotes.trim() || 'Resolved by Super Admin operator',
      },
      {
        onSuccess: () => {
          toast.success(`Alert ${resolvingAlert.alertNo || resolvingAlert.id} resolved successfully`);
          setResolvingAlert(null);
          setResolutionNotes('');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || 'Failed to resolve alert');
        },
      }
    );
  };

  const handleReopen = (alertId: string) => {
    updateAlertStatusMutation.mutate(
      { id: alertId, status: 'open' },
      {
        onSuccess: () => {
          toast.success('Alert reopened');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || 'Failed to reopen alert');
        },
      }
    );
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="uppercase font-mono text-[10px] tracking-wider bg-amber-50 text-amber-800 border border-amber-300">Open</Badge>;
      case 'acknowledged':
        return <Badge className="uppercase font-mono text-[10px] tracking-wider bg-blue-50 text-blue-700 border border-blue-200">Acknowledged</Badge>;
      case 'investigating':
        return <Badge className="uppercase font-mono text-[10px] tracking-wider bg-purple-50 text-purple-700 border border-purple-200">Investigating</Badge>;
      case 'resolved':
        return <Badge className="uppercase font-mono text-[10px] tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">Resolved</Badge>;
      case 'ignored':
        return <Badge className="uppercase font-mono text-[10px] tracking-wider bg-slate-100 text-slate-600 border border-slate-200">Ignored</Badge>;
      default:
        return null;
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
      description="Live multi-tenant incident monitoring, SLA breach alerts, and persistent incident triage lifecycle."
    >
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-white border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Incidents</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {summary.open} open • {summary.acknowledged} acked • {summary.investigating} triage
            </p>
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
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">Resolved Incidents</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">{summary.resolved}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Archived post-resolution</p>
          </Card>
        </div>

        {/* Filter Controls & Status Tabs */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm rounded-xl space-y-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 pb-3 overflow-x-auto">
            {[
              { id: 'active', label: 'Active Incidents', count: summary.total },
              { id: 'open', label: 'Open', count: summary.open },
              { id: 'acknowledged', label: 'Acknowledged', count: summary.acknowledged },
              { id: 'investigating', label: 'Investigating', count: summary.investigating },
              { id: 'resolved', label: 'Resolved Archive', count: summary.resolved },
              { id: 'all', label: 'All Records', count: summary.total + summary.resolved },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  statusFilter === tab.id ? 'bg-indigo-200/70 text-indigo-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search alerts by ID, title or notes..."
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
              Loading real-time platform incidents...
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-rose-700 bg-rose-50 rounded-xl border border-rose-200 shadow-sm">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-600" />
              Failed to load platform incident stream. Check permissions or backend connection.
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-16 text-center text-slate-600 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900">Zero Active Incidents</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-1">
                All platform services, tenants, onboarding pipelines, and operational tasks are running within nominal parameters.
              </p>
            </div>
          ) : (
            alerts.map((alert: any) => {
              const isResolved = alert.status === 'resolved';
              const isAcked = alert.status === 'acknowledged';
              const isInvestigating = alert.status === 'investigating';

              return (
                <Card
                  key={alert.id}
                  className={`p-4 transition-all duration-200 border rounded-xl shadow-sm ${
                    isResolved
                      ? 'bg-slate-50/70 border-slate-200 opacity-75'
                      : isAcked
                      ? 'bg-blue-50/20 border-blue-200'
                      : isInvestigating
                      ? 'bg-purple-50/20 border-purple-200'
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
                          {getStatusBadge(alert.status)}
                          <span className="text-[10px] font-mono text-slate-600 uppercase px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            {alert.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{alert.description}</p>

                        {/* Resolution Notes preview if resolved */}
                        {isResolved && alert.resolutionNotes && (
                          <div className="mt-2 p-2 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-1.5">
                            <Check className="w-3.5 h-3.5 mt-0.5 text-emerald-600 flex-shrink-0" />
                            <span>
                              <strong>Resolution:</strong> {alert.resolutionNotes}
                              {alert.resolvedBy?.name ? ` (by ${alert.resolvedBy.name})` : ''}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'N/A'}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-slate-600 font-semibold">{alert.alertNo || `ALT-${alert.id.substring(0, 8)}`}</span>
                          {alert.acknowledgedBy?.name && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600">Ack by {alert.acknowledgedBy.name}</span>
                            </>
                          )}
                          {alert.organization?.name && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600 font-medium">{alert.organization.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {!isResolved ? (
                        <>
                          {alert.status === 'open' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={updateAlertStatusMutation.isPending}
                              onClick={() => handleAcknowledge(alert.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              Ack
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInvestigate(alert)}
                            className="text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
                          >
                            Investigate
                            <ExternalLink className="w-3 h-3" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenResolveModal(alert)}
                            className="text-xs border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-3 h-3" />
                            Resolve
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updateAlertStatusMutation.isPending}
                          onClick={() => handleReopen(alert.id)}
                          className="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Incident Resolution Modal */}
        {resolvingAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <Card className="w-full max-w-lg bg-white border-slate-200 shadow-xl rounded-2xl overflow-hidden animate-scale-up">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Resolve Platform Incident</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {resolvingAlert.alertNo || resolvingAlert.id} • {resolvingAlert.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setResolvingAlert(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Resolution Notes & Root Cause Remediation
                  </label>
                  <textarea
                    rows={4}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Document root cause, remediation steps taken, or mitigation verified..."
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Recorded to the authoritative audit log with your operator timestamp.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResolvingAlert(null)}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={updateAlertStatusMutation.isPending}
                  onClick={handleConfirmResolve}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  {updateAlertStatusMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  )}
                  Confirm Resolution
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
export default SuperAdminAlerts;
