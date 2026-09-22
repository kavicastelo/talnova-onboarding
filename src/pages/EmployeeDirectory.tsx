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
import { Plus, Search, AlertCircle, RefreshCw, Upload, Mail, Shield, ShieldCheck } from 'lucide-react';
import { 
  useEmployees, 
  useCreateEmployee,
  useUpdateEmployee
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
  DialogBody,
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
import { useTranslation } from 'react-i18next';

export function EmployeeDirectory() {
  const { t } = useTranslation(['directory', 'common']);
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
  const [employmentType, setEmploymentType] = useState<'full_time' | 'part_time' | 'contractor' | 'intern'>('full_time');
  const [payrollCategory, setPayrollCategory] = useState('Salaried (Exempt)');
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);

  // Import Wizard State
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Manage Role Modal State
  const updateEmployee = useUpdateEmployee();
  const [manageRoleEmployee, setManageRoleEmployee] = useState<any>(null);
  const [selectedPrimaryRole, setSelectedPrimaryRole] = useState<string>('employee');
  const [selectedFunctionalRoles, setSelectedFunctionalRoles] = useState<string[]>([]);

  const handleOpenManageRole = (emp: any) => {
    setManageRoleEmployee(emp);
    setSelectedPrimaryRole(emp.role || 'employee');
    const assignedRoles = Array.isArray(emp.roles) && emp.roles.length > 0 ? emp.roles : [emp.role];
    setSelectedFunctionalRoles(assignedRoles);
  };

  const toggleFunctionalRole = (roleKey: string) => {
    setSelectedFunctionalRoles((prev) =>
      prev.includes(roleKey) ? prev.filter((r) => r !== roleKey) : [...prev, roleKey]
    );
  };

  const handleSaveRoles = () => {
    if (!manageRoleEmployee) return;
    const combinedRoles = Array.from(new Set([selectedPrimaryRole, ...selectedFunctionalRoles])).filter(Boolean);
    updateEmployee.mutate(
      {
        id: manageRoleEmployee.id,
        employee: {
          role: selectedPrimaryRole as any,
          roles: combinedRoles,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('manageRoleModal.success', { name: manageRoleEmployee.name, defaultValue: `Roles updated successfully for ${manageRoleEmployee.name}` }));
          setManageRoleEmployee(null);
          refetch();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('manageRoleModal.failed', { defaultValue: 'Failed to update roles' }));
        },
      }
    );
  };

  const defaultDepts = ["Engineering", "Product", "Design", "Marketing", "Operations"];
  const displayDepartments = activeDepartments.length > 0
    ? activeDepartments.map((d: any) => d.name)
    : defaultDepts;

  const handleInvite = () => {
    if (!name || !email || !department) {
      toast.error(t('inviteModal.requiredFields', { defaultValue: 'Name, Email, and Department are required.' }));
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
        employmentType,
        payrollCategory,
        hireDate
      },
      {
        onSuccess: () => {
          toast.success(t('inviteModal.success', { defaultValue: 'Employee invited successfully!' }));
          setDialogOpen(false);
          setName('');
          setEmail('');
          setDesignation('');
          setDepartment('');
          setEmploymentType('full_time');
          setPayrollCategory('Salaried (Exempt)');
          setHireDate(new Date().toISOString().split('T')[0]);
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('inviteModal.failed', { defaultValue: 'Failed to invite employee.' }));
        }
      }
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title', { defaultValue: 'Directory' })}</h1>
          <p className="text-muted-foreground">
            {t('subtitle', { defaultValue: 'Manage employees and track their progress.' })}
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
            <Upload className="h-4 w-4" /> {t('bulkImport', { defaultValue: 'Bulk Import' })}
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
                {t('inviteEmployee', { defaultValue: 'Invite Employee' })}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">{t('inviteModal.title', { defaultValue: 'Invite Employee' })}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {t('inviteModal.desc', { defaultValue: 'Send an onboarding activation invite to a newly hired team member.' })}
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="space-y-3.5 text-xs">
                {!isEmailAvailable && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs flex flex-col gap-2" data-testid="email-capability-invite-banner">
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold text-foreground">{t('inviteModal.emailNotConfigured', { defaultValue: 'Email Delivery Not Configured:' })} </span>
                        <span className="text-muted-foreground">
                          {emailReason || t('inviteModal.emailReasonFallback', { defaultValue: 'Your organization must configure email delivery before invitations can be dispatched.' })}
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
                        {t('inviteModal.configureEmail', { defaultValue: 'Configure Email in Settings' })}
                      </Button>
                    )}
                  </div>
                )}
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-foreground">{t('inviteModal.fullName', { defaultValue: 'Full Name *' })}</label>
                  <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder={t('inviteModal.namePlaceholder', { defaultValue: 'Jane Doe' })} className="text-xs" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-foreground">{t('inviteModal.email', { defaultValue: 'Email Address *' })}</label>
                  <Input value={email} onChange={(e: any) => setEmail(e.target.value)} type="email" placeholder={t('inviteModal.emailPlaceholder', { defaultValue: 'jane@company.com' })} className="text-xs" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-foreground">{t('inviteModal.designation', { defaultValue: 'Designation *' })}</label>
                  <Input value={designation} onChange={(e: any) => setDesignation(e.target.value)} placeholder={t('inviteModal.designationPlaceholder', { defaultValue: 'Software Engineer' })} className="text-xs" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-foreground">{t('inviteModal.department', { defaultValue: 'Department *' })}</label>
                  <SearchableSelect
                    value={department}
                    onChange={setDepartment}
                    placeholder={t('inviteModal.deptPlaceholder', { defaultValue: 'Search & select department...' })}
                    searchPlaceholder={t('inviteModal.searchDeptPlaceholder', { defaultValue: 'Search department...' })}
                    options={displayDepartments.map((deptName) => ({
                      value: deptName,
                      label: deptName,
                    }))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold text-foreground">{t('inviteModal.employmentType', { defaultValue: 'Employment Type *' })}</label>
                    <select
                      value={employmentType}
                      onChange={(e: any) => setEmploymentType(e.target.value)}
                      className="w-full h-9 px-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="full_time">{t('employmentTypes.full_time', { defaultValue: 'Full-Time' })}</option>
                      <option value="part_time">{t('employmentTypes.part_time', { defaultValue: 'Part-Time' })}</option>
                      <option value="contractor">{t('employmentTypes.contractor', { defaultValue: 'Contractor' })}</option>
                      <option value="intern">{t('employmentTypes.intern', { defaultValue: 'Intern' })}</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold text-foreground">{t('inviteModal.payrollCategory', { defaultValue: 'Payroll Type / Category *' })}</label>
                    <select
                      value={payrollCategory}
                      onChange={(e: any) => setPayrollCategory(e.target.value)}
                      className="w-full h-9 px-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="Salaried (Exempt)">{t('payrollCategories.salariedExempt', { defaultValue: 'Salaried (Exempt)' })}</option>
                      <option value="Salaried (Non-Exempt)">{t('payrollCategories.salariedNonExempt', { defaultValue: 'Salaried (Non-Exempt)' })}</option>
                      <option value="Hourly">{t('payrollCategories.hourly', { defaultValue: 'Hourly' })}</option>
                      <option value="Executive">{t('payrollCategories.executive', { defaultValue: 'Executive' })}</option>
                      <option value="Contract / 1099">{t('payrollCategories.contract1099', { defaultValue: 'Contract / 1099' })}</option>
                      <option value="Intern / Stipend">{t('payrollCategories.internStipend', { defaultValue: 'Intern / Stipend' })}</option>
                      <option value="Standard">{t('payrollCategories.standard', { defaultValue: 'Standard' })}</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-foreground">{t('inviteModal.hireDate', { defaultValue: 'Date of Join *' })}</label>
                  <Input type="date" value={hireDate} onChange={(e: any) => setHireDate(e.target.value)} className="text-xs" />
                </div>
              </DialogBody>

              <DialogFooter className="flex items-center justify-between sm:justify-between">
                <div className="text-left">
                  {!isEmailAvailable && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      {t('inviteModal.emailSetupRequired', { defaultValue: 'Email setup required to send invitations' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                    {t('inviteModal.cancel', { defaultValue: 'Cancel' })}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleInvite}
                    disabled={createEmployee.isPending || !isEmailAvailable}
                    data-testid="send-invitation-btn"
                  >
                    {createEmployee.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    {t('inviteModal.send', { defaultValue: 'Send Invitation' })}
                  </Button>
                </div>
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
            placeholder={t('searchPlaceholder', { defaultValue: 'Search employees...' })}
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
            <SelectValue placeholder={t('filters.departmentPlaceholder', { defaultValue: 'Department: All' })} />
          </SelectTrigger>
          <SelectContent className="z-[999]">
            <SelectItem value="all">{t('filters.departmentAll', { defaultValue: 'All Departments' })}</SelectItem>
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
            <SelectValue placeholder={t('filters.rolePlaceholder', { defaultValue: 'Role: All' })} />
          </SelectTrigger>
          <SelectContent className="z-[999]">
            <SelectItem value="all">{t('filters.roleAll', { defaultValue: 'All Roles' })}</SelectItem>
            <SelectItem value="owner">{t('filters.roleOwner', { defaultValue: 'Owner' })}</SelectItem>
            <SelectItem value="admin">{t('filters.roleAdmin', { defaultValue: 'Administrator' })}</SelectItem>
            <SelectItem value="manager">{t('filters.roleManager', { defaultValue: 'Manager' })}</SelectItem>
            <SelectItem value="employee">{t('filters.roleEmployee', { defaultValue: 'Employee' })}</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={selectedStatus} onValueChange={(val) => { setSelectedStatus(val); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('filters.statusPlaceholder', { defaultValue: 'Status: All' })} />
          </SelectTrigger>
          <SelectContent className="z-[999]">
            <SelectItem value="all">{t('filters.statusAll', { defaultValue: 'All Statuses' })}</SelectItem>
            <SelectItem value="active">{t('filters.statusActive', { defaultValue: 'Active' })}</SelectItem>
            <SelectItem value="onboarding">{t('filters.statusOnboarding', { defaultValue: 'Onboarding' })}</SelectItem>
            <SelectItem value="inactive">{t('filters.statusInactive', { defaultValue: 'Inactive' })}</SelectItem>
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
            {t('filters.clear', { defaultValue: 'Clear Filters' })}
          </Button>
        )}
      </div>

      <div className="hidden md:block">
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.name', { defaultValue: 'Name' })}</TableHead>
                <TableHead>{t('table.role', { defaultValue: 'Role & Permissions' })}</TableHead>
                <TableHead>{t('table.department', { defaultValue: 'Department' })}</TableHead>
                <TableHead>{t('table.status', { defaultValue: 'Status' })}</TableHead>
                <TableHead>{t('table.progress', { defaultValue: 'Progress' })}</TableHead>
                {canManage && <TableHead className="text-right">{t('table.actions', { defaultValue: 'Actions' })}</TableHead>}
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
                  <TableCell colSpan={canManage ? 6 : 5} className="h-32 text-center text-destructive">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-6 w-6" />
                      <p className="font-semibold text-sm">{t('table.error', { defaultValue: 'Failed to load employee directory' })}</p>
                      <p className="text-xs text-muted-foreground">{(error as any)?.message || t('table.defaultError', { defaultValue: 'An error occurred.' })}</p>
                      <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                        <RefreshCw className="mr-2 h-3.5 w-3.5" /> {t('table.retry', { defaultValue: 'Retry' })}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                // Empty State
                <TableRow>
                  <TableCell colSpan={canManage ? 6 : 5} className="h-32 text-center text-muted-foreground">
                    <p className="font-medium text-sm">{t('table.empty', { defaultValue: 'No employees found' })}</p>
                    <p className="text-xs">{t('table.emptySub', { defaultValue: 'Try clearing filters or invite new team members.' })}</p>
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
                    <TableCell>
                      <div className="space-y-1">
                        <span className="capitalize font-medium block text-foreground">
                          {employee.designation || employee.role}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(new Set([employee.role, ...(employee.roles || [])])).filter(Boolean).map((r) => (
                            <Badge key={r} variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                              {r.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          employee.status === 'Active' ? 'default' : employee.status === 'Onboarding' ? 'secondary' : 'destructive'
                        }>
                        {employee.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[180px]">
                      <div className="flex items-center gap-2">
                        <Progress value={employee.progress} className="h-2" />
                        <span className="text-xs text-muted-foreground w-8">
                          {employee.progress}%
                        </span>
                      </div>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => handleOpenManageRole(employee)}
                          data-testid={`manage-role-${employee.id}`}
                        >
                          <Shield className="h-3.5 w-3.5 text-primary" />
                          {t('table.manageRole', { defaultValue: 'Manage Role' })}
                        </Button>
                      </TableCell>
                    )}
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
                itemLabel={t('table.employeesLabel', { defaultValue: 'employees' })}
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
            <p className="font-semibold">{t('table.error', { defaultValue: 'Failed to load directory' })}</p>
            <p className="text-xs text-muted-foreground">{(error as any)?.message || t('table.defaultError', { defaultValue: 'An error occurred.' })}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> {t('table.retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        ) : employees.length === 0 ? (
          // Empty State
          <div className="p-8 text-center border rounded-lg bg-card text-muted-foreground">
            <p className="font-medium">{t('table.empty', { defaultValue: 'No employees found' })}</p>
            <p className="text-xs">{t('table.emptySub', { defaultValue: 'Try clearing filters or invite new team members.' })}</p>
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
                      <div className="flex flex-wrap gap-1 pt-1">
                        {Array.from(new Set([employee.role, ...(employee.roles || [])])).filter(Boolean).map((r) => (
                          <Badge key={r} variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                            {r.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
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
                    <span>{t('table.progress', { defaultValue: 'Progress' })}</span>
                    <span>{employee.progress}%</span>
                  </div>
                  <Progress value={employee.progress} className="h-1.5" />
                </div>

                {canManage && (
                  <div className="pt-2 border-t flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs gap-1.5 h-8"
                      onClick={() => handleOpenManageRole(employee)}
                    >
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      {t('table.manageRoleAccess', { defaultValue: 'Manage Role & Access' })}
                    </Button>
                  </div>
                )}
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
                  itemLabel={t('table.employeesLabel', { defaultValue: 'employees' })}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Manage Employee Role & Access Modal */}
      <Dialog open={Boolean(manageRoleEmployee)} onOpenChange={(open) => !open && setManageRoleEmployee(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <DialogTitle className="text-lg font-bold">{t('manageRoleModal.title', { defaultValue: 'Manage Roles & Permissions' })}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t('manageRoleModal.desc', { defaultValue: 'Promote, demote, or assign multi-role privileges to team members.' })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {manageRoleEmployee && (
            <DialogBody className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
                <p className="font-semibold text-foreground">{manageRoleEmployee.name}</p>
                <p className="text-muted-foreground">{manageRoleEmployee.email} • {manageRoleEmployee.department}</p>
              </div>

              {/* Primary System Role Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t('manageRoleModal.primaryRole', { defaultValue: 'Primary System Role' })}</label>
                <select
                  value={selectedPrimaryRole}
                  onChange={(e) => setSelectedPrimaryRole(e.target.value)}
                  className="w-full h-9 px-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="employee">{t('roles.employee', { defaultValue: 'Employee (Standard Access)' })}</option>
                  <option value="manager">{t('roles.manager', { defaultValue: 'Manager (Team Onboarding & Approvals)' })}</option>
                  <option value="hr_admin">{t('roles.hr_admin', { defaultValue: 'HR Administrator (People & Journeys)' })}</option>
                  <option value="it_admin">{t('roles.it_admin', { defaultValue: 'IT Administrator (Hardware & Access Provisioning)' })}</option>
                  <option value="admin">{t('roles.admin', { defaultValue: 'Administrator (Full Tenant Control)' })}</option>
                  <option value="owner">{t('roles.owner', { defaultValue: 'Organization Owner' })}</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  {t('manageRoleModal.primaryRoleHelp', { defaultValue: 'Controls the primary navigation layout and default landing portal.' })}
                </p>
              </div>

              {/* Multi-Role Capabilities Checkboxes */}
              <div className="space-y-2 pt-2 border-t">
                <label className="text-xs font-semibold text-foreground block">
                  {t('manageRoleModal.functionalRoles', { defaultValue: 'Additional Functional Roles (Multi-Role Privileges)' })}
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  {t('manageRoleModal.functionalRolesHelp', { defaultValue: 'Users can be assigned multiple roles simultaneously (e.g. an Admin who is also IT and HR Admin).' })}
                </p>

                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-2 rounded-lg border hover:bg-muted/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFunctionalRoles.includes('it_admin') || selectedPrimaryRole === 'it_admin'}
                      disabled={selectedPrimaryRole === 'it_admin'}
                      onChange={() => toggleFunctionalRole('it_admin')}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <div className="font-semibold text-foreground">{t('manageRoleModal.itAdmin', { defaultValue: 'IT Administrator' })}</div>
                      <div className="text-[11px] text-muted-foreground">{t('manageRoleModal.itAdminDesc', { defaultValue: 'Manage hardware assets, credentials & IT setups' })}</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg border hover:bg-muted/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFunctionalRoles.includes('hr_admin') || selectedPrimaryRole === 'hr_admin'}
                      disabled={selectedPrimaryRole === 'hr_admin'}
                      onChange={() => toggleFunctionalRole('hr_admin')}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <div className="font-semibold text-foreground">{t('manageRoleModal.hrAdmin', { defaultValue: 'HR Administrator' })}</div>
                      <div className="text-[11px] text-muted-foreground">{t('manageRoleModal.hrAdminDesc', { defaultValue: 'Manage onboarding programs, journeys & milestones' })}</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg border hover:bg-muted/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFunctionalRoles.includes('manager') || selectedPrimaryRole === 'manager'}
                      disabled={selectedPrimaryRole === 'manager'}
                      onChange={() => toggleFunctionalRole('manager')}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <div className="font-semibold text-foreground">{t('manageRoleModal.manager', { defaultValue: 'People Manager' })}</div>
                      <div className="text-[11px] text-muted-foreground">{t('manageRoleModal.managerDesc', { defaultValue: 'Oversee direct reports, task checklists & approvals' })}</div>
                    </div>
                  </label>
                </div>
              </div>
            </DialogBody>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setManageRoleEmployee(null)}>
              {t('inviteModal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button size="sm" onClick={handleSaveRoles} disabled={updateEmployee.isPending}>
              {updateEmployee.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              {t('manageRoleModal.save', { defaultValue: 'Save Role Changes' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}