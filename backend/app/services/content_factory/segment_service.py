import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CFExternalSegment, CFSegmentSnapshot
from app.db.schemas import CFExternalSegmentCreate


class SegmentService:
    @staticmethod
    async def create(session: AsyncSession, payload: CFExternalSegmentCreate) -> CFExternalSegment:
        seg = CFExternalSegment(
            source=payload.source,
            source_segment_id=payload.source_segment_id,
            source_url=payload.source_url,
            name=payload.name,
            description=payload.description,
            population_count=payload.population_count,
            is_active=payload.is_active,
            owner_id=payload.owner_id,
        )
        session.add(seg)
        await session.flush()

        snapshot = CFSegmentSnapshot(
            external_segment_id=seg.id,
            population_count=payload.population_count,
        )
        session.add(snapshot)
        await session.flush()
        await session.refresh(seg)
        return seg

    @staticmethod
    async def get(session: AsyncSession, seg_id: uuid.UUID) -> CFExternalSegment | None:
        result = await session.execute(select(CFExternalSegment).where(CFExternalSegment.id == seg_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list(session: AsyncSession, *, only_active: bool = True) -> list[CFExternalSegment]:
        stmt = select(CFExternalSegment).order_by(CFExternalSegment.population_count.desc())
        if only_active:
            stmt = stmt.where(CFExternalSegment.is_active.is_(True))
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def refresh_population(
        session: AsyncSession, seg_id: uuid.UUID, new_population: int
    ) -> CFExternalSegment | None:
        seg = await SegmentService.get(session, seg_id)
        if seg is None:
            return None
        seg.population_count = new_population
        snapshot = CFSegmentSnapshot(external_segment_id=seg.id, population_count=new_population)
        session.add(snapshot)
        await session.flush()
        return seg
