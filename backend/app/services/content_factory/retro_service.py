import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CFRetroNote
from app.db.schemas import CFRetroNoteCreate


class RetroService:
    @staticmethod
    async def create(session: AsyncSession, payload: CFRetroNoteCreate) -> CFRetroNote:
        retro = CFRetroNote(
            period_start=payload.period_start,
            period_end=payload.period_end,
            retro_type=payload.retro_type,
            bundle_id=payload.bundle_id,
            facilitator_id=payload.facilitator_id,
            best_by_objective=payload.best_by_objective,
            broken=payload.broken,
            learnings=payload.learnings,
            decisions=payload.decisions,
            actions=payload.actions,
            notes=payload.notes,
        )
        session.add(retro)
        await session.flush()
        await session.refresh(retro)
        return retro

    @staticmethod
    async def get(session: AsyncSession, retro_id: uuid.UUID) -> CFRetroNote | None:
        result = await session.execute(select(CFRetroNote).where(CFRetroNote.id == retro_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list(
        session: AsyncSession, *, retro_type: str | None = None, limit: int = 50
    ) -> list[CFRetroNote]:
        stmt = select(CFRetroNote).order_by(CFRetroNote.period_end.desc()).limit(limit)
        if retro_type:
            stmt = stmt.where(CFRetroNote.retro_type == retro_type)
        result = await session.execute(stmt)
        return list(result.scalars().all())
