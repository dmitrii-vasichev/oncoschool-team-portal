// Types for Mini App — subset of frontend/src/lib/types.ts

export type TaskStatus = "new" | "in_progress" | "review" | "done" | "cancelled";
export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskSource = "text" | "voice" | "summary" | "web";
export type UpdateType = "progress" | "status_change" | "comment" | "blocker" | "completion";
export type MemberRole = "admin" | "moderator" | "member";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: "Новые",
  in_progress: "В работе",
  review: "Ревью",
  done: "Готово",
  cancelled: "Отменено",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Срочный",
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  admin: "Администратор",
  moderator: "Модератор",
  member: "Участник",
};

export interface TeamMember {
  id: string;
  telegram_id: number | null;
  telegram_username: string | null;
  full_name: string;
  name_variants: string[];
  department_id: string | null;
  position: string | null;
  email: string | null;
  birthday: string | null;
  avatar_url: string | null;
  role: MemberRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  short_id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  created_by_id: string | null;
  meeting_id: string | null;
  source: TaskSource;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee: TeamMember | null;
  created_by: TeamMember | null;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  update_type: UpdateType;
  old_status: string | null;
  new_status: string | null;
  progress_percent: number | null;
  source: string;
  created_at: string;
  author: TeamMember | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  member_id: string;
  role: MemberRole;
}

export interface TaskCreateRequest {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  assignee_id?: string | null;
  meeting_id?: string | null;
  source?: TaskSource;
  deadline?: string | null;
}

export interface TaskEditRequest {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  deadline?: string | null;
}

export interface TaskUpdateCreateRequest {
  content: string;
  update_type?: UpdateType;
  progress_percent?: number | null;
  source?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}
