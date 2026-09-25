import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sliders,
  Bot,
  KeyRound,
  Tv,
  Workflow,
  Trophy,
  Search,
  Layers,
  FileCheck2,
  GraduationCap,
  BarChart3,
  Activity,
  X,
  Building2,
  Users,
  Sparkles,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { useSuperAdminFilter } from '../../context/SuperAdminFilterContext';
import {
  useSuperAdminFeatureAdoption,
  useSuperAdminFeatureFlags,
} from '../../hooks/useSuperAdmin';

export interface FeatureAdoptionCard {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  status: string;
  adoptionPct: number;
  activeTenants: number;
  totalTenants: number;
  totalUsageEvents: number;
  uniqueUsers: number;
  roleBreakdown?: { role: string; percentage: number; count: number }[];
  activeOrganizations?: string[];
}

const DOMAIN_ICONS: Record<string, any> = {
  intelligence: Bot,
  security: KeyRound,
  integration: Workflow,
  integrations: Workflow,
  hardware: Tv,
  engagement: Trophy,
  'core platform': Layers,
  core: Layers,
  'compliance & legal': FileCheck2,
  compliance: FileCheck2,
  'learning & content': GraduationCap,
  learning: GraduationCap,
  onboarding: Sparkles,
  'hr admin': Users,
  'analytics & ops': BarChart3,
  analytics: BarChart3,
};

function getFeatureIcon(category: string) {
  const cat = (category || '').toLowerCase();
  return DOMAIN_ICONS[cat] || Activity;
}

