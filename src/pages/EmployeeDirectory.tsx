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
import { Plus, Search, AlertCircle, RefreshCw, Upload, Download, CheckCircle2, Check } from 'lucide-react';
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
import { useRole } from '../context/RoleContext';

export function EmployeeDirectory() {
  const { can } = useRole();
  const canManage = can('manage_employees');
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
  const [csvError, setCsvError] = useState<string | null>(null);

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
    const headers = 'fullName,email,department,jobTitle,employmentType,hireDate\n';
    const sampleRow1 = 'Alice Walker,alice_csv@test.com,Engineering,Frontend Dev,full_time,2026-10-01\n';
    const sampleRow2 = 'Bob Martinez,bob_csv@test.com,Marketing,Content Specialist,full_time,2026-10-01\n';
    const sampleRow3 = 'Charlie Kim,charlie_csv@test.com,Sales,Account Exec,full_time,2026-10-01\n';
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + sampleRow1 + sampleRow2 + sampleRow3);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'talnova_employee_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sample CSV template downloaded successfully.');
  };

  function parseCSVContent(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += c;
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const rows = parseCSVContent(text);
      if (rows.length < 2) {
        setCsvError('CSV file is empty or missing data rows.');
        toast.error('CSV file is empty or missing data rows.');
        setParsedEmployees([]);
        return;
      }

      const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ''));

      const emailIdx = headers.findIndex((h) => h === 'email' || h === 'emailaddress');
      const fullNameIdx = headers.findIndex((h) => h === 'fullname' || h === 'name');
      const firstIdx = headers.findIndex((h) => h === 'firstname' || h === 'first');
      const lastIdx = headers.findIndex((h) => h === 'lastname' || h === 'last');
      const deptIdx = headers.findIndex((h) => h === 'department' || h === 'departmentid' || h === 'dept');
      const jobIdx = headers.findIndex((h) => h === 'jobtitle' || h === 'designation' || h === 'title');
      const empTypeIdx = headers.findIndex((h) => h === 'employmenttype' || h === 'type');
      const hireIdx = headers.findIndex((h) => h === 'hiredate' || h === 'startdate' || h === 'dateofjoin');
      const roleIdx = headers.findIndex((h) => h === 'role' || h === 'systemrole');

      // Negative check: Missing email header
      if (emailIdx === -1) {
        const errorMsg = "CSV missing required column: 'email'";
        setCsvError(errorMsg);
        toast.error(errorMsg);
        setParsedEmployees([]);
        return;
      }

      // Check required name header
      if (fullNameIdx === -1 && (firstIdx === -1 || lastIdx === -1)) {
        const errorMsg = "CSV missing required column: 'fullName' (or 'firstName' and 'lastName')";
        setCsvError(errorMsg);
        toast.error(errorMsg);
        setParsedEmployees([]);
        return;
      }

      const parsedList: any[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || row.every((val) => !val)) continue;

        const email = (row[emailIdx] || '').trim();
        let firstName = firstIdx !== -1 ? (row[firstIdx] || '').trim() : '';
        let lastName = lastIdx !== -1 ? (row[lastIdx] || '').trim() : '';
        const fullName = fullNameIdx !== -1 ? (row[fullNameIdx] || '').trim() : '';

        if (!firstName && fullName) {
          const parts = fullName.split(/\s+/);
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || '';
        }

        const department = deptIdx !== -1 ? (row[deptIdx] || '').trim() : undefined;
        const jobTitle = jobIdx !== -1 ? (row[jobIdx] || '').trim() : undefined;
        const employmentType = empTypeIdx !== -1 ? (row[empTypeIdx] || '').trim() : 'full_time';
        const hireDate = hireIdx !== -1 ? (row[hireIdx] || '').trim() : undefined;
        const role = roleIdx !== -1 && ['owner', 'admin', 'manager', 'employee'].includes(row[roleIdx]?.trim().toLowerCase())
          ? row[roleIdx]?.trim().toLowerCase()
          : 'employee';

        if (email && (fullName || firstName)) {
          parsedList.push({
            email,
            firstName: firstName || 'Employee',
            lastName: lastName || '',
            fullName: fullName || `${firstName} ${lastName}`.trim(),
            department,
            departmentId: department,
            jobTitle,
            designation: jobTitle,
            employmentType: employmentType || 'full_time',
            hireDate,
            role,
            isValid: true,
          });
        }
      }

      if (parsedList.length === 0) {
        setCsvError('No valid employee rows could be parsed from the CSV.');
        toast.error('No valid employee rows could be parsed from the CSV.');
        setParsedEmployees([]);
      } else {
        setParsedEmployees(parsedList);
        setCsvError(null);
        toast.success(`Successfully parsed ${parsedList.length} employees.`);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkImportSubmit = async () => {
    if (parsedEmployees.length === 0) return;

    try {
      const CHUNK_SIZE = 250;
      let totalSuccess = 0;
      const allFailures: Array<{ email: string; reason: string }> = [];

      for (let i = 0; i < parsedEmployees.length; i += CHUNK_SIZE) {
        const chunk = parsedEmployees.slice(i, i + CHUNK_SIZE);
        const res = await importEmployeesMutation.mutateAsync(chunk);
        totalSuccess += res.imported ?? res.successCount ?? 0;
        if (res.failures && res.failures.length > 0) {
          allFailures.push(...res.failures);
        } else if (res.errors && res.errors.length > 0) {
          allFailures.push(...res.errors);
        }
      }

      toast.success(`Successfully imported ${totalSuccess} employees.`);
      if (allFailures.length > 0) {
        toast.warning(`Skipped / Failed to import ${allFailures.length} employees.`);
      }
      setImportDialogOpen(false);
      setParsedEmployees([]);
      setCsvError(null);
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
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
          {/* Bulk Import Trigger */}
          <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) setCsvError(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2" data-testid="bulk-import-trigger">
                <Upload className="h-4 w-4" /> Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col">
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
                  <span className="font-semibold text-foreground block">Accepted Headers:</span>
                  <p className="text-muted-foreground font-mono text-[11px]">
                    fullName, email, department, jobTitle, employmentType, hireDate
                  </p>
                </div>

                <div className="p-6 border-2 border-dashed border-muted rounded-lg text-center space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-sm font-medium">Click to select CSV file</p>
                  <p className="text-xs text-muted-foreground">Accepts .csv files formatted with standard column headers.</p>
                  <Input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleCSVUpload}
                    className="hidden" 
                    id="csv-file-input"
                    data-testid="csv-file-input"
                  />
                  <Button variant="secondary" size="sm" asChild className="mt-2">
                    <label htmlFor="csv-file-input" className="cursor-pointer">
                      Choose CSV File
                    </label>
                  </Button>
                </div>

                {/* Error Banner for Malformed CSV / Missing Headers */}
                {csvError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-xs font-medium flex items-center gap-2" data-testid="csv-header-error">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{csvError}</span>
                  </div>
                )}

                {/* Preview Table with Green Checkmarks */}
                {parsedEmployees.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span data-testid="parsed-count-label">{parsedEmployees.length} valid rows ready to import</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setParsedEmployees([]); setCsvError(null); }} className="h-6 px-1.5 text-xs text-destructive">
                        Clear
                      </Button>
                    </div>
                    <div className="max-h-[220px] overflow-y-auto border rounded-md divide-y text-xs" data-testid="preview-rows-container">
                      {parsedEmployees.map((pe, idx) => (
                        <div key={idx} className="p-2.5 flex justify-between items-center gap-2 hover:bg-muted/50" data-testid={`preview-row-${idx}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" data-testid={`row-valid-check-${idx}`} />
                            <div className="truncate">
                              <span className="font-medium text-foreground block truncate">{pe.fullName || `${pe.firstName} ${pe.lastName}`}</span>
                              <span className="text-muted-foreground block truncate text-[11px]">{pe.email}</span>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5 text-right">
                            <div className="text-[11px] text-muted-foreground hidden sm:block">
                              {pe.department && <span className="mr-1">{pe.department} •</span>}
                              <span>{pe.jobTitle || pe.designation || 'Staff'}</span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground uppercase text-[10px] font-medium">
                              {pe.employmentType || 'full_time'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setImportDialogOpen(false); setCsvError(null); }}>
                  Cancel
                </Button>
                <Button 
                  id="confirm-import-btn"
                  data-testid="confirm-import-btn"
                  onClick={handleBulkImportSubmit} 
                  disabled={parsedEmployees.length === 0 || !!csvError || importEmployeesMutation.isPending}
                >
                  {importEmployeesMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Import
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