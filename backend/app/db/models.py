import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


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
    role: Mapped[str] = mapped_column(String(50), default="member", server_default="member")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
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
    reminder_settings: Mapped["ReminderSettings | None"] = relationship(
        back_populates="member", foreign_keys="ReminderSettings.member_id", uselist=False
    )


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_summary: Mapped[str] = mapped_column(Text, nullable=False)
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

    # Relationships
    created_by: Mapped["TeamMember | None"] = relationship()
    tasks: Mapped[list["Task"]] = relationship(back_populates="meeting")
    participants: Mapped[list["MeetingParticipant"]] = relationship(
        back_populates="meeting"
    )


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    short_id: Mapped[int] = mapped_column(
        Integer, autoincrement=True, unique=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    include_in_progress: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
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
