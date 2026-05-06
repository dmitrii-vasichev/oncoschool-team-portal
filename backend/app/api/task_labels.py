from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.repositories import TaskLabelRepository
from app.db.schemas import TaskLabelCreate, TaskLabelResponse
from app.services.permission_service import PermissionService
from app.services.task_visibility_service import resolve_visible_department_ids

router = APIRouter(prefix="/task-labels", tags=["task-labels"])
label_repo = TaskLabelRepository()


async def _label_response(
    session: AsyncSession,
    label,
    usage_count: int = 0,
    member: TeamMember | None = None,
) -> TaskLabelResponse:
    is_moderator = bool(member and PermissionService.is_moderator(member))
    is_owner = bool(member and label.created_by_id == member.id)
    is_shared = False
    if member and not is_moderator and is_owner:
        is_shared = await label_repo.is_shared_for_member(session, label.id, member.id)

    is_active = not label.is_archived
    can_member_manage = is_active and is_owner and not is_shared

    return TaskLabelResponse.model_validate(label).model_copy(
        update={
            "usage_count": usage_count,
            "can_edit": is_moderator or can_member_manage,
            "can_archive": is_moderator or can_member_manage,
            "can_restore": is_moderator and label.is_archived,
            "is_shared_for_current_user": is_shared,
        }
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
    return [
        await _label_response(session, label, usage_count, member)
        for label, usage_count in labels
    ]


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
        return await _label_response(session, label, 0, member)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
