import { apiClient } from '../api/client';
import { Employee, ApiResponse } from '../types';

const mapBackendUserToEmployee = (user: any, departments: any[] = []): Employee => {
  const deptName = departments.find(d => d._id === user.employment?.departmentId)?.name || 'General';
  return {
    id: user._id,
    name: user.profile?.fullName || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || 'Employee',
    firstName: user.profile?.firstName || '',
    lastName: user.profile?.lastName || '',
    role: user.permissions?.role || 'employee',
    department: deptName,
    status: user.employment?.status === 'active' ? 'Active' : (user.employment?.status === 'onboarding' ? 'Onboarding' : 'Inactive'),
    progress: user.statistics?.completionRate || 0,
    email: user.auth?.email || '',
    location: user.profile?.location || '',
    phone: user.profile?.phone || '',
    timezone: user.profile?.timezone || '',
    hireDate: user.employment?.hireDate ? new Date(user.employment.hireDate).toLocaleDateString() : '',
    completedJourneysCount: user.statistics?.completedJourneys || 0,
    certificatesCount: user.statistics?.certificates || 0,
    avatar: user.profile?.avatar?.publicUrl || '',
    assignedJourneys: [],
    designation: user.employment?.designation || '',
    payrollCategory: user.employment?.payrollCategory || ''
  };
};

export const employeeService = {
  getEmployees: async (params?: { search?: string; departmentId?: string; status?: string; role?: string; page?: number; limit?: number }): Promise<{ employees: Employee[]; total: number; page: number; limit: number; totalPages: number }> => {
    // 1. Fetch departments to translate departmentId
    const deptRes = await apiClient.get<ApiResponse<any[]>>('/organizations/departments').catch(() => ({ data: { data: [] } }));
    const departments = deptRes.data.data || [];

    // 2. Fetch employees
    const response = await apiClient.get<ApiResponse<any[]>>('/employees', { params });
    const employees = (response.data.data || []).map(u => mapBackendUserToEmployee(u, departments));
    const meta: any = response.data.meta || {};

    return {
      employees,
      total: meta.total ?? employees.length,
      page: meta.page ?? 1,
      limit: meta.limit ?? 20,
      totalPages: meta.totalPages ?? 1,
    };
  },

  getEmployee: async (id: string): Promise<Employee> => {
    // 1. Parallel fetch details, assignments, and departments
    const isMe = id === 'me' || !id;
    const [empRes, assignRes, deptRes] = await Promise.all([
      apiClient.get<ApiResponse<any>>(isMe ? '/employees/me' : `/employees/${id}`),
      apiClient.get<ApiResponse<any[]>>(isMe ? '/assignments/me' : `/assignments`, isMe ? undefined : { params: { employeeId: id } }).catch(() => ({ data: { data: [] } })),
      apiClient.get<ApiResponse<any[]>>('/organizations/departments').catch(() => ({ data: { data: [] } }))
    ]);

    const employee = empRes.data.data;
    const assignments = assignRes.data.data || [];
    const departments = deptRes.data.data || [];

    // 2. Map and merge
    const mapped = mapBackendUserToEmployee(employee, departments);
    mapped.assignedJourneys = assignments.map((a: any) => ({
      id: a._id,
      journeyId: a.journey.journeyId,
      title: a.journey.title,
      assignedAt: a.assignment?.assignedAt ? new Date(a.assignment.assignedAt).toLocaleDateString() : '',
      progress: a.progress?.completionPercentage || 0,
      status: a.status === 'completed' ? 'Completed' : 'In Progress',
      certificate: a.certificate ? {
        issued: a.certificate.issued || false,
        issuedAt: a.certificate.issuedAt ? new Date(a.certificate.issuedAt).toLocaleDateString() : undefined,
        certificateId: a.certificate.certificateId ? a.certificate.certificateId.toString() : undefined
      } : undefined
    }));

    return mapped;
  },

  createEmployee: async (employee: Partial<Employee>): Promise<Employee> => {
    // 1. Resolve departmentId
    const deptRes = await apiClient.get<ApiResponse<any[]>>('/organizations/departments').catch(() => ({ data: { data: [] } }));
    const departments = deptRes.data.data || [];
    const matchedDept = departments.find(d => d.name.toLowerCase() === employee.department?.toLowerCase());
    
    let departmentId = matchedDept?._id;
    if (!departmentId && employee.department) {
      try {
        const createDeptRes = await apiClient.post<ApiResponse<any>>('/organizations/departments', {
          name: employee.department,
          active: true
        });
        departmentId = createDeptRes.data.data._id;
      } catch (err) {
        console.error('Failed to create department:', err);
      }
    }

    // 2. Split full name
    const nameParts = (employee.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || 'First';
    const lastName = nameParts.slice(1).join(' ') || 'Last';

    // 3. Dispatch invite
    const invitePayload = {
      email: employee.email,
      firstName,
      lastName,
      role: 'employee',
      departmentId,
      employmentType: 'full_time',
      designation: employee.designation,
      payrollCategory: employee.payrollCategory,
      hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString() : undefined
    };

    const response = await apiClient.post<ApiResponse<any>>('/employees/invite', invitePayload);
    return mapBackendUserToEmployee(response.data.data, departments);
  },

  updateEmployee: async (id: string, employee: Partial<Employee> & { departmentId?: string }): Promise<Employee> => {
    const payload: Record<string, any> = {};
    if (employee.firstName) payload.firstName = employee.firstName;
    if (employee.lastName) payload.lastName = employee.lastName;
    if (employee.name && !employee.firstName) {
      const nameParts = employee.name.trim().split(/\s+/);
      payload.firstName = nameParts[0];
      payload.lastName = nameParts.slice(1).join(' ');
    }
    if (employee.role) payload.role = employee.role;
    if (employee.departmentId) payload.departmentId = employee.departmentId;
    if (employee.status) {
      payload.status = employee.status.toLowerCase();
    }
    if (employee.designation !== undefined) payload.designation = employee.designation;
    if (employee.payrollCategory !== undefined) payload.payrollCategory = employee.payrollCategory;
    if (employee.hireDate !== undefined) payload.hireDate = employee.hireDate;

    const response = await apiClient.patch<ApiResponse<any>>(`/employees/${id}`, payload);
    return mapBackendUserToEmployee(response.data.data);
  },

  deleteEmployee: async (id: string): Promise<void> => {
    await apiClient.delete(`/employees/${id}`);
  },

  updateMyProfile: async (profile: { firstName: string; lastName: string; phone?: string; location?: string; timezone?: string; avatar?: { uploadId: string; fileName: string; publicUrl?: string } }): Promise<Employee> => {
    const response = await apiClient.patch<ApiResponse<any>>('/employees/me', profile);
    return mapBackendUserToEmployee(response.data.data);
  },

  changeMyPassword: async (passwords: { oldPassword: string; newPassword: string }): Promise<void> => {
    await apiClient.patch('/employees/me/password', passwords);
  },

  importEmployees: async (users: Array<{ email: string; firstName: string; lastName: string; departmentId?: string; role?: string }>): Promise<{ successCount: number; failures: Array<{ email: string; reason: string }> }> => {
    const response = await apiClient.post<ApiResponse<any>>('/employees/import', { users });
    return response.data.data;
  }
};

