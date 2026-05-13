import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.database import get_session
from app.db.models import Department, Idea, IdeaDepartment, TeamMember
from app.db.schemas import (
    IdeaCommentCreate,
    IdeaDepartmentCreate,
    IdeaDepartmentUpdate,
    IdeaCreate,
    IdeaLinkedTaskCreate,
    IdeaResponse,
    IdeaStatusChange,
    IdeaUpdate,
    PaginatedIdeasResponse,
)
from app.services.idea_service import IdeaService
from app.services.notification_service import NotificationService
from app.services.task_service import TaskService

router = APIRouter(prefix="/ideas", tags=["ideas"])
idea_service = IdeaService()
task_service = TaskService()
LINKABLE_IDEA_STATUSES = {"accepted", "in_tasks"}


async def _get_idea_or_404(session: AsyncSession, idea_id: uuid.UUID) -> Idea:
    idea = await idea_service.repo.get_by_id(session, idea_id)
    if idea is None:
        raise HTTPException(status_code=404, detail="Идея не найдена")
    return idea


async def _reload_and_shape(
    session: AsyncSession,
    member: TeamMember,
    idea_id: uuid.UUID,
) -> IdeaResponse:
    idea = await _get_idea_or_404(session, idea_id)
    return await idea_service.shape_response(session, member, idea)


def _find_idea_department_or_404(
    idea: Idea,
    idea_department_id: uuid.UUID,
) -> IdeaDepartment:
    for item in getattr(idea, "departments", []) or []:
        if item.id == idea_department_id:
            return item
    raise HTTPException(status_code=404, detail="Отдел идеи не найден")


def _is_duplicate_idea_department_error(exc: IntegrityError) -> bool:
    message = f"{exc.orig} {exc}".lower()
    return (
        "uq_idea_departments_idea_department" in message
        or ("idea_departments" in message and "duplicate" in message)
    )


def _bot_from_request(request: Request):
    app_state = getattr(getattr(request, "app", None), "state", None)
    return getattr(app_state, "bot", None)


async def _ensure_active_department(
    session: AsyncSession,
    idea_department: IdeaDepartment,
) -> Department:
    department = getattr(idea_department, "department", None)
    if department is None:
        department = await session.get(Department, idea_department.department_id)
    if department is None or not department.is_active:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    return department


def _dedupe_uuids(values: list[uuid.UUID]) -> list[uuid.UUID]:
    seen = set()
    deduped = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


async def _ensure_linkable_idea_status(idea: Idea) -> None:
    if idea.status not in LINKABLE_IDEA_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Задачи можно создавать только для принятой идеи или идеи в задачах",
        )


