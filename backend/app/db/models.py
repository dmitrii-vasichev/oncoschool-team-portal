import enum
import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    and_,
    inspect,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, foreign, mapped_column, relationship
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
    reports = "reports"


class ContentRole(str, enum.Enum):
    """Role within a Content sub-section."""
    viewer = "viewer"
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
    has_content_factory_access: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
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
    board_settings: Mapped["MeetingBoardSettings | None"] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", uselist=False
    )
    ai_processing: Mapped["MeetingAIProcessing | None"] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", uselist=False
    )


class TaskLabel(Base):
    __tablename__ = "task_labels"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_task_labels_slug"),
        Index("idx_task_labels_is_archived", "is_archived"),
        Index("idx_task_labels_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(30), nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    tasks: Mapped[list["Task"]] = relationship(
        secondary="task_label_links",
        back_populates="labels",
    )


class TaskLabelLink(Base):
    __tablename__ = "task_label_links"
    __table_args__ = (
        Index("idx_task_label_links_label_id", "label_id"),
        Index("idx_task_label_links_task_id", "task_id"),
    )

    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    label_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("task_labels.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


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
        String(20), default="normal", server_default="normal"
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
    labels: Mapped[list["TaskLabel"]] = relationship(
        secondary="task_label_links",
        back_populates="tasks",
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


class Idea(Base):
    __tablename__ = "ideas"
    __table_args__ = (
        Index("idx_ideas_status", "status"),
        Index("idx_ideas_author_id", "author_id"),
        Index("idx_ideas_review_owner_id", "review_owner_id"),
        Index("idx_ideas_project_id", "project_id"),
        Index("idx_ideas_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="new", server_default="new", nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    review_owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    decision_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    decision_at: Mapped[datetime | None] = mapped_column(nullable=True)
    deferred_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    deleted_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    author: Mapped["TeamMember"] = relationship(foreign_keys=[author_id])
    review_owner: Mapped["TeamMember"] = relationship(foreign_keys=[review_owner_id])
    decision_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[decision_by_id])
    deleted_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[deleted_by_id])
    project: Mapped["Project | None"] = relationship(
        foreign_keys=[project_id],
        post_update=True,
    )
    departments: Mapped[list["IdeaDepartment"]] = relationship(
        back_populates="idea", cascade="all, delete-orphan"
    )
    task_links: Mapped[list["IdeaTask"]] = relationship(
        back_populates="idea", cascade="all, delete-orphan"
    )
    comments: Mapped[list["IdeaComment"]] = relationship(
        back_populates="idea", cascade="all, delete-orphan"
    )
    events: Mapped[list["IdeaEvent"]] = relationship(
        back_populates="idea", cascade="all, delete-orphan"
    )


class IdeaDepartment(Base):
    __tablename__ = "idea_departments"
    __table_args__ = (
        UniqueConstraint("idea_id", "department_id", name="uq_idea_departments_idea_department"),
        UniqueConstraint("idea_id", "id", name="uq_idea_departments_idea_id_id"),
        Index("idx_idea_departments_idea_id", "idea_id"),
        Index("idx_idea_departments_department_id", "department_id"),
        Index("idx_idea_departments_owner_id", "owner_id"),
        Index("idx_idea_departments_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    idea_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), default="not_started", server_default="not_started", nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    idea: Mapped["Idea"] = relationship(back_populates="departments")
    department: Mapped["Department"] = relationship()
    owner: Mapped["TeamMember"] = relationship(foreign_keys=[owner_id])
    created_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[created_by_id])
    task_links: Mapped[list["IdeaTask"]] = relationship(
        back_populates="idea_department",
        primaryjoin=lambda: and_(
            IdeaDepartment.idea_id == IdeaTask.idea_id,
            IdeaDepartment.id == foreign(IdeaTask.idea_department_id),
        ),
        viewonly=True,
    )


class IdeaTask(Base):
    __tablename__ = "idea_tasks"
    __table_args__ = (
        UniqueConstraint("task_id", name="uq_idea_tasks_task_id"),
        ForeignKeyConstraint(
            ["idea_id", "idea_department_id"],
            ["idea_departments.idea_id", "idea_departments.id"],
            name="fk_idea_tasks_idea_department_same_idea",
        ),
        Index("idx_idea_tasks_idea_id", "idea_id"),
        Index("idx_idea_tasks_idea_department_id", "idea_department_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    idea_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False
    )
    idea_department_id: Mapped[uuid.UUID | None] = mapped_column(
        nullable=True
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    idea: Mapped["Idea"] = relationship(back_populates="task_links")
    idea_department: Mapped["IdeaDepartment | None"] = relationship(
        back_populates="task_links",
        primaryjoin=lambda: and_(
            IdeaDepartment.idea_id == IdeaTask.idea_id,
            IdeaDepartment.id == foreign(IdeaTask.idea_department_id),
        ),
        viewonly=True,
    )
    task: Mapped["Task"] = relationship()
    created_by: Mapped["TeamMember | None"] = relationship()


class IdeaComment(Base):
    __tablename__ = "idea_comments"
    __table_args__ = (
        Index("idx_idea_comments_idea_id", "idea_id"),
        Index("idx_idea_comments_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    idea_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    idea: Mapped["Idea"] = relationship(back_populates="comments")
    author: Mapped["TeamMember"] = relationship()


class IdeaEvent(Base):
    __tablename__ = "idea_events"
    __table_args__ = (
        Index("idx_idea_events_idea_id", "idea_id"),
        Index("idx_idea_events_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    idea_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default="{}", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    idea: Mapped["Idea"] = relationship(back_populates="events")
    actor: Mapped["TeamMember | None"] = relationship()


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        Index("idx_projects_status", "status"),
        Index("idx_projects_owner_id", "owner_id"),
        Index("idx_projects_source_idea_id", "source_idea_id"),
        Index("idx_projects_created_at", "created_at"),
        Index("idx_projects_deleted_at", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="planned", server_default="planned", nullable=False
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    source_idea_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ideas.id", ondelete="SET NULL"), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    deleted_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["TeamMember"] = relationship(foreign_keys=[owner_id])
    source_idea: Mapped["Idea | None"] = relationship(
        foreign_keys=[source_idea_id],
        post_update=True,
    )
    deleted_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[deleted_by_id])
    departments: Mapped[list["ProjectDepartment"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    milestones: Mapped[list["ProjectMilestone"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    task_links: Mapped[list["ProjectTask"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    comments: Mapped[list["ProjectComment"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    events: Mapped[list["ProjectEvent"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectDepartment(Base):
    __tablename__ = "project_departments"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "department_id",
            name="uq_project_departments_project_department",
        ),
        UniqueConstraint("project_id", "id", name="uq_project_departments_project_id_id"),
        Index("idx_project_departments_project_id", "project_id"),
        Index("idx_project_departments_department_id", "department_id"),
        Index("idx_project_departments_owner_id", "owner_id"),
        Index("idx_project_departments_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), default="not_started", server_default="not_started", nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="departments")
    department: Mapped["Department"] = relationship()
    owner: Mapped["TeamMember"] = relationship(foreign_keys=[owner_id])
    created_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[created_by_id])
    task_links: Mapped[list["ProjectTask"]] = relationship(
        back_populates="project_department",
        primaryjoin=lambda: and_(
            ProjectDepartment.project_id == ProjectTask.project_id,
            ProjectDepartment.id == foreign(ProjectTask.project_department_id),
        ),
        viewonly=True,
    )


class ProjectMilestone(Base):
    __tablename__ = "project_milestones"
    __table_args__ = (
        Index("idx_project_milestones_project_id", "project_id"),
        Index("idx_project_milestones_status", "status"),
        Index("idx_project_milestones_due_date", "due_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="planned", server_default="planned", nullable=False
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="milestones")


class ProjectTask(Base):
    __tablename__ = "project_tasks"
    __table_args__ = (
        UniqueConstraint("task_id", name="uq_project_tasks_task_id"),
        ForeignKeyConstraint(
            ["project_id", "project_department_id"],
            ["project_departments.project_id", "project_departments.id"],
            name="fk_project_tasks_project_department_same_project",
        ),
        Index("idx_project_tasks_project_id", "project_id"),
        Index("idx_project_tasks_project_department_id", "project_department_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    project_department_id: Mapped[uuid.UUID | None] = mapped_column(
        nullable=True
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="task_links")
    project_department: Mapped["ProjectDepartment | None"] = relationship(
        back_populates="task_links",
        primaryjoin=lambda: and_(
            ProjectDepartment.project_id == ProjectTask.project_id,
            ProjectDepartment.id == foreign(ProjectTask.project_department_id),
        ),
        viewonly=True,
    )
    task: Mapped["Task"] = relationship()
    created_by: Mapped["TeamMember | None"] = relationship()


class ProjectComment(Base):
    __tablename__ = "project_comments"
    __table_args__ = (
        Index("idx_project_comments_project_id", "project_id"),
        Index("idx_project_comments_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="comments")
    author: Mapped["TeamMember"] = relationship()


class ProjectEvent(Base):
    __tablename__ = "project_events"
    __table_args__ = (
        Index("idx_project_events_project_id", "project_id"),
        Index("idx_project_events_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default="{}", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="events")
    actor: Mapped["TeamMember | None"] = relationship()


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


class MeetingBoardSettings(Base):
    __tablename__ = "meeting_board_settings"
    __table_args__ = (
        UniqueConstraint("meeting_id", name="uq_meeting_board_settings_meeting_id"),
        Index("idx_meeting_board_settings_meeting_id", "meeting_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False
    )
    added_member_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), default=list, server_default="{}"
    )
    added_department_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), default=list, server_default="{}"
    )
    pinned_task_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), default=list, server_default="{}"
    )
    focus_label_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), default=list, server_default="{}"
    )
    materials: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default="[]", nullable=False
    )
    board_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    meeting: Mapped["Meeting"] = relationship(back_populates="board_settings")


class MeetingAIProcessing(Base):
    __tablename__ = "meeting_ai_processing"
    __table_args__ = (
        UniqueConstraint("meeting_id", name="uq_meeting_ai_processing_meeting_id"),
        Index("idx_meeting_ai_processing_status", "status"),
        Index("idx_meeting_ai_processing_phase", "transcription_phase"),
        Index("idx_meeting_ai_processing_heartbeat", "transcription_last_heartbeat_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(40), default="idle", server_default="idle", nullable=False
    )
    transcript_source: Mapped[str | None] = mapped_column(String(40), nullable=True)
    transcription_model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_char_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_cost_usd: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )
    draft_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    draft_decisions: Mapped[list[str]] = mapped_column(
        JSONB, default=list, server_default="[]", nullable=False
    )
    draft_tasks: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default="[]", nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(nullable=True)
    published_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    transcription_requested_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    transcription_phase: Mapped[str | None] = mapped_column(String(40), nullable=True)
    transcription_progress_percent: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    transcription_current_chunk: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    transcription_total_chunks: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    transcription_source_bytes: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True
    )
    transcription_prepared_bytes: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True
    )
    transcription_attempt_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    transcription_last_heartbeat_at: Mapped[datetime | None] = mapped_column(
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    meeting: Mapped["Meeting"] = relationship(back_populates="ai_processing")
    transcription_requested_by: Mapped["TeamMember | None"] = relationship(
        foreign_keys=[transcription_requested_by_id]
    )


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
    types: Mapped[list[str]] = mapped_column(
        ARRAY(String(50)), nullable=False, default=list, server_default="{}"
    )
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
        Enum(ContentType, native_enum=False, create_constraint=False),
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
        Enum(AnalysisContentType, native_enum=False, create_constraint=False),
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
        Enum(AnalysisStatus, native_enum=False, create_constraint=False),
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
        Enum(ContentSubSection, native_enum=False, create_constraint=False),
        nullable=False,
    )
    member_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="CASCADE"), nullable=True
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"), nullable=True
    )
    role: Mapped[ContentRole] = mapped_column(
        Enum(ContentRole, native_enum=False, create_constraint=False),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    member: Mapped["TeamMember | None"] = relationship(foreign_keys=[member_id])
    department: Mapped["Department | None"] = relationship(foreign_keys=[department_id])


class DailyMetric(Base):
    """Daily business metrics from GetCourse (or other sources)."""
    __tablename__ = "daily_metrics"
    __table_args__ = (
        UniqueConstraint("source", "metric_date", name="uq_daily_metrics_source_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    metric_date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="getcourse")
    users_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    payments_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    payments_sum: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, server_default="0")
    orders_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    orders_sum: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, server_default="0")
    collected_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    collected_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    collected_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[collected_by_id])


class GetCourseCredentials(Base):
    """Single-row table for encrypted GetCourse API credentials."""
    __tablename__ = "getcourse_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(String(1000), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id"), nullable=True
    )

    updated_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[updated_by_id])


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


# ─────────────────────────────────────────────────────────────────────
# Content Factory (cf_*) — internal content production module
# Design doc: docs/content-factory-design.md
# ─────────────────────────────────────────────────────────────────────


class CFPlatform(Base):
    __tablename__ = "cf_platform"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    capabilities: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CFFormat(Base):
    __tablename__ = "cf_format"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    default_objective: Mapped[str | None] = mapped_column(String(50), nullable=True)
    requires_medical_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CFRubric(Base):
    __tablename__ = "cf_rubric"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    deprecated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CFNosology(Base):
    __tablename__ = "cf_nosology"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    deprecated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CFFunnelTemplate(Base):
    __tablename__ = "cf_funnel_template"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_publications: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CFExternalSegment(Base):
    __tablename__ = "cf_external_segment"
    __table_args__ = (UniqueConstraint("source", "source_segment_id", name="uq_cf_segment_source"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="getcourse", server_default="getcourse")
    source_segment_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    population_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    filter_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    snapshots: Mapped[list["CFSegmentSnapshot"]] = relationship(
        back_populates="external_segment", cascade="all, delete-orphan"
    )


class CFSegmentSnapshot(Base):
    __tablename__ = "cf_segment_snapshot"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_segment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_external_segment.id", ondelete="CASCADE"), nullable=False
    )
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    population_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    external_segment: Mapped["CFExternalSegment"] = relationship(back_populates="snapshots")


class CFBundle(Base):
    __tablename__ = "cf_bundle"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    product_stream: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="planning", server_default="planning")
    event_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False)
    brief: Mapped[str | None] = mapped_column(Text, nullable=True)
    funnel_template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_funnel_template.id"), nullable=True
    )
    source_material_refs: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    publications: Mapped[list["CFPublication"]] = relationship(
        back_populates="bundle", cascade="all, delete-orphan"
    )


class CFPublication(Base):
    __tablename__ = "cf_publication"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bundle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_bundle.id", ondelete="CASCADE"), nullable=False
    )
    platform_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cf_platform.id"), nullable=False)
    format_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cf_format.id"), nullable=False)
    rubric_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("cf_rubric.id"), nullable=True)
    nosology_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("cf_nosology.id"), nullable=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_refs: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    responsible_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", server_default="draft")
    platform_post_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    platform_post_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    utm: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    cancelled_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    bundle: Mapped["CFBundle"] = relationship(back_populates="publications")
    versions: Mapped[list["CFPublicationVersion"]] = relationship(
        back_populates="publication", cascade="all, delete-orphan",
        order_by="CFPublicationVersion.version_number",
    )
    segment_targets: Mapped[list["CFPublicationSegmentTarget"]] = relationship(
        back_populates="publication", cascade="all, delete-orphan"
    )
    metric_snapshots: Mapped[list["CFMetricSnapshot"]] = relationship(
        back_populates="publication", cascade="all, delete-orphan"
    )


class CFPublicationVersion(Base):
    __tablename__ = "cf_publication_version"
    __table_args__ = (UniqueConstraint("publication_id", "version_number", name="uq_cf_pub_version"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    publication_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_publication.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    edited_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False)
    edited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    approval_event: Mapped[str] = mapped_column(String(30), nullable=False)
    source_materials_refs: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    publication: Mapped["CFPublication"] = relationship(back_populates="versions")


class CFPublicationRelation(Base):
    __tablename__ = "cf_publication_relation"
    __table_args__ = (
        UniqueConstraint("from_publication_id", "to_publication_id", "relation_type", name="uq_cf_pub_relation"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_publication_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_publication.id", ondelete="CASCADE"), nullable=False
    )
    to_publication_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_publication.id", ondelete="CASCADE"), nullable=False
    )
    relation_type: Mapped[str] = mapped_column(String(30), nullable=False)


class CFPublicationSegmentTarget(Base):
    __tablename__ = "cf_publication_segment_target"

    publication_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_publication.id", ondelete="CASCADE"), primary_key=True
    )
    external_segment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_external_segment.id"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="target", server_default="target")
    expected_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_count_at_send: Mapped[int | None] = mapped_column(Integer, nullable=True)

    publication: Mapped["CFPublication"] = relationship(back_populates="segment_targets")


class CFMetricSnapshot(Base):
    __tablename__ = "cf_metric_snapshot"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    publication_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_publication.id", ondelete="CASCADE"), nullable=False
    )
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    window: Mapped[str] = mapped_column(String(20), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(50), nullable=False)
    metric_value: Mapped[Decimal | None] = mapped_column(Numeric(20, 4), nullable=True)
    metric_value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="manual", server_default="manual")
    source_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence: Mapped[str] = mapped_column(String(10), nullable=False, default="high", server_default="high")
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    captured_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=True
    )

    publication: Mapped["CFPublication"] = relationship(back_populates="metric_snapshots")


class CFRetroNote(Base):
    __tablename__ = "cf_retro_note"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    retro_type: Mapped[str] = mapped_column(String(20), nullable=False, default="weekly", server_default="weekly")
    bundle_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_bundle.id", ondelete="SET NULL"), nullable=True
    )
    facilitator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False)
    best_by_objective: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    broken: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    learnings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    decisions: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    actions: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CFGuestStory(Base):
    __tablename__ = "cf_guest_story"
    __table_args__ = (
        Index("ix_cf_guest_story_status", "status"),
        Index("ix_cf_guest_story_owner", "owner_id"),
        Index("ix_cf_guest_story_bundle", "bundle_id"),
        Index("ix_cf_guest_story_publication", "publication_id"),
        Index("ix_cf_guest_story_stage_due", "stage_due_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_ref: Mapped[str | None] = mapped_column(String(300), nullable=True)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="manual", server_default="manual")
    source_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    story_brief: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="sourced", server_default="sourced")
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False)
    stage_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    nosology_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("cf_nosology.id"), nullable=True)
    bundle_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_bundle.id", ondelete="SET NULL"), nullable=True
    )
    publication_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_publication.id", ondelete="SET NULL"), nullable=True
    )
    screening_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    medical_factcheck_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    consent_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="not_started", server_default="not_started"
    )
    consent_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    consent_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    allowed_channels: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    anonymity_level: Mapped[str] = mapped_column(
        String(30), nullable=False, default="full_name", server_default="full_name"
    )
    sensitive_topics: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    legal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    gift_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="not_required", server_default="not_required"
    )
    follow_up_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    events: Mapped[list["CFGuestStoryEvent"]] = relationship(
        back_populates="guest_story", cascade="all, delete-orphan"
    )


class CFGuestStoryEvent(Base):
    __tablename__ = "cf_guest_story_event"
    __table_args__ = (
        Index("ix_cf_guest_story_event_story_created", "guest_story_id", "created_at"),
        Index("ix_cf_guest_story_event_parent", "parent_event_id"),
        Index("ix_cf_guest_story_event_type", "event_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    guest_story_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cf_guest_story.id", ondelete="CASCADE"), nullable=False
    )
    parent_event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cf_guest_story_event.id", ondelete="CASCADE"),
        nullable=True,
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    old_value: Mapped[str | None] = mapped_column(String(300), nullable=True)
    new_value: Mapped[str | None] = mapped_column(String(300), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    guest_story: Mapped["CFGuestStory"] = relationship(back_populates="events")
    parent_event: Mapped["CFGuestStoryEvent | None"] = relationship(
        "CFGuestStoryEvent",
        remote_side="CFGuestStoryEvent.id",
        back_populates="replies",
    )
    replies: Mapped[list["CFGuestStoryEvent"]] = relationship(
        "CFGuestStoryEvent",
        back_populates="parent_event",
        cascade="all, delete-orphan",
    )
    actor: Mapped["TeamMember | None"] = relationship()
