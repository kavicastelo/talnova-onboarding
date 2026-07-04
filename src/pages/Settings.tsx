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
import { toast } from 'sonner';
import { AlertCircle, RefreshCw, X, Plus, Trash2 } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { useTranslation } from 'react-i18next';
import { uploadService } from '../services/upload.service';

export function Settings() {
  const { data: settings, isLoading, isError, error, refetch } = useWorkspaceSettings();
  const updateSettings = useUpdateWorkspaceSettings();
  const { t } = useTranslation('settings');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);

  const [orgName, setOrgName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#000000');

  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newDeptName, setNewDeptName] = useState('');

  const { data: departments = [], isLoading: deptsLoading } = useDepartments();
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

  const [certTemplate, setCertTemplate] = useState<'classic' | 'modern' | 'minimalist'>('classic');
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
      if (settings.notifications) {
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
        setCertTemplate(settings.certificate.template || 'classic');
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

  const handleAddDept = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDeptName.trim();
    if (!trimmed) return;
    createDeptMut.mutate({ name: trimmed }, {
      onSuccess: () => {
        setNewDeptName('');
        toast.success('Department created successfully!');
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to create department.');
      }
    });
  };

  const handleDeleteDept = (id: string) => {
    deleteDeptMut.mutate(id, {
      onSuccess: () => {
        toast.success('Department deleted successfully!');
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to delete department.');
      }
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
    updateSettings.mutate(
      { primaryColor },
      {
        onSuccess: () => {
          toast.success('Branding updated successfully!');
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to update branding.');
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('sections.workspace')}
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">{t('sections.workspace')}</TabsTrigger>
          <TabsTrigger value="branding">{t('sections.branding')}</TabsTrigger>
          <TabsTrigger value="roles">{t('sections.security')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('sections.notifications')}</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
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

          <Card>
            <CardHeader>
              <CardTitle>Departments</CardTitle>
              <CardDescription>
                Manage the department names used when inviting new employees.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="rounded-md border max-w-md">
                  {deptsLoading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Loading departments...</div>
                  ) : departments.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground italic">No custom departments added. Platform defaults will be used.</div>
                  ) : (
                    <div className="divide-y">
                      {departments.map((dept: any) => (
                        <div key={dept._id} className="flex items-center justify-between p-3 text-sm">
                          <span className="font-medium">{dept.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDept(dept._id)}
                            disabled={deleteDeptMut.isPending}
                            className="text-destructive hover:bg-destructive/10 p-1 h-7 w-7"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <form onSubmit={handleAddDept} className="flex gap-2 max-w-md">
                  <Input
                    value={newDeptName}
                    onChange={(e: any) => setNewDeptName(e.target.value)}
                    placeholder="e.g. Human Resources"
                  />
                  <Button type="submit" variant="outline" disabled={createDeptMut.isPending}>
                    {createDeptMut.isPending ? (
                      <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-1 h-4 w-4" />
                    )}
                    Add Department
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
                <CardTitle>{t('sections.branding')}</CardTitle>
              <CardDescription>
                Customize the look and feel of your workspace.
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
                    <div className="w-8 h-8 rounded-full border" style={{ backgroundColor: primaryColor }} />
                    <Input value={primaryColor} onChange={(e: any) => setPrimaryColor(e.target.value)} className="w-32" />
                  </div>
                </div>
              </div>
              <Button onClick={handleSaveBranding} disabled={updateSettings.isPending}>
                {updateSettings.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                {t('workspace.saveChanges')}
              </Button>
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
                <div className="lg:col-span-5 space-y-6">
                  {/* Template Picker */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Choose Template Style</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['classic', 'modern', 'minimalist'] as const).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setCertTemplate(style)}
                          className={`flex flex-col items-center justify-center p-3 border rounded-xl transition-all ${
                            certTemplate === style
                              ? 'border-indigo-500 bg-indigo-500/10 text-white'
                              : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]'
                          }`}
                        >
                          <span className="text-xs font-semibold capitalize">{style}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Signatory Settings */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Signatory Details</h3>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Signatory Name</label>
                        <Input
                          placeholder="e.g. Jane Doe"
                          value={certSignatoryName}
                          onChange={(e: any) => setCertSignatoryName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Signatory Title</label>
                        <Input
                          placeholder="e.g. Head of Human Resources"
                          value={certSignatoryTitle}
                          onChange={(e: any) => setCertSignatoryTitle(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Signature Upload */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium block">Authorized Signature Image</label>
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
                        >
                          {isUploadingSignature ? (
                            <>
                              <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                              Uploading ({signatureUploadProgress}%)
                            </>
                          ) : (
                            'Upload Signature'
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

                {/* Right Side: Live Certificate Preview */}
                <div className="lg:col-span-7 flex flex-col justify-center">
                  <div className="text-xs text-slate-400 font-semibold mb-2 uppercase tracking-wider">Live Certificate Preview</div>
                  
                  {/* Outer Frame */}
                  <div className="relative w-full aspect-[4/3] rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col justify-between p-6 md:p-10 select-none bg-slate-950">
                    
                    {/* Render different styling depending on selected template */}
                    {certTemplate === 'classic' && (
                      <div className="absolute inset-2 border-4 double border-yellow-850/40 rounded-lg flex flex-col justify-between p-6 bg-amber-50/5 text-amber-50">
                        {/* Certificate Header */}
                        <div className="text-center font-serif">
                          <h4 className="text-xs uppercase tracking-widest text-amber-500 font-semibold mb-1">Certificate of Completion</h4>
                          <p className="text-[10px] italic text-amber-100/60">This credential is proudly presented to</p>
                        </div>

                        {/* Recipient */}
                        <div className="text-center my-2">
                          <h2 className="text-xl md:text-2xl font-bold font-serif text-white tracking-wide border-b border-white/10 pb-1 inline-block px-6">
                            John Doe
                          </h2>
                          <p className="text-[10px] text-amber-100/60 mt-1 max-w-sm mx-auto font-serif">
                            for completing all curriculum requirements in the onboarding journey
                          </p>
                          <h3 className="text-xs md:text-sm font-bold text-white mt-1">
                            Talnova General Onboarding
                          </h3>
                        </div>

                        {/* Certificate Footer */}
                        <div className="flex justify-between items-end border-t border-white/10 pt-3 text-[9px] font-mono">
                          <div>
                            <p className="text-amber-500/70 font-semibold">ISSUED DATE</p>
                            <p>{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          </div>
                          
                          {/* Signature block */}
                          <div className="text-center max-w-[120px] flex flex-col items-center">
                            {certSignatureUrl ? (
                              <img src={certSignatureUrl} alt="Signature" className="h-6 object-contain mb-1 brightness-200" />
                            ) : (
                              <div className="h-6 w-16 border border-dashed border-white/20 rounded flex items-center justify-center text-[8px] text-white/40 mb-1">
                                Pending Sign
                              </div>
                            )}
                            <p className="font-semibold text-white truncate max-w-full">{certSignatoryName || 'Signatory Name'}</p>
                            <p className="text-white/50 text-[7px] truncate max-w-full">{certSignatoryTitle || 'Signatory Title'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {certTemplate === 'modern' && (
                      <div className="absolute inset-0 bg-[#0c101d] text-slate-100 flex flex-col justify-between p-8">
                        {/* Decorative Top Left Tech Accent */}
                        <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-br-full" />
                        
                        {/* Certificate Header */}
                        <div className="flex justify-between items-start z-10">
                          <div>
                            <span className="text-[8px] font-mono tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full font-semibold uppercase">Verification Credential</span>
                            <h4 className="text-base font-bold text-white mt-2">CERTIFICATE OF COMPLETION</h4>
                          </div>
                          <div className="text-right text-[8px] text-slate-400 font-mono">
                            <p>CREDENTIAL ID</p>
                            <p className="text-white font-semibold">TLNV-0000000000</p>
                          </div>
                        </div>

                        {/* Recipient */}
                        <div className="my-auto z-10">
                          <p className="text-[10px] text-slate-400">Awarded to:</p>
                          <h2 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400 tracking-tight mt-1">
                            John Doe
                          </h2>
                          <p className="text-[10px] text-slate-400 mt-2 max-w-md">
                            For completion of all core lessons, quizzes, and requirements of the learning track:
                            <span className="block text-xs font-semibold text-white mt-1">Talnova General Onboarding</span>
                          </p>
                        </div>

                        {/* Certificate Footer */}
                        <div className="flex justify-between items-end pt-4 border-t border-white/10 z-10 text-[9px] font-mono">
                          <div>
                            <p className="text-slate-500">DATE OF ISSUANCE</p>
                            <p className="text-white">{new Date().toLocaleDateString()}</p>
                          </div>
                          
                          {/* Signature block */}
                          <div className="text-right flex flex-col items-end">
                            {certSignatureUrl ? (
                              <img src={certSignatureUrl} alt="Signature" className="h-6 object-contain mb-1 brightness-200" />
                            ) : (
                              <div className="h-6 w-16 border border-dashed border-white/20 rounded flex items-center justify-center text-[8px] text-white/40 mb-1">
                                Pending Sign
                              </div>
                            )}
                            <p className="font-semibold text-white">{certSignatoryName || 'Signatory Name'}</p>
                            <p className="text-slate-400 text-[8px]">{certSignatoryTitle || 'Signatory Title'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {certTemplate === 'minimalist' && (
                      <div className="absolute inset-4 bg-slate-900 border border-white/10 text-slate-300 flex flex-col justify-between p-6">
                        {/* Certificate Header */}
                        <div>
                          <h4 className="text-xs uppercase tracking-widest text-slate-400 font-mono text-center">Completion Attestation</h4>
                        </div>

                        {/* Recipient */}
                        <div className="text-center my-auto">
                          <p className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">This is to certify that</p>
                          <h2 className="text-2xl font-light text-white my-2 tracking-wide font-sans">
                            John Doe
                          </h2>
                          <p className="text-[9px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                            has satisfied all course requirements and successfully completed the onboarding curriculum
                          </p>
                          <p className="text-xs font-semibold text-white mt-2 font-mono uppercase tracking-wider">
                            Talnova General Onboarding
                          </p>
                        </div>

                        {/* Certificate Footer */}
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10 text-[8px] font-mono">
                          <div>
                            <p className="text-slate-500">DATE</p>
                            <p className="text-white">{new Date().toLocaleDateString()}</p>
                          </div>
                          
                          {/* Signature block */}
                          <div className="flex flex-col items-end">
                            {certSignatureUrl ? (
                              <img src={certSignatureUrl} alt="Signature" className="h-6 object-contain mb-1 brightness-200" />
                            ) : (
                              <div className="h-6 w-16 border border-dashed border-white/20 rounded flex items-center justify-center text-[8px] text-white/40 mb-1">
                                Pending Sign
                              </div>
                            )}
                            <p className="font-semibold text-white">{certSignatoryName || 'Signatory Name'}</p>
                            <p className="text-slate-400 text-[7px]">{certSignatoryTitle || 'Signatory Title'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}