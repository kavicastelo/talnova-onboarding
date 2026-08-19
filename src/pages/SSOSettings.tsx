import React, { useState, useEffect } from 'react';
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
  CheckCircle,
  AlertCircle,
  Users
} from 'lucide-react';
import { useSSOConfig, useSaveSSOConfig } from '../hooks/useSSO';
import { SSORoleMapping } from '../services/sso.service';
import { toast } from 'sonner';

export function SSOSettings() {
  const { data: config, isLoading } = useSSOConfig();
  const saveMutation = useSaveSSOConfig();

  const [provider, setProvider] = useState<'okta' | 'azure_ad' | 'google_workspace' | 'custom_saml' | 'custom_oidc'>('okta');
  const [domainsInput, setDomainsInput] = useState('');
  const [issuerUrl, setIssuerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [ssoUrl, setSsoUrl] = useState('');
  const [enforceSSO, setEnforceSSO] = useState(false);
  const [defaultRole, setDefaultRole] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [status, setStatus] = useState<'active' | 'disabled'>('active');

  const [roleMappings, setRoleMappings] = useState<SSORoleMapping[]>([]);
  const [newGroupInput, setNewGroupInput] = useState('');
  const [newRoleInput, setNewRoleInput] = useState<'admin' | 'manager' | 'employee'>('employee');

  useEffect(() => {
    if (config) {
      setProvider(config.provider || 'okta');
      setDomainsInput((config.domains || []).join(', '));
      setIssuerUrl(config.issuerUrl || '');
      setClientId(config.clientId || '');
      setSsoUrl(config.ssoUrl || '');
      setEnforceSSO(!!config.enforceSSO);
      setDefaultRole(config.defaultRole || 'employee');
      setStatus(config.status || 'active');
      setRoleMappings(config.roleMappings || []);
    }
  }, [config]);

  const handleAddMapping = () => {
    if (!newGroupInput.trim()) return;
    setRoleMappings([...roleMappings, { idpGroup: newGroupInput.trim(), role: newRoleInput }]);
    setNewGroupInput('');
  };

  const handleRemoveMapping = (index: number) => {
    setRoleMappings(roleMappings.filter((_, i) => i !== index));
  };

  const handleSave = () => {
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
        ssoUrl,
        enforceSSO,
        defaultRole,
        roleMappings,
        status,
      },
      {
        onSuccess: () => {
          toast.success('Enterprise SSO configuration saved successfully!');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to save SSO configuration');
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <KeyRound className="h-7 w-7 text-indigo-600" />
            Enterprise SSO & Identity Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure SAML 2.0 / OIDC identity providers, domain discovery, JIT user provisioning, and group-to-role mappings.
          </p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" /> Save SSO Settings
        </Button>
      </div>

      {/* Provider Selection & Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            Identity Provider Protocol
          </CardTitle>
          <CardDescription>Select your enterprise identity provider and status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Provider Type</label>
              <select
                className="w-full text-sm p-2 border rounded-md bg-background focus:outline-none"
                value={provider}
                onChange={(e: any) => setProvider(e.target.value)}
              >
                <option value="okta">Okta (SAML / OIDC)</option>
                <option value="azure_ad">Microsoft Entra ID / Azure AD</option>
                <option value="google_workspace">Google Workspace SSO</option>
                <option value="custom_saml">Custom SAML 2.0 Provider</option>
                <option value="custom_oidc">Custom OIDC Provider</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">SSO Status</label>
              <select
                className="w-full text-sm p-2 border rounded-md bg-background focus:outline-none"
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
              >
                <option value="active">Active (SSO Enabled)</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Issuer / Metadata URL</label>
              <Input
                placeholder="https://company.okta.com/oauth2/default"
                value={issuerUrl}
                onChange={(e: any) => setIssuerUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Client ID / Entity ID</label>
              <Input
                placeholder="0oa1234567890abcdef"
                value={clientId}
                onChange={(e: any) => setClientId(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domain Discovery & Enforcement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-600" />
            Domain Discovery & SSO Enforcement
          </CardTitle>
          <CardDescription>Auto-detect SSO settings when users log in with company email domains.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Authorized Domains (Comma separated)</label>
            <Input
              placeholder="acme.com, corp.acme.com"
              value={domainsInput}
              onChange={(e: any) => setDomainsInput(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
            <div>
              <div className="font-semibold text-xs text-foreground">Enforce Mandatory SSO</div>
              <div className="text-[11px] text-muted-foreground">Force all users with matched domains to sign in via SSO.</div>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-indigo-600"
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
            Group-to-Role Mapping Rules (JIT Provisioning)
          </CardTitle>
          <CardDescription>Map IdP SAML/OIDC security groups to Talnova application roles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="IdP Group Name (e.g. HR-Admins)"
              value={newGroupInput}
              onChange={(e: any) => setNewGroupInput(e.target.value)}
              className="flex-1 text-xs"
            />
            <select
              className="text-xs p-2 border rounded-md bg-background focus:outline-none"
              value={newRoleInput}
              onChange={(e: any) => setNewRoleInput(e.target.value)}
            >
              <option value="employee">Employee Role</option>
              <option value="manager">Manager Role</option>
              <option value="admin">Admin Role</option>
            </select>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleAddMapping}>
              <Plus className="h-4 w-4 mr-1" /> Add Rule
            </Button>
          </div>

          {/* Rules List Table */}
          <div className="divide-y text-xs border rounded-md">
            {roleMappings.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No group mapping rules configured. Default role will be assigned.</div>
            ) : (
              roleMappings.map((m, idx) => (
                <div key={idx} className="p-3 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-foreground">{m.idpGroup}</span>
                    <span className="text-muted-foreground ml-2">maps to</span>
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
        </CardContent>
      </Card>
    </div>
  );
}

export default SSOSettings;
