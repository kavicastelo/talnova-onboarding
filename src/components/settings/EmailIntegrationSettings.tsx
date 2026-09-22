import { useState, useEffect } from 'react';
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
  Mail,
  UserPlus,
  KeyRound,
  BellRing,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
} from 'lucide-react';

export function EmailIntegrationSettings() {
  const { data: config, isLoading, refetch } = useIntegrationConfig('email');
  const saveMut = useSaveIntegration('email');
  const testMut = useTestIntegration('email');

  const [provider, setProvider] = useState<'smtp' | 'resend' | 'sendgrid'>('smtp');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('Talnova Onboarding');
  const [secure, setSecure] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');

  const [testStatus, setTestStatus] = useState<{
    success?: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (config) {
      setProvider((config.provider as any) || 'smtp');
      setHost(config.publicConfig?.host || '');
      setPort(String(config.publicConfig?.port || '587'));
      setUser(config.publicConfig?.user || '');
      setFromEmail(config.publicConfig?.fromEmail || '');
      setFromName(config.publicConfig?.fromName || 'Talnova Onboarding');
      setSecure(config.publicConfig?.secure ?? false);
      setEnabled(config.enabled ?? true);

      if (config.validationError) {
        setTestStatus({ success: false, error: config.validationError });
      } else if (config.status === 'valid') {
        setTestStatus({ success: true });
      }
    }
  }, [config]);

  const handleTestConnection = () => {
    if (testEmailRecipient.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(testEmailRecipient.trim())) {
        toast.error('Please enter a valid email address for the test dispatch.');
        return;
      }
    }

    setTestStatus(null);
    testMut.mutate(
      {
        provider,
        publicConfig: {
          host: host.trim() || undefined,
          port: Number(port) || 587,
          user: user.trim() || undefined,
          fromEmail: fromEmail.trim() || undefined,
          fromName: fromName.trim() || undefined,
          secure,
        },
        secrets: {
          password: password.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
        },
        targetEmail: testEmailRecipient.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          setTestStatus(res);
          if (res.success) {
            toast.success(`Email connection verified (${res.latencyMs}ms)!`);
          } else {
            toast.error(res.error || 'Email connection verification failed.');
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
          host: host.trim() || undefined,
          port: Number(port) || 587,
          user: user.trim() || undefined,
          fromEmail: fromEmail.trim() || undefined,
          fromName: fromName.trim() || undefined,
          secure,
        },
        secrets: {
          password: password.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setPassword('');
          setApiKey('');
          toast.success('Email delivery configuration saved successfully!');
          refetch();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || 'Failed to save email configuration.');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
          Loading email delivery settings...
        </CardContent>
      </Card>
    );
  }

  const status = config?.status || 'not_configured';

  return (
    <div className="space-y-6" data-testid="email-integration-settings">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-indigo-500" />
                <CardTitle>Email Delivery Configuration</CardTitle>
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
                    ? 'Verified & Operational'
                    : status === 'configured'
                    ? 'Configured (Untested)'
                    : status === 'invalid'
                    ? 'Delivery Error'
                    : 'Not Configured'}
                </Badge>
              </div>
              <CardDescription>
                Configure how transactional emails are delivered for your organization. The platform
                will not use developer credentials in production.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Delivery Enabled</span>
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
              Dependent Email Capabilities
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <UserPlus className="h-4 w-4 text-indigo-500 mt-0.5" />
                <div>
                  <div className="font-medium text-xs">Employee Invitations</div>
                  <div className="text-xs text-muted-foreground">New hire onboarding invite emails</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <KeyRound className="h-4 w-4 text-indigo-500 mt-0.5" />
                <div>
                  <div className="font-medium text-xs">Password Recovery</div>
                  <div className="text-xs text-muted-foreground">Self-service password reset links</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <BellRing className="h-4 w-4 text-indigo-500 mt-0.5" />
                <div>
                  <div className="font-medium text-xs">Automated Alerts</div>
                  <div className="text-xs text-muted-foreground">Assignment & deadline reminders</div>
                </div>
              </div>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Transport Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="smtp">Custom SMTP Server (Office 365, Google Workspace, Postmark, etc.)</option>
              <option value="resend">Resend API</option>
              <option value="sendgrid">SendGrid API</option>
            </select>
          </div>

          {/* SMTP Specific Fields */}
          {provider === 'smtp' && (
            <div className="space-y-4 border rounded-lg p-4 bg-background/50">
              {/* Quick Presets */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <span className="text-xs font-medium text-muted-foreground">Quick SMTP Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Microsoft 365', host: 'smtp.office365.com', port: '587', secure: false },
                    { label: 'Google Workspace', host: 'smtp.gmail.com', port: '587', secure: false },
                    { label: 'Amazon SES (US-East)', host: 'email-smtp.us-east-1.amazonaws.com', port: '587', secure: false },
                    { label: 'Postmark', host: 'smtp.postmarkapp.com', port: '587', secure: false },
                    { label: 'SendGrid SMTP', host: 'smtp.sendgrid.net', port: '587', secure: false },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setHost(p.host);
                        setPort(p.port);
                        setSecure(p.secure);
                      }}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted/40 hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium">SMTP Host</label>
                  <Input
                    value={host}
                    onChange={(e: any) => setHost(e.target.value)}
                    placeholder="e.g. smtp.office365.com or smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Port</label>
                  <Input
                    value={port}
                    onChange={(e: any) => {
                      const newPort = e.target.value;
                      setPort(newPort);
                      if (newPort === '465') {
                        setSecure(true);
                      } else if (newPort === '587' || newPort === '25') {
                        setSecure(false);
                      }
                    }}
                    placeholder="587 or 465"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">SMTP Username / Account</label>
                  <Input
                    value={user}
                    onChange={(e: any) => setUser(e.target.value)}
                    placeholder="e.g. notifications@yourcompany.com"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">SMTP Password</label>
                    {config?.hasSecret && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        Stored ({config.maskedSecret})
                      </span>
                    )}
                  </div>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e: any) => setPassword(e.target.value)}
                    placeholder={config?.hasSecret ? 'Leave blank to retain existing password' : 'Enter SMTP password'}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="smtp-secure-toggle"
                  checked={secure}
                  onChange={(e) => setSecure(e.target.checked)}
                  className="rounded border-input text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="smtp-secure-toggle" className="text-sm cursor-pointer text-muted-foreground">
                  Use SSL/TLS (mandatory for port 465, uncheck for port 587 STARTTLS)
                </label>
              </div>
            </div>
          )}

          {/* API Key for Resend / SendGrid */}
          {(provider === 'resend' || provider === 'sendgrid') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {provider === 'resend' ? 'Resend API Key' : 'SendGrid API Key'}
                </label>
                {config?.hasSecret && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Stored ({config.maskedSecret})
                  </span>
                )}
              </div>
              <Input
                type="password"
                value={apiKey}
                onChange={(e: any) => setApiKey(e.target.value)}
                placeholder={config?.hasSecret ? 'Leave blank to retain existing key' : 'Enter API Key (re_... / SG....)'}
              />
            </div>
          )}

          {/* Sender Identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sender Email Address (From)</label>
              <Input
                value={fromEmail}
                onChange={(e: any) => setFromEmail(e.target.value)}
                placeholder="no-reply@yourdomain.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sender Display Name</label>
              <Input
                value={fromName}
                onChange={(e: any) => setFromName(e.target.value)}
                placeholder="Acme Onboarding Team"
              />
            </div>
          </div>

          {/* Optional Test Recipient Email */}
          <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Optional Live Test Dispatch
            </label>
            <div className="flex gap-2">
              <Input
                value={testEmailRecipient}
                onChange={(e: any) => setTestEmailRecipient(e.target.value)}
                placeholder="Enter email to send a test message (optional)"
                className="text-sm"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testMut.isPending || (!config?.hasSecret && !password && !apiKey)}
                className="shrink-0"
              >
                {testMut.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4 text-indigo-500" />
                )}
                Test Connection
              </Button>
            </div>
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
                    ? `Email Delivery Verified (${testStatus.latencyMs}ms)`
                    : 'Email Connection Test Failed'}
                </div>
                {testStatus.error && <p className="text-xs opacity-90">{testStatus.error}</p>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end pt-2 border-t">
            <Button onClick={handleSave} disabled={saveMut.isPending}>
              {saveMut.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Save Email Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default EmailIntegrationSettings;
