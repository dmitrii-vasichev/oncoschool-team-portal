"""Pydantic schemas for Content module (channels, prompts, data inventory)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Telegram Channels ──


class TelegramChannelCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=200)
    display_name: str = Field(..., min_length=1, max_length=300)


class TelegramChannelUpdate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=300)


class TelegramChannelResponse(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    created_at: datetime


class ChannelContentStats(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    created_at: datetime
    total_count: int = 0
    post_count: int = 0
    comment_count: int = 0
    earliest_date: datetime | None = None
    latest_date: datetime | None = None


class DataInventoryResponse(BaseModel):
    channels: list[ChannelContentStats]
    total_posts: int = 0
    total_comments: int = 0


# ── Analysis Prompts ──


class AnalysisPromptCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    text: str = Field(..., min_length=1)


class AnalysisPromptUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    text: str | None = Field(None, min_length=1)


class AnalysisPromptResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    text: str
    created_by_id: uuid.UUID
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime
