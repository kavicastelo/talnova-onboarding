import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  HardDrive,
  FileSpreadsheet,
  GraduationCap,
  Clock,
  AlertTriangle,
  ArrowLeft,
  ShieldAlert,
  Edit,
  Ban,
  CheckCircle2,
  Calendar,
  Mail,
  Globe,
  RefreshCw,
  Sliders,
  ToggleLeft,
  Search,
  Filter,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Input } from '../../components/Input';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import {
  useSuperAdminOrganization360,
  useUpdateOrganization,
  useToggleOrganizationStatus,
  useQuarantineOrganization,
  useSuperAdminOrganizationFlags,
  useUpdateOrganizationFlagOverride,
  useBatchUpdateOrganizationFlags,
} from '../../hooks/useSuperAdmin';
import { toast } from 'sonner';

export function SuperAdminOrganization360() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'quotas' | 'features' | 'users' | 'journeys' | 'billing' | 'audit' | 'danger'
  >('overview');

  const { data, isLoading, isError, refetch } = useSuperAdminOrganization360(id);

  const { data: orgFlags, isLoading: isFlagsLoading, refetch: refetchFlags } = useSuperAdminOrganizationFlags(id);
  const updateFlagOverrideMutation = useUpdateOrganizationFlagOverride();
  const batchUpdateFlagsMutation = useBatchUpdateOrganizationFlags();

  const [featureSearch, setFeatureSearch] = useState('');
  const [featureFilter, setFeatureFilter] = useState<'all' | 'enabled' | 'disabled' | 'overridden'>('all');
  const [isResettingOverrides, setIsResettingOverrides] = useState(false);

  const updateMutation = useUpdateOrganization();
  const toggleStatusMutation = useToggleOrganizationStatus();
  const quarantineMutation = useQuarantineOrganization();

  // Edit Quota Modal
  const [showEditQuotaModal, setShowEditQuotaModal] = useState(false);
  const [editPlan, setEditPlan] = useState<string>('Enterprise');
  const [editSeatLimit, setEditSeatLimit] = useState<number>(50);
  const [isUpdating, setIsUpdating] = useState(false);

  // Quarantine Confirmation Modal
  const [showQuarantineModal, setShowQuarantineModal] = useState(false);
  const [quarantineReason, setQuarantineReason] = useState('');
  const [isQuarantining, setIsQuarantining] = useState(false);

  if (isLoading) {
    return (
      <SuperAdminShell title="Organization 360° Profile" subtitle="Loading organization metadata…" hideFilterBar={true}>
        <div className="space-y-4 animate-pulse">
          <div className="h-10 w-48 rounded bg-slate-200" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-100 border border-slate-200" />
            ))}
          </div>
        </div>
      </SuperAdminShell>
    );
  }

  if (isError || !data) {
    return (
      <SuperAdminShell title="Organization 360° Profile" subtitle="Cross-tenant organization profile" hideFilterBar={true}>
        <div className="p-8 text-center bg-white border border-slate-200 shadow-sm rounded-2xl space-y-4">
          <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-semibold text-slate-900">Tenant Profile Not Found</h2>
          <p className="text-xs text-slate-500">
            Could not retrieve organization 360 details for ID: <span className="font-mono">{id}</span>
          </p>
          <Button
            onClick={() => navigate('/super-admin/organizations')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Organizations
          </Button>
        </div>
      </SuperAdminShell>
    );
  }

  const { organization, quotas, users = [], journeys = [], invoices = [], activity = [], onboardingStats } = data;

  const handleOpenQuotaModal = () => {
    setEditPlan(organization.plan || 'Enterprise');
    setEditSeatLimit(quotas.users.limit || 50);
    setShowEditQuotaModal(true);
  };

  const handleSaveQuotas = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await updateMutation.mutateAsync({
        id: organization.id,
        data: {
          plan: editPlan,
          seatLimit: Number(editSeatLimit)
        }
      });
      toast.success('Organization quota updated successfully.');
      setShowEditQuotaModal(false);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update quota.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuarantine = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsQuarantining(true);
    try {
      await quarantineMutation.mutateAsync({
        id: organization.id,
        reason: quarantineReason.trim() || 'Super Admin manual quarantine action'
      });
      toast.success(`Tenant ${organization.name} placed in quarantine.`);
      setShowQuarantineModal(false);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to quarantine organization.');
    } finally {
      setIsQuarantining(false);
    }
  };

  const handleToggleStatus = async () => {
    const nextStatus = organization.status === 'Active' ? 'Suspended' : 'Active';
    try {
      await toggleStatusMutation.mutateAsync({
        id: organization.id,
        status: nextStatus
      });
      toast.success(`Tenant status updated to ${nextStatus}.`);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to toggle status.');
    }
  };

  const storageMB = Math.round((quotas.storage.currentBytes || 0) / (1024 * 1024));
  const storageLimitGB = Math.round((quotas.storage.limitBytes || 0) / (1024 * 1024 * 1024));

  return (
    <SuperAdminShell
      title={`${organization.name} — 360° Command Profile`}
      subtitle={`Tenant ID: ${organization.id} · Domain: ${organization.domain || `${organization.slug}.talnova.app`}`}
      hideFilterBar={true}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/super-admin/organizations')}
            className="border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All Tenants
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh 360
          </Button>
          <Button
            size="sm"
            onClick={handleOpenQuotaModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
          >
            <Sliders className="h-3.5 w-3.5" /> Adjust Quotas
          </Button>
        </div>
      }
    >
      {/* Top Tenant Profile Header Card */}
      <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 font-bold text-lg border border-indigo-200">
              {organization.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900">{organization.name}</h2>
                <Badge
                  className={
                    organization.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }
                >
                  {organization.status}
                </Badge>
                <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {organization.plan} Tier
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap font-mono">
                <span className="flex items-center gap-1 text-slate-700">
                  <Globe className="h-3.5 w-3.5 text-indigo-600" />
                  {organization.domain || `${organization.slug}.talnova.app`}
                </span>
                <span className="flex items-center gap-1 text-slate-700">
                  <Mail className="h-3.5 w-3.5 text-emerald-600" />
                  {organization.supportEmail || 'No support email'}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  Created: {new Date(organization.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleStatus}
              className={`text-xs border-slate-200 ${
                organization.status === 'Active'
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
              }`}
            >
              {organization.status === 'Active' ? (
                <>
                  <Ban className="h-3.5 w-3.5 mr-1" /> Suspend Tenant
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Activate Tenant
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowQuarantineModal(true)}
              className="border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs gap-1"
            >
              <ShieldAlert className="h-3.5 w-3.5" /> Quarantine
            </Button>
          </div>
        </div>

        {/* Modular Tabs Navigation */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-4 mt-5 overflow-x-auto text-xs">
          {[
            { id: 'overview', label: 'Overview & Profile', icon: Building2 },
            { id: 'quotas', label: 'Quotas & Limits', icon: Sliders },
            { id: 'features', label: `Feature Entitlements (${orgFlags?.length || 0})`, icon: ToggleLeft },
            { id: 'users', label: `Users (${quotas.users.current})`, icon: Users },
            { id: 'journeys', label: `Journeys (${journeys.length})`, icon: GraduationCap },
            { id: 'billing', label: `Invoices (${invoices.length})`, icon: FileSpreadsheet },
            { id: 'audit', label: `Audit Stream (${activity.length})`, icon: Clock },
            { id: 'danger', label: 'Danger Zone', icon: ShieldAlert }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quick Metrics */}
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              User Utilization
            </h3>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {quotas.users.current} / {quotas.users.limit}
              </span>
              <span className="text-xs font-semibold text-blue-600">
                {quotas.users.utilizationPct}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, quotas.users.utilizationPct)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {quotas.users.active} users actively logged in
            </p>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-emerald-600" />
              Storage Quota
            </h3>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {storageMB} MB / {storageLimitGB} GB
              </span>
              <span className="text-xs font-semibold text-emerald-600">
                {quotas.storage.utilizationPct}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, quotas.storage.utilizationPct)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {quotas.storage.filesCount} uploaded media & documents
            </p>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-amber-600" />
              Onboarding Pipeline
            </h3>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {onboardingStats?.activeCount ?? 0}
              </span>
              <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[11px]">
                In Progress
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500">
              {onboardingStats?.completedCount ?? 0} completions recorded
            </p>
          </Card>

          {/* Workspace Config Card */}
          <Card className="md:col-span-3 border border-slate-200 bg-white shadow-sm rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sliders className="h-4 w-4 text-indigo-600" />
              Workspace Metadata & Tenant Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-1">Timezone</span>
                <span className="font-mono text-slate-900 font-medium">
                  {organization.workspace?.timezone || 'UTC'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-1">Locale</span>
                <span className="font-mono text-slate-900 font-medium">
                  {organization.workspace?.locale || 'en-US'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-1">Primary Brand Color</span>
                <div className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded-full border border-slate-300"
                    style={{ backgroundColor: organization.branding?.primaryColor || '#4F46E5' }}
                  />
                  <span className="font-mono text-slate-900">
                    {organization.branding?.primaryColor || '#4F46E5'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: QUOTAS & GOVERNANCE */}
      {activeTab === 'quotas' && (
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-5 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Tenant Resource Quotas & Allocations</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Enforce organizational ceilings, prevent runaway storage, and control seat usage.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleOpenQuotaModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
            >
              <Edit className="h-3.5 w-3.5" /> Modify Limits
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">User Seats</span>
                <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">
                  {quotas.users.utilizationPct}% Used
                </Badge>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                {quotas.users.current} / {quotas.users.limit}
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${Math.min(100, quotas.users.utilizationPct)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Enforced by user provisioning RBAC middleware.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Storage Ceiling</span>
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                  {quotas.storage.utilizationPct}% Used
                </Badge>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                {storageMB} MB / {storageLimitGB} GB
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full"
                  style={{ width: `${Math.min(100, quotas.storage.utilizationPct)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Aggregated from {quotas.storage.filesCount} files in cloud storage.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">AI Token Budget</span>
                <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px]">
                  0% Used
                </Badge>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                0 / 1,000,000
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full" style={{ width: '1%' }} />
              </div>
              <p className="text-[11px] text-slate-500">
                Monthly allowance for AI course generator and assistant.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* TAB: FEATURE ENTITLEMENTS */}
      {activeTab === 'features' && (() => {
        const flagsList: any[] = Array.isArray(orgFlags) ? orgFlags : (orgFlags as any)?.flags || [];
        const activeForTenantCount = flagsList.filter((f) => f.effectiveEnabled).length;
        const whitelistedCount = flagsList.filter((f) => f.override === 'whitelisted').length;
        const blacklistedCount = flagsList.filter((f) => f.override === 'blacklisted').length;
        const overriddenCount = whitelistedCount + blacklistedCount;

        const filteredOrgFlags = flagsList.filter((flag) => {
          const q = featureSearch.toLowerCase().trim();
          const matchesSearch =
            !q ||
            flag.name?.toLowerCase().includes(q) ||
            flag.key?.toLowerCase().includes(q) ||
            flag.description?.toLowerCase().includes(q);

          if (!matchesSearch) return false;

          if (featureFilter === 'enabled') return flag.effectiveEnabled;
          if (featureFilter === 'disabled') return !flag.effectiveEnabled;
          if (featureFilter === 'overridden') return flag.override !== 'default';

          return true;
        });

        return (
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">Tenant Feature Entitlements & Overrides</h3>
                  <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                    {flagsList.length} Capabilities
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Control beta access, early whitelists, or strict customer blacklists for {organization.name}.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchFlags()}
                  disabled={isFlagsLoading}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isFlagsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                {overriddenCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isResettingOverrides || batchUpdateFlagsMutation.isPending}
                    onClick={async () => {
                      if (!window.confirm(`Reset all ${overriddenCount} feature overrides for ${organization.name} back to platform defaults?`)) return;
                      setIsResettingOverrides(true);
                      try {
                        const overridesToReset = (orgFlags || [])
                          .filter((f) => f.override !== 'default')
                          .map((f) => ({ key: f.key, override: 'default' as const }));
                        await batchUpdateFlagsMutation.mutateAsync({
                          orgId: id!,
                          payload: {
                            updates: overridesToReset,
                            reason: `Reset all ${overridesToReset.length} overrides to platform default`,
                          },
                        });
                        toast.success(`Reset ${overridesToReset.length} overrides to global defaults for ${organization.name}`);
                      } catch (err: any) {
                        toast.error(err?.response?.data?.message || 'Failed to reset overrides');
                      } finally {
                        setIsResettingOverrides(false);
                      }
                    }}
                    className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs gap-1.5 shadow-sm"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset All to Default
                  </Button>
                )}
              </div>
            </div>

            {/* Metric Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 block">Total Capabilities</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                  {orgFlags?.length || 0}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <span className="text-[11px] font-medium text-emerald-700 block">Active for Tenant</span>
                <span className="text-xl font-bold font-mono text-emerald-800 mt-1 block">
                  {activeForTenantCount}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200">
                <span className="text-[11px] font-medium text-purple-700 block">Whitelisted (Early Access)</span>
                <span className="text-xl font-bold font-mono text-purple-800 mt-1 block">
                  {whitelistedCount}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200">
                <span className="text-[11px] font-medium text-rose-700 block">Blacklisted (Denied)</span>
                <span className="text-xl font-bold font-mono text-rose-800 mt-1 block">
                  {blacklistedCount}
                </span>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  placeholder="Search capabilities by name, key, or purpose..."
                  value={featureSearch}
                  onChange={(e) => setFeatureSearch(e.target.value)}
                  className="pl-9 text-xs h-9 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={featureFilter}
                  onChange={(e) => setFeatureFilter(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                >
                  <option value="all">All Capabilities ({orgFlags?.length || 0})</option>
                  <option value="enabled">Active for Tenant ({activeForTenantCount})</option>
                  <option value="disabled">Inactive for Tenant ({(orgFlags?.length || 0) - activeForTenantCount})</option>
                  <option value="overridden">Custom Overrides Only ({overriddenCount})</option>
                </select>
              </div>
            </div>

            {/* Capabilities Table */}
            {isFlagsLoading ? (
              <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                Loading organization feature flight configuration...
              </div>
            ) : filteredOrgFlags.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                <Sliders className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No capabilities match your filter</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing your search query or status filter</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Feature Capability</th>
                      <th className="px-4 py-3">Global Default</th>
                      <th className="px-4 py-3">Tenant Entitlement</th>
                      <th className="px-4 py-3">Evaluation Rule</th>
                      <th className="px-4 py-3 text-right">Organization Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredOrgFlags.map((flag) => {
                      const isOverridden = flag.override !== 'default';
                      return (
                        <tr
                          key={flag.key}
                          className={`transition-colors hover:bg-slate-50/80 ${
                            isOverridden ? 'bg-indigo-50/20' : ''
                          }`}
                        >
                          <td className="px-4 py-3.5 max-w-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{flag.name}</span>
                              {flag.environment && flag.environment !== 'all' && (
                                <Badge className="text-[10px] uppercase bg-blue-50 text-blue-700 border-blue-200">
                                  {flag.environment}
                                </Badge>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                              {flag.key}
                            </div>
                            {flag.description && (
                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                {flag.description}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <Badge
                              className={`text-[10px] uppercase ${
                                flag.globalEnabled
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {flag.globalEnabled ? 'Global On' : 'Global Off'}
                            </Badge>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <Badge
                              className={`text-xs font-medium flex items-center gap-1.5 py-0.5 px-2.5 w-fit ${
                                flag.effectiveEnabled
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {flag.effectiveEnabled ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Active for Tenant
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                  Inactive for Tenant
                                </>
                              )}
                            </Badge>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {flag.override === 'whitelisted' && (
                              <Badge className="text-[11px] bg-purple-100 text-purple-800 border border-purple-200 font-medium">
                                Whitelisted Override
                              </Badge>
                            )}
                            {flag.override === 'blacklisted' && (
                              <Badge className="text-[11px] bg-rose-100 text-rose-800 border border-rose-200 font-medium">
                                Blacklisted Exclusion
                              </Badge>
                            )}
                            {flag.override === 'default' && (
                              <Badge className="text-[11px] bg-slate-100 text-slate-600 border border-slate-200 font-normal">
                                {flag.globalEnabled
                                  ? (flag.rolloutPercentage && flag.rolloutPercentage < 100
                                      ? `Rollout (${flag.rolloutPercentage}%)`
                                      : 'Inherited (Global On)')
                                  : 'Inherited (Global Off)'}
                              </Badge>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <select
                              value={flag.override}
                              disabled={updateFlagOverrideMutation.isPending}
                              onChange={async (e) => {
                                const newOverride = e.target.value as 'whitelisted' | 'blacklisted' | 'default';
                                try {
                                  await updateFlagOverrideMutation.mutateAsync({
                                    orgId: id!,
                                    flagKey: flag.key,
                                    payload: {
                                      override: newOverride,
                                      reason: `Updated from Org 360 Entitlements console`,
                                    },
                                  });
                                  toast.success(`Feature '${flag.name}' set to '${newOverride}' for ${organization.name}`);
                                } catch (err: any) {
                                  toast.error(err?.response?.data?.message || 'Failed to update feature override');
                                }
                              }}
                              className={`border rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm ${
                                flag.override === 'whitelisted'
                                  ? 'bg-purple-50 border-purple-300 text-purple-900 font-semibold'
                                  : flag.override === 'blacklisted'
                                  ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                                  : 'bg-white border-slate-300 text-slate-700'
                              }`}
                            >
                              <option value="default">Default (Inherit Global)</option>
                              <option value="whitelisted">Whitelist (Force Active)</option>
                              <option value="blacklisted">Blacklist (Force Block)</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })()}

      {/* TAB 3: USERS */}
      {activeTab === 'users' && (
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Tenant User Roster ({users.length})
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/super-admin/users')}
              className="border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50"
            >
              Cross-Tenant Directory
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Email Address</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No users enrolled in this organization yet.
                    </td>
                  </tr>
                ) : (
                  users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                      <td className="px-4 py-3 font-mono text-indigo-600">{u.email}</td>
                      <td className="px-4 py-3 capitalize">
                        <Badge className="bg-slate-100 text-slate-700 border border-slate-200">
                          {u.role?.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.department || 'General'}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            u.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }
                        >
                          {u.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/super-admin/users/${u.id}`)}
                          className="text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          User 360°
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: JOURNEYS */}
      {activeTab === 'journeys' && (
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-amber-600" />
              Learning Curricula & Journeys ({journeys.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Journey Title</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {journeys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No journeys created for this tenant yet.
                    </td>
                  </tr>
                ) : (
                  journeys.map((j: any) => (
                    <tr key={j.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{j.title}</td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{j.description || 'N/A'}</td>
                      <td className="px-4 py-3 font-mono">v{j.version || 1}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                          {j.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono">
                        {new Date(j.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/journeys/${j.id}`)}
                          className="text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          View Builder
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 5: BILLING & INVOICES */}
      {activeTab === 'billing' && (
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Tenant Invoices & Receivables ({invoices.length})
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/super-admin/finance/invoices')}
              className="border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50"
            >
              Platform Finance
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No invoices on record for this tenant.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono text-indigo-600 font-semibold">{inv.invoiceNo}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">${inv.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            inv.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono">
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-sm">{inv.description || 'Monthly Subscription'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 6: AUDIT STREAM */}
      {activeTab === 'audit' && (
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" />
              Isolated Tenant Audit Log ({activity.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Append-only immutable record of tenant-level mutations and administrative actions.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {activity.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No audit events logged for this organization.
              </div>
            ) : (
              activity.map((item: any) => (
                <div key={item.id} className="p-4 hover:bg-slate-50/70 transition-colors text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{item.description}</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 text-[10px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                      {item.category || 'System'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                      {item.action || 'Action'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded uppercase ${
                      item.severity === 'critical' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {item.severity}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB 7: DANGER ZONE */}
      {activeTab === 'danger' && (
        <Card className="border border-rose-200 bg-rose-50/30 p-6 space-y-6 rounded-xl">
          <div className="border-b border-rose-200 pb-3">
            <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Emergency Administrative Controls & Danger Zone
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              High-impact operations with irreversible security or operational consequences.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl border border-rose-200 bg-white shadow-sm flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-rose-700 block">Quarantine Organization</span>
                <span className="text-slate-600">
                  Immediately suspends workspace access, revokes tenant user sessions, and puts tenant in cold storage.
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => setShowQuarantineModal(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white shrink-0 text-xs shadow-sm"
              >
                Quarantine Tenant
              </Button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-slate-900 block">Toggle Suspension Status</span>
                <span className="text-slate-600">
                  Currently <span className="font-bold text-slate-900">{organization.status}</span>. Blocks all login attempts when suspended.
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleStatus}
                className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shrink-0 text-xs"
              >
                {organization.status === 'Active' ? 'Suspend Access' : 'Restore Access'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Adjust Quotas Modal Dialog */}
      {showEditQuotaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border border-slate-200 bg-white rounded-2xl p-6 shadow-2xl relative text-slate-900">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-indigo-600" />
              Adjust Organization Quotas
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Modify subscription tier and user capacity for {organization.name}.
            </p>

            <form onSubmit={handleSaveQuotas} className="space-y-4 mt-5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Plan Tier</label>
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                >
                  <option value="Starter">Starter</option>
                  <option value="Growth">Growth</option>
                  <option value="Professional">Professional</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">User Seat Quota</label>
                <input
                  type="number"
                  min="1"
                  value={editSeatLimit}
                  onChange={(e) => setEditSeatLimit(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditQuotaModal(false)}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUpdating}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
                >
                  {isUpdating ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Quarantine Modal Dialog */}
      {showQuarantineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border border-rose-200 bg-white rounded-2xl p-6 shadow-2xl relative text-slate-900">
            <h3 className="text-lg font-bold text-rose-600 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Confirm Tenant Quarantine
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              You are about to quarantine <span className="font-bold text-slate-900">{organization.name}</span>.
              All active users will be locked out and API access suspended.
            </p>

            <form onSubmit={handleQuarantine} className="space-y-4 mt-5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Justification / Incident Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={quarantineReason}
                  onChange={(e) => setQuarantineReason(e.target.value)}
                  placeholder="Security incident, payment default, SLA violation, or breach investigation…"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuarantineModal(false)}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isQuarantining}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-sm"
                >
                  {isQuarantining ? 'Quarantining…' : 'Execute Quarantine'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </SuperAdminShell>
  );
}

export default SuperAdminOrganization360;