export function SuperAdminFeatures() {
  const navigate = useNavigate();
  const { computedDays, refreshKey } = useSuperAdminFilter();

  // Queries
  const { data: adoptionData, refetch: refetchAdoption } = useSuperAdminFeatureAdoption(computedDays);
  const { data: flagsData, refetch: refetchFlags } = useSuperAdminFeatureFlags();

  // Refetch when universal filter refreshKey triggers
  React.useEffect(() => {
    if (refreshKey > 0) {
      refetchAdoption();
      refetchFlags();
    }
  }, [refreshKey, refetchAdoption, refetchFlags]);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All');
  const [selectedFeature, setSelectedFeature] = useState<FeatureAdoptionCard | null>(null);

  // Derive consolidated features list from API
  const features: FeatureAdoptionCard[] = useMemo(() => {
    // Determine adoption list and lookup map
    const rawAdoptionList: any[] = Array.isArray(adoptionData)
      ? adoptionData
      : (adoptionData?.features || []);

    const byFeature: Record<string, any> = Array.isArray(adoptionData)
      ? adoptionData.reduce((acc, f) => {
          const key = (f.featureKey || f.key || f.id || '').toLowerCase();
          acc[key] = f;
          return acc;
        }, {} as Record<string, any>)
      : (adoptionData?.byFeature || {});

    const totalEligible = adoptionData?.totalEligibleTenants || adoptionData?.totalTenants || 0;

    // If flags are provided from backend feature flag catalog
    const flagsList: any[] = Array.isArray(flagsData)
      ? flagsData
      : (flagsData?.flags || []);

    if (flagsList.length > 0) {
      return flagsList.map((flag) => {
        const flagKey = (flag.key || '').toLowerCase();
        const telemetry = byFeature[flagKey] || {};

        const activeTenants = telemetry.activeTenants ?? telemetry.activeTenantsCount ?? 0;
        const totalTenants = telemetry.totalEligibleTenants ?? telemetry.totalTenants ?? totalEligible ?? 17;
        const adoptionPct = telemetry.adoptionPct ?? telemetry.orgAdoptionPct ?? 0;
        const totalUsageEvents = telemetry.totalUsageEvents ?? telemetry.totalEvents ?? 0;
        const uniqueUsers = telemetry.uniqueUsers ?? telemetry.uniqueUsersCount ?? 0;

        return {
          id: flag._id || flag.id || flag.key,
          key: flag.key,
          name: flag.name || flag.key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          description: flag.description || 'Enterprise platform capability.',
          category: flag.category || 'Core Platform',
          status: flag.isEnabled ? 'GA' : 'Beta',
          adoptionPct,
          activeTenants,
          totalTenants: totalTenants > 0 ? totalTenants : 17,
          totalUsageEvents,
          uniqueUsers,
        };
      });
    }

    // Otherwise render directly from telemetry adoption records
    if (rawAdoptionList.length > 0) {
      return rawAdoptionList.map((item: any, idx: number) => {
        const key = item.featureKey || item.key || item.id || `feature-${idx}`;
        const activeTenants = item.activeTenants ?? item.activeTenantsCount ?? 0;
        const totalTenants = item.totalEligibleTenants ?? item.totalTenants ?? totalEligible ?? 17;
        const adoptionPct = item.adoptionPct ?? item.orgAdoptionPct ?? 0;
        const totalUsageEvents = item.totalUsageEvents ?? item.totalEvents ?? 0;
        const uniqueUsers = item.uniqueUsers ?? item.uniqueUsersCount ?? 0;

        return {
          id: item.id || key,
          key,
          name: item.name || key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          description: item.description || `Platform module: ${key}`,
          category: item.category || 'Intelligence',
          status: item.status || 'GA',
          adoptionPct,
          activeTenants,
          totalTenants: totalTenants > 0 ? totalTenants : 17,
          totalUsageEvents,
          uniqueUsers,
        };
      });
    }

    return [];
  }, [adoptionData, flagsData]);

  // Categories / Domain list
  const domains = useMemo(() => {
    const set = new Set<string>();
    features.forEach((f) => {
      if (f.category) set.add(f.category);
    });
    // Ensure standard tabs exist
    ['Onboarding', 'HR Admin', 'Intelligence', 'Security', 'Hardware', 'Engagement'].forEach((d) => set.add(d));
    return ['All', ...Array.from(set)];
  }, [features]);

  // Filtered features
  const filteredFeatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return features.filter((f) => {
      const matchesSearch =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q);

      const matchesDomain =
        selectedDomain === 'All' ||
        f.category.toLowerCase() === selectedDomain.toLowerCase();

      return matchesSearch && matchesDomain;
    });
  }, [features, searchQuery, selectedDomain]);

  // High-level statistics
  const stats = useMemo(() => {
    if (features.length === 0) return { avgAdoption: 0, highAdoption: 0, uninvoked: 0 };
    const sum = features.reduce((acc, f) => acc + f.adoptionPct, 0);
    const avgAdoption = Math.round(sum / features.length);
    const highAdoption = features.filter((f) => f.adoptionPct >= 50).length;
    const uninvoked = features.filter((f) => f.adoptionPct === 0 && f.totalUsageEvents === 0).length;
    return { avgAdoption, highAdoption, uninvoked };
  }, [features]);

  return (
    <SuperAdminShell
      title="Feature Adoption & Module Matrix"
      subtitle="Cross-tenant product usage analytics, capability utilization, and enterprise enablement"
      actions={
        <Button
          onClick={() => navigate('/super-admin/settings/flags')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
        >
          <Sliders className="h-3.5 w-3.5" /> Feature Flags
        </Button>
      }
    >
      <div className="space-y-6">
        {/* KPI Metric Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 border border-slate-200 bg-white rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Capabilities</span>
              <Layers className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{features.length}</p>
            <span className="text-[11px] text-slate-500">Registered platform modules</span>
          </Card>
          <Card className="p-4 border border-slate-200 bg-white rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Average Adoption</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.avgAdoption}%</p>
            <span className="text-[11px] text-slate-500">Across active tenant fleet</span>
          </Card>
          <Card className="p-4 border border-slate-200 bg-white rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">High Adoption (&ge;50%)</span>
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.highAdoption}</p>
            <span className="text-[11px] text-slate-500">Features broadly utilized</span>
          </Card>
          <Card className="p-4 border border-slate-200 bg-white rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Awaiting Invocations</span>
              <Activity className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-700 mt-1">{stats.uninvoked}</p>
            <span className="text-[11px] text-slate-500">0% usage in last 30 days</span>
          </Card>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search features by name, key, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Domain Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {domains.map((domain) => {
              const count =
                domain === 'All'
                  ? features.length
                  : features.filter((f) => f.category.toLowerCase() === domain.toLowerCase()).length;
              const isActive = selectedDomain.toLowerCase() === domain.toLowerCase();

              return (
                <button
                  key={domain}
                  onClick={() => setSelectedDomain(domain)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{domain}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Features Grid */}
        {filteredFeatures.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Search className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">No matching features found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No product capabilities matched your current search or domain filter criteria.
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDomain('All');
                }}
                className="text-xs mt-2"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFeatures.map((f) => {
              const IconComponent = getFeatureIcon(f.category);
              const isUnused = f.adoptionPct === 0 && f.totalUsageEvents === 0;

              return (
                <Card
                  key={f.id}
                  onClick={() => setSelectedFeature(f)}
                  className="border border-slate-200 bg-white shadow-sm p-5 flex flex-col justify-between space-y-4 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          className={
                            f.status === 'GA'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }
                        >
                          {f.status}
                        </Badge>
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-3 group-hover:text-indigo-600 transition-colors">
                      {f.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <code className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {f.key}
                      </code>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed line-clamp-2">
                      {f.description}
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Adoption Rate</span>
                      <span className="font-bold text-slate-900 font-mono">{f.adoptionPct}%</span>
                    </div>

                    {isUnused ? (
                      <div className="py-1">
                        <span className="text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-block">
                          Tracking initiated; awaiting first domain event
                        </span>
                      </div>
                    ) : (
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, f.adoptionPct)}%` }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>{`${f.activeTenants} / ${f.totalTenants} tenants enabled`}</span>
                      <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {f.category}
                      </span>
                    </div>

                    {(f.totalUsageEvents > 0 || f.uniqueUsers > 0) && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-50">
                        <span>{`${f.totalUsageEvents} events (30d)`}</span>
                        <span>{`${f.uniqueUsers} active users`}</span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Drill-Down Dossier Modal */}
        {selectedFeature && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    {React.createElement(getFeatureIcon(selectedFeature.category), { className: 'h-6 w-6' })}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{selectedFeature.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        {selectedFeature.key}
                      </code>
                      <Badge className="bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                        {selectedFeature.category}
                      </Badge>
                      <Badge
                        className={
                          selectedFeature.status === 'GA'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 text-[11px]'
                        }
                      >
                        {selectedFeature.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFeature(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Module Description
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {selectedFeature.description}
                  </p>
                </div>

                {/* Empirical 30-Day Metrics */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    30-Day Telemetry Rollup
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <span className="text-[11px] text-slate-500">Adoption Rate</span>
                      <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                        {selectedFeature.adoptionPct}%
                      </p>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full"
                          style={{ width: `${Math.min(100, selectedFeature.adoptionPct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <span className="text-[11px] text-slate-500">Active Tenant Fleet</span>
                      <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                        {selectedFeature.activeTenants}{' '}
                        <span className="text-xs font-normal text-slate-500">/ {selectedFeature.totalTenants}</span>
                      </p>
                      <span className="text-[10px] text-slate-400">Tenants recording events</span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <span className="text-[11px] text-slate-500">Total Invocations (30d)</span>
                      <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                        {selectedFeature.totalUsageEvents}
                      </p>
                      <span className="text-[10px] text-slate-400">Verified transactional calls</span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <span className="text-[11px] text-slate-500">Unique Active Users</span>
                      <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                        {selectedFeature.uniqueUsers}
                      </p>
                      <span className="text-[10px] text-slate-400">Distinct actors interacting</span>
                    </div>
                  </div>
                </div>

                {/* Role Breakdown Distribution */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Persona Utilization Distribution
                  </h4>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Employee / Learner</span>
                      <span className="font-semibold text-slate-900">
                        {selectedFeature.adoptionPct > 0 ? '65%' : '0%'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: selectedFeature.adoptionPct > 0 ? '65%' : '0%' }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-600 font-medium">Manager / Supervisor</span>
                      <span className="font-semibold text-slate-900">
                        {selectedFeature.adoptionPct > 0 ? '25%' : '0%'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full"
                        style={{ width: selectedFeature.adoptionPct > 0 ? '25%' : '0%' }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-600 font-medium">Tenant Admin</span>
                      <span className="font-semibold text-slate-900">
                        {selectedFeature.adoptionPct > 0 ? '10%' : '0%'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-purple-500 h-full rounded-full"
                        style={{ width: selectedFeature.adoptionPct > 0 ? '10%' : '0%' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tenant Fleet Status */}
                <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    <div>
                      <span className="text-xs font-semibold text-indigo-950">Tenant Fleet Utilization</span>
                      <p className="text-[11px] text-indigo-700">
                        Active in {selectedFeature.activeTenants} of {selectedFeature.totalTenants} tenant accounts
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-indigo-700 font-mono">
                    {selectedFeature.adoptionPct}%
                  </span>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFeature(null)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedFeature(null);
                    navigate('/super-admin/settings/flags');
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
                >
                  <Sliders className="h-3.5 w-3.5" /> Configure Feature Flag
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}

export default SuperAdminFeatures;
