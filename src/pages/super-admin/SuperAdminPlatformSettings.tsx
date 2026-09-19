import React, { useState, useEffect } from 'react';
import {
  Lock,
  Save,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { toast } from 'sonner';
import { useSuperAdminPlatformSettings, useUpdatePlatformSettings } from '../../hooks/useSuperAdmin';

export function SuperAdminPlatformSettings() {
  const { data: settings, isLoading } = useSuperAdminPlatformSettings();
  const updateSettingsMutation = useUpdatePlatformSettings();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('Talnova Onboarding is undergoing planned infrastructure maintenance.');
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(60);
  const retentionDays = 2555; // 7 years locked by compliance
  const [enforceMfaAdmins, setEnforceMfaAdmins] = useState(true);

  useEffect(() => {
    if (settings) {
      setMaintenanceMode(settings.maintenanceMode ?? false);
      if (settings.maintenanceMessage) setMaintenanceMsg(settings.maintenanceMessage);
      if (settings.sessionTimeoutMinutes) setSessionTimeoutMinutes(settings.sessionTimeoutMinutes);
      if (settings.enforceMfaAdmins !== undefined) setEnforceMfaAdmins(settings.enforceMfaAdmins);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionTimeoutMinutes < 5 || sessionTimeoutMinutes > 1440) {
      toast.error('Session timeout must be between 5 and 1440 minutes.');
      return;
    }

    try {
      await updateSettingsMutation.mutateAsync({
        maintenanceMode,
        maintenanceMessage: maintenanceMsg,
        sessionTimeoutMinutes,
        enforceMfaAdmins,
      });
      toast.success('Platform security & operational settings saved successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save platform settings.');
    }
  };

  return (
    <SuperAdminShell
      title="Platform Settings & Policies"
      description="Global multi-tenant governance policies, maintenance windows, and root authentication timeouts."
    >
      <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
        {/* Maintenance Mode Card */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm rounded-xl">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl border ${
                maintenanceMode
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-slate-900">Platform Maintenance Mode</h4>
                <p className="text-xs text-slate-600 mt-1">
                  When enabled, all non-Super-Admin users are blocked from logging in and presented with the maintenance message.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {maintenanceMode && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Maintenance Broadcast Message
              </label>
              <textarea
                value={maintenanceMsg}
                onChange={(e) => setMaintenanceMsg(e.target.value)}
                rows={2}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          )}
        </Card>

        {/* Security & Authentication Policies */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm rounded-xl">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Lock className="w-5 h-5 text-indigo-600" />
            <h4 className="text-base font-semibold text-slate-900">Security & Authentication Parameters</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Global Session Inactivity Timeout (Minutes)
              </label>
              <input
                type="number"
                value={sessionTimeoutMinutes}
                onChange={(e) => setSessionTimeoutMinutes(parseInt(e.target.value) || 30)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Idle sessions across all tenants are automatically revoked past this window.
              </p>
            </div>

            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Audit Log Retention Window (Days)
              </label>
              <input
                type="number"
                disabled
                value={retentionDays}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-500 cursor-not-allowed"
              />
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                Locked at 2555 days (7 Years) by immutable compliance policy.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Enforce Dual-Factor (MFA) for Tenant Admins</p>
              <p className="text-xs text-slate-500">Require TOTP authentication for all organization admin accounts.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enforceMfaAdmins}
                onChange={(e) => setEnforceMfaAdmins(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={updateSettingsMutation.isPending || isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-sm"
          >
            {updateSettingsMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {updateSettingsMutation.isPending ? 'Saving Policies...' : 'Save Platform Policies'}
          </Button>
        </div>
      </form>
    </SuperAdminShell>
  );
}

export default SuperAdminPlatformSettings;
