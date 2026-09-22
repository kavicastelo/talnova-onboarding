import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../Card';
import { Button } from '../Button';
import { Input } from '../Input';
import { Badge } from '../Badge';
import { toast } from 'sonner';
import {
  useIntegrationConfig,
  useSaveIntegration,
  useTestIntegration,
} from '../../hooks/useOrganizationCapabilities';
import {
  Sparkles,
  Bot,
  Layers,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
} from 'lucide-react';

export function AIIntegrationSettings() {
  const { t } = useTranslation('settings');
  const { data: config, isLoading, refetch } = useIntegrationConfig('ai');
  const saveMut = useSaveIntegration('ai');
  const testMut = useTestIntegration('ai');

  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [deploymentName, setDeploymentName] = useState('');
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [enabled, setEnabled] = useState(true);

  const [testStatus, setTestStatus] = useState<{
    success?: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (config) {
      setProvider(config.provider || 'openai');
      setModel(config.publicConfig?.model || (config.provider === 'gemini' ? 'gemini-1.5-flash' : config.provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o-mini'));
      setEndpoint(config.publicConfig?.endpoint || '');
      setResourceName(config.publicConfig?.resourceName || '');
      setDeploymentName(config.publicConfig?.deploymentName || '');
      setTemperature(config.publicConfig?.temperature ?? 0.3);
      setMaxTokens(config.publicConfig?.maxTokens ?? 1024);
      setEnabled(config.enabled ?? true);
      if (config.validationError) {
        setTestStatus({ success: false, error: config.validationError });
      } else if (config.status === 'valid') {
        setTestStatus({ success: true });
      }
    }
  }, [config]);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    if (newProvider === 'openai') {
      setModel('gpt-4o-mini');
    } else if (newProvider === 'gemini') {
      setModel('gemini-1.5-flash');
    } else if (newProvider === 'anthropic') {
      setModel('claude-3-5-sonnet-20241022');
    } else if (newProvider === 'azure_openai') {
      setModel('gpt-4o');
    }
    setTestStatus(null);
  };

  const handleTestConnection = async () => {
    setTestStatus(null);
    testMut.mutate(
      {
        provider,
        publicConfig: { model, endpoint, resourceName, deploymentName, temperature, maxTokens },
        secrets: apiKey ? { apiKey, resourceName, deploymentName } : undefined,
      },
      {
        onSuccess: (res) => {
          setTestStatus(res);
          if (res.success) {
            toast.success(`AI Connection verified (${res.latencyMs}ms)!`);
          } else {
            toast.error(res.error || 'AI verification failed');
          }
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || err.message || 'Connection test failed';
          setTestStatus({ success: false, error: msg });
          toast.error(msg);
        },
      }
    );
  };

  const handleSave = () => {
    saveMut.mutate(
      {
        provider,
        enabled,
        publicConfig: {
          model,
          endpoint: endpoint.trim() || undefined,
          resourceName: resourceName.trim() || undefined,
          deploymentName: deploymentName.trim() || undefined,
          temperature,
          maxTokens,
        },
        secrets: apiKey.trim()
          ? {
              apiKey: apiKey.trim(),
              resourceName: resourceName.trim() || undefined,
              deploymentName: deploymentName.trim() || undefined,
            }
          : undefined,
      },
      {
        onSuccess: () => {
          setApiKey(''); // Clear input secret after save
          toast.success(t('ai.toasts.saved', 'AI configuration saved successfully!'));
          refetch();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || t('ai.toasts.saveFailed', 'Failed to save configuration.'));
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
          {t('ai.loading', 'Loading AI integration settings...')}
        </CardContent>
      </Card>
    );
  }

  const status = config?.status || 'not_configured';

  return (
    <div className="space-y-6" data-testid="ai-integration-settings">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <CardTitle>{t('ai.title', 'AI & Automation Configuration')}</CardTitle>
                <Badge
                  variant={
                    status === 'valid'
                      ? 'default'
                      : status === 'configured'
                      ? 'secondary'
                      : status === 'invalid'
                      ? 'destructive'
                      : 'outline'
                  }
                >
                  {status === 'valid'
                    ? t('ai.status.valid', 'Verified & Operational')
                    : status === 'configured'
                    ? t('ai.status.configured', 'Configured (Untested)')
                    : status === 'invalid'
                    ? t('ai.status.invalid', 'Connection Error')
                    : t('ai.status.notConfigured', 'Not Configured')}
                </Badge>
              </div>
              <CardDescription>
                {t('ai.description', 'Configure the LLM provider for your organization. Dependent application features will consume this integration securely.')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">{t('ai.enabled', 'Integration Enabled')}</span>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                  enabled ? 'bg-indigo-600' : 'bg-muted'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all duration-200 ${
                    enabled ? 'right-0.5 translate-x-0' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Dependent features info banner */}
          <div className="rounded-lg border bg-muted/40 p-4">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
              Dependent Application Capabilities
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <Bot className="h-4 w-4 text-indigo-500 mt-0.5" />
                <div>
                  <div className="font-medium text-xs">AI Assistant</div>
                  <div className="text-xs text-muted-foreground">Tenant policy & task Q&A</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Layers className="h-4 w-4 text-indigo-500 mt-0.5" />
                <div>
                  <div className="font-medium text-xs">AI Course Builder</div>
                  <div className="text-xs text-muted-foreground">Automated curriculum & quiz generation</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileCheck2 className="h-4 w-4 text-indigo-500 mt-0.5" />
                <div>
                  <div className="font-medium text-xs">Milestone Briefs</div>
                  <div className="text-xs text-muted-foreground">Executive reflection briefing</div>
                </div>
              </div>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ai.providerLabel', 'AI Provider')}</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="openai">OpenAI (Official API)</option>
              <option value="azure_openai">Azure OpenAI Service</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="gemini">Google Gemini (Vertex / AI Studio)</option>
              <option value="custom">Custom (OpenAI-Compatible LLM / Self-Hosted)</option>
            </select>
          </div>

          {/* Model / Deployment */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('ai.modelConfigLabel', 'Model Configuration')}</label>
              {/* Preset Chips */}
              <div className="flex flex-wrap gap-1.5">
                {(provider === 'gemini'
                  ? ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp']
                  : provider === 'anthropic'
                  ? ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
                  : provider === 'azure_openai'
                  ? ['gpt-4o', 'gpt-4o-mini']
                  : ['gpt-4o-mini', 'gpt-4o', 'o1-mini']
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setModel(preset)}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                      model === preset
                        ? 'bg-indigo-600 text-white border-indigo-600 font-medium'
                        : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t('ai.modelIdentifier', 'Model Identifier (or Custom Model)')}</label>
                <Input
                  value={model}
                  onChange={(e: any) => setModel(e.target.value)}
                  placeholder={
                    provider === 'gemini'
                      ? 'gemini-1.5-flash'
                      : provider === 'anthropic'
                      ? 'claude-3-5-sonnet-20241022'
                      : 'gpt-4o-mini'
                  }
                  className="text-sm"
                />
              </div>

              {/* Custom Endpoint / Azure Resource */}
              {(provider === 'custom' || provider === 'azure_openai') && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    {provider === 'azure_openai' ? t('ai.azureResourceUrl', 'Azure Resource URL') : t('ai.customEndpoint', 'Custom Base API Endpoint')}
                  </label>
                  <Input
                    value={endpoint}
                    onChange={(e: any) => setEndpoint(e.target.value)}
                    placeholder={
                      provider === 'azure_openai'
                        ? 'https://your-resource.openai.azure.com'
                        : 'https://api.together.xyz/v1'
                    }
                    className="text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Temperature & Token Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 bg-muted/20">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{t('ai.temperature', 'Creativity / Temperature')}</span>
                <span className="font-mono text-muted-foreground font-semibold">{temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{t('ai.temperatureStrict', '0.0 (Strict / Factual)')}</span>
                <span>{t('ai.temperatureCreative', '1.0 (Creative)')}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{t('ai.maxTokens', 'Max Output Tokens')}</span>
                <span className="font-mono text-muted-foreground font-semibold">{maxTokens} tokens</span>
              </div>
              <select
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value={256}>256 tokens (~190 words)</option>
                <option value={512}>512 tokens (~380 words)</option>
                <option value={1024}>1024 tokens (~760 words)</option>
                <option value={2048}>2048 tokens (~1500 words)</option>
                <option value={4096}>4096 tokens (~3000 words)</option>
              </select>
              <p className="text-[10px] text-muted-foreground">{t('ai.maxTokensDesc', 'Upper token limit per generated lesson, quiz, or chatbot response.')}</p>
            </div>
          </div>

          {/* API Key / Secrets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('ai.apiKeyLabel', 'API Secret Key')}</label>
              {config?.hasSecret && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Stored securely ({config.maskedSecret})
                </span>
              )}
            </div>
            <Input
              type="password"
              value={apiKey}
              onChange={(e: any) => setApiKey(e.target.value)}
              placeholder={
                config?.hasSecret
                  ? 'Leave blank to keep current key, or enter new secret to replace'
                  : 'Enter provider API key (e.g. sk-...)'
              }
            />
            <p className="text-xs text-muted-foreground">
              Credentials are encrypted at rest with AES-256-GCM and never returned to the browser.
            </p>
          </div>

          {/* Test Status Banner */}
          {testStatus && (
            <div
              className={`rounded-lg border p-4 text-sm flex items-start gap-3 ${
                testStatus.success
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
              }`}
            >
              {testStatus.success ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              )}
              <div className="space-y-1">
                <div className="font-semibold">
                  {testStatus.success
                    ? `Connection Verified (${testStatus.latencyMs}ms latency)`
                    : 'Connection Test Failed'}
                </div>
                {testStatus.error && <p className="text-xs opacity-90">{testStatus.error}</p>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testMut.isPending || (!config?.hasSecret && !apiKey.trim())}
            >
              {testMut.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4 text-indigo-500" />
              )}
              Test AI Connection
            </Button>

            <Button onClick={handleSave} disabled={saveMut.isPending}>
              {saveMut.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Save AI Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AIIntegrationSettings;
