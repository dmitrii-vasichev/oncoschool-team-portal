import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Domain value types
TaskStatusType = Literal["new", "in_progress", "review", "done", "cancelled"]
TaskPriorityType = Literal["low", "medium", "high", "urgent"]
TaskSourceType = Literal["text", "voice", "summary", "web"]
MemberRoleType = Literal["admin", "moderator", "member"]
MemberDeactivationStrategyType = Literal["unassign", "reassign"]
UpdateTypeType = Literal["progress", "status_change", "comment", "blocker", "completion"]
TelegramBroadcastStatusType = Literal["scheduled", "sent", "failed", "cancelled"]
MeetingReminderZoomMissingBehaviorType = Literal["hide", "fallback"]
ReminderDigestSectionKeyType = Literal["overdue", "upcoming", "in_progress", "new"]
ReminderTaskLineFieldKeyType = Literal["number", "title", "deadline", "priority"]


# ── TeamMember ──


class TeamMemberCreate(BaseModel):
    full_name: str
    role: MemberRoleType = "member"
    is_test: bool = False
    telegram_id: int | None = None
    telegram_username: str | None = None
    name_variants: list[str] = []
    department_id: uuid.UUID | None = None
    extra_department_ids: list[uuid.UUID] = Field(default_factory=list)
    position: str | None = None
    email: str | None = None
    birthday: date | None = None


class TeamMemberUpdate(BaseModel):
    telegram_id: int | None = None
    telegram_username: str | None = None
    full_name: str | None = None
    name_variants: list[str] | None = None
    role: MemberRoleType | None = None
    is_test: bool | None = None
    is_active: bool | None = None
    department_id: uuid.UUID | None = None
    extra_department_ids: list[uuid.UUID] | None = None
    position: str | None = None
    email: str | None = None
    birthday: date | None = None
    deactivation_strategy: MemberDeactivationStrategyType | None = None
    reassign_to_member_id: uuid.UUID | None = None


class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    telegram_id: int | None
    telegram_username: str | None
    full_name: str
    name_variants: list[str]
    department_id: uuid.UUID | None
    extra_department_ids: list[uuid.UUID] = Field(default_factory=list)
    position: str | None
    email: str | None
    birthday: date | None
    avatar_url: str | None
    role: str
    is_test: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ── Department ──


class DepartmentCreate(BaseModel):
    name: str
    description: str | None = None
    head_id: uuid.UUID | None = None
    color: str | None = None
    sort_order: int = 0


class DepartmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    head_id: uuid.UUID | None = None
    color: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    head_id: uuid.UUID | None
    color: str | None
    sort_order: int
    is_active: bool
    created_at: datetime


# ── Task ──


class TaskChecklistItem(BaseModel):
    id: str
    title: str
    is_completed: bool = False


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    checklist: list[TaskChecklistItem] = Field(default_factory=list)
    priority: TaskPriorityType = "medium"
    assignee_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None
    source: TaskSourceType = "text"
    deadline: date | None = None


class TaskEdit(BaseModel):
    title: str | None = None
    description: str | None = None
    checklist: list[TaskChecklistItem] | None = None
    status: TaskStatusType | None = None
    priority: TaskPriorityType | None = None
    assignee_id: uuid.UUID | None = None
    deadline: date | None = None
    reminder_at: datetime | None = None
    reminder_comment: str | None = None

class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    short_id: int
    title: str
    description: str | None
    checklist: list[TaskChecklistItem] = Field(default_factory=list)
    status: str
    priority: str
    assignee_id: uuid.UUID | None
    created_by_id: uuid.UUID | None
    meeting_id: uuid.UUID | None
    source: str
    deadline: date | None
    reminder_at: datetime | None
    reminder_comment: str | None
    reminder_sent_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    assignee: TeamMemberResponse | None = None
    created_by: TeamMemberResponse | None = None


# ── TaskUpdate ──


class TaskUpdateCreate(BaseModel):
    content: str
    update_type: UpdateTypeType = "progress"
    old_status: TaskStatusType | None = None
    new_status: TaskStatusType | None = None
    progress_percent: int | None = None
    source: str = "telegram"


class TaskUpdateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    author_id: uuid.UUID
    content: str
    update_type: str
    old_status: str | None
    new_status: str | None
    progress_percent: int | None
    source: str
    created_at: datetime
    author: TeamMemberResponse | None = None


# ── Meeting ──


class MeetingCreate(BaseModel):
    title: str | None = None
    raw_summary: str
    parsed_summary: str | None = None
    decisions: list[str] = []
    notes: str | None = None
    meeting_date: datetime | None = None
    participant_ids: list[uuid.UUID] = []


class MeetingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None
    raw_summary: str | None
    parsed_summary: str | None
    decisions: list[str]
    notes: str | None
    meeting_date: datetime | None
    created_by_id: uuid.UUID | None
    created_at: datetime
    # New fields for Zoom integration & scheduling
    schedule_id: uuid.UUID | None = None
    zoom_meeting_id: str | None = None
    zoom_join_url: str | None = None
    zoom_recording_url: str | None = None
    transcript: str | None = None
    transcript_source: str | None = None
    status: str = "scheduled"
    duration_minutes: int = 60
    effective_status: str = "scheduled"
    participant_ids: list[uuid.UUID] = []
    schedule_recurrence: str | None = None
    is_schedule_template: bool = False


