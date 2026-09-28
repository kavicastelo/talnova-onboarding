import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  CheckCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  Shuffle,
  Sparkles,
  Package,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../Button';
import { toast } from 'sonner';
import { useCreateOrganization, useSuperAdminPackages } from '../../hooks/useSuperAdmin';
import { PackageItem } from '../../services/superAdmin.service';

export interface TenantProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function TenantProvisionModal({
  isOpen,
  onClose,
  onCreated,
}: TenantProvisionModalProps) {
  const createOrgMutation = useCreateOrganization();
  const { data: packagesData, isLoading: packagesLoading } = useSuperAdminPackages();
  const packages: PackageItem[] = packagesData?.packages || [];

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [customPriceInput, setCustomPriceInput] = useState('');

  const [passwordMode, setPasswordMode] = useState<'auto' | 'custom'>('auto');
  const [customPassword, setCustomPassword] = useState('');
  const [autoPassword, setAutoPassword] = useState(() => generateSecurePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);

  // Initialize selected package once loaded
  useEffect(() => {
    if (packages.length > 0 && !selectedPackageId) {
      const defaultPkg = packages.find((p) => p.isDefault) || packages[0];
      if (defaultPkg) {
        setSelectedPackageId(defaultPkg.id || (defaultPkg as any)._id);
      }
    }
  }, [packages, selectedPackageId]);

  const activePackage = useMemo(() => {
    return packages.find((p) => (p.id || (p as any)._id) === selectedPackageId);
  }, [packages, selectedPackageId]);

  // Available add-ons for the selected package (or all add-ons from package)
  const availableAddOns = useMemo(() => {
    if (!activePackage) return [];
    return activePackage.features.filter((f) => f.isAddOn);
  }, [activePackage]);

  // Hybrid pricing calculation
  const { basePrice, addOnsTotal, calculatedTotal, finalPrice } = useMemo(() => {
    if (!activePackage) {
      return { basePrice: 0, addOnsTotal: 0, calculatedTotal: 0, finalPrice: 0 };
    }
    const base = billingInterval === 'annual' ? activePackage.billing.basePriceAnnual : activePackage.billing.basePriceMonthly;
    let addOns = 0;
    selectedAddOns.forEach((featKey) => {
      const feat = activePackage.features.find((f) => f.featureKey === featKey);
      if (feat) {
        addOns += billingInterval === 'annual' ? (feat.addOnPriceAnnual || (feat.addOnPriceMonthly || 0) * 10) : (feat.addOnPriceMonthly || 0);
      }
    });
    const calc = base + addOns;
    const custom = useCustomPrice && customPriceInput !== '' && !isNaN(parseFloat(customPriceInput))
      ? parseFloat(customPriceInput)
      : calc;
    return {
      basePrice: base,
      addOnsTotal: addOns,
      calculatedTotal: calc,
      finalPrice: custom,
    };
  }, [activePackage, billingInterval, selectedAddOns, useCustomPrice, customPriceInput]);

  // Success State
  const [provisionedData, setProvisionedData] = useState<{
    name: string;
    slug: string;
    plan: string;
    credentials: {
      email: string;
      temporaryPassword: string;
      activationUrl: string;
      mustChangePassword: boolean;
      emailDispatched: boolean;
    };
  } | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  function generateSecurePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Talnova-${code}!26`;
  }

  const handleNameChange = (val: string) => {
    setName(val);
    const autoSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setSlug(autoSlug);
  };

  const handleRegeneratePassword = () => {
    const next = generateSecurePassword();
    setAutoPassword(next);
    toast.success('Generated new secure temporary password');
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAllCredentials = () => {
    if (!provisionedData) return;
    const creds = provisionedData.credentials;
    const summary = [
      `--- TALNOVA TENANT WORKSPACE CREDENTIALS ---`,
      `Workspace Name: ${provisionedData.name}`,
      `Workspace URL: https://${provisionedData.slug}.talnova.com`,
      `Login Email: ${creds.email}`,
      `Temporary Password: ${creds.temporaryPassword}`,
      `One-Click Activation Link: ${creds.activationUrl}`,
      `First-Login Password Reset: ${creds.mustChangePassword ? 'Required' : 'Optional'}`,
      `--------------------------------------------`,
    ].join('\n');

    copyToClipboard(summary, 'All credentials');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !email.trim()) {
      toast.error('Please complete all required fields.');
      return;
    }

    const selectedPassword = passwordMode === 'custom' ? customPassword.trim() : autoPassword;

    if (passwordMode === 'custom' && selectedPassword.length < 8) {
      toast.error('Custom password must be at least 8 characters long.');
      return;
    }

    try {
      const finalPriceValue = useCustomPrice && customPriceInput !== '' && !isNaN(parseFloat(customPriceInput))
        ? parseFloat(customPriceInput)
        : undefined;

      const result: any = await createOrgMutation.mutateAsync({
        name: name.trim(),
        slug: slug.trim(),
        domain: slug.trim(),
        adminEmail: email.trim(),
        supportEmail: email.trim(),
        plan: (activePackage?.name || 'Enterprise') as any,
        packageId: activePackage?.id || (activePackage as any)?._id,
        activeAddOns: selectedAddOns,
        customPrice: finalPriceValue,
        billingInterval,
        initialPassword: selectedPassword,
        sendWelcomeEmail,
        requirePasswordChange,
      });

      const creds = result.credentials || {
        email: email.trim(),
        temporaryPassword: selectedPassword,
        activationUrl: `http://localhost:5173/login`,
        mustChangePassword: requirePasswordChange,
        emailDispatched: sendWelcomeEmail,
      };

      const planSummary = activePackage
        ? `${activePackage.name} (${billingInterval === 'annual' ? `$${finalPrice}/yr` : `$${finalPrice}/mo`})`
        : 'Enterprise';

      setProvisionedData({
        name: result.name || name.trim(),
        slug: result.slug || slug.trim(),
        plan: planSummary,
        credentials: creds,
      });

      toast.success(`Tenant "${name.trim()}" provisioned successfully.`);
      if (onCreated) onCreated();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to provision tenant.');
    }
  };

  const handleClose = () => {
    // Reset all form states
    setName('');
    setSlug('');
    setEmail('');
    setSelectedAddOns([]);
    setIsCustomizing(false);
    setUseCustomPrice(false);
    setCustomPriceInput('');
    setBillingInterval('monthly');
    setPasswordMode('auto');
    setCustomPassword('');
    setAutoPassword(generateSecurePassword());
    setShowPassword(false);
    setSendWelcomeEmail(true);
    setRequirePasswordChange(true);
    setProvisionedData(null);
    setCopiedField(null);
    onClose();
  };

  const handleToggleAddOn = (featureKey: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(featureKey) ? prev.filter((k) => k !== featureKey) : [...prev, featureKey]
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn"
      id="tenant-provision-modal"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {provisionedData ? 'Tenant Provisioned Successfully' : 'Provision New Tenant Workspace'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {provisionedData
                  ? 'Secure credentials generated and ready for hand-off'
                  : 'Deploy isolated workspace environment & modular package assignment'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[82vh] overflow-y-auto">
          {provisionedData ? (
            /* SUCCESS & CREDENTIALS HAND-OFF VIEW */
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold block">Workspace is Live & Ready</span>
                  <span>{provisionedData.name} ({provisionedData.plan})</span>
                </div>
              </div>

              {/* Credentials Card */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    Access & Credentials
                  </span>
                  <button
                    onClick={handleCopyAllCredentials}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center gap-1"
                  >
                    {copiedField === 'All credentials' ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy All Credentials
                      </>
                    )}
                  </button>
                </div>

                {/* Workspace Slug / URL */}
                <div>
                  <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Workspace Identifier / Slug
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200">
                      {provisionedData.slug}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(provisionedData.slug, 'Workspace slug')}
                      className="px-2.5 h-8 text-xs border-slate-200 dark:border-slate-700"
                    >
                      {copiedField === 'Workspace slug' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Admin Email */}
                <div>
                  <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Owner Login Email
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200">
                      {provisionedData.credentials.email}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(provisionedData.credentials.email, 'Admin email')}
                      className="px-2.5 h-8 text-xs border-slate-200 dark:border-slate-700"
                    >
                      {copiedField === 'Admin email' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Temporary Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Temporary Initial Password
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showPassword ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/40 font-mono text-xs font-bold text-amber-900 dark:text-amber-200">
                      {showPassword ? provisionedData.credentials.temporaryPassword : '••••••••••••••••'}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(provisionedData.credentials.temporaryPassword, 'Password')}
                      className="px-2.5 h-8 text-xs border-slate-200 dark:border-slate-700"
                    >
                      {copiedField === 'Password' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* One-Click Activation Link */}
                <div>
                  <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    One-Click Workspace Activation Link
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={provisionedData.credentials.activationUrl}
                      className="flex-1 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-600 dark:text-slate-300 outline-none select-all"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(provisionedData.credentials.activationUrl, 'Activation link')}
                      className="px-2.5 h-8 text-xs border-slate-200 dark:border-slate-700"
                    >
                      {copiedField === 'Activation link' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Security & Email Status Notices */}
              <div className="space-y-2 text-xs">
                {provisionedData.credentials.emailDispatched ? (
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <span>Welcome email with activation instructions dispatched to {provisionedData.credentials.email}.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <span>Email notification was disabled for this provisioning.</span>
                  </div>
                )}

                {provisionedData.credentials.mustChangePassword && (
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Lock className="h-4 w-4 flex-shrink-0" />
                    <span>User will be forced to change this temporary password upon first sign-in.</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-5 py-2.5 shadow-sm"
                >
                  Done & Return to Overview
                </Button>
              </div>
            </div>
          ) : (
            /* PROVISIONING FORM */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Acme Global Corporation"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Workspace URL Slug *
                  </label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''))}
                    placeholder="acme-global"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Assigned Package Plan *
                  </label>
                  <select
                    value={selectedPackageId}
                    onChange={(e) => {
                      setSelectedPackageId(e.target.value);
                      setSelectedAddOns([]);
                    }}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    {packagesLoading ? (
                      <option value="">Loading dynamic packages...</option>
                    ) : packages.length === 0 ? (
                      <>
                        <option value="freemium">Freemium Community ($0/mo)</option>
                        <option value="growth">Growth Suite ($149/mo)</option>
                        <option value="enterprise">All-in-One Enterprise ($499/mo)</option>
                      </>
                    ) : (
                      packages.map((pkg) => (
                        <option key={pkg.id || (pkg as any)._id} value={pkg.id || (pkg as any)._id}>
                          {pkg.name} ({pkg.billing.basePriceMonthly === 0 ? 'Free' : `$${pkg.billing.basePriceMonthly}/mo`})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Package Details & Customization Drawer */}
              {activePackage && (
                <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {activePackage.name}
                      </span>
                      {activePackage.badge && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                          {activePackage.badge}
                        </span>
                      )}
                    </div>
                    {/* Billing Interval Toggle */}
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900 text-xs">
                      <button
                        type="button"
                        onClick={() => setBillingInterval('monthly')}
                        className={`px-2 py-0.5 rounded-md transition-colors text-[11px] font-medium ${
                          billingInterval === 'monthly'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingInterval('annual')}
                        className={`px-2 py-0.5 rounded-md transition-colors text-[11px] font-medium ${
                          billingInterval === 'annual'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Annual (-17%)
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {activePackage.description}
                  </p>

                  {/* Included Core Features Summary */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activePackage.features
                      .filter((f) => f.enabled && !f.isAddOn)
                      .slice(0, 5)
                      .map((feat) => (
                        <span
                          key={feat.featureKey}
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60"
                        >
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          {feat.name}
                        </span>
                      ))}
                    {activePackage.features.filter((f) => f.enabled && !f.isAddOn).length > 5 && (
                      <span className="text-[10px] text-slate-500 self-center">
                        +{activePackage.features.filter((f) => f.enabled && !f.isAddOn).length - 5} more included
                      </span>
                    )}
                  </div>

                  {/* Expand Add-ons & Custom Pricing */}
                  <div className="pt-2 border-t border-indigo-100/80 dark:border-indigo-900/40">
                    <button
                      type="button"
                      onClick={() => setIsCustomizing(!isCustomizing)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sliders className="h-3.5 w-3.5" />
                        Customize Add-ons & Negotiated Pricing
                        {selectedAddOns.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px]">
                            {selectedAddOns.length} active
                          </span>
                        )}
                      </span>
                      {isCustomizing ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {isCustomizing && (
                      <div className="mt-3 pt-3 border-t border-indigo-100/60 dark:border-indigo-900/30 space-y-3 animate-fadeIn">
                        {availableAddOns.length === 0 ? (
                          <p className="text-[11px] text-slate-500 italic">
                            No optional add-on modules configured for this package. All features are currently included or unassigned.
                          </p>
                        ) : (
                          <div>
                            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                              Select Modular Add-on Features:
                            </span>
                            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                              {availableAddOns.map((addon) => {
                                const isChecked = selectedAddOns.includes(addon.featureKey);
                                const addOnFee =
                                  billingInterval === 'annual'
                                    ? addon.addOnPriceAnnual || (addon.addOnPriceMonthly || 0) * 10
                                    : addon.addOnPriceMonthly || 0;
                                return (
                                  <label
                                    key={addon.featureKey}
                                    className={`flex items-center justify-between p-2 rounded-lg border transition-colors cursor-pointer text-xs ${
                                      isChecked
                                        ? 'bg-indigo-100/70 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200'
                                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleAddOn(addon.featureKey)}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <div>
                                        <span className="font-semibold block">{addon.name}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                                          {addon.module} module
                                        </span>
                                      </div>
                                    </div>
                                    <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                                      +${addOnFee}/{billingInterval === 'annual' ? 'yr' : 'mo'}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Hybrid Pricing Summary & Custom Override */}
                        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span>Base Package Price:</span>
                            <span className="font-mono font-medium">${basePrice}/{billingInterval === 'annual' ? 'yr' : 'mo'}</span>
                          </div>
                          {addOnsTotal > 0 && (
                            <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400">
                              <span>Add-ons ({selectedAddOns.length}):</span>
                              <span className="font-mono font-medium">+${addOnsTotal}/{billingInterval === 'annual' ? 'yr' : 'mo'}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white pt-1.5 border-t border-slate-100 dark:border-slate-800">
                            <span>Calculated Standard Contract:</span>
                            <span className="font-mono text-indigo-600 dark:text-indigo-400">
                              ${calculatedTotal}/{billingInterval === 'annual' ? 'yr' : 'mo'}
                            </span>
                          </div>

                          {/* Custom Contract Price Override */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={useCustomPrice}
                                onChange={(e) => setUseCustomPrice(e.target.checked)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="font-medium">Override with negotiated contract price</span>
                            </label>
                            {useCustomPrice && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={customPriceInput}
                                  onChange={(e) => setCustomPriceInput(e.target.value)}
                                  placeholder={`${calculatedTotal}`}
                                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none"
                                />
                                <span className="text-xs text-slate-500">/{billingInterval === 'annual' ? 'yr' : 'mo'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Primary Owner / Billing Email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@acme.com"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>

              {/* Password Configuration Section */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-indigo-600" />
                    Initial Password Configuration
                  </span>
                  <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900 text-xs">
                    <button
                      type="button"
                      onClick={() => setPasswordMode('auto')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        passwordMode === 'auto'
                          ? 'bg-indigo-600 text-white font-medium shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Auto-generate
                    </button>
                    <button
                      type="button"
                      onClick={() => setPasswordMode('custom')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        passwordMode === 'custom'
                          ? 'bg-indigo-600 text-white font-medium shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                {passwordMode === 'auto' ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-between">
                      <span>{autoPassword}</span>
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRegeneratePassword}
                      className="px-2.5 h-9 text-xs border-slate-200 dark:border-slate-700 gap-1 text-slate-700 dark:text-slate-200"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      Regenerate
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="Minimum 8 characters (letters, numbers, symbols)"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                )}

                {/* Toggles */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendWelcomeEmail}
                      onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Send branded Welcome Email with activation link and credentials</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requirePasswordChange}
                      onChange={(e) => setRequirePasswordChange(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Require user to change password upon first sign-in</span>
                  </label>
                </div>
              </div>

              {/* Modal Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="rounded-lg border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs px-4 py-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createOrgMutation.isPending}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-5 py-2 shadow-sm"
                >
                  {createOrgMutation.isPending ? 'Provisioning...' : 'Confirm Provisioning'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
