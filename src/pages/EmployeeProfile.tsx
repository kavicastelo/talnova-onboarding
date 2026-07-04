import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../components/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Progress } from '../components/Progress';
import {
  ChevronLeft,
  Mail,
  MapPin,
  Calendar,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Camera,
  Lock,
  Settings,
  Phone,
  Globe
} from 'lucide-react';
import { 
  useEmployee, 
  useUpdateMyProfile, 
  useChangeMyPassword, 
  useUpdateEmployee 
} from '../hooks/useEmployees';
import { useCurrentUser } from '../hooks/useAuth';
import { useDepartments } from '../hooks/useSettings';
import { uploadService } from '../services/upload.service';
import { Skeleton } from '../components/Skeleton';
import { Input } from '../components/Input';
import { Label } from '../components/Label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../components/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/Select';
import { toast } from 'sonner';

export function EmployeeProfile() {
  const { id } = useParams();
  const { data: employee, isLoading, isError, error, refetch } = useEmployee(id || 'me');
  const { data: currentUser } = useCurrentUser();
  const { data: activeDepartments = [] } = useDepartments();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editSelfOpen, setEditSelfOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [editEmployeeOpen, setEditEmployeeOpen] = useState(false);

  // Self Edit Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [locationVal, setLocationVal] = useState('');
  const [timezoneVal, setTimezoneVal] = useState('');

  // Password Form state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Admin Edit Form state
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminDeptId, setAdminDeptId] = useState('');
  const [adminRole, setAdminRole] = useState<'owner' | 'admin' | 'manager' | 'employee'>('employee');
  const [adminStatus, setAdminStatus] = useState<'active' | 'onboarding' | 'inactive'>('active');
  const [adminDesignation, setAdminDesignation] = useState('');
  const [adminPayrollCategory, setAdminPayrollCategory] = useState('');
  const [adminHireDate, setAdminHireDate] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const isOwnProfile = id === 'me' || !id || (currentUser && employee && currentUser.id === employee.id);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const updateSelfMutation = useUpdateMyProfile();
  const changePasswordMutation = useChangeMyPassword();
  const updateEmployeeMutation = useUpdateEmployee();

  useEffect(() => {
    if (employee) {
      setFirstName(employee.firstName || '');
      setLastName(employee.lastName || '');
      setPhone(employee.phone || '');
      setLocationVal(employee.location || '');
      setTimezoneVal(employee.timezone || '');

      setAdminFirstName(employee.firstName || '');
      setAdminLastName(employee.lastName || '');
      
      const matchedDept = activeDepartments.find(d => d.name === employee.department);
      setAdminDeptId(matchedDept?._id || '');
      setAdminRole((employee.role === 'owner' || employee.role === 'admin' || employee.role === 'manager' || employee.role === 'employee' ? employee.role : 'employee') as any);
      setAdminStatus(employee.status === 'Active' ? 'active' : employee.status === 'Onboarding' ? 'onboarding' : 'inactive');
      setAdminDesignation(employee.designation || '');
      setAdminPayrollCategory(employee.payrollCategory || '');
      
      let parsedDate = '';
      if (employee.hireDate) {
        const d = new Date(employee.hireDate);
        if (!isNaN(d.getTime())) {
          parsedDate = d.toISOString().split('T')[0];
        }
      }
      setAdminHireDate(parsedDate);
    }
  }, [employee, activeDepartments]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading('Uploading avatar...');

    try {
      const { uploadId, url } = await uploadService.uploadFile(file, 'public');
      
      // Update profile
      await updateSelfMutation.mutateAsync({
        firstName: firstName || employee?.firstName || '',
        lastName: lastName || employee?.lastName || '',
        phone: phone || employee?.phone || '',
        location: locationVal || employee?.location || '',
        timezone: timezoneVal || employee?.timezone || '',
        avatar: {
          uploadId,
          fileName: file.name,
          publicUrl: url
        }
      });

      toast.success('Avatar updated successfully.', { id: toastId });
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to upload avatar.', { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveSelf = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSelfMutation.mutateAsync({
        firstName,
        lastName,
        phone,
        location: locationVal,
        timezone: timezoneVal
      });
      toast.success('Profile updated successfully.');
      setEditSelfOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update profile.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    try {
      await changePasswordMutation.mutateAsync({
        oldPassword,
        newPassword
      });
      toast.success('Password changed successfully.');
      setChangePasswordOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to change password.');
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateEmployeeMutation.mutateAsync({
        id: employee!.id,
        employee: {
          firstName: adminFirstName,
          lastName: adminLastName,
          departmentId: adminDeptId || null,
          role: adminRole,
          status: adminStatus === 'active' ? 'Active' : adminStatus === 'onboarding' ? 'Onboarding' : 'Inactive',
          designation: adminDesignation,
          payrollCategory: adminPayrollCategory,
          hireDate: adminHireDate || null
        } as any
      });
      toast.success('Employee account updated successfully.');
      setEditEmployeeOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update employee.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" disabled>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Skeleton className="w-24 h-24 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <div className="max-w-md mx-auto text-center p-8 border rounded-lg space-y-4 my-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Failed to Load Profile</h2>
        <p className="text-muted-foreground">{(error as any)?.message || 'The requested employee profile was not found.'}</p>
        <Button onClick={() => refetch()} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to={isOwnProfile ? (currentUser?.role === 'employee' ? '/employee' : '/') : '/directory'}>
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Employee Profile</h1>
      </div>

      <input 
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleAvatarChange}
      />

      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            {isOwnProfile ? (
              <div 
                className="relative group cursor-pointer rounded-full overflow-hidden shrink-0"
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                <Avatar className="w-24 h-24 border-4 border-background shadow-sm transition-transform duration-200 group-hover:scale-105">
                  <AvatarImage src={employee.avatar || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-2xl">
                    {employee.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {isUploading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-5 h-5 mb-1" />
                      <span className="text-[10px] font-medium">Change Photo</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <Avatar className="w-24 h-24 border-4 border-background shadow-sm shrink-0">
                <AvatarImage src={employee.avatar || ''} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-2xl">
                  {employee.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
            )}

            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">{employee.name}</h2>
                <Badge
                  variant={
                    employee.status === 'Active' ? 'default' : employee.status === 'Onboarding' ? 'secondary' : 'destructive'
                  }>
                  {employee.status}
                </Badge>
              </div>
              <p className="text-lg text-muted-foreground capitalize">
                {employee.designation || employee.role} • {employee.department}
              </p>
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />{' '}
                  {employee.email || 'No email provided'}
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> {employee.location || 'Location not specified'}
                </div>
                {employee.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4" /> {employee.phone}
                  </div>
                )}
                {employee.timezone && (
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4" /> {employee.timezone}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> {employee.hireDate ? `Hired ${employee.hireDate}` : 'Hire date unknown'}
                </div>
                {employee.payrollCategory && (
                  <div className="flex items-center gap-1.5 bg-muted px-2 py-0.5 rounded text-xs font-semibold text-muted-foreground border">
                    Payroll: {employee.payrollCategory}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto">
              {isOwnProfile ? (
                <>
                  <Button onClick={() => setEditSelfOpen(true)} className="flex items-center gap-2 w-full">
                    <Settings className="w-4 h-4" /> Edit Profile
                  </Button>
                  <Button variant="outline" onClick={() => setChangePasswordOpen(true)} className="flex items-center gap-2 w-full">
                    <Lock className="w-4 h-4" /> Change Password
                  </Button>
                </>
              ) : isAdmin ? (
                <>
                  <Button onClick={() => setEditEmployeeOpen(true)} className="flex items-center gap-2 w-full">
                    <Settings className="w-4 h-4" /> Manage Account
                  </Button>
                  <Button variant="outline" className="w-full">Message</Button>
                </>
              ) : (
                <Button variant="outline" className="w-full">Message</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Learning History</TabsTrigger>
          <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overall Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employee.progress}%</div>
                <Progress value={employee.progress} className="h-2 mt-3" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completed Journeys
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employee.completedJourneysCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Certificates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employee.certificatesCount || 0}</div>
              </CardContent>
            </Card>
          </div>

          <h3 className="text-lg font-semibold mt-8 mb-4">Assigned Journeys</h3>
          {!employee.assignedJourneys || employee.assignedJourneys.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground border border-dashed rounded-lg text-sm">
              No active or completed onboarding journeys assigned to this employee.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {employee.assignedJourneys.map((aj) => (
                <Card key={aj.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {aj.title}
                    </CardTitle>
                    <CardDescription>Assigned {aj.assignedAt}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className={aj.status === 'Completed' ? 'text-emerald-500 font-medium flex items-center gap-1' : 'text-gray-400 font-medium'}>
                        {aj.status === 'Completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {aj.status}
                      </span>
                      <span className="font-medium">{aj.progress}%</span>
                    </div>
                    <Progress value={aj.progress} className="h-2 mb-4" />
                    {aj.status === 'Completed' ? (
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link to={`/certificates`}>
                          View Certificate
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link to={`/course/${aj.id}`}>
                          View Details
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <div className="p-8 text-center text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Learning history will appear here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent className="p-0">
              <div className="p-8 text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Recent activity timeline will appear here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog for editing own profile details */}
      <Dialog open={editSelfOpen} onOpenChange={setEditSelfOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSelf} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input 
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input 
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input 
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 019-2834"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input 
                id="location"
                value={locationVal}
                onChange={(e) => setLocationVal(e.target.value)}
                placeholder="San Francisco, CA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input 
                id="timezone"
                value={timezoneVal}
                onChange={(e) => setTimezoneVal(e.target.value)}
                placeholder="America/Los_Angeles"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setEditSelfOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateSelfMutation.isPending}>
                {updateSelfMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for rotating password */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Current Password</Label>
              <Input 
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input 
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input 
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setChangePasswordOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for admin editing other employee profiles */}
      <Dialog open={editEmployeeOpen} onOpenChange={setEditEmployeeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Employee Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEmployee} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminFirstName">First Name</Label>
                <Input 
                  id="adminFirstName"
                  value={adminFirstName}
                  onChange={(e) => setAdminFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminLastName">Last Name</Label>
                <Input 
                  id="adminLastName"
                  value={adminLastName}
                  onChange={(e) => setAdminLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminDesignation">Designation</Label>
              <Input 
                id="adminDesignation"
                value={adminDesignation}
                onChange={(e) => setAdminDesignation(e.target.value)}
                placeholder="Software Engineer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminDepartment">Department</Label>
              <Select value={adminDeptId} onValueChange={setAdminDeptId}>
                <SelectTrigger id="adminDepartment" className="w-full">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent className="z-[999]">
                  {activeDepartments.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminHireDate">Date of Join</Label>
                <Input 
                  id="adminHireDate"
                  type="date"
                  value={adminHireDate}
                  onChange={(e) => setAdminHireDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminPayrollCategory">Payroll Category</Label>
                <Input 
                  id="adminPayrollCategory"
                  value={adminPayrollCategory}
                  onChange={(e) => setAdminPayrollCategory(e.target.value)}
                  placeholder="e.g. Standard, Executive"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminRole">Role</Label>
                <Select value={adminRole} onValueChange={(val: any) => setAdminRole(val)}>
                  <SelectTrigger id="adminRole" className="w-full">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent className="z-[999]">
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminStatus">Status</Label>
                <Select value={adminStatus} onValueChange={(val: any) => setAdminStatus(val)}>
                  <SelectTrigger id="adminStatus" className="w-full">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent className="z-[999]">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setEditEmployeeOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateEmployeeMutation.isPending}>
                {updateEmployeeMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}