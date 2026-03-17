"""Channels CRUD API for Content module."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_content_editor, require_content_operator
from app.api.schemas.content import (
    ChannelContentStats,
    DataInventoryResponse,
    TelegramChannelCreate,
    TelegramChannelResponse,
    TelegramChannelUpdate,
)
from app.db.database import get_session
from app.db.models import ContentSubSection, TeamMember
from app.db.repositories import TelegramChannelRepository

router = APIRouter(tags=["content-channels"])

_repo = TelegramChannelRepository()

_operator = require_content_operator(ContentSubSection.telegram_analysis)
_editor = require_content_editor(ContentSubSection.telegram_analysis)


@router.get("/channels", response_model=list[TelegramChannelResponse])
async def list_channels(
    member: TeamMember = Depends(_operator),
    session: AsyncSession = Depends(get_session),
):
    """List all configured Telegram channels."""
    channels = await _repo.get_all(session)
    return [
        TelegramChannelResponse(
            id=ch.id,
            username=ch.username,
            display_name=ch.display_name,
            created_at=ch.created_at,
        )
        for ch in channels
    ]


@router.post("/channels", response_model=TelegramChannelResponse, status_code=201)
async def create_channel(
    data: TelegramChannelCreate,
    member: TeamMember = Depends(_editor),
    session: AsyncSession = Depends(get_session),
):
    """Add a new Telegram channel. Editor only."""
    existing = await _repo.get_by_username(session, data.username)
    if existing:
        raise HTTPException(status_code=409, detail="Канал с таким username уже существует")

    channel = await _repo.create(
        session,
        username=data.username,
        display_name=data.display_name,
    )
    await session.commit()
    return TelegramChannelResponse(
        id=channel.id,
        username=channel.username,
        display_name=channel.display_name,
        created_at=channel.created_at,
    )


@router.put("/channels/{channel_id}", response_model=TelegramChannelResponse)
async def update_channel(
    channel_id: uuid.UUID,
    data: TelegramChannelUpdate,
    member: TeamMember = Depends(_editor),
    session: AsyncSession = Depends(get_session),
):
    """Update channel display name. Editor only."""
    channel = await _repo.update(session, channel_id, display_name=data.display_name)
    if not channel:
        raise HTTPException(status_code=404, detail="Канал не найден")
    await session.commit()
    return TelegramChannelResponse(
        id=channel.id,
        username=channel.username,
        display_name=channel.display_name,
        created_at=channel.created_at,
    )


@router.delete("/channels/{channel_id}")
async def delete_channel(
    channel_id: uuid.UUID,
    member: TeamMember = Depends(_editor),
    session: AsyncSession = Depends(get_session),
):
    """Delete a channel and all its content. Editor only."""
    deleted = await _repo.delete(session, channel_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Канал не найден")
    await session.commit()
    return {"ok": True}


@router.get("/data-inventory", response_model=DataInventoryResponse)
async def get_data_inventory(
    member: TeamMember = Depends(_operator),
    session: AsyncSession = Depends(get_session),
):
    """Get full data inventory: channels with content statistics."""
    rows = await _repo.get_with_content_stats(session)
    channels = [ChannelContentStats(**row) for row in rows]
    return DataInventoryResponse(
        channels=channels,
        total_posts=sum(ch.post_count for ch in channels),
        total_comments=sum(ch.comment_count for ch in channels),
    )
