import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_admin, require_moderator
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.repositories import TelegramTargetRepository
from app.db.schemas import TelegramTargetCreate, TelegramTargetResponse
from app.services.telegram_target_access_service import invalidate_incoming_task_chat_ids_cache

router = APIRouter(prefix="/telegram-targets", tags=["telegram-targets"])

target_repo = TelegramTargetRepository()


@router.get("", response_model=list[TelegramTargetResponse])
async def get_all_targets(
    _: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Get all active telegram notification targets (moderator+)."""
    return await target_repo.get_all_active(session)


@router.post("", response_model=TelegramTargetResponse, status_code=status.HTTP_201_CREATED)
async def create_target(
    data: TelegramTargetCreate,
    _: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Create a new telegram notification target (admin only)."""
    target = await target_repo.create(
        session,
        chat_id=data.chat_id,
        thread_id=data.thread_id,
        label=data.label,
        allow_incoming_tasks=data.allow_incoming_tasks,
    )
    await session.commit()
    invalidate_incoming_task_chat_ids_cache()
    return target


@router.patch("/{target_id}", response_model=TelegramTargetResponse)
async def update_target(
    target_id: uuid.UUID,
    data: TelegramTargetCreate,
    _: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Update a telegram notification target (admin only)."""
    target = await target_repo.get_by_id(session, target_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Цель не найдена")

    update_data = data.model_dump(exclude_unset=True)
    target = await target_repo.update(session, target_id, **update_data)
    await session.commit()
    invalidate_incoming_task_chat_ids_cache()
    return target


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_target(
    target_id: uuid.UUID,
    _: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Delete a telegram notification target (admin only)."""
    target = await target_repo.get_by_id(session, target_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Цель не найдена")

    await target_repo.delete(session, target_id)
    await session.commit()
    invalidate_incoming_task_chat_ids_cache()
