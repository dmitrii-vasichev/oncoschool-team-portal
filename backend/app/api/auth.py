import hashlib
import hmac
import io
import json
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qsl

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.repositories import TeamMemberRepository
from app.services.web_login_service import web_login_service

logger = logging.getLogger(__name__)
auth_logger = logging.getLogger("auth.audit")

AVATARS_DIR = Path(__file__).resolve().parents[2] / "static" / "avatars"

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()
limiter = Limiter(key_func=get_remote_address)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

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


class TelegramWebAppAuthRequest(BaseModel):
    init_data: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    member_id: str
    role: str


class WebLoginInitRequest(BaseModel):
    username: str  # Telegram @username (with or without @)


class WebLoginInitResponse(BaseModel):
    request_id: str
    expires_at: str


class WebLoginStatusResponse(BaseModel):
    status: str  # "pending" | "confirmed" | "expired"
    access_token: str | None = None
    member_id: str | None = None
    role: str | None = None


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


def verify_telegram_webapp_init_data(
    init_data: str,
    bot_token: str,
) -> dict[str, str] | None:
    """Verify Telegram WebApp initData using HMAC-SHA256."""
    payload = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = payload.pop("hash", None)
    if not received_hash:
        return None

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(payload.items())
    )
    secret_key = hmac.new(
        b"WebAppData", bot_token.encode(), hashlib.sha256
    ).digest()
    check_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(check_hash, received_hash):
        return None
    return payload


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
    """Require moderator or admin role."""
    if member.role not in ("admin", "moderator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ только для модераторов",
        )
    return member


async def require_admin(
    member: TeamMember = Depends(get_current_user),
) -> TeamMember:
    """Require admin role."""
    if member.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ только для администраторов",
        )
    return member


# --- Avatar helper ---