@router.get("", response_model=PaginatedIdeasResponse)
async def list_ideas(
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(None),
    author_id: uuid.UUID | None = Query(None),
    review_owner_id: uuid.UUID | None = Query(None),
    department_id: uuid.UUID | None = Query(None),
    created_from: date | None = Query(None),
    created_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PaginatedIdeasResponse:
    return await idea_service.list_ideas(
        session,
        member,
        status=status_filter,
        search=search,
        author_id=author_id,
        review_owner_id=review_owner_id,
        department_id=department_id,
        created_from=created_from,
        created_to=created_to,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=IdeaResponse, status_code=status.HTTP_201_CREATED)
async def create_idea(
    data: IdeaCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IdeaResponse:
    review_owner = await session.get(TeamMember, data.review_owner_id)
    if review_owner is None or not review_owner.is_active:
        raise HTTPException(status_code=404, detail="Ответственный не найден")

    department_ids = _dedupe_uuids(data.department_ids)
    for department_id in department_ids:
        department = await session.get(Department, department_id)
        if department is None or not department.is_active:
            raise HTTPException(status_code=404, detail="Отдел не найден")

    try:
        idea = await idea_service.repo.create(
            session,
            title=data.title,
            description=data.description,
            author_id=member.id,
            review_owner_id=data.review_owner_id,
        )
        await idea_service.repo.add_event(
            session,
            idea_id=idea.id,
            actor_id=member.id,
            event_type="idea_created",
            payload={"title": data.title},
        )
        for department_id in department_ids:
            await idea_service.repo.add_department(
                session,
                idea_id=idea.id,
                department_id=department_id,
                owner_id=data.review_owner_id,
                created_by_id=member.id,
            )
            await idea_service.repo.add_event(
                session,
                idea_id=idea.id,
                actor_id=member.id,
                event_type="department_added",
                payload={
                    "department_id": str(department_id),
                    "owner_id": str(data.review_owner_id),
                },
            )
    except IntegrityError as exc:
        await session.rollback()
        if _is_duplicate_idea_department_error(exc):
            raise HTTPException(
                status_code=409,
                detail="Отдел уже добавлен к идее",
            ) from exc
        raise

    await session.commit()
    return await _reload_and_shape(session, member, idea.id)


@router.get("/{idea_id}", response_model=IdeaResponse)
async def get_idea(
    idea_id: uuid.UUID,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IdeaResponse:
    idea = await _get_idea_or_404(session, idea_id)
    return await idea_service.shape_response(session, member, idea)


@router.patch("/{idea_id}", response_model=IdeaResponse)
async def update_idea(
    idea_id: uuid.UUID,
    data: IdeaUpdate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IdeaResponse:
    idea = await _get_idea_or_404(session, idea_id)
    if not idea_service.can_manage_idea(member, idea):
        raise HTTPException(status_code=403, detail="Недостаточно прав для изменения идеи")

    fields = {
        key: value
        for key, value in data.model_dump(exclude_unset=True).items()
        if value is not None
    }
    if fields:
        await idea_service.repo.update(session, idea, **fields)
    await idea_service.repo.add_event(
        session,
        idea_id=idea.id,
        actor_id=member.id,
        event_type="idea_updated",
        payload={"fields": list(fields)},
    )
    await session.commit()
    return await _reload_and_shape(session, member, idea.id)


@router.post("/{idea_id}/status", response_model=IdeaResponse)
async def change_idea_status(
    idea_id: uuid.UUID,
    data: IdeaStatusChange,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IdeaResponse:
    idea = await _get_idea_or_404(session, idea_id)
    try:
        await idea_service.record_status_change(
            session,
            idea=idea,
            member=member,
            status=data.status,
            comment=data.comment,
            deferred_until=data.deferred_until,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await session.commit()
    return await _reload_and_shape(session, member, idea.id)


@router.post("/{idea_id}/comments", response_model=IdeaResponse)
async def add_idea_comment(
    idea_id: uuid.UUID,
    data: IdeaCommentCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IdeaResponse:
    idea = await _get_idea_or_404(session, idea_id)
    comment = await idea_service.repo.add_comment(
        session,
        idea_id=idea.id,
        author_id=member.id,
        body=data.body,
    )
    await idea_service.repo.add_event(
        session,
        idea_id=idea.id,
        actor_id=member.id,
        event_type="comment_added",
        payload={"comment_id": str(comment.id)},
    )
    await session.commit()
    return await _reload_and_shape(session, member, idea.id)


@router.post("/{idea_id}/departments", response_model=IdeaResponse)
async def add_idea_department(
    idea_id: uuid.UUID,
    data: IdeaDepartmentCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IdeaResponse:
    idea = await _get_idea_or_404(session, idea_id)
    department = await session.get(Department, data.department_id)
    if department is None or not department.is_active:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    if idea.status not in {"accepted", "in_tasks"}:
        raise HTTPException(
            status_code=400,
            detail="Отдел можно добавить только к принятой идее или идее в задачах",
        )
    if not idea_service.can_add_department(member, idea, department):
        raise HTTPException(status_code=403, detail="Недостаточно прав для добавления отдела")

    try:
        await idea_service.repo.add_department(
            session,
            idea_id=idea.id,
            department_id=data.department_id,
            owner_id=data.owner_id,
            created_by_id=member.id,
        )
    except IntegrityError as exc:
        await session.rollback()
        if _is_duplicate_idea_department_error(exc):
            raise HTTPException(
                status_code=409,
                detail="Отдел уже добавлен к идее",
            ) from exc
        raise

    await idea_service.repo.add_event(
        session,
        idea_id=idea.id,
        actor_id=member.id,
        event_type="department_added",
        payload={
            "department_id": str(data.department_id),
            "owner_id": str(data.owner_id),
        },
    )
    await session.commit()
    return await _reload_and_shape(session, member, idea.id)


@router.patch("/{idea_id}/departments/{idea_department_id}", response_model=IdeaResponse)
async def update_idea_department(
    idea_id: uuid.UUID,
    idea_department_id: uuid.UUID,
    data: IdeaDepartmentUpdate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IdeaResponse:
    idea = await _get_idea_or_404(session, idea_id)
    idea_department = _find_idea_department_or_404(idea, idea_department_id)
    await _ensure_linkable_idea_status(idea)
    await _ensure_active_department(session, idea_department)
    if not idea_service.can_manage_idea_department(member, idea, idea_department):
        raise HTTPException(status_code=403, detail="Недостаточно прав для изменения отдела")

    updates = data.model_dump(exclude_unset=True)
    if updates.get("status") == "ready" and not idea_service.can_mark_department_ready(
        idea_department
    ):
        raise HTTPException(
            status_code=400,
            detail="Отдел нельзя отметить готовым: не все связанные задачи закрыты",
        )
    for field in ("owner_id", "status", "note"):
        if field in updates:
            value = updates[field]
            if field != "note" and value is None:
                continue
            setattr(idea_department, field, value)

    await session.flush()
    await idea_service.repo.add_event(
        session,
        idea_id=idea.id,
        actor_id=member.id,
        event_type="department_updated",
        payload={
            "idea_department_id": str(idea_department.id),
            "fields": list(updates),
        },
    )
    await session.commit()
    return await _reload_and_shape(session, member, idea.id)


@router.post("/{idea_id}/tasks", response_model=IdeaResponse)
async def create_idea_task(
    idea_id: uuid.UUID,
    data: IdeaLinkedTaskCreate,
    request: Request,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IdeaResponse:
    idea = await _get_idea_or_404(session, idea_id)
    await _ensure_linkable_idea_status(idea)
    if not idea_service.can_manage_idea(member, idea):
        raise HTTPException(status_code=403, detail="Недостаточно прав для создания задачи")

    return await _create_linked_task(
        request,
        session,
        member,
        idea,
        data,
        idea_department_id=None,
    )


@router.post("/{idea_id}/departments/{idea_department_id}/tasks", response_model=IdeaResponse)
async def create_idea_department_task(
    idea_id: uuid.UUID,
    idea_department_id: uuid.UUID,
    data: IdeaLinkedTaskCreate,
    request: Request,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IdeaResponse:
    idea = await _get_idea_or_404(session, idea_id)
    await _ensure_linkable_idea_status(idea)
    idea_department = _find_idea_department_or_404(idea, idea_department_id)
    if not idea_service.can_manage_idea_department(member, idea, idea_department):
        raise HTTPException(status_code=403, detail="Недостаточно прав для создания задачи")

    return await _create_linked_task(
        request,
        session,
        member,
        idea,
        data,
        idea_department_id=idea_department.id,
    )


async def _create_linked_task(
    request: Request,
    session: AsyncSession,
    member: TeamMember,
    idea: Idea,
    data: IdeaLinkedTaskCreate,
    idea_department_id: uuid.UUID | None,
) -> IdeaResponse:
    try:
        task = await task_service.create_task(
            session=session,
            title=data.title,
            creator=member,
            assignee_id=data.assignee_id,
            description=data.description,
            checklist=[],
            priority=data.priority,
            deadline=data.deadline,
            source="web",
            label_ids=data.label_ids,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await idea_service.repo.add_task_link(
        session,
        idea_id=idea.id,
        idea_department_id=idea_department_id,
        task_id=task.id,
        created_by_id=member.id,
    )
    if idea.status == "accepted":
        await idea_service.repo.update(session, idea, status="in_tasks")
    await idea_service.repo.add_event(
        session,
        idea_id=idea.id,
        actor_id=member.id,
        event_type="task_linked",
        payload={
            "task_id": str(task.id),
            "idea_department_id": str(idea_department_id)
            if idea_department_id is not None
            else None,
        },
    )

    bot = _bot_from_request(request)
    if bot is not None:
        await NotificationService(bot).notify_task_created(session, task, member)

    await session.commit()
    return await _reload_and_shape(session, member, idea.id)
