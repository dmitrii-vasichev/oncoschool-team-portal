import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import type {
  Task,
  TaskCreateRequest,
  TaskEditRequest,
  TaskUpdateCreateRequest,
  TaskUpdate,
  PaginatedResponse,
} from "@/lib/types";

const DEFAULT_STATUSES = "new,in_progress,review";

export function useMyTasks(status?: string | null) {
  const { member } = useAuth();

  return useQuery<PaginatedResponse<Task>>({
    queryKey: ["my-tasks", status],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (member?.id) params.assignee_id = member.id;
      params.status = status || DEFAULT_STATUSES;
      params.per_page = "100";
      return api.getTasks(params);
    },
    enabled: !!member?.id,
  });
}

export function useAllTasks(status?: string | null) {
  return useQuery<PaginatedResponse<Task>>({
    queryKey: ["all-tasks", status],
    queryFn: () => {
      const params: Record<string, string> = {};
      params.status = status || DEFAULT_STATUSES;
      params.per_page = "100";
      return api.getTasks(params);
    },
  });
}

export function useTask(shortId: number) {
  return useQuery<Task>({
    queryKey: ["task", shortId],
    queryFn: () => api.getTask(shortId),
    enabled: !!shortId,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, TaskCreateRequest>({
    mutationFn: (data) => api.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, { shortId: number; data: TaskEditRequest }>({
    mutationFn: ({ shortId, data }) => api.updateTask(shortId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.shortId] });
    },
  });
}

export function useCreateTaskUpdate(shortId: number) {
  const queryClient = useQueryClient();

  return useMutation<TaskUpdate, Error, TaskUpdateCreateRequest>({
    mutationFn: (data) => api.createTaskUpdate(shortId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", shortId] });
      queryClient.invalidateQueries({ queryKey: ["task-updates", shortId] });
    },
  });
}
