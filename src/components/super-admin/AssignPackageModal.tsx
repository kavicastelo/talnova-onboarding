import React, { useState, useEffect } from 'react';
import { Package, X, Sliders } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { toast } from 'sonner';
import {
  useSuperAdminPackages,
  useAssignOrganizationPackage,
} from '../../hooks/useSuperAdmin';

export interface AssignPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: {
    id?: string;
    _id?: string;
    slug?: string;
    name: string;
    plan?: string;
    packageId?: string;
    subscription?: {
      plan?: string;
      packageName?: string;
      seatLimit?: number;
      packageId?: string;
      billingInterval?: 'monthly' | 'annual';
      customPrice?: number;
      activeAddOns?: string[];
      addOns?: any[];
      basePrice?: number;
      finalPrice?: number;
      addOnsTotal?: number;
    };
    limits?: {
      maxUsers?: number;
      maxStorageGb?: number;
      maxJourneys?: number;
      maxKiosks?: number;
      aiTokenMonthlyLimit?: number;
    };
  } | null;
  onSuccess?: () => void;
}

export function AssignPackageModal({
  isOpen,
  onClose,
  organization,
  onSuccess,
}: AssignPackageModalProps) {
  const { data: packagesData, isLoading: isLoadingPackages } = useSuperAdminPackages();
  const assignPackageMutation = useAssignOrganizationPackage();

  const packagesList = packagesData?.packages || [];

  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [showLimitOverrides, setShowLimitOverrides] = useState(false);
  const [customMaxUsers, setCustomMaxUsers] = useState<number | ''>('');
  const [customMaxStorageGb, setCustomMaxStorageGb] = useState<number | ''>('');
  const [customMaxJourneys, setCustomMaxJourneys] = useState<number | ''>('');
  const [customMaxKiosks, setCustomMaxKiosks] = useState<number | ''>('');
  const [customAiTokens, setCustomAiTokens] = useState<number | ''>('');
  const [contractReason, setContractReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize modal state whenever organization or packages change
  useEffect(() => {
    if (!isOpen || !organization) return;

    const currentPkgId =
      organization.packageId ||
      organization.subscription?.packageId ||
      (packagesList.length > 0 ? packagesList[0].id : '');

    // Match by ID or name/slug
    const matchedPkg = packagesList.find(
      (p) =>
        p.id === currentPkgId ||
        p.slug?.toLowerCase() === organization.plan?.toLowerCase() ||
        p.name?.toLowerCase() === organization.plan?.toLowerCase()
    );

    setSelectedPackageId(matchedPkg ? matchedPkg.id : packagesList[0]?.id || '');
    setBillingInterval(organization.subscription?.billingInterval || 'monthly');
    const rawAddOns = organization.subscription?.activeAddOns || organization.subscription?.addOns || [];
    const normalizedAddOns = Array.isArray(rawAddOns)
      ? rawAddOns.map((a: any) => (typeof a === 'string' ? a : a.featureKey || a.key)).filter(Boolean)
      : [];
    setSelectedAddOns(normalizedAddOns);

    if (organization.subscription?.customPrice != null) {
      setIsCustomPrice(true);
      setCustomPriceInput(String(organization.subscription.customPrice));
    } else {
      setIsCustomPrice(false);
      setCustomPriceInput('');
    }

    setCustomMaxUsers(organization.limits?.maxUsers ?? '');
    setCustomMaxStorageGb(organization.limits?.maxStorageGb ?? '');
    setCustomMaxJourneys(organization.limits?.maxJourneys ?? '');
    setCustomMaxKiosks(organization.limits?.maxKiosks ?? '');
    setCustomAiTokens(organization.limits?.aiTokenMonthlyLimit ?? '');
    setContractReason('');
    setShowLimitOverrides(false);
  }, [isOpen, organization, packagesList]);

  if (!isOpen || !organization) return null;

  const activePackage = packagesList.find((p) => p.id === selectedPackageId);

  const basePrice = activePackage
    ? billingInterval === 'annual'
      ? activePackage.billing.basePriceAnnual
      : activePackage.billing.basePriceMonthly
    : 0;

  let addOnsTotal = 0;
  if (activePackage) {
    selectedAddOns.forEach((featKey) => {
      const feat = activePackage.features.find((f) => f.featureKey === featKey);
      if (feat) {
        addOnsTotal +=
          billingInterval === 'annual'
            ? feat.addOnPriceAnnual || (feat.addOnPriceMonthly || 0) * 10
            : feat.addOnPriceMonthly || 0;
      }
    });
  }

  const calculatedTotal = basePrice + addOnsTotal;
  const finalPrice =
    isCustomPrice && customPriceInput !== '' && !isNaN(parseFloat(customPriceInput))
      ? parseFloat(customPriceInput)
      : calculatedTotal;

  const availableAddOns = activePackage?.features.filter((f) => f.isAddOn) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) {
      toast.error('No organization selected');
      return;
    }

    const targetOrgId = organization.id || organization._id || organization.slug;
    if (!targetOrgId || targetOrgId === 'undefined') {
      toast.error('Organization ID is missing');
      return;
    }

    if (!selectedPackageId) {
      toast.error('Please select a target package');
      return;
    }

    setIsSubmitting(true);
    try {
      const customLimitsPayload: Record<string, number> = {};
      if (customMaxUsers !== '') customLimitsPayload.maxUsers = Number(customMaxUsers);
      if (customMaxStorageGb !== '') customLimitsPayload.maxStorageGb = Number(customMaxStorageGb);
      if (customMaxJourneys !== '') customLimitsPayload.maxJourneys = Number(customMaxJourneys);
      if (customMaxKiosks !== '') customLimitsPayload.maxKiosks = Number(customMaxKiosks);
      if (customAiTokens !== '') customLimitsPayload.aiTokenMonthlyLimit = Number(customAiTokens);

      const payloadData = {
        packageId: selectedPackageId,
        billingInterval,
        activeAddOns: selectedAddOns,
        addOns: selectedAddOns,
        customPrice: isCustomPrice && customPriceInput !== '' ? parseFloat(customPriceInput) : undefined,
        customLimits: Object.keys(customLimitsPayload).length > 0 ? customLimitsPayload : undefined,
        reason: contractReason || undefined,
      };

      await assignPackageMutation.mutateAsync({
        orgId: targetOrgId,
        id: targetOrgId,
        payload: payloadData,
        data: payloadData,
      });

      toast.success(
        `Assigned "${activePackage?.name || 'Package'}" to ${organization.name} successfully.`
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to assign package.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
      <Card className="w-full max-w-xl border border-slate-200 bg-white rounded-2xl p-6 shadow-2xl relative text-slate-900 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-bold">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Assign Package & Add-ons</h3>
              <p className="text-xs text-slate-500">
                Configure plan, modular add-on entitlements, and custom contract overrides for{' '}
                <span className="font-semibold text-slate-800">{organization.name}</span>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoadingPackages ? (
          <div className="py-12 text-center text-sm text-slate-500 animate-pulse">
            Loading modular packages & templates…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
            {/* Package & Billing Interval Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Package Template *
                </label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => {
                    setSelectedPackageId(e.target.value);
                    setSelectedAddOns([]);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium"
                >
                  {packagesList.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.tier}) —{' '}
                      {pkg.billing.basePriceMonthly === 0 ? 'Free' : `$${pkg.billing.basePriceMonthly}/mo`}
                    </option>
                  ))}
                </select>
                {activePackage && (
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {activePackage.description || 'Pre-configured tier with modular capability entitlements.'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Billing Frequency
                </label>
                <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 h-9">
                  <button
                    type="button"
                    onClick={() => setBillingInterval('monthly')}
                    className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                      billingInterval === 'monthly'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingInterval('annual')}
                    className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                      billingInterval === 'annual'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Annual (-17%)
                  </button>
                </div>
              </div>
            </div>

            {/* Modular Add-ons Selector */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 block text-xs">
                  Modular Add-on Modules ({availableAddOns.length} available)
                </span>
                <span className="text-[11px] text-indigo-600 font-medium">
                  {selectedAddOns.length} selected
                </span>
              </div>
              {availableAddOns.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">
                  No optional add-ons configured for this package. All features are bundled in the base tier.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {availableAddOns.map((addon) => {
                    const isChecked = selectedAddOns.includes(addon.featureKey);
                    const addOnPrice =
                      billingInterval === 'annual'
                        ? addon.addOnPriceAnnual || (addon.addOnPriceMonthly || 0) * 10
                        : addon.addOnPriceMonthly || 0;
                    return (
                      <label
                        key={addon.featureKey}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedAddOns((prev) =>
                                prev.includes(addon.featureKey)
                                  ? prev.filter((k) => k !== addon.featureKey)
                                  : [...prev, addon.featureKey]
                              );
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <div>
                            <span className="font-semibold block">{addon.name}</span>
                            <span className="text-[10px] text-slate-500 capitalize">{addon.module} module</span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-indigo-600">
                          +${addOnPrice}/{billingInterval === 'annual' ? 'yr' : 'mo'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Hybrid Pricing Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-slate-600">
                <span>Base Tier Price:</span>
                <span className="font-mono font-medium">
                  ${basePrice}/{billingInterval === 'annual' ? 'yr' : 'mo'}
                </span>
              </div>
              {addOnsTotal > 0 && (
                <div className="flex items-center justify-between text-indigo-600">
                  <span>Add-ons ({selectedAddOns.length}):</span>
                  <span className="font-mono font-medium">
                    +${addOnsTotal}/{billingInterval === 'annual' ? 'yr' : 'mo'}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Calculated Hybrid Rate:</span>
                <span className="font-mono text-indigo-600">
                  ${calculatedTotal}/{billingInterval === 'annual' ? 'yr' : 'mo'}
                </span>
              </div>

              {/* Negotiated Override */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCustomPrice}
                    onChange={(e) => setIsCustomPrice(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-slate-900">
                    Apply bespoke contract price override (VIP / Enterprise)
                  </span>
                </label>
                {isCustomPrice && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={customPriceInput}
                      onChange={(e) => setCustomPriceInput(e.target.value)}
                      placeholder={`${calculatedTotal}`}
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-indigo-500 outline-none"
                    />
                    <span className="text-slate-500 font-mono">
                      /{billingInterval === 'annual' ? 'yr' : 'mo'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Limit Overrides Accordion */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowLimitOverrides(!showLimitOverrides)}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left text-xs font-semibold text-slate-800"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Custom Resource Quota Overrides (Optional)</span>
                </div>
                <span className="text-indigo-600 text-[11px]">
                  {showLimitOverrides ? 'Collapse ▲' : 'Expand ▼'}
                </span>
              </button>

              {showLimitOverrides && (
                <div className="p-3.5 bg-white space-y-3 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Max Users / Seats</label>
                    <input
                      type="number"
                      min="1"
                      value={customMaxUsers}
                      onChange={(e) => setCustomMaxUsers(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={String(activePackage?.limits.maxUsers || 50)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Max Storage (GB)</label>
                    <input
                      type="number"
                      min="1"
                      value={customMaxStorageGb}
                      onChange={(e) => setCustomMaxStorageGb(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={String(activePackage?.limits.maxStorageGb || 10)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Max Journeys</label>
                    <input
                      type="number"
                      min="1"
                      value={customMaxJourneys}
                      onChange={(e) => setCustomMaxJourneys(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={String(activePackage?.limits.maxJourneys || 20)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Max Kiosks</label>
                    <input
                      type="number"
                      min="0"
                      value={customMaxKiosks}
                      onChange={(e) => setCustomMaxKiosks(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={String(activePackage?.limits.maxKiosks || 5)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-slate-600 mb-1 font-medium">Monthly AI Token Limit</label>
                    <input
                      type="number"
                      min="0"
                      step="10000"
                      value={customAiTokens}
                      onChange={(e) => setCustomAiTokens(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={String(activePackage?.limits.aiTokenMonthlyLimit || 500000)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Audit Justification */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Contract Reason / Audit Note (Optional)
              </label>
              <input
                type="text"
                value={contractReason}
                onChange={(e) => setContractReason(e.target.value)}
                placeholder="e.g., Client assigned custom package via Super Admin Organizations tab"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 outline-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
              >
                {isSubmitting
                  ? 'Applying Entitlements…'
                  : `Confirm & Assign (${finalPrice > 0 ? `$${finalPrice}` : 'Free'})`}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
