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
      </Tabs>
    </div>
  );
}