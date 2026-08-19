import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import documentService, { DocumentTemplate } from '../services/document.service';

export function useDocumentTemplates() {
  return useQuery({
    queryKey: ['documentTemplates'],
    queryFn: () => documentService.listTemplates(),
  });
}

export function useEmployeeDocumentInbox() {
  return useQuery({
    queryKey: ['employeeDocumentInbox'],
    queryFn: () => documentService.getEmployeeInbox(),
  });
}

export function useDocumentAssignment(id: string | null) {
  return useQuery({
    queryKey: ['documentAssignment', id],
    queryFn: () => documentService.getDocumentAssignment(id!),
    enabled: !!id,
  });
}

export function useCreateDocumentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<DocumentTemplate>) => documentService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentTemplates'] });
    },
  });
}

export function useAssignDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, employeeId, dueDate }: { templateId: string; employeeId: string; dueDate?: string }) =>
      documentService.assignDocument(templateId, employeeId, dueDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeDocumentInbox'] });
    },
  });
}

export function useSignDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { type: 'draw' | 'type'; signatureDataUrl?: string; signerName: string };
    }) => documentService.signDocument(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documentAssignment', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['employeeDocumentInbox'] });
    },
  });
}
