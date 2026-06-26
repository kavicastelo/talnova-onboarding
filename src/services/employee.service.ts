import { apiClient } from '../api/client';
import { Employee, ApiResponse } from '../types';

export const employeeService = {
  getEmployees: async (params?: { search?: string; department?: string }): Promise<Employee[]> => {
    const response = await apiClient.get<ApiResponse<Employee[]>>('/employees', { params });
    return response.data.data;
  },

  getEmployee: async (id: string): Promise<Employee> => {
    const response = await apiClient.get<ApiResponse<Employee>>(`/employees/${id}`);
    return response.data.data;
  },

  createEmployee: async (employee: Partial<Employee>): Promise<Employee> => {
    const response = await apiClient.post<ApiResponse<Employee>>('/employees', employee);
    return response.data.data;
  },

  updateEmployee: async (id: string, employee: Partial<Employee>): Promise<Employee> => {
    const response = await apiClient.put<ApiResponse<Employee>>(`/employees/${id}`, employee);
    return response.data.data;
  },

  deleteEmployee: async (id: string): Promise<void> => {
    await apiClient.delete(`/employees/${id}`);
  }
};
