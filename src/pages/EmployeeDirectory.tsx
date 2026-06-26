import { useState } from 'react';
import { Card } from '../components/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from
  '../components/Table';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Progress } from '../components/Progress';
import { Skeleton } from '../components/Skeleton';
import { Plus, Search, Filter, AlertCircle, RefreshCw } from 'lucide-react';
import { useEmployees, useCreateEmployee } from '../hooks/useEmployees';
import { Input } from '../components/Input';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  const { data: employees = [], isLoading, isError, error, refetch } = useEmployees({ search });
  const createEmployee = useCreateEmployee();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleName, setRoleName] = useState('');
  const [department, setDepartment] = useState('');

  const handleInvite = () => {
    if (!name || !email || !roleName || !department) {
      toast.error('All fields are required.');
      return;
    }
    createEmployee.mutate(
      {
        name,
        email,
        role: roleName,
        department,
        status: 'Onboarding',
        progress: 0
      },
      {
        onSuccess: () => {
          toast.success('Employee invited successfully!');
          setDialogOpen(false);
          setName('');
          setEmail('');
          setRoleName('');
          setDepartment('');
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to invite employee.');
        }
      }
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Directory</h1>
          <p className="text-muted-foreground">
            Manage employees and track their progress.
          </p>
        </div>
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
                <label className="text-sm font-medium">Role / Title</label>
                <Input value={roleName} onChange={(e: any) => setRoleName(e.target.value)} placeholder="Software Engineer" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Department</label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Product">Product</SelectItem>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
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

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            className="pl-9"
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

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
                  <p className="text-xs">Invite new team members to track progress here.</p>
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
                  <TableCell>{employee.role}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        employee.status === 'Active' ? 'default' : 'secondary'
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
  );
}