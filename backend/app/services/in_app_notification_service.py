import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Meeting, Task, TaskUpdate, TeamMember
from app.db.repositories import InAppNotificationRepository, TeamMemberRepository


STATUS_LABELS = {
    "new": "Новая",
    "in_progress": "В работе",
    "review": "На согласовании",
    "done": "Готово",
    "cancelled": "Отменена",
}


class InAppNotificationService:
    def __init__(self):
        self.repo = InAppNotificationRepository()
        self.member_repo = TeamMemberRepository()

    async def notify_task_assigned(
        self,
        session: AsyncSession,
        task: Task,
        assigned_by: TeamMember,
        new_assignee: TeamMember | None = None,
    ) -> None:
        if not task.assignee_id:
            return
        assignee = new_assignee or task.assignee
        if not assignee:
            assignee = await self.member_repo.get_by_id(session, task.assignee_id)
        if not assignee or not assignee.is_active:
            return
        if assignee.id == assigned_by.id:
            return

        task_title = self._task_title(task)
        await self.repo.create(
            session,
            recipient_id=assignee.id,
            actor_id=assigned_by.id,
            event_type="task_assigned",
            title=f"Вам назначили задачу «{task_title}»",
            body=task.title,
            priority="high",
            action_url=f"/tasks/{task.short_id}",
            task_short_id=task.short_id,
        )

    async def notify_task_status_changed(
        self,
        session: AsyncSession,
        task: Task,
        changed_by: TeamMember,
        old_status: str,
        new_status: str,
    ) -> None:
        task_title = self._task_title(task)
        if task.assignee_id and task.assignee_id != changed_by.id:
            assignee = task.assignee or await self.member_repo.get_by_id(
                session, task.assignee_id
            )
            if assignee and assignee.is_active:
                await self.repo.create(
                    session,
                    recipient_id=assignee.id,
                    actor_id=changed_by.id,
                    event_type="task_status_changed_by_other",
                    title=f"Статус задачи «{task_title}» изменён",
                    body=f"{STATUS_LABELS.get(old_status, old_status)} → {STATUS_LABELS.get(new_status, new_status)}",
                    priority="normal",
                    action_url=f"/tasks/{task.short_id}",
                    task_short_id=task.short_id,
                )

        if new_status == "review":
            moderators = await self._get_active_moderators(session)
            for moderator in moderators:
                if moderator.id == changed_by.id:
                    continue
                await self.repo.create(
                    session,
                    recipient_id=moderator.id,
                    actor_id=changed_by.id,
                    event_type="task_review_requested",
                    title=f"Задача «{task_title}» переведена на согласование",
                    body=task.title,
                    priority="high",
                    action_url=f"/tasks/{task.short_id}",
                    task_short_id=task.short_id,
                )

    async def notify_task_blocker_added(
        self,
        session: AsyncSession,
        task: Task,
        task_update: TaskUpdate,
        added_by: TeamMember,
    ) -> None:
        recipients: set[uuid.UUID] = set()

        if task.assignee_id and task.assignee_id != added_by.id:
            recipients.add(task.assignee_id)

        moderators = await self._get_active_moderators(session)
        for moderator in moderators:
            if moderator.id != added_by.id:
                recipients.add(moderator.id)

        if not recipients:
            return

        task_title = self._task_title(task)
        body = self._truncate(task_update.content)
        for recipient_id in recipients:
            await self.repo.create(
                session,
                recipient_id=recipient_id,
                actor_id=added_by.id,
                event_type="task_blocker_added",
                title=f"Блокер в задаче «{task_title}»",
                body=body,
                priority="high",
                action_url=f"/tasks/{task.short_id}",
                task_short_id=task.short_id,
            )

    async def notify_task_created_unassigned(
        self,
        session: AsyncSession,
        task: Task,
        created_by: TeamMember,
    ) -> None:
        if task.assignee_id is not None:
            return

        moderators = await self._get_active_moderators(session)
        task_title = self._task_title(task)
        for moderator in moderators:
            if moderator.id == created_by.id:
                continue
            await self.repo.create(
                session,
                recipient_id=moderator.id,
                actor_id=created_by.id,
                event_type="task_created_unassigned",
                title=f"Задача «{task_title}» без исполнителя",
                body=task.title,
                priority="high",
                action_url=f"/tasks/{task.short_id}",
                task_short_id=task.short_id,
            )

    async def notify_meeting_created(
        self,
        session: AsyncSession,
        meeting: Meeting,
        creator: TeamMember,
        tasks_count: int,
    ) -> None:
        title = meeting.title or "Без названия"
        moderators = await self._get_active_moderators(session)
        for moderator in moderators:
            if moderator.id == creator.id:
                continue
            await self.repo.create(
                session,
                recipient_id=moderator.id,
                actor_id=creator.id,
                event_type="meeting_created",
                title="Встреча обработана",
                body=f"{title} · задач создано: {tasks_count}",
                priority="normal",
                action_url=f"/meetings/{meeting.id}",
                task_short_id=None,
            )

    async def create_deadline_notifications(self, session: AsyncSession) -> None:
        today = date.today()
        tomorrow = today + timedelta(days=1)

        stmt = (
            select(Task)
            .options(selectinload(Task.assignee))
            .where(
                Task.assignee_id.is_not(None),
                Task.deadline.is_not(None),
                Task.status.notin_(["done", "cancelled"]),
                Task.deadline <= tomorrow,
            )
        )
        result = await session.execute(stmt)
        tasks = list(result.scalars().all())

        for task in tasks:
            assignee = task.assignee
            if not assignee or not assignee.is_active or not task.deadline:
                continue
            task_title = self._task_title(task)

            if task.deadline == tomorrow:
                await self.repo.create_if_not_exists(
                    session,
                    recipient_id=assignee.id,
                    dedupe_key=f"task_deadline_tomorrow:{task.id}:{tomorrow.isoformat()}",
                    actor_id=None,
                    event_type="task_deadline_tomorrow",
                    title=f"Дедлайн завтра по задаче «{task_title}»",
                    body=task.title,
                    priority="normal",
                    action_url=f"/tasks/{task.short_id}",
                    task_short_id=task.short_id,
                )
            elif task.deadline == today:
                await self.repo.create_if_not_exists(
                    session,
                    recipient_id=assignee.id,
                    dedupe_key=f"task_deadline_today:{task.id}:{today.isoformat()}",
                    actor_id=None,
                    event_type="task_deadline_today",
                    title=f"Дедлайн сегодня по задаче «{task_title}»",
                    body=task.title,
                    priority="high",
                    action_url=f"/tasks/{task.short_id}",
                    task_short_id=task.short_id,
                )
            elif task.deadline < today:
                await self.repo.create_if_not_exists(
                    session,
                    recipient_id=assignee.id,
                    dedupe_key=f"task_overdue_started:{task.id}",
                    actor_id=None,
                    event_type="task_overdue_started",
                    title=f"Задача «{task_title}» стала просроченной",
                    body=task.title,
                    priority="high",
                    action_url=f"/tasks/{task.short_id}",
                    task_short_id=task.short_id,
                )

    async def delete_task_notifications(
        self, session: AsyncSession, task_short_id: int
    ) -> int:
        return await self.repo.delete_by_task_short_id(session, task_short_id)

    async def _get_active_moderators(self, session: AsyncSession) -> list[TeamMember]:
        members = await self.member_repo.get_all_active(session)
        return [m for m in members if m.role in ("admin", "moderator")]

    @staticmethod
    def _truncate(text: str | None, max_len: int = 220) -> str | None:
        if not text:
            return None
        cleaned = " ".join(text.strip().split())
        if len(cleaned) <= max_len:
            return cleaned
        return cleaned[: max_len - 1] + "…"

    def _task_title(self, task: Task, max_len: int = 110) -> str:
        raw = (task.title or "Без названия").strip()
        return self._truncate(raw, max_len=max_len) or "Без названия"
