// ============================================
// Enums / Constants
// ============================================

export type TaskStatus = "new" | "in_progress" | "review" | "done" | "cancelled";
export type TaskPriority = "normal" | "urgent";
export type TaskSource = "text" | "voice" | "summary" | "web";
export type TaskLabelColor =
  | "teal"
  | "blue"
  | "purple"
  | "gold"
  | "green"
  | "coral"
  | "rose"
  | "slate";
export type UpdateType = "progress" | "status_change" | "comment" | "blocker" | "completion";
export type MemberRole = "admin" | "moderator" | "member";
export type MemberDeactivationStrategy = "unassign" | "reassign";
export type MeetingRecurrence =
  | "weekly"
  | "biweekly"
  | "monthly_last_workday"
  | "one_time"
  | "on_demand";
export type MeetingReminderZoomMissingBehavior = "hide" | "fallback";
export type MeetingStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type MeetingTranscriptSource = "zoom_api" | "manual" | "openai_audio";
export type MeetingAIProcessingStatus =
  | "idle"
  | "queued"
  | "recording_not_ready"
  | "recording_ready"
  | "transcribing"
  | "transcript_ready"
  | "draft_ready"
  | "published"
  | "failed";
export type MeetingBoardSectionKey =
  | "urgent"
  | "new"
  | "in_progress"
  | "review"
  | "done_this_week";
export type TelegramBroadcastStatus = "scheduled" | "sent" | "failed" | "cancelled";
export type IdeaStatus =
  | "new"
  | "in_review"
  | "accepted"
  | "in_tasks"
  | "completed"
  | "rejected"
  | "deferred";
export type IdeaDepartmentStatus =
  | "not_started"
  | "in_progress"
  | "ready"
  | "not_required";
export type ProjectStatus =
  | "planned"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";
export type ProjectDepartmentStatus =
  | "not_started"
  | "in_progress"
  | "ready"
  | "not_required";
export type ProjectMilestoneStatus = "planned" | "in_progress" | "done";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: "Новые",
  in_progress: "В работе",
  review: "На согласовании",
  done: "Готово",
  cancelled: "Отменено",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  normal: "Обычная",
  urgent: "Срочная",
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
  is_test: boolean;
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
  labels: TaskLabel[];
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  created_by_id: string | null;
  meeting_id: string | null;
  source: TaskSource;
  deadline: string | null;
  reminder_at: string | null;
  reminder_comment: string | null;
  reminder_sent_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee: TeamMember | null;
  created_by: TeamMember | null;
}

export interface TaskLabel {
  id: string;
  name: string;
  slug: string;
  color: TaskLabelColor | string;
  created_by_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  usage_count: number;
  can_edit: boolean;
  can_archive: boolean;
  can_restore: boolean;
  is_shared_for_current_user: boolean;
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

export interface IdeaTaskLink {
  id: string;
  idea_id: string;
  idea_department_id: string | null;
  task_id: string;
  created_by_id: string | null;
  created_at: string;
  task: Task | null;
  hidden: boolean;
}

export interface IdeaDepartment {
  id: string;
  idea_id: string;
  department_id: string;
  owner_id: string;
  status: IdeaDepartmentStatus;
  note: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  department: Department | null;
  owner: TeamMember | null;
  task_links: IdeaTaskLink[];
}

export interface IdeaComment {
  id: string;
  idea_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: TeamMember | null;
}

export interface IdeaEvent {
  id: string;
  idea_id: string;
  actor_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  actor: TeamMember | null;
}

export interface ProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
}

export interface IdeaSummary {
  id: string;
  title: string;
  status: IdeaStatus;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  status: IdeaStatus;
  project_id: string | null;
  author_id: string;
  review_owner_id: string;
  decision_comment: string | null;
  decision_by_id: string | null;
  decision_at: string | null;
  deferred_until: string | null;
  completed_at: string | null;
  deleted_at: string | null;
  deleted_by_id: string | null;
  created_at: string;
  updated_at: string;
  author: TeamMember | null;
  review_owner: TeamMember | null;
  decision_by: TeamMember | null;
  project: ProjectSummary | null;
  departments: IdeaDepartment[];
  task_links: IdeaTaskLink[];
  comments: IdeaComment[];
  events: IdeaEvent[];
  linked_task_count: number;
  visible_linked_task_count: number;
  completed_linked_task_count: number;
  hidden_linked_task_count: number;
  ready_department_count: number;
  required_department_count: number;
  can_complete: boolean;
  can_delete: boolean;
}

