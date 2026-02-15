import logging
import uuid

from sqlalchemy import select, update, delete, func, or_, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

from datetime import datetime

from app.db.models import (
    AppSettings,
    Department,
    Meeting,
    MeetingParticipant,
    MeetingSchedule,
    NotificationSubscription,
    ReminderSettings,
    Task,
    TaskUpdate,
    TeamMember,
    TelegramNotificationTarget,
)


class TeamMemberRepository:
    async def get_by_id(self, session: AsyncSession, member_id: uuid.UUID) -> TeamMember | None:
        return await session.get(TeamMember, member_id)

    async def get_by_telegram_id(self, session: AsyncSession, telegram_id: int) -> TeamMember | None:
        stmt = select(TeamMember).where(TeamMember.telegram_id == telegram_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_active(self, session: AsyncSession) -> list[TeamMember]:
        stmt = (
            select(TeamMember)
            .options(selectinload(TeamMember.department))
            .where(TeamMember.is_active.is_(True))
            .order_by(TeamMember.full_name)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_telegram_username(self, session: AsyncSession, username: str) -> TeamMember | None:
        stmt = select(TeamMember).where(
            func.lower(TeamMember.telegram_username) == username.lower()
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
            .options(selectinload(Meeting.participants))
            .where(Meeting.id == meeting_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, session: AsyncSession) -> list[Meeting]:
        stmt = select(Meeting).order_by(Meeting.created_at.desc())
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
            .options(selectinload(Meeting.participants))
            .where(Meeting.zoom_meeting_id == zoom_meeting_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_upcoming(self, session: AsyncSession, limit: int = 10) -> list[Meeting]:
        # Keep UTC timestamp naive to match DB columns stored without tz info.
        now_utc_naive = datetime.utcnow()
        stmt = (
            select(Meeting)
            .where(
                Meeting.status == "scheduled",
                Meeting.meeting_date.is_not(None),
                Meeting.meeting_date > now_utc_naive,
            )
            .order_by(Meeting.meeting_date.asc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_past(self, session: AsyncSession, limit: int = 20) -> list[Meeting]:
        now_utc_naive = datetime.utcnow()
        stmt = (
            select(Meeting)
            .where(
                or_(
                    Meeting.status.in_(["completed", "cancelled"]),
                    and_(
                        Meeting.status == "scheduled",
                        Meeting.meeting_date.is_not(None),
                        Meeting.meeting_date <= now_utc_naive,
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
            .where(
                NotificationSubscription.event_type == event_type,
                NotificationSubscription.is_active.is_(True),
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
