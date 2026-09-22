import { useState, useEffect } from 'react';
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
  KeyRound,
  ShieldCheck,
  Globe,
  Plus,
  Trash2,
  Save,
  Users,
  CheckCircle2,
  Lock,
  FileCode2,
  AlertCircle
} from 'lucide-react';
import { useSSOConfig, useSaveSSOConfig } from '../hooks/useSSO';
import { SSORoleMapping } from '../services/sso.service';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';
import { useTranslation } from 'react-i18next';

export function SSOSettings() {
  const { data: config, isLoading } = useSSOConfig();
  const saveMutation = useSaveSSOConfig();
  const { t } = useTranslation('settings');

  const [provider, setProvider] = useState<'okta' | 'azure_ad' | 'google_workspace' | 'custom_saml' | 'custom_oidc' | 'saml2'>('saml2');
  const [domainsInput, setDomainsInput] = useState('');
  const [issuerUrl, setIssuerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [ssoUrl, setSsoUrl] = useState('');
  const [certificate, setCertificate] = useState('');
  const [enforceSSO, setEnforceSSO] = useState(false);
  const [defaultRole, setDefaultRole] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [status, setStatus] = useState<'active' | 'disabled'>('active');
  const [urlError, setUrlError] = useState('');

  const [roleMappings, setRoleMappings] = useState<SSORoleMapping[]>([]);
  const [newGroupInput, setNewGroupInput] = useState('');
  const [newRoleInput, setNewRoleInput] = useState<'admin' | 'manager' | 'employee'>('employee');

  const mappingsPagination = usePagination({ data: roleMappings, initialPageSize: 5 });

  useEffect(() => {
    if (config) {
      setProvider(config.provider || 'saml2');
      setDomainsInput((config.domains || []).join(', '));
      setIssuerUrl(config.issuerUrl || '');
      setClientId(config.clientId || '');
      setSsoUrl(config.ssoUrl || '');
      setCertificate(config.certificate || '');
      setEnforceSSO(!!config.enforceSSO);
      setDefaultRole(config.defaultRole || 'employee');
      setStatus(config.status || 'active');
      setRoleMappings(config.roleMappings || []);
    }
  }, [config]);

  const isValidUrl = (url: string) => {
    if (!url) return true;
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const handleSsoUrlChange = (val: string) => {
    setSsoUrl(val);
    if (val.trim() && !isValidUrl(val.trim())) {
      setUrlError(t('sso.urlError'));
    } else {
      setUrlError('');
    }
  };

  const handleAddMapping = () => {
    if (!newGroupInput.trim()) return;
    setRoleMappings([...roleMappings, { idpGroup: newGroupInput.trim(), role: newRoleInput }]);
    setNewGroupInput('');
  };

  const handleRemoveMapping = (index: number) => {
    setRoleMappings(roleMappings.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (ssoUrl.trim() && !isValidUrl(ssoUrl.trim())) {
      setUrlError(t('sso.urlError'));
      toast.error(t('sso.toasts.invalidUrl'));
      return;
    }

    const domains = domainsInput
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    saveMutation.mutate(
      {
        provider,
        domains,
        issuerUrl,
        clientId,
        ssoUrl: ssoUrl.trim(),
        certificate: certificate.trim(),
        enforceSSO,
        defaultRole,
        roleMappings,
        status,
      },
      {
        onSuccess: () => {
          toast.success(t('sso.toasts.saved'));
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('sso.toasts.failed'));
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const primaryDomain = domainsInput.split(',')[0]?.trim() || '';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <KeyRound className="h-7 w-7 text-indigo-600" />
            {t('sso.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('sso.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            data-testid="sso-status-badge"
            variant="outline"
            className={
              status === 'active'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold px-2.5 py-1 text-xs'
                : 'bg-zinc-100 text-zinc-600 border-zinc-300 font-semibold px-2.5 py-1 text-xs'
            }
          >
            {status === 'active' ? t('sso.statusActive') : t('sso.statusDisabled')}
          </Badge>
          <Button
            data-testid="sso-save-btn"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" /> {t('sso.saveBtn')}
          </Button>
        </div>
      </div>

      {/* Active Domain Banner */}
      {status === 'active' && primaryDomain && (
        <div
          data-testid="sso-active-banner"
          className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between shadow-sm animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2 font-medium text-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{t('sso.activeBanner', { domain: primaryDomain })}</span>
          </div>
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">{t('sso.statusActive')}</Badge>
        </div>
      )}

      {/* Provider & Protocol Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            {t('sso.protocolCardTitle')}
          </CardTitle>
          <CardDescription>{t('sso.protocolCardDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{t('sso.protocolLabel')}</label>
              <select
                data-testid="sso-protocol-select"
                className="w-full text-sm p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={provider}
                onChange={(e: any) => setProvider(e.target.value)}
              >
                <option value="saml2">{t('sso.providers.saml2')}</option>
                <option value="custom_saml">{t('sso.providers.custom_saml')}</option>
                <option value="okta">{t('sso.providers.okta')}</option>
                <option value="azure_ad">{t('sso.providers.azure_ad')}</option>
                <option value="google_workspace">{t('sso.providers.google_workspace')}</option>
                <option value="custom_oidc">{t('sso.providers.custom_oidc')}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{t('sso.stateLabel')}</label>
              <select
                className="w-full text-sm p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
              >
                <option value="active">{t('sso.stateActive')}</option>
                <option value="disabled">{t('sso.stateDisabled')}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
            <div>
              <div className="font-semibold text-xs text-foreground">{t('sso.enableTitle')}</div>
              <div className="text-[11px] text-muted-foreground">{t('sso.enableSubtitle')}</div>
            </div>
            <input
              type="checkbox"
              data-testid="sso-enable-toggle"
              className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
              checked={status === 'active'}
              onChange={(e) => setStatus(e.target.checked ? 'active' : 'disabled')}
            />
          </div>
        </CardContent>
      </Card>

      {/* SAML / OIDC Endpoints & Certificate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5 text-indigo-600" />
            {t('sso.endpointsCardTitle')}
          </CardTitle>
          <CardDescription>{t('sso.endpointsCardDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('sso.ssoUrlLabel')} <span className="text-red-500">*</span>
              </label>
              <Input
                data-testid="sso-url-input"
                placeholder="https://okta.acme.corp/app/sso"
                value={ssoUrl}
                onChange={(e: any) => handleSsoUrlChange(e.target.value)}
                className={urlError ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20' : ''}
              />
              {urlError && (
                <div data-testid="sso-url-error" className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5 font-medium">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{urlError}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('sso.issuerLabel')} <span className="text-red-500">*</span>
              </label>
              <Input
                data-testid="sso-issuer-input"
                placeholder="http://www.okta.com/exk123"
                value={issuerUrl}
                onChange={(e: any) => setIssuerUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
              <FileCode2 className="h-4 w-4 text-indigo-600" />
              {t('sso.certLabel')}
            </label>
            <textarea
              data-testid="sso-certificate-textarea"
              rows={5}
              className="w-full text-xs font-mono p-3 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDXTCCAkWgAwIBAgIJAL9...&#10;-----END CERTIFICATE-----"
              value={certificate}
              onChange={(e) => setCertificate(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {t('sso.certHelp')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Domain Discovery & SSO Enforcement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-600" />
            {t('sso.domainsCardTitle')}
          </CardTitle>
          <CardDescription>{t('sso.domainsCardDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">{t('sso.domainsLabel')}</label>
            <Input
              data-testid="sso-domain-input"
              placeholder="acme.corp, company.com"
              value={domainsInput}
              onChange={(e: any) => setDomainsInput(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
            <div>
              <div className="font-semibold text-xs text-foreground">{t('sso.enforceTitle')}</div>
              <div className="text-[11px] text-muted-foreground">{t('sso.enforceSubtitle')}</div>
            </div>
            <input
              type="checkbox"
              data-testid="sso-enforce-toggle"
              className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
              checked={enforceSSO}
              onChange={(e) => setEnforceSSO(e.target.checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* IdP Group to Role Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            {t('sso.mappingCardTitle')}
          </CardTitle>
          <CardDescription>{t('sso.mappingCardDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder={t('sso.groupPlaceholder')}
              value={newGroupInput}
              onChange={(e: any) => setNewGroupInput(e.target.value)}
              className="flex-1 text-xs"
            />
            <select
              className="text-xs p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newRoleInput}
              onChange={(e: any) => setNewRoleInput(e.target.value)}
            >
              <option value="employee">{t('sso.roles.employee')}</option>
              <option value="manager">{t('sso.roles.manager')}</option>
              <option value="admin">{t('sso.roles.admin')}</option>
            </select>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleAddMapping}>
              <Plus className="h-4 w-4 mr-1" /> {t('sso.addRuleBtn')}
            </Button>
          </div>

          {/* Rules List Table */}
          <div className="space-y-2">
            <div className="divide-y text-xs border rounded-md">
              {roleMappings.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">{t('sso.noRules')}</div>
              ) : (
                mappingsPagination.paginatedData.map((m, idx) => (
                  <div key={idx} className="p-3 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-foreground">{m.idpGroup}</span>
                      <span className="text-muted-foreground ml-2">{t('sso.mapsTo')}</span>
                      <Badge variant="outline" className="ml-2 bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                        {m.role.toUpperCase()}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleRemoveMapping(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {roleMappings.length > 0 && (
              <SimplePagination
                currentPage={mappingsPagination.page}
                totalPages={mappingsPagination.totalPages}
                totalItems={mappingsPagination.totalItems}
                startIndex={mappingsPagination.startIndex}
                endIndex={mappingsPagination.endIndex}
                pageSize={mappingsPagination.pageSize}
                onPageChange={mappingsPagination.setPage}
                onPageSizeChange={mappingsPagination.setPageSize}
                itemLabel={t('sso.itemLabel')}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SSOSettings;
