import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.repositories import TeamMemberRepository

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

member_repo = TeamMemberRepository()


class LoginRequest(BaseModel):
    telegram_id: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    member_id: str
    role: str


def create_access_token(member_id: uuid.UUID) -> str:
    payload = {
        "sub": str(member_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> TeamMember:
    """Extract and validate JWT token, return TeamMember."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key,
            algorithms=[ALGORITHM],
        )
        member_id = uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный токен авторизации",
        )

    member = await member_repo.get_by_id(session, member_id)
    if not member or not member.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден или деактивирован",
        )
    return member


async def require_moderator(
    member: TeamMember = Depends(get_current_user),
) -> TeamMember:
    """Require moderator role."""
    if member.role != "moderator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ только для модераторов",
        )
    return member


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    """Login by telegram_id. Returns JWT token."""
    member = await member_repo.get_by_telegram_id(session, data.telegram_id)
    if not member or not member.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден. Сначала используйте /start в Telegram-боте.",
        )

    token = create_access_token(member.id)
    return TokenResponse(
        access_token=token,
        member_id=str(member.id),
        role=member.role,
    )


@router.get("/me", response_model=dict)
async def get_me(member: TeamMember = Depends(get_current_user)):
    """Get current user info."""
    return {
        "id": str(member.id),
        "telegram_id": member.telegram_id,
        "telegram_username": member.telegram_username,
        "full_name": member.full_name,
        "role": member.role,
        "is_active": member.is_active,
    }