# ── MeetingSchedule ──


class MeetingScheduleCreate(BaseModel):
    title: str
    day_of_week: int | None = None  # 1-7
    time_local: str | None = None  # "15:00" — frontend sends local time
    timezone: str = "Europe/Moscow"
    duration_minutes: int = 60
    recurrence: str = "weekly"  # weekly | biweekly | monthly_last_workday | one_time | on_demand
    meeting_date_local: str | None = None  # "YYYY-MM-DDTHH:MM" for one_time/on_demand next run
    reminder_enabled: bool = True
    reminder_minutes_before: int = 60
    reminder_offsets_minutes: list[int] = Field(default_factory=lambda: [60, 0])
    reminder_text: str | None = None
    reminder_texts_by_offset: dict[str, str] = Field(default_factory=dict)
    reminder_include_zoom_link: bool = True
    reminder_zoom_missing_behavior: MeetingReminderZoomMissingBehaviorType = "hide"
    reminder_zoom_missing_text: str | None = None
    telegram_targets: list[dict] = []  # [{"chat_id": ..., "thread_id": ...}]
    participant_ids: list[uuid.UUID] = []
    zoom_enabled: bool = True
    notify_participants: bool = False


class MeetingScheduleUpdate(BaseModel):
    title: str | None = None
    day_of_week: int | None = None
    time_local: str | None = None
    timezone: str | None = None
    duration_minutes: int | None = None
    recurrence: str | None = None
    meeting_date_local: str | None = None
    reminder_enabled: bool | None = None
    reminder_minutes_before: int | None = None
    reminder_offsets_minutes: list[int] | None = None
    reminder_text: str | None = None
    reminder_texts_by_offset: dict[str, str] | None = None
    reminder_include_zoom_link: bool | None = None
    reminder_zoom_missing_behavior: MeetingReminderZoomMissingBehaviorType | None = None
    reminder_zoom_missing_text: str | None = None
    telegram_targets: list[dict] | None = None
    participant_ids: list[uuid.UUID] | None = None
    zoom_enabled: bool | None = None
    is_active: bool | None = None
    next_occurrence_skip: bool | None = None
    next_occurrence_time_local: str | None = None  # "HH:MM" local, converted to UTC
    next_occurrence_datetime_local: str | None = None  # "YYYY-MM-DDTHH:MM" local, converted to UTC
    notify_participants: bool | None = None


class MeetingScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    day_of_week: int
    time_utc: time
    timezone: str
    duration_minutes: int
    recurrence: str
    one_time_date: date | None = None
    next_occurrence_at: datetime | None = None
    reminder_enabled: bool
    reminder_minutes_before: int
    reminder_offsets_minutes: list[int]
    reminder_text: str | None
    reminder_texts_by_offset: dict[str, str]
    reminder_include_zoom_link: bool
    reminder_zoom_missing_behavior: MeetingReminderZoomMissingBehaviorType
    reminder_zoom_missing_text: str | None
    telegram_targets: list[dict]
    participant_ids: list[uuid.UUID]
    zoom_enabled: bool
    is_active: bool
    next_occurrence_skip: bool
    next_occurrence_time_override: time | None
    next_occurrence_date: date | None = None  # Computed, not stored in DB
    created_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


# ── TelegramNotificationTarget ──


class TelegramTargetCreate(BaseModel):
    chat_id: int
    thread_id: int | None = None
    label: str | None = None
    type: str | None = "meeting"
    allow_incoming_tasks: bool = False


class TelegramTargetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    chat_id: int
    thread_id: int | None
    label: str | None
    type: str | None
    allow_incoming_tasks: bool
    is_active: bool
    created_at: datetime


# ── Telegram Broadcasts ──


class TelegramBroadcastImagePresetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alias: str
    image_path: str
    preview_url: str
    is_active: bool
    sort_order: int
    created_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class TelegramBroadcastCreate(BaseModel):
    target_id: uuid.UUID
    message_html: str
    scheduled_at: datetime | None = None
    send_now: bool = False


class TelegramBroadcastUpdate(BaseModel):
    target_id: uuid.UUID | None = None
    message_html: str | None = None
    scheduled_at: datetime | None = None


class TelegramBroadcastResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    target_id: uuid.UUID
    chat_id: int
    thread_id: int | None
    target_label: str | None
    message_html: str
    image_path: str | None
    scheduled_at: datetime
    status: TelegramBroadcastStatusType
    created_by_id: uuid.UUID | None
    sent_at: datetime | None
    error_message: str | None
    created_at: datetime


class TelegramBroadcastSendTargetResult(BaseModel):
    target_id: uuid.UUID
    chat_id: int
    thread_id: int | None
    target_label: str | None
    ok: bool
    error_message: str | None = None


class TelegramBroadcastSendResponse(BaseModel):
    sent_count: int
    failed_count: int
    results: list[TelegramBroadcastSendTargetResult]


