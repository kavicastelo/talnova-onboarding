import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Mail,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Check,
  Send,
  Lock,
  ExternalLink,
  Server,
  Sparkles,
} from 'lucide-react';
import { SuperAdminShell } from '../../../components/super-admin/SuperAdminShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Badge } from '../../../components/Badge';
import { Switch } from '../../../components/Switch';
import {
  salesIntegrationService,
  SanitizedSalesIntegration,
  SaveSalesIntegrationPayload,
} from '../../../services/salesIntegration.service';

type CategoryTab = 'ai' | 'email' | 'whatsapp';

interface ProviderCardProps {
  category: string;
  provider: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  integration?: SanitizedSalesIntegration;
  docsUrl?: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'number' | 'boolean' | 'select';
    placeholder?: string;
    isSecret?: boolean;
    helper?: string;
    options?: Array<{ label: string; value: string }>;
  }>;
}

const ProviderConfigCard: React.FC<ProviderCardProps> = ({
  category,
  provider,
  title,
  description,
  icon,
  integration,
  docsUrl,
  fields,
}) => {
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState<boolean>(integration?.enabled ?? false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  // Feedback states
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    timestamp: string;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when integration updates from backend
  useEffect(() => {
    if (integration) {
      setEnabled(integration.enabled);
      const initial: Record<string, any> = { ...integration.publicConfig };
      // Include masked secret placeholders if present
      if (integration.maskedSecrets) {
        Object.entries(integration.maskedSecrets).forEach(([k, v]) => {
          initial[k] = v;
        });
      }
      setFormData(initial);
    }
  }, [integration]);

  const testMutation = useMutation({
    mutationFn: async () => {
      setTestResult(null);
      setErrorMessage(null);
      // Extract secrets from form data
      const secrets: Record<string, string> = {};
      fields.forEach((f) => {
        if (f.isSecret && formData[f.key]) {
          secrets[f.key] = formData[f.key];
        }
      });
      return await salesIntegrationService.testIntegration(category, provider, secrets);
    },
    onSuccess: (data) => {
      setTestResult({
        success: data.success,
        message: data.message,
        timestamp: new Date().toLocaleTimeString(),
      });
      queryClient.invalidateQueries({ queryKey: ['sales-integrations'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Connection test failed';
      setTestResult({
        success: false,
        message: msg,
        timestamp: new Date().toLocaleTimeString(),
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaveSuccess(false);
      setErrorMessage(null);

      const publicConfig: Record<string, any> = {};
      const secrets: Record<string, string> = {};

      fields.forEach((f) => {
        const val = formData[f.key];
        if (val !== undefined) {
          if (f.isSecret) {
            secrets[f.key] = val;
          } else {
            publicConfig[f.key] = val;
          }
        }
      });

      const payload: SaveSalesIntegrationPayload = {
        name: `${title} Integration`,
        enabled,
        publicConfig,
        secrets,
      };

      return await salesIntegrationService.saveIntegration(category, provider, payload);
    },
    onSuccess: () => {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      queryClient.invalidateQueries({ queryKey: ['sales-integrations'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to save configuration');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await salesIntegrationService.deleteIntegration(category, provider);
    },
    onSuccess: () => {
      setFormData({});
      setEnabled(false);
      setTestResult(null);
      queryClient.invalidateQueries({ queryKey: ['sales-integrations'] });
    },
  });

  const toggleSecretVisibility = (key: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const status = integration?.status || 'not_configured';

  return (
    <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden rounded-2xl hover:border-slate-300 transition-all">
      <CardHeader className="bg-slate-50/60 border-b border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-indigo-600">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900">{title}</CardTitle>
                {status === 'valid' && (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold gap-1 py-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified & Active
                  </Badge>
                )}
                {status === 'configured' && (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-semibold gap-1 py-0.5">
                    <Clock className="w-3 h-3" />
                    Configured
                  </Badge>
                )}
                {status === 'invalid' && (
                  <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[11px] font-semibold gap-1 py-0.5">
                    <AlertCircle className="w-3 h-3" />
                    Validation Failed
                  </Badge>
                )}
                {status === 'not_configured' && (
                  <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[11px] font-medium py-0.5">
                    Not Configured
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                {description}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">
                {enabled ? 'Active' : 'Disabled'}
              </span>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(checked)}
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>

            {docsUrl && (
              <a
                href={docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                title="View documentation"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Field Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => {
            const isSecret = field.isSecret;
            const isVisible = visibleSecrets[field.key];
            const value = formData[field.key] ?? '';

            return (
              <div key={field.key} className={field.type === 'text' && field.key === 'prompt' ? 'md:col-span-2' : ''}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    {field.label}
                    {isSecret && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                        <Lock className="w-2.5 h-2.5" /> Secret
                      </span>
                    )}
                  </label>
                  {isSecret && (
                    <button
                      type="button"
                      onClick={() => toggleSecretVisibility(field.key)}
                      className="text-[11px] text-slate-400 hover:text-indigo-600 flex items-center gap-1"
                    >
                      {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {isVisible ? 'Hide' : 'Reveal'}
                    </button>
                  )}
                </div>

                {field.type === 'select' ? (
                  <select
                    value={value}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select option</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'boolean' ? (
                  <div className="flex items-center gap-2 mt-2">
                    <Switch
                      checked={!!value}
                      onCheckedChange={(c) => setFormData((prev) => ({ ...prev, [field.key]: c }))}
                      className="data-[state=checked]:bg-indigo-600"
                    />
                    <span className="text-xs text-slate-600">{field.helper || 'Enable secure TLS/SSL'}</span>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      type={isSecret && !isVisible ? 'password' : 'text'}
                      value={value}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder || (isSecret ? '••••••••••••••••' : '')}
                      className="text-xs font-mono bg-slate-50/50 border-slate-200 focus:bg-white"
                    />
                  </div>
                )}

                {field.helper && field.type !== 'boolean' && (
                  <p className="text-[11px] text-slate-400 mt-1">{field.helper}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Feedback Banners */}
        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-semibold">{testResult.success ? 'Connection Verified' : 'Connection Error'}</p>
              <p className="text-[11px] mt-0.5">{testResult.message}</p>
              <p className="text-[10px] text-slate-400 mt-1">Validated at {testResult.timestamp}</p>
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-indigo-600" />
            <span>Credentials encrypted & saved successfully.</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {integration && integration.status !== 'not_configured' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(`Are you sure you want to reset credentials for ${title}?`)) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Reset Credentials
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="text-xs text-slate-700 border-slate-300 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testMutation.isPending ? 'animate-spin text-indigo-600' : ''}`} />
              Test Connection
            </Button>

            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"
            >
              {saveMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const SalesIntegrationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CategoryTab>('ai');

  const {
    data: integrations = [],
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['sales-integrations'],
    queryFn: () => salesIntegrationService.listIntegrations(),
  });

  const getIntegration = (category: string, provider: string) => {
    return integrations.find((i) => i.category === category && i.provider === provider);
  };

  const verifiedCount = integrations.filter((i) => i.status === 'valid').length;
  const configuredCount = integrations.filter((i) => ['valid', 'configured'].includes(i.status)).length;

  return (
    <SuperAdminShell
      title="API & Gateways Configuration"
      subtitle="Enterprise API credentials, outbound gateways, and AI orchestration for Talnova Sales Engine."
      showTenant={false}
      showSeverity={false}
      showEnvironment={false}
      actions={
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 text-xs bg-white text-slate-700 hover:bg-slate-50 border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </div>
      }
    >
      {/* Security & Cryptography Assurance Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold tracking-wide">Enterprise Security & Credential Encryption</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  AES-256-CBC
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                All external API keys, tokens, and credentials are encrypted at rest with hardware-grade AES-256-CBC using dedicated cryptographic salts. Plaintext secrets are never stored in databases or exposed in client responses.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/10 rounded-xl px-3.5 py-2 text-center border border-white/10">
              <p className="text-[10px] uppercase font-semibold text-slate-300">Verified</p>
              <p className="text-lg font-bold text-emerald-400">{verifiedCount}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-3.5 py-2 text-center border border-white/10">
              <p className="text-[10px] uppercase font-semibold text-slate-300">Total Configured</p>
              <p className="text-lg font-bold text-white">{configuredCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'ai'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>AI Intelligence</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'ai' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
            2
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'email'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email Gateways</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'email' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
            3
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'whatsapp'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>WhatsApp Messaging</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'whatsapp' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
            2
          </span>
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'ai' && (
        <div className="space-y-5">
          <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 flex items-start gap-3 text-xs text-indigo-900">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">AI Outbound Intelligence Engine</p>
              <p className="text-slate-600 mt-0.5">
                Powers automated lead scoring, AI draft responses in Unified Inbox, objection handling playbooks, and predictive pipeline analytics.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <ProviderConfigCard
              category="ai"
              provider="gemini"
              title="Google Gemini"
              description="Primary AI model driver for real-time sales intelligence and prospect scoring."
              icon={<Bot className="w-5 h-5 text-indigo-600" />}
              integration={getIntegration('ai', 'gemini')}
              docsUrl="https://ai.google.dev"
              fields={[
                {
                  key: 'apiKey',
                  label: 'Gemini API Key',
                  type: 'password',
                  isSecret: true,
                  placeholder: 'AIzaSy...',
                  helper: 'Get your API key from Google AI Studio',
                },
                {
                  key: 'model',
                  label: 'Default Gemini Model',
                  type: 'select',
                  options: [
                    { label: 'Gemini 1.5 Pro (Recommended for reasoning)', value: 'gemini-1.5-pro' },
                    { label: 'Gemini 1.5 Flash (Ultra-low latency)', value: 'gemini-1.5-flash' },
                    { label: 'Gemini Pro', value: 'gemini-pro' },
                  ],
                },
              ]}
            />

            <ProviderConfigCard
              category="ai"
              provider="openai"
              title="OpenAI GPT-4o"
              description="Alternative foundation model driver for natural conversation and objections."
              icon={<Sparkles className="w-5 h-5 text-emerald-600" />}
              integration={getIntegration('ai', 'openai')}
              docsUrl="https://platform.openai.com/api-keys"
              fields={[
                {
                  key: 'apiKey',
                  label: 'OpenAI Secret API Key',
                  type: 'password',
                  isSecret: true,
                  placeholder: 'sk-proj-...',
                  helper: 'Create a key with model execution permissions',
                },
                {
                  key: 'model',
                  label: 'OpenAI Model Selection',
                  type: 'select',
                  options: [
                    { label: 'GPT-4o (State of the art)', value: 'gpt-4o' },
                    { label: 'GPT-4o Mini (Cost-efficient)', value: 'gpt-4o-mini' },
                    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
                  ],
                },
              ]}
            />
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div className="space-y-5">
          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 flex items-start gap-3 text-xs text-blue-900">
            <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Enterprise Outbound Email Pipeline</p>
              <p className="text-slate-600 mt-0.5">
                Sends personalized sequences, tracking pixel telemetry (opens/clicks), and bi-directional inbox synchronization.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <ProviderConfigCard
              category="email"
              provider="ses"
              title="Amazon Simple Email Service (SES)"
              description="High-deliverability AWS outbound mail transport with bounce & complaint SNS webhooks."
              icon={<Server className="w-5 h-5 text-amber-600" />}
              integration={getIntegration('email', 'ses')}
              docsUrl="https://aws.amazon.com/ses/"
              fields={[
                {
                  key: 'accessKeyId',
                  label: 'AWS Access Key ID',
                  type: 'password',
                  isSecret: true,
                  placeholder: 'AKIA...',
                  helper: 'IAM user credentials with ses:SendRawEmail policy',
                },
                {
                  key: 'secretAccessKey',
                  label: 'AWS Secret Access Key',
                  type: 'password',
                  isSecret: true,
                  placeholder: '••••••••••••••••••••••••',
                },
                {
                  key: 'region',
                  label: 'AWS Region',
                  type: 'select',
                  options: [
                    { label: 'US East (N. Virginia) us-east-1', value: 'us-east-1' },
                    { label: 'US East (Ohio) us-east-2', value: 'us-east-2' },
                    { label: 'US West (Oregon) us-west-2', value: 'us-west-2' },
                    { label: 'Europe (Ireland) eu-west-1', value: 'eu-west-1' },
                    { label: 'Asia Pacific (Singapore) ap-southeast-1', value: 'ap-southeast-1' },
                  ],
                },
                {
                  key: 'fromEmail',
                  label: 'Default From Email Address',
                  type: 'text',
                  placeholder: 'sales@talnova.com',
                  helper: 'Must be a verified sender identity in AWS SES console',
                },
              ]}
            />

            <ProviderConfigCard
              category="email"
              provider="sendgrid"
              title="Twilio SendGrid"
              description="Direct REST API outbound email dispatch with built-in event webhook integration."
              icon={<Send className="w-5 h-5 text-blue-600" />}
              integration={getIntegration('email', 'sendgrid')}
              docsUrl="https://app.sendgrid.com/settings/api_keys"
              fields={[
                {
                  key: 'apiKey',
                  label: 'SendGrid API Key',
                  type: 'password',
                  isSecret: true,
                  placeholder: 'SG.xxxxxxxxxxxx',
                  helper: 'Requires "Mail Send" full access permissions',
                },
                {
                  key: 'fromEmail',
                  label: 'Verified Sender Email',
                  type: 'text',
                  placeholder: 'outreach@talnova.com',
                },
                {
                  key: 'fromName',
                  label: 'Sender Display Name',
                  type: 'text',
                  placeholder: 'Talnova Growth Team',
                },
              ]}
            />

            <ProviderConfigCard
              category="email"
              provider="smtp"
              title="Custom SMTP Server"
              description="Connect any standard mail server, Google Workspace, or Microsoft 365 Exchange via TLS."
              icon={<Server className="w-5 h-5 text-slate-700" />}
              integration={getIntegration('email', 'smtp')}
              fields={[
                {
                  key: 'host',
                  label: 'SMTP Hostname',
                  type: 'text',
                  placeholder: 'smtp.office365.com or smtp.gmail.com',
                },
                {
                  key: 'port',
                  label: 'Port Number',
                  type: 'number',
                  placeholder: '587',
                },
                {
                  key: 'secure',
                  label: 'SSL / TLS Connection',
                  type: 'boolean',
                  helper: 'Enable port 465 SSL or port 587 STARTTLS',
                },
                {
                  key: 'username',
                  label: 'SMTP Username / Account',
                  type: 'text',
                  placeholder: 'notifications@talnova.com',
                },
                {
                  key: 'password',
                  label: 'SMTP Password / App Password',
                  type: 'password',
                  isSecret: true,
                  placeholder: '••••••••••••••••',
                },
                {
                  key: 'fromEmail',
                  label: 'From Email Address',
                  type: 'text',
                  placeholder: 'noreply@talnova.com',
                },
              ]}
            />
          </div>
        </div>
      )}

      {activeTab === 'whatsapp' && (
        <div className="space-y-5">
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100 flex items-start gap-3 text-xs text-emerald-900">
            <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">WhatsApp Cloud Outreach Gateways</p>
              <p className="text-slate-600 mt-0.5">
                Enables two-way customer conversations in Unified Inbox, automated WhatsApp campaign sequences, and delivery receipts.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <ProviderConfigCard
              category="whatsapp"
              provider="meta_whatsapp"
              title="Meta WhatsApp Cloud API"
              description="Official direct Meta Cloud API integration for WhatsApp Business accounts."
              icon={<MessageSquare className="w-5 h-5 text-emerald-600" />}
              integration={getIntegration('whatsapp', 'meta_whatsapp')}
              docsUrl="https://developers.facebook.com/docs/whatsapp/cloud-api"
              fields={[
                {
                  key: 'accessToken',
                  label: 'Meta System User Permanent Token',
                  type: 'password',
                  isSecret: true,
                  placeholder: 'EAAx...',
                  helper: 'Permanent access token with whatsapp_business_messaging permissions',
                },
                {
                  key: 'phoneNumberId',
                  label: 'Phone Number ID',
                  type: 'text',
                  placeholder: '109283746592817',
                  helper: 'Found in Meta App Dashboard > WhatsApp > API Setup',
                },
                {
                  key: 'wabaId',
                  label: 'WhatsApp Business Account ID (WABA ID)',
                  type: 'text',
                  placeholder: '982736451928374',
                },
              ]}
            />

            <ProviderConfigCard
              category="whatsapp"
              provider="twilio_whatsapp"
              title="Twilio WhatsApp Messaging"
              description="Twilio Programmable Messaging adapter for sandbox and verified business numbers."
              icon={<MessageSquare className="w-5 h-5 text-rose-600" />}
              integration={getIntegration('whatsapp', 'twilio_whatsapp')}
              docsUrl="https://console.twilio.com/"
              fields={[
                {
                  key: 'accountSid',
                  label: 'Twilio Account SID',
                  type: 'password',
                  isSecret: true,
                  placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
                },
                {
                  key: 'authToken',
                  label: 'Twilio Auth Token',
                  type: 'password',
                  isSecret: true,
                  placeholder: '••••••••••••••••••••••••••••••••',
                },
                {
                  key: 'fromPhoneNumber',
                  label: 'Twilio WhatsApp Sender Number',
                  type: 'text',
                  placeholder: 'whatsapp:+14155238886',
                  helper: 'Include "whatsapp:" prefix and E.164 country code',
                },
              ]}
            />
          </div>
        </div>
      )}
    </SuperAdminShell>
  );
};

export default SalesIntegrationsPage;
