// ============================================
// Enums / Constants
// ============================================

export type TaskStatus = "new" | "in_progress" | "review" | "done" | "cancelled";
export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskSource = "text" | "voice" | "summary" | "web";
export type UpdateType = "progress" | "status_change" | "comment" | "blocker" | "completion";
export type MemberRole = "moderator" | "member";

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

export const TASK_SOURCE_LABELS: Record<TaskSource, string> = {
  text: "Текст",
  voice: "Голос",
  summary: "Summary",
  web: "Веб",
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  moderator: "Модератор",
  member: "Участник",
};

// ============================================
// Models
// ============================================

export interface TeamMember {
  id: string;
  telegram_id: number | null;
  telegram_username: string | null;
  full_name: string;
  name_variants: string[];
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

export interface Meeting {
  id: string;
  title: string | null;
  raw_summary: string;
  parsed_summary: string | null;
  decisions: string[];
  notes: string | null;
  meeting_date: string | null;
  created_by_id: string | null;
  created_at: string;
}

export interface NotificationSubscription {
  id: string;
  member_id: string;
  event_type: string;
  is_active: boolean;
  created_at: string;
}

export interface ReminderSettings {
  id: string;
  member_id: string;
  is_enabled: boolean;
  reminder_time: string;
  timezone: string;
  days_of_week: number[];
  include_overdue: boolean;
  include_upcoming: boolean;
  include_in_progress: boolean;
  configured_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppSettingsValue {
  provider: string;
  model: string;
}

export interface AISettingsResponse {
  current_provider: string;
  current_model: string;
  available_providers: Record<string, boolean>;
  providers_config: Record<string, { models: string[]; default: string }> | null;
}

export interface ParseSummaryResponse {
  title: string;
  summary: string;
  decisions: string[];
  tasks: ParsedTask[];
  participants: string[];
}

export interface ParsedTask {
  title: string;
  description: string | null;
  assignee_name: string | null;
  priority: TaskPriority;
  deadline: string | null;
}

export interface CreateMeetingRequest {
  raw_summary: string;
  title: string;
  parsed_summary: string;
  decisions: string[];
  participants: string[];
  tasks: ParsedTask[];
}

export interface MeetingWithTasksResponse {
  meeting: Meeting;
  tasks_created: number;
}

// ============================================
// API Request/Response types
// ============================================

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
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

export interface OverviewAnalytics {
  total_tasks: number;
  tasks_new: number;
  tasks_in_progress: number;
  tasks_review: number;
  tasks_done: number;
  tasks_cancelled: number;
  tasks_overdue: number;
  total_meetings: number;
  total_members: number;
  tasks_by_source: Record<string, number>;
  tasks_by_priority: Record<string, number>;
}

export interface MemberStats {
  id: string;
  full_name: string;
  role: MemberRole;
  total_tasks: number;
  tasks_done: number;
  tasks_in_progress: number;
  tasks_overdue: number;
  last_update: string | null;
}

export interface MeetingAnalytics {
  total_meetings: number;
  tasks_from_meetings: number;
  meetings_this_month: number;
}
