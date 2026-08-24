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
  List
} from 'lucide-react';
import {
  useIntegrations,
  useCreateIntegration,
  useSyncIntegration,
  useTestIntegration,
  useIntegrationLogs
} from '../hooks/useIntegrations';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

export function HRISIntegrations() {
  const { data: integrations, isLoading } = useIntegrations();
  const createMutation = useCreateIntegration();
  const syncMutation = useSyncIntegration();
  const testMutation = useTestIntegration();

  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const { data: syncLogs } = useIntegrationLogs(selectedIntegrationId || undefined);

  const integrationsPagination = usePagination({ data: integrations || [], initialPageSize: 6 });
  const logsPagination = usePagination({ data: syncLogs || [], initialPageSize: 5 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [provider, setProvider] = useState<'bamboohr' | 'workday' | 'rippling' | 'personio' | 'custom_webhook'>('bamboohr');
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [apiKey, setApiKey] = useState('');

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Please enter a name for the integration connector');
      return;
    }

    createMutation.mutate(
      {
        provider,
        name,
        subdomain,
        apiKey,
      },
      {
        onSuccess: (newInt) => {
          toast.success(`Connected ${newInt.name} successfully!`);
          setIsModalOpen(false);
          setName('');
          setSubdomain('');
          setApiKey('');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to connect integration');
        },
      }
    );
  };

  const handleTest = (id: string) => {
    testMutation.mutate(id, {
      onSuccess: (res) => {
        toast.success(`Connection verified! Response latency: ${res.latencyMs}ms`);
      },
      onError: () => {
        toast.error('Connection test failed');
      },
    });
  };

  const handleSync = (id: string) => {
    syncMutation.mutate(id, {
      onSuccess: (res) => {
        toast.success(
          `Sync complete! Created: ${res.syncLog.createdUsersCount}, Updated: ${res.syncLog.updatedUsersCount}`
        );
      },
      onError: () => {
        toast.error('Sync execution failed');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Workflow className="h-7 w-7 text-indigo-600" />
            HRIS & Enterprise Integrations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect external HRIS systems, synchronize employee lifecycle events, and monitor sync telemetry & Dead-Letter Queues.
          </p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add HRIS Connector
        </Button>
      </div>

      {/* Connectors Catalog / Active Integrations Grid */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrationsPagination.paginatedData.map((int) => (
            <Card key={int._id} className="border shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base font-semibold">{int.name}</CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      int.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-600 border-red-500/20'
                    }
                  >
                    {int.status.toUpperCase()}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Provider: <span className="font-semibold text-foreground">{int.provider.toUpperCase()}</span>
                  {int.subdomain && ` (${int.subdomain})`}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-xs text-muted-foreground pt-0">
                <div>
                  Conflict Policy:{' '}
                  <span className="font-semibold text-foreground">
                    {int.conflictPolicy === 'hris_wins' ? 'HRIS Wins (Overwrite Local)' : 'Local Overrides First'}
                  </span>
                </div>
                <div>
                  Last Synced:{' '}
                  <span className="font-semibold text-foreground">
                    {int.lastSyncedAt ? new Date(int.lastSyncedAt).toLocaleString() : 'Never Synced'}
                  </span>
                </div>

                <div className="pt-2 border-t flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => handleTest(int._id)}
                    disabled={testMutation.isPending}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1 text-amber-500" /> Test API
                  </Button>
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                    onClick={() => handleSync(int._id)}
                    disabled={syncMutation.isPending}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync Now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => setSelectedIntegrationId(int._id)}
                  >
                    <List className="h-3.5 w-3.5 mr-1" /> View Logs
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <SimplePagination
          currentPage={integrationsPagination.page}
          totalPages={integrationsPagination.totalPages}
          totalItems={integrationsPagination.totalItems}
          startIndex={integrationsPagination.startIndex}
          endIndex={integrationsPagination.endIndex}
          pageSize={integrationsPagination.pageSize}
          onPageChange={integrationsPagination.setPage}
          onPageSizeChange={integrationsPagination.setPageSize}
          itemLabel="integrations"
        />
      </div>

      {/* Sync Health & Telemetry Logs */}
      {selectedIntegrationId && (
        <Card className="border shadow-sm">
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
            {(syncLogs || []).length === 0 ? (
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

      {/* Add Integration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-background border rounded-lg p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-foreground">Add HRIS Connector</h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">HRIS Provider</label>
                <select
                  className="w-full p-2 border rounded-md bg-background focus:outline-none"
                  value={provider}
                  onChange={(e: any) => setProvider(e.target.value)}
                >
                  <option value="bamboohr">BambooHR</option>
                  <option value="workday">Workday</option>
                  <option value="rippling">Rippling</option>
                  <option value="personio">Personio</option>
                  <option value="custom_webhook">Custom Inbound Webhook</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Connector Name</label>
                <Input placeholder="e.g. BambooHR Production Sync" value={name} onChange={(e: any) => setName(e.target.value)} />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Subdomain / Domain</label>
                <Input placeholder="acme" value={subdomain} onChange={(e: any) => setSubdomain(e.target.value)} />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">API Key / Secret Token</label>
                <Input type="password" placeholder="••••••••••••••••" value={apiKey} onChange={(e: any) => setApiKey(e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleCreate} disabled={createMutation.isPending}>
                Save & Connect
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HRISIntegrations;
