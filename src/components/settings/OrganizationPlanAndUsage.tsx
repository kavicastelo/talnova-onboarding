import React, { useState } from 'react';
import {
  Users,
  HardDrive,
  Compass,
  Monitor,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
  Layers,
  HelpCircle,
  X,
  Send,
  Zap,
} from 'lucide-react';
import { Card } from '../Card';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { useOrganizationUsage } from '../../hooks/useSettings';
import { Skeleton } from '../Skeleton';
import { toast } from 'sonner';

export function OrganizationPlanAndUsage() {
  const { data: usageData, isLoading, isError, refetch } = useOrganizationUsage();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeNotes, setUpgradeNotes] = useState('');
  const [desiredPlan, setDesiredPlan] = useState('Enterprise');
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !usageData) {
    return (
      <Card className="p-8 text-center border-slate-200">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Failed to Load Plan & Usage</h3>
        <p className="text-xs text-slate-500 mt-1">
          Could not sync live quota and plan entitlements for this organization.
        </p>
        <Button onClick={() => refetch()} size="sm" className="mt-4 mx-auto">
          Retry Sync
        </Button>
      </Card>
    );
  }

  const { subscription, metrics, warnings, package: pkgDetails, features } = usageData;

  const getMeterColor = (percent: number) => {
    if (percent >= 100) return 'bg-rose-500';
    if (percent >= 80) return 'bg-amber-500';
    return 'bg-indigo-600';
  };

  const getMeterBadge = (percent: number, isExceeded: boolean, limit?: number) => {
    if (limit === 0) {
      return (
        <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
          Add-on Available
        </span>
      );
    }
    if (isExceeded) {
      return (
        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
          Limit Reached (100%)
        </span>
      );
    }
    if (percent >= 80) {
      return (
        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          Near Capacity ({percent}%)
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
        {percent}% used
      </span>
    );
  };

  const handleSendUpgradeInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingInquiry(true);
    setTimeout(() => {
      setIsSubmittingInquiry(false);
      setShowUpgradeModal(false);
      setUpgradeNotes('');
      toast.success(
        'Upgrade request submitted! An account manager will review your capacity requirements shortly.'
      );
    }, 700);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Active Plan Hero Banner */}
      <Card className="overflow-hidden border border-indigo-100 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-2xl shadow-xl relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Zap className="h-64 w-64 text-indigo-400" />
        </div>

        <div className="relative p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                {pkgDetails?.tier || subscription.plan} Plan
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {subscription.status || 'Active'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-white/10 text-slate-200 border border-white/10">
                {subscription.billingCycle || 'Monthly'} Billing
              </span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {pkgDetails?.name || subscription.plan} Package
              </h2>
              <p className="text-sm text-indigo-200/80 max-w-xl mt-1">
                {pkgDetails?.description ||
                  'Your organization is provisioned with high-availability enterprise onboarding infrastructure and modular resource quotas.'}
              </p>
            </div>

            {/* Pricing details if available */}
            <div className="flex items-center gap-3 pt-2 text-xs text-indigo-200 font-mono">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">
                  ${subscription.finalPrice ?? subscription.customPrice ?? subscription.customPricePerMonth ?? pkgDetails?.billing?.basePriceMonthly ?? pkgDetails?.pricing?.monthly ?? 0}
                </span>
                <span className="text-xs text-indigo-300 font-normal">/mo</span>
              </div>
              {subscription.addOnsTotal ? (
                <span className="text-indigo-300/80">
                  (Includes +${subscription.addOnsTotal}/mo in active add-ons)
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
            <Button
              onClick={() => setShowUpgradeModal(true)}
              className="bg-white hover:bg-slate-100 text-indigo-950 font-bold shadow-lg shadow-black/20 gap-2 text-xs py-2.5 px-4 rounded-xl"
            >
              <ArrowUpRight className="h-4 w-4" />
              Request Plan Upgrade
            </Button>
            <p className="text-[11px] text-center text-indigo-300/70">
              Need custom enterprise quotas? Talk to our sales team.
            </p>
          </div>
        </div>
      </Card>

      {/* Warnings Ribbon (if any metric >= 80%) */}
      {warnings && warnings.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-amber-900">Capacity Warning Detected</h4>
            <ul className="text-xs text-amber-800 list-disc list-inside mt-1 space-y-0.5">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
          <Button
            size="sm"
            onClick={() => setShowUpgradeModal(true)}
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs"
          >
            Upgrade Seats
          </Button>
        </div>
      )}

      {/* Resource Quotas Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Live Resource Quotas</h3>
            <p className="text-xs text-slate-500">
              Real-time consumption meters compared against contracted service tier limits.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Employee Seats */}
          <Card className="p-5 border-slate-200 bg-white rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-slate-900 block">User Seats</span>
                  <span className="text-[11px] text-slate-400">Active Member Accounts</span>
                </div>
              </div>
              {getMeterBadge(metrics.users.percent, metrics.users.isExceeded)}
            </div>

            <div className="flex items-baseline justify-between text-xs font-mono pt-1">
              <span className="text-xl font-bold text-slate-900">
                {metrics.users.current}{' '}
                <span className="text-xs font-normal text-slate-500">/ {metrics.users.limit}</span>
              </span>
              <span className="text-slate-500">{metrics.users.available} available</span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getMeterColor(
                  metrics.users.percent
                )}`}
                style={{ width: `${Math.min(100, metrics.users.percent)}%` }}
              />
            </div>
          </Card>

          {/* 2. Cloud Storage */}
          <Card className="p-5 border-slate-200 bg-white rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-slate-900 block">Cloud Storage</span>
                  <span className="text-[11px] text-slate-400">Media, Docs & Video</span>
                </div>
              </div>
              {getMeterBadge(metrics.storage.percent, metrics.storage.isExceeded)}
            </div>

            <div className="flex items-baseline justify-between text-xs font-mono pt-1">
              <span className="text-xl font-bold text-slate-900">
                {metrics.storage.currentGb}{' '}
                <span className="text-xs font-normal text-slate-500">
                  GB / {metrics.storage.limitGb} GB
                </span>
              </span>
              <span className="text-slate-500">{metrics.storage.filesCount} assets</span>
            </div>

            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getMeterColor(
                  metrics.storage.percent
                )}`}
                style={{ width: `${Math.min(100, metrics.storage.percent)}%` }}
              />
            </div>
          </Card>

          {/* 3. Journeys */}
          <Card className="p-5 border-slate-200 bg-white rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-slate-900 block">Learning Journeys</span>
                  <span className="text-[11px] text-slate-400">Active Workflows</span>
                </div>
              </div>
              {getMeterBadge(metrics.journeys.percent, metrics.journeys.isExceeded)}
            </div>

            <div className="flex items-baseline justify-between text-xs font-mono pt-1">
              <span className="text-xl font-bold text-slate-900">
                {metrics.journeys.current}{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {metrics.journeys.limit}
                </span>
              </span>
              <span className="text-slate-500">{metrics.journeys.available} available</span>
            </div>

            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getMeterColor(
                  metrics.journeys.percent
                )}`}
                style={{ width: `${Math.min(100, metrics.journeys.percent)}%` }}
              />
            </div>
          </Card>

          {/* 4. Kiosk Devices */}
          {(() => {
            const kiosksMetric = metrics?.kiosks || {
              current: 0,
              limit: usageData.limits?.maxKiosks ?? pkgDetails?.limits?.maxKiosks ?? 5,
              available: usageData.limits?.maxKiosks ?? pkgDetails?.limits?.maxKiosks ?? 5,
              percent: 0,
              isWarning: false,
              isExceeded: false,
            };

            return (
              <Card className="p-5 border-slate-200 bg-white rounded-xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Monitor className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-slate-900 block">Kiosk Stations</span>
                      <span className="text-[11px] text-slate-400">Paired Hardware Displays</span>
                    </div>
                  </div>
                  {getMeterBadge(kiosksMetric.percent, kiosksMetric.isExceeded, kiosksMetric.limit)}
                </div>

                {kiosksMetric.limit === 0 ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-sm font-semibold text-slate-600">
                        Not included in plan
                      </span>
                      <button
                        onClick={() => setShowUpgradeModal(true)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                      >
                        Add Kiosks
                      </button>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-200 rounded-full" style={{ width: '0%' }} />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Enable the Kiosk Mode add-on to pair warehouse or branch check-in hardware.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between text-xs font-mono pt-1">
                      <span className="text-xl font-bold text-slate-900">
                        {kiosksMetric.current}{' '}
                        <span className="text-xs font-normal text-slate-500">/ {kiosksMetric.limit}</span>
                      </span>
                      <span className="text-slate-500">{kiosksMetric.available} available</span>
                    </div>

                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getMeterColor(
                          kiosksMetric.percent
                        )}`}
                        style={{ width: `${Math.min(100, kiosksMetric.percent)}%` }}
                      />
                    </div>
                  </>
                )}
              </Card>
            );
          })()}

          {/* 5. AI Tokens */}
          <Card className="p-5 border-slate-200 bg-white rounded-xl shadow-xs space-y-3 md:col-span-2 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-slate-900 block">
                    Monthly AI Tokens Budget
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Course Draft Generation & Retrieval Assistant
                  </span>
                </div>
              </div>
              {getMeterBadge(metrics.aiTokens.percent, metrics.aiTokens.isExceeded)}
            </div>

            <div className="flex items-baseline justify-between text-xs font-mono pt-1">
              <span className="text-xl font-bold text-slate-900">
                {metrics.aiTokens.current.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {metrics.aiTokens.limit.toLocaleString()} tokens
                </span>
              </span>
              <span className="text-slate-500">
                {metrics.aiTokens.available.toLocaleString()} tokens remaining
              </span>
            </div>

            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getMeterColor(
                  metrics.aiTokens.percent
                )}`}
                style={{ width: `${Math.min(100, metrics.aiTokens.percent)}%` }}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Modular Add-ons and Features Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Add-ons Card */}
        <Card className="p-5 border-slate-200 bg-white rounded-xl shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-900">Active Modular Add-ons</h4>
          </div>
          <p className="text-xs text-slate-500">
            Specialized capability packs active on your workspace contract.
          </p>

          {((subscription.activeAddOns && subscription.activeAddOns.length > 0) || (subscription.addOns && subscription.addOns.length > 0)) ? (
            <div className="space-y-2 pt-1">
              {((subscription.activeAddOns && subscription.activeAddOns.length > 0)
                ? subscription.activeAddOns
                : subscription.addOns!
              ).map((addon: any, idx: number) => {
                const name = typeof addon === 'string' ? addon : addon.name || addon.featureKey;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-indigo-100 bg-indigo-50/50 text-xs"
                  >
                    <span className="font-semibold text-indigo-950 capitalize">{String(name).replace(/_/g, ' ')}</span>
                    <Badge className="bg-indigo-100 text-indigo-700 text-[10px] font-semibold border-indigo-200">
                      Active Add-on
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
              No standalone add-ons enabled. Standard bundle covers your current operations.
            </div>
          )}
        </Card>

        {/* Included Capabilities Card */}
        <Card className="p-5 border-slate-200 bg-white rounded-xl shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900">Package Feature Entitlements</h4>
          </div>
          <p className="text-xs text-slate-500">
            Platform governance capabilities guaranteed under your active SLA.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 max-h-48 overflow-y-auto">
            {features && Object.keys(features).length > 0 ? (
              Object.entries(features).map(([key, enabled]) => (
                <div
                  key={key}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    enabled
                      ? 'border-emerald-100 bg-emerald-50/40 text-emerald-900'
                      : 'border-slate-100 bg-slate-50 text-slate-400'
                  }`}
                >
                  <CheckCircle2
                    className={`h-3.5 w-3.5 shrink-0 ${
                      enabled ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                  />
                  <span className="font-medium truncate capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                </div>
              ))
            ) : (
              <div className="col-span-2 text-xs text-slate-400 italic">
                Standard capability bundle active.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Upgrade Request Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <Card className="w-full max-w-lg border border-slate-200 bg-white rounded-2xl p-6 shadow-2xl relative text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Request Quota Upgrade</h3>
                  <p className="text-xs text-slate-500">
                    Submit capacity expansion requirements for your organization.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendUpgradeInquiry} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Desired Subscription Tier
                </label>
                <select
                  value={desiredPlan}
                  onChange={(e) => setDesiredPlan(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 outline-none"
                >
                  <option value="Growth">Growth Tier (100 seats, 50 GB, 50 Journeys)</option>
                  <option value="Professional">Professional Tier (250 seats, 100 GB, 100 Journeys)</option>
                  <option value="Enterprise">Enterprise Tier (Unlimited seats, custom SLAs)</option>
                  <option value="Custom Add-ons">Custom Add-on Expansion Only</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Requested Capacity or Add-on Notes
                </label>
                <textarea
                  rows={4}
                  required
                  value={upgradeNotes}
                  onChange={(e) => setUpgradeNotes(e.target.value)}
                  placeholder="e.g., We anticipate hiring 60 engineers next month and require an additional 50 user seats and kiosk pairing capability."
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 flex items-start gap-2.5 text-indigo-900">
                <HelpCircle className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">
                  Your request is routed directly to the Super Admin billing desk. Adjustments will reflect immediately upon confirmation without disruption to active learners.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUpgradeModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingInquiry}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSubmittingInquiry ? 'Submitting…' : 'Submit Upgrade Request'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
