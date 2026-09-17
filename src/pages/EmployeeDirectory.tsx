import { useState } from 'react';
import { Card } from '../components/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/Table';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Progress } from '../components/Progress';
import { Skeleton } from '../components/Skeleton';
import { SimplePagination } from '../components/SimplePagination';
import { Plus, Search, AlertCircle, RefreshCw, Upload, Mail } from 'lucide-react';
import { 
  useEmployees, 
  useCreateEmployee 
} from '../hooks/useEmployees';
import { useDepartments } from '../hooks/useSettings';
import { useOrganizationCapabilities } from '../hooks/useOrganizationCapabilities';
import { BulkImportWizard } from '../components/employees/BulkImportWizard';
import { EmployeeAvatar } from '../components/EmployeeAvatar';
import { Input } from '../components/Input';
import { Link, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter
} from '../components/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/Select';
import { SearchableSelect } from '../components/SearchableSelect';
import { toast } from 'sonner';
import { useRole } from '../context/RoleContext';

export function EmployeeDirectory() {
  const navigate = useNavigate();
  const { can, role } = useRole();
  const canManage = can('manage_employees');
  const isOrgAdmin = role === 'admin' || role === 'owner' || role === 'super_admin' || role === 'hr_admin';
  const { isEmailAvailable, emailReason } = useOrganizationCapabilities();
  const [search, setSearch] = useState('');
  
  // Filtering States
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Pagination States
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const filterParams: any = { search, page, limit };
  if (selectedDeptId !== 'all') filterParams.departmentId = selectedDeptId;
  if (selectedRole !== 'all') filterParams.role = selectedRole;
  if (selectedStatus !== 'all') filterParams.status = selectedStatus;

  const { data: employeesRes, isLoading, isError, error, refetch } = useEmployees(filterParams);
  const employees = Array.isArray(employeesRes) ? employeesRes : (employeesRes?.employees || []);
  const totalEmployees = Array.isArray(employeesRes) ? employees.length : (employeesRes?.total || 0);
  const totalPages = Array.isArray(employeesRes) ? Math.ceil(employees.length / limit) || 1 : (employeesRes?.totalPages || 1);
  const createEmployee = useCreateEmployee();
  const { data: activeDepartments = [] } = useDepartments();

  // Invite Modal States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [payrollCategory, setPayrollCategory] = useState('');
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);

  // Import Wizard State
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const defaultDepts = ["Engineering", "Product", "Design", "Marketing", "Operations"];
  const displayDepartments = activeDepartments.length > 0
    ? activeDepartments.map((d: any) => d.name)
    : defaultDepts;

  const handleInvite = () => {
    if (!name || !email || !department) {
      toast.error('Name, Email, and Department are required.');
      return;
    }
    createEmployee.mutate(
      {
        name,
        email,
        role: 'employee',
        department,
        status: 'Onboarding',
        progress: 0,
        designation,
        payrollCategory,
        hireDate
      },
      {
        onSuccess: () => {
          toast.success('Employee invited successfully!');
          setDialogOpen(false);
          setName('');
          setEmail('');
          setDesignation('');
          setDepartment('');
          setPayrollCategory('');
          setHireDate(new Date().toISOString().split('T')[0]);
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to invite employee.');
        }
      }
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Directory</h1>
          <p className="text-muted-foreground">
            Manage employees and track their progress.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
          {/* Dynamic Bulk Import Trigger & Wizard */}
          <Button
            variant="outline"
            className="flex items-center gap-2"
            data-testid="bulk-import-trigger"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4" /> Bulk Import
          </Button>

          <BulkImportWizard
            isOpen={importDialogOpen}
            onClose={() => setImportDialogOpen(false)}
            onSuccess={() => refetch()}
          />

          {/* Invite Employee Trigger */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Invite Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden">
              <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-card">
                <DialogTitle className="text-lg font-bold">Invite Employee</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Send an onboarding activation invite to a newly hired team member.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3.5 p-5 sm:p-6 overflow-y-auto max-h-[calc(85vh-140px)] text-xs">
                {!isEmailAvailable && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs flex flex-col gap-2" data-testid="email-capability-invite-banner">
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold text-foreground">Email Delivery Not Configured: </span>
                        <span className="text-muted-foreground">
                          {emailReason || 'Your organization must configure email delivery before invitations can be dispatched.'}
                        </span>
                      </div>
                    </div>
                    {isOrgAdmin && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDialogOpen(false);
                          navigate('/settings?tab=email');
                        }}
                        className="w-fit text-xs h-7 border-amber-500/40 hover:bg-amber-500/20"
                      >
                        Configure Email in Settings
                      </Button>
                    )}
                  </div>
                )}
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Full Name *</label>
                  <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Jane Doe" className="text-xs" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Email Address *</label>
                  <Input value={email} onChange={(e: any) => setEmail(e.target.value)} type="email" placeholder="jane@company.com" className="text-xs" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Designation *</label>
                  <Input value={designation} onChange={(e: any) => setDesignation(e.target.value)} placeholder="Software Engineer" className="text-xs" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Department *</label>
                  <SearchableSelect
                    value={department}
                    onChange={setDepartment}
                    placeholder="Search & select department..."
                    searchPlaceholder="Search department..."
                    options={displayDepartments.map((deptName) => ({
                      value: deptName,
                      label: deptName,
                    }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Date of Join *</label>
                  <Input type="date" value={hireDate} onChange={(e: any) => setHireDate(e.target.value)} className="text-xs" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Payroll Category</label>
                  <Input value={payrollCategory} onChange={(e: any) => setPayrollCategory(e.target.value)} placeholder="e.g. Standard, Executive" className="text-xs" />
                </div>
              </div>
              <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleInvite} disabled={createEmployee.isPending}>
                  {createEmployee.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        )}
      </div>

      {/* Directory Filters Bar */}
      <div className="flex flex-wrap gap-3 items-center w-full">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            className="pl-9"
            value={search}
            onChange={(e: any) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {/* Department Filter */}
        <Select value={selectedDeptId} onValueChange={(val) => { setSelectedDeptId(val); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Department: All" />
          </SelectTrigger>
          <SelectContent className="z-[999]">
            <SelectItem value="all">All Departments</SelectItem>
            {activeDepartments.map((d: any) => (
              <SelectItem key={d._id} value={d._id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Role Filter */}
        <Select value={selectedRole} onValueChange={(val) => { setSelectedRole(val); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Role: All" />
          </SelectTrigger>
          <SelectContent className="z-[999]">
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="admin">Administrator</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={selectedStatus} onValueChange={(val) => { setSelectedStatus(val); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status: All" />
          </SelectTrigger>
          <SelectContent className="z-[999]">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="onboarding">Onboarding</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {(selectedDeptId !== 'all' || selectedRole !== 'all' || selectedStatus !== 'all' || search) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedDeptId('all');
              setSelectedRole('all');
              setSelectedStatus('all');
              setSearch('');
              setPage(1);
            }}
            className="text-xs h-9 px-2 text-muted-foreground hover:text-foreground"
          >
            Clear Filters
          </Button>
        )}
      </div>

      <div className="hidden md:block">
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading Skeleton State
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-36" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-2 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                // Error State
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-destructive">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-6 w-6" />
                      <p className="font-semibold text-sm">Failed to load employee directory</p>
                      <p className="text-xs text-muted-foreground">{(error as any)?.message || 'An error occurred.'}</p>
                      <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                        <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                // Empty State
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <p className="font-medium text-sm">No employees found</p>
                    <p className="text-xs">Try clearing filters or invite new team members.</p>
                  </TableCell>
                </TableRow>
              ) : (
                // Success State
                employees.map((employee) => (
                  <TableRow key={employee.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">
                      <Link
                        to={`/directory/${employee.id}`}
                        className="flex items-center gap-3 group py-0.5">
                        <EmployeeAvatar
                          src={employee.avatar}
                          name={employee.name}
                          email={employee.email}
                          userId={employee.id}
                          size="sm"
                          status={employee.status === 'Active' ? 'online' : employee.status === 'Onboarding' ? 'onboarding' : undefined}
                        />
                        <div className="min-w-0">
                          <span className="group-hover:underline group-hover:text-primary transition-colors font-semibold text-foreground block truncate">
                            {employee.name}
                          </span>
                          <span className="text-xs text-muted-foreground block truncate">
                            {employee.email}
                          </span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{employee.designation || employee.role}</TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          employee.status === 'Active' ? 'default' : employee.status === 'Onboarding' ? 'secondary' : 'destructive'
                        }>
                        {employee.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[200px]">
                      <div className="flex items-center gap-2">
                        <Progress value={employee.progress} className="h-2" />
                        <span className="text-xs text-muted-foreground w-8">
                          {employee.progress}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!isLoading && !isError && totalEmployees > 0 && (
            <div className="p-4 border-t bg-card">
              <SimplePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalEmployees}
                startIndex={totalEmployees === 0 ? 0 : (page - 1) * limit + 1}
                endIndex={Math.min(page * limit, totalEmployees)}
                pageSize={limit}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setLimit(newSize);
                  setPage(1);
                }}
                itemLabel="employees"
              />
            </div>
          )}
        </Card>
      </div>

      <div className="md:hidden space-y-3">
        {isLoading ? (
          // Loading Skeleton State
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 border rounded-lg space-y-3 bg-card animate-pulse">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-24" />
              <div className="flex items-center gap-2 pt-1">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-4 w-8" />
              </div>
            </div>
          ))
        ) : isError ? (
          // Error State
          <div className="p-8 text-center border rounded-lg bg-card text-destructive flex flex-col items-center justify-center gap-2">
            <AlertCircle className="h-8 w-8" />
            <p className="font-semibold">Failed to load directory</p>
            <p className="text-xs text-muted-foreground">{(error as any)?.message || 'An error occurred.'}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : employees.length === 0 ? (
          // Empty State
          <div className="p-8 text-center border rounded-lg bg-card text-muted-foreground">
            <p className="font-medium">No employees found</p>
            <p className="text-xs">Try clearing filters or invite new team members.</p>
          </div>
        ) : (
          // Success State
          <>
            {employees.map((employee) => (
              <div key={employee.id} className="p-4 border rounded-xl bg-card space-y-3 shadow-sm hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar
                      src={employee.avatar}
                      name={employee.name}
                      email={employee.email}
                      userId={employee.id}
                      size="md"
                      status={employee.status === 'Active' ? 'online' : employee.status === 'Onboarding' ? 'onboarding' : undefined}
                    />
                    <div>
                      <Link
                        to={`/directory/${employee.id}`}
                        className="font-semibold text-base hover:underline text-foreground block">
                        {employee.name}
                      </Link>
                      <span className="text-xs text-muted-foreground capitalize">
                        {employee.designation || employee.role} • {employee.department}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      employee.status === 'Active' ? 'default' : employee.status === 'Onboarding' ? 'secondary' : 'destructive'
                    }>
                    {employee.status}
                  </Badge>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{employee.progress}%</span>
                  </div>
                  <Progress value={employee.progress} className="h-1.5" />
                </div>
              </div>
            ))}

            {!isLoading && !isError && totalEmployees > 0 && (
              <div className="p-4 border rounded-lg bg-card">
                <SimplePagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={totalEmployees}
                  startIndex={totalEmployees === 0 ? 0 : (page - 1) * limit + 1}
                  endIndex={Math.min(page * limit, totalEmployees)}
                  pageSize={limit}
                  onPageChange={setPage}
                  onPageSizeChange={(newSize) => {
                    setLimit(newSize);
                    setPage(1);
                  }}
                  itemLabel="employees"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}