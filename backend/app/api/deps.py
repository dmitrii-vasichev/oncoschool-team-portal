"""Shared FastAPI dependencies for Content module access control."""

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.database import get_session
from app.db.models import ContentSubSection, TeamMember
from app.services.content_access_service import ContentAccessService


def require_content_operator(sub_section: ContentSubSection):
    """Return a dependency that checks operator+ access for the given sub-section."""

    async def _dep(
        member: TeamMember = Depends(get_current_user),
        session: AsyncSession = Depends(get_session),
    ) -> TeamMember:
        has = await ContentAccessService.is_operator_or_editor(session, member, sub_section)
        if not has:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет доступа к этому разделу",
            )
        return member

    return _dep


def require_content_editor(sub_section: ContentSubSection):
    """Return a dependency that checks editor access for the given sub-section."""

    async def _dep(
        member: TeamMember = Depends(get_current_user),
        session: AsyncSession = Depends(get_session),
    ) -> TeamMember:
        has = await ContentAccessService.is_editor(session, member, sub_section)
        if not has:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет прав редактора для этого раздела",
            )
        return member

    return _dep
