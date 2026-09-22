import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskTemplateService, IRoleChecklistTemplate } from '../services/task-template.service';
import { toast } from 'sonner';
import i18n from '../i18n';

export function useTaskTemplates(filters?: { role?: string; department?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: ['task-templates', filters],
    queryFn: () => taskTemplateService.listTemplates(filters),
  });
}

export function useTaskTemplate(id?: string) {
  return useQuery({
    queryKey: ['task-template', id],
    queryFn: () => (id ? taskTemplateService.getTemplate(id) : null),
    enabled: Boolean(id),
  });
}

export function useCreateTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<IRoleChecklistTemplate>) => taskTemplateService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      toast.success(i18n.t('tasks:toasts.templateCreated', 'Checklist template created successfully'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to create template');
    },
  });
}

export function useUpdateTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IRoleChecklistTemplate> }) =>
      taskTemplateService.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      toast.success(i18n.t('tasks:toasts.templateUpdated', 'Checklist template updated successfully'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update template');
    },
  });
}

export function useDeleteTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taskTemplateService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      toast.success(i18n.t('tasks:toasts.templateArchived', 'Checklist template archived'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to archive template');
    },
  });
}

export function useApplyTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      employeeId,
      referenceDate,
    }: {
      templateId: string;
      employeeId: string;
      referenceDate?: string;
    }) => taskTemplateService.applyTemplateToEmployee(templateId, employeeId, referenceDate),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(data.message || 'Checklist assigned to employee successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to assign checklist template');
    },
  });
}
