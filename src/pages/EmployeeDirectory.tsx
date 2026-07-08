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
import { Plus, Search, AlertCircle, RefreshCw, Upload, Download } from 'lucide-react';
import { 
  useEmployees, 
  useCreateEmployee, 
  useImportEmployees 
} from '../hooks/useEmployees';
import { useDepartments } from '../hooks/useSettings';
import { Input } from '../components/Input';
import { Link } from 'react-router-dom';
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
import { toast } from 'sonner';

export function EmployeeDirectory() {
  const [search, setSearch] = useState('');
  
  // Filtering States
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const filterParams: any = { search };
  if (selectedDeptId !== 'all') filterParams.departmentId = selectedDeptId;
  if (selectedRole !== 'all') filterParams.role = selectedRole;
  if (selectedStatus !== 'all') filterParams.status = selectedStatus;

  const { data: employees = [], isLoading, isError, error, refetch } = useEmployees(filterParams);
  const createEmployee = useCreateEmployee();
  const importEmployeesMutation = useImportEmployees();
  const { data: activeDepartments = [] } = useDepartments();

  // Invite Modal States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [payrollCategory, setPayrollCategory] = useState('');
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);

  // Import Modal States
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parsedEmployees, setParsedEmployees] = useState<any[]>([]);

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

  const downloadSampleCSV = () => {
    const headers = 'email,firstName,lastName,departmentId,role,employeeId,designation,payrollCategory,employmentType,hireDate,phone,location,timezone\n';
    const sampleRow1 = 'jane.doe@example.com,Jane,Doe,,employee,EMP001,Software Engineer,Standard,full_time,2026-07-01,+1234567890,New York,America/New_York\n';
    const sampleRow2 = 'john.smith@example.com,John,Smith,,admin,EMP002,Project Manager,Executive,full_time,2026-07-01,+1987654321,London,Europe/London\n';
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + sampleRow1 + sampleRow2);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'talnova_employee_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sample CSV template downloaded successfully.');
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        toast.error('CSV file is empty or missing data rows.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const emailIdx = headers.indexOf('email');
      const firstIdx = headers.indexOf('firstname');
      const lastIdx = headers.indexOf('lastname');
      const deptIdx = headers.indexOf('departmentid');
      const roleIdx = headers.indexOf('role');
      const empIdIdx = headers.indexOf('employeeid');
      const desIdx = headers.indexOf('designation');
      const payIdx = headers.indexOf('payrollcategory');
      const typeIdx = headers.indexOf('employmenttype');
      const hireIdx = headers.indexOf('hiredate');
      const phoneIdx = headers.indexOf('phone');
      const locIdx = headers.indexOf('location');
      const tzIdx = headers.indexOf('timezone');

      if (emailIdx === -1 || firstIdx === -1 || lastIdx === -1) {
        toast.error('CSV must contain "email", "firstName", and "lastName" columns.');
        return;
      }

      const parsedList: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(val => val.trim());
        if (row.length < 3) continue;

        const email = row[emailIdx];
        const firstName = row[firstIdx];
        const lastName = row[lastIdx];
        const departmentId = deptIdx !== -1 ? row[deptIdx] : undefined;
        const role = roleIdx !== -1 ? row[roleIdx] : 'employee';
        const employeeId = empIdIdx !== -1 ? row[empIdIdx] : undefined;
        const designation = desIdx !== -1 ? row[desIdx] : undefined;
        const payrollCategory = payIdx !== -1 ? row[payIdx] : undefined;
        const employmentType = typeIdx !== -1 ? row[typeIdx] : undefined;
        const hireDate = hireIdx !== -1 ? row[hireIdx] : undefined;
        const phone = phoneIdx !== -1 ? row[phoneIdx] : undefined;
        const location = locIdx !== -1 ? row[locIdx] : undefined;
        const timezone = tzIdx !== -1 ? row[tzIdx] : undefined;

        if (email && firstName && lastName) {
          parsedList.push({
            email,
            firstName,
            lastName,
            departmentId: departmentId || undefined,
            role: role || 'employee',
            employeeId: employeeId || undefined,
            designation: designation || undefined,
            payrollCategory: payrollCategory || undefined,
            employmentType: employmentType || undefined,
            hireDate: hireDate || undefined,
            phone: phone || undefined,
            location: location || undefined,
            timezone: timezone || undefined
          });
        }
      }

      if (parsedList.length === 0) {
        toast.error('No valid rows could be parsed from the CSV.');
      } else {
        setParsedEmployees(parsedList);
        toast.success(`Successfully parsed ${parsedList.length} employees.`);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkImportSubmit = async () => {
    if (parsedEmployees.length === 0) return;

    try {
      const res = await importEmployeesMutation.mutateAsync(parsedEmployees);
      toast.success(`Successfully imported ${res.successCount} employees.`);
      if (res.failures.length > 0) {
        toast.warning(`Failed to import ${res.failures.length} employees.`);
      }
      setImportDialogOpen(false);
      setParsedEmployees([]);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to import employees.');
    }
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
        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk Import Trigger */}
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Bulk Import Employees</DialogTitle>
                <DialogDescription>
                  Upload a CSV file containing employee details. The default password for all imported accounts will be set to <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-sm font-semibold">Welcome@2026!</code>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-1">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs text-muted-foreground">Need a template?</span>
                  <Button variant="link" size="sm" onClick={downloadSampleCSV} className="h-auto p-0 text-xs flex items-center gap-1 font-semibold text-primary">
                    <Download className="h-3 w-3" /> Download Sample CSV
                  </Button>
                </div>
                <div className="bg-muted/30 border border-muted/50 rounded-md p-3 text-xs space-y-2">
                  <span className="font-semibold text-foreground block">Field Value Guidelines:</span>
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                    <li>
                      <strong className="text-foreground">role:</strong> <code className="bg-muted px-1 rounded">owner</code>, <code className="bg-muted px-1 rounded">admin</code>, <code className="bg-muted px-1 rounded">manager</code>, or <code className="bg-muted px-1 rounded">employee</code> (default)
                    </li>
                    <li>
                      <strong className="text-foreground">employmentType:</strong> <code className="bg-muted px-1 rounded">full_time</code> (default), <code className="bg-muted px-1 rounded">part_time</code>, <code className="bg-muted px-1 rounded">contractor</code>, or <code className="bg-muted px-1 rounded">intern</code>
                    </li>
                  </ul>
                </div>

                <div className="p-6 border-2 border-dashed border-muted rounded-lg text-center space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-sm font-medium">Click to select CSV file</p>
                  <p className="text-xs text-muted-foreground">CSV header: email, firstName, lastName, departmentId (opt), role (opt), employeeId (opt), designation (opt), payrollCategory (opt), employmentType (opt), hireDate (opt), phone (opt), location (opt), timezone (opt)</p>
                  <Input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleCSVUpload}
                    className="hidden" 
                    id="csv-file-input"
                  />
                  <Button variant="secondary" size="sm" asChild className="mt-2">
                    <label htmlFor="csv-file-input" className="cursor-pointer">
                      Choose CSV File
                    </label>
                  </Button>
                </div>

                {parsedEmployees.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold flex justify-between">
                      <span>Parsed {parsedEmployees.length} employees:</span>
                      <Button variant="ghost" size="sm" onClick={() => setParsedEmployees([])} className="h-6 px-1.5 text-xs text-destructive">
                        Clear
                      </Button>
                    </div>
                    <div className="max-h-[180px] overflow-y-auto border rounded-md divide-y text-xs">
                      {parsedEmployees.map((pe, idx) => (
                        <div key={idx} className="p-2 flex justify-between items-center gap-2 hover:bg-muted/50">
                          <div className="truncate">
                            <span className="font-medium text-foreground">{pe.firstName} {pe.lastName}</span>
                            <span className="text-muted-foreground block truncate">{pe.email}</span>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground uppercase text-[10px]">
                              {pe.role || 'employee'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleBulkImportSubmit} 
                  disabled={parsedEmployees.length === 0 || importEmployeesMutation.isPending}
                >
                  {importEmployeesMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Import Users
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Invite Employee Trigger */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Invite Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Invite Employee</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input value={email} onChange={(e: any) => setEmail(e.target.value)} type="email" placeholder="jane@company.com" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Designation</label>
                  <Input value={designation} onChange={(e: any) => setDesignation(e.target.value)} placeholder="Software Engineer" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Department</label>
                  <Select value={department} onValueChange={setDepartment} className="w-full">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {displayDepartments.map((deptName) => (
                        <SelectItem key={deptName} value={deptName}>
                          {deptName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Date of Join</label>
                  <Input type="date" value={hireDate} onChange={(e: any) => setHireDate(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Payroll Category</label>
                  <Input value={payrollCategory} onChange={(e: any) => setPayrollCategory(e.target.value)} placeholder="e.g. Standard, Executive" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={createEmployee.isPending}>
                  {createEmployee.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Directory Filters Bar */}
      <div className="flex flex-wrap gap-3 items-center w-full">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            className="pl-9"
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
          />
        </div>

        {/* Department Filter */}
        <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
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
        <Select value={selectedRole} onValueChange={setSelectedRole}>
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
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
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
            }}
            className="text-xs h-9 px-2 text-muted-foreground hover:text-foreground"
          >
            Clear Filters
          </Button>
        )}
      </div>

      <div className="hidden md:block">
        <Card>
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
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-2 w-32" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                // Error State
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-destructive">
                      <AlertCircle className="h-8 w-8" />
                      <p className="font-semibold">Failed to load directory</p>
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
                    <p className="font-medium">No employees found</p>
                    <p className="text-xs">Try clearing filters or invite new team members.</p>
                  </TableCell>
                </TableRow>
              ) : (
                // Success State
                employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/directory/${employee.id}`}
                        className="hover:underline">
                        {employee.name}
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
          employees.map((employee) => (
            <div key={employee.id} className="p-4 border rounded-lg bg-card space-y-3 shadow-sm hover:border-primary/50 transition-colors">
              <div className="flex justify-between items-start gap-2">
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
          ))
        )}
      </div>
    </div>
  );
}