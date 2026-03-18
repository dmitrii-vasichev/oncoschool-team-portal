"""Content module API sub-router."""

from fastapi import APIRouter

from app.api.content.analysis import router as analysis_router
from app.api.content.channels import router as channels_router
from app.api.content.prompts import router as prompts_router

content_router = APIRouter(prefix="/content/telegram", tags=["content"])

content_router.include_router(channels_router)
content_router.include_router(prompts_router)
content_router.include_router(analysis_router)
