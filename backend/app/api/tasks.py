import math
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth import get_current_user, require_moderator
from app.db.database import get_session
from app.db.models import Task, TaskLabel, TeamMember
from app.db.repositories import TaskLabelRepository
from app.db.schemas import (
    BulkCancelRequest,
    BulkCompleteRequest,
    BulkExtendRequest,
    BulkResult,
    CancelTaskRequest,
    TaskCreate,
    TaskEdit,
    TaskResponse,
)
from app.services.in_app_notification_service import InAppNotificationService
from app.services.notification_service import NotificationService
from app.services.permission_service import PermissionService
from app.services.task_urgency import normalize_task_urgency
from app.services.task_service import TaskService
from app.services.task_visibility_service import (
    can_access_task,
    resolve_visible_department_ids,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])
task_service = TaskService()
label_repo = TaskLabelRepository()
in_app_notification_service = InAppNotificationService()


class PaginatedTasksResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    page: int
    per_page: int
    pages: int


def _to_utc_naive(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _normalize_reminder_comment(raw_value: str | None) -> str | None:
    if raw_value is None:
        return None
    normalized = raw_value.strip()
    return normalized or None


def _prepare_task_reminder_update(
    *,
    task: Task,
    data: TaskEdit,
    member: TeamMember,
) -> dict:
    payload = data.model_dump(exclude_unset=True)
    has_reminder_at = "reminder_at" in payload
    has_reminder_comment = "reminder_comment" in payload
    if not has_reminder_at and not has_reminder_comment:
        return {}

    if not PermissionService.can_manage_task_reminder(member, task):
        raise HTTPException(
            status_code=403,
            detail="Нет прав на настройку напоминания по этой задаче",
        )

    updates: dict = {}

    if has_reminder_at:
        reminder_at = payload.get("reminder_at")
        if reminder_at is None:
            updates["reminder_at"] = None
            updates["reminder_comment"] = None
            updates["reminder_sent_at"] = None
            return updates

        if task.assignee_id is None:
            raise HTTPException(
                status_code=400,
                detail="Нельзя установить напоминание для задачи без исполнителя",
            )

        reminder_at_utc = _to_utc_naive(reminder_at)
        if reminder_at_utc <= datetime.utcnow() + timedelta(seconds=30):
            raise HTTPException(
                status_code=400,
                detail="Время напоминания должно быть в будущем",
            )
        updates["reminder_at"] = reminder_at_utc
        updates["reminder_sent_at"] = None

        if has_reminder_comment:
            updates["reminder_comment"] = _normalize_reminder_comment(
                payload.get("reminder_comment")
            )
        return updates

    if task.assignee_id is None:
        raise HTTPException(
            status_code=400,
            detail="Нельзя установить напоминание для задачи без исполнителя",
        )
    if task.reminder_at is None:
        raise HTTPException(
            status_code=400,
            detail="Сначала установите дату и время напоминания",
        )
    updates["reminder_comment"] = _normalize_reminder_comment(
        payload.get("reminder_comment")
    )
    return updates


def _parse_label_ids_filter(raw_value: str | None) -> list[uuid.UUID]:
    if not raw_value:
        return []
    parsed: list[uuid.UUID] = []
    for raw_part in raw_value.split(","):
        value = raw_part.strip()
        if not value:
            continue
        parsed.append(uuid.UUID(value))
    return parsed


def _apply_label_filter(stmt, label_ids: list[uuid.UUID]):
    if not label_ids:
        return stmt
    return stmt.join(Task.labels).where(TaskLabel.id.in_(label_ids)).distinct()


@router.get("", response_model=PaginatedTasksResponse)
async def list_tasks(
    assignee_id: uuid.UUID | None = Query(None),
    created_by_id: uuid.UUID | None = Query(None),
    department_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = Query(None),
    meeting_id: uuid.UUID | None = Query(None),
    source: str | None = Query(None),
    search: str | None = Query(None),
    label_ids: str | None = Query(None),
    has_overdue: bool | None = Query(None),
    has_close_candidate: bool | None = Query(None),
    completed_since: datetime | None = Query(None),
    sort: str = Query("created_at_desc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List tasks with filters, pagination, and sorting."""
    base_stmt = select(Task)

    visible_department_ids = await resolve_visible_department_ids(session, member)

    # Department visibility scope
    if department_id is not None:
        if (
            visible_department_ids is not None
            and department_id not in visible_department_ids
        ):
            raise HTTPException(
                status_code=403,
                detail="Нет доступа к задачам выбранного отдела",
            )
        base_stmt = base_stmt.join(Task.assignee).where(
            TeamMember.department_id == department_id
        )
    elif visible_department_ids is not None:
        if visible_department_ids:
            base_stmt = base_stmt.join(Task.assignee).where(
                TeamMember.department_id.in_(visible_department_ids)
            )
        else:
            base_stmt = base_stmt.where(Task.assignee_id == member.id)

    # Filters
    if assignee_id:
        base_stmt = base_stmt.where(Task.assignee_id == assignee_id)
    if created_by_id:
        base_stmt = base_stmt.where(Task.created_by_id == created_by_id)
    if status_filter:
        statuses = [s.strip() for s in status_filter.split(",")]
        base_stmt = base_stmt.where(Task.status.in_(statuses))
    if priority:
        base_stmt = base_stmt.where(Task.priority == normalize_task_urgency(priority))
    if meeting_id:
        base_stmt = base_stmt.where(Task.meeting_id == meeting_id)
    if source:
        base_stmt = base_stmt.where(Task.source == source)
    if search:
        base_stmt = base_stmt.where(
            Task.title.ilike(f"%{search}%") | Task.description.ilike(f"%{search}%")
        )
    if has_overdue:
        base_stmt = base_stmt.where(Task.deadline < date.today(), Task.status.notin_(["done", "cancelled"]))
    if has_close_candidate:
        # Overdue by >= 14 days (inclusive), matching the frontend candidate view.
        threshold = date.today() - timedelta(days=14)
        base_stmt = base_stmt.where(Task.deadline <= threshold, Task.status.notin_(["done", "cancelled"]))
    if completed_since:
        base_stmt = base_stmt.where(Task.completed_at >= _to_utc_naive(completed_since))
    try:
        parsed_label_ids = _parse_label_ids_filter(label_ids)
    except ValueError:
        raise HTTPException(status_code=400, detail="Некорректный идентификатор метки")
    base_stmt = _apply_label_filter(base_stmt, parsed_label_ids)

    # Total count (before pagination)
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = (await session.execute(count_stmt)).scalar_one()

    # Sorting
    sort_map = {
        "created_at_desc": Task.created_at.desc(),
        "created_at_asc": Task.created_at.asc(),
        "deadline_asc": Task.deadline.asc().nullslast(),
        "deadline_desc": Task.deadline.desc().nullsfirst(),
        "priority_desc": case((Task.priority == "urgent", 1), else_=0).desc(),
        "completed_at_desc": Task.completed_at.desc().nullslast(),
        "completed_at_asc": Task.completed_at.asc().nullslast(),
        "short_id_desc": Task.short_id.desc(),
        "short_id_asc": Task.short_id.asc(),
    }
    order = sort_map.get(sort, Task.created_at.desc())

    items_stmt = (
        base_stmt
        .options(
            selectinload(Task.assignee),
            selectinload(Task.created_by),
            selectinload(Task.labels),
        )
        .order_by(order)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )

    result = await session.execute(items_stmt)
    tasks = list(result.scalars().all())

    return PaginatedTasksResponse(
        items=tasks,
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


async def _bulk_fetch_accessible_task(
    session: AsyncSession, member: TeamMember, short_id: int
) -> Task:
    """Fetch a task by short_id, enforcing per-user visibility.

    Raises ValueError (mapped to a `failed` entry by the caller) when the task
    is missing or out of the member's visibility scope.
    """
    task = await task_service.get_task_by_short_id(session, short_id)
    if not task:
        raise ValueError("Задача не найдена")
    if not await can_access_task(session, member, task):
        raise ValueError("Нет доступа к задаче")
    return task


@router.post("/bulk/cancel", response_model=BulkResult)
async def bulk_cancel(
    payload: BulkCancelRequest,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Cancel multiple tasks. Each task is processed independently; per-task
    permission and access failures are reported in `failed` (partial success)."""
    succeeded = 0
    failed: list[dict] = []
    for short_id in payload.task_short_ids:
        try:
            task = await _bulk_fetch_accessible_task(session, member, short_id)
            await task_service.cancel_task(
                session, task, member, payload.reason.value, payload.reason_text
            )
            succeeded += 1
        except (PermissionError, ValueError) as e:
            failed.append({"short_id": short_id, "error": str(e)})
    await session.commit()
    return BulkResult(succeeded=succeeded, failed=failed)


@router.post("/bulk/complete", response_model=BulkResult)
async def bulk_complete(
    payload: BulkCompleteRequest,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Complete multiple tasks (partial success per task)."""
    succeeded = 0
    failed: list[dict] = []
    for short_id in payload.task_short_ids:
        try:
            task = await _bulk_fetch_accessible_task(session, member, short_id)
            await task_service.complete_task(session, task, member)
            succeeded += 1
        except (PermissionError, ValueError) as e:
            failed.append({"short_id": short_id, "error": str(e)})
    await session.commit()
    return BulkResult(succeeded=succeeded, failed=failed)


@router.post("/bulk/extend", response_model=BulkResult)
async def bulk_extend(
    payload: BulkExtendRequest,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Extend deadlines for multiple tasks by N days (partial success per task)."""
    succeeded = 0
    failed: list[dict] = []
    for short_id in payload.task_short_ids:
        try:
            task = await _bulk_fetch_accessible_task(session, member, short_id)
            await task_service.extend_deadline(session, task, member, payload.days)
            succeeded += 1
        except (PermissionError, ValueError) as e:
            failed.append({"short_id": short_id, "error": str(e)})
    await session.commit()
    return BulkResult(succeeded=succeeded, failed=failed)


@router.get("/{short_id}", response_model=TaskResponse)
async def get_task(
    short_id: int,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get task details by short_id."""
    task = await task_service.get_task_by_short_id(session, short_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    if not await can_access_task(session, member, task):
        raise HTTPException(
            status_code=403,
            detail="Нет доступа к задаче: она вне вашей зоны видимости",
        )
    return task


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    request: Request,
    data: TaskCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new task."""
    try:
        task = await task_service.create_task(
            session,
            title=data.title,
            creator=member,
            assignee_id=data.assignee_id,
            description=data.description,
            checklist=[item.model_dump() for item in data.checklist],
            priority=data.priority,
            deadline=data.deadline,
            source=data.source or "web",
            meeting_id=data.meeting_id,
            label_ids=data.label_ids,
        )
        bot = getattr(request.app.state, "bot", None)
        if bot:
            notification_service = NotificationService(bot)
            await notification_service.notify_task_created(session, task, member)
        await session.commit()
        return task
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{short_id}", response_model=TaskResponse)
async def update_task(
    request: Request,
    short_id: int,
    data: TaskEdit,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update task fields. Permission check: assignee, author, or moderator."""
    task = await task_service.get_task_by_short_id(session, short_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    if not await can_access_task(session, member, task):
        raise HTTPException(
            status_code=403,
            detail="Нет доступа к задаче: она вне вашей зоны видимости",
        )

    # Permission: moderator can edit any, member can edit if assignee or author.
    is_moderator = PermissionService.is_moderator(member)
    is_author = task.created_by_id == member.id
    if not PermissionService.can_edit_task(member, task):
        raise HTTPException(status_code=403, detail="Нет прав на редактирование этой задачи")

    # Members can edit only selected fields (same matrix as web and bot).
    if not is_moderator:
        provided_fields = set(data.model_dump(exclude_unset=True).keys())
        allowed_fields = PermissionService.allowed_task_edit_fields(member, task)
        forbidden = provided_fields - allowed_fields
        if forbidden:
            raise HTTPException(
                status_code=403,
                detail=f"Нет прав на изменение полей: {', '.join(sorted(forbidden))}",
            )

    try:
        # Handle status change separately (creates TaskUpdate)
        if data.status and data.status != task.status:
            if data.status == "cancelled":
                raise HTTPException(
                    status_code=400,
                    detail="Для отмены задачи используйте endpoint /cancel с указанием причины",
                )
            task = await task_service.update_status(
                session, task, member, data.status
            )

        reminder_update_fields = _prepare_task_reminder_update(
            task=task,
            data=data,
            member=member,
        )

        # Handle other field updates
        update_fields = data.model_dump(
            exclude_unset=True,
            exclude={"status", "reminder_at", "reminder_comment", "label_ids"},
        )
        update_fields.update(reminder_update_fields)
        if "title" in update_fields:
            new_title = (update_fields.get("title") or "").strip()
            if not new_title:
                raise HTTPException(
                    status_code=400,
                    detail="Название задачи не может быть пустым",
                )
            update_fields["title"] = new_title

        assignee_present = "assignee_id" in update_fields
        new_assignee_id = update_fields.pop("assignee_id", None) if assignee_present else None

        payload = data.model_dump(exclude_unset=True)
        if "label_ids" in payload:
            task = await label_repo.replace_task_labels(
                session,
                task,
                data.label_ids or [],
            )

        if assignee_present:
            if new_assignee_id is None:
                if not (is_moderator or is_author):
                    raise HTTPException(status_code=403, detail="Нет прав на снятие исполнителя")
                old_assignee_id = task.assignee_id
                from app.db.repositories import TaskRepository
                task_repo = TaskRepository()
                task = await task_repo.update(
                    session,
                    task.id,
                    assignee_id=None,
                    reminder_at=None,
                    reminder_comment=None,
                    reminder_sent_at=None,
                )
                if old_assignee_id is not None:
                    await in_app_notification_service.notify_task_created_unassigned(
                        session, task, member
                    )
            else:
                old_assignee_id = task.assignee_id
                task = await task_service.assign_task(
                    session, task, member, new_assignee_id
                )
                if old_assignee_id != new_assignee_id:
                    bot = getattr(request.app.state, "bot", None)
                    if bot and task.assignee:
                        notification_service = NotificationService(bot)
                        await notification_service.notify_task_assigned(
                            session, task, member, task.assignee
                        )

        if update_fields:
            from app.db.repositories import TaskRepository
            task_repo = TaskRepository()
            task = await task_repo.update(session, task.id, **update_fields)

        await session.commit()
        return task
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{short_id}/cancel", response_model=TaskResponse)
async def cancel_task_endpoint(
    short_id: int,
    data: CancelTaskRequest,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Cancel a task with a required reason. Access check: same as edit."""
    task = await task_service.get_task_by_short_id(session, short_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    if not await can_access_task(session, member, task):
        raise HTTPException(
            status_code=403,
            detail="Нет доступа к задаче: она вне вашей зоны видимости",
        )

    try:
        task = await task_service.cancel_task(
            session,
            task,
            member,
            data.reason.value,
            data.reason_text,
        )
        await session.commit()
        return task
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{short_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    short_id: int,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Delete a task. Moderator only."""
    task = await task_service.get_task_by_short_id(session, short_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    await task_service.delete_task(session, task, member)
    await session.commit()
