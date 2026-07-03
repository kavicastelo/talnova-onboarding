import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeService } from '../services/employee.service';
import { Employee } from '../types';

export function useEmployees(params?: { search?: string; departmentId?: string; status?: string; role?: string }) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => employeeService.getEmployees(params),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeService.getEmployee(id),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeeService.createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, employee }: { id: string; employee: Partial<Employee> }) =>
      employeeService.updateEmployee(id, employee),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', variables.id] });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeeService.deleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeeService.updateMyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}

export function useChangeMyPassword() {
  return useMutation({
    mutationFn: employeeService.changeMyPassword,
  });
}

export function useImportEmployees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeeService.importEmployees,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
