"""Admin API: AI feature config, content access management, Telegram connection."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_admin
from app.db.database import get_session
from app.db.models import ContentRole, ContentSubSection, TeamMember
from app.services.ai_config_service import AIFeatureConfigService
from app.services.ai_service import AIService
from app.services.content_access_service import ContentAccessService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])
ai_service = AIService()


def _get_telegram_service(request: Request):
    service = getattr(request.app.state, "telegram_connection_service", None)
    if service is None:
        raise HTTPException(
            status_code=503,
            detail="Telegram connection service not available",
        )
    return service


# ── AI Feature Config ──


class AIFeatureConfigResponse(BaseModel):
    feature_key: str
    display_name: str
    provider: str | None
    model: str | None
    updated_by_id: uuid.UUID | None = None


class AIFeatureConfigUpdate(BaseModel):
    provider: str | None = None
    model: str | None = None


@router.get("/ai-config", response_model=list[AIFeatureConfigResponse])
async def get_ai_configs(
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """List all feature → provider/model mappings. Admin only."""
    configs = await AIFeatureConfigService.get_all_configs(session)
    return [
        AIFeatureConfigResponse(
            feature_key=c.feature_key,
            display_name=c.display_name,
            provider=c.provider,
            model=c.model,
            updated_by_id=c.updated_by_id,
        )
        for c in configs
    ]


@router.put("/ai-config/{feature_key}", response_model=AIFeatureConfigResponse)
async def update_ai_config(
    feature_key: str,
    data: AIFeatureConfigUpdate,
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Update provider/model for a specific feature. Admin only."""
    # Validate provider has API key
    if data.provider:
        available = ai_service.get_available_providers()
        if data.provider not in available:
            raise HTTPException(
                status_code=400,
                detail=f"Провайдер '{data.provider}' недоступен (нет API ключа)",
            )

    config = await AIFeatureConfigService.update_config(
        session, feature_key, data.provider, data.model, member.id
    )
    await session.commit()
    return AIFeatureConfigResponse(
        feature_key=config.feature_key,
        display_name=config.display_name,
        provider=config.provider,
        model=config.model,
        updated_by_id=config.updated_by_id,
    )


# ── Content Access ──


class ContentAccessResponse(BaseModel):
    id: uuid.UUID
    sub_section: str
    member_id: uuid.UUID | None
    member_name: str | None = None
    department_id: uuid.UUID | None
    department_name: str | None = None
    role: str


class ContentAccessGrant(BaseModel):
    sub_section: str  # e.g. "telegram_analysis"
    member_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    role: str  # "operator" or "editor"


def _access_to_response(access) -> ContentAccessResponse:
    return ContentAccessResponse(
        id=access.id,
        sub_section=access.sub_section.value if hasattr(access.sub_section, 'value') else access.sub_section,
        member_id=access.member_id,
        member_name=access.member.full_name if access.member else None,
        department_id=access.department_id,
        department_name=access.department.name if access.department else None,
        role=access.role.value if hasattr(access.role, 'value') else access.role,
    )


@router.get("/content-access", response_model=list[ContentAccessResponse])
async def get_content_access(
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """List all content access grants. Admin only."""
    grants = await ContentAccessService.list_access(session)
    return [_access_to_response(g) for g in grants]


@router.post("/content-access", response_model=ContentAccessResponse)
async def grant_content_access(
    data: ContentAccessGrant,
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Grant content access to a user or department. Admin only."""
    if not data.member_id and not data.department_id:
        raise HTTPException(status_code=400, detail="Укажите member_id или department_id")

    try:
        sub_section = ContentSubSection(data.sub_section)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Неизвестный раздел: {data.sub_section}")

    try:
        role = ContentRole(data.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Неизвестная роль: {data.role}")

    access = await ContentAccessService.grant_access(
        session,
        sub_section=sub_section,
        role=role,
        member_id=data.member_id,
        department_id=data.department_id,
    )
    await session.commit()

    # Reload with relationships
    grants = await ContentAccessService.list_access(session)
    for g in grants:
        if g.id == access.id:
            return _access_to_response(g)
    return _access_to_response(access)


@router.delete("/content-access/{access_id}")
async def revoke_content_access(
    access_id: uuid.UUID,
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Revoke content access. Admin only."""
    revoked = await ContentAccessService.revoke_access(session, access_id)
    if not revoked:
        raise HTTPException(status_code=404, detail="Доступ не найден")
    await session.commit()
    return {"ok": True}


# ── Telegram Connection ──


class TelegramConnectRequest(BaseModel):
    api_id: str
    api_hash: str
    phone: str


class TelegramVerifyRequest(BaseModel):
    code: str
    password: str | None = None


@router.get("/telegram/status")
async def get_telegram_status(
    request: Request,
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Get Telegram connection status. Admin only."""
    service = _get_telegram_service(request)
    return await service.get_status(session)


@router.post("/telegram/connect")
async def connect_telegram(
    request: Request,
    data: TelegramConnectRequest,
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Initiate Telegram authorization (sends code to phone). Admin only."""
    service = _get_telegram_service(request)
    result = await service.initiate_connection(session, data.api_id, data.api_hash, data.phone)
    await session.commit()
    return result


@router.post("/telegram/verify")
async def verify_telegram(
    request: Request,
    data: TelegramVerifyRequest,
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Submit auth code (and optional 2FA password) to complete Telegram authorization. Admin only."""
    service = _get_telegram_service(request)
    result = await service.verify_code(session, data.code, data.password)
    await session.commit()
    return result


@router.post("/telegram/disconnect")
async def disconnect_telegram(
    request: Request,
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Terminate Telegram session and clear credentials. Admin only."""
    service = _get_telegram_service(request)
    await service.disconnect(session)
    await session.commit()
    return {"ok": True}
