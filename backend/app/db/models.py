import enum
import uuid
from datetime import date, datetime, time
from typing import Any

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    inspect,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


# --- Content module enums ---

class ContentType(str, enum.Enum):
    """Type of a single Telegram message (post vs comment)."""
    post = "post"
    comment = "comment"


class AnalysisContentType(str, enum.Enum):
    """Content scope for an analysis run."""
    posts = "posts"
    comments = "comments"
    all = "all"


class AnalysisStatus(str, enum.Enum):
    """Status of an analysis run."""
    preparing = "preparing"
    downloading = "downloading"
    analyzing = "analyzing"
    completed = "completed"
    failed = "failed"


class ContentSubSection(str, enum.Enum):
    """Content module sub-sections (extensible)."""
    telegram_analysis = "telegram_analysis"


class ContentRole(str, enum.Enum):
    """Role within a Content sub-section."""
    operator = "operator"
    editor = "editor"


class Base(DeclarativeBase):
    pass


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    head_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id"), nullable=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    head: Mapped["TeamMember | None"] = relationship(
        foreign_keys=[head_id]
    )
    members: Mapped[list["TeamMember"]] = relationship(
        back_populates="department", foreign_keys="TeamMember.department_id"
    )
    extra_member_accesses: Mapped[list["TeamMemberDepartmentAccess"]] = relationship(
        back_populates="department",
        foreign_keys="TeamMemberDepartmentAccess.department_id",
        cascade="all, delete-orphan",
    )


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    telegram_id: Mapped[int | None] = mapped_column(
        BigInteger, unique=True, nullable=True
    )
    telegram_username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_variants: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, server_default="{}"
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id"), nullable=True
    )
    position: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role: Mapped[str] = mapped_column(String(50), default="member", server_default="member")
    bot_ui_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_test: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    department: Mapped["Department | None"] = relationship(
        back_populates="members", foreign_keys=[department_id]
    )
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="assignee", foreign_keys="Task.assignee_id"
    )
    created_tasks: Mapped[list["Task"]] = relationship(
        back_populates="created_by", foreign_keys="Task.created_by_id"
    )
    task_updates: Mapped[list["TaskUpdate"]] = relationship(back_populates="author")
    notification_subscriptions: Mapped[list["NotificationSubscription"]] = relationship(
        back_populates="member"
    )
    notifications_received: Mapped[list["InAppNotification"]] = relationship(
        back_populates="recipient",
        foreign_keys="InAppNotification.recipient_id",
    )
    notifications_authored: Mapped[list["InAppNotification"]] = relationship(
        back_populates="actor",
        foreign_keys="InAppNotification.actor_id",
    )
    reminder_settings: Mapped["ReminderSettings | None"] = relationship(
        back_populates="member", foreign_keys="ReminderSettings.member_id", uselist=False
    )
    extra_department_accesses: Mapped[list["TeamMemberDepartmentAccess"]] = relationship(
        back_populates="member",
        foreign_keys="TeamMemberDepartmentAccess.member_id",
        cascade="all, delete-orphan",
    )

    @property
    def extra_department_ids(self) -> list[uuid.UUID]:
        state = inspect(self)
        if "extra_department_accesses" in state.unloaded:
            return []
        now = datetime.utcnow()
        return [
            access.department_id
            for access in self.extra_department_accesses
            if access.expires_at is None or access.expires_at > now
        ]


class TeamMemberDepartmentAccess(Base):
    __tablename__ = "team_member_department_access"
    __table_args__ = (
        Index(
            "idx_team_member_department_access_department_id",
            "department_id",
        ),
    )

    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id", ondelete="CASCADE"),
        primary_key=True,
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"),
        primary_key=True,
    )
    granted_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    member: Mapped["TeamMember"] = relationship(
        back_populates="extra_department_accesses",
        foreign_keys=[member_id],
    )
    department: Mapped["Department"] = relationship(
        back_populates="extra_member_accesses",
        foreign_keys=[department_id],
    )
    granted_by: Mapped["TeamMember | None"] = relationship(
        foreign_keys=[granted_by_id]
    )


class MeetingSchedule(Base):
    __tablename__ = "meeting_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 1=Mon ... 7=Sun (ISO)
    time_utc: Mapped[time] = mapped_column(Time, nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Europe/Moscow", server_default="Europe/Moscow")
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60, server_default="60")
    recurrence: Mapped[str] = mapped_column(
        String(30), default="weekly", server_default="weekly"
    )  # weekly | biweekly | monthly_last_workday | one_time | on_demand
    one_time_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_occurrence_at: Mapped[datetime | None] = mapped_column(nullable=True)
    reminder_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    reminder_minutes_before: Mapped[int] = mapped_column(Integer, default=60, server_default="60")
    reminder_offsets_minutes: Mapped[list[int]] = mapped_column(
        ARRAY(Integer), default=list, server_default="{}"
    )
    reminder_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminder_texts_by_offset: Mapped[dict[str, str]] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )
    reminder_include_zoom_link: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    reminder_zoom_missing_behavior: Mapped[str] = mapped_column(
        String(20), default="hide", server_default="hide"
    )
    reminder_zoom_missing_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    telegram_targets: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    participant_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), default=list, server_default="{}"
    )
    zoom_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    last_triggered_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    next_occurrence_skip: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    next_occurrence_time_override: Mapped[time | None] = mapped_column(Time, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    # Relationships
    created_by: Mapped["TeamMember | None"] = relationship()
    meetings: Mapped[list["Meeting"]] = relationship(back_populates="schedule")


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    decisions: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, server_default="{}"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    meeting_date: Mapped[datetime | None] = mapped_column(nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )

    # New fields for Zoom integration & scheduling
    schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("meeting_schedules.id"), nullable=True
    )
    zoom_meeting_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    zoom_join_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    zoom_recording_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_source: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # 'zoom_api' | 'manual'
    status: Mapped[str] = mapped_column(
        String(30), default="scheduled", server_default="scheduled"
    )  # scheduled | in_progress | completed | cancelled
    duration_minutes: Mapped[int] = mapped_column(
        Integer, default=60, server_default="60"
    )
    sent_reminder_offsets_minutes: Mapped[list[int]] = mapped_column(
        ARRAY(Integer), default=list, server_default="{}"
    )

    # Relationships
    created_by: Mapped["TeamMember | None"] = relationship()
    schedule: Mapped["MeetingSchedule | None"] = relationship(back_populates="meetings")
    tasks: Mapped[list["Task"]] = relationship(back_populates="meeting")
    participants: Mapped[list["MeetingParticipant"]] = relationship(
        back_populates="meeting"
    )


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("idx_tasks_reminder_pending", "reminder_sent_at", "reminder_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    short_id: Mapped[int] = mapped_column(
        Integer, autoincrement=True, unique=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    checklist: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default="[]", nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), default="new", server_default="new"
    )
    priority: Mapped[str] = mapped_column(
        String(20), default="medium", server_default="medium"
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id"), nullable=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id"), nullable=True
    )
    meeting_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("meetings.id"), nullable=True
    )
    source: Mapped[str] = mapped_column(
        String(20), default="text", server_default="text"
    )
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    reminder_at: Mapped[datetime | None] = mapped_column(nullable=True)
    reminder_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminder_sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    assignee: Mapped["TeamMember | None"] = relationship(
        back_populates="tasks", foreign_keys=[assignee_id]
    )
    created_by: Mapped["TeamMember | None"] = relationship(
        back_populates="created_tasks", foreign_keys=[created_by_id]
    )
    meeting: Mapped["Meeting | None"] = relationship(back_populates="tasks")
    updates: Mapped[list["TaskUpdate"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class TaskUpdate(Base):
    __tablename__ = "task_updates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    update_type: Mapped[str] = mapped_column(
        String(30), default="progress", server_default="progress"
    )
    old_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    progress_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(
        String(20), default="telegram", server_default="telegram"
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )

    # Relationships
    task: Mapped["Task"] = relationship(back_populates="updates")
    author: Mapped["TeamMember"] = relationship(back_populates="task_updates")


class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id", ondelete="CASCADE"), primary_key=True
    )

    # Relationships
    meeting: Mapped["Meeting"] = relationship(back_populates="participants")
    member: Mapped["TeamMember"] = relationship()


