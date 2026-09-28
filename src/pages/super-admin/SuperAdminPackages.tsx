import { useState } from 'react';
import {
  Package as PackageIcon,
  Plus,
  Edit2,
  Copy,
  Trash2,
  Check,
  X,
  Layers,
  Sparkles,
  Users,
  HardDrive,
  Tv,
  GraduationCap,
  ShieldCheck,
  Search,
  CheckCircle2,
  Building2,
  DollarSign
} from 'lucide-react';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import {
  useSuperAdminPackages,
  useCreatePackage,
  useUpdatePackage,
  useDeletePackage,
  useClonePackage
} from '../../hooks/useSuperAdmin';
import { PackageItem, PackageFeatureItem } from '../../services/superAdmin.service';
import { toast } from 'sonner';

export function SuperAdminPackages() {
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [badge, setBadge] = useState('');
  const [tier, setTier] = useState<'free' | 'standard' | 'custom' | 'enterprise'>('standard');
  const [isPublic, setIsPublic] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [basePriceMonthly, setBasePriceMonthly] = useState(49);
  const [basePriceAnnual, setBasePriceAnnual] = useState(490);
  const [maxUsers, setMaxUsers] = useState(50);
  const [maxStorageGb, setMaxStorageGb] = useState(10);
  const [maxJourneys, setMaxJourneys] = useState(10);
  const [maxKiosks, setMaxKiosks] = useState(5);
  const [aiTokenMonthlyLimit, setAiTokenMonthlyLimit] = useState(500000);
  const [featuresState, setFeaturesState] = useState<PackageFeatureItem[]>([]);

  const { data, isLoading, refetch } = useSuperAdminPackages({
    tier: selectedTier !== 'all' ? selectedTier : undefined,
    search: search || undefined,
  });

  const createMutation = useCreatePackage();
  const updateMutation = useUpdatePackage();
  const deleteMutation = useDeletePackage();
  const cloneMutation = useClonePackage();

  const packages = data?.packages || [];
  const canonicalFeatures = data?.canonicalFeatures || [];

  const handleOpenCreateModal = () => {
    setEditingPackage(null);
    setName('');
    setSlug('');
    setDescription('');
    setBadge('');
    setTier('standard');
    setIsPublic(true);
    setIsDefault(false);
    setBasePriceMonthly(49);
    setBasePriceAnnual(490);
    setMaxUsers(50);
    setMaxStorageGb(10);
    setMaxJourneys(10);
    setMaxKiosks(5);
    setAiTokenMonthlyLimit(500000);

    // Initialize features from canonical list with defaults
    const initialFeats: PackageFeatureItem[] = canonicalFeatures.map((cf: any) => ({
      featureKey: cf.featureKey,
      name: cf.name,
      module: cf.module,
      description: cf.description,
      enabled: cf.module === 'learning' || cf.module === 'operations',
      isAddOn: Boolean(cf.isAddOn),
      addOnPriceMonthly: cf.addOnPriceMonthly || 29,
      addOnPriceAnnual: cf.addOnPriceAnnual || 290,
    }));
    setFeaturesState(initialFeats);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (pkg: PackageItem) => {
    setEditingPackage(pkg);
    setName(pkg.name);
    setSlug(pkg.slug);
    setDescription(pkg.description || '');
    setBadge(pkg.badge || '');
    setTier(pkg.tier || 'standard');
    setIsPublic(pkg.isPublic ?? true);
    setIsDefault(pkg.isDefault ?? false);
    setBasePriceMonthly(pkg.billing?.basePriceMonthly ?? 0);
    setBasePriceAnnual(pkg.billing?.basePriceAnnual ?? 0);
    setMaxUsers(pkg.limits?.maxUsers ?? 25);
    setMaxStorageGb(pkg.limits?.maxStorageGb ?? 10);
    setMaxJourneys(pkg.limits?.maxJourneys ?? 10);
    setMaxKiosks(pkg.limits?.maxKiosks ?? 5);
    setAiTokenMonthlyLimit(pkg.limits?.aiTokenMonthlyLimit ?? 500000);

    // Merge package features with canonical features
    const existingMap = new Map<string, any>();
    (pkg.features || []).forEach((f) => existingMap.set(f.featureKey, f));

    const mergedFeats: PackageFeatureItem[] = canonicalFeatures.map((cf: any) => {
      const existing = existingMap.get(cf.featureKey);
      return {
        featureKey: cf.featureKey,
        name: cf.name,
        module: cf.module,
        description: cf.description,
        enabled: existing ? existing.enabled : false,
        isAddOn: existing ? existing.isAddOn : Boolean(cf.isAddOn),
        addOnPriceMonthly: existing?.addOnPriceMonthly ?? cf.addOnPriceMonthly ?? 29,
        addOnPriceAnnual: existing?.addOnPriceAnnual ?? cf.addOnPriceAnnual ?? 290,
      };
    });

    setFeaturesState(mergedFeats);
    setIsModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingPackage) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      );
    }
  };

  const handleToggleFeatureEnabled = (key: string) => {
    setFeaturesState((prev) =>
      prev.map((f) => (f.featureKey === key ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const handleToggleFeatureAddOn = (key: string) => {
    setFeaturesState((prev) =>
      prev.map((f) => (f.featureKey === key ? { ...f, isAddOn: !f.isAddOn } : f))
    );
  };

  const handleAddOnPriceChange = (key: string, price: number) => {
    setFeaturesState((prev) =>
      prev.map((f) =>
        f.featureKey === key
          ? { ...f, addOnPriceMonthly: Math.max(0, price), addOnPriceAnnual: Math.max(0, price * 10) }
          : f
      )
    );
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error('Package name and unique slug are required');
      return;
    }

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      badge: badge.trim(),
      tier,
      isPublic,
      isDefault,
      billing: {
        basePriceMonthly: Number(basePriceMonthly) || 0,
        basePriceAnnual: Number(basePriceAnnual) || 0,
        currency: 'USD',
      },
      limits: {
        maxUsers: Number(maxUsers) || 1,
        maxStorageGb: Number(maxStorageGb) || 1,
        maxJourneys: Number(maxJourneys) || 0,
        maxKiosks: Number(maxKiosks) || 0,
        aiTokenMonthlyLimit: Number(aiTokenMonthlyLimit) || 0,
      },
      features: featuresState,
    };

    try {
      if (editingPackage) {
        await updateMutation.mutateAsync({ id: editingPackage.id || editingPackage._id!, payload });
        toast.success(`Package "${payload.name}" updated successfully.`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(`Package template "${payload.name}" created successfully.`);
      }
      setIsModalOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save package.');
    }
  };

  const handleClone = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await cloneMutation.mutateAsync(id);
      toast.success('Package template cloned successfully.');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to clone package.');
    }
  };

  const handleDelete = async (pkg: PackageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to remove or archive package "${pkg.name}"?`)) {
      return;
    }
    try {
      const res = await deleteMutation.mutateAsync(pkg.id || pkg._id!);
      toast.success(res.message || 'Package removed.');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete package.');
    }
  };

  // Group features by module for the modal
  const moduleCategories = [
    { id: 'learning', label: 'Learning & Journeys' },
    { id: 'operations', label: 'Operations & Field' },
    { id: 'compliance', label: 'Compliance & Legal' },
    { id: 'people', label: 'People & Engagement' },
    { id: 'intelligence', label: 'Intelligence & Automation' },
    { id: 'enterprise', label: 'Enterprise & Access' },
  ];

  return (
    <SuperAdminShell
      title="Packages & Custom Plans"
      description="Create modular package templates, define feature entitlements, customize client limits, and configure hybrid add-on pricing."
      actions={
        <Button
          onClick={handleOpenCreateModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Create New Package
        </Button>
      }
    >
      <div className="space-y-6">
        {/* KPI & Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Templates</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{packages.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <PackageIcon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Modular platform tiers available</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Freemium Tier</p>
                <h3 className="text-2xl font-bold text-emerald-700 mt-1">
                  {packages.find((p) => p.isDefault)?.name || 'Freemium'}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Default for open registration</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Modular Modules</p>
                <h3 className="text-2xl font-bold text-blue-700 mt-1">{canonicalFeatures.length || 20}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Fine-grained capabilities & add-ons</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Tenants Assigned</p>
                <h3 className="text-2xl font-bold text-purple-700 mt-1">
                  {packages.reduce((sum, p) => sum + (p.activeTenantsCount || 0), 0)}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Organizations actively entitled</p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search packages by name, slug, or details..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200 w-full sm:w-auto overflow-x-auto">
              <span className="text-xs text-slate-500 px-2 font-medium">Tier:</span>
              {['all', 'free', 'standard', 'custom', 'enterprise'].map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTier(t)}
                  className={`px-2.5 py-1 text-xs rounded-md capitalize font-medium transition-all ${
                    selectedTier === t
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Packages Grid */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
            Loading package templates...
          </div>
        ) : packages.length === 0 ? (
          <Card className="p-16 text-center bg-white border border-slate-200 rounded-xl">
            <PackageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">No packages found</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              Get started by creating your first modular package template.
            </p>
            <Button onClick={handleOpenCreateModal} className="bg-indigo-600 text-white text-xs">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Package
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => {
              const enabledCount = (pkg.features || []).filter((f) => f.enabled).length;
              const addOnCount = (pkg.features || []).filter((f) => f.isAddOn && !f.enabled).length;

              return (
                <Card
                  key={pkg.id || pkg._id}
                  className="bg-white border border-slate-200 hover:border-indigo-300 transition-all shadow-sm rounded-xl p-6 flex flex-col justify-between relative group"
                >
                  <div>
                    {/* Header Strip */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {pkg.name}
                          </h4>
                          {pkg.badge && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {pkg.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-slate-400 mt-0.5">/{pkg.slug}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        {pkg.isDefault && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] uppercase font-mono">
                            Default
                          </Badge>
                        )}
                        <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] uppercase font-mono">
                          {pkg.tier}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
                      {pkg.description || 'No description provided.'}
                    </p>

                    {/* Pricing Display */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-4 flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl font-extrabold text-slate-900">
                          ${pkg.billing?.basePriceMonthly ?? 0}
                        </span>
                        <span className="text-xs text-slate-500 font-medium ml-1">/ month</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-700">
                          ${pkg.billing?.basePriceAnnual ?? (pkg.billing?.basePriceMonthly ?? 0) * 10} / yr
                        </span>
                        <p className="text-[10px] text-emerald-600 font-semibold">2 months free</p>
                      </div>
                    </div>

                    {/* Quotas & Limits */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                      <div className="flex items-center gap-2 bg-white border border-slate-100 p-2 rounded-lg">
                        <Users className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Users Limit</p>
                          <p className="font-bold text-slate-800">{pkg.limits?.maxUsers ?? 25} seats</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-white border border-slate-100 p-2 rounded-lg">
                        <HardDrive className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Storage Quota</p>
                          <p className="font-bold text-slate-800">{pkg.limits?.maxStorageGb ?? 10} GB</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-white border border-slate-100 p-2 rounded-lg">
                        <GraduationCap className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Journeys</p>
                          <p className="font-bold text-slate-800">{pkg.limits?.maxJourneys ?? 10} max</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-white border border-slate-100 p-2 rounded-lg">
                        <Tv className="w-4 h-4 text-purple-500 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Kiosks</p>
                          <p className="font-bold text-slate-800">{pkg.limits?.maxKiosks ?? 5} terminals</p>
                        </div>
                      </div>
                    </div>

                    {/* Features overview pill */}
                    <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
                      <span className="flex items-center gap-1.5 font-medium text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        {enabledCount} Base Features
                      </span>
                      <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                        +{addOnCount} Modular Add-ons
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{pkg.activeTenantsCount || 0} active tenants</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleClone(pkg.id || pkg._id!, e)}
                        title="Clone Package Template"
                        className="text-slate-500 hover:text-slate-900 p-1.5 h-8"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditModal(pkg)}
                        title="Edit Package"
                        className="text-slate-500 hover:text-indigo-600 p-1.5 h-8"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDelete(pkg, e)}
                        title="Delete or Archive Package"
                        className="text-slate-500 hover:text-rose-600 p-1.5 h-8"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create / Edit Package Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                    <PackageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {editingPackage ? `Edit Package: ${editingPackage.name}` : 'Create Custom Package Template'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configure base entitlements, quota ceilings, and modular add-on pricing.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSavePackage} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* General Settings */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    Package Identity & Classification
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Package Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="e.g. Kiosk Terminal Suite"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        URL Slug *
                      </label>
                      <input
                        type="text"
                        required
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="e.g. kiosk-suite"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tier Level
                      </label>
                      <select
                        value={tier}
                        onChange={(e: any) => setTier(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="free">Free / Community</option>
                        <option value="standard">Standard Business</option>
                        <option value="custom">Custom Client Package</option>
                        <option value="enterprise">Enterprise Tier</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief summary of who this package is for..."
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Badge Label (Optional)
                      </label>
                      <input
                        type="text"
                        value={badge}
                        onChange={(e) => setBadge(e.target.value)}
                        placeholder="e.g. Most Popular, Field Ops"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      Available for Public / Self-Registration selection
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      Default Freemium Package (Assigned on new registration)
                    </label>
                  </div>
                </div>

                {/* Base Pricing & Quotas */}
                <div className="border-t border-slate-200 pt-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                    Base Pricing & Default Quota Ceilings
                  </h4>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Monthly ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={basePriceMonthly}
                        onChange={(e) => setBasePriceMonthly(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Annual ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={basePriceAnnual}
                        onChange={(e) => setBasePriceAnnual(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Max Users
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={maxUsers}
                        onChange={(e) => setMaxUsers(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Storage (GB)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={maxStorageGb}
                        onChange={(e) => setMaxStorageGb(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Max Journeys
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={maxJourneys}
                        onChange={(e) => setMaxJourneys(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Max Kiosks
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={maxKiosks}
                        onChange={(e) => setMaxKiosks(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        AI Tokens/Mo
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={aiTokenMonthlyLimit}
                        onChange={(e) => setAiTokenMonthlyLimit(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Feature Entitlements Checklist */}
                <div className="border-t border-slate-200 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      Feature Entitlements & Add-On Configuration
                    </h4>
                    <span className="text-xs text-slate-500">
                      Check &apos;Included&apos; for base features, or configure &apos;Add-on Price&apos; for modular upgrades.
                    </span>
                  </div>

                  <div className="space-y-6">
                    {moduleCategories.map((mod) => {
                      const modFeatures = featuresState.filter((f) => f.module === mod.id);
                      if (modFeatures.length === 0) return null;

                      return (
                        <div key={mod.id} className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                          <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                            {mod.label}
                          </h5>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {modFeatures.map((f) => (
                              <div
                                key={f.featureKey}
                                className={`p-3 rounded-lg border transition-all flex flex-col justify-between ${
                                  f.enabled
                                    ? 'bg-indigo-50/50 border-indigo-200'
                                    : 'bg-white border-slate-200'
                                }`}
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm text-slate-900 select-none">
                                      <input
                                        type="checkbox"
                                        checked={f.enabled}
                                        onChange={() => handleToggleFeatureEnabled(f.featureKey)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                      />
                                      {f.name}
                                    </label>
                                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                                      {f.featureKey}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1 pl-6 leading-relaxed">
                                    {f.description}
                                  </p>
                                </div>

                                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between pl-6">
                                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={f.isAddOn}
                                      onChange={() => handleToggleFeatureAddOn(f.featureKey)}
                                      className="rounded text-purple-600 focus:ring-purple-500"
                                    />
                                    Available as Add-on
                                  </label>

                                  {f.isAddOn && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-slate-400 font-mono">+$</span>
                                      <input
                                        type="number"
                                        min="0"
                                        value={f.addOnPriceMonthly ?? 29}
                                        onChange={(e) =>
                                          handleAddOnPriceChange(f.featureKey, Number(e.target.value))
                                        }
                                        className="w-16 px-1.5 py-0.5 text-xs bg-white border border-slate-200 rounded text-slate-800 text-right font-bold"
                                      />
                                      <span className="text-[10px] text-slate-400">/mo</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="border-slate-200 text-slate-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {editingPackage ? 'Save Changes' : 'Create Package'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
