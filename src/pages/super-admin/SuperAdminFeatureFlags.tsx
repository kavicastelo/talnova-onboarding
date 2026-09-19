
import {
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  RefreshCw,
  Sliders
} from 'lucide-react';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { useSuperAdminFeatureFlags, useToggleFeatureFlag } from '../../hooks/useSuperAdmin';
import { toast } from 'sonner';

export function SuperAdminFeatureFlags() {
  const { data: flags, isLoading, isError } = useSuperAdminFeatureFlags();
  const toggleMutation = useToggleFeatureFlag();

  const handleToggle = async (key: string, currentEnabled: boolean, rolloutPct: number) => {
    try {
      await toggleMutation.mutateAsync({
        key,
        data: { enabled: !currentEnabled, rolloutPct }
      });
      toast.success(`Feature flag '${key}' updated to ${!currentEnabled ? 'Enabled' : 'Disabled'}`);
    } catch (err: any) {
      toast.error('Failed to toggle feature flag');
    }
  };

  const handleRolloutChange = async (key: string, enabled: boolean, newPct: number) => {
    try {
      await toggleMutation.mutateAsync({
        key,
        data: { enabled, rolloutPct: newPct }
      });
      toast.success(`Rollout percentage for '${key}' set to ${newPct}%`);
    } catch (err: any) {
      toast.error('Failed to update rollout percentage');
    }
  };

  return (
    <SuperAdminShell
      title="Platform Feature Flags & Flight Control"
      description="Global multi-tenant kill switches, progressive rollouts, and runtime feature gates."
    >
      <div className="space-y-6">
        {/* Warning Banner */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-semibold text-amber-800">Global Flight Control Notice:</span> Toggling feature flags here impacts all active tenant organizations simultaneously. Disabling an active feature immediately restricts tenant access and logs a high-severity security audit event.
          </div>
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
            {flags?.map((flag: any) => (
              <Card
                key={flag.key}
                className="p-5 bg-white border border-slate-200 hover:border-slate-300 shadow-sm rounded-xl transition-all"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl border ${
                      flag.enabled
                        ? 'bg-indigo-50 border-indigo-100 text-indigo-600'
                        : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}>
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-slate-900">{flag.name}</h4>
                        <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {flag.key}
                        </span>
                        <Badge
                          className={`text-[10px] font-mono uppercase ${
                            flag.enabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {flag.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{flag.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 self-end md:self-center">
                    {/* Rollout Percentage */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-600 font-medium">Rollout:</span>
                      <select
                        value={flag.rolloutPct ?? 100}
                        onChange={(e) => handleRolloutChange(flag.key, flag.enabled, parseInt(e.target.value))}
                        disabled={!flag.enabled || toggleMutation.isPending}
                        className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-900 text-xs disabled:opacity-40 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="10">10% Canary</option>
                        <option value="25">25% Beta</option>
                        <option value="50">50% Half</option>
                        <option value="100">100% General</option>
                      </select>
                    </div>

                    {/* Toggle Button */}
                    <Button
                      variant={flag.enabled ? 'default' : 'outline'}
                      size="sm"
                      disabled={toggleMutation.isPending}
                      onClick={() => handleToggle(flag.key, flag.enabled, flag.rolloutPct ?? 100)}
                      className={`flex items-center gap-2 shadow-sm ${
                        flag.enabled
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {flag.enabled ? (
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
            ))}
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}

export default SuperAdminFeatureFlags;
