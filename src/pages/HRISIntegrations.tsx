import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '../components/Dialog';
import {
  Workflow,
  Plus,
  RefreshCw,
  Zap,
  Activity,
  List,
  AlertCircle,
  Building2,
  PowerOff,
  Copy,
  Check,
  Eye,
  EyeOff,
  Key,
  Settings2,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import {
  useIntegrations,
  useTestIntegration,
  useIntegrationLogs,
  useConnectProvider,
  useSyncProvider,
  useDisconnectProvider,
  useRotateWebhookSecret,
  useRetryDLQEvent,
} from '../hooks/useIntegrations';
import { HRISIntegrationData, FieldMapping } from '../services/integration.service';
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
    description:
      'Bi-directional employee synchronization, title mapping, department taxonomy, and automated onboarding triggering.',
    badge: 'Popular',
    logoBg: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    id: 'workday',
    name: 'Workday',
    provider: 'workday',
    category: 'Enterprise HCM',
    description:
      'Enterprise HCM workforce ingestion, organization hierarchies, and role-based provisioning via REST/SOAP APIs.',
    badge: 'Enterprise',
    logoBg: 'bg-blue-500/10 text-blue-600',
  },
  {
    id: 'rippling',
    name: 'Rippling',
    provider: 'rippling',
    category: 'HR & IT Provisioning',
    description:
      'Unified employee record syncing, department assignment, and instant role mapping for hardware & software onboarding.',
    badge: 'Fast Setup',
    logoBg: 'bg-amber-500/10 text-amber-600',
  },
  {
    id: 'personio',
    name: 'Personio',
    provider: 'personio',
    category: 'European All-in-One HR',
    description:
      'Seamless European employee onboarding, department sync, and automated absence & employment updates.',
    badge: 'Standard',
    logoBg: 'bg-purple-500/10 text-purple-600',
  },
];

const DEFAULT_FIELD_MAPPINGS: FieldMapping[] = [
  { externalField: 'work_email', internalField: 'email' },
  { externalField: 'first_name', internalField: 'firstName' },
  { externalField: 'last_name', internalField: 'lastName' },
  { externalField: 'department', internalField: 'department' },
  { externalField: 'job_title', internalField: 'jobTitle' },
];

