import asyncio
import logging
from pathlib import Path

import uvicorn
from aiogram import Bot, Dispatcher
from aiogram.types import MenuButtonWebApp, WebAppInfo
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
from app.bot.middlewares import AuthMiddleware
from app.config import settings
from app.db.database import async_session
from app.services.meeting_scheduler_service import MeetingSchedulerService
from app.services.reminder_service import ReminderService
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
if settings.MINI_APP_URL:
    mini_app_origin = settings.MINI_APP_URL.rstrip("/")
    if mini_app_origin not in cors_origins:
        cors_origins.append(mini_app_origin)
if settings.NEXT_PUBLIC_FRONTEND_URL:
    frontend_origin = settings.NEXT_PUBLIC_FRONTEND_URL.rstrip("/")
    if frontend_origin not in cors_origins:
        cors_origins.append(frontend_origin)

logger.info("CORS_ORIGINS raw: %r", settings.CORS_ORIGINS)
logger.info("MINI_APP_URL: %r", settings.MINI_APP_URL)
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
        # Allow Telegram to embed Mini App in iframe
        if settings.MINI_APP_URL:
            from urllib.parse import urlparse
            mini_app_host = urlparse(settings.MINI_APP_URL).netloc
            response.headers["X-Frame-Options"] = f"ALLOW-FROM https://{mini_app_host}"
        else:
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
dp = Dispatcher()

# Bot Middleware
dp.message.middleware(AuthMiddleware())
dp.callback_query.middleware(AuthMiddleware())

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


@app.get("/health")
async def health():
    return {"status": "ok"}


async def start_bot():
    """Запуск Telegram-бота в режиме polling."""
    logger.info("Starting Telegram bot polling...")
    await dp.start_polling(bot)


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
    # Start schedulers
    reminder_service.start()
    logger.info("Reminder scheduler started")
    meeting_scheduler.start()
    logger.info("Meeting scheduler started")

    # Set Menu Button for Mini App
    if settings.MINI_APP_URL:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="\U0001f4cb Задачи",
                web_app=WebAppInfo(url=settings.MINI_APP_URL),
            )
        )
        logger.info("Mini App menu button set: %s", settings.MINI_APP_URL)

    try:
        await asyncio.gather(
            start_bot(),
            start_api(),
        )
    finally:
        reminder_service.stop()
        meeting_scheduler.stop()


if __name__ == "__main__":
    asyncio.run(main())
