from aiogram.filters import BaseFilter
from aiogram.types import Message

from app.db.models import TeamMember


class IsModeratorFilter(BaseFilter):
    """Фильтр: пропускает только модераторов."""

    async def __call__(self, message: Message, member: TeamMember) -> bool:
        return member.role == "moderator"
