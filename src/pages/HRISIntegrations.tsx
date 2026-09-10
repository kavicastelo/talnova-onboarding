import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import {
  Workflow,
  Plus,
  RefreshCw,
  Zap,
  Activity,
  List,
  CheckCircle2,
  AlertCircle,
  Building2,
  ExternalLink,
  PowerOff
} from 'lucide-react';
import {
  useIntegrations,
  useCreateIntegration,
  useSyncIntegration,
  useTestIntegration,
  useIntegrationLogs,
  useConnectProvider,
  useSyncProvider,
  useDisconnectProvider
} from '../hooks/useIntegrations';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

interface MarketplaceConnector {
  id: string;
  name: string;
  provider: 'bamboohr' | 'workday' | 'rippling' | 'personio' | 'custom_webhook';
  category: string;
  description: string;
  badge: string;
  logoBg: string;
}

const MARKETPLACE_CONNECTORS: MarketplaceConnector[] = [
  {
    id: 'bamboohr',
    name: 'BambooHR',
    provider: 'bamboohr',
    category: 'HRIS & People Data',
    description: 'Bi-directional employee synchronization, title mapping, department taxonomy, and automated onboarding triggering.',
    badge: 'Popular',
    logoBg: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    id: 'workday',
    name: 'Workday',
    provider: 'workday',
    category: 'Enterprise HCM',
    description: 'Enterprise HCM workforce ingestion, organization hierarchies, and role-based provisioning via REST/SOAP APIs.',
    badge: 'Enterprise',
    logoBg: 'bg-blue-500/10 text-blue-600',
  },
  {
    id: 'rippling',
    name: 'Rippling',
    provider: 'rippling',
    category: 'HR & IT Provisioning',
    description: 'Unified employee record syncing, department assignment, and instant role mapping for hardware & software onboarding.',
    badge: 'Fast Setup',
    logoBg: 'bg-amber-500/10 text-amber-600',
  },
  {
    id: 'personio',
    name: 'Personio',
    provider: 'personio',
    category: 'European All-in-One HR',
    description: 'Seamless European employee onboarding, department sync, and automated absence & employment updates.',
    badge: 'Standard',
    logoBg: 'bg-purple-500/10 text-purple-600',
  },
];

