import asyncio
import logging
from contextlib import suppress
from pathlib import Path
from urllib.parse import urlparse

import uvicorn
from aiogram import Bot, Dispatcher
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.auth import limiter
from app.api.router import api_router
from app.bot.handlers.common import router as common_router
from app.bot.handlers.meetings import router as meetings_router
from app.bot.handlers.settings import router as settings_router
from app.bot.handlers.summary import router as summary_router
from app.bot.handlers.task_updates import router as task_updates_router
from app.bot.handlers.tasks import router as tasks_router
from app.bot.handlers.voice import router as voice_router
from app.bot.menu import configure_global_menu
from app.bot.middlewares import AuthMiddleware
from app.config import settings
from app.db.database import async_session
from app.services.broadcast_scheduler_service import BroadcastSchedulerService
from app.services.meeting_scheduler_service import MeetingSchedulerService
from app.services.reminder_service import ReminderService
from app.services.supabase_storage import SupabaseStorageService
from app.services.zoom_service import ZoomService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Oncoschool Task Manager",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# CORS (must be added BEFORE other middleware — last added = first executed)
cors_origins = list(settings.cors_origins_list)

def _origin_from_url(value: str) -> str | None:
    value = value.strip()
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return value.rstrip("/")


for _value in (settings.NEXT_PUBLIC_FRONTEND_URL,):
    _origin = _origin_from_url(_value)
    if _origin and _origin not in cors_origins:
        cors_origins.append(_origin)

logger.info("CORS origins final: %s", cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)

# REST API
app.include_router(api_router)

# Static files (avatars)
static_dir = Path(__file__).resolve().parents[1] / "static"
static_dir.mkdir(parents=True, exist_ok=True)
(static_dir / "avatars").mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

bot = Bot(token=settings.BOT_TOKEN)
app.state.bot = bot
dp = Dispatcher()

# Supabase Storage (optional — graceful fallback to local filesystem)
storage_service = None
if settings.supabase_storage_configured:
    storage_service = SupabaseStorageService(
        supabase_url=settings.SUPABASE_URL,
        service_key=settings.SUPABASE_SERVICE_KEY,
    )
    logger.info("SupabaseStorageService initialized")
else:
    logger.info("Supabase Storage not configured — using local filesystem for avatars")
app.state.storage_service = storage_service

# Bot Middleware
dp.message.middleware(AuthMiddleware(storage_service=storage_service))
dp.callback_query.middleware(AuthMiddleware(storage_service=storage_service))

# Bot Роутеры
dp.include_router(common_router)
dp.include_router(tasks_router)
dp.include_router(task_updates_router)
dp.include_router(summary_router)
dp.include_router(voice_router)
dp.include_router(settings_router)
dp.include_router(meetings_router)

# Zoom Service (optional — graceful fallback if not configured)
zoom_service = None
if settings.zoom_configured:
    zoom_service = ZoomService(
        account_id=settings.ZOOM_ACCOUNT_ID,
        client_id=settings.ZOOM_CLIENT_ID,
        client_secret=settings.ZOOM_CLIENT_SECRET,
    )
    logger.info("ZoomService initialized")
else:
    logger.info("Zoom not configured — ZoomService disabled")

# Make zoom_service accessible from API endpoints via app.state
app.state.zoom_service = zoom_service

# Schedulers
reminder_service = ReminderService(bot=bot, session_maker=async_session)
meeting_scheduler = MeetingSchedulerService(
    bot=bot, session_maker=async_session, zoom_service=zoom_service
)
broadcast_scheduler = BroadcastSchedulerService(bot=bot, session_maker=async_session)


@app.on_event("startup")
async def _start_background_schedulers() -> None:
    """Ensure schedulers run for both `python -m app.main` and `uvicorn app.main:app`."""
    reminder_service.start()
    meeting_scheduler.start()
    broadcast_scheduler.start()


@app.on_event("shutdown")
async def _stop_background_schedulers() -> None:
    reminder_service.stop()
    meeting_scheduler.stop()
    broadcast_scheduler.stop()


@app.get("/health")
async def health():
    return {"status": "ok"}


async def start_bot():
    """Запуск Telegram-бота в режиме polling."""
    while True:
        try:
            logger.info("Starting Telegram bot polling...")
            await dp.start_polling(bot)
            logger.info("Telegram bot polling stopped gracefully")
            return
        except Exception:
            logger.exception("Telegram polling crashed; retrying in 5 seconds")
            await asyncio.sleep(5)


async def start_api():
    """Запуск FastAPI через uvicorn."""
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
    )
    server = uvicorn.Server(config)
    logger.info("Starting FastAPI server on port 8000...")
    await server.serve()


async def main():
    """Запуск FastAPI + aiogram polling + APScheduler параллельно."""
    # Configure Telegram menu commands for private chats.
    try:
        await configure_global_menu(bot)
        logger.info("Telegram menu commands configured")
    except Exception:
        logger.exception("Failed to configure Telegram menu commands at startup")

    bot_task = asyncio.create_task(start_bot(), name="telegram-polling")
    api_task = asyncio.create_task(start_api(), name="fastapi-server")
    done, pending = await asyncio.wait(
        {bot_task, api_task},
        return_when=asyncio.FIRST_EXCEPTION,
    )
    for task in done:
        exc = task.exception()
        if exc is not None:
            logger.exception("Main task %s failed", task.get_name(), exc_info=exc)
    for task in pending:
        task.cancel()
    with suppress(asyncio.CancelledError):
        await asyncio.gather(*pending)


if __name__ == "__main__":
    asyncio.run(main())
