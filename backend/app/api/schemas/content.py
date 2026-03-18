"""Pydantic schemas for Content module (channels, prompts, data inventory)."""

import uuid
from datetime import date, datetime

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


# ── Analysis Runs ──


class AnalysisPrepareRequest(BaseModel):
    channel_ids: list[uuid.UUID] = Field(..., min_length=1)
    date_from: date
    date_to: date
    content_type: str = Field("all", pattern=r"^(posts|comments|all)$")


class ChannelPrepareSummary(BaseModel):
    channel_id: uuid.UUID
    channel_name: str
    existing_count: int
    estimated_missing: int | None = None


class AnalysisPrepareResponse(BaseModel):
    channels: list[ChannelPrepareSummary]
    total_existing: int
    total_estimated_missing: int | None = None
    telegram_connected: bool


class AnalysisRunRequest(BaseModel):
    channel_ids: list[uuid.UUID] = Field(..., min_length=1)
    date_from: date
    date_to: date
    content_type: str = Field("all", pattern=r"^(posts|comments|all)$")
    prompt_id: uuid.UUID | None = None
    prompt_text: str | None = None


class AnalysisRunResponse(BaseModel):
    id: uuid.UUID
    channels: list
    date_from: date
    date_to: date
    content_type: str
    prompt_id: uuid.UUID | None
    prompt_snapshot: str
    ai_provider: str | None
    ai_model: str | None
    result_markdown: str | None
    status: str
    error_message: str | None
    run_by_id: uuid.UUID
    run_by_name: str | None = None
    created_at: datetime
    completed_at: datetime | None


class AnalysisHistoryResponse(BaseModel):
    items: list[AnalysisRunResponse]
    total: int
    page: int
    per_page: int