export function HRISIntegrations() {
  const { data: integrations = [], isLoading } = useIntegrations();
  const connectProviderMut = useConnectProvider();
  const syncProviderMut = useSyncProvider();
  const disconnectProviderMut = useDisconnectProvider();
  const testMutation = useTestIntegration();
  const syncMutation = useSyncIntegration();

  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const { data: syncLogs = [] } = useIntegrationLogs(selectedIntegrationId || undefined);

  // Modal State
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<'bamboohr' | 'workday' | 'rippling' | 'personio' | 'custom_webhook'>('bamboohr');
  const [subdomain, setSubdomain] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');

  const logsPagination = usePagination({ data: syncLogs, initialPageSize: 5 });

  // Find BambooHR active integration if exists
  const bamboohrIntegration = integrations.find((i) => i.provider === 'bamboohr' && i.status === 'active');

  const handleOpenConnect = (provider: 'bamboohr' | 'workday' | 'rippling' | 'personio' | 'custom_webhook') => {
    setActiveProvider(provider);
    setSubdomain(provider === 'bamboohr' ? 'acmetest' : '');
    setApiKey('');
    setApiKeyError('');
    setIsConnectModalOpen(true);
  };

  const handleSaveAndConnect = () => {
    if (!apiKey.trim()) {
      setApiKeyError(`API Key is required to connect to ${activeProvider === 'bamboohr' ? 'BambooHR' : activeProvider}`);
      toast.error('API Key is required to connect');
      return;
    }

    setApiKeyError('');

    connectProviderMut.mutate(
      {
        provider: activeProvider,
        data: {
          subdomain: subdomain.trim(),
          apiKey: apiKey.trim(),
          name: `${activeProvider.charAt(0).toUpperCase() + activeProvider.slice(1)} Production Sync`,
        },
      },
      {
        onSuccess: (data) => {
          toast.success(`Connected ${data.name || 'BambooHR'} successfully!`);
          setIsConnectModalOpen(false);
          setApiKey('');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to connect integration');
        },
      }
    );
  };

  const handleSyncProvider = (providerName: string) => {
    syncProviderMut.mutate(providerName, {
      onSuccess: (res: any) => {
        const syncId = res.syncId || res.data?.syncId || 'sync_' + Date.now();
        toast.success(`Workforce sync queued successfully! (ID: ${syncId})`);
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || err?.message || 'Failed to trigger sync');
      },
    });
  };

  const handleDisconnect = (providerName: string) => {
    disconnectProviderMut.mutate(providerName, {
      onSuccess: () => {
        toast.success(`Disconnected ${providerName} successfully.`);
      },
      onError: () => {
        toast.error('Failed to disconnect');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Workflow className="h-7 w-7 text-indigo-600" />
            HRIS & Workforce Integrations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect external HRIS systems, synchronize employee lifecycle events, and monitor sync telemetry & Dead-Letter Queues.
          </p>
        </div>
      </div>

      {/* Marketplace Connectors Catalog */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Marketplace Connectors</h2>
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
            {integrations.filter((i) => i.status === 'active').length} Connected
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {MARKETPLACE_CONNECTORS.map((connector) => {
            const activeInt = integrations.find((i) => i.provider === connector.provider && i.status === 'active');
            const isConnected = !!activeInt;

            return (
              <Card
                key={connector.id}
                data-testid={`${connector.id}-card`}
                className="border shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg ${connector.logoBg} font-bold`}>
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">{connector.name}</CardTitle>
                        <span className="text-xs text-muted-foreground">{connector.category}</span>
                      </div>
                    </div>
                    <Badge
                      data-testid={`${connector.id}-status-badge`}
                      variant="outline"
                      className={
                        isConnected
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold text-xs px-2.5 py-0.5'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-300 font-medium text-xs px-2 py-0.5'
                      }
                    >
                      {isConnected ? 'Connected' : 'Available'}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-3 leading-relaxed">
                    {connector.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 text-xs text-muted-foreground pt-0 border-t mt-3 pt-3">
                  {isConnected ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Tenant Subdomain:</span>
                        <span className="font-semibold text-foreground">
                          {activeInt.subdomain ? `${activeInt.subdomain}.${connector.provider}.com` : 'Default'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Last Synchronized:</span>
                        <span data-testid={`${connector.id}-last-synced`} className="font-semibold text-foreground">
                          {activeInt.lastSyncedAt ? new Date(activeInt.lastSyncedAt).toLocaleString() : 'Just now'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <Button
                          size="sm"
                          data-testid={`${connector.id}-sync-btn`}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium"
                          onClick={() => handleSyncProvider(connector.provider)}
                          disabled={syncProviderMut.isPending}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncProviderMut.isPending ? 'animate-spin' : ''}`} />
                          Sync Now
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`${connector.id}-test-btn`}
                          className="text-xs"
                          onClick={() => activeInt && testMutation.mutate(activeInt._id, {
                            onSuccess: (res) => toast.success(`Connection verified! Response latency: ${res.latencyMs}ms`),
                            onError: () => toast.error('Connection test failed')
                          })}
                          disabled={testMutation.isPending}
                        >
                          <Zap className="h-3.5 w-3.5 mr-1 text-amber-500" /> Test API
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`${connector.id}-logs-btn`}
                          className="text-xs"
                          onClick={() => setSelectedIntegrationId(activeInt._id)}
                        >
                          <List className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Logs
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`${connector.id}-disconnect-btn`}
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                          onClick={() => handleDisconnect(connector.provider)}
                          disabled={disconnectProviderMut.isPending}
                        >
                          <PowerOff className="h-3.5 w-3.5 mr-1" /> Disconnect
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-muted-foreground">Ready for setup</span>
                      <Button
                        size="sm"
                        data-testid={`${connector.id}-connect-btn`}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs"
                        onClick={() => handleOpenConnect(connector.provider)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Connect
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Sync Health & Telemetry Logs */}
      {selectedIntegrationId && (
        <Card className="border shadow-sm animate-in fade-in duration-200">
          <CardHeader className="flex justify-between items-center border-b pb-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-600" />
                Sync Telemetry & Dead-Letter Queue (DLQ) Logs
              </CardTitle>
              <CardDescription>Review execution logs, created/updated employee counts, and failed DLQ events.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIntegrationId(null)}>
              Close
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {syncLogs.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">No sync history logs recorded yet.</div>
            ) : (
              <div className="space-y-3">
                {logsPagination.paginatedData.map((log) => (
                  <div key={log._id} className="p-3 bg-muted/10 border rounded-lg text-xs space-y-2">
                    <div className="flex justify-between items-center font-semibold">
                      <span className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            log.status === 'success'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }
                        >
                          {log.status.toUpperCase()}
                        </Badge>
                        Processed {log.processedCount} records ({log.createdUsersCount} created, {log.updatedUsersCount} updated)
                      </span>
                      <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>

                    {log.errorCount > 0 && (
                      <div className="pt-2 text-red-600 font-medium border-t mt-1">
                        ⚠️ Encountered {log.errorCount} error(s) logged to DLQ queue.
                      </div>
                    )}
                  </div>
                ))}

                <SimplePagination
                  currentPage={logsPagination.page}
                  totalPages={logsPagination.totalPages}
                  totalItems={logsPagination.totalItems}
                  startIndex={logsPagination.startIndex}
                  endIndex={logsPagination.endIndex}
                  pageSize={logsPagination.pageSize}
                  onPageChange={logsPagination.setPage}
                  onPageSizeChange={logsPagination.setPageSize}
                  itemLabel="logs"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Connect Integration Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-background border rounded-lg p-6 space-y-5 shadow-xl animate-in zoom-in-95 duration-150">
            <div>
              <h2 data-testid="connect-modal-title" className="text-lg font-bold text-foreground">
                Connect {activeProvider === 'bamboohr' ? 'BambooHR' : activeProvider.toUpperCase()}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Configure your API credentials to enable automated employee ingestion and workforce sync.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Company Subdomain</label>
                <div className="flex items-center">
                  <Input
                    data-testid="bamboohr-subdomain-input"
                    placeholder="acmetest"
                    value={subdomain}
                    onChange={(e: any) => setSubdomain(e.target.value)}
                    className="rounded-r-none"
                  />
                  <span className="bg-muted px-3 py-2 border border-l-0 rounded-r-md text-muted-foreground text-xs font-mono">
                    .{activeProvider}.com
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">
                  API Key / Secret Token <span className="text-red-500">*</span>
                </label>
                <Input
                  data-testid="bamboohr-apikey-input"
                  type="password"
                  placeholder="test_api_key_123"
                  value={apiKey}
                  onChange={(e: any) => {
                    setApiKey(e.target.value);
                    if (e.target.value.trim()) setApiKeyError('');
                  }}
                  className={apiKeyError ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20' : ''}
                />
                {apiKeyError && (
                  <div data-testid="bamboohr-apikey-error" className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5 font-medium">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{apiKeyError}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setIsConnectModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                data-testid="bamboohr-save-connect-btn"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                onClick={handleSaveAndConnect}
                disabled={connectProviderMut.isPending}
              >
                {connectProviderMut.isPending ? 'Connecting...' : 'Save & Test Connection'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HRISIntegrations;
