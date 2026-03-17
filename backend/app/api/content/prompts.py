"""Prompts CRUD API for Content module."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_content_editor, require_content_operator
from app.api.schemas.content import (
    AnalysisPromptCreate,
    AnalysisPromptResponse,
    AnalysisPromptUpdate,
)
from app.db.database import get_session
from app.db.models import ContentSubSection, TeamMember
from app.db.repositories import AnalysisPromptRepository

router = APIRouter(tags=["content-prompts"])

_repo = AnalysisPromptRepository()

_operator = require_content_operator(ContentSubSection.telegram_analysis)
_editor = require_content_editor(ContentSubSection.telegram_analysis)


def _prompt_response(prompt) -> AnalysisPromptResponse:
    return AnalysisPromptResponse(
        id=prompt.id,
        title=prompt.title,
        description=prompt.description,
        text=prompt.text,
        created_by_id=prompt.created_by_id,
        created_by_name=prompt.created_by.full_name if prompt.created_by else None,
        created_at=prompt.created_at,
        updated_at=prompt.updated_at,
    )


@router.get("/prompts", response_model=list[AnalysisPromptResponse])
async def list_prompts(
    member: TeamMember = Depends(_operator),
    session: AsyncSession = Depends(get_session),
):
    """List all analysis prompts."""
    prompts = await _repo.get_all(session)
    return [_prompt_response(p) for p in prompts]


@router.post("/prompts", response_model=AnalysisPromptResponse, status_code=201)
async def create_prompt(
    data: AnalysisPromptCreate,
    member: TeamMember = Depends(_editor),
    session: AsyncSession = Depends(get_session),
):
    """Create a new analysis prompt. Editor only."""
    prompt = await _repo.create(
        session,
        title=data.title,
        description=data.description,
        text=data.text,
        created_by_id=member.id,
    )
    await session.commit()

    # Reload with relationships
    prompt = await _repo.get_by_id(session, prompt.id)
    return _prompt_response(prompt)


@router.put("/prompts/{prompt_id}", response_model=AnalysisPromptResponse)
async def update_prompt(
    prompt_id: uuid.UUID,
    data: AnalysisPromptUpdate,
    member: TeamMember = Depends(_editor),
    session: AsyncSession = Depends(get_session),
):
    """Update an analysis prompt. Editor only."""
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")

    prompt = await _repo.update(session, prompt_id, **update_data)
    if not prompt:
        raise HTTPException(status_code=404, detail="Промпт не найден")
    await session.commit()
    return _prompt_response(prompt)


@router.delete("/prompts/{prompt_id}")
async def delete_prompt(
    prompt_id: uuid.UUID,
    member: TeamMember = Depends(_editor),
    session: AsyncSession = Depends(get_session),
):
    """Delete an analysis prompt. Editor only."""
    deleted = await _repo.delete(session, prompt_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Промпт не найден")
    await session.commit()
    return {"ok": True}
