"""Guest story CRM endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.content_factory.deps import require_cf_access
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.schemas import (
    CFGuestStoryCreate,
    CFGuestStoryEventCreate,
    CFGuestStoryEventResponse,
    CFGuestStoryResponse,
    CFGuestStoryUpdate,
)
from app.services.content_factory.guest_story_service import GuestStoryService

router = APIRouter(prefix="/guests", tags=["content-factory"])
guest_story_service = GuestStoryService


@router.get("", response_model=list[CFGuestStoryResponse])
async def list_guest_stories(
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
    status: str | None = None,
    owner_id: uuid.UUID | None = None,
    consent_status: str | None = None,
    bundle_id: uuid.UUID | None = None,
    publication_id: uuid.UUID | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return await guest_story_service.list(
        session,
        status=status,
        owner_id=owner_id,
        consent_status=consent_status,
        bundle_id=bundle_id,
        publication_id=publication_id,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=CFGuestStoryResponse, status_code=201)
async def create_guest_story(
    data: CFGuestStoryCreate,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    guest_story = await guest_story_service.create(session, data, actor_id=member.id)
    await session.commit()
    return guest_story


@router.get("/{guest_story_id}", response_model=CFGuestStoryResponse)
async def get_guest_story(
    guest_story_id: uuid.UUID,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    guest_story = await guest_story_service.get(session, guest_story_id)
    if guest_story is None:
        raise HTTPException(status_code=404, detail="История гостя не найдена")
    return guest_story


@router.patch("/{guest_story_id}", response_model=CFGuestStoryResponse)
async def update_guest_story(
    guest_story_id: uuid.UUID,
    data: CFGuestStoryUpdate,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    guest_story = await guest_story_service.update(
        session,
        guest_story_id,
        data,
        actor_id=member.id,
    )
    if guest_story is None:
        raise HTTPException(status_code=404, detail="История гостя не найдена")
    await session.commit()
    return guest_story


@router.get("/{guest_story_id}/events", response_model=list[CFGuestStoryEventResponse])
async def list_guest_story_events(
    guest_story_id: uuid.UUID,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    guest_story = await guest_story_service.get(session, guest_story_id)
    if guest_story is None:
        raise HTTPException(status_code=404, detail="История гостя не найдена")
    return await guest_story_service.list_events(session, guest_story_id)


@router.post(
    "/{guest_story_id}/events",
    response_model=CFGuestStoryEventResponse,
    status_code=201,
)
async def create_guest_story_event(
    guest_story_id: uuid.UUID,
    data: CFGuestStoryEventCreate,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    guest_story = await guest_story_service.get(session, guest_story_id)
    if guest_story is None:
        raise HTTPException(status_code=404, detail="История гостя не найдена")
    try:
        event = await guest_story_service.create_comment(
            session,
            guest_story_id=guest_story_id,
            actor_id=member.id,
            body=data.body,
            parent_event_id=data.parent_event_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Событие для ответа не найдено") from exc
    await session.commit()
    return event