async def _download_avatar_from_url(
    photo_url: str, member_id: str, storage_service=None
) -> str | None:
    """Download avatar image from URL, resize and save to Supabase (or local)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(photo_url)
            resp.raise_for_status()

        from PIL import Image

        img = Image.open(io.BytesIO(resp.content))
        img = img.convert("RGB")
        img = img.resize((256, 256), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=85)
        image_bytes = buf.getvalue()

        if storage_service:
            return await storage_service.upload(f"{member_id}_tg.webp", image_bytes)
        else:
            AVATARS_DIR.mkdir(parents=True, exist_ok=True)
            save_path = AVATARS_DIR / f"{member_id}_tg.webp"
            save_path.write_bytes(image_bytes)
            return f"/static/avatars/{member_id}_tg.webp"
    except Exception:
        logger.debug("Failed to download avatar from %s", photo_url, exc_info=True)
        return None


# --- Endpoints ---


@router.post("/telegram", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login_telegram(
    request: Request,
    data: TelegramAuthData,
    session: AsyncSession = Depends(get_session),
):
    """Authenticate via Telegram Login Widget with cryptographic signature check."""
    client_ip = request.client.host if request.client else "unknown"

    # 1. Verify signature
    if not verify_telegram_auth(data, settings.BOT_TOKEN):
        auth_logger.warning("telegram_login FAIL: invalid signature, telegram_id=%s, ip=%s", data.id, client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидная подпись Telegram",
        )

    # 2. Check auth_date freshness (5 minutes)
    if time.time() - data.auth_date > 300:
        auth_logger.warning("telegram_login FAIL: expired auth_date, telegram_id=%s, ip=%s", data.id, client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Авторизация устарела. Попробуйте снова",
        )

    # 3. Find member
    member = await member_repo.get_by_telegram_id(session, data.id)
    if not member or not member.is_active:
        auth_logger.warning("telegram_login FAIL: member not found/inactive, telegram_id=%s, ip=%s", data.id, client_ip)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён. Обратитесь к модератору для добавления в команду",
        )

    # 4. Update telegram_username if changed
    needs_commit = False
    if data.username and data.username != member.telegram_username:
        member.telegram_username = data.username
        needs_commit = True

    # 5. Download and save Telegram photo (skip custom uploads)
    if data.photo_url:
        has_custom_upload = bool(
            member.avatar_url
            and not member.avatar_url.endswith("_tg.webp")
            and (
                "/static/avatars/" in member.avatar_url
                or "supabase.co" in member.avatar_url
            )
        )
        if not has_custom_upload:
            local_url = await _download_avatar_from_url(
                data.photo_url,
                str(member.id),
                storage_service=request.app.state.storage_service,
            )
            if local_url and local_url != member.avatar_url:
                member.avatar_url = local_url
                needs_commit = True

    if needs_commit:
        session.add(member)
        await session.commit()

    # 6. Issue JWT
    auth_logger.info("telegram_login OK: member_id=%s, telegram_id=%s, ip=%s", member.id, data.id, client_ip)
    token = create_access_token(member.id)
    return TokenResponse(
        access_token=token,
        member_id=str(member.id),
        role=member.role,
    )


@router.post("/telegram-webapp", response_model=TokenResponse)
@limiter.limit("20/minute")
async def login_telegram_webapp(
    request: Request,
    data: TelegramWebAppAuthRequest,
    session: AsyncSession = Depends(get_session),
):
    """Authenticate Telegram WebApp user by validating initData signature."""
    client_ip = request.client.host if request.client else "unknown"
    init_data = data.init_data.strip()
    verified_payload = verify_telegram_webapp_init_data(init_data, settings.BOT_TOKEN)
    if verified_payload is None:
        auth_logger.warning("telegram_webapp_login FAIL: invalid signature, ip=%s", client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидная подпись Telegram WebApp",
        )

    auth_date_raw = verified_payload.get("auth_date")
    try:
        auth_date = int(auth_date_raw) if auth_date_raw else 0
    except ValueError:
        auth_date = 0
    if auth_date <= 0 or abs(time.time() - auth_date) > 300:
        auth_logger.warning("telegram_webapp_login FAIL: expired auth_date, ip=%s", client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Авторизация устарела. Откройте портал из Telegram снова",
        )

    user_raw = verified_payload.get("user")
    if not user_raw:
        auth_logger.warning("telegram_webapp_login FAIL: user missing, ip=%s", client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Некорректные данные Telegram WebApp",
        )

    try:
        user_data = json.loads(user_raw)
        telegram_id = int(user_data["id"])
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        auth_logger.warning("telegram_webapp_login FAIL: bad user payload, ip=%s", client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Некорректные данные пользователя Telegram",
        )

    member = await member_repo.get_by_telegram_id(session, telegram_id)
    if not member or not member.is_active:
        auth_logger.warning(
            "telegram_webapp_login FAIL: member not found/inactive, telegram_id=%s, ip=%s",
            telegram_id,
            client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён. Обратитесь к модератору для добавления в команду",
        )

    needs_commit = False
    username = user_data.get("username")
    if username and username != member.telegram_username:
        member.telegram_username = username
        needs_commit = True

    photo_url = user_data.get("photo_url")
    if photo_url:
        has_custom_upload = bool(
            member.avatar_url
            and not member.avatar_url.endswith("_tg.webp")
            and (
                "/static/avatars/" in member.avatar_url
                or "supabase.co" in member.avatar_url
            )
        )
        if not has_custom_upload:
            local_url = await _download_avatar_from_url(
                photo_url,
                str(member.id),
                storage_service=request.app.state.storage_service,
            )
            if local_url and local_url != member.avatar_url:
                member.avatar_url = local_url
                needs_commit = True

    if needs_commit:
        session.add(member)
        await session.commit()

    auth_logger.info(
        "telegram_webapp_login OK: member_id=%s, telegram_id=%s, ip=%s",
        member.id,
        telegram_id,
        client_ip,
    )
    token = create_access_token(member.id)
    return TokenResponse(
        access_token=token,
        member_id=str(member.id),
        role=member.role,
    )


class DevLoginRequest(BaseModel):
    telegram_id: int


@router.post("/dev-login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def dev_login(
    request: Request,
    data: DevLoginRequest,
    session: AsyncSession = Depends(get_session),
):
    """Dev-only login by telegram_id. Only available when DEBUG=true."""
    if not settings.DEBUG:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )

    client_ip = request.client.host if request.client else "unknown"
    auth_logger.warning("dev_login attempt: telegram_id=%s, ip=%s", data.telegram_id, client_ip)

    member = await member_repo.get_by_telegram_id(session, data.telegram_id)
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
    """Public endpoint — returns bot username and auth mode config."""
    return {
        "bot_username": settings.TELEGRAM_BOT_USERNAME,
        "debug": settings.DEBUG,
    }


@router.post("/web-login", response_model=WebLoginInitResponse)
@limiter.limit("5/minute")
async def web_login_init(
    request: Request,
    data: WebLoginInitRequest,
    session: AsyncSession = Depends(get_session),
):
    """Initiate web login via Telegram bot confirmation."""
    client_ip = request.client.host if request.client else "unknown"
    username = data.username.lstrip("@").lower()

    member = await member_repo.get_by_telegram_username(session, username)
    if not member or not member.is_active:
        auth_logger.warning(
            "web_login FAIL: user not found, username=%s, ip=%s", username, client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Пользователь @{username} не найден. "
                "Убедитесь, что вы зарегистрированы — напишите /start боту"
            ),
        )

    login_request = web_login_service.create_request(member.telegram_id)
    auth_logger.info(
        "web_login initiated: username=%s, telegram_id=%s, request_id=%s, ip=%s",
        username, member.telegram_id, login_request.request_id, client_ip,
    )

    # Send confirmation message to user's Telegram
    bot = request.app.state.bot
    if bot:
        from app.bot.handlers.common import send_web_login_confirmation

        await send_web_login_confirmation(
            bot, member.telegram_id, login_request.request_id
        )
    else:
        logger.warning("Bot not available — cannot send web login confirmation to tg_id=%s", member.telegram_id)

    return WebLoginInitResponse(
        request_id=login_request.request_id,
        expires_at=login_request.expires_at.isoformat(),
    )


@router.get("/web-login/{request_id}/status", response_model=WebLoginStatusResponse)
@limiter.limit("30/minute")
async def web_login_status(
    request: Request,
    request_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Check web login request status (called by frontend polling)."""
    login_request = web_login_service.get_request(request_id)
    if login_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запрос на вход не найден",
        )

    if login_request.status == "expired":
        return WebLoginStatusResponse(status="expired")

    if login_request.status == "confirmed":
        member = await member_repo.get_by_telegram_id(
            session, login_request.telegram_id
        )
        if not member or not member.is_active:
            web_login_service.delete_request(request_id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Пользователь не найден или деактивирован",
            )
        token = create_access_token(member.id)
        # Clean up: remove request to prevent issuing multiple tokens
        web_login_service.delete_request(request_id)
        auth_logger.info(
            "web_login confirmed: telegram_id=%s, request_id=%s",
            login_request.telegram_id, request_id,
        )
        return WebLoginStatusResponse(
            status="confirmed",
            access_token=token,
            member_id=str(member.id),
            role=member.role,
        )

    return WebLoginStatusResponse(status="pending")


@router.get("/me", response_model=dict)
async def get_me(member: TeamMember = Depends(get_current_user)):
    """Get current user info."""
    return {
        "id": str(member.id),
        "telegram_id": member.telegram_id,
        "telegram_username": member.telegram_username,
        "full_name": member.full_name,
        "name_variants": member.name_variants,
        "role": member.role,
        "is_active": member.is_active,
        "position": member.position,
        "department_id": str(member.department_id) if member.department_id else None,
        "extra_department_ids": [str(dept_id) for dept_id in member.extra_department_ids],
        "avatar_url": member.avatar_url,
        "email": member.email,
        "birthday": member.birthday.isoformat() if member.birthday else None,
        "created_at": member.created_at.isoformat() if member.created_at else None,
        "updated_at": member.updated_at.isoformat() if member.updated_at else None,
    }