class InAppNotification(Base):
    __tablename__ = "in_app_notifications"
    __table_args__ = (
        UniqueConstraint("recipient_id", "dedupe_key"),
        Index("idx_inapp_notifications_recipient_created", "recipient_id", "created_at"),
        Index("idx_inapp_notifications_recipient_unread", "recipient_id", "is_read", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(
        String(20), default="normal", server_default="normal"
    )
    action_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    task_short_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dedupe_key: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_read: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    read_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    recipient: Mapped["TeamMember"] = relationship(
        back_populates="notifications_received",
        foreign_keys=[recipient_id],
    )
    actor: Mapped["TeamMember | None"] = relationship(
        back_populates="notifications_authored",
        foreign_keys=[actor_id],
    )


class NotificationSubscription(Base):
    __tablename__ = "notification_subscriptions"
    __table_args__ = (
        UniqueConstraint("member_id", "event_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )

    # Relationships
    member: Mapped["TeamMember"] = relationship(
        back_populates="notification_subscriptions"
    )


class ReminderSettings(Base):
    __tablename__ = "reminder_settings"
    __table_args__ = (
        UniqueConstraint("member_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    reminder_time: Mapped[time] = mapped_column(
        Time, default=time(9, 0), server_default="09:00"
    )
    timezone: Mapped[str] = mapped_column(
        String(50), default="Europe/Moscow", server_default="Europe/Moscow"
    )
    days_of_week: Mapped[list[int]] = mapped_column(
        ARRAY(Integer), default=lambda: [1, 2, 3, 4, 5], server_default="{1,2,3,4,5}"
    )
    include_overdue: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    include_upcoming: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    upcoming_days: Mapped[int] = mapped_column(Integer, default=3, server_default="3")
    include_in_progress: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    include_new: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    digest_sections_order: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        default=lambda: ["overdue", "upcoming", "in_progress", "new"],
        server_default='{"overdue","upcoming","in_progress","new"}',
    )
    task_line_show_number: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    task_line_show_title: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    task_line_show_deadline: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    task_line_show_priority: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    task_line_fields_order: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        default=lambda: ["number", "title", "deadline", "priority"],
        server_default='{"number","title","deadline","priority"}',
    )
    configured_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    member: Mapped["TeamMember"] = relationship(
        back_populates="reminder_settings", foreign_keys=[member_id]
    )
    configured_by: Mapped["TeamMember | None"] = relationship(
        foreign_keys=[configured_by_id]
    )


class TelegramNotificationTarget(Base):
    __tablename__ = "telegram_notification_targets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    chat_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    thread_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    allow_incoming_tasks: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class TelegramBroadcastImagePreset(Base):
    __tablename__ = "telegram_broadcast_image_presets"
    __table_args__ = (
        Index(
            "idx_telegram_broadcast_image_presets_active_sort",
            "is_active",
            "sort_order",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    alias: Mapped[str] = mapped_column(String(120), nullable=False)
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    created_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[created_by_id])


class TelegramBroadcast(Base):
    __tablename__ = "telegram_broadcasts"
    __table_args__ = (
        Index("idx_telegram_broadcasts_status_scheduled_at", "status", "scheduled_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    chat_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    thread_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    message_html: Mapped[str] = mapped_column(Text, nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="scheduled", server_default="scheduled"
    )  # scheduled | sent | failed | cancelled
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id"), nullable=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    created_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[created_by_id])


class AppSettings(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    updated_by: Mapped["TeamMember | None"] = relationship()


# =============================================
# Content module models
# =============================================


class TelegramSession(Base):
    """Single-row table storing encrypted Telegram userbot credentials and session."""
    __tablename__ = "telegram_session"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    api_id_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    api_hash_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    session_string_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="disconnected", server_default="disconnected"
    )  # connected | disconnected | error
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    connected_at: Mapped[datetime | None] = mapped_column(nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class TelegramChannel(Base):
    """A monitored Telegram channel for content extraction."""
    __tablename__ = "telegram_channels"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(300), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    content: Mapped[list["TelegramContent"]] = relationship(
        back_populates="channel", cascade="all, delete-orphan"
    )


class TelegramContent(Base):
    """A single Telegram post or comment stored for analysis."""
    __tablename__ = "telegram_content"
    __table_args__ = (
        UniqueConstraint("channel_id", "telegram_message_id", name="uq_channel_message"),
        Index("idx_telegram_content_channel_date", "channel_id", "message_date"),
        Index("idx_telegram_content_loaded_at", "loaded_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    channel_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("telegram_channels.id", ondelete="CASCADE"), nullable=False
    )
    telegram_message_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    content_type: Mapped[ContentType] = mapped_column(
        Enum(ContentType, name="content_type_enum", create_constraint=False),
        nullable=False,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    message_date: Mapped[datetime] = mapped_column(nullable=False)
    loaded_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    channel: Mapped["TelegramChannel"] = relationship(back_populates="content")


class AnalysisPrompt(Base):
    """A reusable prompt template for LLM analysis."""
    __tablename__ = "analysis_prompts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    created_by: Mapped["TeamMember"] = relationship(foreign_keys=[created_by_id])


class AnalysisRun(Base):
    """A single analysis execution: download + LLM processing."""
    __tablename__ = "analysis_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    channels: Mapped[list] = mapped_column(JSONB, nullable=False)  # list of channel IDs
    date_from: Mapped[date] = mapped_column(Date, nullable=False)
    date_to: Mapped[date] = mapped_column(Date, nullable=False)
    content_type: Mapped[AnalysisContentType] = mapped_column(
        Enum(AnalysisContentType, name="analysis_content_type_enum", create_constraint=False),
        nullable=False,
    )
    prompt_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("analysis_prompts.id", ondelete="SET NULL"), nullable=True
    )
    prompt_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    ai_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ai_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    result_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AnalysisStatus] = mapped_column(
        Enum(AnalysisStatus, name="analysis_status_enum", create_constraint=False),
        default=AnalysisStatus.preparing,
        server_default="preparing",
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    run_by_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Relationships
    prompt: Mapped["AnalysisPrompt | None"] = relationship(foreign_keys=[prompt_id])
    run_by: Mapped["TeamMember"] = relationship(foreign_keys=[run_by_id])


class ContentAccess(Base):
    """Access grant for a Content sub-section (per user or per department)."""
    __tablename__ = "content_access"
    __table_args__ = (
        CheckConstraint(
            "member_id IS NOT NULL OR department_id IS NOT NULL",
            name="ck_content_access_target",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sub_section: Mapped[ContentSubSection] = mapped_column(
        Enum(ContentSubSection, name="content_sub_section_enum", create_constraint=False),
        nullable=False,
    )
    member_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="CASCADE"), nullable=True
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"), nullable=True
    )
    role: Mapped[ContentRole] = mapped_column(
        Enum(ContentRole, name="content_role_enum", create_constraint=False),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    member: Mapped["TeamMember | None"] = relationship(foreign_keys=[member_id])
    department: Mapped["Department | None"] = relationship(foreign_keys=[department_id])


class AIFeatureConfig(Base):
    """Per-feature AI provider/model configuration (replaces single-provider app_settings)."""
    __tablename__ = "ai_feature_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    feature_key: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
