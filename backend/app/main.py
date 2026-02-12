import asyncio
import logging

import uvicorn
from aiogram import Bot, Dispatcher
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
from app.services.reminder_service import ReminderService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Oncoschool Task Manager", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST API
app.include_router(api_router)

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

# Scheduler
reminder_service = ReminderService(bot=bot, session_maker=async_session)


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
    # Start reminder scheduler
    reminder_service.start()
    logger.info("Reminder scheduler started")

    try:
        await asyncio.gather(
            start_bot(),
            start_api(),
        )
    finally:
        reminder_service.stop()


if __name__ == "__main__":
    asyncio.run(main())
