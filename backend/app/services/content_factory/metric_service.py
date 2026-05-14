import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CFMetricSnapshot
from app.db.schemas import CFMetricSnapshotCreate


class MetricService:
    @staticmethod
    async def record(session: AsyncSession, payload: CFMetricSnapshotCreate) -> CFMetricSnapshot:
        snap = CFMetricSnapshot(
            publication_id=payload.publication_id,
            window=payload.window,
            metric_name=payload.metric_name,
            metric_value=payload.metric_value,
            metric_value_text=payload.metric_value_text,
            source=payload.source,
            source_method=payload.source_method,
            confidence=payload.confidence,
            raw_payload=payload.raw_payload,
            note=payload.note,
            captured_by_id=payload.captured_by_id,
        )
        session.add(snap)
        await session.flush()
        await session.refresh(snap)
        return snap

    @staticmethod
    async def list_for_publication(
        session: AsyncSession, publication_id: uuid.UUID
    ) -> list[CFMetricSnapshot]:
        result = await session.execute(
            select(CFMetricSnapshot).where(CFMetricSnapshot.publication_id == publication_id)
            .order_by(CFMetricSnapshot.captured_at)
        )
        return list(result.scalars().all())
