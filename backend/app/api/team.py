import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, require_moderator
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.repositories import TeamMemberRepository
from app.db.schemas import TeamMemberResponse, TeamMemberUpdate

router = APIRouter(prefix="/team", tags=["team"])
member_repo = TeamMemberRepository()


@router.get("", response_model=list[TeamMemberResponse])
async def list_team(
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all active team members."""
    members = await member_repo.get_all_active(session)
    return members


@router.get("/{member_id}", response_model=TeamMemberResponse)
async def get_team_member(
    member_id: uuid.UUID,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get team member details."""
    target = await member_repo.get_by_id(session, member_id)
    if not target:
        raise HTTPException(status_code=404, detail="Участник не найден")
    return target


@router.patch("/{member_id}", response_model=TeamMemberResponse)
async def update_team_member(
    member_id: uuid.UUID,
    data: TeamMemberUpdate,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Update team member. Moderator only."""
    target = await member_repo.get_by_id(session, member_id)
    if not target:
        raise HTTPException(status_code=404, detail="Участник не найден")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")

    async with session.begin():
        updated = await member_repo.update(session, member_id, **update_data)
    return updated
