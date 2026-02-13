import math
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth import get_current_user, require_moderator
from app.db.database import get_session
from app.db.models import Task, TaskUpdate, TeamMember
from app.db.schemas import TaskCreate, TaskEdit, TaskResponse
from app.services.permission_service import PermissionService
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])
task_service = TaskService()


class PaginatedTasksResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    page: int
    per_page: int
    pages: int


@router.get("", response_model=PaginatedTasksResponse)
async def list_tasks(
    assignee_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = Query(None),
    meeting_id: uuid.UUID | None = Query(None),
    source: str | None = Query(None),
    search: str | None = Query(None),
    has_overdue: bool | None = Query(None),
    sort: str = Query("created_at_desc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List tasks with filters, pagination, and sorting."""
    base_stmt = select(Task)

    # Filters
    if assignee_id:
        base_stmt = base_stmt.where(Task.assignee_id == assignee_id)
    if status_filter:
        statuses = [s.strip() for s in status_filter.split(",")]
        base_stmt = base_stmt.where(Task.status.in_(statuses))
    if priority:
        base_stmt = base_stmt.where(Task.priority == priority)
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

    # Total count (before pagination)
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = (await session.execute(count_stmt)).scalar_one()

    # Sorting
    sort_map = {
        "created_at_desc": Task.created_at.desc(),
        "created_at_asc": Task.created_at.asc(),
        "deadline_asc": Task.deadline.asc().nullslast(),
        "deadline_desc": Task.deadline.desc().nullsfirst(),
        "priority_desc": Task.priority.desc(),
        "short_id_desc": Task.short_id.desc(),
        "short_id_asc": Task.short_id.asc(),
    }
    order = sort_map.get(sort, Task.created_at.desc())

    items_stmt = (
        base_stmt
        .options(selectinload(Task.assignee), selectinload(Task.created_by))
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
    return task


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new task. If assignee != self, requires moderator role."""
    try:
        task = await task_service.create_task(
            session,
            title=data.title,
            creator=member,
            assignee_id=data.assignee_id,
            description=data.description,
            priority=data.priority,
            deadline=data.deadline,
            source=data.source or "web",
            meeting_id=data.meeting_id,
        )
        await session.commit()
        return task
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.patch("/{short_id}", response_model=TaskResponse)
async def update_task(
    short_id: int,
    data: TaskEdit,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update task fields. Permission check: assignee or moderator."""
    task = await task_service.get_task_by_short_id(session, short_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    # Permission: moderator can edit any, member can edit own
    if not PermissionService.is_moderator(member) and task.assignee_id != member.id:
        raise HTTPException(status_code=403, detail="Нет прав на редактирование этой задачи")

    try:
        # Handle status change separately (creates TaskUpdate)
        if data.status and data.status != task.status:
            task = await task_service.update_status(
                session, task, member, data.status
            )

        # Handle other field updates
        update_fields = data.model_dump(exclude_unset=True, exclude={"status"})
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
