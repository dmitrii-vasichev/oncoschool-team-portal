from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.schemas import TaskUpdateCreate, TaskUpdateResponse
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks/{short_id}/updates", tags=["task_updates"])
task_service = TaskService()


@router.get("", response_model=list[TaskUpdateResponse])
async def list_task_updates(
    short_id: int,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get timeline of updates for a task."""
    task = await task_service.get_task_by_short_id(session, short_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    updates = await task_service.get_task_updates(session, task.id)
    return updates


@router.post("", response_model=TaskUpdateResponse, status_code=status.HTTP_201_CREATED)
async def create_task_update(
    short_id: int,
    data: TaskUpdateCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Add a task update. Allowed for assignee or moderator."""
    task = await task_service.get_task_by_short_id(session, short_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    try:
        async with session.begin():
            update = await task_service.add_task_update(
                session,
                task=task,
                member=member,
                content=data.content,
                update_type=data.update_type,
                progress_percent=data.progress_percent,
                source="web",
            )
            return update
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
