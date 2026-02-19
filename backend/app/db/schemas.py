import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict

# Domain value types
TaskStatusType = Literal["new", "in_progress", "review", "done", "cancelled"]
TaskPriorityType = Literal["low", "medium", "high", "urgent"]
TaskSourceType = Literal["text", "voice", "summary", "web"]
MemberRoleType = Literal["admin", "moderator", "member"]
MemberDeactivationStrategyType = Literal["unassign", "reassign"]
UpdateTypeType = Literal["progress", "status_change", "comment", "blocker", "completion"]
TelegramBroadcastStatusType = Literal["scheduled", "sent", "failed", "cancelled"]


# ── TeamMember ──


class TeamMemberCreate(BaseModel):
    full_name: str
    role: MemberRoleType = "member"
    telegram_id: int | None = None
    telegram_username: str | None = None
    name_variants: list[str] = []
    department_id: uuid.UUID | None = None
    position: str | None = None
    email: str | None = None
    birthday: date | None = None


class TeamMemberUpdate(BaseModel):
    telegram_username: str | None = None
    full_name: str | None = None
    name_variants: list[str] | None = None
    role: MemberRoleType | None = None
    is_active: bool | None = None
    department_id: uuid.UUID | None = None
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
    position: str | None
    email: str | None
    birthday: date | None
    avatar_url: str | None
    role: str
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


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    priority: TaskPriorityType = "medium"
    assignee_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None
    source: TaskSourceType = "text"
    deadline: date | None = None


class TaskEdit(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatusType | None = None
    priority: TaskPriorityType | None = None
    assignee_id: uuid.UUID | None = None
    deadline: date | None = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    short_id: int
    title: str
    description: str | None
    status: str
    priority: str
    assignee_id: uuid.UUID | None
    created_by_id: uuid.UUID | None
    meeting_id: uuid.UUID | None
    source: str
    deadline: date | None
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


# ── MeetingSchedule ──


class MeetingScheduleCreate(BaseModel):
    title: str
    day_of_week: int  # 1-7
    time_local: str  # "15:00" — frontend sends local time
    timezone: str = "Europe/Moscow"
    duration_minutes: int = 60
    recurrence: str = "weekly"  # weekly | biweekly | monthly_last_workday
    reminder_enabled: bool = True
    reminder_minutes_before: int = 60
    reminder_text: str | None = None
    telegram_targets: list[dict] = []  # [{"chat_id": ..., "thread_id": ...}]
    participant_ids: list[uuid.UUID] = []
    zoom_enabled: bool = True


class MeetingScheduleUpdate(BaseModel):
    title: str | None = None
    day_of_week: int | None = None
    time_local: str | None = None
    timezone: str | None = None
    duration_minutes: int | None = None
    recurrence: str | None = None
    reminder_enabled: bool | None = None
    reminder_minutes_before: int | None = None
    reminder_text: str | None = None
    telegram_targets: list[dict] | None = None
    participant_ids: list[uuid.UUID] | None = None
    zoom_enabled: bool | None = None
    is_active: bool | None = None
    next_occurrence_skip: bool | None = None
    next_occurrence_time_local: str | None = None  # "HH:MM" local, converted to UTC


class MeetingScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    day_of_week: int
    time_utc: time
    timezone: str
    duration_minutes: int
    recurrence: str
    reminder_enabled: bool
    reminder_minutes_before: int
    reminder_text: str | None
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


class TelegramTargetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    chat_id: int
    thread_id: int | None
    label: str | None
    is_active: bool
    created_at: datetime


# ── Telegram Broadcasts ──


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
    scheduled_at: datetime
    status: TelegramBroadcastStatusType
    created_by_id: uuid.UUID | None
    sent_at: datetime | None
    error_message: str | None
    created_at: datetime


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
    include_in_progress: bool = True


class ReminderSettingsUpdate(BaseModel):
    is_enabled: bool | None = None
    reminder_time: time | None = None
    timezone: str | None = None
    days_of_week: list[int] | None = None
    include_overdue: bool | None = None
    include_upcoming: bool | None = None
    include_in_progress: bool | None = None


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
    include_in_progress: bool
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
