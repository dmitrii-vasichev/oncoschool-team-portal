import asyncio
import logging

import uvicorn
from aiogram import Bot, Dispatcher
from fastapi import FastAPI

from app.bot.handlers.common import router as common_router
from app.bot.handlers.task_updates import router as task_updates_router
from app.bot.handlers.tasks import router as tasks_router
from app.bot.middlewares import AuthMiddleware
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Oncoschool Task Manager", version="0.1.0")

bot = Bot(token=settings.BOT_TOKEN)
dp = Dispatcher()

# Middleware
dp.message.middleware(AuthMiddleware())
dp.callback_query.middleware(AuthMiddleware())

# Роутеры
dp.include_router(common_router)
dp.include_router(tasks_router)
dp.include_router(task_updates_router)


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
    """Запуск FastAPI + aiogram polling параллельно."""
    await asyncio.gather(
        start_bot(),
        start_api(),
    )


if __name__ == "__main__":
    asyncio.run(main())
