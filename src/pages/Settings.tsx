import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from
  '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import { Separator } from '../components/Separator';
import { useWorkspaceSettings, useUpdateWorkspaceSettings } from '../hooks/useSettings';
import { Skeleton } from '../components/Skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function Settings() {
  const { data: settings, isLoading, isError, error, refetch } = useWorkspaceSettings();
  const updateSettings = useUpdateWorkspaceSettings();

  const [orgName, setOrgName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#000000');

  useEffect(() => {
    if (settings) {
      setOrgName(settings.orgName || '');
      setSupportEmail(settings.supportEmail || '');
      setPrimaryColor(settings.primaryColor || '#000000');
    }
  }, [settings]);

  const handleSaveDetails = () => {
    updateSettings.mutate(
      { orgName, supportEmail },
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
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization's workspace and preferences.
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>
                Update your company information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Organization Name</label>
                <Input value={orgName} onChange={(e: any) => setOrgName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Workspace URL</label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground bg-muted px-3 py-2 rounded-md border text-sm">
                    {settings.workspaceUrl || 'acme.onboarding.app'}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium">Support Email</label>
                <Input value={supportEmail} onChange={(e: any) => setSupportEmail(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Employees will see this if they need help.
                </p>
              </div>
              <Button onClick={handleSaveDetails} disabled={updateSettings.isPending}>
                {updateSettings.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Customize the look and feel of your workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Company Logo
                  </label>
                  <div className="flex items-center gap-4">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 rounded-lg object-contain border p-1 bg-white" />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded-lg border flex items-center justify-center text-xs text-muted-foreground">
                        Logo
                      </div>
                    )}
                    <Button variant="outline">Upload New</Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full border" style={{ backgroundColor: primaryColor }} />
                    <Input value={primaryColor} onChange={(e: any) => setPrimaryColor(e.target.value)} className="w-32" />
                  </div>
                </div>
              </div>
              <Button onClick={handleSaveBranding} disabled={updateSettings.isPending}>
                {updateSettings.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Save Branding
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Roles & Permissions</CardTitle>
              <CardDescription>
                Manage who can do what in your workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Admin</h4>
                    <p className="text-sm text-muted-foreground">
                      Full access to all settings, journeys, and analytics.
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Manager</h4>
                    <p className="text-sm text-muted-foreground">
                      Can view analytics and assign journeys to their team.
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Employee</h4>
                    <p className="text-sm text-muted-foreground">
                      Can only view and complete assigned journeys.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    Default
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure default email notifications for your organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">New Assignment Emails</h4>
                  <p className="text-sm text-muted-foreground">
                    Send an email when an employee is assigned a new journey.
                  </p>
                </div>
                <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer">
                  <div className="w-4 h-4 bg-background rounded-full absolute right-0.5 top-0.5" />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">Deadline Reminders</h4>
                  <p className="text-sm text-muted-foreground">
                    Send reminders 3 days before a journey is due.
                  </p>
                </div>
                <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer">
                  <div className="w-4 h-4 bg-background rounded-full absolute right-0.5 top-0.5" />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">Weekly Manager Digest</h4>
                  <p className="text-sm text-muted-foreground">
                    Send managers a weekly summary of their team's progress.
                  </p>
                </div>
                <div className="w-10 h-5 bg-muted rounded-full relative cursor-pointer">
                  <div className="w-4 h-4 bg-background rounded-full absolute left-0.5 top-0.5 border" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}