export interface ProjectTaskLink {
  id: string;
  project_id: string;
  project_department_id: string | null;
  task_id: string;
  created_by_id: string | null;
  created_at: string;
  task: Task | null;
  hidden: boolean;
}

export interface ProjectDepartment {
  id: string;
  project_id: string;
  department_id: string;
  owner_id: string;
  status: ProjectDepartmentStatus;
  note: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  department: Department | null;
  owner: TeamMember | null;
  task_links: ProjectTaskLink[];
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  status: ProjectMilestoneStatus;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: TeamMember | null;
}

export interface ProjectEvent {
  id: string;
  project_id: string;
  actor_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  actor: TeamMember | null;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  owner_id: string;
  source_idea_id: string | null;
  completed_at: string | null;
  deleted_at: string | null;
  deleted_by_id: string | null;
  created_at: string;
  updated_at: string;
  owner: TeamMember | null;
  source_idea: IdeaSummary | null;
  departments: ProjectDepartment[];
  milestones: ProjectMilestone[];
  task_links: ProjectTaskLink[];
  comments: ProjectComment[];
  events: ProjectEvent[];
  linked_task_count: number;
  visible_linked_task_count: number;
  completed_linked_task_count: number;
  hidden_linked_task_count: number;
  ready_department_count: number;
  required_department_count: number;
  completed_milestone_count: number;
  milestone_count: number;
  can_complete: boolean;
  can_delete: boolean;
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
  transcript_source: MeetingTranscriptSource | null;
  status: MeetingStatus;
  duration_minutes: number;
  effective_status: MeetingStatus;
  participant_ids: string[];
  schedule_recurrence: MeetingRecurrence | null;
  is_schedule_template: boolean;
}

export interface MeetingBoardMaterial {
  id: string;
  title: string;
  url: string;
  description: string | null;
}

