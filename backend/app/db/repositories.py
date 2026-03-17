import logging
import uuid

import sqlalchemy as sa
from sqlalchemy import select, update, delete, func, or_, and_, cast
from sqlalchemy.dialects.postgresql import INTERVAL
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

from datetime import datetime

from app.db.models import (
    AIFeatureConfig,
    AnalysisPrompt,
    AnalysisRun,
    AnalysisStatus,
    AppSettings,
    ContentAccess,
    ContentRole,
    ContentSubSection,
    Department,
    InAppNotification,
    Meeting,
    MeetingParticipant,
    MeetingSchedule,
    NotificationSubscription,
    ReminderSettings,
    Task,
    TaskUpdate,
    TeamMember,
    TelegramBroadcast,
    TelegramBroadcastImagePreset,
    TelegramChannel,
    TelegramContent,
    TelegramNotificationTarget,
    TelegramSession,
)


class TeamMemberRepository:
    async def get_by_id(self, session: AsyncSession, member_id: uuid.UUID) -> TeamMember | None:
        stmt = (
            select(TeamMember)
            .options(
                selectinload(TeamMember.department),
                selectinload(TeamMember.extra_department_accesses),
            )
            .where(TeamMember.id == member_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_telegram_id(self, session: AsyncSession, telegram_id: int) -> TeamMember | None:
        stmt = (
            select(TeamMember)
            .options(
                selectinload(TeamMember.department),
                selectinload(TeamMember.extra_department_accesses),
            )
            .where(TeamMember.telegram_id == telegram_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_active(self, session: AsyncSession) -> list[TeamMember]:
        stmt = (
            select(TeamMember)
            .options(
                selectinload(TeamMember.department),
                selectinload(TeamMember.extra_department_accesses),
            )
            .where(TeamMember.is_active.is_(True))
            .order_by(TeamMember.full_name)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_all(self, session: AsyncSession) -> list[TeamMember]:
        stmt = (
            select(TeamMember)
            .options(
                selectinload(TeamMember.department),
                selectinload(TeamMember.extra_department_accesses),
            )
            .order_by(TeamMember.full_name)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_telegram_username(self, session: AsyncSession, username: str) -> TeamMember | None:
        stmt = (
            select(TeamMember)
            .options(
                selectinload(TeamMember.department),
                selectinload(TeamMember.extra_department_accesses),
            )
            .where(func.lower(TeamMember.telegram_username) == username.lower())
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, session: AsyncSession, **kwargs) -> TeamMember:
        member = TeamMember(**kwargs)
        session.add(member)
        await session.flush()
        return member

    async def update(self, session: AsyncSession, member_id: uuid.UUID, **kwargs) -> TeamMember | None:
        member = await self.get_by_id(session, member_id)
        if not member:
            return None
        for key, value in kwargs.items():
            setattr(member, key, value)
        await session.flush()
        return member


class DepartmentRepository:
    async def get_all(self, session: AsyncSession) -> list[Department]:
        stmt = (
            select(Department)
            .where(Department.is_active.is_(True))
            .order_by(Department.sort_order, Department.name)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, session: AsyncSession, dept_id: uuid.UUID) -> Department | None:
        return await session.get(Department, dept_id)

    async def create(self, session: AsyncSession, **kwargs) -> Department:
        dept = Department(**kwargs)
        session.add(dept)
        await session.flush()
        return dept

    async def update(self, session: AsyncSession, dept_id: uuid.UUID, **kwargs) -> Department | None:
        dept = await self.get_by_id(session, dept_id)
        if not dept:
            return None
        for key, value in kwargs.items():
            setattr(dept, key, value)
        await session.flush()
        return dept

    async def delete(self, session: AsyncSession, dept_id: uuid.UUID) -> bool:
        dept = await self.get_by_id(session, dept_id)
        if not dept:
            return False
        await session.delete(dept)
        await session.flush()
        return True


class TaskRepository:
    async def get_by_id(self, session: AsyncSession, task_id: uuid.UUID) -> Task | None:
        stmt = (
            select(Task)
            .options(selectinload(Task.assignee), selectinload(Task.created_by))
            .where(Task.id == task_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_short_id(self, session: AsyncSession, short_id: int) -> Task | None:
        stmt = (
            select(Task)
            .options(selectinload(Task.assignee), selectinload(Task.created_by))
            .where(Task.short_id == short_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_assignee(self, session: AsyncSession, assignee_id: uuid.UUID) -> list[Task]:
        stmt = (
            select(Task)
            .options(selectinload(Task.assignee), selectinload(Task.created_by))
            .where(Task.assignee_id == assignee_id)
            .order_by(Task.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_all_active(self, session: AsyncSession) -> list[Task]:
        stmt = (
            select(Task)
            .options(selectinload(Task.assignee), selectinload(Task.created_by))
            .where(Task.status.notin_(["done", "cancelled"]))
            .order_by(Task.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, session: AsyncSession, **kwargs) -> Task:
        # Retry loop: max(short_id)+1 can race under concurrent inserts.
        # The UNIQUE constraint on short_id guarantees no duplicates;
        # on conflict we simply re-read max and retry.
        max_attempts = 3
        for attempt in range(max_attempts):
            stmt = select(func.coalesce(func.max(Task.short_id), 0) + 1)
            result = await session.execute(stmt)
            next_short_id = result.scalar_one()

            task = Task(short_id=next_short_id, **kwargs)
            session.add(task)
            try:
                await session.flush()
                break
            except IntegrityError:
                await session.rollback()
                if attempt == max_attempts - 1:
                    raise
                logger.warning(
                    "short_id collision (%d), retrying (%d/%d)",
                    next_short_id, attempt + 1, max_attempts,
                )
        # Reload with relationships
        return await self.get_by_id(session, task.id)

    async def update(self, session: AsyncSession, task_id: uuid.UUID, **kwargs) -> Task | None:
        task = await session.get(Task, task_id)
        if not task:
            return None
        for key, value in kwargs.items():
            setattr(task, key, value)
        await session.flush()
        return await self.get_by_id(session, task_id)

    async def delete(self, session: AsyncSession, task_id: uuid.UUID) -> bool:
        stmt = delete(Task).where(Task.id == task_id)
        result = await session.execute(stmt)
        return result.rowcount > 0


class TaskUpdateRepository:
    async def get_by_task(self, session: AsyncSession, task_id: uuid.UUID) -> list[TaskUpdate]:
        stmt = (
            select(TaskUpdate)
            .options(selectinload(TaskUpdate.author))
            .where(TaskUpdate.task_id == task_id)
            .order_by(TaskUpdate.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, session: AsyncSession, **kwargs) -> TaskUpdate:
        task_update = TaskUpdate(**kwargs)
        session.add(task_update)
        await session.flush()
        return task_update


class MeetingRepository:
    async def get_by_id(self, session: AsyncSession, meeting_id: uuid.UUID) -> Meeting | None:
        stmt = (
            select(Meeting)
            .options(selectinload(Meeting.participants), selectinload(Meeting.schedule))
            .where(Meeting.id == meeting_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, session: AsyncSession) -> list[Meeting]:
        stmt = (
            select(Meeting)
            .options(selectinload(Meeting.participants), selectinload(Meeting.schedule))
            .order_by(Meeting.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self, session: AsyncSession, participant_ids: list[uuid.UUID] | None = None, **kwargs
    ) -> Meeting:
        meeting = Meeting(**kwargs)
        session.add(meeting)
        await session.flush()

        if participant_ids:
            for member_id in participant_ids:
                session.add(
                    MeetingParticipant(meeting_id=meeting.id, member_id=member_id)
                )
            await session.flush()

        return meeting

    async def get_by_zoom_id(self, session: AsyncSession, zoom_meeting_id: str) -> Meeting | None:
        stmt = (
            select(Meeting)
            .options(selectinload(Meeting.participants), selectinload(Meeting.schedule))
            .where(Meeting.zoom_meeting_id == zoom_meeting_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_upcoming(self, session: AsyncSession, limit: int = 10) -> list[Meeting]:
        # Keep UTC timestamp naive to match DB columns stored without tz info.
        now_utc_naive = datetime.utcnow()
        # Use end time (start + duration) so in-progress meetings still appear
        end_time = Meeting.meeting_date + cast(
            func.concat(Meeting.duration_minutes, ' minutes'), INTERVAL
        )
        stmt = (
            select(Meeting)
            .options(selectinload(Meeting.participants), selectinload(Meeting.schedule))
            .where(
                Meeting.status == "scheduled",
                or_(
                    and_(
                        Meeting.meeting_date.is_not(None),
                        end_time > now_utc_naive,
                    ),
                    and_(
                        Meeting.meeting_date.is_(None),
                        Meeting.schedule_id.is_not(None),
                        Meeting.schedule.has(
                            and_(
                                MeetingSchedule.recurrence == "on_demand",
                                MeetingSchedule.is_active.is_(True),
                            )
                        ),
                    ),
                ),
            )
            .order_by(Meeting.meeting_date.asc().nullslast(), Meeting.created_at.asc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_upcoming_for_department(
        self,
        session: AsyncSession,
        department_id: uuid.UUID,
        limit: int = 10,
    ) -> list[Meeting]:
        """Return upcoming meetings where at least one participant is from department."""
        now_utc_naive = datetime.utcnow()
        end_time = Meeting.meeting_date + cast(
            func.concat(Meeting.duration_minutes, ' minutes'), INTERVAL
        )
        stmt = (
            select(Meeting)
            .options(selectinload(Meeting.participants), selectinload(Meeting.schedule))
            .join(MeetingParticipant, Meeting.id == MeetingParticipant.meeting_id)
            .join(TeamMember, MeetingParticipant.member_id == TeamMember.id)
            .where(
                Meeting.status == "scheduled",
                or_(
                    and_(
                        Meeting.meeting_date.is_not(None),
                        end_time > now_utc_naive,
                    ),
                    and_(
                        Meeting.meeting_date.is_(None),
                        Meeting.schedule_id.is_not(None),
                        Meeting.schedule.has(
                            and_(
                                MeetingSchedule.recurrence == "on_demand",
                                MeetingSchedule.is_active.is_(True),
                            )
                        ),
                    ),
                ),
                TeamMember.department_id == department_id,
            )
            .order_by(Meeting.meeting_date.asc().nullslast(), Meeting.created_at.asc())
            .distinct()
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_past(self, session: AsyncSession, limit: int = 20) -> list[Meeting]:
        now_utc_naive = datetime.utcnow()
        # Use end time (start + duration) so in-progress meetings don't appear here
        end_time = Meeting.meeting_date + cast(
            func.concat(Meeting.duration_minutes, ' minutes'), INTERVAL
        )
        stmt = (
            select(Meeting)
            .options(selectinload(Meeting.participants), selectinload(Meeting.schedule))
            .where(
                or_(
                    Meeting.status.in_(["completed", "cancelled"]),
                    and_(
                        Meeting.status == "scheduled",
                        Meeting.meeting_date.is_not(None),
                        end_time <= now_utc_naive,
                    ),
                )
            )
            .order_by(Meeting.meeting_date.desc().nullslast())
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def delete(self, session: AsyncSession, meeting_id: uuid.UUID) -> bool:
        stmt = delete(Meeting).where(Meeting.id == meeting_id)
        result = await session.execute(stmt)
        return result.rowcount > 0


class MeetingScheduleRepository:
    async def get_all_active(self, session: AsyncSession) -> list[MeetingSchedule]:
        stmt = (
            select(MeetingSchedule)
            .where(MeetingSchedule.is_active.is_(True))
            .order_by(MeetingSchedule.day_of_week, MeetingSchedule.time_utc)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, session: AsyncSession, schedule_id: uuid.UUID) -> MeetingSchedule | None:
        return await session.get(MeetingSchedule, schedule_id)

    async def create(self, session: AsyncSession, **kwargs) -> MeetingSchedule:
        schedule = MeetingSchedule(**kwargs)
        session.add(schedule)
        await session.flush()
        return schedule

    async def update(self, session: AsyncSession, schedule_id: uuid.UUID, **kwargs) -> MeetingSchedule | None:
        schedule = await self.get_by_id(session, schedule_id)
        if not schedule:
            return None
        for key, value in kwargs.items():
            setattr(schedule, key, value)
        await session.flush()
        return schedule

    async def delete(self, session: AsyncSession, schedule_id: uuid.UUID) -> None:
        schedule = await self.get_by_id(session, schedule_id)
        if schedule:
            schedule.is_active = False
            await session.flush()

    async def get_schedules_for_time(
        self, session: AsyncSession, day_of_week: int, hour_utc: int, minute_utc: int
    ) -> list[MeetingSchedule]:
        """Find active schedules that should trigger at or near the given time."""
        stmt = (
            select(MeetingSchedule)
            .where(
                MeetingSchedule.is_active.is_(True),
                MeetingSchedule.day_of_week == day_of_week,
            )
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


class TelegramTargetRepository:
    async def get_all_active(self, session: AsyncSession) -> list[TelegramNotificationTarget]:
        stmt = (
            select(TelegramNotificationTarget)
            .where(TelegramNotificationTarget.is_active.is_(True))
            .order_by(TelegramNotificationTarget.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_active_chat_ids_for_incoming_tasks(self, session: AsyncSession) -> set[int]:
        stmt = (
            select(TelegramNotificationTarget.chat_id)
            .where(
                TelegramNotificationTarget.is_active.is_(True),
                TelegramNotificationTarget.allow_incoming_tasks.is_(True),
            )
        )
        result = await session.execute(stmt)
        return {int(chat_id) for chat_id in result.scalars().all()}

    async def get_by_id(self, session: AsyncSession, target_id: uuid.UUID) -> TelegramNotificationTarget | None:
        return await session.get(TelegramNotificationTarget, target_id)

    async def create(self, session: AsyncSession, **kwargs) -> TelegramNotificationTarget:
        target = TelegramNotificationTarget(**kwargs)
        session.add(target)
        await session.flush()
        return target

    async def update(self, session: AsyncSession, target_id: uuid.UUID, **kwargs) -> TelegramNotificationTarget | None:
        target = await self.get_by_id(session, target_id)
        if not target:
            return None
        for key, value in kwargs.items():
            setattr(target, key, value)
        await session.flush()
        return target

    async def delete(self, session: AsyncSession, target_id: uuid.UUID) -> bool:
        stmt = delete(TelegramNotificationTarget).where(TelegramNotificationTarget.id == target_id)
        result = await session.execute(stmt)
        return result.rowcount > 0


class TelegramBroadcastRepository:
    async def get_all(
        self,
        session: AsyncSession,
        *,
        status: str | None = None,
        limit: int = 100,
    ) -> list[TelegramBroadcast]:
        stmt = select(TelegramBroadcast).order_by(TelegramBroadcast.scheduled_at.desc()).limit(limit)
        if status:
            stmt = stmt.where(TelegramBroadcast.status == status)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_due_scheduled(
        self,
        session: AsyncSession,
        *,
        now_utc: datetime,
        limit: int = 50,
    ) -> list[TelegramBroadcast]:
        stmt = (
            select(TelegramBroadcast)
            .where(
                TelegramBroadcast.status == "scheduled",
                TelegramBroadcast.scheduled_at <= now_utc,
            )
            .order_by(TelegramBroadcast.scheduled_at.asc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(
        self,
        session: AsyncSession,
        broadcast_id: uuid.UUID,
    ) -> TelegramBroadcast | None:
        return await session.get(TelegramBroadcast, broadcast_id)

    async def create(self, session: AsyncSession, **kwargs) -> TelegramBroadcast:
        broadcast = TelegramBroadcast(**kwargs)
        session.add(broadcast)
        await session.flush()
        return broadcast

    async def update(
        self,
        session: AsyncSession,
        broadcast_id: uuid.UUID,
        **kwargs,
    ) -> TelegramBroadcast | None:
        broadcast = await self.get_by_id(session, broadcast_id)
        if not broadcast:
            return None
        for key, value in kwargs.items():
            setattr(broadcast, key, value)
        await session.flush()
        return broadcast

    async def count_scheduled_with_image_path(
        self,
        session: AsyncSession,
        *,
        image_path: str,
        exclude_broadcast_id: uuid.UUID | None = None,
    ) -> int:
        stmt = select(func.count(TelegramBroadcast.id)).where(
            TelegramBroadcast.status == "scheduled",
            TelegramBroadcast.image_path == image_path,
        )
        if exclude_broadcast_id is not None:
            stmt = stmt.where(TelegramBroadcast.id != exclude_broadcast_id)
        result = await session.execute(stmt)
        return int(result.scalar_one() or 0)


class TelegramBroadcastImagePresetRepository:
    async def get_all(
        self,
        session: AsyncSession,
        *,
        include_inactive: bool = True,
    ) -> list[TelegramBroadcastImagePreset]:
        stmt = select(TelegramBroadcastImagePreset)
        if not include_inactive:
            stmt = stmt.where(TelegramBroadcastImagePreset.is_active.is_(True))
        stmt = stmt.order_by(
            TelegramBroadcastImagePreset.sort_order.asc(),
            TelegramBroadcastImagePreset.created_at.asc(),
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(
        self,
        session: AsyncSession,
        preset_id: uuid.UUID,
    ) -> TelegramBroadcastImagePreset | None:
        return await session.get(TelegramBroadcastImagePreset, preset_id)

    async def get_active_by_id(
        self,
        session: AsyncSession,
        preset_id: uuid.UUID,
    ) -> TelegramBroadcastImagePreset | None:
        stmt = select(TelegramBroadcastImagePreset).where(
            TelegramBroadcastImagePreset.id == preset_id,
            TelegramBroadcastImagePreset.is_active.is_(True),
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_alias_ci(
        self,
        session: AsyncSession,
        *,
        alias: str,
        exclude_preset_id: uuid.UUID | None = None,
    ) -> TelegramBroadcastImagePreset | None:
        stmt = select(TelegramBroadcastImagePreset).where(
            func.lower(TelegramBroadcastImagePreset.alias) == alias.lower()
        )
        if exclude_preset_id is not None:
            stmt = stmt.where(TelegramBroadcastImagePreset.id != exclude_preset_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, session: AsyncSession, **kwargs) -> TelegramBroadcastImagePreset:
        preset = TelegramBroadcastImagePreset(**kwargs)
        session.add(preset)
        await session.flush()
        return preset

    async def update(
        self,
        session: AsyncSession,
        preset_id: uuid.UUID,
        **kwargs,
    ) -> TelegramBroadcastImagePreset | None:
        preset = await self.get_by_id(session, preset_id)
        if not preset:
            return None
        for key, value in kwargs.items():
            setattr(preset, key, value)
        await session.flush()
        return preset

    async def delete(self, session: AsyncSession, preset_id: uuid.UUID) -> bool:
        stmt = delete(TelegramBroadcastImagePreset).where(
            TelegramBroadcastImagePreset.id == preset_id
        )
        result = await session.execute(stmt)
        return result.rowcount > 0

    async def count_with_image_path(
        self,
        session: AsyncSession,
        *,
        image_path: str,
        exclude_preset_id: uuid.UUID | None = None,
    ) -> int:
        stmt = select(func.count(TelegramBroadcastImagePreset.id)).where(
            TelegramBroadcastImagePreset.image_path == image_path
        )
        if exclude_preset_id is not None:
            stmt = stmt.where(TelegramBroadcastImagePreset.id != exclude_preset_id)
        result = await session.execute(stmt)
        return int(result.scalar_one() or 0)


class NotificationSubscriptionRepository:
    async def get_by_member(
        self, session: AsyncSession, member_id: uuid.UUID
    ) -> list[NotificationSubscription]:
        stmt = (
            select(NotificationSubscription)
            .where(NotificationSubscription.member_id == member_id)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_active_by_event(
        self, session: AsyncSession, event_type: str
    ) -> list[NotificationSubscription]:
        stmt = (
            select(NotificationSubscription)
            .options(selectinload(NotificationSubscription.member))
            .join(NotificationSubscription.member)
            .where(
                NotificationSubscription.event_type == event_type,
                NotificationSubscription.is_active.is_(True),
                TeamMember.is_active.is_(True),
            )
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def upsert(
        self, session: AsyncSession, member_id: uuid.UUID, event_type: str, is_active: bool
    ) -> NotificationSubscription:
        stmt = select(NotificationSubscription).where(
            NotificationSubscription.member_id == member_id,
            NotificationSubscription.event_type == event_type,
        )
        result = await session.execute(stmt)
        sub = result.scalar_one_or_none()
        if sub:
            sub.is_active = is_active
        else:
            sub = NotificationSubscription(
                member_id=member_id, event_type=event_type, is_active=is_active
            )
            session.add(sub)
        await session.flush()
        return sub


class InAppNotificationRepository:
    @staticmethod
    def _task_reference_is_valid():
        task_exists = (
            select(Task.id)
            .where(Task.short_id == InAppNotification.task_short_id)
            .exists()
        )
        return or_(
            InAppNotification.task_short_id.is_(None),
            task_exists,
        )

    async def list_for_member(
        self,
        session: AsyncSession,
        member_id: uuid.UUID,
        *,
        unread_only: bool = False,
        limit: int = 30,
    ) -> list[InAppNotification]:
        stmt = (
            select(InAppNotification)
            .options(selectinload(InAppNotification.actor))
            .where(
                InAppNotification.recipient_id == member_id,
                self._task_reference_is_valid(),
            )
            .order_by(InAppNotification.created_at.desc())
            .limit(limit)
        )
        if unread_only:
            stmt = stmt.where(InAppNotification.is_read.is_(False))
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_unread_count(
        self, session: AsyncSession, member_id: uuid.UUID
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(InAppNotification)
            .where(
                InAppNotification.recipient_id == member_id,
                InAppNotification.is_read.is_(False),
                self._task_reference_is_valid(),
            )
        )
        result = await session.execute(stmt)
        return int(result.scalar_one() or 0)

    async def create(self, session: AsyncSession, **kwargs) -> InAppNotification:
        notification = InAppNotification(**kwargs)
        session.add(notification)
        await session.flush()
        return notification

    async def create_if_not_exists(
        self,
        session: AsyncSession,
        *,
        recipient_id: uuid.UUID,
        dedupe_key: str | None,
        **kwargs,
    ) -> InAppNotification | None:
        if dedupe_key:
            stmt = select(InAppNotification).where(
                InAppNotification.recipient_id == recipient_id,
                InAppNotification.dedupe_key == dedupe_key,
            )
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing:
                return None

        notification = InAppNotification(
            recipient_id=recipient_id,
            dedupe_key=dedupe_key,
            **kwargs,
        )
        session.add(notification)
        await session.flush()
        return notification

    async def mark_read(
        self,
        session: AsyncSession,
        member_id: uuid.UUID,
        notification_id: uuid.UUID,
    ) -> InAppNotification | None:
        notification = await session.get(InAppNotification, notification_id)
        if not notification or notification.recipient_id != member_id:
            return None
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            await session.flush()
        return notification

    async def mark_all_read(self, session: AsyncSession, member_id: uuid.UUID) -> int:
        stmt = (
            update(InAppNotification)
            .where(
                InAppNotification.recipient_id == member_id,
                InAppNotification.is_read.is_(False),
            )
            .values(is_read=True, read_at=datetime.utcnow())
        )
        result = await session.execute(stmt)
        await session.flush()
        return int(result.rowcount or 0)

    async def delete_by_task_short_id(
        self, session: AsyncSession, task_short_id: int
    ) -> int:
        stmt = delete(InAppNotification).where(
            InAppNotification.task_short_id == task_short_id
        )
        result = await session.execute(stmt)
        await session.flush()
        return int(result.rowcount or 0)


class ReminderSettingsRepository:
    async def get_by_member(
        self, session: AsyncSession, member_id: uuid.UUID
    ) -> ReminderSettings | None:
        stmt = select(ReminderSettings).where(ReminderSettings.member_id == member_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_enabled(self, session: AsyncSession) -> list[ReminderSettings]:
        stmt = (
            select(ReminderSettings)
            .options(selectinload(ReminderSettings.member))
            .where(ReminderSettings.is_enabled.is_(True))
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def upsert(
        self, session: AsyncSession, member_id: uuid.UUID, **kwargs
    ) -> ReminderSettings:
        settings = await self.get_by_member(session, member_id)
        if settings:
            for key, value in kwargs.items():
                setattr(settings, key, value)
        else:
            settings = ReminderSettings(member_id=member_id, **kwargs)
            session.add(settings)
        await session.flush()
        return settings


class AppSettingsRepository:
    async def get(self, session: AsyncSession, key: str) -> AppSettings | None:
        return await session.get(AppSettings, key)

    async def set(
        self, session: AsyncSession, key: str, value: dict, updated_by_id: uuid.UUID | None = None
    ) -> AppSettings:
        setting = await self.get(session, key)
        if setting:
            setting.value = value
            setting.updated_by_id = updated_by_id
        else:
            setting = AppSettings(key=key, value=value, updated_by_id=updated_by_id)
            session.add(setting)
        await session.flush()
        return setting


# =============================================
# Content module repositories
# =============================================


class TelegramSessionRepository:
    async def get(self, session: AsyncSession) -> TelegramSession | None:
        return await session.get(TelegramSession, 1)

    async def upsert(self, session: AsyncSession, **kwargs) -> TelegramSession:
        ts = await self.get(session)
        if ts:
            for key, value in kwargs.items():
                setattr(ts, key, value)
        else:
            ts = TelegramSession(id=1, **kwargs)
            session.add(ts)
        await session.flush()
        return ts


class TelegramChannelRepository:
    async def get_all(self, session: AsyncSession) -> list[TelegramChannel]:
        stmt = select(TelegramChannel).order_by(TelegramChannel.display_name)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, session: AsyncSession, channel_id: uuid.UUID) -> TelegramChannel | None:
        return await session.get(TelegramChannel, channel_id)

    async def get_by_username(self, session: AsyncSession, username: str) -> TelegramChannel | None:
        stmt = select(TelegramChannel).where(
            func.lower(TelegramChannel.username) == username.lower()
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, session: AsyncSession, **kwargs) -> TelegramChannel:
        channel = TelegramChannel(**kwargs)
        session.add(channel)
        await session.flush()
        return channel

    async def update(self, session: AsyncSession, channel_id: uuid.UUID, **kwargs) -> TelegramChannel | None:
        channel = await self.get_by_id(session, channel_id)
        if not channel:
            return None
        for key, value in kwargs.items():
            setattr(channel, key, value)
        await session.flush()
        return channel

    async def delete(self, session: AsyncSession, channel_id: uuid.UUID) -> bool:
        stmt = delete(TelegramChannel).where(TelegramChannel.id == channel_id)
        result = await session.execute(stmt)
        return result.rowcount > 0

    async def get_with_content_stats(self, session: AsyncSession) -> list[dict]:
        """Return channels with aggregated content statistics."""
        stmt = (
            select(
                TelegramChannel.id,
                TelegramChannel.username,
                TelegramChannel.display_name,
                TelegramChannel.created_at,
                func.count(TelegramContent.id).label("total_count"),
                func.count(TelegramContent.id).filter(
                    TelegramContent.content_type == "post"
                ).label("post_count"),
                func.count(TelegramContent.id).filter(
                    TelegramContent.content_type == "comment"
                ).label("comment_count"),
                func.min(TelegramContent.message_date).label("earliest_date"),
                func.max(TelegramContent.message_date).label("latest_date"),
            )
            .outerjoin(TelegramContent, TelegramChannel.id == TelegramContent.channel_id)
            .group_by(TelegramChannel.id)
            .order_by(TelegramChannel.display_name)
        )
        result = await session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]


class TelegramContentRepository:
    async def bulk_insert(self, session: AsyncSession, items: list[dict]) -> int:
        """Insert multiple content items, skipping duplicates. Returns count inserted."""
        if not items:
            return 0
        inserted = 0
        for item in items:
            existing = await session.execute(
                select(TelegramContent.id).where(
                    TelegramContent.channel_id == item["channel_id"],
                    TelegramContent.telegram_message_id == item["telegram_message_id"],
                )
            )
            if existing.scalar_one_or_none() is None:
                session.add(TelegramContent(**item))
                inserted += 1
        if inserted:
            await session.flush()
        return inserted

    async def get_existing_message_ids(
        self,
        session: AsyncSession,
        channel_id: uuid.UUID,
        date_from: datetime,
        date_to: datetime,
    ) -> set[int]:
        """Return set of telegram_message_ids already stored for channel+date range."""
        stmt = select(TelegramContent.telegram_message_id).where(
            TelegramContent.channel_id == channel_id,
            TelegramContent.message_date >= date_from,
            TelegramContent.message_date <= date_to,
        )
        result = await session.execute(stmt)
        return {row[0] for row in result.all()}

    async def get_by_channel_and_date_range(
        self,
        session: AsyncSession,
        channel_ids: list[uuid.UUID],
        date_from: datetime,
        date_to: datetime,
        content_type: str | None = None,
    ) -> list[TelegramContent]:
        """Get content for given channels and date range, optionally filtered by type."""
        stmt = (
            select(TelegramContent)
            .where(
                TelegramContent.channel_id.in_(channel_ids),
                TelegramContent.message_date >= date_from,
                TelegramContent.message_date <= date_to,
            )
            .order_by(TelegramContent.message_date)
        )
        if content_type and content_type != "all":
            stmt = stmt.where(TelegramContent.content_type == content_type)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_channel_and_date_range(
        self,
        session: AsyncSession,
        channel_id: uuid.UUID,
        date_from: datetime,
        date_to: datetime,
        content_type: str | None = None,
    ) -> int:
        """Count content items for a channel in date range."""
        stmt = (
            select(func.count())
            .select_from(TelegramContent)
            .where(
                TelegramContent.channel_id == channel_id,
                TelegramContent.message_date >= date_from,
                TelegramContent.message_date <= date_to,
            )
        )
        if content_type and content_type != "all":
            stmt = stmt.where(TelegramContent.content_type == content_type)
        result = await session.execute(stmt)
        return int(result.scalar_one() or 0)

    async def delete_expired(self, session: AsyncSession, retention_days: int = 90) -> int:
        """Delete content older than retention_days (based on loaded_at). Returns count."""
        stmt = delete(TelegramContent).where(
            TelegramContent.loaded_at < func.now() - cast(
                func.concat(str(retention_days), " days"), INTERVAL
            )
        )
        result = await session.execute(stmt)
        await session.flush()
        return int(result.rowcount or 0)


class AnalysisPromptRepository:
    async def get_all(self, session: AsyncSession) -> list[AnalysisPrompt]:
        stmt = (
            select(AnalysisPrompt)
            .options(selectinload(AnalysisPrompt.created_by))
            .order_by(AnalysisPrompt.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, session: AsyncSession, prompt_id: uuid.UUID) -> AnalysisPrompt | None:
        stmt = (
            select(AnalysisPrompt)
            .options(selectinload(AnalysisPrompt.created_by))
            .where(AnalysisPrompt.id == prompt_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, session: AsyncSession, **kwargs) -> AnalysisPrompt:
        prompt = AnalysisPrompt(**kwargs)
        session.add(prompt)
        await session.flush()
        return prompt

    async def update(self, session: AsyncSession, prompt_id: uuid.UUID, **kwargs) -> AnalysisPrompt | None:
        prompt = await self.get_by_id(session, prompt_id)
        if not prompt:
            return None
        for key, value in kwargs.items():
            setattr(prompt, key, value)
        await session.flush()
        return prompt

    async def delete(self, session: AsyncSession, prompt_id: uuid.UUID) -> bool:
        stmt = delete(AnalysisPrompt).where(AnalysisPrompt.id == prompt_id)
        result = await session.execute(stmt)
        return result.rowcount > 0


class AnalysisRunRepository:
    async def create(self, session: AsyncSession, **kwargs) -> AnalysisRun:
        run = AnalysisRun(**kwargs)
        session.add(run)
        await session.flush()
        return run

    async def get_by_id(self, session: AsyncSession, run_id: uuid.UUID) -> AnalysisRun | None:
        stmt = (
            select(AnalysisRun)
            .options(selectinload(AnalysisRun.run_by), selectinload(AnalysisRun.prompt))
            .where(AnalysisRun.id == run_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_status(
        self,
        session: AsyncSession,
        run_id: uuid.UUID,
        status: AnalysisStatus,
        **kwargs,
    ) -> AnalysisRun | None:
        run = await session.get(AnalysisRun, run_id)
        if not run:
            return None
        run.status = status
        for key, value in kwargs.items():
            setattr(run, key, value)
        await session.flush()
        return run

    async def get_history(
        self,
        session: AsyncSession,
        *,
        page: int = 1,
        per_page: int = 20,
    ) -> tuple[list[AnalysisRun], int]:
        """Return paginated history of analysis runs and total count."""
        count_stmt = select(func.count()).select_from(AnalysisRun)
        count_result = await session.execute(count_stmt)
        total = int(count_result.scalar_one() or 0)

        stmt = (
            select(AnalysisRun)
            .options(selectinload(AnalysisRun.run_by), selectinload(AnalysisRun.prompt))
            .order_by(AnalysisRun.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all()), total


class ContentAccessRepository:
    async def get_access_for_member(
        self,
        session: AsyncSession,
        member_id: uuid.UUID,
        department_ids: list[uuid.UUID],
        sub_section: ContentSubSection | None = None,
    ) -> list[ContentAccess]:
        """Get all content access grants matching member directly or via departments."""
        conditions = [
            or_(
                ContentAccess.member_id == member_id,
                ContentAccess.department_id.in_(department_ids) if department_ids else sa.false(),
            )
        ]
        if sub_section:
            conditions.append(ContentAccess.sub_section == sub_section)
        stmt = (
            select(ContentAccess)
            .options(selectinload(ContentAccess.member), selectinload(ContentAccess.department))
            .where(*conditions)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def grant(self, session: AsyncSession, **kwargs) -> ContentAccess:
        access = ContentAccess(**kwargs)
        session.add(access)
        await session.flush()
        return access

    async def revoke(self, session: AsyncSession, access_id: uuid.UUID) -> bool:
        stmt = delete(ContentAccess).where(ContentAccess.id == access_id)
        result = await session.execute(stmt)
        return result.rowcount > 0

    async def get_all(
        self,
        session: AsyncSession,
        sub_section: ContentSubSection | None = None,
    ) -> list[ContentAccess]:
        stmt = (
            select(ContentAccess)
            .options(selectinload(ContentAccess.member), selectinload(ContentAccess.department))
            .order_by(ContentAccess.created_at)
        )
        if sub_section:
            stmt = stmt.where(ContentAccess.sub_section == sub_section)
        result = await session.execute(stmt)
        return list(result.scalars().all())


class AIFeatureConfigRepository:
    async def get_by_feature_key(
        self, session: AsyncSession, feature_key: str
    ) -> AIFeatureConfig | None:
        stmt = select(AIFeatureConfig).where(AIFeatureConfig.feature_key == feature_key)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_default_fallback(
        self, session: AsyncSession, feature_key: str
    ) -> AIFeatureConfig | None:
        """Get config for feature_key; if provider is null, fall back to 'default' row."""
        config = await self.get_by_feature_key(session, feature_key)
        if config and config.provider:
            return config
        return await self.get_by_feature_key(session, "default")

    async def get_all(self, session: AsyncSession) -> list[AIFeatureConfig]:
        stmt = select(AIFeatureConfig).order_by(
            # default first, then alphabetical
            sa.case(
                (AIFeatureConfig.feature_key == "default", 0),
                else_=1,
            ),
            AIFeatureConfig.display_name,
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def upsert(
        self,
        session: AsyncSession,
        feature_key: str,
        **kwargs,
    ) -> AIFeatureConfig:
        config = await self.get_by_feature_key(session, feature_key)
        if config:
            for key, value in kwargs.items():
                setattr(config, key, value)
        else:
            config = AIFeatureConfig(feature_key=feature_key, **kwargs)
            session.add(config)
        await session.flush()
        return config
