import logging
import uuid

from sqlalchemy import select, update, delete, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

from app.db.models import (
    AppSettings,
    Meeting,
    MeetingParticipant,
    NotificationSubscription,
    ReminderSettings,
    Task,
    TaskUpdate,
    TeamMember,
)


class TeamMemberRepository:
    async def get_by_id(self, session: AsyncSession, member_id: uuid.UUID) -> TeamMember | None:
        return await session.get(TeamMember, member_id)

    async def get_by_telegram_id(self, session: AsyncSession, telegram_id: int) -> TeamMember | None:
        stmt = select(TeamMember).where(TeamMember.telegram_id == telegram_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_active(self, session: AsyncSession) -> list[TeamMember]:
        stmt = select(TeamMember).where(TeamMember.is_active.is_(True)).order_by(TeamMember.full_name)
        result = await session.execute(stmt)
        return list(result.scalars().all())

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

    async def delete(self, session: AsyncSession, meeting_id: uuid.UUID) -> bool:
        stmt = delete(Meeting).where(Meeting.id == meeting_id)
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
