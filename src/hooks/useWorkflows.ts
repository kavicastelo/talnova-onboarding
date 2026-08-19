import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import frontendWorkflowService, {
  CreateWorkflowRulePayload,
} from "../services/workflow.service";

export const WORKFLOW_KEYS = {
  all: ["workflows"] as const,
  rules: (triggerType?: string) => [...WORKFLOW_KEYS.all, "rules", triggerType] as const,
  rule: (id: string) => [...WORKFLOW_KEYS.all, "rule", id] as const,
  logs: (ruleId?: string, page?: number) => [...WORKFLOW_KEYS.all, "logs", ruleId, page] as const,
};

export function useWorkflows(triggerType?: string) {
  return useQuery({
    queryKey: WORKFLOW_KEYS.rules(triggerType),
    queryFn: () => frontendWorkflowService.getRules(triggerType),
  });
}

export function useWorkflowDetails(id: string | null) {
  return useQuery({
    queryKey: WORKFLOW_KEYS.rule(id || ""),
    queryFn: () => frontendWorkflowService.getRule(id!),
    enabled: !!id,
  });
}

export function useWorkflowExecutions(ruleId?: string, page = 1) {
  return useQuery({
    queryKey: WORKFLOW_KEYS.logs(ruleId, page),
    queryFn: () => frontendWorkflowService.getExecutionLogs(ruleId, page),
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkflowRulePayload) => frontendWorkflowService.createRule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.all });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateWorkflowRulePayload> }) =>
      frontendWorkflowService.updateRule(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.all });
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.rule(variables.id) });
    },
  });
}

export function useToggleWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      frontendWorkflowService.toggleRuleActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.all });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => frontendWorkflowService.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.all });
    },
  });
}

export function useTriggerTestRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetUserId }: { id: string; targetUserId: string }) =>
      frontendWorkflowService.triggerTestRun(id, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.all });
    },
  });
}
