import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Meeting, MeetingBoardSettings, Task, TeamMember
from app.db.repositories import MeetingBoardRepository
from app.services.task_visibility_service import (
    can_access_task,
    resolve_visible_department_ids,
)


@dataclass
class BoardTaskGroups:
    urgent: list[Task] = field(default_factory=list)
    in_progress: list[Task] = field(default_factory=list)
    review: list[Task] = field(default_factory=list)
    done_this_week: list[Task] = field(default_factory=list)


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def group_board_tasks(
    tasks: list[Task],
    *,
    today: date | None = None,
    now: datetime | None = None,
) -> BoardTaskGroups:
    now = _to_utc_naive(now or datetime.now(timezone.utc))
    done_cutoff = now - timedelta(days=7)
    groups = BoardTaskGroups()
    seen: set[uuid.UUID] = set()

    for task in sorted(tasks, key=lambda item: getattr(item, "short_id", 0)):
        if task.id in seen:
            continue
        seen.add(task.id)
        if task.status == "done":
            completed_at = getattr(task, "completed_at", None)
            if completed_at and _to_utc_naive(completed_at) >= done_cutoff:
                groups.done_this_week.append(task)
            continue
        if task.priority == "urgent":
            groups.urgent.append(task)
            continue
        if task.status == "in_progress":
            groups.in_progress.append(task)
            continue
        if task.status == "review":
            groups.review.append(task)
    return groups


class MeetingBoardService:
    def __init__(self) -> None:
        self.board_repo = MeetingBoardRepository()

    async def get_board(
        self, session: AsyncSession, meeting: Meeting, viewer: TeamMember
    ) -> tuple[MeetingBoardSettings, BoardTaskGroups]:
        settings = await self.board_repo.get_or_create(session, meeting.id, viewer)
        tasks = await self._load_visible_tasks(session, meeting, settings, viewer)
        groups = group_board_tasks(tasks)
        return settings, groups

    async def _load_visible_tasks(
        self, session: AsyncSession, meeting: Meeting, settings, viewer: TeamMember
    ) -> list[Task]:
        participant_ids = [
            participant.member_id for participant in (meeting.participants or [])
        ]
        member_ids = list(
            dict.fromkeys([*participant_ids, *(settings.added_member_ids or [])])
        )
        department_ids = list(settings.added_department_ids or [])
        pinned_ids = list(settings.pinned_task_ids or [])

        visible_department_ids = await resolve_visible_department_ids(session, viewer)

        stmt = select(Task).options(
            selectinload(Task.assignee),
            selectinload(Task.created_by),
            selectinload(Task.labels),
        )

        filters = []
        if member_ids:
            filters.append(Task.assignee_id.in_(member_ids))
        if department_ids:
            filters.append(Task.assignee.has(TeamMember.department_id.in_(department_ids)))
        if pinned_ids:
            filters.append(Task.id.in_(pinned_ids))
        if not filters:
            return []
        stmt = stmt.where(or_(*filters))

        if visible_department_ids is not None:
            if visible_department_ids:
                stmt = stmt.where(
                    Task.assignee.has(
                        TeamMember.department_id.in_(visible_department_ids)
                    )
                )
            else:
                stmt = stmt.where(Task.assignee_id == viewer.id)

        result = await session.execute(stmt)
        tasks = list(result.scalars().unique().all())
        visible_tasks = []
        for task in tasks:
            if await can_access_task(session, viewer, task):
                visible_tasks.append(task)
        return visible_tasks
