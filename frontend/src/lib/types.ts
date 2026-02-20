// ============================================
// Enums / Constants
// ============================================

export type TaskStatus = "new" | "in_progress" | "review" | "done" | "cancelled";
export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskSource = "text" | "voice" | "summary" | "web";
export type UpdateType = "progress" | "status_change" | "comment" | "blocker" | "completion";
export type MemberRole = "admin" | "moderator" | "member";
export type MemberDeactivationStrategy = "unassign" | "reassign";
export type MeetingRecurrence = "weekly" | "biweekly" | "monthly_last_workday";
export type MeetingReminderZoomMissingBehavior = "hide" | "fallback";
export type MeetingStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type TelegramBroadcastStatus = "scheduled" | "sent" | "failed" | "cancelled";

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
  admin: "Администратор",
  moderator: "Модератор",
  member: "Участник",
};

// ============================================
// Models
// ============================================

export interface Department {
  id: string;
  name: string;
  description: string | null;
  head_id: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface TeamMember {
  id: string;
  telegram_id: number | null;
  telegram_username: string | null;
  full_name: string;
  name_variants: string[];
  department_id: string | null;
  extra_department_ids: string[];
  position: string | null;
  email: string | null;
  birthday: string | null;
  avatar_url: string | null;
  role: MemberRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DepartmentWithMembers extends Department {
  members: TeamMember[];
}

export interface TeamTreeResponse {
  departments: DepartmentWithMembers[];
  unassigned: TeamMember[];
}

export interface Task {
  id: string;
  short_id: number;
  title: string;
  description: string | null;
  checklist: TaskChecklistItem[];
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

export interface TaskChecklistItem {
  id: string;
  title: string;
  is_completed: boolean;
}

export interface Meeting {
  id: string;
  title: string | null;
  raw_summary: string | null;
  parsed_summary: string | null;
  decisions: string[];
  notes: string | null;
  meeting_date: string | null;
  created_by_id: string | null;
  created_at: string;
  schedule_id: string | null;
  zoom_meeting_id: string | null;
  zoom_join_url: string | null;
  zoom_recording_url: string | null;
  transcript: string | null;
  transcript_source: "zoom_api" | "manual" | null;
  status: MeetingStatus;
  duration_minutes: number;
  effective_status: MeetingStatus;
  participant_ids: string[];
}

export interface TelegramTargetRef {
  chat_id: string;
  thread_id: number | null;
}

export interface TelegramNotificationTarget {
  id: string;
  chat_id: number;
  thread_id: number | null;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TelegramBroadcast {
  id: string;
  target_id: string;
  chat_id: number;
  thread_id: number | null;
  target_label: string | null;
  message_html: string;
  scheduled_at: string;
  status: TelegramBroadcastStatus;
  created_by_id: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface TelegramBroadcastCreateRequest {
  target_id: string;
  message_html: string;
  scheduled_at?: string;
  send_now?: boolean;
}

export interface TelegramBroadcastUpdateRequest {
  target_id?: string;
  message_html?: string;
  scheduled_at?: string;
}

export interface MeetingSchedule {
  id: string;
  title: string;
  day_of_week: number;
  time_utc: string;
  timezone: string;
  duration_minutes: number;
  recurrence: MeetingRecurrence;
  reminder_enabled: boolean;
  reminder_minutes_before: number;
  reminder_text: string | null;
  reminder_include_zoom_link: boolean;
  reminder_zoom_missing_behavior: MeetingReminderZoomMissingBehavior;
  reminder_zoom_missing_text: string | null;
  telegram_targets: TelegramTargetRef[];
  participant_ids: string[];
  zoom_enabled: boolean;
  is_active: boolean;
  next_occurrence_skip: boolean;
  next_occurrence_time_override: string | null;
  next_occurrence_date: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingScheduleCreateRequest {
  title: string;
  day_of_week: number;
  time_local: string;
  timezone?: string;
  duration_minutes?: number;
  recurrence?: MeetingRecurrence;
  reminder_enabled?: boolean;
  reminder_minutes_before?: number;
  reminder_text?: string | null;
  reminder_include_zoom_link?: boolean;
  reminder_zoom_missing_behavior?: MeetingReminderZoomMissingBehavior;
  reminder_zoom_missing_text?: string | null;
  telegram_targets?: TelegramTargetRef[];
  participant_ids?: string[];
  zoom_enabled?: boolean;
  next_occurrence_skip?: boolean;
  next_occurrence_time_local?: string | null;
}

export interface ZoomStatusResponse {
  zoom_configured: boolean;
  has_recording: boolean;
  has_transcript: boolean;
  recording_url: string | null;
}

export interface NotificationSubscription {
  id: string;
  member_id: string;
  event_type: string;
  is_active: boolean;
  created_at: string;
}

export type InAppNotificationEventType =
  | "task_assigned"
  | "task_blocker_added"
  | "task_deadline_tomorrow"
  | "task_deadline_today"
  | "task_overdue_started"
  | "task_status_changed_by_other"
  | "task_review_requested"
  | "task_created_unassigned"
  | "meeting_created";

export type InAppNotificationPriority = "normal" | "high";

export interface InAppNotification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  event_type: InAppNotificationEventType | string;
  title: string;
  body: string | null;
  priority: InAppNotificationPriority | string;
  action_url: string | null;
  task_short_id: number | null;
  dedupe_key: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  actor: TeamMember | null;
}

export interface InAppNotificationListResponse {
  items: InAppNotification[];
  unread_count: number;
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
  include_new: boolean;
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
  checklist?: TaskChecklistItem[];
  priority?: TaskPriority;
  assignee_id?: string | null;
  meeting_id?: string | null;
  source?: TaskSource;
  deadline?: string | null;
}

export interface TaskEditRequest {
  title?: string;
  description?: string | null;
  checklist?: TaskChecklistItem[];
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

export interface TeamMemberUpdateRequest {
  telegram_id?: number | null;
  telegram_username?: string | null;
  full_name?: string;
  name_variants?: string[];
  role?: MemberRole;
  is_active?: boolean;
  department_id?: string | null;
  extra_department_ids?: string[];
  position?: string | null;
  email?: string | null;
  birthday?: string | null;
  deactivation_strategy?: MemberDeactivationStrategy;
  reassign_to_member_id?: string | null;
}

export interface MemberDeactivationPreviewTaskItem {
  short_id: number;
  title: string;
}

export interface MemberDeactivationPreviewResponse {
  open_tasks_count: number;
  open_tasks_preview: MemberDeactivationPreviewTaskItem[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface BoardColumnStat {
  key: string;
  label: string;
  count: number;
  share_percent: number;
}

export interface MonthlyFlowPoint {
  month: string;
  label: string;
  created: number;
  completed: number;
}

export interface DepartmentBreakdownItem {
  department_id: string;
  department_name: string;
  department_color: string | null;
  total_tasks: number;
  active_tasks: number;
  overdue_tasks: number;
  done_week: number;
}

export interface OverviewAnalytics {
  total_tasks: number;
  active_tasks: number;
  completion_rate: number;
  tasks_done_week: number;
  tasks_new: number;
  tasks_in_progress: number;
  tasks_review: number;
  tasks_done: number;
  tasks_cancelled: number;
  tasks_overdue: number;
  total_meetings: number;
  total_members: number;
  selected_department_id: string | null;
  board_columns: BoardColumnStat[];
  monthly_flow: MonthlyFlowPoint[];
  departments: DepartmentBreakdownItem[];
  tasks_by_source: Record<string, number>;
  tasks_by_priority: Record<string, number>;
}

export interface DashboardTaskMetrics {
  active: number;
  new: number;
  in_progress: number;
  review: number;
  overdue: number;
  done_total: number;
  done_week: number;
}

export interface DashboardTasksMeta {
  selected_department_id: string | null;
  can_view_department: boolean;
  is_department_head: boolean;
}

export interface DashboardTasksAnalytics {
  my: DashboardTaskMetrics;
  department: DashboardTaskMetrics;
  meta: DashboardTasksMeta;
}

export interface MemberStats {
  id: string;
  full_name: string;
  avatar_url: string | null;
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

// ============================================
// Meeting / Schedule Labels
// ============================================

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
  7: "Воскресенье",
};

export const DAY_OF_WEEK_SHORT: Record<number, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  7: "Вс",
};

export const RECURRENCE_LABELS: Record<MeetingRecurrence, string> = {
  weekly: "Еженедельно",
  biweekly: "Раз в 2 недели",
  monthly_last_workday: "Последний день месяца",
};

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: "Запланирована",
  in_progress: "Идёт",
  completed: "Завершена",
  cancelled: "Отменена",
};

export const TELEGRAM_BROADCAST_STATUS_LABELS: Record<TelegramBroadcastStatus, string> = {
  scheduled: "Запланировано",
  sent: "Отправлено",
  failed: "Ошибка",
  cancelled: "Отменено",
};
