import re
import uuid
from datetime import date, datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Task, TaskUpdate, TeamMember
from app.db.repositories import TaskRepository, TaskUpdateRepository, TeamMemberRepository
from app.services.permission_service import PermissionService


class TaskService:
    def __init__(self):
        self.task_repo = TaskRepository()
        self.update_repo = TaskUpdateRepository()
        self.member_repo = TeamMemberRepository()

    async def create_task(
        self,
        session: AsyncSession,
        title: str,
        creator: TeamMember,
        assignee_id: uuid.UUID | None = None,
        description: str | None = None,
        priority: str = "medium",
        deadline: date | None = None,
        source: str = "text",
        meeting_id: uuid.UUID | None = None,
    ) -> Task:
        """
        Create a task.
        Member can only create for self. Moderator can assign to others.
        """
        if assignee_id and assignee_id != creator.id:
            if not PermissionService.can_create_task_for_others(creator):
                raise PermissionError("Только модератор может назначать задачи другим")

        # Default assignee is creator
        if not assignee_id:
            assignee_id = creator.id

        task = await self.task_repo.create(
            session,
            title=title,
            description=description,
            priority=priority,
            assignee_id=assignee_id,
            created_by_id=creator.id,
            source=source,
            deadline=deadline,
            meeting_id=meeting_id,
        )
        return task

    async def get_my_tasks(self, session: AsyncSession, member_id: uuid.UUID) -> list[Task]:
        """Get tasks assigned to this member (excluding done/cancelled)."""
        all_tasks = await self.task_repo.get_by_assignee(session, member_id)
        return [t for t in all_tasks if t.status not in ("done", "cancelled")]

    async def get_all_active_tasks(self, session: AsyncSession) -> list[Task]:
        """Get all active tasks (not done/cancelled)."""
        return await self.task_repo.get_all_active(session)

    async def get_task_by_short_id(self, session: AsyncSession, short_id: int) -> Task | None:
        return await self.task_repo.get_by_short_id(session, short_id)

    async def complete_task(
        self, session: AsyncSession, task: Task, member: TeamMember
    ) -> Task:
        """
        Complete a task. Member — only own, moderator — any.
        Auto-creates TaskUpdate(type=completion).
        """
        if not PermissionService.can_change_task_status(member, task):
            raise PermissionError("Нет прав на завершение этой задачи")

        old_status = task.status
        task = await self.task_repo.update(
            session,
            task.id,
            status="done",
            completed_at=datetime.now(timezone.utc),
        )

        # Auto task update
        await self.update_repo.create(
            session,
            task_id=task.id,
            author_id=member.id,
            content="Задача завершена",
            update_type="completion",
            old_status=old_status,
            new_status="done",
        )
        return task

    async def update_status(
        self,
        session: AsyncSession,
        task: Task,
        member: TeamMember,
        new_status: str,
    ) -> Task:
        """
        Change task status. Permission check: assignee or moderator.
        Auto-creates TaskUpdate(type=status_change).
        """
        if not PermissionService.can_change_task_status(member, task):
            raise PermissionError("Нет прав на изменение статуса этой задачи")

        valid_statuses = ("new", "in_progress", "review", "done", "cancelled")
        if new_status not in valid_statuses:
            raise ValueError(f"Неизвестный статус. Доступные: {', '.join(valid_statuses)}")

        old_status = task.status

        update_kwargs = {"status": new_status}
        if new_status == "done":
            update_kwargs["completed_at"] = datetime.now(timezone.utc)

        task = await self.task_repo.update(session, task.id, **update_kwargs)

        # Auto task update
        await self.update_repo.create(
            session,
            task_id=task.id,
            author_id=member.id,
            content=f"Статус: {old_status} → {new_status}",
            update_type="status_change",
            old_status=old_status,
            new_status=new_status,
        )
        return task

    async def assign_task(
        self,
        session: AsyncSession,
        task: Task,
        member: TeamMember,
        new_assignee_id: uuid.UUID,
    ) -> Task:
        """Reassign task. Moderator only."""
        if not PermissionService.can_assign_task(member):
            raise PermissionError("Только модератор может переназначать задачи")

        task = await self.task_repo.update(session, task.id, assignee_id=new_assignee_id)
        return task

    async def delete_task(
        self, session: AsyncSession, task: Task, member: TeamMember
    ) -> bool:
        """Delete task. Moderator only."""
        if not PermissionService.can_delete_task(member):
            raise PermissionError("Только модератор может удалять задачи")
        return await self.task_repo.delete(session, task.id)

    async def add_task_update(
        self,
        session: AsyncSession,
        task: Task,
        member: TeamMember,
        content: str,
        update_type: str = "progress",
        progress_percent: int | None = None,
        source: str = "telegram",
    ) -> TaskUpdate:
        """
        Add a task update (progress, blocker, comment).
        Permission check: assignee or moderator.
        """
        if not PermissionService.can_add_task_update(member, task):
            raise PermissionError("Нет прав на добавление обновления к этой задаче")

        if progress_percent is not None:
            if not 0 <= progress_percent <= 100:
                raise ValueError("Прогресс должен быть от 0 до 100%")

        task_update = await self.update_repo.create(
            session,
            task_id=task.id,
            author_id=member.id,
            content=content,
            update_type=update_type,
            progress_percent=progress_percent,
            source=source,
        )
        return task_update

    async def get_task_updates(
        self, session: AsyncSession, task_id: uuid.UUID
    ) -> list[TaskUpdate]:
        """Get all updates for a task, ordered by created_at desc."""
        return await self.update_repo.get_by_task(session, task_id)

    @staticmethod
    def parse_task_text(text: str) -> dict:
        """
        Parse task text for priority and deadline markers.
        !urgent, !high, !low -> priority
        @DD.MM or @DD.MM.YYYY -> deadline
        """
        priority = "medium"
        deadline = None

        # Priority markers
        priority_map = {
            "!urgent": "urgent",
            "!high": "high",
            "!low": "low",
            "!medium": "medium",
        }
        for marker, prio in priority_map.items():
            if marker in text.lower():
                priority = prio
                text = re.sub(re.escape(marker), "", text, flags=re.IGNORECASE).strip()
                break

        # Deadline: @DD.MM or @DD.MM.YYYY
        deadline_match = re.search(r"@(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?", text)
        if deadline_match:
            day = int(deadline_match.group(1))
            month = int(deadline_match.group(2))
            year_str = deadline_match.group(3)
            if year_str:
                year = int(year_str)
                if year < 100:
                    year += 2000
            else:
                year = date.today().year
                # If the date is in the past, use next year
                try:
                    candidate = date(year, month, day)
                    if candidate < date.today():
                        year += 1
                except ValueError:
                    pass

            try:
                deadline = date(year, month, day)
            except ValueError:
                pass  # Invalid date, ignore

            text = text[:deadline_match.start()] + text[deadline_match.end():]
            text = text.strip()

        title = text.strip()
        return {"title": title, "priority": priority, "deadline": deadline}
