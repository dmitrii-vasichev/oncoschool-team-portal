import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict


# ── TeamMember ──


class TeamMemberCreate(BaseModel):
    telegram_id: int | None = None
    telegram_username: str | None = None
    full_name: str
    name_variants: list[str] = []
    role: str = "member"


class TeamMemberUpdate(BaseModel):
    telegram_username: str | None = None
    full_name: str | None = None
    name_variants: list[str] | None = None
    role: str | None = None
    is_active: bool | None = None


class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    telegram_id: int | None
    telegram_username: str | None
    full_name: str
    name_variants: list[str]
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ── Task ──


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    priority: str = "medium"
    assignee_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None
    source: str = "text"
    deadline: date | None = None


class TaskEdit(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
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
    update_type: str = "progress"
    old_status: str | None = None
    new_status: str | None = None
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
    raw_summary: str
    parsed_summary: str | None
    decisions: list[str]
    notes: str | None
    meeting_date: datetime | None
    created_by_id: uuid.UUID | None
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
