import React, { useState } from 'react';
import {
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  RefreshCw,
  Sliders,
  Building2,
  Plus,
  Search,
  X,
  Check,
  Ban,
  Globe,
  Users,
  Percent,
} from 'lucide-react';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/Dialog';
import {
  useSuperAdminFeatureFlags,
  useToggleFeatureFlag,
  useUpdateFeatureFlag,
  useCreateFeatureFlag,
  useSuperAdminOrganizations,
} from '../../hooks/useSuperAdmin';
import { toast } from 'sonner';

interface OrganizationRef {
  _id?: string;
  id?: string;
  name: string;
  slug?: string;
}

const formatRoleName = (role: string) => {
  const roleNames: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    hr_admin: 'HR Admin',
    manager: 'Manager',
    employee: 'Employee',
    it_admin: 'IT Admin',
    super_admin: 'Super Admin',
  };
  return roleNames[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export function SuperAdminFeatureFlags() {
  const { data: flags, isLoading, isError } = useSuperAdminFeatureFlags();
  const toggleMutation = useToggleFeatureFlag();
  const updateMutation = useUpdateFeatureFlag();
  const createMutation = useCreateFeatureFlag();

  const { data: orgsData } = useSuperAdminOrganizations({ limit: 100 });
  const organizations: OrganizationRef[] = (orgsData as any)?.items || (Array.isArray(orgsData) ? orgsData : []);

  // State for Organization Overrides Modal
  const [selectedFlag, setSelectedFlag] = useState<any | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [targetAudience, setTargetAudience] = useState<string>('global');
  const [targetOrgIds, setTargetOrgIds] = useState<string[]>([]);
  const [excludedOrgIds, setExcludedOrgIds] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [rolloutPercentage, setRolloutPercentage] = useState<number>(100);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [targetOrgSearch, setTargetOrgSearch] = useState<string>('');
  const [excludedOrgSearch, setExcludedOrgSearch] = useState<string>('');

  // State for Create Feature Flag Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEnvironment, setNewEnvironment] = useState<'all' | 'production' | 'staging' | 'development'>('all');
  const [newAudience, setNewAudience] = useState<'global' | 'organizations' | 'roles' | 'percentage'>('global');
  const [newTargetRoles, setNewTargetRoles] = useState<string[]>([]);
  const [newRollout, setNewRollout] = useState(100);
  const [newIsEnabled, setNewIsEnabled] = useState(false);

  // Open Override Modal
  const handleOpenOverrides = (flag: any) => {
    setSelectedFlag(flag);
    setTargetAudience(flag.targetAudience || 'global');
    const targets = (flag.targetOrganizationIds || []).map((o: any) => (typeof o === 'object' ? o._id || o.id : o));
    const excluded = (flag.excludedOrganizationIds || []).map((o: any) => (typeof o === 'object' ? o._id || o.id : o));
    setTargetOrgIds(targets);
    setExcludedOrgIds(excluded);
    setTargetRoles(flag.targetRoles || []);
    setRolloutPercentage(flag.rolloutPercentage ?? flag.rolloutPct ?? 100);
    setOverrideReason('');
    setTargetOrgSearch('');
    setExcludedOrgSearch('');
    setIsOverrideModalOpen(true);
  };

  // Save Overrides
  const handleSaveOverrides = async () => {
    if (!selectedFlag) return;
    try {
      await updateMutation.mutateAsync({
        key: selectedFlag.key,
        data: {
          targetAudience,
          targetOrganizationIds: targetOrgIds,
          excludedOrganizationIds: excludedOrgIds,
          targetRoles,
          rolloutPercentage: Number(rolloutPercentage),
          reason: overrideReason || `Tenant overrides updated by Super Admin`,
        },
      });
      toast.success(`Organization overrides saved for '${selectedFlag.name}'`);
      setIsOverrideModalOpen(false);
      setSelectedFlag(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save organization overrides');
    }
  };

  // Quick Toggle Global Kill-switch
  const handleToggle = async (key: string, currentEnabled: boolean, rolloutPct: number) => {
    try {
      await toggleMutation.mutateAsync({
        key,
        data: { enabled: !currentEnabled, rolloutPct },
      });
      toast.success(`Feature flag '${key}' updated to ${!currentEnabled ? 'Enabled' : 'Disabled'}`);
    } catch (err: any) {
      toast.error('Failed to toggle feature flag');
    }
  };

  // Rollout Percentage change from dropdown
  const handleRolloutChange = async (key: string, enabled: boolean, newPct: number) => {
    try {
      await toggleMutation.mutateAsync({
        key,
        data: { enabled, rolloutPct: newPct, rolloutPercentage: newPct },
      });
      toast.success(`Rollout percentage for '${key}' set to ${newPct}%`);
    } catch (err: any) {
      toast.error('Failed to update rollout percentage');
    }
  };

  // Create Custom Flag
  const handleCreateFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newName.trim() || !newDescription.trim()) {
      toast.error('Please complete all required fields');
      return;
    }
    try {
      await createMutation.mutateAsync({
        key: newKey.trim().toLowerCase(),
        name: newName.trim(),
        description: newDescription.trim(),
        environment: newEnvironment,
        targetAudience: newAudience,
        targetRoles: newAudience === 'roles' ? newTargetRoles : [],
        rolloutPercentage: newRollout,
        isEnabled: newIsEnabled,
      });
      toast.success(`Feature flag '${newKey}' registered successfully`);
      setIsCreateModalOpen(false);
      setNewKey('');
      setNewName('');
      setNewDescription('');
      setNewRollout(100);
      setNewIsEnabled(false);
      setNewTargetRoles([]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to register feature flag');
    }
  };

  // Helper to get organization name by ID
  const getOrgName = (orgId: string): string => {
    const org = organizations.find((o) => (o._id || o.id) === orgId);
    if (org) return org.name;
    // Check if selectedFlag already has it populated
    const populated = [
      ...(selectedFlag?.targetOrganizationIds || []),
      ...(selectedFlag?.excludedOrganizationIds || []),
    ].find((o: any) => typeof o === 'object' && (o._id || o.id) === orgId);
    return populated?.name || orgId;
  };

  // Filtered orgs for picker
  const filteredTargetOrgs = organizations.filter(
    (o) =>
      !targetOrgIds.includes(o._id || o.id || '') &&
      (o.name.toLowerCase().includes(targetOrgSearch.toLowerCase()) ||
        (o.slug && o.slug.toLowerCase().includes(targetOrgSearch.toLowerCase())))
  );

  const filteredExcludedOrgs = organizations.filter(
    (o) =>
      !excludedOrgIds.includes(o._id || o.id || '') &&
      (o.name.toLowerCase().includes(excludedOrgSearch.toLowerCase()) ||
        (o.slug && o.slug.toLowerCase().includes(excludedOrgSearch.toLowerCase())))
  );

  return (
    <SuperAdminShell
      title="Platform Feature Flags & Flight Control"
      description="Global multi-tenant kill switches, progressive rollouts, and organization-level feature entitlements."
    >
      <div className="space-y-6">
        {/* Top Control Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Warning Banner */}
          <div className="flex-1 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-semibold text-amber-800">Global Flight Control Notice:</span> Toggling flags impacts all active tenant organizations simultaneously. Organization-level overrides allow whitelisting beta tenants or blacklisting specific organizations.
            </div>
          </div>

          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Register Flag
          </Button>
        </div>

        {/* Feature Flags Cards */}
        {isLoading ? (
          <div className="p-16 text-center text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
            Loading platform feature flight configuration...
          </div>
        ) : isError ? (
          <div className="p-16 text-center text-rose-600 bg-white rounded-xl border border-rose-200 shadow-sm">
            Failed to load feature flags.
          </div>
        ) : (
          <div className="space-y-4">
            {flags?.map((flag: any) => {
              const isFlagEnabled = flag.isEnabled ?? flag.enabled ?? false;
              const rollout = flag.rolloutPercentage ?? flag.rolloutPct ?? 100;
              const targetCount = flag.targetOrganizationIds?.length || 0;
              const excludedCount = flag.excludedOrganizationIds?.length || 0;

              return (
                <Card
                  key={flag.key}
                  className="p-5 bg-white border border-slate-200 hover:border-slate-300 shadow-sm rounded-xl transition-all"
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl border shrink-0 ${
                          isFlagEnabled
                            ? 'bg-indigo-50 border-indigo-100 text-indigo-600'
                            : 'bg-slate-100 border-slate-200 text-slate-400'
                        }`}
                      >
                        <Sliders className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold text-slate-900">{flag.name}</h4>
                          <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {flag.key}
                          </span>
                          <Badge
                            className={`text-[10px] font-mono uppercase ${
                              isFlagEnabled
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {isFlagEnabled ? 'Active' : 'Disabled'}
                          </Badge>

                          {/* Environment Badge */}
                          {flag.environment && flag.environment !== 'all' && (
                            <Badge className="text-[10px] uppercase bg-blue-50 text-blue-700 border border-blue-200">
                              {flag.environment}
                            </Badge>
                          )}

                          {/* Tenant Target Badges */}
                          {targetCount > 0 && (
                            <Badge className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 font-medium">
                              <Building2 className="w-3 h-3" />
                              {targetCount} {targetCount === 1 ? 'Tenant Overridden' : 'Tenants Overridden'}
                            </Badge>
                          )}

                          {excludedCount > 0 && (
                            <Badge className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 font-medium">
                              <Ban className="w-3 h-3" />
                              {excludedCount} Excluded
                            </Badge>
                          )}

                          {/* Role Target Badges */}
                          {flag.targetRoles && flag.targetRoles.length > 0 && (
                            <Badge className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 font-medium">
                              <Users className="w-3 h-3" />
                              {`Roles: ${flag.targetRoles.map((r: string) => formatRoleName(r)).join(', ')}`}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{flag.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 self-end lg:self-center">
                      {/* Organization Overrides Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenOverrides(flag)}
                        className="flex items-center gap-1.5 text-xs text-slate-700 border-slate-300 hover:bg-slate-50 shadow-sm"
                      >
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Organization Overrides</span>
                        {targetCount > 0 && (
                          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold">
                            {targetCount}
                          </span>
                        )}
                      </Button>

                      {/* Rollout Percentage */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-600 font-medium">Rollout:</span>
                        <select
                          value={rollout}
                          onChange={(e) => handleRolloutChange(flag.key, isFlagEnabled, parseInt(e.target.value))}
                          disabled={!isFlagEnabled || toggleMutation.isPending}
                          className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-900 text-xs disabled:opacity-40 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        >
                          <option value="10">10% Canary</option>
                          <option value="25">25% Beta</option>
                          <option value="50">50% Half</option>
                          <option value="100">100% General</option>
                        </select>
                      </div>

                      {/* Global Toggle Button */}
                      <Button
                        variant={isFlagEnabled ? 'default' : 'outline'}
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={() => handleToggle(flag.key, isFlagEnabled, rollout)}
                        className={`flex items-center gap-2 shadow-sm ${
                          isFlagEnabled
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {isFlagEnabled ? (
                          <>
                            <ToggleRight className="w-4 h-4 text-emerald-300" />
                            Enabled
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 text-slate-400" />
                            Disabled
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Organization Overrides Modal */}
      <Dialog open={isOverrideModalOpen} onOpenChange={setIsOverrideModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <DialogTitle>Tenant Organization Targeting & Overrides</DialogTitle>
            </div>
            <DialogDescription>
              Configure granular whitelist and blacklist targeting rules for feature flag{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono text-xs">
                {selectedFlag?.key}
              </code>
              . Exclusions take precedence over inclusions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-3">
            {/* Target Audience Mode */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Target Audience Strategy</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'global', label: 'Global Platform', icon: Globe },
                  { id: 'organizations', label: 'Targeted Tenants Only', icon: Building2 },
                  { id: 'percentage', label: 'Progressive Rollout %', icon: Percent },
                  { id: 'roles', label: 'Role Restricted', icon: Users },
                ].map((aud) => {
                  const Icon = aud.icon;
                  const isSelected = targetAudience === aud.id;
                  return (
                    <button
                      key={aud.id}
                      type="button"
                      data-testid={`target-audience-${aud.id}`}
                      onClick={() => setTargetAudience(aud.id)}
                      className={`p-3 rounded-lg border text-left transition-all flex flex-col gap-1.5 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`} />
                      <span className="text-xs font-semibold leading-snug">{aud.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target User Roles (When targetAudience is 'roles') */}
            {targetAudience === 'roles' && (
              <div className="space-y-2 p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/30" data-testid="target-roles-group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-semibold text-slate-900">Permitted User Roles</span>
                  </div>
                  <span className="text-[11px] text-slate-500">{targetRoles.length} selected</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Select user roles permitted to access this feature when restricted by role.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {['owner', 'admin', 'hr_admin', 'manager', 'employee', 'it_admin'].map((role) => (
                    <label
                      key={role}
                      className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-2.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 transition-colors"
                    >
                      <input
                        type="checkbox"
                        value={role}
                        checked={targetRoles.includes(role)}
                        onChange={(e) => {
                          if (e.target.checked) setTargetRoles([...targetRoles, role]);
                          else setTargetRoles(targetRoles.filter((r) => r !== role));
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-medium">{formatRoleName(role)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Target Organizations (Whitelist) */}
            <div className="space-y-2 p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-900">Whitelisted Tenant Organizations</span>
                </div>
                <span className="text-[11px] text-slate-500">{targetOrgIds.length} organizations targeted</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Organizations explicitly enabled for this feature regardless of global default state.
              </p>

              {/* Tag Pills */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-lg bg-white border border-slate-200">
                {targetOrgIds.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No tenant organizations explicitly targeted</span>
                ) : (
                  targetOrgIds.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs border border-indigo-200"
                    >
                      <Building2 className="w-3 h-3 text-indigo-500" />
                      <span className="font-medium">{getOrgName(id)}</span>
                      <button
                        type="button"
                        onClick={() => setTargetOrgIds(targetOrgIds.filter((tid) => tid !== id))}
                        className="hover:text-indigo-900 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add Org Dropdown / Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search organization to target..."
                  value={targetOrgSearch}
                  onChange={(e) => setTargetOrgSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                />
                {targetOrgSearch && (
                  <div className="absolute z-20 top-full mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg p-1">
                    {filteredTargetOrgs.length === 0 ? (
                      <div className="p-2 text-center text-xs text-slate-400">No matching organizations found</div>
                    ) : (
                      filteredTargetOrgs.map((org) => (
                        <button
                          key={org._id || org.id}
                          type="button"
                          onClick={() => {
                            setTargetOrgIds([...targetOrgIds, (org._id || org.id)!]);
                            setTargetOrgSearch('');
                          }}
                          className="w-full text-left px-3 py-1.5 rounded hover:bg-slate-100 flex items-center justify-between text-xs text-slate-800"
                        >
                          <span className="font-medium">{org.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{org.slug}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Excluded Organizations (Blacklist) */}
            <div className="space-y-2 p-3.5 rounded-xl border border-rose-100 bg-rose-50/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Ban className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-semibold text-slate-900">Excluded Tenant Organizations (Blacklist)</span>
                </div>
                <span className="text-[11px] text-slate-500">{excludedOrgIds.length} organizations excluded</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Organizations strictly blocked from accessing this feature. Exclusions override whitelist rules.
              </p>

              {/* Tag Pills */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-lg bg-white border border-slate-200">
                {excludedOrgIds.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No tenant organizations excluded</span>
                ) : (
                  excludedOrgIds.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 text-xs border border-rose-200"
                    >
                      <Ban className="w-3 h-3 text-rose-500" />
                      <span className="font-medium">{getOrgName(id)}</span>
                      <button
                        type="button"
                        onClick={() => setExcludedOrgIds(excludedOrgIds.filter((eid) => eid !== id))}
                        className="hover:text-rose-900 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add Org Dropdown / Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search organization to exclude..."
                  value={excludedOrgSearch}
                  onChange={(e) => setExcludedOrgSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                />
                {excludedOrgSearch && (
                  <div className="absolute z-20 top-full mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg p-1">
                    {filteredExcludedOrgs.length === 0 ? (
                      <div className="p-2 text-center text-xs text-slate-400">No matching organizations found</div>
                    ) : (
                      filteredExcludedOrgs.map((org) => (
                        <button
                          key={org._id || org.id}
                          type="button"
                          onClick={() => {
                            setExcludedOrgIds([...excludedOrgIds, (org._id || org.id)!]);
                            setExcludedOrgSearch('');
                          }}
                          className="w-full text-left px-3 py-1.5 rounded hover:bg-slate-100 flex items-center justify-between text-xs text-slate-800"
                        >
                          <span className="font-medium">{org.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{org.slug}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Rollout Percentage Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Rollout Percentage</label>
                <span className="text-xs font-mono font-semibold text-indigo-600">{rolloutPercentage}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={rolloutPercentage}
                onChange={(e) => setRolloutPercentage(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>0% Disabled</span>
                <span>25% Beta</span>
                <span>50% Half</span>
                <span>100% General</span>
              </div>
            </div>

            {/* Reason for Audit Log */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Reason for Change <span className="text-slate-400 font-normal">(Recorded in Platform Audit Log)</span>
              </label>
              <Input
                placeholder="e.g. Early access beta trial for Acme Corp"
                value={overrideReason}
                onChange={(e: any) => setOverrideReason(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOverrideModalOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveOverrides}
              disabled={updateMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Overrides'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Register Custom Feature Flag Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleCreateFlag}>
            <DialogHeader>
              <DialogTitle>Register Custom Platform Feature Flag</DialogTitle>
              <DialogDescription>
                Create an authoritative Mongoose-backed flight control gate for platform capability entitlement.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Key (Identifier) *</label>
                <Input
                  placeholder="e.g. advanced_analytics_v2"
                  value={newKey}
                  onChange={(e: any) => setNewKey(e.target.value)}
                  className="font-mono text-xs"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Lowercase, unique identifier used in runtime route gating.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Display Name *</label>
                <Input
                  placeholder="e.g. Advanced Analytics V2"
                  value={newName}
                  onChange={(e: any) => setNewName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Description *</label>
                <Input
                  placeholder="e.g. Next-generation cohort retention and milestone funnel charts"
                  value={newDescription}
                  onChange={(e: any) => setNewDescription(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Environment</label>
                  <select
                    value={newEnvironment}
                    onChange={(e: any) => setNewEnvironment(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Environments</option>
                    <option value="production">Production Only</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Initial Audience</label>
                  <select
                    value={newAudience}
                    onChange={(e: any) => setNewAudience(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="global">Global Platform</option>
                    <option value="organizations">Targeted Tenants Only</option>
                    <option value="percentage">Percentage Rollout</option>
                    <option value="roles">Role Restricted</option>
                  </select>
                </div>
              </div>

              {/* Role Checkboxes in Create Modal */}
              {newAudience === 'roles' && (
                <div className="space-y-2 p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">Permitted User Roles</label>
                    <span className="text-[11px] text-slate-500">{newTargetRoles.length} selected</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {['owner', 'admin', 'hr_admin', 'manager', 'employee', 'it_admin'].map((role) => (
                      <label
                        key={role}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-2 rounded bg-white border border-slate-200 hover:border-indigo-300 transition-colors"
                      >
                        <input
                          type="checkbox"
                          value={role}
                          checked={newTargetRoles.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) setNewTargetRoles([...newTargetRoles, role]);
                            else setNewTargetRoles(newTargetRoles.filter((r) => r !== role));
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 w-4 h-4 cursor-pointer"
                        />
                        <span>{formatRoleName(role)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">Initial Status</span>
                  <span className="text-[11px] text-slate-500">Enable feature immediately upon creation</span>
                </div>
                <input
                  type="checkbox"
                  checked={newIsEnabled}
                  onChange={(e) => setNewIsEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {createMutation.isPending ? 'Registering...' : 'Register Flag'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SuperAdminShell>
  );
}

export default SuperAdminFeatureFlags;