export interface MeetingBoardSettings {
  id: string;
  meeting_id: string;
  added_member_ids: string[];
  added_department_ids: string[];
  pinned_task_ids: string[];
  focus_label_ids: string[];
  materials: MeetingBoardMaterial[];
  board_notes: string | null;
  created_by_id: string | null;
  updated_by_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MeetingBoardResponse {
  meeting: Meeting;
  settings: MeetingBoardSettings;
  urgent: Task[];
  new: Task[];
  in_progress: Task[];
  review: Task[];
  done_this_week: Task[];
}

export interface MeetingAITaskDraft {
  title: string;
  description: string | null;
  assignee_name: string | null;
  assignee_id: string | null;
  deadline: string | null;
  priority: TaskPriority;
  selected: boolean;
}

export interface MeetingAIProcessing {
  id: string;
  meeting_id: string;
  status: MeetingAIProcessingStatus;
  transcript_source: MeetingTranscriptSource | null;
  transcription_model: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  transcript_char_count: number | null;
  audio_duration_seconds: number | null;
  estimated_cost_usd: string | null;
  draft_summary: string | null;
  draft_decisions: string[];
  draft_tasks: MeetingAITaskDraft[];
  published_at: string | null;
  published_by_id: string | null;
  transcription_requested_by_id: string | null;
  transcription_phase: string | null;
  transcription_progress_percent: number;
  transcription_current_chunk: number;
  transcription_total_chunks: number;
  transcription_source_bytes: number | null;
  transcription_prepared_bytes: number | null;
  transcription_attempt_count: number;
  transcription_last_heartbeat_at: string | null;
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
  types: string[];
  allow_incoming_tasks: boolean;
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
  image_path: string | null;
  scheduled_at: string;
  status: TelegramBroadcastStatus;
  created_by_id: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface TelegramBroadcastImagePreset {
  id: string;
  alias: string;
  image_path: string;
  preview_url: string;
  is_active: boolean;
  sort_order: number;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TelegramBroadcastSendResult {
  target_id: string;
  chat_id: number;
  thread_id: number | null;
  target_label: string | null;
  ok: boolean;
  error_message: string | null;
}

export interface TelegramBroadcastSendResponse {
  sent_count: number;
  failed_count: number;
  results: TelegramBroadcastSendResult[];
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
  one_time_date: string | null;
  next_occurrence_at: string | null;
  reminder_enabled: boolean;
  reminder_minutes_before: number;
  reminder_offsets_minutes: number[];
  reminder_text: string | null;
  reminder_texts_by_offset: Record<string, string>;
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
  day_of_week?: number;
  time_local?: string;
  timezone?: string;
  duration_minutes?: number;
  recurrence?: MeetingRecurrence;
  meeting_date_local?: string | null;
  reminder_enabled?: boolean;
  reminder_minutes_before?: number;
  reminder_offsets_minutes?: number[];
  reminder_text?: string | null;
  reminder_texts_by_offset?: Record<string, string>;
  reminder_include_zoom_link?: boolean;
  reminder_zoom_missing_behavior?: MeetingReminderZoomMissingBehavior;
  reminder_zoom_missing_text?: string | null;
  telegram_targets?: TelegramTargetRef[];
  participant_ids?: string[];
  zoom_enabled?: boolean;
  next_occurrence_skip?: boolean;
  next_occurrence_time_local?: string | null;
  next_occurrence_datetime_local?: string | null;
  notify_participants?: boolean;
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

export interface NotificationSubscriptionsSettings {
  subscriptions: Record<string, boolean>;
  task_overdue_interval_hours: number;
  task_overdue_daily_time_msk: string;
}

export type ReminderDigestSectionKey =
  | "overdue"
  | "upcoming"
  | "in_progress"
  | "new";

export type ReminderTaskLineFieldKey =
  | "number"
  | "title"
  | "deadline"
  | "priority";

export interface ReminderSettings {
  id: string;
  member_id: string;
  is_enabled: boolean;
  reminder_time: string;
  timezone: string;
  days_of_week: number[];
  include_overdue: boolean;
  include_upcoming: boolean;
  upcoming_days: number;
  include_in_progress: boolean;
  include_new: boolean;
  digest_sections_order: ReminderDigestSectionKey[];
  task_line_show_number: boolean;
  task_line_show_title: boolean;
  task_line_show_deadline: boolean;
  task_line_show_priority: boolean;
  task_line_fields_order: ReminderTaskLineFieldKey[];
  configured_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingReminderTextsSettings {
  texts_by_offset: Record<string, string>;
  updated_by_id: string | null;
  updated_at: string | null;
}

export interface MeetingWeeklyDigestSettings {
  enabled: boolean;
  day_of_week: number;
  time_local: string;
  timezone: string;
  target_ids: string[];
  template: string;
  delivery_week_start: string | null;
  delivery_week_end: string | null;
  preview_meetings_count: number;
  preview_meetings_block: string;
  target_statuses: MeetingWeeklyDigestTargetStatus[];
  updated_by_id: string | null;
  updated_at: string | null;
}

export type MeetingWeeklyDigestTargetDeliveryStatus = "pending" | "sent" | "failed";

export interface MeetingWeeklyDigestTargetStatus {
  target_id: string;
  status: MeetingWeeklyDigestTargetDeliveryStatus;
  sent_at: string | null;
  error_message: string | null;
  last_attempt_at: string | null;
  target_label: string | null;
  chat_id: number | null;
  thread_id: number | null;
}

export interface MeetingWeeklyDigestSendResponse {
  ok: boolean;
  reason: string;
  delivery_week_start: string;
  delivery_week_end: string;
  attempted: number;
  sent_count: number;
  failed_count: number;
  skipped_sent_count: number;
  target_results: MeetingWeeklyDigestTargetStatus[];
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
// Reports
// ============================================

export interface DailyMetric {
  id: string;
  metric_date: string;
  source: string;
  users_count: number;
  payments_count: number;
  payments_sum: number;
  orders_count: number;
  orders_sum: number;
  collected_at: string;
  collected_by_id: string | null;
}

export interface DailyMetricWithDelta extends DailyMetric {
  delta_users: number | null;
  delta_payments_count: number | null;
  delta_payments_sum: number | null;
  delta_orders_count: number | null;
  delta_orders_sum: number | null;
}

export interface ReportSummary {
  days: number;
  date_from: string;
  date_to: string;
  total_users: number;
  total_payments_count: number;
  total_payments_sum: number;
  total_orders_count: number;
  total_orders_sum: number;
  avg_users_per_day: number;
  avg_payments_sum_per_day: number;
  avg_orders_sum_per_day: number;
  metrics: DailyMetric[];
}

export interface CollectResponse {
  status: "started" | "completed" | "already_exists";
  metric: DailyMetric | null;
}

export interface BackfillResponse {
  status: string;
  total_dates: number;
}

export interface BackfillStatus {
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  stage?: string;
  total_dates?: number;
  collected?: number;
  failed?: number;
  date_from?: string;
  date_to?: string;
  started_at?: string;
  completed_at?: string;
  error?: string | null;
  // Intermediate progress fields
  export_type?: string;
  step?: string;
  detail?: string;
  elapsed_seconds?: number;
  poll_count?: number;
  rate_limit_count?: number;
  wait_seconds?: number;
  rows_count?: number;
  pause_seconds?: number;
}

export interface ReportSchedule {
  collection_time: string;
  send_time: string;
  timezone: string;
  enabled: boolean;
}

export interface GetCourseCredentials {
  configured: boolean;
  base_url: string | null;
  updated_at: string | null;
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
  label_ids?: string[];
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
  label_ids?: string[];
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  deadline?: string | null;
  reminder_at?: string | null;
  reminder_comment?: string | null;
}

export interface TaskLabelCreateRequest {
  name: string;
  color?: TaskLabelColor;
}

export interface TaskLabelUpdateRequest {
  name?: string;
  color?: TaskLabelColor;
}

export interface TaskUpdateCreateRequest {
  content: string;
  update_type?: UpdateType;
  progress_percent?: number | null;
  source?: string;
}

export interface IdeaCreateRequest {
  title: string;
  description: string;
  review_owner_id: string;
  department_ids?: string[];
}

export interface IdeaStatusChangeRequest {
  status: IdeaStatus;
  comment?: string | null;
  deferred_until?: string | null;
}

export interface IdeaDepartmentCreateRequest {
  department_id: string;
  owner_id: string;
}

export interface IdeaDepartmentUpdateRequest {
  owner_id?: string | null;
  status?: IdeaDepartmentStatus | null;
  note?: string | null;
}

export interface IdeaLinkedTaskCreateRequest {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  assignee_id?: string | null;
  deadline?: string | null;
  label_ids?: string[];
}

export interface ProjectCreateRequest {
  title: string;
  description: string;
  owner_id: string;
  source_idea_id?: string | null;
  department_ids?: string[];
}

export interface ProjectUpdateRequest {
  title?: string | null;
  description?: string | null;
  owner_id?: string | null;
}

export interface ProjectStatusChangeRequest {
  status: ProjectStatus;
}

export interface ProjectDepartmentCreateRequest {
  department_id: string;
  owner_id: string;
}

export interface ProjectDepartmentUpdateRequest {
  owner_id?: string | null;
  status?: ProjectDepartmentStatus | null;
  note?: string | null;
}

export interface ProjectMilestoneCreateRequest {
  title: string;
  due_date?: string | null;
}

export interface ProjectMilestoneUpdateRequest {
  title?: string;
  status?: ProjectMilestoneStatus | null;
  due_date?: string | null;
  sort_order?: number | null;
}

export interface ProjectCommentCreateRequest {
  body: string;
}

export interface ProjectLinkedTaskCreateRequest {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  assignee_id?: string | null;
  deadline?: string | null;
  label_ids?: string[];
}

export interface TeamMemberUpdateRequest {
  telegram_id?: number | null;
  telegram_username?: string | null;
  full_name?: string;
  name_variants?: string[];
  role?: MemberRole;
  is_test?: boolean;
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

export type DashboardActivityScope = "my" | "department" | "team";

export interface DashboardActivityMetric {
  count: number;
  tasks: Task[];
  truncated: boolean;
}

export interface DashboardActivityDelta {
  current: number;
  previous: number;
  delta: number;
}

export interface DashboardActivityAnalytics {
  scope: DashboardActivityScope;
  selected_department_id: string | null;
  completed: DashboardActivityMetric;
  created: DashboardActivityMetric;
  in_progress_over_7_days: DashboardActivityMetric;
  completed_delta: DashboardActivityDelta;
}

export interface MemberStats {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: MemberRole;
  department_name: string | null;
  department_color: string | null;
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
  one_time: "Разовая встреча",
  on_demand: "По мере необходимости",
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

// ============================================
// Content Module — Enums & Types
// ============================================

export type ContentSubSection = "telegram_analysis" | "reports";
export type ContentRole = "viewer" | "operator" | "editor";
export type AnalysisContentType = "posts" | "comments" | "all";
export type AnalysisStatus = "preparing" | "downloading" | "analyzing" | "completed" | "failed";

export const CONTENT_ROLE_LABELS: Record<ContentRole, string> = {
  viewer: "Просмотр",
  operator: "Оператор",
  editor: "Редактор",
};

export const ANALYSIS_CONTENT_TYPE_LABELS: Record<AnalysisContentType, string> = {
  posts: "Посты",
  comments: "Комментарии",
  all: "Всё",
};

export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  preparing: "Подготовка",
  downloading: "Загрузка",
  analyzing: "Анализ",
  completed: "Завершён",
  failed: "Ошибка",
};

// ── Content Module Models ──

export interface TelegramChannel {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
}

export interface ChannelContentStats extends TelegramChannel {
  total_count: number;
  post_count: number;
  comment_count: number;
  earliest_date: string | null;
  latest_date: string | null;
}

export interface DataInventoryResponse {
  channels: ChannelContentStats[];
  total_posts: number;
  total_comments: number;
}

export interface AnalysisPrompt {
  id: string;
  title: string;
  description: string | null;
  text: string;
  created_by_id: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisRun {
  id: string;
  channels: unknown[];
  date_from: string;
  date_to: string;
  content_type: string;
  prompt_id: string | null;
  prompt_snapshot: string;
  ai_provider: string | null;
  ai_model: string | null;
  result_markdown: string | null;
  status: AnalysisStatus;
  error_message: string | null;
  run_by_id: string;
  run_by_name: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AnalysisHistoryResponse {
  items: AnalysisRun[];
  total: number;
  page: number;
  per_page: number;
}

export interface ChannelPrepareSummary {
  channel_id: string;
  channel_name: string;
  existing_count: number;
  estimated_missing: number | null;
}

export interface AnalysisPrepareResponse {
  channels: ChannelPrepareSummary[];
  total_existing: number;
  total_estimated_missing: number | null;
  telegram_connected: boolean;
}

// ── Content Access ──

export interface ContentAccess {
  id: string;
  sub_section: ContentSubSection;
  member_id: string | null;
  member_name: string | null;
  department_id: string | null;
  department_name: string | null;
  role: ContentRole;
}

// ── AI Feature Config ──

export interface AIFeatureConfig {
  feature_key: string;
  display_name: string;
  provider: string | null;
  model: string | null;
  updated_by_id: string | null;
}

// ── Telegram Connection ──

export interface TelegramConnectionStatus {
  status: "connected" | "disconnected" | "error" | "code_required" | "password_required" | "not_configured";
  phone?: string;
  error_message?: string;
  connected_at?: string;
}

// ── Analysis SSE Events ──

export interface AnalysisProgressEvent {
  phase: "downloading" | "analyzing" | "completed" | "error";
  channel?: string;
  progress?: number;
  chunk?: number;
  total_chunks?: number;
  run_id?: string;
  error?: string;
}

// ── Content Module Request Types ──

export interface TelegramChannelCreateRequest {
  username: string;
  display_name: string;
}

export interface TelegramChannelUpdateRequest {
  display_name: string;
}

export interface AnalysisPromptCreateRequest {
  title: string;
  description?: string | null;
  text: string;
}

export interface AnalysisPromptUpdateRequest {
  title?: string;
  description?: string | null;
  text?: string;
}

export interface AnalysisPrepareRequest {
  channel_ids: string[];
  date_from: string;
  date_to: string;
  content_type: AnalysisContentType;
}

export interface AnalysisRunRequest {
  channel_ids: string[];
  date_from: string;
  date_to: string;
  content_type: AnalysisContentType;
  prompt_id?: string | null;
  prompt_text?: string | null;
}

export interface ContentAccessGrantRequest {
  sub_section: ContentSubSection;
  member_id?: string | null;
  department_id?: string | null;
  role: ContentRole;
}

export interface TelegramConnectRequest {
  api_id: string;
  api_hash: string;
  phone: string;
}

export interface TelegramVerifyRequest {
  code: string;
  password?: string | null;
}

export interface AIFeatureConfigUpdateRequest {
  provider?: string | null;
  model?: string | null;
}
