import hashlib
import hmac
import time
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


# --- Models ---


class TelegramAuthData(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    member_id: str
    role: str


# --- Token helpers ---


def create_access_token(member_id: uuid.UUID) -> str:
    payload = {
        "sub": str(member_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


# --- Telegram signature verification ---


def verify_telegram_auth(data: TelegramAuthData, bot_token: str) -> bool:
    """Verify Telegram Login Widget data using HMAC-SHA256.

    See https://core.telegram.org/widgets/login#checking-authorization
    """
    data_dict = data.model_dump(exclude={"hash"}, exclude_none=True)
    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(data_dict.items())
    )
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    check_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(check_hash, data.hash)


# --- Dependencies ---


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


# --- Endpoints ---


@router.post("/telegram", response_model=TokenResponse)
async def login_telegram(
    data: TelegramAuthData,
    session: AsyncSession = Depends(get_session),
):
    """Authenticate via Telegram Login Widget with cryptographic signature check."""
    # 1. Verify signature
    if not verify_telegram_auth(data, settings.BOT_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидная подпись Telegram",
        )

    # 2. Check auth_date freshness (5 minutes)
    if time.time() - data.auth_date > 300:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Авторизация устарела. Попробуйте снова",
        )

    # 3. Find member
    member = await member_repo.get_by_telegram_id(session, data.id)
    if not member or not member.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён. Обратитесь к модератору для добавления в команду",
        )

    # 4. Update telegram_username if changed
    if data.username and data.username != member.telegram_username:
        member.telegram_username = data.username
        async with session.begin():
            session.add(member)

    # 5. Issue JWT
    token = create_access_token(member.id)
    return TokenResponse(
        access_token=token,
        member_id=str(member.id),
        role=member.role,
    )


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(
    data: dict,
    session: AsyncSession = Depends(get_session),
):
    """Dev-only login by telegram_id. Only available when DEBUG=true."""
    if not settings.DEBUG:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )

    telegram_id = data.get("telegram_id")
    if not telegram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="telegram_id is required",
        )

    member = await member_repo.get_by_telegram_id(session, int(telegram_id))
    if not member or not member.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь не найден. Сначала напишите /start боту в Telegram",
        )

    token = create_access_token(member.id)
    return TokenResponse(
        access_token=token,
        member_id=str(member.id),
        role=member.role,
    )


@router.get("/config")
async def get_auth_config():
    """Public endpoint — returns bot username for Telegram Login Widget."""
    return {
        "bot_username": settings.TELEGRAM_BOT_USERNAME,
        "debug": settings.DEBUG,
    }


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
