import time
from typing import Any

from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db.repositories import TelegramTargetRepository

ACCESS_CACHE_TTL_SECONDS = 30

_cache_expires_at: float = 0.0
_cached_chat_ids: set[int] = set()
_target_repo = TelegramTargetRepository()


def invalidate_incoming_task_chat_ids_cache() -> None:
    """Drop in-memory cache so next read reflects fresh DB state."""
    global _cache_expires_at, _cached_chat_ids
    _cache_expires_at = 0.0
    _cached_chat_ids = set()


async def get_allowed_incoming_task_chat_ids(
    session_maker: async_sessionmaker,
) -> set[int]:
    global _cache_expires_at, _cached_chat_ids

    now = time.time()
    if now < _cache_expires_at:
        return set(_cached_chat_ids)

    async with session_maker() as session:
        chat_ids = await _target_repo.get_active_chat_ids_for_incoming_tasks(session)

    _cached_chat_ids = set(chat_ids)
    _cache_expires_at = now + ACCESS_CACHE_TTL_SECONDS
    return set(_cached_chat_ids)


async def is_chat_allowed_for_incoming_tasks(
    session_maker: async_sessionmaker,
    chat_id: int | Any,
) -> bool:
    try:
        normalized_chat_id = int(chat_id)
    except (TypeError, ValueError):
        return False

    allowed_chat_ids = await get_allowed_incoming_task_chat_ids(session_maker)
    return normalized_chat_id in allowed_chat_ids
