import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/Tabs';
import { Separator } from '../components/Separator';
import { Badge } from '../components/Badge';
import {
  useWorkspaceSettings,
  useUpdateWorkspaceSettings,
  useDepartments,
  useCreateDepartment,
  useDeleteDepartment
} from '../hooks/useSettings';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences
} from '../hooks/useNotifications';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, RefreshCw, X, Plus, Trash2, KeyRound, ArrowRight, Workflow, Sparkles, Mail } from 'lucide-react';
import { AIIntegrationSettings } from '../components/settings/AIIntegrationSettings';
import { EmailIntegrationSettings } from '../components/settings/EmailIntegrationSettings';
import { CertificateRenderer, CertificateTemplateId, CertificateTheme, CertificateBadge } from '../components/certificates/CertificateRenderer';
import { Skeleton } from '../components/Skeleton';
import { useTranslation } from 'react-i18next';
import { uploadService } from '../services/upload.service';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';
import { useRole } from '../context/RoleContext';

export function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'general';
  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val });
  };

  const { role } = useRole();
  const isOrgAdmin = role === 'admin' || role === 'owner' || role === 'super_admin' || role === 'hr_admin';

  const { data: settings, isLoading, isError, error, refetch } = useWorkspaceSettings();
  const { data: userNotificationPrefs } = useNotificationPreferences();
  const updateSettings = useUpdateWorkspaceSettings();
  const { t } = useTranslation('settings');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);

  const [orgName, setOrgName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [colorError, setColorError] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);

  const { data: departments = [], isLoading: deptsLoading } = useDepartments();
  const deptPagination = usePagination({ data: departments, initialPageSize: 5 });
  const createDeptMut = useCreateDepartment();
  const deleteDeptMut = useDeleteDepartment();

  const [newAssignmentEmails, setNewAssignmentEmails] = useState(true);
  const [deadlineReminders, setDeadlineReminders] = useState(true);
  const [weeklyManagerDigest, setWeeklyManagerDigest] = useState(true);

  const [allowPasswordLogin, setAllowPasswordLogin] = useState(true);
  const [enforceMfa, setEnforceMfa] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(3600);

  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [signatureUploadProgress, setSignatureUploadProgress] = useState(0);

  const [certTemplate, setCertTemplate] = useState<CertificateTemplateId>('classic');
  const [certTheme, setCertTheme] = useState<CertificateTheme>('light');
  const [certAccentColor, setCertAccentColor] = useState<string>('#d97706');
  const [certBadgeStyle, setCertBadgeStyle] = useState<CertificateBadge>('medal');
  const [certSignatureUrl, setCertSignatureUrl] = useState('');
  const [certSignatoryName, setCertSignatoryName] = useState('');
  const [certSignatoryTitle, setCertSignatoryTitle] = useState('');

  useEffect(() => {
    if (settings) {
      setOrgName(settings.orgName || '');
      setSupportEmail(settings.supportEmail || '');
      setPrimaryColor(settings.primaryColor || '#000000');
      if (settings.categories) {
        setCategories(settings.categories);
      } else {
        setCategories(["Engineering", "Sales", "General"]);
      }
      if (userNotificationPrefs?.categories) {
        setNewAssignmentEmails(userNotificationPrefs.categories.journeyAssigned?.email ?? true);
        setDeadlineReminders(userNotificationPrefs.categories.journeyOverdue?.email ?? true);
      } else if (settings.notifications) {
        setNewAssignmentEmails(settings.notifications.newAssignmentEmails ?? true);
        setDeadlineReminders(settings.notifications.deadlineReminders ?? true);
        setWeeklyManagerDigest(settings.notifications.weeklyManagerDigest ?? true);
      }
      if (settings.security) {
        setAllowPasswordLogin(settings.security.allowPasswordLogin ?? true);
        setEnforceMfa(settings.security.enforceMfa ?? false);
        setSessionTimeout(settings.security.sessionTimeout ?? 3600);
      }
      if (settings.certificate) {
        setCertTemplate((settings.certificate.template as any) || 'classic');
        setCertTheme((settings.certificate.theme as any) || 'light');
        setCertAccentColor(settings.certificate.accentColor || '#d97706');
        setCertBadgeStyle((settings.certificate.badgeStyle as any) || 'medal');
        setCertSignatureUrl(settings.certificate.signatureUrl || '');
        setCertSignatoryName(settings.certificate.signatoryName || '');
        setCertSignatoryTitle(settings.certificate.signatoryTitle || '');
      }
    }
  }, [settings]);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (catToRemove: string) => {
    setCategories(categories.filter(c => c !== catToRemove));
  };

  const handleAddDept = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = newDeptName.trim();
    const trimmedCode = newDeptCode.trim().toUpperCase();
    if (!trimmedName) {
      toast.error('Department name is required.');
      return;
    }
    createDeptMut.mutate(
      { name: trimmedName, code: trimmedCode || undefined },
      {
        onSuccess: () => {
          setNewDeptName('');
          setNewDeptCode('');
          setShowAddDeptModal(false);
          toast.success('Department created successfully!');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to create department.');
        },
      }
    );
  };

  const handleDeleteDept = (id: string) => {
    deleteDeptMut.mutate(id, {
      onSuccess: () => {
        toast.success('Department deleted successfully!');
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || err?.message || 'Failed to delete department.');
      },
    });
  };

  const handleSaveDetails = () => {
    updateSettings.mutate(
      { orgName, supportEmail, categories },
      {
        onSuccess: () => {
          toast.success('Organization details updated successfully!');
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to update settings.');
        },
      }
    );
  };

  const handleSaveBranding = () => {
    const trimmedColor = primaryColor.trim();
    if (!/^#[0-9A-F]{6}$/i.test(trimmedColor)) {
      setColorError('Invalid hex color format. Must be a 6-digit hex code (e.g. #1d4ed8)');
      toast.error('Invalid hex color format (e.g. #1d4ed8)');
      return;
    }
    setColorError(null);
    updateSettings.mutate(
      { primaryColor: trimmedColor },
      {
        onSuccess: () => {
          toast.success('Branding updated successfully!');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to update branding.');
        },
      }
    );
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingLogo(true);
      setLogoUploadProgress(0);
      
      const { uploadId, url } = await uploadService.uploadFile(file, 'public', (percent) => {
        setLogoUploadProgress(percent);
      });

      updateSettings.mutate(
        {
          logo: {
            uploadId,
            fileName: file.name,
            publicUrl: url
          }
        },
        {
          onSuccess: () => {
            toast.success('Logo uploaded and updated successfully!');
            refetch();
          },
          onError: (err: any) => {
            toast.error(err?.message || 'Failed to update logo settings.');
          }
        }
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload logo.');
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const updateNotificationPrefs = useUpdateNotificationPreferences();

  const handleSaveNotifications = () => {
    updateSettings.mutate(
      {
        notifications: {
          newAssignmentEmails,
          deadlineReminders,
          weeklyManagerDigest,
        },
      },
      {
        onSuccess: () => {
          updateNotificationPrefs.mutate({
            categories: {
              journeyAssigned: { inApp: true, email: newAssignmentEmails },
              journeyOverdue: { inApp: true, email: deadlineReminders },
              complianceDue: { inApp: true, email: deadlineReminders },
              announcements: { inApp: true, email: true },
              reminders: { inApp: true, email: deadlineReminders },
            },
          });
          toast.success('Notification preferences updated successfully!');
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to update notifications.');
        },
      }
    );
  };

  const handleSaveSecurity = () => {
    updateSettings.mutate(
      {
        security: {
          allowPasswordLogin,
          enforceMfa,
          sessionTimeout: Number(sessionTimeout),
        },
      },
      {
        onSuccess: () => {
          toast.success('Security settings updated successfully!');
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to update security settings.');
        },
      }
    );
  };

  const handleSaveCertificate = () => {
    updateSettings.mutate(
      {
        certificate: {
          template: certTemplate,
          theme: certTheme,
          accentColor: certAccentColor,
          badgeStyle: certBadgeStyle,
          signatureUrl: certSignatureUrl,
          signatoryName: certSignatoryName,
          signatoryTitle: certSignatoryTitle,
        },
      },
      {
        onSuccess: () => {
          toast.success('Certificate settings updated successfully!');
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to update certificate settings.');
        },
      }
    );
  };

  const handleSignatureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingSignature(true);
      setSignatureUploadProgress(0);
      
      const { url } = await uploadService.uploadFile(file, 'public', (percent) => {
        setSignatureUploadProgress(percent);
      });

      setCertSignatureUrl(url);
      toast.success('Signature image uploaded successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload signature image.');
    } finally {
      setIsUploadingSignature(false);
      if (signatureInputRef.current) {
        signatureInputRef.current.value = '';
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-[350px] rounded-md" />
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !settings) {
    return (
      <div className="max-w-md mx-auto text-center p-8 border rounded-lg space-y-4 my-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Failed to Load Settings</h2>
        <p className="text-muted-foreground">{(error as any)?.message || 'Workspace settings are currently unavailable.'}</p>
        <Button onClick={() => refetch()} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  if (!isOrgAdmin) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto" data-testid="employee-settings-view">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personal Settings</h1>
          <p className="text-muted-foreground">
            Manage your personal notification preferences and account settings.
          </p>
        </div>

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList>
            <TabsTrigger value="notifications" data-testid="tab-personal-notifications">
              {t('sections.notifications')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.notifications')}</CardTitle>
                <CardDescription>
                  Choose how and when you want to receive onboarding assignment and progress updates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm">New Assignment Alerts</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive email alerts when new onboarding journeys or lessons are assigned to you.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewAssignmentEmails(!newAssignmentEmails)}
                      className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                        newAssignmentEmails ? 'bg-indigo-600' : 'bg-white/10'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all duration-200 ${
                          newAssignmentEmails ? 'right-0.5 translate-x-0' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm">Deadline Reminders</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive reminder alerts before course due dates and milestone targets.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeadlineReminders(!deadlineReminders)}
                      className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                        deadlineReminders ? 'bg-indigo-600' : 'bg-white/10'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all duration-200 ${
                          deadlineReminders ? 'right-0.5 translate-x-0' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                <Button onClick={handleSaveNotifications} disabled={updateSettings.isPending}>
                  {updateSettings.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  {t('workspace.saveChanges')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto" data-testid="admin-settings-view">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('sections.workspace')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" data-testid="tab-general">{t('sections.workspace')}</TabsTrigger>
          <TabsTrigger value="branding" data-testid="tab-branding">{t('sections.branding')}</TabsTrigger>
          <TabsTrigger value="departments" data-testid="tab-departments">Departments</TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-security">{t('sections.security')}</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">{t('sections.notifications')}</TabsTrigger>
          <TabsTrigger value="certificates" data-testid="tab-certificates">Certificates</TabsTrigger>
          {isOrgAdmin && (
            <>
              <TabsTrigger value="ai" data-testid="tab-ai">
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-indigo-500" />
                AI & Automation
              </TabsTrigger>
              <TabsTrigger value="email" data-testid="tab-email">
                <Mail className="mr-1.5 h-3.5 w-3.5 text-indigo-500" />
                Email Delivery
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.workspace')}</CardTitle>
              <CardDescription>
                {t('workspace.orgName')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('workspace.orgName')}</label>
                <Input value={orgName} onChange={(e: any) => setOrgName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('workspace.workspaceUrl')}</label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground bg-muted px-3 py-2 rounded-md border text-sm">
                    {settings.workspaceUrl || 'acme.onboarding.app'}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('workspace.supportEmail')}</label>
                <Input value={supportEmail} onChange={(e: any) => setSupportEmail(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Employees will see this if they need help.
                </p>
              </div>
              <Button onClick={handleSaveDetails} disabled={updateSettings.isPending}>
                {updateSettings.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                {t('workspace.saveChanges')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Journey Categories</CardTitle>
              <CardDescription>
                Define categories to group and organize your onboarding journeys.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 min-h-9 p-2 rounded-lg border bg-muted/20">
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic px-2">No custom categories added. Platform defaults will be used.</p>
                ) : (
                  categories.map((cat) => (
                    <Badge key={cat} variant="secondary" className="flex items-center gap-1.5 px-3 py-1 text-sm bg-indigo-600/10 text-indigo-400 border border-indigo-600/20">
                      {cat}
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(cat)}
                        className="text-muted-foreground hover:text-foreground outline-none transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              <form onSubmit={handleAddCategory} className="flex gap-2 max-w-md">
                <Input
                  value={newCategory}
                  onChange={(e: any) => setNewCategory(e.target.value)}
                  placeholder="e.g. Finance, Customer Success"
                />
                <Button type="submit" variant="outline">
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </form>
              <Button onClick={handleSaveDetails} disabled={updateSettings.isPending}>
                {updateSettings.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Save Categories
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" data-testid="branding-tab-content">
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.branding')}</CardTitle>
              <CardDescription>
                Customize your organization logo and primary brand color across the employee experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">{t('workspace.logo')}</label>
                  <div className="flex items-center gap-4">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 rounded-lg object-contain border p-1 bg-white" />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded-lg border flex items-center justify-center text-xs text-muted-foreground">
                        Logo
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoChange}
                    />
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingLogo}
                      >
                        {isUploadingLogo ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Uploading ({logoUploadProgress}%)
                          </>
                        ) : (
                          'Upload New'
                        )}
                      </Button>
                      <p className="text-[10px] text-muted-foreground">
                        PNG, JPG or SVG. Max 2MB.
                      </p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  <label className="text-sm font-medium block mb-2">{t('workspace.primaryColor')}</label>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-9 h-9 rounded-full border shadow-xs shrink-0 transition-colors"
                      style={{ backgroundColor: /^#[0-9A-F]{6}$/i.test(primaryColor) ? primaryColor : '#000000' }}
                      data-testid="color-preview-circle"
                    />
                    <div className="space-y-1">
                      <Input
                        data-testid="primary-color-input"
                        value={primaryColor}
                        onChange={(e: any) => {
                          setPrimaryColor(e.target.value);
                          if (colorError && /^#[0-9A-F]{6}$/i.test(e.target.value)) {
                            setColorError(null);
                          }
                        }}
                        placeholder="#1d4ed8"
                        className={`w-36 font-mono ${colorError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      />
                    </div>
                  </div>
                  {colorError && (
                    <p className="text-xs text-destructive mt-1.5 font-medium" data-testid="color-error-message">
                      {colorError}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Used for primary buttons, active highlights, and navigation branding. Format: #RRGGBB
                  </p>
                </div>
              </div>
              <Button
                data-testid="save-branding-btn"
                onClick={handleSaveBranding}
                disabled={updateSettings.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {updateSettings.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Save Branding
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" data-testid="departments-tab-content">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Departments</CardTitle>
                <CardDescription>
                  Configure your organization's departmental taxonomy, department codes, and employee assignments.
                </CardDescription>
              </div>
              <Button
                data-testid="add-department-btn"
                onClick={() => setShowAddDeptModal(true)}
                size="sm"
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="h-4 w-4" /> Add Department
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {showAddDeptModal && (
                <div className="p-4 border rounded-lg bg-muted/20 space-y-4 mb-4" data-testid="add-dept-form">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-sm text-foreground">New Department</h4>
                    <button
                      type="button"
                      onClick={() => setShowAddDeptModal(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">
                        Department Name
                      </label>
                      <Input
                        data-testid="dept-name-input"
                        value={newDeptName}
                        onChange={(e: any) => setNewDeptName(e.target.value)}
                        placeholder="e.g. Customer Success"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">
                        Department Code
                      </label>
                      <Input
                        data-testid="dept-code-input"
                        value={newDeptCode}
                        onChange={(e: any) => setNewDeptCode(e.target.value.toUpperCase())}
                        placeholder="e.g. CS"
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddDeptModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      data-testid="save-department-btn"
                      size="sm"
                      onClick={handleAddDept}
                      disabled={createDeptMut.isPending || !newDeptName.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      {createDeptMut.isPending ? (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Save Department
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-md border overflow-hidden" data-testid="departments-table">
                {deptsLoading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Loading departments...
                  </div>
                ) : departments.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground italic">
                    No departments configured yet. Click "Add Department" to create one.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground border-b">
                      <tr>
                        <th className="text-left px-4 py-3">Department Name</th>
                        <th className="text-left px-4 py-3">Code</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-right px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {deptPagination.paginatedData.map((dept: any) => (
                        <tr
                          key={dept._id}
                          data-testid={`dept-row-${dept.code || dept.name.replace(/\s+/g, '_')}`}
                          className="hover:bg-muted/10 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {dept.name}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className="font-mono text-xs bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                              data-testid={`dept-code-badge-${dept.code || dept.name}`}
                            >
                              {dept.code || dept.name.substring(0, 3).toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            >
                              Active
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              data-testid={`delete-dept-${dept._id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDept(dept._id)}
                              disabled={deleteDeptMut.isPending}
                              className="text-destructive hover:bg-destructive/10 p-1 h-8 w-8"
                              title="Delete Department"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {departments.length > 5 && (
                <div className="pt-2">
                  <SimplePagination
                    currentPage={deptPagination.page}
                    totalPages={deptPagination.totalPages}
                    totalItems={deptPagination.totalItems}
                    startIndex={deptPagination.startIndex}
                    endIndex={deptPagination.endIndex}
                    pageSize={deptPagination.pageSize}
                    onPageChange={deptPagination.setPage}
                    onPageSizeChange={deptPagination.setPageSize}
                    itemLabel="departments"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.security')}</CardTitle>
              <CardDescription>
                Configure authentication and session settings for your organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">Allow Password Authentication</h4>
                    <p className="text-sm text-muted-foreground">
                      Enable users to log in using their email and password.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowPasswordLogin(!allowPasswordLogin)}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                      allowPasswordLogin ? 'bg-indigo-600' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all duration-200 ${
                        allowPasswordLogin ? 'right-0.5 translate-x-0' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">Enforce Multi-Factor Authentication (MFA)</h4>
                    <p className="text-sm text-muted-foreground">
                      Require MFA for all users when logging in.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnforceMfa(!enforceMfa)}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                      enforceMfa ? 'bg-indigo-600' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all duration-200 ${
                        enforceMfa ? 'right-0.5 translate-x-0' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Session Timeout (Seconds)</label>
                  <Input 
                    type="number" 
                    value={sessionTimeout} 
                    onChange={(e: any) => setSessionTimeout(e.target.value)} 
                    min={60} 
                  />
                  <p className="text-xs text-muted-foreground">
                    Define the idle timeout duration in seconds before a user session is automatically signed out (minimum 60 seconds).
                  </p>
                </div>
              </div>
              <Button onClick={handleSaveSecurity} disabled={updateSettings.isPending}>
                {updateSettings.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                {t('workspace.saveChanges')}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-indigo-100 dark:border-indigo-950/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-5 w-5 text-indigo-600" />
                Enterprise Single Sign-On (SSO & SAML 2.0)
              </CardTitle>
              <CardDescription>
                Configure enterprise SAML 2.0 / OIDC identity providers, domain discovery, X.509 signing certificates, and toggle mandatory SSO enforcement.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                variant="outline"
                className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-medium"
                onClick={() => navigate('/settings/sso')}
                data-testid="btn-configure-sso"
              >
                Configure SSO Settings <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-indigo-100 dark:border-indigo-950/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Workflow className="h-5 w-5 text-indigo-600" />
                HRIS Marketplace & Data Sync
              </CardTitle>
              <CardDescription>
                Connect BambooHR, Workday, or custom webhooks to synchronize employees, departments, and automated onboarding enrollments.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                variant="outline"
                className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-medium"
                onClick={() => navigate('/settings/integrations')}
                data-testid="btn-configure-integrations"
              >
                Configure HRIS Integrations <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
                <CardTitle>{t('sections.notifications')}</CardTitle>
              <CardDescription>
                Configure default email notifications for your organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">{t('notifications.newAssignmentEmails')}</h4>
                    <p className="text-sm text-muted-foreground">
                      Send an email when an employee is assigned a new journey.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewAssignmentEmails(!newAssignmentEmails)}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                      newAssignmentEmails ? 'bg-indigo-600' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all duration-200 ${
                        newAssignmentEmails ? 'right-0.5 translate-x-0' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">{t('notifications.deadlineReminders')}</h4>
                    <p className="text-sm text-muted-foreground">
                      Send reminders 3 days before a journey is due.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeadlineReminders(!deadlineReminders)}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                      deadlineReminders ? 'bg-indigo-600' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all duration-200 ${
                        deadlineReminders ? 'right-0.5 translate-x-0' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">{t('notifications.weeklyManagerDigest')}</h4>
                    <p className="text-sm text-muted-foreground">
                      Send managers a weekly summary of their team's progress.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWeeklyManagerDigest(!weeklyManagerDigest)}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                      weeklyManagerDigest ? 'bg-indigo-600' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all duration-200 ${
                        weeklyManagerDigest ? 'right-0.5 translate-x-0' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <Button onClick={handleSaveNotifications} disabled={updateSettings.isPending}>
                {updateSettings.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                {t('workspace.saveChanges')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certificates">
          <Card>
            <CardHeader>
              <CardTitle>Digital Certificate Customization</CardTitle>
              <CardDescription>
                Customize the templates, layout design, and signing details for onboarding completion credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Form Controls */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Template Picker */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Choose Template Style</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'classic', label: 'Classic Gold', desc: 'Formal gold frame' },
                        { id: 'modern', label: 'Cyber Tech', desc: 'Futuristic glowing' },
                        { id: 'minimalist', label: 'Minimalist', desc: 'Swiss whitespace' },
                        { id: 'academic', label: 'Academic', desc: 'Collegiate diploma' },
                        { id: 'gradient', label: 'Vibrant Mesh', desc: 'Modern aurora' },
                        { id: 'executive', label: 'Obsidian', desc: 'Luxury metallic' },
                      ].map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setCertTemplate(style.id as CertificateTemplateId)}
                          className={`flex flex-col items-start p-2.5 border rounded-xl transition-all text-left cursor-pointer ${
                            certTemplate === style.id
                              ? 'border-indigo-500 bg-indigo-500/10 text-foreground ring-1 ring-indigo-500 font-semibold'
                              : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                          }`}
                        >
                          <span className="text-xs font-medium text-foreground">{style.label}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-full">{style.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme Mode Selector (Light vs Dark) */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Theme Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCertTheme('light')}
                        className={`py-2 px-3 text-xs font-medium rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          certTheme === 'light'
                            ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
                            : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        ☀️ Light Theme
                      </button>
                      <button
                        type="button"
                        onClick={() => setCertTheme('dark')}
                        className={`py-2 px-3 text-xs font-medium rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          certTheme === 'dark'
                            ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
                            : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        🌙 Dark Theme
                      </button>
                    </div>
                  </div>

                  {/* Accent Color Palette */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Accent & Seal Color</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Gold', value: '#d97706' },
                        { label: 'Indigo', value: '#6366f1' },
                        { label: 'Emerald', value: '#059669' },
                        { label: 'Cyan', value: '#0891b2' },
                        { label: 'Rose', value: '#e11d48' },
                        { label: 'Violet', value: '#7c3aed' },
                      ].map((col) => (
                        <button
                          key={col.value}
                          type="button"
                          onClick={() => setCertAccentColor(col.value)}
                          className={`h-7 px-2.5 rounded-full border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                            certAccentColor === col.value
                              ? 'ring-2 ring-primary ring-offset-2 border-transparent font-medium bg-card'
                              : 'border-border bg-muted/20 hover:bg-muted/40'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.value }} />
                          <span className="text-[11px]">{col.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Badge / Seal Style */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Badge / Seal Design</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['medal', 'laurel', 'shield', 'crypto'] as const).map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setCertBadgeStyle(b)}
                          className={`py-1.5 px-2 text-xs capitalize rounded-lg border transition-all cursor-pointer text-center ${
                            certBadgeStyle === b
                              ? 'border-primary bg-primary/10 text-primary font-semibold'
                              : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Signatory Settings */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">Signatory Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Signatory Name</label>
                        <Input
                          placeholder="e.g. Jane Doe"
                          value={certSignatoryName}
                          onChange={(e: any) => setCertSignatoryName(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Signatory Title</label>
                        <Input
                          placeholder="e.g. Head of Human Resources"
                          value={certSignatoryTitle}
                          onChange={(e: any) => setCertSignatoryTitle(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Signature Upload */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold uppercase text-muted-foreground block">Authorized Digital Signature</label>
                    <div className="flex items-center gap-4">
                      {certSignatureUrl ? (
                        <div className="w-24 h-12 bg-white rounded border flex items-center justify-center p-1">
                          <img src={certSignatureUrl} alt="Signature" className="h-full max-w-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-24 h-12 bg-muted rounded border flex items-center justify-center text-[10px] text-muted-foreground">
                          No Signature
                        </div>
                      )}
                      <input
                        type="file"
                        ref={signatureInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleSignatureChange}
                      />
                      <div className="flex flex-col gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => signatureInputRef.current?.click()}
                          disabled={isUploadingSignature}
                          className="text-xs"
                        >
                          {isUploadingSignature ? (
                            <>
                              <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                              Uploading ({signatureUploadProgress}%)
                            </>
                          ) : (
                            'Upload Signature Image'
                          )}
                        </Button>
                        <p className="text-[10px] text-muted-foreground">
                          Transparent PNG recommended. Max 1MB.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <Button onClick={handleSaveCertificate} disabled={updateSettings.isPending}>
                    {updateSettings.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Save Certificate Settings
                  </Button>
                </div>

                {/* Right Side: Live Interactive Certificate Preview */}
                <div className="lg:col-span-7 flex flex-col justify-start space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Live Certificate Preview
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Template: {certTemplate} · {certTheme} theme
                    </span>
                  </div>

                  <div className="shadow-xl rounded-2xl overflow-hidden border border-border/80">
                    <CertificateRenderer
                      template={certTemplate}
                      theme={certTheme}
                      accentColor={certAccentColor}
                      badgeStyle={certBadgeStyle}
                      recipientName="Alex Morgan"
                      organizationName={orgName || 'Talnova'}
                      logoUrl={settings?.logoUrl}
                      journeyTitle="Talnova General Onboarding"
                      issuedAt={new Date()}
                      signatoryName={certSignatoryName || 'Authorized Officer'}
                      signatoryTitle={certSignatoryTitle || 'Head of People & Operations'}
                      signatureUrl={certSignatureUrl}
                      qrCode={true}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isOrgAdmin && (
          <>
            <TabsContent value="ai" className="space-y-6">
              <AIIntegrationSettings />
            </TabsContent>
            <TabsContent value="email" className="space-y-6">
              <EmailIntegrationSettings />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}