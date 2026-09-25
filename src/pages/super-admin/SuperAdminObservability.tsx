import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Server,
  FileText,
  Bot,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  Database,
  Cpu,
  Zap,
  TrendingUp
} from 'lucide-react';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useSuperAdminFilter } from '../../context/SuperAdminFilterContext';
import {
  useSuperAdminApiObservability,
  useSuperAdminInfrastructure,
  useSuperAdminAIObservability,
  useSuperAdminStorage,
  useSuperAdminActivityEvents
} from '../../hooks/useSuperAdmin';

type TabType = 'api' | 'logs' | 'infrastructure' | 'ai' | 'storage';

export function SuperAdminObservability() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    selectedOrgId,
    severity,
    refreshKey,
  } = useSuperAdminFilter();

  // Determine initial tab from pathname
  const getTabFromPath = (path: string): TabType => {
    if (path.includes('/logs')) return 'logs';
    if (path.includes('/infrastructure')) return 'infrastructure';
    if (path.includes('/ai')) return 'ai';
    if (path.includes('/storage')) return 'storage';
    return 'api';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getTabFromPath(location.pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`/super-admin/observability/${tab}`);
  };

  // Queries
  const { data: apiData, refetch: refetchApi } = useSuperAdminApiObservability();
  const { data: infraData } = useSuperAdminInfrastructure();
  const { data: aiData } = useSuperAdminAIObservability();
  const { data: storageData } = useSuperAdminStorage();
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useSuperAdminActivityEvents({
    organizationId: selectedOrgId !== 'all' ? selectedOrgId : undefined,
    category: 'system',
    severity: severity !== 'all' ? severity : undefined,
    limit: 30
  });

  // Refetch when universal filter refreshKey triggers
  useEffect(() => {
    if (refreshKey > 0) {
      refetchApi();
      refetchLogs();
    }
  }, [refreshKey, refetchApi, refetchLogs]);

  return (
    <SuperAdminShell
      title="Observability & Telemetry Suite"
      description="Real-time multi-dimensional cluster telemetry, API latencies, AI tokens, DB health, and storage quotas."
      showSeverity={true}
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-xl">
          <button
            onClick={() => handleTabChange('api')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'api'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            API Observability
          </button>
          <button
            onClick={() => handleTabChange('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            System Logs
          </button>
          <button
            onClick={() => handleTabChange('infrastructure')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'infrastructure'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Server className="w-4 h-4" />
            Infrastructure & DB
          </button>
          <button
            onClick={() => handleTabChange('ai')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ai'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Bot className="w-4 h-4" />
            AI Observability
          </button>
          <button
            onClick={() => handleTabChange('storage')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'storage'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            Storage & Media
          </button>
        </div>

        {/* TAB 1: API Observability */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">P50 Latency</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">
                      {apiData?.latency?.p50 || 0} <span className="text-xs text-slate-500 font-normal">ms</span>
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> High responsiveness
                </p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">P95 Latency</p>
                    <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                      {apiData?.latency?.p95 || 0} <span className="text-xs text-slate-500 font-normal">ms</span>
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">SLA threshold: &lt; 200ms</p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Throughput (RPM)</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">
                      {apiData?.throughput?.rpm || 0}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">Live requests per minute</p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Success Rate</p>
                    <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                      {apiData?.throughput?.successRate || 99.9}%
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Error rate: {apiData?.throughput?.errorRate || 0.1}%
                </p>
              </Card>
            </div>

            {/* Endpoints Table */}
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Critical API Routes & Latencies</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Automated 24h rolling traffic inspection</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchApi()}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Refresh
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Endpoint Route</th>
                      <th className="py-3 px-4">P95 Latency</th>
                      <th className="py-3 px-4">24h Call Volume</th>
                      <th className="py-3 px-4 text-right">Health Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {apiData?.endpoints?.map((ep: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs font-medium text-slate-900">
                          {ep.route}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-indigo-600 font-semibold">
                          {ep.p95} ms
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 font-mono">
                          {ep.count24h.toLocaleString()} calls
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {ep.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: System Logs */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">System Runtime & Internal Logs</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Capturing system, worker, and background service events</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchLogs()}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Refresh Logs
                </Button>
              </div>

              <div className="p-4 bg-slate-950 font-mono text-xs text-slate-300 space-y-2 max-h-[500px] overflow-y-auto">
                {logsLoading ? (
                  <div className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                    Streaming system logs...
                  </div>
                ) : logsData?.events?.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No system log events recorded in the current buffer.
                  </div>
                ) : (
                  logsData?.events?.map((log: any) => (
                    <div key={log.id} className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-start gap-3">
                      <span className="text-slate-400 whitespace-nowrap text-[11px]">
                        [{new Date(log.createdAt).toISOString()}]
                      </span>
                      <span className={`uppercase font-bold text-[10px] px-1.5 py-0.5 rounded ${
                        log.severity === 'critical'
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          : log.severity === 'high'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {log.severity}
                      </span>
                      <span className="text-indigo-400 font-semibold">{log.eventType || log.action}:</span>
                      <span className="text-slate-200 flex-1">{log.description}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: Infrastructure & DB */}
        {activeTab === 'infrastructure' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Node Process Metrics */}
              <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                  <Cpu className="w-5 h-5 text-indigo-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Node.js Runtime & Memory</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">Node Engine</span>
                    <p className="text-sm font-bold text-slate-900 mt-1">{infraData?.runtime?.nodeVersion || 'v20.x'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">Platform & Arch</span>
                    <p className="text-sm font-bold text-slate-900 mt-1">
                      {infraData?.runtime?.platform} / {infraData?.runtime?.arch}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">System Uptime</span>
                    <p className="text-sm font-bold text-slate-900 mt-1">{infraData?.runtime?.uptimeFormatted || '0h'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">Heap Total / Used</span>
                    <p className="text-sm font-bold text-indigo-600 mt-1">
                      {infraData?.memory?.heapUsedMB || 0} MB / {infraData?.memory?.heapTotalMB || 0} MB
                    </p>
                  </div>
                </div>
              </Card>

              {/* Database Cluster */}
              <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                  <Database className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-semibold text-slate-900">MongoDB Core Cluster</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">Database Name</span>
                    <p className="text-sm font-bold text-slate-900 mt-1">{infraData?.database?.name || 'talnova'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">Cluster Connection</span>
                    <p className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {infraData?.database?.state || 'CONNECTED'}
                    </p>
                  </div>
                </div>

                <p className="text-xs font-semibold text-slate-600 mb-2">Collection Densities</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {infraData?.database?.collections?.map((col: any) => (
                    <div key={col.name} className="p-2 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[11px] text-slate-500 truncate block font-mono">{col.name}</span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">{col.documents.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 4: AI Observability */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Foundation Model</p>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{aiData?.model || 'Gemini 1.5 Pro'}</h3>
                <p className="text-xs text-indigo-600 mt-2">Active multimodal engine</p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tokens Consumed</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  {(aiData?.tokensConsumed || 0).toLocaleString()}
                </h3>
                <p className="text-xs text-slate-500 mt-2">Of {(aiData?.monthlyBudget || 0).toLocaleString()} monthly limit</p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Budget Utilization</p>
                <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                  {aiData?.utilizationPct || 0}%
                </h3>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${Math.min(100, aiData?.utilizationPct || 0)}%` }}
                  />
                </div>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Est. AI Cost</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                  ${(aiData?.costEstimateUSD || 0).toFixed(2)}
                </h3>
                <p className="text-xs text-slate-500 mt-2">Deterministic token billing</p>
              </Card>
            </div>

            {/* Feature Usage Breakdown */}
            <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl">
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Gemini AI Usage By Platform Feature</h4>
              <div className="space-y-4">
                {aiData?.featureBreakdown?.map((fb: any) => (
                  <div key={fb.feature} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{fb.feature}</p>
                      <p className="text-xs text-slate-500">{fb.requests.toLocaleString()} automated prompts executed</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono font-bold text-indigo-600">{fb.tokens.toLocaleString()}</span>
                      <span className="text-xs text-slate-500 ml-1">tokens</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 5: Storage & Media */}
        {activeTab === 'storage' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cloud Storage Provider</p>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{storageData?.provider || 'Cloudflare R2 / S3'}</h3>
                <p className="text-xs text-emerald-600 mt-2 font-medium">Zero-egress object tier</p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Consumed Storage</p>
                <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                  {storageData?.totalMB || 0} <span className="text-xs text-slate-500 font-normal">MB ({storageData?.totalGB || 0} GB)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-2">Live aggregate across all organizations</p>
              </Card>

              <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Stored Media Objects</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  {(storageData?.totalFiles || 0).toLocaleString()}
                </h3>
                <p className="text-xs text-slate-500 mt-2">Active documents, videos & assets</p>
              </Card>
            </div>

            {/* Storage By Type */}
            <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl">
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Object Distribution By MIME / Purpose</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {storageData?.byType?.map((st: any) => (
                  <div key={st.type} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs font-mono uppercase text-indigo-700 font-semibold">{st.type}</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-xl font-bold text-slate-900">{st.sizeMB} MB</span>
                      <span className="text-xs text-slate-500 font-mono">{st.count} files</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
export default SuperAdminObservability;
