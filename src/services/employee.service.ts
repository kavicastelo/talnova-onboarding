import { apiClient } from '../api/client';
import { Employee, ApiResponse } from '../types';

const mapBackendUserToEmployee = (user: any, departments: any[] = []): Employee => {
  const deptName = departments.find(d => d._id === user.employment?.departmentId)?.name || 'General';
  return {
    id: user._id,
    name: user.profile?.fullName || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || 'Employee',
    role: user.permissions?.role || 'employee',
    department: deptName,
    status: user.employment?.status === 'active' ? 'Active' : (user.employment?.status === 'onboarding' ? 'Onboarding' : 'Inactive'),
    progress: user.statistics?.completionRate || 0,
    email: user.auth?.email || '',
    location: user.profile?.location || '',
    hireDate: user.employment?.hireDate ? new Date(user.employment.hireDate).toLocaleDateString() : '',
    completedJourneysCount: user.statistics?.completedJourneys || 0,
    certificatesCount: user.statistics?.certificates || 0,
    assignedJourneys: []
  };
};

export const employeeService = {
  getEmployees: async (params?: { search?: string; department?: string }): Promise<Employee[]> => {
    // 1. Fetch departments to translate departmentId
    const deptRes = await apiClient.get<ApiResponse<any[]>>('/organizations/departments').catch(() => ({ data: { data: [] } }));
    const departments = deptRes.data.data || [];

    // 2. Fetch employees
    const response = await apiClient.get<ApiResponse<any[]>>('/employees', { params });
    return (response.data.data || []).map(u => mapBackendUserToEmployee(u, departments));
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
      title: a.journey.title,
      assignedAt: a.assignment?.assignedAt ? new Date(a.assignment.assignedAt).toLocaleDateString() : '',
      progress: a.progress?.completionPercentage || 0,
      status: a.status === 'completed' ? 'Completed' : 'In Progress'
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
      employmentType: 'full_time'
    };

    const response = await apiClient.post<ApiResponse<any>>('/employees/invite', invitePayload);
    return mapBackendUserToEmployee(response.data.data, departments);
  },

  updateEmployee: async (id: string, employee: Partial<Employee>): Promise<Employee> => {
    // Split full name if specified
    const payload: Record<string, any> = {};
    if (employee.name) {
      const nameParts = employee.name.trim().split(/\s+/);
      payload.firstName = nameParts[0];
      payload.lastName = nameParts.slice(1).join(' ');
    }
    if (employee.role) payload.role = employee.role;

    const response = await apiClient.patch<ApiResponse<any>>(`/employees/${id}`, payload);
    return mapBackendUserToEmployee(response.data.data);
  },

  deleteEmployee: async (id: string): Promise<void> => {
    await apiClient.delete(`/employees/${id}`);
  }
};