export function HRISIntegrations() {
  const { t } = useTranslation('integrations');
  const { data: integrations = [], isLoading } = useIntegrations();
  const connectProviderMut = useConnectProvider();
  const syncProviderMut = useSyncProvider();
  const disconnectProviderMut = useDisconnectProvider();
  const testMutation = useTestIntegration();
  const rotateSecretMut = useRotateWebhookSecret();
  const retryDLQMut = useRetryDLQEvent();

  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const { data: syncLogs = [] } = useIntegrationLogs(selectedIntegrationId || undefined);

  // Configuration Modal State
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<
    'bamboohr' | 'workday' | 'rippling' | 'personio' | 'custom_webhook'
  >('bamboohr');
  const [subdomain, setSubdomain] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [configTab, setConfigTab] = useState<'credentials' | 'mappings' | 'rules'>('credentials');
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(DEFAULT_FIELD_MAPPINGS);
  const [conflictPolicy, setConflictPolicy] = useState<'hris_wins' | 'local_wins'>('hris_wins');
  const [autoProvisionJourneys, setAutoProvisionJourneys] = useState(true);

  // Webhook Configuration Modal State
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookIntegration, setWebhookIntegration] = useState<HRISIntegrationData | null>(null);
  const [isSecretRevealed, setIsSecretRevealed] = useState(false);
  const [hasCopiedUrl, setHasCopiedUrl] = useState(false);
  const [hasCopiedSecret, setHasCopiedSecret] = useState(false);

  const logsPagination = usePagination({ data: syncLogs, initialPageSize: 5 });

  const handleOpenConnect = (
    provider: 'bamboohr' | 'workday' | 'rippling' | 'personio' | 'custom_webhook',
    existingIntegration?: HRISIntegrationData
  ) => {
    setActiveProvider(provider);
    setConfigTab('credentials');
    if (existingIntegration) {
      setSubdomain(existingIntegration.subdomain || '');
      setApiKey(existingIntegration.apiKey || '');
      setFieldMappings(
        existingIntegration.fieldMappings?.length
          ? existingIntegration.fieldMappings
          : DEFAULT_FIELD_MAPPINGS
      );
      setConflictPolicy(existingIntegration.conflictPolicy || 'hris_wins');
      setAutoProvisionJourneys(
        existingIntegration.autoProvisionJourneys !== undefined
          ? existingIntegration.autoProvisionJourneys
          : true
      );
    } else {
      setSubdomain(provider === 'bamboohr' ? 'acmetest' : '');
      setApiKey('');
      setFieldMappings(DEFAULT_FIELD_MAPPINGS);
      setConflictPolicy('hris_wins');
      setAutoProvisionJourneys(true);
    }
    setApiKeyError('');
    setIsConnectModalOpen(true);
  };

  const handleOpenWebhookModal = (integration: HRISIntegrationData) => {
    setWebhookIntegration(integration);
    setIsSecretRevealed(false);
    setHasCopiedUrl(false);
    setHasCopiedSecret(false);
    setIsWebhookModalOpen(true);
  };

  const handleSaveAndConnect = () => {
    const providerDisplayName = activeProvider === 'bamboohr' ? 'BambooHR' : activeProvider;
    if (!apiKey.trim()) {
      setApiKeyError(
        t('hris.connectModal.apiKeyRequired', { provider: providerDisplayName })
      );
      toast.error(t('hris.toasts.apiKeyRequired'));
      return;
    }

    setApiKeyError('');

    connectProviderMut.mutate(
      {
        provider: activeProvider,
        data: {
          subdomain: subdomain.trim(),
          apiKey: apiKey.trim(),
          name: t('hris.toasts.productionSyncName', {
            provider: activeProvider.charAt(0).toUpperCase() + activeProvider.slice(1),
          }),
          fieldMappings,
          conflictPolicy,
          autoProvisionJourneys,
        },
      },
      {
        onSuccess: (data) => {
          toast.success(
            t('hris.toasts.connectedSuccess', { name: data.name || 'BambooHR' })
          );
          setIsConnectModalOpen(false);
          setApiKey('');
        },
        onError: (err: any) => {
          toast.error(
            err?.response?.data?.message || err?.message || t('hris.toasts.connectFailed')
          );
        },
      }
    );
  };

  const handleSyncProvider = (providerName: string) => {
    syncProviderMut.mutate(providerName, {
      onSuccess: (res: any) => {
        const syncId = res.syncId || res.data?.syncId || 'sync_' + Date.now();
        toast.success(t('hris.toasts.syncQueued', { syncId }));
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || err?.message || t('hris.toasts.syncFailed'));
      },
    });
  };

  const handleDisconnect = (providerName: string) => {
    disconnectProviderMut.mutate(providerName, {
      onSuccess: () => {
        toast.success(t('hris.toasts.disconnectedSuccess', { provider: providerName }));
      },
      onError: () => {
        toast.error(t('hris.toasts.disconnectFailed'));
      },
    });
  };

  const handleRotateSecret = (integrationId: string) => {
    rotateSecretMut.mutate(integrationId, {
      onSuccess: (data) => {
        toast.success(t('hris.toasts.secretRotated'));
        if (webhookIntegration) {
          setWebhookIntegration({
            ...webhookIntegration,
            webhookSecret: data.webhookSecret,
          });
        }
      },
      onError: () => {
        toast.error(t('hris.toasts.secretRotateFailed'));
      },
    });
  };

  const handleRetryDLQ = (integrationId: string, eventId: string) => {
    retryDLQMut.mutate(
      { id: integrationId, eventId },
      {
        onSuccess: () => {
          toast.success(t('hris.toasts.retrySuccess'));
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || t('hris.toasts.retryFailed'));
        },
      }
    );
  };

  const copyToClipboard = (text: string, type: 'url' | 'secret') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setHasCopiedUrl(true);
      setTimeout(() => setHasCopiedUrl(false), 2000);
    } else {
      setHasCopiedSecret(true);
      setTimeout(() => setHasCopiedSecret(false), 2000);
    }
    toast.success(t('hris.toasts.copied'));
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

  const getWebhookUrl = (provider: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://talnova.app';
    return `${origin}/api/v1/integrations/webhooks/${provider}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Workflow className="h-7 w-7 text-indigo-600" />
            {t('hris.header.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('hris.header.subtitle')}
          </p>
        </div>
      </div>

      {/* Marketplace Connectors Catalog */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {t('hris.marketplace.title')}
          </h2>
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
            {t('hris.marketplace.connectedBadge', {
              count: integrations.filter((i) => i.status === 'active').length,
            })}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {MARKETPLACE_CONNECTORS.map((connector) => {
            const activeInt = integrations.find(
              (i) => i.provider === connector.provider && i.status === 'active'
            );
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
                        <span className="text-xs text-muted-foreground">
                          {t(`hris.marketplace.connectors.${connector.id}.category` as any, connector.category)}
                        </span>
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
                      {isConnected ? t('hris.marketplace.connected') : t('hris.marketplace.available')}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-3 leading-relaxed">
                    {t(`hris.marketplace.connectors.${connector.id}.description` as any, connector.description)}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 text-xs text-muted-foreground pt-0 border-t mt-3 pt-3">
                  {isConnected ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>{t('hris.marketplace.tenantSubdomain')}</span>
                        <span className="font-semibold text-foreground">
                          {activeInt.subdomain
                            ? `${activeInt.subdomain}.${connector.provider}.com`
                            : t('hris.marketplace.tenantSubdomainDefault')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t('hris.marketplace.lastSynced')}</span>
                        <span
                          data-testid={`${connector.id}-last-synced`}
                          className="font-semibold text-foreground"
                        >
                          {activeInt.lastSyncedAt
                            ? new Date(activeInt.lastSyncedAt).toLocaleString()
                            : t('hris.marketplace.lastSyncedFallback')}
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
                          <RefreshCw
                            className={`h-3.5 w-3.5 mr-1.5 ${
                              syncProviderMut.isPending ? 'animate-spin' : ''
                            }`}
                          />
                          {t('hris.marketplace.syncBtn')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`${connector.id}-test-btn`}
                          className="text-xs"
                          onClick={() =>
                            activeInt &&
                            testMutation.mutate(activeInt._id, {
                              onSuccess: (res) =>
                                toast.success(
                                  t('hris.toasts.testSuccess', { latencyMs: res.latencyMs })
                                ),
                              onError: (err: any) =>
                                toast.error(
                                  err?.response?.data?.message || t('hris.toasts.testFailed')
                                ),
                            })
                          }
                          disabled={testMutation.isPending}
                        >
                          <Zap className="h-3.5 w-3.5 mr-1 text-amber-500" /> {t('hris.marketplace.testBtn')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => handleOpenWebhookModal(activeInt)}
                        >
                          <Key className="h-3.5 w-3.5 mr-1 text-indigo-500" /> {t('hris.marketplace.webhookBtn')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => handleOpenConnect(connector.provider, activeInt)}
                        >
                          <Settings2 className="h-3.5 w-3.5 mr-1 text-zinc-500" /> {t('hris.marketplace.mappingBtn')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`${connector.id}-logs-btn`}
                          className="text-xs"
                          onClick={() => setSelectedIntegrationId(activeInt._id)}
                        >
                          <List className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> {t('hris.marketplace.logsBtn')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`${connector.id}-disconnect-btn`}
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                          onClick={() => handleDisconnect(connector.provider)}
                          disabled={disconnectProviderMut.isPending}
                        >
                          <PowerOff className="h-3.5 w-3.5 mr-1" /> {t('hris.marketplace.disconnectBtn')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-muted-foreground">{t('hris.marketplace.readyForSetup')}</span>
                      <Button
                        size="sm"
                        data-testid={`${connector.id}-connect-btn`}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs"
                        onClick={() => handleOpenConnect(connector.provider)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> {t('hris.marketplace.connectBtn')}
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
                {t('hris.telemetry.title')}
              </CardTitle>
              <CardDescription>
                {t('hris.telemetry.desc')}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIntegrationId(null)}>
              {t('hris.telemetry.closeBtn')}
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {syncLogs.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                {t('hris.telemetry.empty')}
              </div>
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
                        {t('hris.telemetry.processedSummary', {
                          processedCount: log.processedCount,
                          createdUsersCount: log.createdUsersCount,
                          updatedUsersCount: log.updatedUsersCount,
                        })}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {log.errorCount > 0 && (
                      <div className="pt-2 text-red-600 font-medium border-t mt-1 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4" />
                          <span>{t('hris.telemetry.errorCount', { count: log.errorCount })}</span>
                        </div>

                        {/* DLQ Event Details & Remediation */}
                        {log.dlqEvents && log.dlqEvents.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {log.dlqEvents.map((dlq: any) => (
                              <div
                                key={dlq.eventId}
                                className="p-2.5 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded text-red-800 dark:text-red-200">
                                      {dlq.eventId}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={
                                        dlq.status === 'resolved'
                                          ? 'bg-emerald-50 text-emerald-600 border-emerald-300'
                                          : 'bg-amber-50 text-amber-600 border-amber-300'
                                      }
                                    >
                                      {dlq.status === 'resolved'
                                        ? t('hris.telemetry.resolvedStatus')
                                        : t('hris.telemetry.pendingStatus')}
                                    </Badge>
                                  </div>
                                  <p className="text-red-700 dark:text-red-300">
                                    {dlq.errorReason || t('hris.telemetry.defaultErrorReason')}
                                  </p>
                                </div>
                                {dlq.status !== 'resolved' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 bg-white hover:bg-zinc-50 border-red-300 text-red-700 shrink-0"
                                    onClick={() => handleRetryDLQ(selectedIntegrationId, dlq.eventId)}
                                    disabled={retryDLQMut.isPending}
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" /> {t('hris.telemetry.retryBtn')}
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
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
                  itemLabel={t('hris.telemetry.itemLabel')}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Connect & Configure Integration Modal */}
      <Dialog open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-card">
            <DialogTitle data-testid="connect-modal-title" className="text-lg font-bold text-foreground">
              {t('hris.connectModal.title', {
                provider: activeProvider === 'bamboohr' ? 'BambooHR' : activeProvider.toUpperCase(),
              })}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {t('hris.connectModal.desc')}
            </DialogDescription>

            {/* Navigation Tabs */}
            <div className="flex border-b border-border/40 mt-4 -mb-4">
              <button
                type="button"
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  configTab === 'credentials'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setConfigTab('credentials')}
              >
                {t('hris.connectModal.tabs.credentials')}
              </button>
              <button
                type="button"
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  configTab === 'rules'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setConfigTab('rules')}
              >
                {t('hris.connectModal.tabs.rules')}
              </button>
              <button
                type="button"
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  configTab === 'mappings'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setConfigTab('mappings')}
              >
                {t('hris.connectModal.tabs.mappings')}
              </button>
            </div>
          </DialogHeader>

          <DialogBody className="space-y-4 text-xs">
            {configTab === 'credentials' && (
              <div className="space-y-4">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">
                    {t('hris.connectModal.subdomainLabel')}
                  </label>
                  <div className="flex items-center">
                    <Input
                      data-testid="bamboohr-subdomain-input"
                      placeholder={t('hris.connectModal.subdomainPlaceholder')}
                      value={subdomain}
                      onChange={(e: any) => setSubdomain(e.target.value)}
                      className="rounded-r-none"
                    />
                    <span className="bg-muted px-3 py-2 border border-l-0 rounded-r-md text-muted-foreground text-xs font-mono">
                      .{activeProvider}.com
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t('hris.connectModal.subdomainHint')}
                  </p>
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">
                    {t('hris.connectModal.apiKeyLabel')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    data-testid="bamboohr-apikey-input"
                    type="password"
                    placeholder={t('hris.connectModal.apiKeyPlaceholder')}
                    value={apiKey}
                    onChange={(e: any) => {
                      setApiKey(e.target.value);
                      if (e.target.value.trim()) setApiKeyError('');
                    }}
                    className={
                      apiKeyError ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20' : ''
                    }
                  />
                  {apiKeyError && (
                    <div
                      data-testid="bamboohr-apikey-error"
                      className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5 font-medium"
                    >
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{apiKeyError}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {configTab === 'rules' && (
              <div className="space-y-4">
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">
                    {t('hris.connectModal.conflictResolution.title')}
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 p-2.5 border rounded-md cursor-pointer hover:bg-muted/20">
                      <input
                        type="radio"
                        name="conflictPolicy"
                        value="hris_wins"
                        checked={conflictPolicy === 'hris_wins'}
                        onChange={() => setConflictPolicy('hris_wins')}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div>
                        <div className="font-semibold text-foreground">
                          {t('hris.connectModal.conflictResolution.hrisWinsTitle')}
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          {t('hris.connectModal.conflictResolution.hrisWinsDesc', {
                            provider: activeProvider === 'bamboohr' ? 'BambooHR' : activeProvider,
                          })}
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 p-2.5 border rounded-md cursor-pointer hover:bg-muted/20">
                      <input
                        type="radio"
                        name="conflictPolicy"
                        value="local_wins"
                        checked={conflictPolicy === 'local_wins'}
                        onChange={() => setConflictPolicy('local_wins')}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div>
                        <div className="font-semibold text-foreground">
                          {t('hris.connectModal.conflictResolution.talnovaWinsTitle')}
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          {t('hris.connectModal.conflictResolution.talnovaWinsDesc')}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <label className="flex items-center justify-between p-2.5 border rounded-md cursor-pointer hover:bg-muted/20">
                    <div>
                      <div className="font-semibold text-foreground">
                        {t('hris.connectModal.autoProvision.title')}
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        {t('hris.connectModal.autoProvision.desc')}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoProvisionJourneys}
                      onChange={(e) => setAutoProvisionJourneys(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 rounded"
                    />
                  </label>
                </div>
              </div>
            )}

            {configTab === 'mappings' && (
              <div className="space-y-3">
                <p className="text-muted-foreground text-xs">
                  {t('hris.connectModal.mappings.desc')}
                </p>
                <div className="space-y-2">
                  {fieldMappings.map((mapping, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={mapping.externalField}
                        placeholder={t('hris.connectModal.mappings.externalPlaceholder')}
                        className="h-8 text-xs font-mono"
                        onChange={(e: any) => {
                          const updated = [...fieldMappings];
                          updated[idx].externalField = e.target.value;
                          setFieldMappings(updated);
                        }}
                      />
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        value={mapping.internalField}
                        placeholder={t('hris.connectModal.mappings.internalPlaceholder')}
                        className="h-8 text-xs font-mono"
                        onChange={(e: any) => {
                          const updated = [...fieldMappings];
                          updated[idx].internalField = e.target.value;
                          setFieldMappings(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 mt-2"
                  onClick={() =>
                    setFieldMappings([...fieldMappings, { externalField: '', internalField: '' }])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> {t('hris.connectModal.mappings.addMappingBtn')}
                </Button>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
            <Button variant="outline" size="sm" onClick={() => setIsConnectModalOpen(false)}>
              {t('hris.connectModal.cancelBtn')}
            </Button>
            <Button
              size="sm"
              data-testid="bamboohr-save-connect-btn"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
              onClick={handleSaveAndConnect}
              disabled={connectProviderMut.isPending}
            >
              {connectProviderMut.isPending
                ? t('hris.connectModal.savingBtn')
                : t('hris.connectModal.saveBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook Setup Dialog */}
      <Dialog open={isWebhookModalOpen} onOpenChange={setIsWebhookModalOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-card">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Key className="h-5 w-5 text-indigo-600" />
              {t('hris.webhookModal.title', {
                name: webhookIntegration?.name || t('hris.webhookModal.fallbackName'),
              })}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {t('hris.webhookModal.desc')}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4 text-xs">
            {/* Target Webhook URL */}
            <div>
              <label className="font-semibold text-foreground block mb-1">
                {t('hris.webhookModal.urlLabel')}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={webhookIntegration ? getWebhookUrl(webhookIntegration.provider) : ''}
                  className="font-mono text-xs bg-muted/30"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() =>
                    webhookIntegration &&
                    copyToClipboard(getWebhookUrl(webhookIntegration.provider), 'url')
                  }
                >
                  {hasCopiedUrl ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* HMAC Secret */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-foreground">
                  {t('hris.webhookModal.secretLabel')}
                </label>
                <button
                  type="button"
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                  onClick={() => setIsSecretRevealed(!isSecretRevealed)}
                >
                  {isSecretRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {isSecretRevealed ? t('hris.webhookModal.hide') : t('hris.webhookModal.reveal')}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  type={isSecretRevealed ? 'text' : 'password'}
                  value={webhookIntegration?.webhookSecret || '••••••••••••••••'}
                  className="font-mono text-xs bg-muted/30"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() =>
                    webhookIntegration?.webhookSecret &&
                    copyToClipboard(webhookIntegration.webhookSecret, 'secret')
                  }
                >
                  {hasCopiedSecret ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-red-600 hover:bg-red-50 border-red-200"
                  title={t('hris.webhookModal.rotateTooltip')}
                  onClick={() => webhookIntegration && handleRotateSecret(webhookIntegration._id)}
                  disabled={rotateSecretMut.isPending}
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${rotateSecretMut.isPending ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('hris.webhookModal.secretNote')}
              </p>
            </div>

            {/* Quick Setup Instructions */}
            <div className="p-3 bg-muted/20 border rounded-md space-y-1.5 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground block">
                {t('hris.webhookModal.checklistTitle')}
              </span>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>{t('hris.webhookModal.checklistItem1')}</li>
                <li>{t('hris.webhookModal.checklistItem2')}</li>
                <li>{t('hris.webhookModal.checklistItem3')}</li>
              </ul>
            </div>
          </DialogBody>

          <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
            <Button size="sm" onClick={() => setIsWebhookModalOpen(false)}>
              {t('hris.webhookModal.doneBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default HRISIntegrations;