# ── NotificationSubscription ──


class NotificationSubscriptionCreate(BaseModel):
    event_type: str
    is_active: bool = True


class NotificationSubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    member_id: uuid.UUID
    event_type: str
    is_active: bool
    created_at: datetime


# ── InAppNotification ──


class InAppNotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    recipient_id: uuid.UUID
    actor_id: uuid.UUID | None
    event_type: str
    title: str
    body: str | None
    priority: str
    action_url: str | None
    task_short_id: int | None
    dedupe_key: str | None
    is_read: bool
    read_at: datetime | None
    created_at: datetime
    actor: TeamMemberResponse | None = None


class InAppNotificationListResponse(BaseModel):
    items: list[InAppNotificationResponse]
    unread_count: int


# ── ReminderSettings ──


class ReminderSettingsCreate(BaseModel):
    member_id: uuid.UUID
    is_enabled: bool = False
    reminder_time: time = time(9, 0)
    timezone: str = "Europe/Moscow"
    days_of_week: list[int] = [1, 2, 3, 4, 5]
    include_overdue: bool = True
    include_upcoming: bool = True
    upcoming_days: int = Field(default=3, ge=0, le=7)
    include_in_progress: bool = True
    include_new: bool = True
    digest_sections_order: list[ReminderDigestSectionKeyType] = Field(
        default_factory=lambda: ["overdue", "upcoming", "in_progress", "new"]
    )
    task_line_show_number: bool = True
    task_line_show_title: bool = True
    task_line_show_deadline: bool = True
    task_line_show_priority: bool = True
    task_line_fields_order: list[ReminderTaskLineFieldKeyType] = Field(
        default_factory=lambda: ["number", "title", "deadline", "priority"]
    )


class ReminderSettingsUpdate(BaseModel):
    is_enabled: bool | None = None
    reminder_time: time | None = None
    timezone: str | None = None
    days_of_week: list[int] | None = None
    include_overdue: bool | None = None
    include_upcoming: bool | None = None
    upcoming_days: int | None = Field(default=None, ge=0, le=7)
    include_in_progress: bool | None = None
    include_new: bool | None = None
    digest_sections_order: list[ReminderDigestSectionKeyType] | None = None
    task_line_show_number: bool | None = None
    task_line_show_title: bool | None = None
    task_line_show_deadline: bool | None = None
    task_line_show_priority: bool | None = None
    task_line_fields_order: list[ReminderTaskLineFieldKeyType] | None = None


class ReminderSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    member_id: uuid.UUID
    is_enabled: bool
    reminder_time: time
    timezone: str
    days_of_week: list[int]
    include_overdue: bool
    include_upcoming: bool
    upcoming_days: int
    include_in_progress: bool
    include_new: bool
    digest_sections_order: list[ReminderDigestSectionKeyType]
    task_line_show_number: bool
    task_line_show_title: bool
    task_line_show_deadline: bool
    task_line_show_priority: bool
    task_line_fields_order: list[ReminderTaskLineFieldKeyType]
    configured_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


# ── AppSettings ──


class AppSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: dict
    updated_by_id: uuid.UUID | None
    updated_at: datetime


class AIProviderUpdate(BaseModel):
    provider: str
    model: str


# ── Reports ──


class DailyMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    metric_date: date
    source: str
    users_count: int
    payments_count: int
    payments_sum: Decimal
    orders_count: int
    orders_sum: Decimal
    collected_at: datetime
    collected_by_id: uuid.UUID | None = None


class DailyMetricWithDelta(DailyMetricResponse):
    """Single metric with delta vs previous day."""
    delta_users: int | None = None
    delta_payments_count: int | None = None
    delta_payments_sum: Decimal | None = None
    delta_orders_count: int | None = None
    delta_orders_sum: Decimal | None = None


class ReportSummaryResponse(BaseModel):
    """Aggregated summary for a period."""
    days: int
    date_from: date
    date_to: date
    total_users: int
    total_payments_count: int
    total_payments_sum: Decimal
    total_orders_count: int
    total_orders_sum: Decimal
    avg_users_per_day: float
    avg_payments_sum_per_day: float
    avg_orders_sum_per_day: float
    metrics: list[DailyMetricResponse]


class CollectRequest(BaseModel):
    date: date


class CollectResponse(BaseModel):
    status: str  # "started" | "completed" | "already_exists"
    metric: DailyMetricResponse | None = None


class BackfillRequest(BaseModel):
    date_from: date
    date_to: date


class BackfillResponse(BaseModel):
    status: str  # "started"
    total_dates: int


class ReportScheduleResponse(BaseModel):
    collection_time: str  # "HH:MM"
    send_time: str  # "HH:MM"
    timezone: str
    enabled: bool


class ReportScheduleUpdate(BaseModel):
    collection_time: str  # "HH:MM"
    send_time: str  # "HH:MM"
    timezone: str = "Europe/Moscow"
    enabled: bool = True


class GetCourseCredentialsResponse(BaseModel):
    configured: bool
    base_url: str | None = None
    updated_at: datetime | None = None


class GetCourseCredentialsUpdate(BaseModel):
    base_url: str
    api_key: str
