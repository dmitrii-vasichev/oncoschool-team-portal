"""Content module API sub-router."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.api.content.analysis import router as analysis_router
from app.api.content.channels import router as channels_router
from app.api.content.prompts import router as prompts_router
from app.db.database import get_session
from app.db.models import ContentSubSection, TeamMember
from app.services.content_access_service import ContentAccessService

telegram_router = APIRouter(prefix="/telegram", tags=["content"])
telegram_router.include_router(channels_router)
telegram_router.include_router(prompts_router)
telegram_router.include_router(analysis_router)

content_router = APIRouter(prefix="/content", tags=["content"])
content_router.include_router(telegram_router)


# ── My Access (available to any authenticated user) ──


class MyAccessEntry(BaseModel):
    sub_section: str
    role: str  # "operator" | "editor"


@content_router.get("/my-access", response_model=list[MyAccessEntry])
async def get_my_access(
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return the current user's resolved content access roles."""
    result: list[MyAccessEntry] = []
    for sub in ContentSubSection:
        role = await ContentAccessService.has_access(session, member, sub)
        if role is not None:
            result.append(MyAccessEntry(sub_section=sub.value, role=role.value))
    return result
