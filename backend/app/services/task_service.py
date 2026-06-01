import re
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import ActivityEvent, Task, TaskUpdate, TeamMember
from app.db.repositories import TaskRepository, TaskUpdateRepository, TeamMemberRepository
from app.services.activity_service import ActivityService
from app.services.in_app_notification_service import InAppNotificationService
from app.services.permission_service import PermissionService
from app.services.task_urgency import normalize_task_urgency
from app.services.task_visibility_service import resolve_visible_department_ids

# All valid values for TaskUpdate.update_type
VALID_UPDATE_TYPES: frozenset[str] = frozenset({
    "comment",
    "progress",
    "status_change",
    "blocker",
    "completion",
    "cancellation",
})

# Team-wide cumulative completion milestones (code constant, not settings).
TEAM_TOTAL_THRESHOLDS = (100, 250, 500, 1000, 2000, 5000)

# Russian labels for cancellation reasons shown in the Team Pulse feed.
_CANCEL_REASON_LABELS = {
    "completed": "выполнено",
    "obsolete": "неактуально",
    "duplicate": "дубликат",
    "other": "другое",
    "auto_inactivity": "неактивность",
}


class TaskService:
    def __init__(self):
        self.task_repo = TaskRepository()
        self.update_repo = TaskUpdateRepository()
        self.member_repo = TeamMemberRepository()
        self.in_app_notifications = InAppNotificationService()
        self.activity_service = ActivityService()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _now_utc() -> datetime:
        """Return current UTC datetime (timezone-aware)."""
        return datetime.now(timezone.utc)

    async def _award_team_total_milestones(self, session: AsyncSession, closer: TeamMember, count: int) -> None:
        """Emit a milestone_team(total) for every threshold <= count not yet awarded.

        Idempotent via the milestone_awards ledger; catches up if several
        thresholds are already passed (e.g. first run after backfill).
        """
        for threshold in TEAM_TOTAL_THRESHOLDS:
            if count < threshold:
                break
            if await self.activity_service.claim_milestone(session, f"team_total:{threshold}"):
                await self.activity_service.record(
                    session,
                    event_type="milestone_team",
                    actor=closer,
                    extra={"kind": "total", "count": threshold},
                )

    async def _maybe_award_team_total(self, session: AsyncSession, closer: TeamMember) -> None:
        count = (await session.execute(
            select(func.count())
            .select_from(ActivityEvent)
            .where(ActivityEvent.event_type == "task_completed")
        )).scalar_one()
        await self._award_team_total_milestones(session, closer, count)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def create_task(
        self,
        session: AsyncSession,
        title: str,
        creator: TeamMember,
        assignee_id: uuid.UUID | None = None,
        description: str | None = None,
        checklist: list[dict] | None = None,
        priority: str = "normal",
        deadline: date | None = None,
        reminder_at: datetime | None = None,
        reminder_comment: str | None = None,
        source: str = "text",
        meeting_id: uuid.UUID | None = None,
        label_ids: list[uuid.UUID] | None = None,
    ) -> Task:
        """
        Create a task.
        Active project roles can assign tasks to other participants.
        """
        if assignee_id and assignee_id != creator.id:
            if not PermissionService.can_create_task_for_others(creator):
                raise PermissionError("Нет прав на назначение задачи другому участнику")

        # Default assignee is creator
        if not assignee_id:
            assignee_id = creator.id

        if assignee_id != creator.id:
            assignee = await self.member_repo.get_by_id(session, assignee_id)
            if not assignee or not assignee.is_active:
                raise ValueError("Исполнитель не найден или деактивирован")

        normalized_reminder_comment = (
            reminder_comment.strip() if isinstance(reminder_comment, str) else None
        )
        if normalized_reminder_comment == "":
            normalized_reminder_comment = None
        if reminder_at is None:
            normalized_reminder_comment = None

        task = await self.task_repo.create(
            session,
            title=title,
            description=description,
            checklist=checklist or [],
            priority=normalize_task_urgency(priority),
            assignee_id=assignee_id,
            created_by_id=creator.id,
            source=source,
            deadline=deadline,
            reminder_at=reminder_at,
            reminder_comment=normalized_reminder_comment,
            reminder_sent_at=None,
            meeting_id=meeting_id,
        )
        if label_ids:
            from app.db.repositories import TaskLabelRepository

            task = await TaskLabelRepository().replace_task_labels(
                session,
                task,
                label_ids,
            )
        if task.assignee_id and task.assignee_id != creator.id:
            await self.in_app_notifications.notify_task_assigned(session, task, creator)
        elif task.assignee_id is None:
            await self.in_app_notifications.notify_task_created_unassigned(
                session, task, creator
            )
        return task

    async def get_my_tasks(self, session: AsyncSession, member_id: uuid.UUID) -> list[Task]:
        """Get tasks assigned to this member (excluding done/cancelled)."""
        all_tasks = await self.task_repo.get_by_assignee(session, member_id)
        return [t for t in all_tasks if t.status not in ("done", "cancelled")]

    async def get_all_active_tasks(self, session: AsyncSession) -> list[Task]:
        """Get all active tasks (not done/cancelled)."""
        return await self.task_repo.get_all_active(session)

    async def get_visible_active_tasks(
        self,
        session: AsyncSession,
        member: TeamMember,
    ) -> list[Task]:
        """
        Get active tasks by unified visibility rules (same as Web/API):
        - moderator/admin: company-wide
        - member: own department(s), fallback to own tasks
        """
        visible_department_ids = await resolve_visible_department_ids(session, member)

        if visible_department_ids is None:
            return await self.task_repo.get_all_active(session)

        if visible_department_ids:
            stmt = (
                select(Task)
                .options(
                    selectinload(Task.assignee),
                    selectinload(Task.created_by),
                    selectinload(Task.labels),
                )
                .join(Task.assignee)
                .where(
                    TeamMember.department_id.in_(visible_department_ids),
                    Task.status.notin_(["done", "cancelled"]),
                )
                .order_by(Task.created_at.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

        return await self.get_my_tasks(session, member.id)

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
            completed_at=datetime.utcnow(),
            last_activity_at=self._now_utc(),
            cancellation_reason=None,
            reminder_at=None,
            reminder_comment=None,
            reminder_sent_at=None,
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
        await self.in_app_notifications.notify_task_status_changed(
            session, task, member, old_status, "done"
        )
        # Pulse event is recorded in the same transaction as the task change (atomic by design).
        await self.activity_service.record(
            session, event_type="task_completed", actor=member, task=task
        )
        await self._maybe_award_team_total(session, member)
        return task

    async def update_status(
        self,
        session: AsyncSession,
        task: Task,
        member: TeamMember,
        new_status: str,
    ) -> Task:
        """
        Change task status. Permission check: assignee, author, or moderator.
        Auto-creates TaskUpdate(type=status_change).
        """
        if not PermissionService.can_change_task_status(member, task):
            raise PermissionError("Нет прав на изменение статуса этой задачи")

        valid_statuses = ("new", "in_progress", "review", "done", "cancelled")
        if new_status not in valid_statuses:
            raise ValueError(f"Неизвестный статус. Доступные: {', '.join(valid_statuses)}")

        old_status = task.status

        update_kwargs = {"status": new_status, "last_activity_at": self._now_utc()}
        if new_status == "done":
            update_kwargs["completed_at"] = datetime.utcnow()
        if new_status in ("done", "cancelled"):
            update_kwargs["reminder_at"] = None
            update_kwargs["reminder_comment"] = None
            update_kwargs["reminder_sent_at"] = None
        # Re-opening a cancelled task clears the stale cancellation reason.
        if new_status != "cancelled":
            update_kwargs["cancellation_reason"] = None

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
        await self.in_app_notifications.notify_task_status_changed(
            session, task, member, old_status, new_status
        )
        if old_status != "done" and new_status == "done":
            await self.activity_service.record(
                session, event_type="task_completed", actor=member, task=task
            )
            await self._maybe_award_team_total(session, member)
        return task

    async def cancel_task(
        self,
        session: AsyncSession,
        task: Task,
        member: TeamMember,
        reason: str,
        reason_text: str | None = None,
    ) -> Task:
        """
        Cancel a task with a required reason. Permission: assignee, author, or moderator.
        Auto-creates TaskUpdate(type=cancellation).
        """
        if not PermissionService.can_change_task_status(member, task):
            raise PermissionError("Нет прав на отмену этой задачи")

        # Lazy import to avoid a circular dependency (schemas import models/services).
        from app.db.schemas import CancellationReason

        valid_reasons = {r.value for r in CancellationReason}
        if reason not in valid_reasons:
            raise ValueError(
                f"Неизвестная причина отмены. Доступные: {', '.join(sorted(valid_reasons))}"
            )

        old_status = task.status

        task = await self.task_repo.update(
            session,
            task.id,
            status="cancelled",
            cancellation_reason=reason,
            last_activity_at=self._now_utc(),
            reminder_at=None,
            reminder_comment=None,
            reminder_sent_at=None,
        )

        # Auto task update
        await self.update_repo.create(
            session,
            task_id=task.id,
            author_id=member.id,
            content=reason_text or f"Отменено: {reason}",
            update_type="cancellation",
            old_status=old_status,
            new_status="cancelled",
        )
        await self.in_app_notifications.notify_task_status_changed(
            session, task, member, old_status, "cancelled"
        )
        # Manual cancellation -> Team Pulse event (atomic with the task change).
        # Auto-cancellation goes through _daily_autocancel_job (direct status set),
        # not this method, so it never reaches here.
        await self.activity_service.record(
            session,
            event_type="task_cancelled",
            actor=member,
            task=task,
            extra={"reason": _CANCEL_REASON_LABELS.get(reason, reason)},
        )
        return task

    async def extend_deadline(
        self, session: AsyncSession, task: Task, member: TeamMember, days: int
    ) -> Task:
        """Extend a task's deadline by N days from today. Resets escalation state.

        Permission: assignee, author, or moderator. Clearing escalation_dm_sent_at
        lets the task re-escalate cleanly if it goes overdue again.
        """
        if not PermissionService.can_change_task_status(member, task):
            raise PermissionError("Нет прав на продление этой задачи")

        if days not in {7, 14, 30}:
            raise ValueError("Продлить можно только на 7, 14 или 30 дней")

        new_deadline = date.today() + timedelta(days=days)

        task = await self.task_repo.update(
            session,
            task.id,
            deadline=new_deadline,
            last_activity_at=self._now_utc(),
            escalation_dm_sent_at=None,
        )
        return task

    async def assign_task(
        self,
        session: AsyncSession,
        task: Task,
        member: TeamMember,
        new_assignee_id: uuid.UUID,
    ) -> Task:
        """Reassign task. Allowed for moderator or task author."""
        if not PermissionService.can_assign_task(member, task):
            raise PermissionError("Нет прав на переназначение этой задачи")

        assignee = await self.member_repo.get_by_id(session, new_assignee_id)
        if not assignee or not assignee.is_active:
            raise ValueError("Исполнитель не найден или деактивирован")

        if task.assignee_id == new_assignee_id:
            return task

        task = await self.task_repo.update(
            session,
            task.id,
            assignee_id=new_assignee_id,
            reminder_at=None,
            reminder_comment=None,
            reminder_sent_at=None,
        )
        await self.in_app_notifications.notify_task_assigned(
            session, task, member, assignee
        )
        return task

    async def delete_task(
        self, session: AsyncSession, task: Task, member: TeamMember
    ) -> bool:
        """Delete task. Moderator only."""
        if not PermissionService.can_delete_task(member):
            raise PermissionError("Только модератор может удалять задачи")
        deleted = await self.task_repo.delete(session, task.id)
        if deleted:
            await self.in_app_notifications.delete_task_notifications(
                session, task.short_id
            )
        return deleted

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
        Permission check: assignee, author, or moderator.
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
        # Treat timeline updates as task activity for stale-task tracking.
        task.updated_at = datetime.utcnow()
        task.last_activity_at = self._now_utc()
        await session.flush()
        # Emit at most one pulse event: blocker takes precedence over a progress update.
        if update_type == "blocker":
            await self.in_app_notifications.notify_task_blocker_added(
                session, task, task_update, member
            )
            await self.activity_service.record(
                session,
                event_type="blocker_raised",
                actor=member,
                task=task,
                extra={"blocker_text": content},
            )
        elif progress_percent is not None:
            await self.activity_service.record(
                session,
                event_type="progress_update",
                actor=member,
                task=task,
                extra={"progress_percent": progress_percent},
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
        Parse task text for urgency and deadline markers.
        !urgent and !high -> urgent, !medium and !low -> normal
        @DD.MM or @DD.MM.YYYY -> deadline
        """
        priority = "normal"
        deadline = None

        # Priority markers
        priority_map = {
            "!urgent": "urgent",
            "!high": "urgent",
            "!low": "normal",
            "!medium": "normal",
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
