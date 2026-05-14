"""Publications endpoints — bundle-scoped and direct."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.content_factory.deps import require_cf_access
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.schemas import (
    CFPublicationCreate,
    CFPublicationResponse,
    CFPublicationSegmentTargetCreate,
    CFPublicationSegmentTargetResponse,
    CFPublicationUpdate,
    CFPublicationVersionResponse,
)
from app.services.content_factory.publication_service import PublicationService

publication_service = PublicationService

# Two routers: one mounted under /bundles (for bundle-scoped ops),
# one under /publications (for direct ops).
bundle_pubs_router = APIRouter(prefix="/bundles", tags=["content-factory"])
pubs_router = APIRouter(prefix="/publications", tags=["content-factory"])


@bundle_pubs_router.get(
    "/{bundle_id}/publications",
    response_model=list[CFPublicationResponse],
)
async def list_publications_for_bundle(
    bundle_id: uuid.UUID,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    return await publication_service.list_by_bundle(session, bundle_id)


@bundle_pubs_router.post(
    "/{bundle_id}/publications",
    response_model=CFPublicationResponse,
    status_code=201,
)
async def create_publication_for_bundle(
    bundle_id: uuid.UUID,
    data: CFPublicationCreate,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    if data.bundle_id != bundle_id:
        raise HTTPException(
            status_code=400,
            detail="bundle_id в теле должен совпадать с bundle_id в URL",
        )
    pub = await publication_service.create(session, data, editor_id=member.id)
    await session.commit()
    return pub


@pubs_router.get("", response_model=list[CFPublicationResponse])
async def list_publications(
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
    bundle_id: uuid.UUID | None = None,
    status: str | None = None,
    platform_id: uuid.UUID | None = None,
    format_id: uuid.UUID | None = None,
    responsible_id: uuid.UUID | None = None,
    scheduled_from: datetime | None = None,
    scheduled_to: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return await publication_service.list(
        session,
        bundle_id=bundle_id,
        status=status,
        platform_id=platform_id,
        format_id=format_id,
        responsible_id=responsible_id,
        scheduled_from=scheduled_from,
        scheduled_to=scheduled_to,
        limit=limit,
        offset=offset,
    )


@pubs_router.get("/{publication_id}", response_model=CFPublicationResponse)
async def get_publication(
    publication_id: uuid.UUID,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    pub = await publication_service.get(session, publication_id)
    if pub is None:
        raise HTTPException(status_code=404, detail="Публикация не найдена")
    return pub


@pubs_router.patch("/{publication_id}", response_model=CFPublicationResponse)
async def update_publication(
    publication_id: uuid.UUID,
    data: CFPublicationUpdate,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    pub = await publication_service.update(
        session, publication_id, data,
        editor_id=member.id,
        approval_event="reviewed",
    )
    if pub is None:
        raise HTTPException(status_code=404, detail="Публикация не найдена")
    await session.commit()
    return pub


@pubs_router.get(
    "/{publication_id}/versions",
    response_model=list[CFPublicationVersionResponse],
)
async def list_publication_versions(
    publication_id: uuid.UUID,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    return await publication_service.list_versions(session, publication_id)


@pubs_router.get(
    "/{publication_id}/segment-targets",
    response_model=list[CFPublicationSegmentTargetResponse],
)
async def list_segment_targets(
    publication_id: uuid.UUID,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    return await publication_service.list_segment_targets(session, publication_id)


@pubs_router.post(
    "/{publication_id}/segment-targets",
    response_model=CFPublicationSegmentTargetResponse,
    status_code=201,
)
async def add_segment_target(
    publication_id: uuid.UUID,
    data: CFPublicationSegmentTargetCreate,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    target = await publication_service.add_segment_target(
        session, publication_id,
        data.external_segment_id,
        role=data.role,
        expected_count=data.expected_count,
    )
    await session.commit()
    return target


@pubs_router.delete(
    "/{publication_id}/segment-targets/{external_segment_id}",
    status_code=204,
)
async def remove_segment_target(
    publication_id: uuid.UUID,
    external_segment_id: uuid.UUID,
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
):
    ok = await publication_service.remove_segment_target(
        session, publication_id, external_segment_id
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Сегмент-таргет не найден")
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
