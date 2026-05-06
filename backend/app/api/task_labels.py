from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.repositories import TaskLabelRepository
from app.db.schemas import TaskLabelCreate, TaskLabelResponse
from app.services.task_visibility_service import resolve_visible_department_ids

router = APIRouter(prefix="/task-labels", tags=["task-labels"])
label_repo = TaskLabelRepository()


def _label_response(label, usage_count: int = 0) -> TaskLabelResponse:
    return TaskLabelResponse.model_validate(label).model_copy(
        update={"usage_count": usage_count}
    )


@router.get("", response_model=list[TaskLabelResponse])
async def list_task_labels(
    search: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    include_archived: bool = Query(False),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    normalized_search = search.strip() if search is not None else None
    if normalized_search == "":
        normalized_search = None
    visible_department_ids = await resolve_visible_department_ids(session, member)
    labels = await label_repo.search(
        session,
        search=normalized_search,
        include_archived=include_archived,
        limit=limit,
        visible_department_ids=visible_department_ids,
        fallback_member_id=member.id,
    )
    return [_label_response(label, usage_count) for label, usage_count in labels]


@router.post("", response_model=TaskLabelResponse, status_code=201)
async def create_task_label(
    data: TaskLabelCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    try:
        label = await label_repo.create_or_reactivate(
            session,
            name=data.name,
            created_by_id=member.id,
        )
        await session.commit()
        return _label_response(label, 0)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
